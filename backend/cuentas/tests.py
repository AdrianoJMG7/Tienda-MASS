from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.choices import Rol

from .models import Usuario

DATOS_REGISTRO = {
    "email": "Ana.Perez@Correo.pe",
    "nombre": "Ana Pérez",
    "celular": "912345678",
    "password": "ClaveSegura2026",
    "acepta_privacidad": True,
}


class RegistroTests(APITestCase):
    """HU02: registrar cuenta de cliente."""

    url = reverse("registro")

    def test_crea_cliente_con_password_bcrypt(self):
        respuesta = self.client.post(self.url, DATOS_REGISTRO, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", respuesta.data)
        usuario = Usuario.objects.get(email="ana.perez@correo.pe")
        self.assertEqual(usuario.rol, Rol.CLIENTE)
        self.assertTrue(usuario.password.startswith("bcrypt_sha256$"))
        self.assertIsNotNone(usuario.acepto_privacidad_en)

    def test_email_unico_sin_importar_mayusculas(self):
        self.client.post(self.url, DATOS_REGISTRO, format="json")
        respuesta = self.client.post(self.url, {**DATOS_REGISTRO, "email": "ana.perez@correo.pe"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", respuesta.data)

    def test_exige_aceptar_politica_de_privacidad(self):
        respuesta = self.client.post(self.url, {**DATOS_REGISTRO, "acepta_privacidad": False}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("acepta_privacidad", respuesta.data)

    def test_mensajes_claros_para_datos_invalidos(self):
        respuesta = self.client.post(
            self.url,
            {**DATOS_REGISTRO, "email": "no-es-email", "celular": "12345", "password": "12345678"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", respuesta.data)
        self.assertIn("celular", respuesta.data)

    def test_password_debil_se_rechaza(self):
        respuesta = self.client.post(self.url, {**DATOS_REGISTRO, "password": "12345678"}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", respuesta.data)

    def test_no_permite_elegir_rol(self):
        self.client.post(self.url, {**DATOS_REGISTRO, "rol": "admin"}, format="json")
        self.assertEqual(Usuario.objects.get(email="ana.perez@correo.pe").rol, Rol.CLIENTE)


class LoginTests(APITestCase):
    """HU03: iniciar sesión según rol."""

    @classmethod
    def setUpTestData(cls):
        call_command("cargar_demo", "--sin-catalogo", stdout=StringIO())

    def login(self, email, password="Demo1234!"):
        return self.client.post(reverse("login"), {"email": email, "password": password}, format="json")

    def test_login_devuelve_tokens_y_rol(self):
        for email, rol in [
            ("admin@mass.test", "admin"),
            ("luis@mass.test", "vendedor"),
            ("rocio@correo.pe", "cliente"),
        ]:
            respuesta = self.login(email)
            self.assertEqual(respuesta.status_code, status.HTTP_200_OK, email)
            self.assertIn("access", respuesta.data)
            self.assertIn("refresh", respuesta.data)
            self.assertEqual(respuesta.data["usuario"]["rol"], rol)

    def test_email_sin_distinguir_mayusculas(self):
        self.assertEqual(self.login("ROCIO@correo.pe").status_code, status.HTTP_200_OK)

    def test_credenciales_incorrectas(self):
        respuesta = self.login("rocio@correo.pe", "otraClave99")
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.data["detail"], "Email o contraseña incorrectos.")

    def test_cuenta_desactivada(self):
        Usuario.objects.filter(email="luis@mass.test").update(is_active=False)
        respuesta = self.login("luis@mass.test")
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("desactivada", respuesta.data["detail"])

    def test_cada_rol_solo_accede_a_su_inicio(self):
        rutas = {"admin": "inicio-admin", "vendedor": "inicio-vendedor", "cliente": "inicio-cliente"}
        cuentas = {"admin": "admin@mass.test", "vendedor": "luis@mass.test", "cliente": "rocio@correo.pe"}
        for rol, email in cuentas.items():
            token = self.login(email).data["access"]
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            for otro_rol, ruta in rutas.items():
                esperado = status.HTTP_200_OK if otro_rol == rol else status.HTTP_403_FORBIDDEN
                self.assertEqual(self.client.get(reverse(ruta)).status_code, esperado, f"{rol} -> {ruta}")
        self.client.credentials()

    def test_inicio_vendedor_incluye_su_tienda(self):
        token = self.login("luis@mass.test").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(reverse("inicio-vendedor")).data["tienda"]["codigo"], "T-003")

    def test_sin_sesion_no_hay_acceso(self):
        self.assertEqual(self.client.get(reverse("inicio-cliente")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalida_el_refresh(self):
        tokens = self.login("rocio@correo.pe").data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        respuesta = self.client.post(reverse("logout"), {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_205_RESET_CONTENT)
        self.client.credentials()
        respuesta = self.client.post(reverse("refresh"), {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
