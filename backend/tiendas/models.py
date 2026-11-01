from django.db import models


class Tienda(models.Model):
    codigo = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=100)
    distrito = models.CharField(max_length=80)
    direccion = models.CharField(max_length=200)
    horario = models.CharField(max_length=100, default="Lun a Dom de 7:00 a 22:00")
    activa = models.BooleanField(default=True, help_text="Solo las tiendas activas son punto de recojo.")

    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"
