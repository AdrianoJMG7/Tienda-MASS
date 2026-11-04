from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.db.models import DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from usuarios.models import Rol
from usuarios.permisos import EsVendedor
from . import caja, servicios
from .models import CierreCaja, Venta
from .serializers import (
    CerrarCajaSerializer,
    CierreCajaSerializer,
    CrearVentaSerializer,
    DevolverSerializer,
    VentaSerializer,
)

CERO = Value(Decimal("0"), output_field=DecimalField(max_digits=12, decimal_places=2))
MAX_FILAS_EXPORTAR = 5000


def _suma(ventas):
    return ventas.aggregate(s=Sum("total"))["s"] or Decimal("0")


def _variacion(actual, anterior):
    return round((float(actual) - float(anterior)) / float(anterior) * 100) if anterior else None


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Número de ticket o nombre del cliente"),
        OpenApiParameter("desde", OpenApiTypes.DATE),
        OpenApiParameter("hasta", OpenApiTypes.DATE),
        OpenApiParameter("estado", str, enum=["completada", "devolucion_parcial", "devuelta"]),
    ]
)
class VentaViewSet(viewsets.ModelViewSet):
    """HU12: ventas de la tienda. Una venta no se edita ni se borra: se corrige con una devolución."""

    serializer_class = VentaSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action in ("crear", "resumen", "exportar", "devolver"):
            return [EsVendedor()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Venta.objects.select_related("vendedor", "tienda", "pedido__cliente").prefetch_related(
            "detalles__producto", "detalles__devoluciones"
        )

        if user.rol == Rol.VENDEDOR:
            queryset = queryset.filter(tienda=user.tienda)
        elif user.rol != Rol.ADMIN:
            return queryset.none()

        if self.action in ("list", "exportar"):
            queryset = self._filtrar(queryset)
        return queryset

    def _filtrar(self, queryset):
        p = self.request.query_params
        if q := p.get("q", "").strip():
            queryset = queryset.filter(Q(numero_ticket__icontains=q) | Q(pedido__cliente__nombre__icontains=q))
        if desde := p.get("desde"):
            queryset = queryset.filter(fecha__date__gte=desde)
        if hasta := p.get("hasta"):
            queryset = queryset.filter(fecha__date__lte=hasta)
        if estado := p.get("estado"):
            queryset = queryset.annotate(devuelto_total=Coalesce(Sum("devoluciones__monto"), CERO))
            if estado == "completada":
                queryset = queryset.filter(devuelto_total=0)
            elif estado == "devolucion_parcial":
                queryset = queryset.filter(devuelto_total__gt=0, devuelto_total__lt=F("total"))
            elif estado == "devuelta":
                queryset = queryset.filter(devuelto_total__gte=F("total"))
        return queryset

    @extend_schema(request=CrearVentaSerializer, responses={201: VentaSerializer})
    @action(detail=False, methods=["post"])
    def crear(self, request):
        """HU12: registrar una venta en caja con descuento de stock."""
        entrada = CrearVentaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        # La tienda del vendedor se obtiene del usuario autenticado
        tienda = request.user.tienda
        if not tienda:
            return Response({"detail": "El vendedor no tiene una tienda asignada."}, status=status.HTTP_400_BAD_REQUEST)

        venta = servicios.crear_venta(
            request.user,
            tienda,
            datos["items"],
            datos["medio_pago"],
            datos.get("monto_recibido"),
        )
        return Response(self.get_serializer(venta).data, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def resumen(self, request):
        """Ventas de hoy, de la semana y del mes de la tienda, comparadas con el periodo anterior."""
        tienda = request.user.tienda
        ventas = Venta.objects.filter(tienda=tienda)
        ahora = timezone.localtime()
        hoy = ahora.date()
        inicio_semana = hoy - timedelta(days=hoy.weekday())
        inicio_mes = hoy.replace(day=1)
        total_hoy = _suma(ventas.filter(fecha__date=hoy))
        total_semana = _suma(ventas.filter(fecha__date__gte=inicio_semana))
        total_mes = _suma(ventas.filter(fecha__date__gte=inicio_mes))
        # La semana pasada se compara hasta el mismo día, para no castigar a la semana en curso.
        semana_pasada = _suma(
            ventas.filter(
                fecha__date__gte=inicio_semana - timedelta(days=7), fecha__date__lte=hoy - timedelta(days=7)
            )
        )
        return Response({
            "hoy": total_hoy,
            "hoy_variacion": _variacion(total_hoy, _suma(ventas.filter(fecha__date=hoy - timedelta(days=1)))),
            "semana": total_semana,
            "semana_variacion": _variacion(total_semana, semana_pasada),
            "mes": total_mes,
            "meta_mensual": tienda.meta_mensual,
        })

    @action(detail=False)
    def exportar(self, request):
        """Descarga en Excel las ventas con los filtros aplicados."""
        libro = Workbook()
        hoja = libro.active
        hoja.title = "Ventas"
        hoja.append(["Fecha y hora", "Ticket", "Canal", "Cliente", "Unidades", "Total (S/)", "Medio de pago", "Estado"])
        for celda in hoja[1]:
            celda.font = Font(bold=True, color="FFFFFF")
            celda.fill = PatternFill("solid", fgColor="092DB5")
        for venta in self.get_queryset()[:MAX_FILAS_EXPORTAR]:
            hoja.append([
                timezone.localtime(venta.fecha).strftime("%d/%m/%Y %H:%M"),
                venta.numero_ticket,
                venta.get_canal_display(),
                venta.pedido.cliente.nombre if venta.pedido_id else "Cliente en tienda",
                sum(d.cantidad for d in venta.detalles.all()),
                venta.total,
                venta.get_medio_pago_display(),
                VentaSerializer().get_estado_display(venta),
            ])
        for columna, ancho in zip("ABCDEFGH", (18, 22, 8, 26, 10, 12, 16, 20)):
            hoja.column_dimensions[columna].width = ancho
        salida = BytesIO()
        libro.save(salida)
        respuesta = HttpResponse(
            salida.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        respuesta["Content-Disposition"] = f'attachment; filename="ventas-{request.user.tienda.codigo}.xlsx"'
        return respuesta

    @extend_schema(request=DevolverSerializer, responses={201: VentaSerializer})
    @action(detail=True, methods=["post"])
    def devolver(self, request, pk=None):
        """Registra la devolución de unidades de una venta de la tienda."""
        venta = self.get_object()
        entrada = DevolverSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        caja.devolver(venta, vendedor=request.user, detalle_id=entrada.validated_data["detalle"], **{
            k: entrada.validated_data[k] for k in ("cantidad", "motivo", "tipo_reembolso")
        })
        venta = self.get_queryset().get(pk=venta.pk)
        return Response(self.get_serializer(venta).data, status=status.HTTP_201_CREATED)


class CierreCajaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Cierre de caja: el vendedor revisa su turno y lo cierra con el efectivo contado."""

    serializer_class = CierreCajaSerializer
    permission_classes = [EsVendedor]

    def get_queryset(self):
        return CierreCaja.objects.filter(vendedor=self.request.user, tienda=self.request.user.tienda)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False)
    def turno(self, request):
        return Response(caja.resumen_turno(request.user))

    @extend_schema(request=CerrarCajaSerializer, responses={201: CierreCajaSerializer})
    def create(self, request):
        entrada = CerrarCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        cierre = caja.cerrar_caja(request.user, **entrada.validated_data)
        return Response(self.get_serializer(cierre).data, status=status.HTTP_201_CREATED)
