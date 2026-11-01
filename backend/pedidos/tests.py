from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core import mail
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from catalogo.models import Categoria, Oferta, Producto
from cuentas.models import Usuario
from inventario.models import StockTienda
from tiendas.models import Tienda

from .models import Pedido
from .servicios import ALFABETO_CODIGO


class BasePedidos(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_demo", "--sin-catalogo", stdout=StringIO())
        cls.cliente = Usuario.objects.get(email="rocio@correo.pe")
        cls.vendedor = Usuario.objects.get(email="luis@mass.test")
        cls.admin = Usuario.objects.get(email="admin@mass.test")
        cls.t003 = Tienda.objects.get(codigo="T-003")
        cls.t001 = Tienda.objects.get(codigo="T-001")
        categoria = Categoria.objects.create(nombre="Abarrotes")
        cls.arroz = Producto.objects.create(
            nombre="Arroz extra 1 kg", marca="Valle Sur", codigo_barras="2000000000017",
            categoria=categoria, costo=Decimal("3.00"), precio=Decimal("4.20"),
        )
        cls.aceite = Producto.objects.create(
            nombre="Aceite vegetal 1 L", marca="Granero", codigo_barras="2000000000024",
            categoria=categoria, costo=Decimal("7.00"), precio=Decimal("9.60"),
        )
        hoy = timezone.localdate()
        Oferta.objects.create(producto=cls.aceite, precio_especial=Decimal("8.50"), inicio=hoy, fin=hoy + timedelta(days=5))
        StockTienda.objects.create(tienda=cls.t003, producto=cls.arroz, disponible=10)
        StockTienda.objects.create(tienda=cls.t003, producto=cls.aceite, disponible=2)
        StockTienda.objects.create(tienda=cls.t001, producto=cls.arroz, disponible=0)


class CatalogoPublicoTests(BasePedidos):
    """HU06: ver catálogo y disponibilidad en la tienda elegida."""

    def test_catalogo_sin_sesion_con_disponibilidad_por_tienda(self):
        datos = self.client.get(reverse("producto-list"), {"tienda": self.t003.id}).json()
        disponibles = {p["nombre"]: p["disponible"] for p in datos["results"]}
        self.assertEqual(disponibles, {"Aceite vegetal 1 L": 2, "Arroz extra 1 kg": 10})
        self.assertNotIn("costo", datos["results"][0])

    def test_sin_registro_de_stock_cuenta_como_cero_y_filtro_con_stock(self):
        datos = self.client.get(reverse("producto-list"), {"tienda": self.t001.id}).json()
        self.assertEqual({p["disponible"] for p in datos["results"]}, {0})
        con_stock = self.client.get(reverse("producto-list"), {"tienda": self.t001.id, "con_stock": "1"}).json()
        self.assertEqual(con_stock["count"], 0)

    def test_filtros_busqueda_y_ofertas(self):
        url = reverse("producto-list")
        self.assertEqual(self.client.get(url, {"q": "arroz"}).json()["count"], 1)
        ofertas = self.client.get(url, {"en_oferta": "1"}).json()["results"]
        self.assertEqual([(p["nombre"], p["precio_final"]) for p in ofertas], [("Aceite vegetal 1 L", 8.5)])
        self.assertEqual(self.client.get(url, {"precio_max": "5"}).json()["count"], 1)

    def test_ids_para_refrescar_el_carrito(self):
        datos = self.client.get(reverse("producto-list"), {"ids": f"{self.arroz.id},x,{self.aceite.id}"}).json()
        self.assertEqual(datos["count"], 2)


class PedidoTests(BasePedidos):
    """HU07 y HU08: carrito, tienda de recojo y confirmación del pedido."""

    url = reverse("pedido-list")

    def pedir(self, items=None, tienda=None, medio_pago="yape_plin"):
        items = items if items is not None else [{"producto": self.arroz.id, "cantidad": 3}, {"producto": self.aceite.id, "cantidad": 2}]
        return self.client.post(
            self.url, {"tienda": (tienda or self.t003).id, "medio_pago": medio_pago, "items": items}, format="json"
        )

    def test_confirma_pedido_con_codigo_total_y_correo(self):
        self.client.force_authenticate(self.cliente)
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.pedir()
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        datos = respuesta.json()

        self.assertEqual(len(datos["codigo_recojo"]), 6)
        self.assertTrue(set(datos["codigo_recojo"]) <= set(ALFABETO_CODIGO))
        self.assertEqual(datos["estado"], "recibido")
        # 3 x 4.20 + 2 x 8.50 (precio de oferta vigente) = 29.60
        self.assertEqual(datos["total"], 29.6)
        self.assertEqual(datos["tienda"]["codigo"], "T-003")
        self.assertEqual(datos["medio_pago_display"], "Yape/Plin")

        pedido = Pedido.objects.get()
        self.assertAlmostEqual((pedido.vence_en - pedido.creado).total_seconds(), 48 * 3600)

        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ["rocio@correo.pe"])
        self.assertIn(datos["codigo_recojo"], correo.subject)
        self.assertIn(datos["codigo_recojo"], correo.body)
        self.assertIn("Av. Carlos Izaguirre 715", correo.body)
        self.assertIn("S/ 29.60", correo.body)

    def test_los_precios_los_fija_el_servidor(self):
        self.client.force_authenticate(self.cliente)
        respuesta = self.pedir(items=[{"producto": self.arroz.id, "cantidad": 1, "precio_unitario": "0.01"}])
        self.assertEqual(respuesta.json()["total"], 4.2)

    def test_productos_repetidos_se_suman(self):
        self.client.force_authenticate(self.cliente)
        items = [{"producto": self.arroz.id, "cantidad": 1}, {"producto": self.arroz.id, "cantidad": 2}]
        detalles = self.pedir(items=items).json()["detalles"]
        self.assertEqual([(d["producto"], d["cantidad"]) for d in detalles], [(self.arroz.id, 3)])

    def test_avisa_stock_insuficiente_por_producto(self):
        self.client.force_authenticate(self.cliente)
        respuesta = self.pedir(items=[{"producto": self.aceite.id, "cantidad": 5}])
        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        faltante = respuesta.json()["productos"][0]
        self.assertEqual((faltante["producto"], faltante["disponible"], faltante["solicitado"]), (self.aceite.id, 2, 5))
        self.assertFalse(Pedido.objects.exists())

    def test_solo_tiendas_activas(self):
        Tienda.objects.filter(pk=self.t003.pk).update(activa=False)
        self.client.force_authenticate(self.cliente)
        respuesta = self.pedir()
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tienda", respuesta.json())

    def test_producto_desactivado_no_se_puede_pedir(self):
        Producto.objects.filter(pk=self.arroz.pk).update(activo=False)
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.pedir().status_code, status.HTTP_400_BAD_REQUEST)

    def test_validaciones_de_entrada(self):
        self.client.force_authenticate(self.cliente)
        self.assertIn("items", self.pedir(items=[]).json())
        self.assertIn("medio_pago", self.pedir(medio_pago="bitcoin").json())
        self.assertIn("items", self.pedir(items=[{"producto": self.arroz.id, "cantidad": 0}]).json())

    def test_solo_clientes_con_sesion_confirman(self):
        self.assertEqual(self.pedir().status_code, status.HTTP_401_UNAUTHORIZED)
        for usuario in (self.vendedor, self.admin):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.pedir().status_code, status.HTTP_403_FORBIDDEN)

    def test_cada_cliente_ve_solo_sus_pedidos(self):
        self.client.force_authenticate(self.cliente)
        pedido_id = self.pedir().json()["id"]
        otro = Usuario.objects.create_user(email="otro@correo.pe", password="ClaveSegura2026", nombre="Otro Cliente")
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get(reverse("pedido-detail", args=[pedido_id])).status_code, 404)
        self.assertEqual(self.client.get(self.url).json()["count"], 0)

        self.client.force_authenticate(self.vendedor)  # el pedido es de su tienda (T-003)
        self.assertEqual(self.client.get(self.url).json()["count"], 1)
