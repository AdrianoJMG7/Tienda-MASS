"""Pruebas de las pantallas del cliente: Mi cuenta, favoritos, búsqueda con facetas y Mis pedidos."""

from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from categoria.models import Categoria
from choices import EstadoPedido, MedioPago
from pedido.models import Pedido
from tienda.models import Tienda
from usuarios.models import Rol

from .models import Favorito, Oferta, Producto

YO = "/api/auth/yo/"
PRODUCTOS = "/api/productos/productos/"
FAVORITOS = "/api/productos/favoritos/"


def png():
    archivo = BytesIO()
    Image.new("RGB", (4, 4), "blue").save(archivo, "PNG")
    return SimpleUploadedFile("foto.png", archivo.getvalue(), content_type="image/png")


class BaseCliente(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Usuario = get_user_model()
        cls.tienda = Tienda.objects.create(codigo="T-001", nombre="Tienda Norte", distrito="Comas", direccion="Av. 1")
        cls.cerrada = Tienda.objects.create(
            codigo="T-009", nombre="Tienda Cerrada", distrito="Lima", direccion="Av. 9", activa=False
        )
        cls.cliente = Usuario.objects.create_user(
            email="cliente@test.com", nombre="Ana Pérez", password="Test1234", rol=Rol.CLIENTE
        )
        cls.vendedor = Usuario.objects.create_user(
            email="vendedor@test.com", nombre="Vendedor", password="Test1234", rol=Rol.VENDEDOR, tienda=cls.tienda
        )
        lacteos = Categoria.objects.create(nombre="Lácteos")
        bebidas = Categoria.objects.create(nombre="Bebidas")
        crear = Producto.objects.create
        cls.leche = crear(nombre="Leche Entera", marca="Gloria", codigo_barras="10000001", categoria=lacteos, precio=Decimal("4.50"))
        cls.evaporada = crear(nombre="Leche Evaporada", marca="Gloria", codigo_barras="10000002", categoria=lacteos, precio=Decimal("6.00"))
        cls.cafe = crear(nombre="Café con leche", marca="Nescafé", codigo_barras="10000003", categoria=bebidas, precio=Decimal("12.00"))
        cls.yogur = crear(nombre="Yogur", marca="Laive", codigo_barras="10000004", categoria=lacteos, precio=Decimal("8.00"))
        cls.retirado = crear(
            nombre="Leche antigua", marca="Gloria", codigo_barras="10000005", categoria=lacteos, precio=Decimal("3"), activo=False
        )
        cls.lacteos, cls.bebidas = lacteos, bebidas


class PerfilTests(BaseCliente):
    def setUp(self):
        self.client.force_authenticate(self.cliente)

    def test_actualiza_datos_y_preferencias(self):
        respuesta = self.client.patch(
            YO,
            {
                "nombre": "Ana María Pérez",
                "celular": "987654321",
                "dni": "12345678",
                "fecha_nacimiento": "2000-03-15",
                "medio_pago_preferido": MedioPago.YAPE_PLIN,
                "tienda_preferida": self.tienda.id,
                "email": "otro@test.com",
            },
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.nombre, "Ana María Pérez")
        self.assertEqual(self.cliente.dni, "12345678")
        self.assertEqual(self.cliente.fecha_nacimiento, date(2000, 3, 15))
        self.assertEqual(self.cliente.medio_pago_preferido, MedioPago.YAPE_PLIN)
        self.assertEqual(self.cliente.tienda_preferida, self.tienda)
        self.assertEqual(self.cliente.email, "cliente@test.com")  # el email no se cambia desde Mi cuenta

        datos = self.client.get(YO).json()
        self.assertEqual((datos["dni"], datos["tienda_preferida"]), ("12345678", self.tienda.id))

    def test_valida_los_datos(self):
        manana = (timezone.localdate() + timedelta(days=1)).isoformat()
        casos = {
            "dni": "1234",
            "celular": "12345",
            "fecha_nacimiento": manana,
            "tienda_preferida": self.cerrada.id,
            "medio_pago_preferido": "bitcoin",
            "nombre": "A",
        }
        for campo, valor in casos.items():
            with self.subTest(campo=campo):
                respuesta = self.client.patch(YO, {campo: valor}, format="json")
                self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, respuesta.data)

    def test_sube_y_quita_la_foto(self):
        respuesta = self.client.patch(YO, {"foto": png()}, format="multipart")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK, respuesta.data)
        self.assertTrue(respuesta.data["foto"])
        respuesta = self.client.patch(YO, {"quitar_foto": True}, format="json")
        self.assertIsNone(respuesta.data["foto"])
        self.cliente.refresh_from_db()
        self.assertFalse(self.cliente.foto)

    def test_el_login_trae_las_preferencias(self):
        self.cliente.medio_pago_preferido = MedioPago.TARJETA
        self.cliente.tienda_preferida = self.tienda
        self.cliente.save()
        self.client.force_authenticate(None)
        datos = self.client.post("/api/auth/login/", {"email": "cliente@test.com", "password": "Test1234"}).json()
        self.assertEqual(datos["usuario"]["medio_pago_preferido"], "tarjeta")
        self.assertEqual(datos["usuario"]["tienda_preferida"], self.tienda.id)


