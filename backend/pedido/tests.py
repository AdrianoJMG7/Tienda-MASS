from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from inventario.models import MovimientoStock, Stock
from producto.models import Oferta, Producto
from tienda.models import Tienda
from usuarios.models import Rol
from venta.models import Venta
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


class BaseAtencion(BasePedidos):
    url = reverse("pedido-list")

    def stock(self, producto, tienda=None):
        return Stock.objects.get(tienda=tienda or self.tienda, producto=producto)

    def pedido_de(self, items, cliente=None):
        """Crea un pedido por la API, como lo haría el cliente desde la web, y devuelve su id y código."""
        self.client.force_authenticate(user=cliente or self.cliente)
        respuesta = self.client.post(
            self.url, {"tienda": self.tienda.id, "medio_pago": "efectivo", "items": items}, format="json"
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        datos = respuesta.json()
        self.client.force_authenticate(user=self.vendedor)
        return datos["id"], datos["codigo_recojo"]

    def accion(self, pedido_id, nombre, datos=None):
        return self.client.post(reverse(f"pedido-{nombre}", args=[pedido_id]), datos or {}, format="json")


class ReservaStockTests(BaseAtencion):
    """HU09: reservar el stock del pedido y liberarlo si se cancela o vence."""

    def test_confirmar_reserva_el_stock(self):
        self.pedido_de([{"producto": self.leche.id, "cantidad": 3}])
        stock = self.stock(self.leche)
        self.assertEqual((stock.cantidad, stock.reservado), (7, 3))
        movimiento = MovimientoStock.objects.get()
        self.assertEqual((movimiento.tipo, movimiento.cantidad), (MovimientoStock.Tipo.RESERVA, 3))

    def test_la_reserva_deja_de_estar_disponible_en_el_catalogo(self):
        self.pedido_de([{"producto": self.yogurt.id, "cantidad": 2}])
        datos = self.client.get(reverse("producto-list"), {"tienda": self.tienda.id, "q": "yogurt"}).json()
        self.assertEqual(datos["results"][0]["disponible"], 0)

    def test_dos_pedidos_no_reservan_la_misma_unidad(self):
        self.pedido_de([{"producto": self.yogurt.id, "cantidad": 2}])  # se lleva las 2 unidades
        otro = get_user_model().objects.create_user(email="otro@test.com", nombre="Otro Cliente", password="Test1234")
        self.client.force_authenticate(user=otro)
        respuesta = self.client.post(
            self.url,
            {"tienda": self.tienda.id, "medio_pago": "efectivo", "items": [{"producto": self.yogurt.id, "cantidad": 1}]},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        stock = self.stock(self.yogurt)
        self.assertEqual((stock.cantidad, stock.reservado), (0, 2))
        self.assertEqual(Pedido.objects.count(), 1)

    def test_si_un_producto_no_alcanza_no_se_reserva_nada(self):
        self.client.force_authenticate(user=self.cliente)
        items = [{"producto": self.leche.id, "cantidad": 1}, {"producto": self.yogurt.id, "cantidad": 3}]
        respuesta = self.client.post(
            self.url, {"tienda": self.tienda.id, "medio_pago": "efectivo", "items": items}, format="json"
        )
        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual([p["producto"] for p in respuesta.json()["productos"]], [self.yogurt.id])
        self.assertEqual((self.stock(self.leche).cantidad, self.stock(self.leche).reservado), (10, 0))
        self.assertFalse(Pedido.objects.exists())
        self.assertFalse(MovimientoStock.objects.exists())

    def test_cancelar_libera_la_reserva(self):
        pedido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 4}])
        self.accion(pedido_id, "cancelar", {"motivo": "Cliente avisó que no vendrá"})
        stock = self.stock(self.leche)
        self.assertEqual((stock.cantidad, stock.reservado), (10, 0))
        self.assertTrue(MovimientoStock.objects.filter(tipo=MovimientoStock.Tipo.LIBERACION, cantidad=4).exists())

    def test_pedido_vencido_se_cancela_y_libera_stock(self):
        vencido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 2}])
        a_tiempo_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        entregado_id, codigo = self.pedido_de([{"producto": self.yogurt.id, "cantidad": 1}])
        self.accion(entregado_id, "listo")
        self.accion(entregado_id, "entregar", {"codigo": codigo, "medio_pago": "efectivo"})
        hace_tres_dias = timezone.now() - timedelta(days=3)
        Pedido.objects.filter(id__in=[vencido_id, entregado_id]).update(vence_en=hace_tres_dias)

        salida = StringIO()
        call_command("liberar_reservas", stdout=salida)

        self.assertIn("1", salida.getvalue())
        vencido = Pedido.objects.get(id=vencido_id)
        self.assertEqual((vencido.estado, vencido.cancelado_por), ("cancelado", "sistema"))
        self.assertIn("48 horas", vencido.motivo_cancelacion)
        self.assertEqual(Pedido.objects.get(id=a_tiempo_id).estado, "recibido")
        self.assertEqual(Pedido.objects.get(id=entregado_id).estado, "entregado")
        stock = self.stock(self.leche)
        self.assertEqual((stock.cantidad, stock.reservado), (9, 1))


