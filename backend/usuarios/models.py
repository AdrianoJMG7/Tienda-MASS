from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models

from choices import MedioPago


class Rol(models.TextChoices):
    ADMIN = "admin", "Administrador"
    VENDEDOR = "vendedor", "Vendedor"
    CLIENTE = "cliente", "Cliente"


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError("El email es obligatorio.")
        usuario = self.model(email=self.normalize_email(email).lower(), **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("rol", Rol.CLIENTE)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, rol=Rol.ADMIN)
        extra.setdefault("nombre", "Administrador")
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    """Usuario único para los tres roles; se identifica con su email."""

    username = None
    first_name = None
    last_name = None
    email = models.EmailField("email", unique=True)
    nombre = models.CharField(max_length=150)
    celular = models.CharField(max_length=15, blank=True)
    rol = models.CharField(max_length=10, choices=Rol.choices, default=Rol.CLIENTE)
    tienda = models.ForeignKey(
        "tienda.Tienda",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="vendedores",
        help_text="Solo para vendedores: tienda en la que trabaja.",
    )
    acepto_privacidad_en = models.DateTimeField(null=True, blank=True)
    # Datos y preferencias del cliente ("Mi cuenta").
    dni = models.CharField("DNI", max_length=8, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    foto = models.ImageField(upload_to="usuarios/", blank=True)
    medio_pago_preferido = models.CharField(
        max_length=10, choices=MedioPago.choices, blank=True, help_text="Se preselecciona al confirmar un pedido"
    )
    tienda_preferida = models.ForeignKey(
        "tienda.Tienda", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
        help_text="Tienda de recojo habitual del cliente",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]

    objects = UsuarioManager()

    class Meta:
        ordering = ["nombre"]

    def clean(self):
        super().clean()
        if self.rol == Rol.VENDEDOR and not self.tienda_id:
            raise ValidationError({"tienda": "Un vendedor debe tener una tienda asignada."})
        if self.rol != Rol.VENDEDOR:
            self.tienda = None

    def __str__(self):
        return f"{self.nombre} <{self.email}>"
