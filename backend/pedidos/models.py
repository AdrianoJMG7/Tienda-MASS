from django.conf import settings
from django.db import models
from django.utils import timezone

from core.choices import MedioPago


class Pedido(models.Model):
    """Pedido online para recoger en tienda; el cliente paga al recoger."""

    class Estado(models.TextChoices):
        RECIBIDO = "recibido", "Recibido"
        EN_PREPARACION = "en_preparacion", "En preparación"
        LISTO = "listo", "Listo para recoger"
        ENTREGADO = "entregado", "Entregado"
        CANCELADO = "cancelado", "Cancelado"

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pedidos")
    tienda = models.ForeignKey("tiendas.Tienda", on_delete=models.PROTECT, related_name="pedidos")
    estado = models.CharField(max_length=15, choices=Estado.choices, default=Estado.RECIBIDO)
    codigo_recojo = models.CharField(max_length=6, unique=True)
    medio_pago = models.CharField(
        max_length=10, choices=MedioPago.choices, help_text="Medio con el que el cliente pagará al recoger"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)
    creado = models.DateTimeField(default=timezone.now, db_index=True)
    vence_en = models.DateTimeField(help_text="Si no se recoge antes, se cancela (HU09)")

    class Meta:
        ordering = ["-creado"]

    def __str__(self):
        return f"Pedido {self.codigo_recojo} ({self.get_estado_display()})"


class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey("catalogo.Producto", on_delete=models.PROTECT, related_name="+")
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Precio vigente (con oferta) al confirmar"
    )

    class Meta:
        ordering = ["id"]

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario
