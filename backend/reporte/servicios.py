"""HU16: indicadores de ventas y pedidos por tienda y canal."""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum
from django.db.models.functions import TruncDate

from choices import CanalVenta, EstadoPedido
from pedido.models import Pedido
from producto.models import Oferta
from tienda.models import Tienda
from venta.models import DetalleVenta, Venta

CENTIMO = Decimal("0.01")


@dataclass(frozen=True)
class Filtros:
    desde: date
    hasta: date
    tienda: Tienda | None = None

    @property
    def descripcion(self):
        tienda = self.tienda.nombre if self.tienda else "Todas las tiendas"
        return f"Del {self.desde:%d/%m/%Y} al {self.hasta:%d/%m/%Y} · {tienda}"


def _soles(valor):
    """Redondea a céntimos (las sumas de SQLite traen decimales de sobra)."""
    return Decimal(valor or 0).quantize(CENTIMO)


def _variacion(actual, anterior):
    """Variación porcentual con un decimal; None si no hay con qué comparar."""
    return round((float(actual) - float(anterior)) / float(anterior) * 100, 1) if anterior else None


def _ticket(total, ventas):
    return (Decimal(total) / ventas).quantize(CENTIMO) if ventas else Decimal("0.00")


def _minutos_promedio(duraciones):
    """Promedio en minutos (con un decimal) de una lista de timedelta; None si no hay datos."""
    if not duraciones:
        return None
    return round(sum(d.total_seconds() for d in duraciones) / len(duraciones) / 60, 1)


