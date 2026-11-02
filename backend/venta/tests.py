from rest_framework import status
from rest_framework.test import APITestCase

from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Usuario
from .models import DetalleVenta, Venta


class VentaTests(APITestCase):
    """Pruebas para la gestión de ventas."""

    def setUp(self):
        self.tienda = Tienda.objects.create(
            codigo="T-001",
            nombre="Tienda Central",
            distrito="Miraflores",
            direccion="Av. Principal 123",
        )
        self.vendedor = Usuario.objects.create_user(
            email="vendedor@test.com",
            nombre="Vendedor Test",
            password="Test1234",
            rol=Usuario.VENDEDOR,
            tienda=self.tienda,
        )
        self.producto = Producto.objects.create(
            nombre="Leche Entera",
            marca="Gloria",
            codigo_barras="1234567890123",
            precio="5.50",
        )

    def test_crear_venta(self):
        datos = {
            "tienda": self.tienda.id,
            "vendedor": self.vendedor.id,
            "total": "11.00",
            "medio_pago": "efectivo",
            "numero_ticket": "T-001-12345",
        }
        respuesta = self.client.post("/api/venta/ventas/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Venta.objects.count(), 1)
        self.assertEqual(Venta.objects.first().numero_ticket, "T-001-12345")
