"""Ciclo de vida de un pedido para recoger en tienda.

recibido → en preparación → listo para recoger → entregado
En cualquier momento antes de entregarse puede cancelarse (vendedor, cliente o, si vence sin
recogerse, el sistema). Mientras está activo, su stock queda reservado (HU09).
"""

import logging
import secrets
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from choices import CanalVenta, EstadoPedido
from inventario import servicios as inventario
from producto.models import Producto
from venta.models import DetalleVenta, Venta

from .correos import enviar_confirmacion, enviar_listo
from .models import CanceladoPor, DetallePedido, Pedido

logger = logging.getLogger(__name__)

# Sin 0/O ni 1/I/L para que el código se pueda dictar y leer sin confusiones.
ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class TransicionInvalida(ValidationError):
    pass


def generar_codigo_recojo():
    while True:
        codigo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(6))
        if not Pedido.objects.filter(codigo_recojo=codigo).exists():
            return codigo


def _items(pedido):
    return [(d.producto, d.cantidad) for d in pedido.detalles.select_related("producto")]


def _bloquear(pedido):
    """Relee el pedido bloqueando la fila, para que dos acciones simultáneas no lo procesen dos veces."""
    return Pedido.objects.select_for_update().select_related("tienda", "cliente").get(pk=pedido.pk)


@transaction.atomic
def crear_pedido(cliente, tienda, items, medio_pago):
    """HU08 y HU09: confirma un pedido para recoger y reserva su stock.

    items: lista de {"producto": id, "cantidad": n}. Los precios los fija el servidor con el
    precio vigente (oferta incluida); nunca se toman del navegador.
    """
    if not tienda.activa:
        raise ValidationError({"tienda": "Esta tienda no está recibiendo pedidos. Elige otra."})

    cantidades = Counter()
    for item in items:
        cantidades[item["producto"]] += item["cantidad"]

    productos = {p.id: p for p in Producto.objects.filter(id__in=cantidades, activo=True).con_precio_vigente()}
    if faltan := [i for i in cantidades if i not in productos]:
        raise ValidationError({"items": f"Algunos productos ya no están disponibles en el catálogo: {faltan}."})

    ahora = timezone.now()
    pedido = Pedido.objects.create(
        cliente=cliente,
        tienda=tienda,
        medio_pago=medio_pago,
        codigo_recojo=generar_codigo_recojo(),
        total=0,
        creado=ahora,
        vence_en=ahora + timedelta(hours=settings.MASS_HORAS_RECOJO),
    )
    # Si algo no alcanza, la reserva lanza StockInsuficiente y se revierte todo, pedido incluido.
    inventario.reservar(
        tienda, [(productos[pid], cantidad) for pid, cantidad in cantidades.items()],
        usuario=cliente, referencia=f"Pedido {pedido.codigo_recojo}",
    )
    detalles = DetallePedido.objects.bulk_create(
        DetallePedido(
            pedido=pedido, producto=productos[pid], cantidad=cantidad, precio_unitario=productos[pid].precio_final
        )
        for pid, cantidad in cantidades.items()
    )
    pedido.total = sum(d.subtotal for d in detalles)
    pedido.save(update_fields=["total"])

    # El correo sale solo si el pedido quedó guardado.
    transaction.on_commit(lambda: enviar_confirmacion(pedido.id))
    return pedido


@transaction.atomic
def preparar(pedido, vendedor):
    """HU10: el vendedor empieza a preparar el pedido."""
    pedido = _bloquear(pedido)
    if pedido.estado != EstadoPedido.RECIBIDO:
        raise TransicionInvalida({"detail": f"El pedido está «{pedido.get_estado_display()}»; no se puede preparar."})
    pedido.estado = EstadoPedido.EN_PREPARACION
    pedido.preparado_en = timezone.now()
    pedido.save(update_fields=["estado", "preparado_en"])
    return pedido


