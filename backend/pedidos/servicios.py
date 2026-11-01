import secrets
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from catalogo.models import Producto
from inventario.models import StockTienda

from .correos import enviar_confirmacion
from .models import DetallePedido, Pedido

# Sin 0/O ni 1/I/L para que el código se pueda dictar y leer sin confusiones.
ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class StockInsuficiente(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "stock_insuficiente"

    def __init__(self, mensaje, productos):
        super().__init__(mensaje)
        # Se asigna directamente para que las cantidades lleguen como números y no como texto.
        self.detail = {"detail": mensaje, "productos": productos}


def generar_codigo_recojo():
    while True:
        codigo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(6))
        if not Pedido.objects.filter(codigo_recojo=codigo).exists():
            return codigo


@transaction.atomic
def crear_pedido(cliente, tienda, items, medio_pago):
    """HU08: confirma un pedido para recoger.

    items: lista de {"producto": id, "cantidad": n}. Los precios los fija el servidor con el
    precio vigente (oferta incluida); nunca se toman del navegador.
    """
    if not tienda.activa:
        raise ValidationError({"tienda": "Esta tienda no está recibiendo pedidos. Elige otra."})

    cantidades = Counter()
    for item in items:
        cantidades[item["producto"]] += item["cantidad"]

    productos = {
        p.id: p
        for p in Producto.objects.filter(id__in=cantidades, activo=True).con_precio_vigente()
    }
    if faltan := [i for i in cantidades if i not in productos]:
        raise ValidationError({"items": f"Algunos productos ya no están disponibles en el catálogo: {faltan}."})

    stock = dict(
        StockTienda.objects.filter(tienda=tienda, producto_id__in=cantidades).values_list("producto_id", "disponible")
    )
    sin_stock = [
        {"producto": pid, "nombre": productos[pid].nombre, "disponible": stock.get(pid, 0), "solicitado": cantidad}
        for pid, cantidad in cantidades.items()
        if stock.get(pid, 0) < cantidad
    ]
    if sin_stock:
        raise StockInsuficiente(f"No hay stock suficiente en {tienda.nombre} para algunos productos.", sin_stock)

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
