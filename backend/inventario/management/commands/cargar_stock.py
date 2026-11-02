"""Carga el stock inicial simulado de cada producto en cada tienda.

Solo crea las combinaciones tienda-producto que aún no tienen stock, así no pisa lo que ya
cambió la operación. Es determinista: cada ejecución desde cero produce las mismas cantidades.
"""

import random

from django.core.management.base import BaseCommand
from django.db import transaction

from producto.models import Producto
from tienda.models import Tienda

from ...models import Stock


def cantidad_simulada(azar):
    """La mayoría con buen stock, algunos con pocas unidades y unos pocos agotados."""
    sorteo = azar.random()
    if sorteo < 0.05:
        return 0
    if sorteo < 0.15:
        return azar.randint(1, 5)
    return azar.randint(6, 80)


class Command(BaseCommand):
    help = "Crea el stock inicial simulado de todos los productos en todas las tiendas."

    @transaction.atomic
    def handle(self, *args, **opciones):
        azar = random.Random(31)
        existentes = set(Stock.objects.values_list("tienda_id", "producto_id"))
        productos = list(Producto.objects.order_by("id").values_list("id", flat=True))
        nuevos = []
        for tienda in Tienda.objects.order_by("codigo"):
            for producto_id in productos:
                cantidad = cantidad_simulada(azar)  # se sortea siempre para que sea determinista
                if (tienda.id, producto_id) not in existentes:
                    nuevos.append(Stock(tienda=tienda, producto_id=producto_id, cantidad=cantidad))
        Stock.objects.bulk_create(nuevos, batch_size=1000)
        self.stdout.write(self.style.SUCCESS(f"Stock listo: {len(nuevos)} registros nuevos."))
