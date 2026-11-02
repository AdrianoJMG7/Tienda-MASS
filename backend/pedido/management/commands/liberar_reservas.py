"""HU09: cancela los pedidos que no se recogieron a tiempo y libera su stock reservado.

Se ejecuta de forma periódica (por ejemplo cada 15 minutos):
- En producción, como tarea programada del hosting (Render Cron Job, etc.).
- En Windows, con el Programador de tareas.
"""

from django.core.management.base import BaseCommand

from pedido.servicios import liberar_vencidos


class Command(BaseCommand):
    help = "Cancela los pedidos vencidos (no recogidos a tiempo) y libera su stock reservado."

    def handle(self, *args, **opciones):
        total = liberar_vencidos()
        self.stdout.write(self.style.SUCCESS(f"Pedidos vencidos cancelados: {total}."))
