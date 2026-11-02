from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Rol
from .models import DetallePedido, Pedido


class PedidoTests(APITestCase):
    """Pruebas para la gestión de pedidos."""

    def setUp(self):
        self.tienda = Tienda.objects.create(
            codigo="T-001",
            nombre="Tienda Central",
            distrito="Miraflores",
            direccion="Av. Principal 123",
        )
        self.cliente = get_user_model().objects.create_user(
            email="cliente@test.com",
            nombre="Cliente Test",
            password="Test1234",
            rol=Rol.CLIENTE,
        )
        self.producto = Producto.objects.create(
            nombre="Leche Entera",
            marca="Gloria",
            codigo_barras="1234567890123",
            categoria=Categoria.objects.create(nombre="Lácteos"),
            precio="5.50",
        )
        self.client.force_authenticate(user=self.cliente)

    def test_crear_pedido(self):
        datos = {
            "cliente": self.cliente.id,
            "tienda": self.tienda.id,
            "codigo_recojo": "ABC123",
            "medio_pago": "efectivo",
            "total": "11.00",
            "vence_en": "2026-11-03T20:00:00Z",
        }
        respuesta = self.client.post("/api/pedidos/pedidos/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(Pedido.objects.first().codigo_recojo, "ABC123")

    def test_codigo_recojo_unico(self):
        Pedido.objects.create(
            cliente=self.cliente,
            tienda=self.tienda,
            codigo_recojo="ABC123",
            medio_pago="efectivo",
            total="11.00",
            vence_en="2026-11-03T20:00:00Z",
        )
        datos = {
            "cliente": self.cliente.id,
            "tienda": self.tienda.id,
            "codigo_recojo": "ABC123",
            "medio_pago": "tarjeta",
            "total": "15.00",
            "vence_en": "2026-11-03T20:00:00Z",
        }
        respuesta = self.client.post("/api/pedidos/pedidos/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
