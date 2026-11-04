"""Devoluciones de ventas y cierre del turno de caja."""

from datetime import datetime, time
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from choices import MedioPago
from inventario import servicios as inventario

from .models import CierreCaja, DetalleVenta, Devolucion, MotivoDevolucion, TipoReembolso, Venta

# Lo dañado o vencido no se puede volver a vender: no regresa al stock.
MOTIVOS_SIN_REINGRESO = (MotivoDevolucion.DANADO, MotivoDevolucion.VENCIDO)


@transaction.atomic
def devolver(venta, detalle_id, cantidad, motivo, tipo_reembolso, vendedor):
    """Registra la devolución de unidades de una venta y, si se pueden revender, las regresa al stock."""
    # Se bloquea la línea para que dos devoluciones simultáneas no superen lo vendido.
    detalle = (
        DetalleVenta.objects.select_for_update().select_related("producto").filter(venta=venta, pk=detalle_id).first()
    )
    if detalle is None:
        raise ValidationError({"detalle": "Ese producto no pertenece a esta venta."})
    if cantidad > detalle.disponible_devolver:
        raise ValidationError({"cantidad": f"Solo se pueden devolver {detalle.disponible_devolver} unidades de este producto."})

    devolucion = Devolucion.objects.create(
        venta=venta, detalle=detalle, cantidad=cantidad, motivo=motivo, tipo_reembolso=tipo_reembolso,
        monto=detalle.precio_unitario * cantidad, vendedor=vendedor,
    )
    if motivo not in MOTIVOS_SIN_REINGRESO:
        inventario.registrar_ingreso(
            venta.tienda, [(detalle.producto, cantidad)], usuario=vendedor, motivo=f"Devolución {venta.numero_ticket}"[:120]
        )
    return devolucion


def _inicio_turno(vendedor, ahora):
    """El turno empieza con el día o tras el último cierre del vendedor, lo que haya pasado después."""
    inicio_dia = timezone.make_aware(datetime.combine(timezone.localtime(ahora).date(), time.min))
    ultimo = CierreCaja.objects.filter(vendedor=vendedor, tienda=vendedor.tienda).first()
    return max(inicio_dia, ultimo.fin) if ultimo else inicio_dia


def _variacion(actual, anterior):
    """Variación porcentual contra el valor anterior; None si no hay con qué comparar."""
    return round((float(actual) - float(anterior)) / float(anterior) * 100) if anterior else None


def resumen_turno(vendedor):
    """Lo vendido por el vendedor en su turno actual y el efectivo que debería haber en caja."""
    ahora = timezone.now()
    inicio = _inicio_turno(vendedor, ahora)
    ventas = Venta.objects.filter(vendedor=vendedor, tienda=vendedor.tienda, fecha__gte=inicio, fecha__lte=ahora)
    datos = ventas.aggregate(suma=Sum("total"), n=Count("id"))
    total = datos["suma"] or Decimal("0")
    unidades = DetalleVenta.objects.filter(venta__in=ventas).aggregate(n=Sum("cantidad"))["n"] or 0

    por_medio = dict(ventas.values_list("medio_pago").annotate(s=Sum("total")))
    medios = [
        {
            "medio": m.value,
            "medio_display": m.label,
            "total": por_medio.get(m.value, Decimal("0")).quantize(Decimal("0.01")),
            "porcentaje": round(float(por_medio.get(m.value, 0)) / float(total) * 100) if total else 0,
        }
        for m in MedioPago
    ]
    devuelto = Devolucion.objects.filter(
        vendedor=vendedor, venta__tienda=vendedor.tienda, fecha__gte=inicio, tipo_reembolso=TipoReembolso.EFECTIVO
    ).aggregate(s=Sum("monto"))["s"] or Decimal("0")
    efectivo = por_medio.get(MedioPago.EFECTIVO, Decimal("0"))
    mayor = ventas.order_by("-total", "-fecha").first()
    anterior = CierreCaja.objects.filter(vendedor=vendedor, tienda=vendedor.tienda).first()

    return {
        "inicio": inicio,
        "fin": ahora,
        "ventas": datos["n"],
        "unidades": unidades,
        "total": total.quantize(Decimal("0.01")),
        "ticket_mas_alto": mayor.total if mayor else None,
        "ticket_mas_alto_numero": mayor.numero_ticket if mayor else None,
        "medios": medios,
        "ventas_efectivo": efectivo.quantize(Decimal("0.01")),
        "devoluciones_efectivo": devuelto,
        "efectivo_esperado": (efectivo - devuelto).quantize(Decimal("0.01")),
        "variacion": {
            "total": _variacion(total, anterior.total) if anterior else None,
            "ventas": _variacion(datos["n"], anterior.ventas) if anterior else None,
            "unidades": _variacion(unidades, anterior.unidades) if anterior else None,
        },
    }


@transaction.atomic
def cerrar_caja(vendedor, efectivo_contado, notas=""):
    resumen = resumen_turno(vendedor)
    if resumen["ventas"] == 0:
        raise ValidationError({"detail": "No hay ventas en este turno: no hace falta cerrar la caja."})
    return CierreCaja.objects.create(
        tienda=vendedor.tienda, vendedor=vendedor, inicio=resumen["inicio"], fin=resumen["fin"],
        ventas=resumen["ventas"], unidades=resumen["unidades"], total=resumen["total"],
        efectivo_esperado=resumen["efectivo_esperado"], efectivo_contado=efectivo_contado,
        diferencia=efectivo_contado - resumen["efectivo_esperado"], notas=notas,
    )