class FavoritosTests(BaseCliente):
    def setUp(self):
        self.client.force_authenticate(self.cliente)

    def test_agregar_listar_y_quitar(self):
        self.assertEqual(self.client.post(FAVORITOS, {"producto": self.leche.id}).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.post(FAVORITOS, {"producto": self.leche.id}).status_code, status.HTTP_201_CREATED)
        self.client.post(FAVORITOS, {"producto": self.cafe.id})
        self.assertEqual(Favorito.objects.filter(usuario=self.cliente).count(), 2)

        datos = self.client.get(FAVORITOS, {"tienda": self.tienda.id}).json()
        self.assertEqual([p["id"] for p in datos["results"]], [self.cafe.id, self.leche.id])  # el último guardado primero
        self.assertEqual(datos["results"][0]["disponible"], 0)
        self.assertEqual(sorted(self.client.get(FAVORITOS + "ids/").json()), sorted([self.leche.id, self.cafe.id]))

        self.assertEqual(self.client.delete(f"{FAVORITOS}{self.leche.id}/").status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.delete(f"{FAVORITOS}{self.leche.id}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(FAVORITOS + "ids/").json(), [self.cafe.id])

    def test_productos_inactivos(self):
        self.assertEqual(self.client.post(FAVORITOS, {"producto": self.retirado.id}).status_code, status.HTTP_400_BAD_REQUEST)
        Favorito.objects.create(usuario=self.cliente, producto=self.leche)
        Producto.objects.filter(pk=self.leche.pk).update(activo=False)
        self.assertEqual(self.client.get(FAVORITOS).json()["count"], 0)
        self.assertEqual(self.client.get(FAVORITOS + "ids/").json(), [])

    def test_solo_clientes(self):
        self.client.force_authenticate(self.vendedor)
        self.assertEqual(self.client.get(FAVORITOS).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(FAVORITOS + "ids/").status_code, status.HTTP_401_UNAUTHORIZED)


class BusquedaTests(BaseCliente):
    def test_varias_categorias_y_marcas(self):
        datos = self.client.get(PRODUCTOS, {"categoria": [self.lacteos.id, self.bebidas.id]}).json()
        self.assertEqual(datos["count"], 4)
        datos = self.client.get(PRODUCTOS, {"marca": ["Gloria", "Laive"]}).json()
        self.assertEqual({p["marca"] for p in datos["results"]}, {"Gloria", "Laive"})
        self.assertEqual(datos["count"], 3)

    def test_relevancia(self):
        datos = self.client.get(PRODUCTOS, {"q": "leche", "orden": "relevancia"}).json()
        self.assertEqual([p["nombre"] for p in datos["results"]], ["Leche Entera", "Leche Evaporada", "Café con leche"])

    def test_facetas(self):
        hoy = timezone.localdate()
        Oferta.objects.create(producto=self.evaporada, precio_especial=Decimal("4.80"), inicio=hoy, fin=hoy)
        facetas = self.client.get(PRODUCTOS + "facetas/", {"q": "leche", "categoria": self.lacteos.id}).json()
        # La categoría no se filtra a sí misma: se ve que "Bebidas" también tiene un resultado.
        self.assertEqual(
            [(c["categoria_nombre"], c["productos"]) for c in facetas["categorias"]], [("Bebidas", 1), ("Lácteos", 2)]
        )
        self.assertEqual([(m["marca"], m["productos"]) for m in facetas["marcas"]], [("Gloria", 2)])
        # Con la oferta, la evaporada cuesta S/ 4.80: dos lácteos de menos de S/ 5.
        self.assertEqual(facetas["precios"], {"menos_de_5": 2, "de_5_a_10": 0, "mas_de_10": 0})


class MisPedidosTests(BaseCliente):
    def crear(self, codigo, estado):
        ahora = timezone.now()
        return Pedido.objects.create(
            cliente=self.cliente, tienda=self.tienda, estado=estado, codigo_recojo=codigo, medio_pago=MedioPago.EFECTIVO,
            total=Decimal("10"), creado=ahora, vence_en=ahora + timedelta(hours=48),
        )

    def test_filtra_por_varios_estados_y_busca_por_codigo(self):
        self.crear("AAA111", EstadoPedido.RECIBIDO)
        self.crear("BBB222", EstadoPedido.LISTO)
        self.crear("CCC333", EstadoPedido.ENTREGADO)
        self.client.force_authenticate(self.cliente)

        datos = self.client.get("/api/pedidos/pedidos/", {"estado": "recibido,en_preparacion,listo"}).json()
        self.assertEqual(sorted(p["codigo_recojo"] for p in datos["results"]), ["AAA111", "BBB222"])
        datos = self.client.get("/api/pedidos/pedidos/", {"q": "bbb"}).json()
        self.assertEqual([p["codigo_recojo"] for p in datos["results"]], ["BBB222"])
