from rest_framework import status
from rest_framework.test import APITestCase

from producto.models import Producto
from tienda.models import Tienda
from .models import Stock


class StockTests(APITestCase):
    """Pruebas para la gestión de stock."""

    def setUp(self):
        self.tienda = Tienda.objects.create(
            codigo="T-001",
            nombre="Tienda Central",
            distrito="Miraflores",
            direccion="Av. Principal 123",
        )
        self.producto = Producto.objects.create(
            nombre="Leche Entera",
            marca="Gloria",
            codigo_barras="1234567890123",
            precio="5.50",
        )

    def test_crear_stock(self):
        datos = {
            "tienda": self.tienda.id,
            "producto": self.producto.id,
            "cantidad": 50,
        }
        respuesta = self.client.post("/api/inventario/stock/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Stock.objects.count(), 1)
        self.assertEqual(Stock.objects.first().cantidad, 50)

    def test_stock_unico_por_tienda_producto(self):
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto,
            cantidad=50,
        )
        datos = {
            "tienda": self.tienda.id,
            "producto": self.producto.id,
            "cantidad": 100,
        }
        respuesta = self.client.post("/api/inventario/stock/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
