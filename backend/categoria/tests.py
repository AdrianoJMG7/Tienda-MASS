from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from usuarios.models import Rol
from .models import Categoria


class CategoriaTests(APITestCase):
    """Pruebas para la gestión de categorías."""

    def setUp(self):
        self.admin = get_user_model().objects.create_user(
            email="admin@test.com",
            nombre="Admin Test",
            password="Test1234",
            rol=Rol.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_crear_categoria(self):
        datos = {"nombre": "Lácteos"}
        respuesta = self.client.post("/api/categorias/categorias/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Categoria.objects.count(), 1)
        self.assertEqual(Categoria.objects.first().nombre, "Lácteos")

    def test_nombre_categoria_unico(self):
        Categoria.objects.create(nombre="Lácteos")
        datos = {"nombre": "Lácteos"}
        respuesta = self.client.post("/api/categorias/categorias/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
