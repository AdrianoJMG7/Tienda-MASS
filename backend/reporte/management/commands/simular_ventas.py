"""Simula ventas en caja, pedidos online, ingresos y mermas de inventario para HU18.

Es historia ya cerrada: los pedidos quedan entregados o cancelados y no se toca el stock actual.
Se puede volver a correr: borra la simulación anterior y la crea de nuevo (misma semilla, mismos datos).
"""

import random
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from choices import CanalVenta, EstadoPedido, MedioPago
from inventario.servicios import registrar_ingreso, registrar_merma
from pedido.models import CanceladoPor, DetallePedido, Pedido
from pedido.servicios import ALFABETO_CODIGO
from producto.models import Producto
from tienda.models import Tienda
from usuarios.models import Rol
from venta.models import DetalleVenta, Venta

EMAIL_CLIENTE = "simulado@mass.test"
MEDIOS = [MedioPago.EFECTIVO, MedioPago.TARJETA, MedioPago.YAPE_PLIN]
MOTIVOS = ["No se recogió a tiempo", "El cliente ya no lo necesita", "Producto dañado en tienda"]


class Command(BaseCommand):
    help = "Simula ventas en caja, pedidos online, ingresos y mermas de los últimos días en todas las tiendas (para HU18)."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=30, help="Días hacia atrás a simular (por defecto 30)")

    @transaction.atomic
    def handle(self, *args, dias, **opciones):
        if not 1 <= dias <= 366:
            raise CommandError("--dias debe estar entre 1 y 366.")
        productos = list(Producto.objects.filter(activo=True).order_by("id")[:120])
        tiendas = list(Tienda.objects.filter(activa=True).order_by("codigo"))
        Usuario = get_user_model()
        respaldo = Usuario.objects.filter(rol=Rol.ADMIN).first()
        if not productos or not tiendas or not respaldo:
            raise CommandError("Faltan productos, tiendas o el administrador: corre antes cargar_demo.")

        cliente, creado = Usuario.objects.get_or_create(
            email=EMAIL_CLIENTE, defaults={"nombre": "Cliente simulado", "rol": Rol.CLIENTE, "is_active": False}
        )
        if creado:
            cliente.set_unusable_password()  # cuenta solo para agrupar los pedidos simulados; no puede ingresar
            cliente.save(update_fields=["password"])
        borrados = self._borrar_simulacion(cliente)

        azar = random.Random(16)
        # Pocos productos venden mucho y muchos venden poco, como en una bodega real.
        pesos = [1 / (i + 1) ** 0.8 for i in range(len(productos))]
        vendedores = {t.id: Usuario.objects.filter(rol=Rol.VENDEDOR, tienda=t).first() or respaldo for t in tiendas}
        codigos = set(Pedido.objects.values_list("codigo_recojo", flat=True))
        ahora = timezone.localtime()
        hoy = ahora.date()

        ventas, detalles_venta, pedidos, detalles_pedido = [], [], [], []
        ingresos_items, mermas_items = [], []
        for tienda in tiendas:
            ritmo = azar.uniform(0.6, 1.4)  # unas tiendas venden más que otras
            for atras in range(dias - 1, -1, -1):
                dia = hoy - timedelta(days=atras)
                # Ventas en caja: 10 por día por tienda
                for _ in range(10):
                    momento = self._momento(azar, dia, ahora)
                    if momento is None:
                        continue
                    items = self._items(azar, productos, pesos)
                    venta = Venta(
                        tienda=tienda, vendedor=vendedores[tienda.id], fecha=momento, medio_pago=azar.choice(MEDIOS),
                        canal=CanalVenta.CAJA, numero_ticket=f"SIM-{len(ventas) + 1:06d}",
                        total=sum(p.precio * c for p, c in items),
                    )
                    ventas.append(venta)
                    detalles_venta += [(venta, p, c) for p, c in items]

                # Pedidos online: 10 por día por tienda
                for _ in range(10):
                    creado = self._momento(azar, dia, ahora - timedelta(hours=2))
                    if creado is None:
                        continue
                    items = self._items(azar, productos, pesos)
                    codigo = self._codigo(azar, codigos)
                    pedido = Pedido(
                        cliente=cliente, tienda=tienda, codigo_recojo=codigo, medio_pago=azar.choice(MEDIOS),
                        total=sum(p.precio * c for p, c in items), creado=creado, vence_en=creado + timedelta(hours=48),
                        preparado_en=creado + timedelta(minutes=azar.uniform(2, 15)),
                    )
                    pedido.listo_en = pedido.preparado_en + timedelta(minutes=azar.uniform(5, 40) / ritmo)
                    if azar.random() < 0.85:
                        pedido.estado = EstadoPedido.ENTREGADO
                        pedido.entregado_en = min(pedido.listo_en + timedelta(hours=azar.uniform(0.3, 20)), ahora)
                        ventas.append(Venta(
                            tienda=tienda, vendedor=vendedores[tienda.id], fecha=pedido.entregado_en,
                            medio_pago=pedido.medio_pago, canal=CanalVenta.WEB, numero_ticket=f"WEB-{codigo}",
                            total=pedido.total, pedido=pedido,
                        ))
                        detalles_venta += [(ventas[-1], p, c) for p, c in items]
                    else:
                        pedido.estado = EstadoPedido.CANCELADO
                        pedido.cancelado_en = min(creado + timedelta(hours=azar.uniform(1, 48)), ahora)
                        pedido.cancelado_por = azar.choice(list(CanceladoPor))
                        pedido.motivo_cancelacion = azar.choice(MOTIVOS)
                    pedidos.append(pedido)
                    detalles_pedido += [(pedido, p, c) for p, c in items]

                # Ingresos de inventario: 5 por día por tienda (aleatorio)
                for _ in range(5):
                    producto = azar.choice(productos)
                    cantidad = azar.randint(1, 10)
                    ingresos_items.append((tienda, producto, cantidad, dia))

                # Mermas de inventario: 2 por día por tienda (aleatorio)
                for _ in range(2):
                    producto = azar.choice(productos)
                    cantidad = azar.randint(1, 5)
                    motivo = azar.choice(["vencido", "dañado"])
                    mermas_items.append((tienda, producto, cantidad, motivo, dia))

        Pedido.objects.bulk_create(pedidos)
        DetallePedido.objects.bulk_create(
            DetallePedido(pedido=pe, producto=p, cantidad=c, precio_unitario=p.precio) for pe, p, c in detalles_pedido
        )
        for venta in ventas:
            if venta.pedido is not None:
                venta.pedido_id = venta.pedido.id  # el pedido recién tiene id tras el bulk_create
        Venta.objects.bulk_create(ventas)
        DetalleVenta.objects.bulk_create(
            DetalleVenta(venta=v, producto=p, cantidad=c, precio_unitario=p.precio) for v, p, c in detalles_venta
        )

        # Registrar ingresos de inventario
        for tienda, producto, cantidad, dia in ingresos_items:
            fecha_vencimiento = dia + timedelta(days=azar.randint(30, 180))  # vencimiento entre 1-6 meses
            try:
                registrar_ingreso(tienda, [(producto, cantidad)], vendedores[tienda.id], "Simulación HU18", fecha_vencimiento)
            except Exception:
                pass  # Ignorar errores de stock

        # Registrar mermas de inventario
        for tienda, producto, cantidad, motivo, dia in mermas_items:
            try:
                registrar_merma(tienda, [(producto, cantidad)], vendedores[tienda.id], motivo)
            except Exception:
                pass  # Ignorar errores de stock insuficiente

        if borrados:
            self.stdout.write(f"Simulación anterior borrada ({borrados} ventas).")
        caja = sum(v.canal == CanalVenta.CAJA for v in ventas)
        self.stdout.write(self.style.SUCCESS(
            f"Simulados {dias} días en {len(tiendas)} tiendas: {caja} ventas en caja, "
            f"{len(pedidos)} pedidos online ({len(ventas) - caja} entregados), "
            f"{len(ingresos_items)} ingresos de inventario, {len(mermas_items)} mermas."
        ))

    @staticmethod
    def _borrar_simulacion(cliente):
        simuladas = Venta.objects.filter(numero_ticket__startswith="SIM-") | Venta.objects.filter(pedido__cliente=cliente)
        n = simuladas.count()
        simuladas.delete()  # sus detalles se borran en cascada
        Pedido.objects.filter(cliente=cliente).delete()
        return n

    @staticmethod
    def _momento(azar, dia, limite):
        """Hora al azar del día entre 8:00 y 22:00; None si cae en el futuro."""
        inicio = timezone.make_aware(datetime.combine(dia, time(8)))
        momento = inicio + timedelta(minutes=azar.randint(0, 14 * 60))
        return momento if momento <= limite else None

    @staticmethod
    def _items(azar, productos, pesos):
        elegidos = set(azar.choices(productos, weights=pesos, k=azar.randint(1, 5)))
        return [(p, azar.choice([1, 1, 1, 2, 2, 3])) for p in sorted(elegidos, key=lambda p: p.id)]

    @staticmethod
    def _codigo(azar, usados):
        while True:
            codigo = "".join(azar.choice(ALFABETO_CODIGO) for _ in range(6))
            if codigo not in usados:
                usados.add(codigo)
                return codigo
