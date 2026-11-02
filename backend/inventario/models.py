from django.conf import settings
from django.db import models
from django.utils import timezone


class Stock(models.Model):
    """Stock de un producto en una tienda.

    cantidad: unidades disponibles para vender, en la web o en caja.
    reservado: unidades apartadas por pedidos online que aún no se recogen (HU09).
    stock_minimo: umbral para alertas de stock bajo (HU14).
    fecha_vencimiento: fecha de vencimiento del lote actual (HU14).
    """

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.CASCADE, related_name="stock")
    producto = models.ForeignKey("producto.Producto", on_delete=models.CASCADE, related_name="stocks")
    cantidad = models.PositiveIntegerField(default=0)
    reservado = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=0, help_text="Umbral para alertas de stock bajo")
    fecha_vencimiento = models.DateField(null=True, blank=True, help_text="Fecha de vencimiento del lote")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tienda", "producto"], name="stock_unico_por_tienda")]
        verbose_name = "stock"
        verbose_name_plural = "stocks"

    def __str__(self):
        return f"{self.producto} en {self.tienda.codigo}: {self.cantidad}"


class MovimientoStock(models.Model):
    """Historial auditable de cada cambio en el stock de una tienda."""

    class Tipo(models.TextChoices):
        RESERVA = "reserva", "Reserva"
        LIBERACION = "liberacion", "Liberación"
        VENTA = "venta", "Venta"
        INGRESO = "ingreso", "Ingreso"
        MERMA = "merma", "Merma"

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.CASCADE, related_name="movimientos")
    producto = models.ForeignKey("producto.Producto", on_delete=models.CASCADE, related_name="movimientos")
    tipo = models.CharField(max_length=12, choices=Tipo.choices)
    cantidad = models.PositiveIntegerField()
    motivo = models.CharField(max_length=120, blank=True)
    referencia = models.CharField(max_length=40, blank=True, help_text="Pedido o venta que lo originó")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    fecha = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-fecha", "-id"]
        verbose_name = "movimiento de stock"
        verbose_name_plural = "movimientos de stock"
