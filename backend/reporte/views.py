from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.permisos import EsAdmin, EsVendedor

from . import exportar, servicios
from .tienda import panel_tienda
from .serializers import ExportarSerializer, FiltrosReporteSerializer, PruebaUsabilidadSerializer

PARAMETROS = [
    OpenApiParameter("desde", OpenApiTypes.DATE, description="Inicio del periodo (por defecto, hace 30 días)"),
    OpenApiParameter("hasta", OpenApiTypes.DATE, description="Fin del periodo (por defecto, hoy)"),
    OpenApiParameter("tienda", int, description="Id de la tienda; sin él, todas"),
]

TIPOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


class PanelView(APIView):
    """HU16: panel de ventas y pedidos por tienda y canal (solo administrador)."""

    permission_classes = [EsAdmin]

    @extend_schema(parameters=PARAMETROS, responses=OpenApiTypes.OBJECT)
    def get(self, request):
        entrada = FiltrosReporteSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        return Response(servicios.panel(entrada.validated_data))


class ExportarView(APIView):
    """HU17: descarga el panel en Excel o PDF con los mismos filtros."""

    permission_classes = [EsAdmin]

    @extend_schema(
        parameters=[*PARAMETROS, OpenApiParameter("formato", str, enum=list(TIPOS), required=True)],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        entrada = ExportarSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        filtros, formato = entrada.validated_data["filtros"], entrada.validated_data["formato"]
        datos = servicios.panel(filtros)
        contenido = exportar.a_excel(datos) if formato == "xlsx" else exportar.a_pdf(datos)

        nombre = f"reporte-mass-{filtros.desde:%Y%m%d}-{filtros.hasta:%Y%m%d}"
        if filtros.tienda:
            nombre += f"-{filtros.tienda.codigo}"
        respuesta = HttpResponse(contenido, content_type=TIPOS[formato])
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}.{formato}"'
        return respuesta


class UsabilidadView(APIView):
    """HU18: genera reporte PDF de pruebas de usabilidad."""

    permission_classes = [EsAdmin]

    @extend_schema(
        request=PruebaUsabilidadSerializer(many=True),
        responses={(200, "application/pdf"): OpenApiTypes.BINARY},
    )
    def post(self, request):
        entrada = PruebaUsabilidadSerializer(data=request.data, many=True)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        contenido = exportar.pdf_usabilidad(datos)

        respuesta = HttpResponse(contenido, content_type="application/pdf")
        respuesta["Content-Disposition"] = 'attachment; filename="reporte-usabilidad-mass.pdf"'
        return respuesta


class PanelTiendaView(APIView):
    """Reportes y rendimiento de la tienda del vendedor."""

    permission_classes = [EsVendedor]

    @extend_schema(parameters=[OpenApiParameter("dias", int, enum=[7, 30, 90])], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        dias = request.query_params.get("dias", "7")
        dias = int(dias) if dias in ("7", "30", "90") else 7
        return Response(panel_tienda(request.user.tienda, dias))
