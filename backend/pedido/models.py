from django.conf import settings
from django.db import models
from django.utils import timezone

from choices import EstadoPedido, MedioPago


class CanceladoPor(models.TextChoices):
    CLIENTE = "cliente", "Cliente"
    VENDEDOR = "vendedor", "Vendedor"
    SISTEMA = "sistema", "Sistema (no recogido a tiempo)"


class Pedido(models.Model):
    """Pedido online para recoger en tienda; el cliente paga al recoger."""

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pedidos")
    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.PROTECT, related_name="pedidos")
    estado = models.CharField(max_length=15, choices=EstadoPedido.choices, default=EstadoPedido.RECIBIDO)
    codigo_recojo = models.CharField(max_length=6, unique=True)
    medio_pago = models.CharField(
        max_length=10, choices=MedioPago.choices, help_text="Medio con el que el cliente pagará al recoger"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)
    creado = models.DateTimeField(default=timezone.now, db_index=True)
    vence_en = models.DateTimeField(help_text="Si no se recoge antes, se cancela y se libera la reserva")
    # Seguimiento de la atención en tienda (HU10); también sirve para medir tiempos (HU16).
    preparado_en = models.DateTimeField(null=True, blank=True)
    listo_en = models.DateTimeField(null=True, blank=True)
    entregado_en = models.DateTimeField(null=True, blank=True)
    cancelado_en = models.DateTimeField(null=True, blank=True)
    cancelado_por = models.CharField(max_length=10, choices=CanceladoPor.choices, blank=True)
    motivo_cancelacion = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-creado"]

    @property
    def activo(self):
        """Sigue pendiente de recojo, con su stock reservado."""
        return self.estado not in (EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO)

    def __str__(self):
        return f"Pedido {self.codigo_recojo} ({self.get_estado_display()})"


class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey("producto.Producto", on_delete=models.PROTECT, related_name="+")
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Precio vigente al confirmar"
    )

    class Meta:
        ordering = ["id"]

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario
