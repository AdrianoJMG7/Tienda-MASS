from decimal import Decimal

from django.db import models


class Tienda(models.Model):
    codigo = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=100)
    distrito = models.CharField(max_length=80)
    direccion = models.CharField(max_length=200)
    horario = models.CharField(max_length=100, default="Lun a Dom de 7:00 a 22:00")
    activa = models.BooleanField(default=True, help_text="Solo las tiendas activas son punto de recojo.")
    meta_mensual = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("15000"), help_text="Meta de ventas del mes (S/); dato interno."
    )

    class Meta:
        ordering = ["codigo"]
        verbose_name = "tienda"
        verbose_name_plural = "tiendas"

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"