@transaction.atomic
def marcar_listo(pedido, vendedor):
    """HU10: el pedido está listo para recoger; se avisa al cliente por correo."""
    pedido = _bloquear(pedido)
    if pedido.estado not in (EstadoPedido.RECIBIDO, EstadoPedido.EN_PREPARACION):
        raise TransicionInvalida(
            {"detail": f"El pedido está «{pedido.get_estado_display()}»; no se puede marcar como listo."}
        )
    ahora = timezone.now()
    pedido.estado = EstadoPedido.LISTO
    pedido.preparado_en = pedido.preparado_en or ahora
    pedido.listo_en = ahora
    pedido.save(update_fields=["estado", "preparado_en", "listo_en"])
    transaction.on_commit(lambda: enviar_listo(pedido.id))
    return pedido


@transaction.atomic
def entregar(pedido, vendedor, codigo, medio_pago):
    """HU10: entrega validando el código de recojo y registrando el medio de pago.

    Lo reservado sale de la tienda y el pedido genera una venta del canal web.
    """
    pedido = _bloquear(pedido)
    if pedido.estado != EstadoPedido.LISTO:
        raise TransicionInvalida(
            {"detail": "Solo se entregan pedidos listos para recoger. Márcalo como listo primero."}
        )
    if codigo.strip().upper() != pedido.codigo_recojo:
        raise ValidationError({"codigo": "El código de recojo no coincide con el de este pedido."})

    items = _items(pedido)
    inventario.entregar_reserva(pedido.tienda, items, usuario=vendedor, referencia=f"Pedido {pedido.codigo_recojo}")
    venta = Venta.objects.create(
        tienda=pedido.tienda,
        vendedor=vendedor,
        total=pedido.total,
        medio_pago=medio_pago,
        canal=CanalVenta.WEB,
        pedido=pedido,
        numero_ticket=f"WEB-{pedido.codigo_recojo}",
    )
    DetalleVenta.objects.bulk_create(
        DetalleVenta(venta=venta, producto=d.producto, cantidad=d.cantidad, precio_unitario=d.precio_unitario)
        for d in pedido.detalles.all()
    )
    pedido.estado = EstadoPedido.ENTREGADO
    pedido.entregado_en = timezone.now()
    pedido.save(update_fields=["estado", "entregado_en"])
    return pedido


@transaction.atomic
def cancelar(pedido, por, motivo, usuario=None):
    """HU09 y HU10: cancela un pedido activo y libera su reserva de stock."""
    pedido = _bloquear(pedido)
    if not pedido.activo:
        raise TransicionInvalida({"detail": f"El pedido ya está «{pedido.get_estado_display()}»."})
    if por == CanceladoPor.CLIENTE and pedido.estado not in (EstadoPedido.RECIBIDO, EstadoPedido.EN_PREPARACION):
        raise TransicionInvalida({"detail": "El pedido ya está listo; para cancelarlo comunícate con la tienda."})

    inventario.liberar(
        pedido.tienda, _items(pedido), usuario=usuario, referencia=f"Pedido {pedido.codigo_recojo}", motivo=motivo
    )
    pedido.estado = EstadoPedido.CANCELADO
    pedido.cancelado_en = timezone.now()
    pedido.cancelado_por = por
    pedido.motivo_cancelacion = motivo
    pedido.save(update_fields=["estado", "cancelado_en", "cancelado_por", "motivo_cancelacion"])
    return pedido


def liberar_vencidos(ahora=None):
    """HU09: cancela los pedidos no recogidos a tiempo y libera su stock. Devuelve cuántos fueron."""
    ahora = ahora or timezone.now()
    vencidos = Pedido.objects.filter(vence_en__lt=ahora).exclude(
        estado__in=[EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]
    )
    motivo = f"No se recogió en {settings.MASS_HORAS_RECOJO} horas."
    total = 0
    for pedido in vencidos:
        try:
            cancelar(pedido, CanceladoPor.SISTEMA, motivo)
            total += 1
        except Exception:
            # Un pedido con problemas no debe impedir liberar los demás.
            logger.exception("No se pudo cancelar el pedido vencido %s", pedido.codigo_recojo)
    return total
