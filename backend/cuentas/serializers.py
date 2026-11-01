import re

from django.contrib.auth import password_validation
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.choices import Rol
from tiendas.models import Tienda

from .models import Usuario

CELULAR_RE = re.compile(r"^9\d{8}$")


def validar_celular(valor):
    valor = valor.replace(" ", "")
    if valor and not CELULAR_RE.match(valor):
        raise serializers.ValidationError("Ingresa un celular de 9 dígitos que empiece con 9.")
    return valor


class UsuarioSerializer(serializers.ModelSerializer):
    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre", "celular", "rol", "tienda", "tienda_nombre", "is_active"]
        read_only_fields = fields


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    acepta_privacidad = serializers.BooleanField(write_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre", "celular", "password", "acepta_privacidad"]
        extra_kwargs = {"email": {"validators": []}, "celular": {"required": True}}

    def validate_email(self, valor):
        valor = valor.strip().lower()
        if Usuario.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este email.")
        return valor

    def validate_nombre(self, valor):
        valor = valor.strip()
        if len(valor) < 3:
            raise serializers.ValidationError("Escribe tu nombre completo.")
        return valor

    def validate_celular(self, valor):
        valor = validar_celular(valor)
        if not valor:
            raise serializers.ValidationError("El celular es obligatorio.")
        return valor

    def validate_acepta_privacidad(self, valor):
        if not valor:
            raise serializers.ValidationError(
                "Debes aceptar la política de privacidad (Ley 29733) para crear tu cuenta."
            )
        return valor

    def validate(self, attrs):
        candidato = Usuario(email=attrs.get("email"), nombre=attrs.get("nombre"))
        try:
            password_validation.validate_password(attrs["password"], candidato)
        except Exception as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return attrs

    def create(self, datos):
        datos.pop("acepta_privacidad")
        return Usuario.objects.create_user(
            rol=Rol.CLIENTE, acepto_privacidad_en=timezone.now(), **datos
        )


class LoginSerializer(TokenObtainPairSerializer):
    """Inicio de sesión con email y contraseña, con mensajes claros en español."""

    @classmethod
    def get_token(cls, usuario):
        token = super().get_token(usuario)
        token["rol"] = usuario.rol
        token["nombre"] = usuario.nombre
        return token

    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, "").strip().lower()
        try:
            datos = super().validate(attrs)
        except AuthenticationFailed:
            usuario = Usuario.objects.filter(email=attrs[self.username_field]).first()
            if usuario and not usuario.is_active and usuario.check_password(attrs.get("password", "")):
                raise AuthenticationFailed(
                    "Tu cuenta está desactivada. Comunícate con el administrador.", "cuenta_desactivada"
                )
            raise AuthenticationFailed("Email o contraseña incorrectos.", "credenciales_invalidas")
        datos["usuario"] = UsuarioSerializer(self.user).data
        return datos


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class VendedorSerializer(serializers.ModelSerializer):
    """HU04: cuenta de vendedor asignada a una tienda."""

    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    tienda = serializers.PrimaryKeyRelatedField(queryset=Tienda.objects.all())
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)
    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "id",
            "email",
            "nombre",
            "celular",
            "tienda",
            "tienda_codigo",
            "tienda_nombre",
            "is_active",
            "password",
        ]
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, valor):
        valor = valor.strip().lower()
        otros = Usuario.objects.filter(email__iexact=valor)
        if self.instance:
            otros = otros.exclude(pk=self.instance.pk)
        if otros.exists():
            raise serializers.ValidationError("Ya existe una cuenta con este email.")
        return valor

    def validate_nombre(self, valor):
        valor = valor.strip()
        if len(valor) < 3:
            raise serializers.ValidationError("Escribe el nombre completo.")
        return valor

    def validate_celular(self, valor):
        return validar_celular(valor)

    def validate_tienda(self, tienda):
        cambia = not self.instance or self.instance.tienda_id != tienda.id
        if cambia and not tienda.activa:
            raise serializers.ValidationError("La tienda está desactivada; actívala antes de asignarle vendedores.")
        return tienda

    def validate(self, attrs):
        password = attrs.get("password")
        if not self.instance and not password:
            raise serializers.ValidationError({"password": "Asigna una contraseña inicial."})
        if password:
            try:
                password_validation.validate_password(password)
            except Exception as error:
                raise serializers.ValidationError({"password": list(error.messages)})
        return attrs

    def create(self, datos):
        return Usuario.objects.create_user(rol=Rol.VENDEDOR, **datos)

    def update(self, instancia, datos):
        password = datos.pop("password", None)
        for campo, valor in datos.items():
            setattr(instancia, campo, valor)
        if password:
            instancia.set_password(password)
        instancia.save()
        return instancia