def panel(filtros: Filtros):
    """Arma todos los indicadores del panel con los filtros dados (periodo y, opcionalmente, tienda)."""
    ventas = Venta.objects.filter(fecha__date__range=(filtros.desde, filtros.hasta))
    pedidos = Pedido.objects.filter(creado__date__range=(filtros.desde, filtros.hasta))
    tiendas = Tienda.objects.order_by("codigo")
    if filtros.tienda:
        ventas = ventas.filter(tienda=filtros.tienda)
        pedidos = pedidos.filter(tienda=filtros.tienda)
        tiendas = tiendas.filter(pk=filtros.tienda.pk)

    caja = Q(canal=CanalVenta.CAJA)
    web = Q(canal=CanalVenta.WEB)
    totales = ventas.aggregate(ventas=Count("id"), total=Sum("total"))
    total = _soles(totales["total"])

    # Ventas por canal (caja y web) con ticket promedio.
    por_canal_db = {f["canal"]: f for f in ventas.values("canal").annotate(ventas=Count("id"), total=Sum("total"))}
    por_canal = []
    for canal in CanalVenta:
        fila = por_canal_db.get(canal.value, {"ventas": 0, "total": Decimal("0")})
        por_canal.append({
            "canal": canal.value,
            "canal_display": canal.label,
            "ventas": fila["ventas"],
            "total": _soles(fila["total"]),
            "ticket_promedio": _ticket(fila["total"], fila["ventas"]),
        })

    # Tiempo de preparación: desde que el cliente confirma hasta que el pedido queda listo para recoger.
    preparados = list(pedidos.filter(listo_en__isnull=False).values_list("tienda_id", "creado", "listo_en"))

    # Comparativo por tienda: ventas por canal, ticket promedio, pedidos y tiempo de preparación.
    ventas_tienda = {
        f["tienda_id"]: f
        for f in ventas.values("tienda_id").annotate(
            ventas=Count("id"), monto=Sum("total"), caja=Sum("total", filter=caja), web=Sum("total", filter=web)
        )
    }
    pedidos_tienda = dict(pedidos.values("tienda_id").annotate(n=Count("id")).values_list("tienda_id", "n"))
    por_tienda = []
    for tienda in tiendas:
        fila = ventas_tienda.get(tienda.id, {})
        n = fila.get("ventas", 0)
        por_tienda.append({
            "tienda": tienda.id,
            "codigo": tienda.codigo,
            "nombre": tienda.nombre,
            "ventas": n,
            "total": _soles(fila.get("monto")),
            "caja": _soles(fila.get("caja")),
            "web": _soles(fila.get("web")),
            "ticket_promedio": _ticket(fila.get("monto") or 0, n),
            "pedidos": pedidos_tienda.get(tienda.id, 0),
            "minutos_preparacion": _minutos_promedio([l - c for t, c, l in preparados if t == tienda.id]),
        })
    por_tienda.sort(key=lambda f: f["total"], reverse=True)

    # Evolución diaria; los días sin ventas aparecen en cero para no deformar el gráfico.
    por_dia_db = {
        f["dia"]: f
        for f in ventas.annotate(dia=TruncDate("fecha")).values("dia").annotate(
            caja=Sum("total", filter=caja), web=Sum("total", filter=web)
        )
    }
    por_dia = []
    dia = filtros.desde
    while dia <= filtros.hasta:
        fila = por_dia_db.get(dia, {})
        por_dia.append({"fecha": dia, "caja": _soles(fila.get("caja")), "web": _soles(fila.get("web"))})
        dia += timedelta(days=1)

    # Pedidos online por estado, en el orden del flujo.
    estados_db = dict(pedidos.values("estado").annotate(n=Count("id")).values_list("estado", "n"))
    por_estado = [{"estado": e.value, "estado_display": e.label, "pedidos": estados_db.get(e.value, 0)} for e in EstadoPedido]

    # Productos más vendidos (caja y web) por unidades.
    top_productos = list(
        DetalleVenta.objects.filter(venta__in=ventas)
        .values("producto", nombre=F("producto__nombre"), marca=F("producto__marca"))
        .annotate(
            unidades=Sum("cantidad"),
            total=Sum(F("cantidad") * F("precio_unitario"), output_field=DecimalField(max_digits=12, decimal_places=2)),
        )
        .order_by("-unidades", "-total")[:10]
    )
    for producto in top_productos:
        producto["total"] = _soles(producto["total"])

    total_pedidos = sum(estados_db.values())

    # Periodo anterior de la misma duración, para comparar.
    dias = (filtros.hasta - filtros.desde).days + 1
    previo = (filtros.desde - timedelta(days=dias), filtros.desde - timedelta(days=1))
    ventas_previas = Venta.objects.filter(fecha__date__range=previo)
    pedidos_previos = Pedido.objects.filter(creado__date__range=previo)
    if filtros.tienda:
        ventas_previas = ventas_previas.filter(tienda=filtros.tienda)
        pedidos_previos = pedidos_previos.filter(tienda=filtros.tienda)
    previas = ventas_previas.aggregate(ventas=Count("id"), total=Sum("total"))
    total_previo = _soles(previas["total"])
    clientes = pedidos.values("cliente").distinct().count()
    tienda_previa = dict(ventas_previas.values("tienda_id").annotate(s=Sum("total")).values_list("tienda_id", "s"))
    for fila in por_tienda:
        fila["variacion"] = _variacion(fila["total"], tienda_previa.get(fila["tienda"]))

    # Ventas por categoría: las tres mayores y el resto junto en "Otros".
    categorias = list(
        DetalleVenta.objects.filter(venta__in=ventas)
        .values(categoria=F("producto__categoria__nombre"))
        .annotate(total=Sum(F("cantidad") * F("precio_unitario"), output_field=DecimalField(max_digits=12, decimal_places=2)))
        .order_by("-total")
    )
    suma_categorias = sum(c["total"] for c in categorias) or Decimal("1")
    por_categoria = [
        {"categoria": c["categoria"], "total": _soles(c["total"]), "porcentaje": round(float(c["total"] / suma_categorias) * 100)}
        for c in categorias
    ]

    por_vendedor = [
        {
            "vendedor": f["vendedor__nombre"],
            "tienda": f["tienda__codigo"],
            "ventas": f["n"],
            "total": _soles(f["suma"]),
            "ticket_promedio": _ticket(f["suma"], f["n"]),
        }
        for f in ventas.values("vendedor__nombre", "tienda__codigo").annotate(n=Count("id"), suma=Sum("total")).order_by("-suma")
    ]

    # Ofertas activas en algún momento del periodo y lo que se vendió de cada producto mientras duraron.
    ofertas = []
    for oferta in Oferta.objects.filter(inicio__lte=filtros.hasta, fin__gte=filtros.desde).select_related("producto"):
        vendido = DetalleVenta.objects.filter(
            venta__in=ventas, producto=oferta.producto,
            venta__fecha__date__range=(max(oferta.inicio, filtros.desde), min(oferta.fin, filtros.hasta)),
        ).aggregate(
            unidades=Sum("cantidad"),
            total=Sum(F("cantidad") * F("precio_unitario"), output_field=DecimalField(max_digits=12, decimal_places=2)),
        )
        ofertas.append({
            "oferta": oferta.id,
            "producto": oferta.producto.nombre,
            "marca": oferta.producto.marca,
            "precio_normal": oferta.producto.precio,
            "precio_especial": oferta.precio_especial,
            "inicio": oferta.inicio,
            "fin": oferta.fin,
            "estado": oferta.estado,
            "unidades": vendido["unidades"] or 0,
            "total": _soles(vendido["total"]),
        })
    ofertas.sort(key=lambda o: o["unidades"], reverse=True)
    return {
        "filtros": {
            "desde": filtros.desde,
            "hasta": filtros.hasta,
            "tienda": filtros.tienda.id if filtros.tienda else None,
            "descripcion": filtros.descripcion,
        },
        "resumen": {
            "ventas": totales["ventas"],
            "total": total,
            "ticket_promedio": _ticket(total, totales["ventas"]),
            "pedidos": total_pedidos,
            "pedidos_entregados": estados_db.get(EstadoPedido.ENTREGADO, 0),
            "pedidos_cancelados": estados_db.get(EstadoPedido.CANCELADO, 0),
            "minutos_preparacion": _minutos_promedio([l - c for _, c, l in preparados]),
        },
        "variacion": {
            "total": _variacion(total, total_previo),
            "ventas": _variacion(totales["ventas"], previas["ventas"]),
            "pedidos": _variacion(total_pedidos, pedidos_previos.count()),
            "clientes": _variacion(clientes, pedidos_previos.values("cliente").distinct().count()),
            "ticket_promedio": _variacion(_ticket(total, totales["ventas"]), _ticket(total_previo, previas["ventas"])),
        },
        "clientes_unicos": clientes,
        "por_categoria": por_categoria,
        "por_vendedor": por_vendedor,
        "ofertas": ofertas[:20],
        "por_canal": por_canal,
        "por_tienda": por_tienda,
        "por_dia": por_dia,
        "por_estado": por_estado,
        "top_productos": top_productos,
    }
