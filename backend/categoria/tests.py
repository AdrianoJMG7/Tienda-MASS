from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Categoria


class CategoriaTests(APITestCase):
    """Pruebas para la gestión de categorías."""

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
