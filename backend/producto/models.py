from django.db import models


class Producto(models.Model):
    """Producto del catálogo central."""

    nombre = models.CharField(max_length=150)
    marca = models.CharField(max_length=60)
    codigo_barras = models.CharField(max_length=14, unique=True)
    foto = models.ImageField(upload_to="productos/", blank=True)
    categoria = models.ForeignKey("categoria.Categoria", on_delete=models.PROTECT, related_name="productos")
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        indexes = [models.Index(fields=["nombre"]), models.Index(fields=["marca"])]

    def __str__(self):
        return f"{self.nombre} ({self.marca})"
