"""Pruebas de las pantallas del vendedor: historial, devoluciones, cierre de caja, inventario, reportes y perfil."""

from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from inventario.models import MovimientoStock, Stock
from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Rol, SesionUsuario

from .models import CierreCaja, DetalleVenta, Venta

VENTAS = "/api/ventas/ventas/"
TURNO = "/api/ventas/cierres/turno/"
CIERRES = "/api/ventas/cierres/"
PANEL = "/api/inventario/inventario/panel/"
AJUSTE = "/api/inventario/inventario/ajuste/"


class BaseVendedor(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Usuario = get_user_model()
        cls.tienda = Tienda.objects.create(codigo="T-001", nombre="Norte", distrito="Comas", direccion="Av. 1")
        cls.otra = Tienda.objects.create(codigo="T-002", nombre="Sur", distrito="Surco", direccion="Av. 2")
        cls.vendedor = Usuario.objects.create_user(
            email="v@test.com", nombre="Ana Vende", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.tienda
        )
        cls.ajeno = Usuario.objects.create_user(
            email="w@test.com", nombre="Otro", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.otra
        )
        cls.cliente = Usuario.objects.create_user(email="c@test.com", nombre="Cli", password="Test1234", rol=Rol.CLIENTE)
        lacteos = Categoria.objects.create(nombre="Lácteos")
        snacks = Categoria.objects.create(nombre="Snacks")
        cls.leche = Producto.objects.create(
            nombre="Leche", marca="Gloria", codigo_barras="7750000000011", categoria=lacteos, precio=Decimal("5.00")
        )
        cls.papas = Producto.objects.create(
            nombre="Papas", marca="Lays", codigo_barras="7750000000028", categoria=snacks, precio=Decimal("3.00")
        )
        cls.stock_leche = Stock.objects.create(tienda=cls.tienda, producto=cls.leche, cantidad=20, stock_minimo=10)
        cls.stock_papas = Stock.objects.create(tienda=cls.tienda, producto=cls.papas, cantidad=4, stock_minimo=10)

    def setUp(self):
        self.client.force_authenticate(self.vendedor)

    def vender(self, cantidad=2, medio="efectivo", recibido="20.00"):
        respuesta = self.client.post(
            VENTAS + "crear/",
            {"medio_pago": medio, "monto_recibido": recibido if medio == "efectivo" else None,
             "items": [{"producto": self.leche.id, "cantidad": cantidad}]},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        return respuesta.json()


class CajaTests(BaseVendedor):
    def test_guarda_monto_recibido_y_vuelto(self):
        venta = self.vender(cantidad=2, recibido="20.00")
        self.assertEqual((venta["total"], venta["monto_recibido"], venta["vuelto"]), (10.0, 20.0, 10.0))
        # El vuelto se puede volver a consultar desde el historial.
        self.assertEqual(self.client.get(f"{VENTAS}{venta['id']}/").json()["vuelto"], 10.0)

    def test_monto_insuficiente_no_registra_la_venta(self):
        respuesta = self.client.post(
            VENTAS + "crear/",
            {"medio_pago": "efectivo", "monto_recibido": "1.00", "items": [{"producto": self.leche.id, "cantidad": 2}]},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Venta.objects.count(), 0)
        self.stock_leche.refresh_from_db()
        self.assertEqual(self.stock_leche.cantidad, 20)

    def test_una_venta_no_se_edita_ni_se_borra(self):
        venta = self.vender()
        self.assertEqual(self.client.delete(f"{VENTAS}{venta['id']}/").status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.patch(f"{VENTAS}{venta['id']}/", {"total": 1}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class HistorialTests(BaseVendedor):
    def test_filtra_por_ticket_fecha_y_tienda(self):
        venta = self.vender()
        Venta.objects.create(tienda=self.otra, vendedor=self.ajeno, total=9, medio_pago="tarjeta", numero_ticket="AJENO-1")
        datos = self.client.get(VENTAS, {"q": venta["numero_ticket"]}).json()
        self.assertEqual([v["id"] for v in datos["results"]], [venta["id"]])
        self.assertEqual(self.client.get(VENTAS, {"q": "AJENO"}).json()["count"], 0)  # otra tienda
        manana = (timezone.localdate() + timedelta(days=1)).isoformat()
        self.assertEqual(self.client.get(VENTAS, {"desde": manana}).json()["count"], 0)

    def test_resumen_y_exportar(self):
        self.vender(cantidad=2)
        datos = self.client.get(VENTAS + "resumen/").json()
        self.assertEqual((datos["hoy"], datos["semana"], datos["mes"]), (10.0, 10.0, 10.0))
        self.assertEqual(datos["meta_mensual"], 15000.0)

        respuesta = self.client.get(VENTAS + "exportar/")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        hoja = load_workbook(BytesIO(respuesta.content)).active
        self.assertEqual(hoja.max_row, 2)
        self.assertEqual(hoja["H2"].value, "Completada")

    def test_cliente_no_exporta(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get(VENTAS + "resumen/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(VENTAS + "exportar/").status_code, status.HTTP_403_FORBIDDEN)


class DevolucionTests(BaseVendedor):
    def devolver(self, venta, cantidad=1, motivo="cambio_opinion", reembolso="efectivo"):
        return self.client.post(
            f"{VENTAS}{venta['id']}/devolver/",
            {"detalle": venta["detalles"][0]["id"], "cantidad": cantidad, "motivo": motivo, "tipo_reembolso": reembolso},
            format="json",
        )

    def test_reingresa_stock_y_cambia_estado(self):
        venta = self.vender(cantidad=2)
        respuesta = self.devolver(venta)
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertEqual(respuesta.json()["estado"], "devolucion_parcial")
        self.assertEqual(respuesta.json()["detalles"][0]["disponible_devolver"], 1)
        self.stock_leche.refresh_from_db()
        self.assertEqual(self.stock_leche.cantidad, 19)  # 20 - 2 + 1
        self.assertEqual(self.devolver(venta).json()["estado"], "devuelta")

    def test_lo_danado_no_vuelve_al_stock(self):
        venta = self.vender(cantidad=2)
        self.assertEqual(self.devolver(venta, motivo="danado").status_code, status.HTTP_201_CREATED)
        self.stock_leche.refresh_from_db()
        self.assertEqual(self.stock_leche.cantidad, 18)

    def test_no_devuelve_mas_de_lo_vendido(self):
        venta = self.vender(cantidad=2)
        self.assertEqual(self.devolver(venta, cantidad=3).status_code, status.HTTP_400_BAD_REQUEST)
        self.devolver(venta, cantidad=2)
        self.assertEqual(self.devolver(venta, cantidad=1).status_code, status.HTTP_400_BAD_REQUEST)

    def test_otra_tienda_no_puede_devolver(self):
        venta = self.vender()
        self.client.force_authenticate(self.ajeno)
        self.assertEqual(self.devolver(venta).status_code, status.HTTP_404_NOT_FOUND)

    def test_filtro_por_estado(self):
        venta = self.vender(cantidad=2)
        self.vender(cantidad=1)
        self.devolver(venta)
        self.assertEqual(self.client.get(VENTAS, {"estado": "devolucion_parcial"}).json()["count"], 1)
        self.assertEqual(self.client.get(VENTAS, {"estado": "completada"}).json()["count"], 1)


class CierreTests(BaseVendedor):
    def test_turno_y_cierre(self):
        self.vender(cantidad=2)  # S/ 10 en efectivo
        self.vender(cantidad=1, medio="tarjeta")  # S/ 5 con tarjeta
        venta = self.vender(cantidad=1)  # S/ 5 en efectivo, que se devuelve
        self.client.post(
            f"{VENTAS}{venta['id']}/devolver/",
            {"detalle": venta["detalles"][0]["id"], "cantidad": 1, "motivo": "error_venta", "tipo_reembolso": "efectivo"},
            format="json",
        )
        turno = self.client.get(TURNO).json()
        self.assertEqual((turno["ventas"], turno["unidades"], turno["total"]), (3, 4, 20.0))
        self.assertEqual(turno["efectivo_esperado"], 10.0)  # 15 en efectivo menos 5 devueltos
        medios = {m["medio"]: m for m in turno["medios"]}
        self.assertEqual((medios["efectivo"]["total"], medios["efectivo"]["porcentaje"]), (15.0, 75))

        respuesta = self.client.post(CIERRES, {"efectivo_contado": "9.50", "notas": "Faltó cambio"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertEqual(respuesta.json()["diferencia"], -0.5)
        self.assertEqual(CierreCaja.objects.count(), 1)

        # Tras cerrar empieza un turno nuevo, vacío, que no se puede volver a cerrar.
        self.assertEqual(self.client.get(TURNO).json()["ventas"], 0)
        self.assertEqual(self.client.post(CIERRES, {"efectivo_contado": "0"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_solo_cuenta_lo_del_vendedor(self):
        self.vender()
        self.client.force_authenticate(self.ajeno)
        self.assertEqual(self.client.get(TURNO).json()["ventas"], 0)


class InventarioPanelTests(BaseVendedor):
    def test_panel_con_estados_y_categorias(self):
        datos = self.client.get(PANEL).json()
        self.assertEqual(datos["count"], 2)
        self.assertEqual({f["nombre"]: f["estado"] for f in datos["results"]}, {"Leche": "disponible", "Papas": "bajo_stock"})
        self.assertEqual({c["nombre"]: c["productos"] for c in datos["categorias"]}, {"Lácteos": 1, "Snacks": 1})
        self.assertEqual(self.client.get(PANEL, {"estado": "bajo_stock"}).json()["count"], 1)
        self.assertEqual(self.client.get(PANEL, {"q": "7750000000011"}).json()["results"][0]["nombre"], "Leche")

    def test_ajuste_registra_ingreso_y_merma(self):
        respuesta = self.client.post(AJUSTE, {"producto": self.leche.id, "nuevo_stock": 30, "motivo": "reposicion"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        self.assertEqual(respuesta.json()["cantidad"], 30)
        ingreso = MovimientoStock.objects.get(tipo="ingreso")
        self.assertEqual((ingreso.cantidad, ingreso.motivo, ingreso.usuario), (10, "Reposición de stock", self.vendedor))

        self.client.post(AJUSTE, {"producto": self.leche.id, "nuevo_stock": 25, "motivo": "robo"}, format="json")
        merma = MovimientoStock.objects.get(tipo="merma")
        self.assertEqual((merma.cantidad, merma.motivo), (5, "Robo"))

    def test_motivo_debe_coincidir_con_el_cambio(self):
        subir_por_robo = self.client.post(AJUSTE, {"producto": self.leche.id, "nuevo_stock": 30, "motivo": "robo"}, format="json")
        self.assertEqual(subir_por_robo.status_code, status.HTTP_400_BAD_REQUEST)
        bajar_por_reposicion = self.client.post(AJUSTE, {"producto": self.leche.id, "nuevo_stock": 1, "motivo": "reposicion"}, format="json")
        self.assertEqual(bajar_por_reposicion.status_code, status.HTTP_400_BAD_REQUEST)

    def test_consulta_por_codigo(self):
        datos = self.client.get("/api/inventario/inventario/consulta/", {"codigo": "7750000000028"}).json()
        self.assertEqual((datos["nombre"], datos["cantidad"], datos["stock_minimo"]), ("Papas", 4, 10))
        self.assertEqual(self.client.get("/api/inventario/inventario/consulta/", {"codigo": "000"}).status_code, status.HTTP_404_NOT_FOUND)

    def test_vendedor_no_escribe_stock_de_otras_tiendas(self):
        respuesta = self.client.patch(f"/api/inventario/stock/{self.stock_leche.id}/", {"cantidad": 999}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class ReporteTiendaTests(BaseVendedor):
    def test_panel_de_la_tienda(self):
        self.vender(cantidad=2)
        Venta.objects.create(tienda=self.otra, vendedor=self.ajeno, total=500, medio_pago="tarjeta")
        anterior = Venta.objects.create(
            tienda=self.tienda, vendedor=self.vendedor, total=5, medio_pago="tarjeta",
            fecha=timezone.now() - timedelta(days=8),
        )
        DetalleVenta.objects.create(venta=anterior, producto=self.leche, cantidad=1, precio_unitario=5)

        datos = self.client.get("/api/reportes/tienda/", {"dias": 7}).json()
        self.assertEqual(datos["resumen"]["ventas"], 10.0)  # no cuenta la otra tienda ni lo de hace 8 días
        self.assertEqual(datos["variacion"]["ventas"], 100)  # 10 contra 5
        self.assertEqual(len(datos["por_dia"]), 7)
        self.assertEqual(datos["top_productos"][0]["nombre"], "Leche")
        self.assertEqual(datos["top_productos"][0]["porcentaje"], 100.0)
        self.assertEqual(datos["vendedores"], [{"vendedor": "Ana Vende", "total": 10.0}])
        self.assertEqual([m["nombre"] for m in datos["metas"]], ["diaria", "semanal"])

    def test_solo_vendedores(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get("/api/reportes/tienda/").status_code, status.HTTP_403_FORBIDDEN)


class PerfilVendedorTests(BaseVendedor):
    def test_sesiones_se_registran_al_ingresar(self):
        self.client.force_authenticate(None)
        agente = "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36"
        self.client.post("/api/auth/login/", {"email": "v@test.com", "password": "Test1234"}, headers={"User-Agent": agente})
        self.assertEqual(SesionUsuario.objects.get(usuario=self.vendedor).dispositivo, "Chrome en Windows")
        self.client.post("/api/auth/login/", {"email": "v@test.com", "password": "mala"})
        self.assertEqual(SesionUsuario.objects.filter(usuario=self.vendedor).count(), 1)

        self.client.force_authenticate(self.vendedor)
        self.assertEqual(self.client.get("/api/auth/sesiones/").json()[0]["dispositivo"], "Chrome en Windows")

    def test_cambiar_password(self):
        self.client.force_authenticate(None)
        viejo = self.client.post("/api/auth/login/", {"email": "v@test.com", "password": "Test1234"}).json()
        self.client.force_authenticate(self.vendedor)
        mala = self.client.post("/api/auth/cambiar-password/", {"actual": "no", "nueva": "OtraClave9876"})
        self.assertEqual(mala.status_code, status.HTTP_400_BAD_REQUEST)
        debil = self.client.post("/api/auth/cambiar-password/", {"actual": "Test1234", "nueva": "123"})
        self.assertEqual(debil.status_code, status.HTTP_400_BAD_REQUEST)

        buena = self.client.post("/api/auth/cambiar-password/", {"actual": "Test1234", "nueva": "OtraClave9876"})
        self.assertEqual(buena.status_code, status.HTTP_200_OK, buena.data)
        self.assertIn("refresh", buena.json())
        self.vendedor.refresh_from_db()
        self.assertTrue(self.vendedor.check_password("OtraClave9876"))
        # La sesión anterior queda cerrada: su token de renovación ya no sirve.
        self.client.force_authenticate(None)
        renovar = self.client.post("/api/auth/refresh/", {"refresh": viejo["refresh"]})
        self.assertEqual(renovar.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_perfil_trae_la_tienda(self):
        datos = self.client.get("/api/auth/yo/").json()
        self.assertEqual(datos["tienda_info"]["codigo"], "T-001")
        self.assertEqual(datos["rol_display"], "Vendedor")
        self.assertNotIn("meta_mensual", datos["tienda_info"])
