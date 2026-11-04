"""Servicios para registrar ventas en caja (HU12)."""

from collections import Counter
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from choices import CanalVenta, MedioPago
from inventario import servicios as inventario
from producto.models import Producto

from .models import DetalleVenta, Venta


@transaction.atomic
def crear_venta(vendedor, tienda, items, medio_pago, monto_recibido=None):
    """HU12: registra una venta en caja y descuenta el stock de la tienda.

    items: lista de {"producto": id, "cantidad": n}. Los precios los fija el servidor con el
    precio vigente (oferta incluida); nunca se toman del navegador.
    """
    cantidades = Counter()
    for item in items:
        cantidades[item["producto"]] += item["cantidad"]

    productos = {p.id: p for p in Producto.objects.filter(id__in=cantidades, activo=True).con_precio_vigente()}
    if faltan := [i for i in cantidades if i not in productos]:
        raise ValidationError({"items": f"Algunos productos ya no están disponibles en el catálogo: {faltan}."})

    # Verificar stock disponible en la tienda
    inventario.verificar_stock(tienda, [(productos[pid], cantidad) for pid, cantidad in cantidades.items()])

    venta = Venta.objects.create(
        tienda=tienda,
        vendedor=vendedor,
        total=0,
        medio_pago=medio_pago,
        canal=CanalVenta.CAJA,
        numero_ticket=f"CAJA-{timezone.localtime().strftime('%Y%m%d%H%M%S')}",
    )

    detalles = DetalleVenta.objects.bulk_create(
        DetalleVenta(
            venta=venta, producto=productos[pid], cantidad=cantidad, precio_unitario=productos[pid].precio_final
        )
        for pid, cantidad in cantidades.items()
    )
    venta.total = sum(d.subtotal for d in detalles)
    if medio_pago == MedioPago.EFECTIVO:
        if monto_recibido is not None and monto_recibido < venta.total:
            raise ValidationError({"monto_recibido": "El monto recibido no cubre el total de la venta."})
        venta.monto_recibido = monto_recibido
    venta.save(update_fields=["total", "monto_recibido"])

    # Descontar stock
    inventario.descontar(
        tienda, [(productos[pid], cantidad) for pid, cantidad in cantidades.items()],
        usuario=vendedor, referencia=f"Venta {venta.numero_ticket}",
    )

    return venta
