from django.conf import settings
from django.db import models
from django.utils import timezone

from choices import EstadoPedido, MedioPago


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
    vence_en = models.DateTimeField(help_text="Si no se recoge antes, se cancela")

    class Meta:
        ordering = ["-creado"]

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
