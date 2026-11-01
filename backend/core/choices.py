from django.db import models


class Rol(models.TextChoices):
    ADMIN = "admin", "Administrador"
    VENDEDOR = "vendedor", "Vendedor"
    CLIENTE = "cliente", "Cliente"


class MedioPago(models.TextChoices):
    EFECTIVO = "efectivo", "Efectivo"
    TARJETA = "tarjeta", "Tarjeta"
    YAPE_PLIN = "yape_plin", "Yape/Plin"
