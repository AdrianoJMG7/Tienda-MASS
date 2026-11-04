"""Pruebas de las pantallas del administrador: vendedores, tiendas, categorías, catálogo y reportes."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from inventario.models import Stock
from pedido.models import Pedido
from producto.models import Oferta, Producto
from tienda.models import Tienda
from venta.models import DetalleVenta, Venta

from .models import Rol

VENDEDORES = "/api/auth/usuarios/"
PRODUCTOS = "/api/productos/productos/"
CATEGORIAS = "/api/categorias/categorias/"
TIENDAS = "/api/tiendas/tiendas/"


class BaseAdmin(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Usuario = get_user_model()
        cls.norte = Tienda.objects.create(codigo="T-001", nombre="Norte", distrito="Comas", direccion="Av. 1")
        cls.sur = Tienda.objects.create(codigo="T-002", nombre="Sur", distrito="Surco", direccion="Av. 2")
        cls.cerrada = Tienda.objects.create(codigo="T-003", nombre="Cerrada", distrito="Lima", direccion="Av. 3", activa=False)
        cls.admin = Usuario.objects.create_user(email="admin@test.com", nombre="Admin", password="Test1234", rol=Rol.ADMIN)
        cls.vendedor = Usuario.objects.create_user(
            email="v@test.com", nombre="Ana Norte", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.norte, celular="987654321"
        )
        cls.cliente = Usuario.objects.create_user(email="c@test.com", nombre="Cliente Uno", password="Test1234", rol=Rol.CLIENTE)
        cls.lacteos = Categoria.objects.create(nombre="Lácteos")
        cls.snacks = Categoria.objects.create(nombre="Snacks")
        cls.leche = Producto.objects.create(
            nombre="Leche", marca="Gloria", codigo_barras="10000001", categoria=cls.lacteos, precio=Decimal("5.00")
        )
        cls.papas = Producto.objects.create(
            nombre="Papas", marca="Lays", codigo_barras="10000002", categoria=cls.snacks, precio=Decimal("3.00")
        )
        Stock.objects.create(tienda=cls.norte, producto=cls.leche, cantidad=10)
        Stock.objects.create(tienda=cls.sur, producto=cls.leche, cantidad=5)

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def nuevo(self, **cambios):
        return {"nombre": "José Pérez", "email": "Jose@Mass.pe", "celular": "912345678", "tienda": self.sur.id, **cambios}


class VendedoresTests(BaseAdmin):
    def test_crea_con_contrasena_generada_y_puede_ingresar(self):
        respuesta = self.client.post(VENDEDORES, self.nuevo(), format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        datos = respuesta.json()
        self.assertEqual((datos["email"], datos["tienda_codigo"]), ("jose@mass.pe", "T-002"))
        temporal = datos["password_temporal"]
        self.assertNotIn("password", datos)

        creado = get_user_model().objects.get(email="jose@mass.pe")
        self.assertEqual(creado.rol, Rol.VENDEDOR)
        self.assertFalse(creado.is_staff)
        self.client.force_authenticate(None)
        ingreso = self.client.post("/api/auth/login/", {"email": "jose@mass.pe", "password": temporal})
        self.assertEqual(ingreso.status_code, status.HTTP_200_OK)
        # La contraseña temporal no se vuelve a mostrar.
        self.client.force_authenticate(self.admin)
        self.assertNotIn("password_temporal", self.client.get(f"{VENDEDORES}{creado.id}/").json())

    def test_crea_con_contrasena_elegida(self):
        datos = self.client.post(VENDEDORES, self.nuevo(password="OtraClave9876"), format="json").json()
        self.assertNotIn("password_temporal", datos)
        self.assertTrue(get_user_model().objects.get(pk=datos["id"]).check_password("OtraClave9876"))

    def test_valida_los_datos(self):
        casos = {
            "email": "v@test.com",
            "celular": "123",
            "tienda": self.cerrada.id,
            "password": "123",
            "nombre": "A",
        }
        for campo, valor in casos.items():
            with self.subTest(campo=campo):
                respuesta = self.client.post(VENDEDORES, self.nuevo(**{campo: valor}), format="json")
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, respuesta.data)
        self.assertEqual(self.client.post(VENDEDORES, {"nombre": "Sin Tienda", "email": "x@y.pe", "celular": "912345678"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_lista_solo_vendedores_y_filtra(self):
        self.client.post(VENDEDORES, self.nuevo(), format="json")
        datos = self.client.get(VENDEDORES).json()
        self.assertEqual({v["nombre"] for v in datos["results"]}, {"Ana Norte", "José Pérez"})  # sin admin ni clientes
        self.assertEqual(self.client.get(VENDEDORES, {"tienda": self.norte.id}).json()["count"], 1)
        self.assertEqual(self.client.get(VENDEDORES, {"q": "jose"}).json()["count"], 1)

    def test_desactivar_no_borra_y_bloquea_el_ingreso(self):
        self.assertEqual(self.client.delete(f"{VENDEDORES}{self.vendedor.id}/").status_code, status.HTTP_204_NO_CONTENT)
        self.vendedor.refresh_from_db()
        self.assertFalse(self.vendedor.is_active)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.post("/api/auth/login/", {"email": "v@test.com", "password": "Test1234"}).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.client.force_authenticate(self.admin)
        respuesta = self.client.patch(f"{VENDEDORES}{self.vendedor.id}/", {"is_active": True}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        self.vendedor.refresh_from_db()
        self.assertTrue(self.vendedor.is_active)

    def test_no_se_pueden_tocar_otras_cuentas(self):
        self.assertEqual(self.client.delete(f"{VENDEDORES}{self.cliente.id}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(f"{VENDEDORES}{self.admin.id}/", {"nombre": "Hack"}, format="json").status_code, status.HTTP_404_NOT_FOUND)

    def test_solo_el_administrador(self):
        for usuario in (self.vendedor, self.cliente):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get(VENDEDORES).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.post(VENDEDORES, self.nuevo(), format="json").status_code, status.HTTP_403_FORBIDDEN)


class TiendasAdminTests(BaseAdmin):
    def test_admin_ve_vendedores_activos_y_meta(self):
        filas = {t["codigo"]: t for t in self.client.get(TIENDAS).json()}
        self.assertEqual((filas["T-001"]["vendedores_activos"], filas["T-002"]["vendedores_activos"]), (1, 0))
        self.assertEqual(filas["T-001"]["meta_mensual"], 15000.0)

    def test_el_publico_no_ve_datos_internos(self):
        self.client.force_authenticate(None)
        fila = self.client.get(TIENDAS).json()[0]
        self.assertNotIn("meta_mensual", fila)
        self.assertNotIn("vendedores_activos", fila)


class CategoriasAdminTests(BaseAdmin):
    def test_crea_con_descripcion_y_estado(self):
        datos = self.client.post(CATEGORIAS, {"nombre": "Dulces", "descripcion": "Golosinas", "activa": False}, format="json").json()
        self.assertEqual((datos["descripcion"], datos["activa"]), ("Golosinas", False))

    def test_categoria_inactiva_oculta_sus_productos_al_publico(self):
        self.client.patch(f"{CATEGORIAS}{self.snacks.id}/", {"activa": False}, format="json")
        self.assertEqual(self.client.get(PRODUCTOS, {"estado": "todos"}).json()["count"], 2)  # el admin sigue viéndolos
        self.client.force_authenticate(None)
        self.assertEqual([p["nombre"] for p in self.client.get(PRODUCTOS).json()["results"]], ["Leche"])
        self.assertEqual([c["nombre"] for c in self.client.get(CATEGORIAS).json()], ["Lácteos"])


class CatalogoAdminTests(BaseAdmin):
    def test_stock_total_y_filtro(self):
        filas = {p["nombre"]: p for p in self.client.get(PRODUCTOS).json()["results"]}
        self.assertEqual((filas["Leche"]["stock_total"], filas["Papas"]["stock_total"]), (15, 0))
        self.assertEqual([p["nombre"] for p in self.client.get(PRODUCTOS, {"stock": "sin_stock"}).json()["results"]], ["Papas"])
        self.assertEqual([p["nombre"] for p in self.client.get(PRODUCTOS, {"stock": "con_stock"}).json()["results"]], ["Leche"])

    def test_el_publico_no_ve_stock_total(self):
        self.client.force_authenticate(None)
        self.assertNotIn("stock_total", self.client.get(PRODUCTOS).json()["results"][0])


class ReportesAdminTests(BaseAdmin):
    def vender(self, dias_atras, cantidad, producto=None):
        producto = producto or self.leche
        venta = Venta.objects.create(
            tienda=self.norte, vendedor=self.vendedor, medio_pago="tarjeta", total=producto.precio * cantidad,
            fecha=timezone.now() - timedelta(days=dias_atras),
        )
        DetalleVenta.objects.create(venta=venta, producto=producto, cantidad=cantidad, precio_unitario=producto.precio)
        return venta

    def test_variaciones_categorias_vendedores_y_clientes(self):
        self.vender(1, 4)  # S/ 20 de lácteos
        self.vender(1, 10, self.papas)  # S/ 30 de snacks
        self.vender(40, 5)  # periodo anterior: S/ 25
        ahora = timezone.now()
        for i, codigo in enumerate(("AAA111", "BBB222")):
            Pedido.objects.create(
                cliente=self.cliente, tienda=self.norte, codigo_recojo=codigo, medio_pago="efectivo",
                total=Decimal("1"), creado=ahora - timedelta(days=i), vence_en=ahora,
            )
        datos = self.client.get("/api/reportes/panel/").json()
        self.assertEqual(datos["clientes_unicos"], 1)  # dos pedidos del mismo cliente
        self.assertEqual(datos["variacion"]["total"], 100.0)  # 50 contra 25
        self.assertEqual([(c["categoria"], c["porcentaje"]) for c in datos["por_categoria"]], [("Snacks", 60), ("Lácteos", 40)])
        self.assertEqual(datos["por_vendedor"][0]["vendedor"], "Ana Norte")
        self.assertEqual(datos["por_vendedor"][0]["total"], 50.0)
        norte = next(t for t in datos["por_tienda"] if t["codigo"] == "T-001")
        self.assertEqual(norte["variacion"], 100.0)

    def test_ofertas_del_periodo(self):
        hoy = timezone.localdate()
        Oferta.objects.create(producto=self.leche, precio_especial=Decimal("4"), inicio=hoy - timedelta(days=2), fin=hoy)
        self.vender(1, 3)  # durante la oferta
        self.vender(10, 7)  # antes de la oferta: no cuenta
        oferta = self.client.get("/api/reportes/panel/").json()["ofertas"][0]
        self.assertEqual((oferta["producto"], oferta["unidades"], oferta["estado"]), ("Leche", 3, "vigente"))

    def test_exportar_incluye_lo_nuevo(self):
        self.vender(1, 2)
        for formato in ("xlsx", "pdf"):
            self.assertEqual(self.client.get("/api/reportes/exportar/", {"formato": formato}).status_code, status.HTTP_200_OK)

    def test_pdf_de_usabilidad(self):
        pruebas = [{"usuario": "Ana", "rol": "admin", "tareas": [{"tarea": "Crear tienda", "tiempo_segundos": 30, "completada": True}]}]
        respuesta = self.client.post("/api/reportes/usabilidad/", pruebas, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertTrue(respuesta.content.startswith(b"%PDF"))
        self.client.force_authenticate(self.vendedor)
        self.assertEqual(self.client.post("/api/reportes/usabilidad/", pruebas, format="json").status_code, status.HTTP_403_FORBIDDEN)
