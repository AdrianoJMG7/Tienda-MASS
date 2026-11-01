from django.db import models


class StockTienda(models.Model):
    """Stock de un producto en una tienda.

    disponible: unidades que se pueden vender en la web o en caja.
    reservado: unidades apartadas por pedidos online pendientes de recojo (HU09).
    """

    tienda = models.ForeignKey("tiendas.Tienda", on_delete=models.CASCADE, related_name="stock")
    producto = models.ForeignKey("catalogo.Producto", on_delete=models.CASCADE, related_name="stocks")
    disponible = models.PositiveIntegerField(default=0)
    reservado = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=5)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tienda", "producto"], name="stock_unico_por_tienda")]
        verbose_name = "stock de tienda"
        verbose_name_plural = "stock de tiendas"

    def __str__(self):
        return f"{self.producto} en {self.tienda.codigo}: {self.disponible}"