class AtencionPedidosTests(BaseAtencion):
    """HU10: el vendedor gestiona los pedidos online de su tienda."""

    def test_lista_por_estado_y_conteos_de_su_tienda(self):
        primero, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        segundo, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.accion(segundo, "preparar")

        recibidos = self.client.get(self.url, {"estado": "recibido"}).json()["results"]
        self.assertEqual([p["id"] for p in recibidos], [primero])
        conteos = self.client.get(reverse("pedido-conteos")).json()
        self.assertEqual((conteos["recibido"], conteos["en_preparacion"], conteos["listo"]), (1, 1, 0))

    def test_flujo_completo_hasta_la_entrega(self):
        pedido_id, codigo = self.pedido_de(
            [{"producto": self.leche.id, "cantidad": 2}, {"producto": self.yogurt.id, "cantidad": 1}]
        )
        self.assertEqual(self.accion(pedido_id, "preparar").json()["estado"], "en_preparacion")

        with self.captureOnCommitCallbacks(execute=True):
            listo = self.accion(pedido_id, "listo").json()
        self.assertEqual(listo["estado"], "listo")
        correo = mail.outbox[-1]
        self.assertEqual(correo.to, ["cliente@test.com"])
        self.assertIn("listo para recoger", correo.subject)
        self.assertIn(codigo, correo.body)

        entregado = self.accion(pedido_id, "entregar", {"codigo": codigo.lower(), "medio_pago": "tarjeta"}).json()
        self.assertEqual((entregado["estado"], entregado["pagado_con"]), ("entregado", "Tarjeta"))

        venta = Venta.objects.get(pedido_id=pedido_id)
        self.assertEqual((venta.canal, venta.medio_pago, venta.vendedor), ("web", "tarjeta", self.vendedor))
        self.assertEqual(venta.total, Decimal("17.00"))  # 2 x 5.50 + 1 x 6.00 (oferta)
        self.assertEqual(venta.detalles.count(), 2)
        leche = self.stock(self.leche)
        self.assertEqual((leche.cantidad, leche.reservado), (8, 0))  # lo reservado salió como venta

    def test_entregar_valida_el_codigo_de_recojo(self):
        pedido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.accion(pedido_id, "listo")
        respuesta = self.accion(pedido_id, "entregar", {"codigo": "ZZZZZZ", "medio_pago": "efectivo"})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("codigo", respuesta.json())
        self.assertEqual(Pedido.objects.get(id=pedido_id).estado, "listo")
        self.assertFalse(Venta.objects.exists())

    def test_entregar_exige_medio_de_pago(self):
        pedido_id, codigo = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.accion(pedido_id, "listo")
        respuesta = self.accion(pedido_id, "entregar", {"codigo": codigo})
        self.assertIn("medio_pago", respuesta.json())

    def test_solo_se_entrega_un_pedido_listo(self):
        pedido_id, codigo = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        respuesta = self.accion(pedido_id, "entregar", {"codigo": codigo, "medio_pago": "efectivo"})
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_se_repite_una_transicion(self):
        pedido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.accion(pedido_id, "preparar")
        self.assertEqual(self.accion(pedido_id, "preparar").status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancelar_exige_motivo_y_lo_guarda(self):
        pedido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.assertIn("motivo", self.accion(pedido_id, "cancelar", {"motivo": " "}).json())
        datos = self.accion(pedido_id, "cancelar", {"motivo": "Producto dañado"}).json()
        self.assertEqual((datos["estado"], datos["cancelado_por"], datos["motivo_cancelacion"]), ("cancelado", "vendedor", "Producto dañado"))
        self.assertEqual(self.accion(pedido_id, "cancelar", {"motivo": "Otra vez"}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_el_vendedor_no_ve_el_codigo_y_el_cliente_si(self):
        pedido_id, codigo = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        self.assertNotIn("codigo_recojo", self.client.get(reverse("pedido-detail", args=[pedido_id])).json())
        self.client.force_authenticate(user=self.cliente)
        self.assertEqual(self.client.get(reverse("pedido-detail", args=[pedido_id])).json()["codigo_recojo"], codigo)

    def test_solo_el_vendedor_de_la_tienda_atiende_el_pedido(self):
        pedido_id, _ = self.pedido_de([{"producto": self.leche.id, "cantidad": 1}])
        otro_vendedor = get_user_model().objects.create_user(
            email="norte@test.com", nombre="Vendedor Norte", password="Test1234", rol=Rol.VENDEDOR, tienda=self.otra_tienda
        )
        self.client.force_authenticate(user=otro_vendedor)
        self.assertEqual(self.accion(pedido_id, "preparar").status_code, status.HTTP_404_NOT_FOUND)
        for usuario in (self.cliente, self.admin):
            self.client.force_authenticate(user=usuario)
            self.assertEqual(self.accion(pedido_id, "preparar").status_code, status.HTTP_403_FORBIDDEN)
