from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Rol
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
            categoria=Categoria.objects.create(nombre="Lácteos"),
            precio="5.50",
        )
        self.admin = get_user_model().objects.create_user(
            email="admin@test.com",
            nombre="Admin Test",
            password="Test1234",
            rol=Rol.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

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


class InventarioTests(APITestCase):
    """Pruebas para HU14 y HU15: inventario, alertas, ingresos y mermas."""

    def setUp(self):
        self.tienda = Tienda.objects.create(
            codigo="T-001",
            nombre="Tienda Central",
            distrito="Miraflores",
            direccion="Av. Principal 123",
        )
        self.categoria = Categoria.objects.create(nombre="Lácteos")
        self.producto1 = Producto.objects.create(
            nombre="Leche Entera",
            marca="Gloria",
            codigo_barras="1234567890123",
            categoria=self.categoria,
            precio="5.50",
        )
        self.producto2 = Producto.objects.create(
            nombre="Arroz",
            marca="Costeño",
            codigo_barras="9876543210987",
            categoria=Categoria.objects.create(nombre="Despensa"),
            precio="4.00",
        )
        self.vendedor = get_user_model().objects.create_user(
            email="vendedor@test.com",
            nombre="Vendedor Test",
            password="Test1234",
            rol=Rol.VENDEDOR,
            tienda=self.tienda,
        )
        self.admin = get_user_model().objects.create_user(
            email="admin@test.com",
            nombre="Admin Test",
            password="Test1234",
            rol=Rol.ADMIN,
        )

    def test_alertas_stock_bajo(self):
        """HU14: alertas de productos bajo stock mínimo."""
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=5,
            stock_minimo=10,
        )
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto2,
            cantidad=20,
            stock_minimo=10,
        )

        self.client.force_authenticate(user=self.vendedor)
        respuesta = self.client.get("/api/inventario/inventario/alertas/")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(respuesta.data["bajo_stock"]), 1)
        self.assertEqual(respuesta.data["bajo_stock"][0]["producto"], self.producto1.id)
        self.assertEqual(respuesta.data["resumen"]["bajo_stock_count"], 1)

    def test_alertas_vencimiento(self):
        """HU14: alertas de productos por vencer en 7 días."""
        hoy = timezone.now().date()
        en_5_dias = hoy + timedelta(days=5)
        en_10_dias = hoy + timedelta(days=10)

        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=20,
            fecha_vencimiento=en_5_dias,
        )
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto2,
            cantidad=20,
            fecha_vencimiento=en_10_dias,
        )

        self.client.force_authenticate(user=self.vendedor)
        respuesta = self.client.get("/api/inventario/inventario/alertas/")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(respuesta.data["por_vencer"]), 1)
        self.assertEqual(respuesta.data["por_vencer"][0]["producto"], self.producto1.id)
        self.assertEqual(respuesta.data["resumen"]["por_vencer_count"], 1)

    def test_listar_inventario_vendedor(self):
        """HU14: vendedor ve solo su tienda."""
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=50,
            stock_minimo=10,
        )

        self.client.force_authenticate(user=self.vendedor)
        respuesta = self.client.get("/api/inventario/inventario/")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(respuesta.data), 1)

    def test_listar_inventario_filtro_estado(self):
        """HU14: filtrar inventario por estado (bajo_stock, por_vencer)."""
        hoy = timezone.now().date()
        en_5_dias = hoy + timedelta(days=5)

        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=5,
            stock_minimo=10,
        )
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto2,
            cantidad=20,
            fecha_vencimiento=en_5_dias,
        )

        self.client.force_authenticate(user=self.vendedor)

        respuesta = self.client.get("/api/inventario/inventario/?estado=bajo_stock")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(respuesta.data), 1)

        respuesta = self.client.get("/api/inventario/inventario/?estado=por_vencer")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(respuesta.data), 1)

    def test_registrar_ingreso(self):
        """HU15: registrar ingreso de mercadería."""
        self.client.force_authenticate(user=self.vendedor)
        datos = [
            {"producto": self.producto1.id, "cantidad": 10, "motivo": "Reposición"},
        ]
        respuesta = self.client.post("/api/inventario/inventario/ingreso/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(tienda=self.tienda, producto=self.producto1)
        self.assertEqual(stock.cantidad, 10)

    def test_registrar_ingreso_con_vencimiento(self):
        """HU15: registrar ingreso con fecha de vencimiento."""
        self.client.force_authenticate(user=self.vendedor)
        fecha_vencimiento = date(2026, 12, 31)
        datos = [
            {
                "producto": self.producto1.id,
                "cantidad": 10,
                "fecha_vencimiento": fecha_vencimiento,
            },
        ]
        respuesta = self.client.post("/api/inventario/inventario/ingreso/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(tienda=self.tienda, producto=self.producto1)
        self.assertEqual(stock.cantidad, 10)
        self.assertEqual(stock.fecha_vencimiento, fecha_vencimiento)

    def test_registrar_merma(self):
        """HU15: registrar merma de mercadería."""
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=20,
        )

        self.client.force_authenticate(user=self.vendedor)
        datos = [
            {"producto": self.producto1.id, "cantidad": 5, "motivo": "vencido"},
        ]
        respuesta = self.client.post("/api/inventario/inventario/merma/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)

        stock = Stock.objects.get(tienda=self.tienda, producto=self.producto1)
        self.assertEqual(stock.cantidad, 15)

    def test_registrar_merma_sin_stock(self):
        """HU15: no se puede registrar merma si no hay stock suficiente."""
        Stock.objects.create(
            tienda=self.tienda,
            producto=self.producto1,
            cantidad=5,
        )

        self.client.force_authenticate(user=self.vendedor)
        datos = [
            {"producto": self.producto1.id, "cantidad": 10, "motivo": "dañado"},
        ]
        respuesta = self.client.post("/api/inventario/inventario/merma/", datos, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_permisos_cliente_no_puede_ver_inventario(self):
        """Cliente no tiene permiso para ver inventario."""
        cliente = get_user_model().objects.create_user(
            email="cliente@test.com",
            nombre="Cliente Test",
            password="Test1234",
            rol=Rol.CLIENTE,
        )
        self.client.force_authenticate(user=cliente)
        respuesta = self.client.get("/api/inventario/inventario/")
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
