from django.db import models


class MedioPago(models.TextChoices):
    EFECTIVO = "efectivo", "Efectivo"
    TARJETA = "tarjeta", "Tarjeta"
    YAPE_PLIN = "yape_plin", "Yape/Plin"


class CanalVenta(models.TextChoices):
    CAJA = "caja", "Caja"
    WEB = "web", "Web"


class EstadoPedido(models.TextChoices):
    RECIBIDO = "recibido", "Recibido"
    EN_PREPARACION = "en_preparacion", "En preparación"
    LISTO = "listo", "Listo para recoger"
    ENTREGADO = "entregado", "Entregado"
    CANCELADO = "cancelado", "Cancelado"
