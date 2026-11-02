"""Operaciones de stock. Todas son transaccionales (RNF-06).

Cada descuento usa un UPDATE condicional (`WHERE cantidad >= n`) que la base de datos ejecuta
de forma atómica: si dos pedidos compiten por la última unidad, solo uno logra actualizar la
fila y el otro recibe StockInsuficiente. Así dos pedidos nunca reservan la misma unidad (HU09).
"""

from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.exceptions import APIException

from .models import MovimientoStock, Stock

Tipo = MovimientoStock.Tipo


class StockInsuficiente(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "stock_insuficiente"

    def __init__(self, mensaje, productos):
        super().__init__(mensaje)
        # Se asigna directamente para que las cantidades lleguen como números y no como texto.
        self.detail = {"detail": mensaje, "productos": productos}


class ReservaInconsistente(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "reserva_inconsistente"
    default_detail = "La reserva del pedido no coincide con el stock de la tienda."


def _registrar(tienda, items, tipo, usuario, referencia, motivo=""):
    MovimientoStock.objects.bulk_create(
        MovimientoStock(
            tienda=tienda, producto=producto, tipo=tipo, cantidad=cantidad,
            usuario=usuario, referencia=referencia, motivo=motivo,
        )
        for producto, cantidad in items
    )


@transaction.atomic
def reservar(tienda, items, usuario=None, referencia=""):
    """Aparta stock para un pedido online. items: lista de (producto, cantidad).

    Si algún producto no alcanza, no se reserva nada (la transacción se revierte) y se
    informa de todos los productos que faltan.
    """
    sin_stock = []
    for producto, cantidad in items:
        filas = Stock.objects.filter(tienda=tienda, producto=producto, cantidad__gte=cantidad).update(
            cantidad=F("cantidad") - cantidad, reservado=F("reservado") + cantidad
        )
        if filas == 0:
            disponible = Stock.objects.filter(tienda=tienda, producto=producto).values_list("cantidad", flat=True).first()
            sin_stock.append(
                {"producto": producto.id, "nombre": producto.nombre, "disponible": disponible or 0, "solicitado": cantidad}
            )
    if sin_stock:
        raise StockInsuficiente(f"No hay stock suficiente en {tienda.nombre} para algunos productos.", sin_stock)
    _registrar(tienda, items, Tipo.RESERVA, usuario, referencia)


def _desde_reservado(tienda, items, devolver):
    for producto, cantidad in items:
        cambios = {"reservado": F("reservado") - cantidad}
        if devolver:
            cambios["cantidad"] = F("cantidad") + cantidad
        filas = Stock.objects.filter(tienda=tienda, producto=producto, reservado__gte=cantidad).update(**cambios)
        if filas == 0:
            raise ReservaInconsistente()


@transaction.atomic
def liberar(tienda, items, usuario=None, referencia="", motivo=""):
    """Pedido cancelado o vencido: lo reservado vuelve a estar disponible."""
    _desde_reservado(tienda, items, devolver=True)
    _registrar(tienda, items, Tipo.LIBERACION, usuario, referencia, motivo)


@transaction.atomic
def entregar_reserva(tienda, items, usuario=None, referencia=""):
    """Pedido entregado: lo reservado sale de la tienda como venta."""
    _desde_reservado(tienda, items, devolver=False)
    _registrar(tienda, items, Tipo.VENTA, usuario, referencia)


@transaction.atomic
def descontar(tienda, items, usuario=None, referencia=""):
    """HU12: venta en caja: descuenta stock directamente sin reserva previa."""
    sin_stock = []
    for producto, cantidad in items:
        filas = Stock.objects.filter(tienda=tienda, producto=producto, cantidad__gte=cantidad).update(
            cantidad=F("cantidad") - cantidad
        )
        if filas == 0:
            disponible = Stock.objects.filter(tienda=tienda, producto=producto).values_list("cantidad", flat=True).first()
            sin_stock.append(
                {"producto": producto.id, "nombre": producto.nombre, "disponible": disponible or 0, "solicitado": cantidad}
            )
    if sin_stock:
        raise StockInsuficiente(f"No hay stock suficiente en {tienda.nombre} para algunos productos.", sin_stock)
    _registrar(tienda, items, Tipo.VENTA, usuario, referencia)


def verificar_stock(tienda, items):
    """Verifica si hay stock suficiente sin modificarlo (para validación previa)."""
    sin_stock = []
    for producto, cantidad in items:
        stock = Stock.objects.filter(tienda=tienda, producto=producto).values_list("cantidad", flat=True).first()
        if stock is None or stock < cantidad:
            sin_stock.append(
                {"producto": producto.id, "nombre": producto.nombre, "disponible": stock or 0, "solicitado": cantidad}
            )
    if sin_stock:
        raise StockInsuficiente(f"No hay stock suficiente en {tienda.nombre} para algunos productos.", sin_stock)


@transaction.atomic
def registrar_ingreso(tienda, items, usuario=None, motivo="", fecha_vencimiento=None):
    """HU15: registra ingreso de mercadería, aumenta el stock y actualiza fecha de vencimiento si se proporciona."""
    for producto, cantidad in items:
        stock, _ = Stock.objects.get_or_create(tienda=tienda, producto=producto, defaults={"cantidad": 0})
        stock.cantidad = F("cantidad") + cantidad
        if fecha_vencimiento is not None:
            stock.fecha_vencimiento = fecha_vencimiento
        stock.save()
    _registrar(tienda, items, Tipo.INGRESO, usuario, "", motivo)


@transaction.atomic
def registrar_merma(tienda, items, usuario=None, motivo=""):
    """HU15: registra merma de mercadería, disminuye el stock."""
    sin_stock = []
    for producto, cantidad in items:
        filas = Stock.objects.filter(tienda=tienda, producto=producto, cantidad__gte=cantidad).update(
            cantidad=F("cantidad") - cantidad
        )
        if filas == 0:
            disponible = Stock.objects.filter(tienda=tienda, producto=producto).values_list("cantidad", flat=True).first()
            sin_stock.append(
                {"producto": producto.id, "nombre": producto.nombre, "disponible": disponible or 0, "solicitado": cantidad}
            )
    if sin_stock:
        raise StockInsuficiente(f"No hay stock suficiente en {tienda.nombre} para registrar la merma.", sin_stock)
    _registrar(tienda, items, Tipo.MERMA, usuario, "", motivo)
