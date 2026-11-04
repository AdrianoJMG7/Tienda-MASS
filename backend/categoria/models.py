from django.db import models


class Categoria(models.Model):
    nombre = models.CharField(max_length=60, unique=True)
    descripcion = models.CharField(max_length=200, blank=True)
    imagen = models.ImageField(upload_to="categorias/", blank=True)
    activa = models.BooleanField(default=True, help_text="Sus productos solo se muestran si la categoría está activa.")

    class Meta:
        ordering = ["nombre"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def __str__(self):
        return self.nombre
