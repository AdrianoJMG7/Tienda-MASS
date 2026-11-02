from django.conf import settings
from django.db import models
from django.utils import timezone

from choices import MedioPago


class Venta(models.Model):
    """Venta en caja de tienda física."""

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.PROTECT, related_name="ventas")
    vendedor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ventas")
    fecha = models.DateTimeField(default=timezone.now, db_index=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    medio_pago = models.CharField(max_length=10, choices=MedioPago.choices)
    numero_ticket = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"Venta {self.id} - {self.tienda.codigo}"


class DetalleVenta(models.Model):
    """Detalle de una venta en caja."""

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey("producto.Producto", on_delete=models.PROTECT, related_name="+")
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["id"]

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario
