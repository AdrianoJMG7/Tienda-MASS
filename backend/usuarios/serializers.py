import re
from datetime import date

from django.contrib.auth import password_validation
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario

CELULAR_RE = re.compile(r"^9\d{8}$")


def validar_celular(valor):
    valor = valor.replace(" ", "")
    if valor and not CELULAR_RE.match(valor):
        raise serializers.ValidationError("Ingresa un celular de 9 dígitos que empiece con 9.")
    return valor


FOTO_MAX_BYTES = 2 * 1024 * 1024


class UsuarioSerializer(serializers.ModelSerializer):
    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True, default=None)

    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombre", "celular", "rol", "tienda", "tienda_nombre", "is_active",
            "foto", "medio_pago_preferido", "tienda_preferida",
        ]
        read_only_fields = fields


class PerfilSerializer(serializers.ModelSerializer):
    """Mi cuenta: el usuario consulta y actualiza sus datos y preferencias. El email no cambia."""

    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True, default=None)
    quitar_foto = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombre", "celular", "rol", "tienda", "tienda_nombre", "is_active",
            "dni", "fecha_nacimiento", "foto", "quitar_foto", "medio_pago_preferido", "tienda_preferida",
        ]
        read_only_fields = ["id", "email", "rol", "tienda", "tienda_nombre", "is_active"]
        extra_kwargs = {"foto": {"required": False}}

    def validate_nombre(self, valor):
        valor = valor.strip()
        if len(valor) < 3:
            raise serializers.ValidationError("Escribe tu nombre completo.")
        return valor

    def validate_celular(self, valor):
        return validar_celular(valor)

    def validate_dni(self, valor):
        valor = valor.strip()
        if valor and not re.fullmatch(r"\d{8}", valor):
            raise serializers.ValidationError("El DNI debe tener 8 dígitos.")
        return valor

    def validate_fecha_nacimiento(self, valor):
        if valor and not date(1900, 1, 1) <= valor <= date.today():
            raise serializers.ValidationError("Ingresa una fecha de nacimiento válida.")
        return valor

    def validate_foto(self, foto):
        if foto and foto.size > FOTO_MAX_BYTES:
            raise serializers.ValidationError("La foto no debe pesar más de 2 MB.")
        if foto and getattr(foto, "image", None) and foto.image.format not in ("JPEG", "PNG"):
            raise serializers.ValidationError("La foto debe ser JPG o PNG.")
        return foto

    def validate_tienda_preferida(self, tienda):
        if tienda and not tienda.activa:
            raise serializers.ValidationError("Esa tienda no está disponible para recojo.")
        return tienda

    def update(self, usuario, datos):
        if datos.pop("quitar_foto", False) and "foto" not in datos:
            usuario.foto.delete(save=False)
            datos["foto"] = ""
        return super().update(usuario, datos)


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
            rol="cliente", acepto_privacidad_en=timezone.now(), **datos
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
