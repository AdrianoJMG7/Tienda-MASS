import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def _soles(valor):
    return f"S/ {valor:,.2f}"


def enviar_confirmacion(pedido_id):
    """HU08: correo al cliente con el resumen del pedido y su código de recojo."""
    from .models import Pedido

    pedido = Pedido.objects.select_related("cliente", "tienda").prefetch_related("detalles__producto").get(
        pk=pedido_id
    )
    tienda = pedido.tienda
    lineas = [
        f"  {d.cantidad} x {d.producto.nombre} ({d.producto.marca}) .... {_soles(d.subtotal)}"
        for d in pedido.detalles.all()
    ]
    vence = timezone.localtime(pedido.vence_en).strftime("%d/%m/%Y %H:%M")
    cuerpo = "\n".join(
        [
            f"Hola, {pedido.cliente.nombre.split()[0]}:",
            "",
            "Recibimos tu pedido. Te avisaremos por correo cuando esté listo para recoger.",
            "",
            f"CÓDIGO DE RECOJO: {pedido.codigo_recojo}",
            "",
            f"Tienda: {tienda.nombre}",
            f"Dirección: {tienda.direccion}, {tienda.distrito}",
            f"Horario: {tienda.horario}",
            f"Recógelo antes del {vence}.",
            "",
            "Productos:",
            *lineas,
            "",
            f"Total a pagar al recoger: {_soles(pedido.total)} ({pedido.get_medio_pago_display()})",
            "",
            f"Ver tu pedido: {settings.FRONTEND_URL}/pedido/{pedido.id}",
            "",
            "Mass — prototipo académico con datos simulados.",
        ]
    )
    try:
        send_mail(
            subject=f"Tu pedido {pedido.codigo_recojo} para recoger en {tienda.nombre}",
            message=cuerpo,
            from_email=None,
            recipient_list=[pedido.cliente.email],
        )
    except Exception:
        # Si el correo falla, el pedido sigue siendo válido: el código también se ve en la web.
        logger.exception("No se pudo enviar el correo del pedido %s", pedido.codigo_recojo)
