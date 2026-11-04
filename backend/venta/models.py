from django.conf import settings
from django.db import models
from django.utils import timezone

from choices import CanalVenta, MedioPago


class MotivoDevolucion(models.TextChoices):
    DANADO = "danado", "Producto dañado"
    VENCIDO = "vencido", "Producto vencido"
    CAMBIO = "cambio_opinion", "El cliente cambió de opinión"
    ERROR = "error_venta", "Error en la venta"


class TipoReembolso(models.TextChoices):
    EFECTIVO = "efectivo", "Efectivo"
    NOTA_CREDITO = "nota_credito", "Nota de crédito"


class Venta(models.Model):
    """Venta de una tienda: en caja, o web cuando el vendedor entrega un pedido online."""

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.PROTECT, related_name="ventas")
    vendedor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ventas")
    fecha = models.DateTimeField(default=timezone.now, db_index=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    medio_pago = models.CharField(max_length=10, choices=MedioPago.choices)
    numero_ticket = models.CharField(max_length=20, blank=True, null=True)
    monto_recibido = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, help_text="Efectivo que entregó el cliente"
    )
    canal = models.CharField(max_length=4, choices=CanalVenta.choices, default=CanalVenta.CAJA)
    pedido = models.OneToOneField(
        "pedido.Pedido", null=True, blank=True, on_delete=models.PROTECT, related_name="venta",
        help_text="Pedido online que originó la venta (canal web)",
    )

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

    @property
    def devuelto(self):
        return sum(d.cantidad for d in self.devoluciones.all())

    @property
    def disponible_devolver(self):
        return self.cantidad - self.devuelto


class Devolucion(models.Model):
    """Unidades de una venta que el cliente devolvió y lo que se le reembolsó."""

    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name="devoluciones")
    detalle = models.ForeignKey(DetalleVenta, on_delete=models.PROTECT, related_name="devoluciones")
    cantidad = models.PositiveIntegerField()
    motivo = models.CharField(max_length=15, choices=MotivoDevolucion.choices)
    tipo_reembolso = models.CharField(max_length=12, choices=TipoReembolso.choices)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    vendedor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    fecha = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "devolución"
        verbose_name_plural = "devoluciones"


class CierreCaja(models.Model):
    """Cierre del turno de un vendedor: lo vendido y el efectivo contado contra el esperado."""

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.PROTECT, related_name="cierres")
    vendedor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cierres")
    inicio = models.DateTimeField()
    fin = models.DateTimeField(default=timezone.now, db_index=True)
    ventas = models.PositiveIntegerField()
    unidades = models.PositiveIntegerField()
    total = models.DecimalField(max_digits=12, decimal_places=2)
    efectivo_esperado = models.DecimalField(max_digits=12, decimal_places=2)
    efectivo_contado = models.DecimalField(max_digits=12, decimal_places=2)
    diferencia = models.DecimalField(max_digits=12, decimal_places=2)
    notas = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-fin"]
        verbose_name = "cierre de caja"
        verbose_name_plural = "cierres de caja"
