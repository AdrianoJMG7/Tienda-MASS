from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from inventario.models import Stock
from producto.models import Oferta, Producto
from tienda.models import Tienda
from usuarios.models import Rol
from .models import Pedido
from .servicios import ALFABETO_CODIGO


class BasePedidos(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Usuario = get_user_model()
        cls.tienda = Tienda.objects.create(
            codigo="T-001", nombre="Tienda Central", distrito="Miraflores", direccion="Av. Principal 123"
        )
        cls.otra_tienda = Tienda.objects.create(codigo="T-002", nombre="Tienda Norte", distrito="Comas", direccion="Av. 2")
        cls.cliente = Usuario.objects.create_user(
            email="cliente@test.com", nombre="Cliente Test", password="Test1234", rol=Rol.CLIENTE
        )
        cls.vendedor = Usuario.objects.create_user(
            email="vendedor@test.com", nombre="Vendedor Test", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.tienda
        )
        cls.admin = Usuario.objects.create_user(
            email="admin@test.com", nombre="Admin Test", password="Test1234", rol=Rol.ADMIN
        )
        categoria = Categoria.objects.create(nombre="Lácteos")
        cls.leche = Producto.objects.create(
            nombre="Leche Entera", marca="Gloria", codigo_barras="1234567890123", categoria=categoria,
            costo=Decimal("4.00"), precio=Decimal("5.50"),
        )
        cls.yogurt = Producto.objects.create(
            nombre="Yogurt Natural", marca="Gloria", codigo_barras="1234567890124", categoria=categoria,
            costo=Decimal("5.00"), precio=Decimal("6.50"),
        )
        hoy = timezone.localdate()
        Oferta.objects.create(producto=cls.yogurt, precio_especial=Decimal("6.00"), inicio=hoy, fin=hoy + timedelta(days=5))
        Stock.objects.create(tienda=cls.tienda, producto=cls.leche, cantidad=10)
        Stock.objects.create(tienda=cls.tienda, producto=cls.yogurt, cantidad=2)
        Stock.objects.create(tienda=cls.otra_tienda, producto=cls.leche, cantidad=0)


class CatalogoPublicoTests(BasePedidos):
    """HU06: catálogo sin iniciar sesión y disponibilidad en la tienda elegida."""

    def test_disponibilidad_por_tienda_sin_sesion(self):
        datos = self.client.get(reverse("producto-list"), {"tienda": self.tienda.id}).json()
        self.assertEqual({p["nombre"]: p["disponible"] for p in datos["results"]}, {"Leche Entera": 10, "Yogurt Natural": 2})
        self.assertNotIn("costo", datos["results"][0])

    def test_sin_stock_cuenta_como_cero_y_filtro_con_stock(self):
        url = reverse("producto-list")
        datos = self.client.get(url, {"tienda": self.otra_tienda.id}).json()
        self.assertEqual({p["disponible"] for p in datos["results"]}, {0})
        self.assertEqual(self.client.get(url, {"tienda": self.otra_tienda.id, "con_stock": "1"}).json()["count"], 0)

    def test_busqueda_filtros_y_ofertas(self):
        url = reverse("producto-list")
        self.assertEqual(self.client.get(url, {"q": "yogurt"}).json()["count"], 1)
        ofertas = self.client.get(url, {"en_oferta": "1"}).json()["results"]
        self.assertEqual([(p["nombre"], p["precio_final"]) for p in ofertas], [("Yogurt Natural", 6.0)])
        self.assertEqual(self.client.get(url, {"precio_max": "5.80"}).json()["count"], 1)

    def test_solo_tiendas_activas_son_punto_de_recojo(self):
        Tienda.objects.filter(pk=self.otra_tienda.pk).update(activa=False)
        codigos = [t["codigo"] for t in self.client.get(reverse("tienda-list")).json()]
        self.assertEqual(codigos, ["T-001"])


class PedidoTests(BasePedidos):
    """HU07 y HU08: carrito, tienda de recojo y confirmación del pedido."""

    url = reverse("pedido-list")

    def pedir(self, items=None, tienda=None, medio_pago="yape_plin"):
        if items is None:
            items = [{"producto": self.leche.id, "cantidad": 3}, {"producto": self.yogurt.id, "cantidad": 2}]
        return self.client.post(
            self.url, {"tienda": (tienda or self.tienda).id, "medio_pago": medio_pago, "items": items}, format="json"
        )

    def test_crear_pedido(self):
        self.client.force_authenticate(user=self.cliente)
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.pedir()
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        datos = respuesta.json()

        self.assertEqual(len(datos["codigo_recojo"]), 6)
        self.assertTrue(set(datos["codigo_recojo"]) <= set(ALFABETO_CODIGO))
        self.assertEqual(datos["estado"], "recibido")
        # 3 x 5.50 + 2 x 6.00 (precio de oferta vigente) = 28.50
        self.assertEqual(datos["total"], 28.5)
        self.assertEqual(datos["tienda"]["codigo"], "T-001")
        self.assertEqual(datos["medio_pago_display"], "Yape/Plin")
        pedido = Pedido.objects.get()
        self.assertEqual(pedido.cliente, self.cliente)
        self.assertAlmostEqual((pedido.vence_en - pedido.creado).total_seconds(), 48 * 3600)

        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ["cliente@test.com"])
        self.assertIn(datos["codigo_recojo"], correo.subject)
        self.assertIn(datos["codigo_recojo"], correo.body)
        self.assertIn("S/ 28.50", correo.body)

    def test_codigo_recojo_unico(self):
        self.client.force_authenticate(user=self.cliente)
        codigos = {self.pedir(items=[{"producto": self.leche.id, "cantidad": 1}]).json()["codigo_recojo"] for _ in range(5)}
        self.assertEqual(len(codigos), 5)

    def test_cliente_no_puede_fijar_codigo_precios_ni_dueno(self):
        self.client.force_authenticate(user=self.cliente)
        respuesta = self.client.post(
            self.url,
            {
                "tienda": self.tienda.id,
                "medio_pago": "efectivo",
                "items": [{"producto": self.leche.id, "cantidad": 1, "precio_unitario": "0.01"}],
                "codigo_recojo": "ABC123",
                "total": "0.01",
                "cliente": self.admin.id,
            },
            format="json",
        )
        datos = respuesta.json()
        self.assertEqual(datos["total"], 5.5)
        self.assertNotEqual(datos["codigo_recojo"], "ABC123")
        self.assertEqual(Pedido.objects.get().cliente, self.cliente)

    def test_productos_repetidos_se_suman(self):
        self.client.force_authenticate(user=self.cliente)
        items = [{"producto": self.leche.id, "cantidad": 1}, {"producto": self.leche.id, "cantidad": 2}]
        detalles = self.pedir(items=items).json()["detalles"]
        self.assertEqual([(d["producto"], d["cantidad"]) for d in detalles], [(self.leche.id, 3)])

    def test_avisa_stock_insuficiente_por_producto(self):
        self.client.force_authenticate(user=self.cliente)
        respuesta = self.pedir(items=[{"producto": self.yogurt.id, "cantidad": 5}])
        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        faltante = respuesta.json()["productos"][0]
        self.assertEqual((faltante["producto"], faltante["disponible"], faltante["solicitado"]), (self.yogurt.id, 2, 5))
        self.assertFalse(Pedido.objects.exists())

    def test_solo_tiendas_activas(self):
        Tienda.objects.filter(pk=self.tienda.pk).update(activa=False)
        self.client.force_authenticate(user=self.cliente)
        respuesta = self.pedir()
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tienda", respuesta.json())

    def test_validaciones_de_entrada(self):
        self.client.force_authenticate(user=self.cliente)
        self.assertIn("items", self.pedir(items=[]).json())
        self.assertIn("medio_pago", self.pedir(medio_pago="bitcoin").json())
        self.assertIn("items", self.pedir(items=[{"producto": self.leche.id, "cantidad": 0}]).json())

    def test_solo_clientes_con_sesion_confirman(self):
        self.assertEqual(self.pedir().status_code, status.HTTP_401_UNAUTHORIZED)
        for usuario in (self.vendedor, self.admin):
            self.client.force_authenticate(user=usuario)
            self.assertEqual(self.pedir().status_code, status.HTTP_403_FORBIDDEN)

    def test_cada_cliente_ve_solo_sus_pedidos(self):
        self.client.force_authenticate(user=self.cliente)
        pedido_id = self.pedir().json()["id"]
        otro = get_user_model().objects.create_user(email="otro@test.com", nombre="Otro Cliente", password="Test1234")
        self.client.force_authenticate(user=otro)
        self.assertEqual(self.client.get(reverse("pedido-detail", args=[pedido_id])).status_code, 404)
        self.assertEqual(self.client.get(self.url).json()["count"], 0)

        self.client.force_authenticate(user=self.vendedor)  # el pedido es de su tienda
        self.assertEqual(self.client.get(self.url).json()["count"], 1)
