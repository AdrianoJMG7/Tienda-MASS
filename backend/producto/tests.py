from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from usuarios.models import Rol
from .models import Producto


class ProductoTests(APITestCase):
    """Pruebas para la gestión de productos."""

    def setUp(self):
        self.categoria = Categoria.objects.create(nombre="Lácteos")
        self.admin = get_user_model().objects.create_user(
            email="admin@test.com",
            nombre="Admin Test",
            password="Test1234",
            rol=Rol.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_crear_producto(self):
        datos = {
            "nombre": "Leche Entera",
            "marca": "Gloria",
            "codigo_barras": "1234567890123",
            "categoria": self.categoria.id,
            "precio": "5.50",
            "activo": True,
        }
        respuesta = self.client.post("/api/productos/productos/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Producto.objects.count(), 1)
        self.assertEqual(Producto.objects.first().nombre, "Leche Entera")

    def test_codigo_barras_unico(self):
        Producto.objects.create(
            nombre="Leche 1",
            marca="Gloria",
            codigo_barras="1234567890123",
            categoria=self.categoria,
            precio="5.50",
        )
        datos = {
            "nombre": "Leche 2",
            "marca": "Gloria",
            "codigo_barras": "1234567890123",
            "categoria": self.categoria.id,
            "precio": "6.00",
        }
        respuesta = self.client.post("/api/productos/productos/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
