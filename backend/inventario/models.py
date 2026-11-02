from django.db import models


class Stock(models.Model):
    """Stock de un producto en una tienda."""

    tienda = models.ForeignKey("tienda.Tienda", on_delete=models.CASCADE, related_name="stock")
    producto = models.ForeignKey("producto.Producto", on_delete=models.CASCADE, related_name="stocks")
    cantidad = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tienda", "producto"], name="stock_unico_por_tienda")]
        verbose_name = "stock"
        verbose_name_plural = "stocks"

    def __str__(self):
        return f"{self.producto} en {self.tienda.codigo}: {self.cantidad}"
