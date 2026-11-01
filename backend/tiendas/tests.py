from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.choices import Rol
from cuentas.models import Usuario

from .models import Tienda


class BaseAdmin(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_demo", "--sin-catalogo", stdout=StringIO())
        cls.admin = Usuario.objects.get(email="admin@mass.test")
        cls.vendedor = Usuario.objects.get(email="luis@mass.test")
        cls.cliente = Usuario.objects.get(email="rocio@correo.pe")
        cls.t003 = Tienda.objects.get(codigo="T-003")

    def como(self, usuario):
        self.client.force_authenticate(usuario)


class TiendaTests(BaseAdmin):
    """HU04: registrar tiendas; solo las activas son punto de recojo."""

    lista = reverse("tienda-list")
    nueva = {
        "codigo": "t-006",
        "nombre": "Tienda Surco",
        "distrito": "Santiago de Surco",
        "direccion": "Av. Caminos del Inca 1200",
        "horario": "Lun a Dom de 7:00 a 22:00",
    }

    def test_admin_registra_tienda(self):
        self.como(self.admin)
        respuesta = self.client.post(self.lista, self.nueva, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertEqual(respuesta.data["codigo"], "T-006")
        self.assertTrue(respuesta.data["activa"])

    def test_codigo_unico_y_con_formato(self):
        self.como(self.admin)
        duplicado = self.client.post(self.lista, {**self.nueva, "codigo": "T-001"}, format="json")
        self.assertEqual(duplicado.status_code, status.HTTP_400_BAD_REQUEST)
        mal_formato = self.client.post(self.lista, {**self.nueva, "codigo": "SURCO"}, format="json")
        self.assertIn("codigo", mal_formato.data)

    def test_solo_tiendas_activas_son_punto_de_recojo(self):
        self.como(self.admin)
        self.client.patch(reverse("tienda-detail", args=[self.t003.id]), {"activa": False}, format="json")
        self.assertEqual(len(self.client.get(self.lista).data), 5)  # la administradora ve todas

        self.client.force_authenticate(None)
        codigos = [t["codigo"] for t in self.client.get(self.lista).data]
        self.assertNotIn("T-003", codigos)
        self.assertEqual(len(codigos), 4)

    def test_no_se_eliminan(self):
        self.como(self.admin)
        respuesta = self.client.delete(reverse("tienda-detail", args=[self.t003.id]))
        self.assertEqual(respuesta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_vendedor_y_cliente_no_modifican_tiendas(self):
        for usuario in (self.vendedor, self.cliente):
            self.como(usuario)
            respuesta = self.client.post(self.lista, self.nueva, format="json")
            self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)


class VendedorTests(BaseAdmin):
    """HU04: crear, editar y desactivar vendedores asignándoles una tienda."""

    lista = reverse("vendedor-list")

    def datos(self, **cambios):
        return {
            "email": "nuevo.vendedor@mass.test",
            "nombre": "Ana Vendedora",
            "celular": "911222333",
            "tienda": self.t003.id,
            "password": "Inicial2026!",
            **cambios,
        }

    def test_admin_crea_vendedor_que_puede_ingresar(self):
        self.como(self.admin)
        respuesta = self.client.post(self.lista, self.datos(), format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)
        self.assertNotIn("password", respuesta.data)
        vendedor = Usuario.objects.get(email="nuevo.vendedor@mass.test")
        self.assertEqual((vendedor.rol, vendedor.tienda_id), (Rol.VENDEDOR, self.t003.id))

        self.client.force_authenticate(None)
        login = self.client.post(
            reverse("login"), {"email": "nuevo.vendedor@mass.test", "password": "Inicial2026!"}, format="json"
        )
        self.assertEqual(login.data["usuario"]["rol"], "vendedor")

    def test_tienda_y_password_obligatorios(self):
        self.como(self.admin)
        datos = self.datos()
        del datos["tienda"], datos["password"]
        respuesta = self.client.post(self.lista, datos, format="json")
        self.assertIn("tienda", respuesta.data)

    def test_no_asigna_tienda_desactivada(self):
        Tienda.objects.filter(pk=self.t003.pk).update(activa=False)
        self.como(self.admin)
        respuesta = self.client.post(self.lista, self.datos(), format="json")
        self.assertIn("tienda", respuesta.data)

    def test_editar_cambia_tienda_y_mantiene_password(self):
        self.como(self.admin)
        t001 = Tienda.objects.get(codigo="T-001")
        url = reverse("vendedor-detail", args=[self.vendedor.id])
        respuesta = self.client.patch(url, {"tienda": t001.id, "nombre": "Luis Huamán Rojas"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.vendedor.refresh_from_db()
        self.assertEqual(self.vendedor.tienda, t001)
        self.assertTrue(self.vendedor.check_password("Demo1234!"))

    def test_desactivar_impide_ingresar(self):
        self.como(self.admin)
        respuesta = self.client.delete(reverse("vendedor-detail", args=[self.vendedor.id]))
        self.assertEqual(respuesta.status_code, status.HTTP_204_NO_CONTENT)
        self.vendedor.refresh_from_db()
        self.assertFalse(self.vendedor.is_active)

        self.client.force_authenticate(None)
        login = self.client.post(reverse("login"), {"email": "luis@mass.test", "password": "Demo1234!"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lista_solo_vendedores_y_filtra_por_tienda(self):
        self.como(self.admin)
        respuesta = self.client.get(self.lista, {"tienda": self.t003.id})
        self.assertEqual([v["email"] for v in respuesta.data["results"]], ["luis@mass.test"])

    def test_solo_admin_gestiona_vendedores(self):
        for usuario in (self.vendedor, self.cliente):
            self.como(usuario)
            self.assertEqual(self.client.get(self.lista).status_code, status.HTTP_403_FORBIDDEN)
