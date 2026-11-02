from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Tienda


class TiendaTests(APITestCase):
    """Pruebas para la gestión de tiendas."""

    def test_crear_tienda(self):
        datos = {
            "codigo": "T-001",
            "nombre": "Tienda Central",
            "distrito": "Miraflores",
            "direccion": "Av. Principal 123",
            "horario": "Lun a Dom de 8:00 a 21:00",
            "activa": True,
        }
        respuesta = self.client.post("/api/tiendas/tiendas/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Tienda.objects.count(), 1)
        self.assertEqual(Tienda.objects.first().codigo, "T-001")

    def test_codigo_tienda_unico(self):
        Tienda.objects.create(
            codigo="T-001",
            nombre="Tienda 1",
            distrito="Miraflores",
            direccion="Av. 1",
        )
        datos = {
            "codigo": "T-001",
            "nombre": "Tienda 2",
            "distrito": "San Isidro",
            "direccion": "Av. 2",
        }
        respuesta = self.client.post("/api/tiendas/tiendas/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
