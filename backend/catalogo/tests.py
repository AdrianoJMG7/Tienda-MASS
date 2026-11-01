import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal
from io import BytesIO, StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db.models import F
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from cuentas.models import Usuario

from .models import Categoria, HistorialPrecio, Oferta, Producto

MEDIA_TEMPORAL = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_TEMPORAL)
class CatalogoTests(APITestCase):
    """HU05: gestionar catálogo, precios y ofertas."""

    @classmethod
    def setUpTestData(cls):
        call_command("cargar_demo", "--sin-catalogo", stdout=StringIO())
        cls.admin = Usuario.objects.get(email="admin@mass.test")
        cls.vendedor = Usuario.objects.get(email="luis@mass.test")
        cls.abarrotes = Categoria.objects.create(nombre="Abarrotes")
        cls.arroz = Producto.objects.create(
            nombre="Arroz extra 1 kg",
            marca="Valle Sur",
            codigo_barras="2000000000017",
            categoria=cls.abarrotes,
            costo=Decimal("3.00"),
            precio=Decimal("4.20"),
        )

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TEMPORAL, ignore_errors=True)

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def test_crea_producto_con_foto_y_marca_propia(self):
        imagen = BytesIO()
        Image.new("RGB", (40, 40), "yellow").save(imagen, "PNG")
        foto = SimpleUploadedFile("arroz.png", imagen.getvalue(), content_type="image/png")
        respuesta = self.client.post(
            reverse("producto-list"),
            {
                "nombre": "Arroz extra 5 kg",
                "marca": "Buen Precio",
                "codigo_barras": "2000000000024",
                "categoria": self.abarrotes.id,
                "costo": "14.00",
                "precio": "18.90",
                "marca_propia": True,
                "foto": foto,
            },
            format="multipart",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertTrue(respuesta.data["marca_propia"])
        self.assertIn("/media/productos/", respuesta.data["foto"])
        self.assertEqual(respuesta.json()["precio_final"], 18.9)

    def test_validaciones_de_producto(self):
        respuesta = self.client.post(
            reverse("producto-list"),
            {
                "nombre": "Repetido",
                "marca": "X",
                "codigo_barras": self.arroz.codigo_barras,
                "categoria": self.abarrotes.id,
                "costo": "5.00",
                "precio": "4.00",
            },
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("codigo_barras", respuesta.data)

        respuesta = self.client.post(
            reverse("producto-list"),
            {"nombre": "Caro", "marca": "X", "codigo_barras": "12345678", "categoria": self.abarrotes.id,
             "costo": "5.00", "precio": "4.00"},
            format="json",
        )
        self.assertIn("precio", respuesta.data)

    def test_cambio_de_precio_queda_registrado_con_usuario(self):
        url = reverse("producto-detail", args=[self.arroz.id])
        self.client.patch(url, {"precio": "4.50"}, format="json")
        self.client.patch(url, {"nombre": "Arroz extra 1 kg bolsa"}, format="json")  # sin cambio de precio

        registros = HistorialPrecio.objects.filter(producto=self.arroz)
        self.assertEqual(registros.count(), 1)
        registro = registros.get()
        self.assertEqual((registro.precio_anterior, registro.precio_nuevo), (Decimal("4.20"), Decimal("4.50")))
        self.assertEqual(registro.usuario, self.admin)

        historial = self.client.get(reverse("producto-historial", args=[self.arroz.id])).data
        self.assertEqual(historial[0]["usuario_nombre"], "Patricia Rojas")

    def test_oferta_vigente_cambia_el_precio_final(self):
        hoy = timezone.localdate()
        respuesta = self.client.post(
            reverse("oferta-list"),
            {"producto": self.arroz.id, "precio_especial": "3.60", "inicio": str(hoy), "fin": str(hoy + timedelta(days=7))},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertEqual(respuesta.data["estado"], "vigente")

        self.client.force_authenticate(None)  # el catálogo es público
        producto = self.client.get(reverse("producto-detail", args=[self.arroz.id])).json()
        self.assertEqual((producto["precio"], producto["precio_oferta"], producto["precio_final"]), (4.2, 3.6, 3.6))
        en_oferta = self.client.get(reverse("producto-list"), {"en_oferta": "1"}).data
        self.assertEqual(en_oferta["count"], 1)

    def test_oferta_programada_no_aplica_todavia(self):
        hoy = timezone.localdate()
        Oferta.objects.create(
            producto=self.arroz, precio_especial=Decimal("3.00"), inicio=hoy + timedelta(days=3), fin=hoy + timedelta(days=9)
        )
        producto = self.client.get(reverse("producto-detail", args=[self.arroz.id])).json()
        self.assertEqual(producto["precio_final"], 4.2)

    def test_validaciones_de_oferta(self):
        hoy = timezone.localdate()
        url = reverse("oferta-list")
        caro = self.client.post(
            url, {"producto": self.arroz.id, "precio_especial": "4.20", "inicio": str(hoy), "fin": str(hoy)}, format="json"
        )
        self.assertIn("precio_especial", caro.data)
        fechas = self.client.post(
            url,
            {"producto": self.arroz.id, "precio_especial": "3.00", "inicio": str(hoy), "fin": str(hoy - timedelta(days=1))},
            format="json",
        )
        self.assertIn("fin", fechas.data)

    def test_costo_solo_lo_ve_el_admin(self):
        url = reverse("producto-detail", args=[self.arroz.id])
        self.assertIn("costo", self.client.get(url).data)
        self.client.force_authenticate(self.vendedor)
        self.assertNotIn("costo", self.client.get(url).data)

    def test_producto_desactivado_no_aparece_en_catalogo_publico(self):
        self.client.patch(reverse("producto-detail", args=[self.arroz.id]), {"activo": False}, format="json")
        self.assertEqual(self.client.get(reverse("producto-list"), {"estado": "inactivos"}).data["count"], 1)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("producto-list")).data["count"], 0)

    def test_solo_admin_modifica_el_catalogo(self):
        self.client.force_authenticate(self.vendedor)
        respuesta = self.client.patch(reverse("producto-detail", args=[self.arroz.id]), {"precio": "1.00"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(reverse("oferta-list")).status_code, status.HTTP_403_FORBIDDEN)

    def test_categoria_con_productos_no_se_elimina(self):
        respuesta = self.client.delete(reverse("categoria-detail", args=[self.abarrotes.id]))
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)


class CargaCatalogoTests(APITestCase):
    def test_carga_unos_800_productos_sin_duplicar(self):
        call_command("cargar_catalogo", stdout=StringIO())
        call_command("cargar_catalogo", stdout=StringIO())
        self.assertEqual(Producto.objects.count(), 800)
        self.assertEqual(Categoria.objects.count(), 7)
        self.assertTrue(Producto.objects.filter(marca_propia=True).exists())
        self.assertFalse(Producto.objects.filter(precio__lt=F("costo")).exists())
        self.assertEqual(Oferta.objects.count(), 60)
