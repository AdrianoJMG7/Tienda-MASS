"""Carga el caso simulado: 5 tiendas piloto en Lima y cuentas demo de los tres roles.

Los nombres, direcciones y personas son ficticios y no corresponden a locales reales de Mass.
Se puede ejecutar varias veces: actualiza lo existente sin duplicar.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from core.choices import Rol
from cuentas.models import Usuario
from tiendas.models import Tienda

PASSWORD_DEMO = "Demo1234!"

TIENDAS = [
    ("T-001", "Tienda San Juan de Lurigancho", "San Juan de Lurigancho", "Av. Próceres de la Independencia 1450"),
    ("T-002", "Tienda Comas", "Comas", "Av. Túpac Amaru 3820"),
    ("T-003", "Tienda Los Olivos", "Los Olivos", "Av. Carlos Izaguirre 715"),
    ("T-004", "Tienda Villa El Salvador", "Villa El Salvador", "Av. Revolución 1290"),
    ("T-005", "Tienda Ate", "Ate", "Av. Nicolás Ayllón 4560"),
]

# (email, nombre, celular, rol, código de tienda)
USUARIOS = [
    ("admin@mass.test", "Patricia Rojas", "987654321", Rol.ADMIN, None),
    ("luis@mass.test", "Luis Huamán", "976543210", Rol.VENDEDOR, "T-003"),
    ("vendedor.t001@mass.test", "Carla Mendoza", "965432109", Rol.VENDEDOR, "T-001"),
    ("vendedor.t002@mass.test", "Jorge Salazar", "954321098", Rol.VENDEDOR, "T-002"),
    ("vendedor.t004@mass.test", "Milagros Torres", "943210987", Rol.VENDEDOR, "T-004"),
    ("vendedor.t005@mass.test", "Kevin Ramos", "932109876", Rol.VENDEDOR, "T-005"),
    ("rocio@correo.pe", "Rocío Quispe", "921098765", Rol.CLIENTE, None),
]


class Command(BaseCommand):
    help = "Carga las 5 tiendas piloto simuladas, las cuentas demo de los tres roles y el catálogo inicial."

    def add_arguments(self, parser):
        parser.add_argument("--sin-catalogo", action="store_true", help="No cargar los ~800 productos ni su stock.")

    @transaction.atomic
    def handle(self, *args, **opciones):
        # get_or_create: si la administradora ya editó una tienda, se respetan sus cambios.
        tiendas = {}
        for codigo, nombre, distrito, direccion in TIENDAS:
            tiendas[codigo], _ = Tienda.objects.get_or_create(
                codigo=codigo, defaults={"nombre": nombre, "distrito": distrito, "direccion": direccion}
            )

        for email, nombre, celular, rol, codigo_tienda in USUARIOS:
            usuario, creado = Usuario.objects.get_or_create(email=email, defaults={"nombre": nombre})
            usuario.nombre = nombre
            usuario.celular = celular
            usuario.rol = rol
            usuario.tienda = tiendas.get(codigo_tienda)
            usuario.is_active = True
            usuario.is_staff = usuario.is_superuser = rol == Rol.ADMIN
            if creado:
                usuario.set_password(PASSWORD_DEMO)
            usuario.save()

        self.stdout.write(self.style.SUCCESS(f"{len(TIENDAS)} tiendas y {len(USUARIOS)} cuentas demo listas."))
        self.stdout.write(f"Contraseña de las cuentas demo nuevas: {PASSWORD_DEMO}")

        if not opciones["sin_catalogo"]:
            call_command("cargar_catalogo", stdout=self.stdout)
            call_command("cargar_stock", stdout=self.stdout)
