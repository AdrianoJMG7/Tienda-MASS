from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Rol, Usuario

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
