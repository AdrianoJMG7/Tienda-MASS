from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO, StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from choices import CanalVenta, EstadoPedido, MedioPago
from pedido.models import Pedido
from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Rol
from venta.models import DetalleVenta, Venta

PANEL = "/api/reportes/panel/"
EXPORTAR = "/api/reportes/exportar/"


def momento(dia, hora=12, minutos=0):
    return timezone.make_aware(datetime.combine(dia, time(hora, minutos)))


class BaseReportes(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Usuario = get_user_model()
        cls.hoy = timezone.localdate()
        cls.norte = Tienda.objects.create(codigo="T-001", nombre="Tienda Norte", distrito="Comas", direccion="Av. 1")
        cls.sur = Tienda.objects.create(codigo="T-002", nombre="Tienda Sur", distrito="Surco", direccion="Av. 2")
        cls.admin = Usuario.objects.create_user(email="admin@test.com", nombre="Admin", password="Test1234", rol=Rol.ADMIN)
        cls.vendedor = Usuario.objects.create_user(
            email="vendedor@test.com", nombre="Vendedor", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.norte
        )
        cls.cliente = Usuario.objects.create_user(
            email="cliente@test.com", nombre="Cliente", password="Test1234", rol=Rol.CLIENTE
        )
        categoria = Categoria.objects.create(nombre="Lácteos")
        cls.leche = Producto.objects.create(nombre="Leche", marca="Gloria", codigo_barras="1", categoria=categoria, precio=Decimal("5.00"))
        cls.pan = Producto.objects.create(nombre="Pan", marca="Mass", codigo_barras="2", categoria=categoria, precio=Decimal("0.50"))

        # Norte: dos ventas en caja hoy (S/ 10 y S/ 20) y una web (S/ 30) que viene de un pedido.
        cls.vender(cls.norte, CanalVenta.CAJA, cls.hoy, [(cls.leche, 2)])
        cls.vender(cls.norte, CanalVenta.CAJA, cls.hoy, [(cls.leche, 2), (cls.pan, 20)])
        pedido = cls.pedir(cls.norte, cls.hoy, EstadoPedido.ENTREGADO, listo_en_min=20)
        cls.vender(cls.norte, CanalVenta.WEB, cls.hoy, [(cls.leche, 6)], pedido=pedido)
        cls.pedir(cls.norte, cls.hoy, EstadoPedido.LISTO, listo_en_min=40, codigo="BBBBBB")
        cls.pedir(cls.norte, cls.hoy, EstadoPedido.CANCELADO, codigo="CCCCCC")
        # Sur: una venta en caja hoy y otra hace 60 días (fuera del periodo por defecto).
        cls.vender(cls.sur, CanalVenta.CAJA, cls.hoy, [(cls.pan, 10)])
        cls.vender(cls.sur, CanalVenta.CAJA, cls.hoy - timedelta(days=60), [(cls.leche, 100)])

    @classmethod
    def vender(cls, tienda, canal, dia, items, pedido=None):
        venta = Venta.objects.create(
            tienda=tienda, vendedor=cls.vendedor, fecha=momento(dia), medio_pago=MedioPago.EFECTIVO, canal=canal,
            total=sum(p.precio * c for p, c in items), pedido=pedido,
        )
        for producto, cantidad in items:
            DetalleVenta.objects.create(venta=venta, producto=producto, cantidad=cantidad, precio_unitario=producto.precio)
        return venta

    @classmethod
    def pedir(cls, tienda, dia, estado, listo_en_min=None, codigo="AAAAAA"):
        creado = momento(dia, 10)
        return Pedido.objects.create(
            cliente=cls.cliente, tienda=tienda, estado=estado, codigo_recojo=codigo, medio_pago=MedioPago.EFECTIVO,
            total=Decimal("30"), creado=creado, vence_en=creado + timedelta(hours=48),
            listo_en=creado + timedelta(minutes=listo_en_min) if listo_en_min else None,
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)


class PanelTests(BaseReportes):
    def test_solo_el_administrador_ve_el_panel(self):
        for usuario in (self.vendedor, self.cliente):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get(PANEL).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.get(EXPORTAR, {"formato": "pdf"}).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(PANEL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_resumen_de_los_ultimos_30_dias(self):
        datos = self.client.get(PANEL).json()
        self.assertEqual(datos["filtros"]["hasta"], self.hoy.isoformat())
        self.assertEqual(datos["filtros"]["desde"], (self.hoy - timedelta(days=29)).isoformat())
        self.assertEqual(len(datos["por_dia"]), 30)
        resumen = datos["resumen"]
        self.assertEqual(resumen["ventas"], 4)  # la venta de hace 60 días queda fuera
        self.assertEqual(resumen["total"], 65.0)  # 10 + 20 + 30 + 5
        self.assertEqual(resumen["ticket_promedio"], 16.25)
        self.assertEqual(resumen["pedidos"], 3)
        self.assertEqual(resumen["pedidos_entregados"], 1)
        self.assertEqual(resumen["pedidos_cancelados"], 1)
        self.assertEqual(resumen["minutos_preparacion"], 30.0)  # promedio de 20 y 40

    def test_ventas_por_canal_y_por_tienda(self):
        datos = self.client.get(PANEL).json()
        canales = {c["canal"]: c for c in datos["por_canal"]}
        self.assertEqual((canales["caja"]["ventas"], canales["caja"]["total"]), (3, 35.0))
        self.assertEqual(canales["caja"]["ticket_promedio"], 11.67)
        self.assertEqual((canales["web"]["ventas"], canales["web"]["total"]), (1, 30.0))

        norte, sur = datos["por_tienda"]  # ordenadas de mayor a menor venta
        self.assertEqual(norte["codigo"], "T-001")
        self.assertEqual((norte["caja"], norte["web"], norte["total"]), (30.0, 30.0, 60.0))
        self.assertEqual((norte["ticket_promedio"], norte["pedidos"], norte["minutos_preparacion"]), (20.0, 3, 30.0))
        self.assertEqual((sur["total"], sur["pedidos"], sur["minutos_preparacion"]), (5.0, 0, None))

    def test_pedidos_por_estado_y_productos_mas_vendidos(self):
        datos = self.client.get(PANEL).json()
        self.assertEqual(
            [(e["estado"], e["pedidos"]) for e in datos["por_estado"]],
            [("recibido", 0), ("en_preparacion", 0), ("listo", 1), ("entregado", 1), ("cancelado", 1)],
        )
        top = datos["top_productos"]
        self.assertEqual([(p["nombre"], p["unidades"], p["total"]) for p in top], [("Pan", 30, 15.0), ("Leche", 10, 50.0)])

    def test_filtros_por_tienda_y_periodo(self):
        datos = self.client.get(PANEL, {"tienda": self.sur.id}).json()
        self.assertEqual([t["codigo"] for t in datos["por_tienda"]], ["T-002"])
        self.assertEqual((datos["resumen"]["ventas"], datos["resumen"]["pedidos"]), (1, 0))
        self.assertIn("Tienda Sur", datos["filtros"]["descripcion"])

        hace_60 = (self.hoy - timedelta(days=60)).isoformat()
        datos = self.client.get(PANEL, {"desde": hace_60, "hasta": hace_60}).json()
        self.assertEqual((datos["resumen"]["ventas"], datos["resumen"]["total"]), (1, 500.0))
        self.assertEqual(len(datos["por_dia"]), 1)

    def test_filtros_invalidos(self):
        hoy = self.hoy.isoformat()
        ayer = (self.hoy - timedelta(days=1)).isoformat()
        self.assertEqual(self.client.get(PANEL, {"desde": hoy, "hasta": ayer}).status_code, status.HTTP_400_BAD_REQUEST)
        hace_400 = (self.hoy - timedelta(days=400)).isoformat()
        self.assertEqual(self.client.get(PANEL, {"desde": hace_400}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(PANEL, {"tienda": 999}).status_code, status.HTTP_400_BAD_REQUEST)


class ExportarTests(BaseReportes):
    def test_excel_respeta_los_filtros(self):
        respuesta = self.client.get(EXPORTAR, {"formato": "xlsx", "tienda": self.norte.id})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", respuesta["Content-Type"])
        self.assertIn("-T-001.xlsx", respuesta["Content-Disposition"])

        libro = load_workbook(BytesIO(respuesta.content))
        self.assertIn("Ventas por tienda", libro.sheetnames)
        resumen = libro["Resumen"]
        self.assertIn("Tienda Norte", resumen["A2"].value)
        self.assertEqual(resumen["B5"].value, Decimal("60.00"))  # solo las ventas de la tienda filtrada
        tiendas = [fila[0] for fila in libro["Ventas por tienda"].iter_rows(min_row=5, values_only=True)]
        self.assertEqual(tiendas, ["T-001"])

    def test_pdf(self):
        respuesta = self.client.get(EXPORTAR, {"formato": "pdf"})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta["Content-Type"], "application/pdf")
        self.assertTrue(respuesta.content.startswith(b"%PDF"))
        self.assertIn("attachment;", respuesta["Content-Disposition"])

    def test_formato_obligatorio(self):
        self.assertEqual(self.client.get(EXPORTAR).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(EXPORTAR, {"formato": "csv"}).status_code, status.HTTP_400_BAD_REQUEST)


class SimularVentasTests(APITestCase):
    def test_simula_y_se_puede_repetir(self):
        call_command("cargar_demo", stdout=StringIO())
        call_command("simular_ventas", dias=3, stdout=StringIO())
        primera = (Venta.objects.count(), Pedido.objects.count())
        call_command("simular_ventas", dias=3, stdout=StringIO())
        self.assertEqual((Venta.objects.count(), Pedido.objects.count()), primera)
        simulados = Pedido.objects.filter(cliente__email="simulado@mass.test")
        self.assertTrue(simulados.exists())
        self.assertFalse(simulados.exclude(estado__in=[EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]).exists())
        entregados = simulados.filter(estado=EstadoPedido.ENTREGADO)
        self.assertEqual(Venta.objects.filter(pedido__in=entregados).count(), entregados.count())
