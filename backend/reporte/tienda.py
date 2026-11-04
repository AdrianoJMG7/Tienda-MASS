"""Reportes y rendimiento de la tienda del vendedor."""

from calendar import monthrange
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from pedido.models import Pedido
from venta.models import DetalleVenta, Venta

CENTIMO = Decimal("0.01")


def _soles(valor):
    return Decimal(valor or 0).quantize(CENTIMO)


def _variacion(actual, anterior):
    return round((float(actual) - float(anterior)) / float(anterior) * 100) if anterior else None


def _indicadores(tienda, desde, hasta):
    ventas = Venta.objects.filter(tienda=tienda, fecha__date__range=(desde, hasta))
    datos = ventas.aggregate(total=Sum("total"), n=Count("id"))
    total = _soles(datos["total"])
    return {
        "ventas": total,
        "tickets": datos["n"],
        "ticket_promedio": _soles(total / datos["n"]) if datos["n"] else _soles(0),
        "pedidos": Pedido.objects.filter(tienda=tienda, creado__date__range=(desde, hasta)).count(),
        "unidades": DetalleVenta.objects.filter(venta__in=ventas).aggregate(n=Sum("cantidad"))["n"] or 0,
    }


def panel_tienda(tienda, dias):
    hoy = timezone.localdate()
    desde = hoy - timedelta(days=dias - 1)
    actual = _indicadores(tienda, desde, hoy)
    anterior = _indicadores(tienda, desde - timedelta(days=dias), desde - timedelta(days=1))
    ventas = Venta.objects.filter(tienda=tienda, fecha__date__range=(desde, hoy))

    por_dia_db = dict(
        ventas.annotate(dia=TruncDate("fecha")).values_list("dia").annotate(s=Sum("total"))
    )
    por_dia = [
        {"fecha": desde + timedelta(days=i), "total": _soles(por_dia_db.get(desde + timedelta(days=i)))}
        for i in range(dias)
    ]

    top = list(
        DetalleVenta.objects.filter(venta__in=ventas)
        .values("producto", nombre=F("producto__nombre"), marca=F("producto__marca"))
        .annotate(
            unidades=Sum("cantidad"),
            total=Sum(F("cantidad") * F("precio_unitario"), output_field=DecimalField(max_digits=12, decimal_places=2)),
        )
        .order_by("-unidades", "-total")[:5]
    )
    for fila in top:
        fila["total"] = _soles(fila["total"])
        fila["porcentaje"] = round(fila["unidades"] / actual["unidades"] * 100, 1) if actual["unidades"] else 0

    vendedores = [
        {"vendedor": f["vendedor__nombre"], "total": _soles(f["s"])}
        for f in ventas.values("vendedor__nombre").annotate(s=Sum("total")).order_by("-s")[:6]
    ]

    # Las metas diaria y semanal salen de la meta mensual de la tienda.
    meta_diaria = _soles(tienda.meta_mensual / monthrange(hoy.year, hoy.month)[1])
    meta_semanal = _soles(meta_diaria * 7)
    venta_hoy = _soles(Venta.objects.filter(tienda=tienda, fecha__date=hoy).aggregate(s=Sum("total"))["s"])
    venta_semana = _soles(
        Venta.objects.filter(tienda=tienda, fecha__date__gte=hoy - timedelta(days=6)).aggregate(s=Sum("total"))["s"]
    )

    return {
        "dias": dias,
        "resumen": actual,
        "variacion": {clave: _variacion(actual[clave], anterior[clave]) for clave in actual},
        "por_dia": por_dia,
        "top_productos": top,
        "vendedores": vendedores,
        "metas": [
            {"nombre": "diaria", "meta": meta_diaria, "actual": venta_hoy, "cumplida": venta_hoy >= meta_diaria},
            {"nombre": "semanal", "meta": meta_semanal, "actual": venta_semana, "cumplida": venta_semana >= meta_semanal},
        ],
    }
