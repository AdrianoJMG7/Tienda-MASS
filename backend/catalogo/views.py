from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.choices import Rol
from core.permisos import EsAdmin, LecturaPublicaEscrituraAdmin
from inventario.models import StockTienda

from .models import Categoria, HistorialPrecio, Oferta, Producto
from .serializers import CategoriaSerializer, HistorialPrecioSerializer, OfertaSerializer, ProductoSerializer


def _decimal(valor):
    try:
        return Decimal(valor)
    except (InvalidOperation, TypeError):
        return None


def _es_admin(usuario):
    return usuario.is_authenticated and usuario.rol == Rol.ADMIN


class CategoriaViewSet(viewsets.ModelViewSet):
    serializer_class = CategoriaSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    pagination_class = None

    def get_queryset(self):
        if _es_admin(self.request.user):
            return Categoria.objects.annotate(total_productos=Count("productos"))
        return Categoria.objects.all()

    def perform_destroy(self, instancia):
        if instancia.productos.exists():
            raise ValidationError({"detail": "No se puede eliminar: la categoría tiene productos."})
        instancia.delete()


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Nombre, marca o código de barras"),
        OpenApiParameter("categoria", int),
        OpenApiParameter("marca_propia", bool),
        OpenApiParameter("en_oferta", bool),
        OpenApiParameter("precio_min", float),
        OpenApiParameter("precio_max", float),
        OpenApiParameter("estado", str, enum=["activos", "inactivos", "todos"], description="Solo administrador"),
        OpenApiParameter("orden", str, enum=["nombre", "precio", "-precio", "-actualizado"]),
        OpenApiParameter("tienda", int, description="Agrega `disponible`: unidades en esa tienda"),
        OpenApiParameter("con_stock", bool, description="Con ?tienda: solo productos disponibles"),
        OpenApiParameter("ids", str, description="Ids separados por coma (para refrescar el carrito)"),
    ]
)
class ProductoViewSet(viewsets.ModelViewSet):
    """HU05: catálogo central de productos.

    Cualquiera puede consultarlo; solo el administrador crea y edita. Los productos no se
    eliminan: se desactivan con {"activo": false}. Cada cambio de precio queda registrado.
    """

    serializer_class = ProductoSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        p = self.request.query_params
        consulta = Producto.objects.select_related("categoria").con_precio_vigente()

        estado = p.get("estado", "activos") if _es_admin(self.request.user) else "activos"
        if estado == "activos":
            consulta = consulta.filter(activo=True)
        elif estado == "inactivos":
            consulta = consulta.filter(activo=False)

        if q := p.get("q", "").strip():
            consulta = consulta.filter(Q(nombre__icontains=q) | Q(marca__icontains=q) | Q(codigo_barras=q))
        if (categoria := p.get("categoria", "")).isdigit():
            consulta = consulta.filter(categoria_id=categoria)
        if p.get("marca_propia") in ("1", "true"):
            consulta = consulta.filter(marca_propia=True)
        if p.get("en_oferta") in ("1", "true"):
            consulta = consulta.filter(precio_oferta__isnull=False)
        if (minimo := _decimal(p.get("precio_min"))) is not None:
            consulta = consulta.filter(precio_final__gte=minimo)
        if (maximo := _decimal(p.get("precio_max"))) is not None:
            consulta = consulta.filter(precio_final__lte=maximo)
        if ids := p.get("ids"):
            consulta = consulta.filter(id__in=[i for i in ids.split(",") if i.isdigit()][:100])

        # HU06: disponibilidad en la tienda que eligió el cliente.
        if (tienda := p.get("tienda", "")).isdigit():
            stock = StockTienda.objects.filter(producto=OuterRef("pk"), tienda_id=tienda)
            consulta = consulta.annotate(disponible=Coalesce(Subquery(stock.values("disponible")[:1]), 0))
            if p.get("con_stock") in ("1", "true"):
                consulta = consulta.filter(disponible__gt=0)

        orden ={"precio": "precio_final", "-precio": "-precio_final", "-actualizado": "-actualizado"}
        return consulta.order_by(orden.get(p.get("orden"), "nombre"), "id")

    @transaction.atomic
    def perform_update(self, serializer):
        anterior = serializer.instance.precio
        producto = serializer.save()
        # Hay un solo precio por producto: el cambio rige en la web y en todas las tiendas.
        if producto.precio != anterior:
            HistorialPrecio.objects.create(
                producto=producto, precio_anterior=anterior, precio_nuevo=producto.precio, usuario=self.request.user
            )

    @action(detail=True, permission_classes=[EsAdmin])
    def historial(self, request, pk=None):
        """Historial de cambios de precio del producto, con fecha y usuario."""
        producto = self.get_object()
        registros = producto.historial_precios.select_related("usuario")
        return Response(HistorialPrecioSerializer(registros, many=True).data)


@extend_schema(
    parameters=[
        OpenApiParameter("producto", int),
        OpenApiParameter("estado", str, enum=["vigente", "programada", "vencida"]),
        OpenApiParameter("q", str),
    ]
)
class OfertaViewSet(viewsets.ModelViewSet):
    serializer_class = OfertaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        p = self.request.query_params
        hoy = timezone.localdate()
        consulta = Oferta.objects.select_related("producto")
        if producto := p.get("producto"):
            consulta = consulta.filter(producto_id=producto)
        if q := p.get("q", "").strip():
            consulta = consulta.filter(Q(producto__nombre__icontains=q) | Q(producto__marca__icontains=q))
        estado = p.get("estado")
        if estado == "vigente":
            consulta = consulta.filter(inicio__lte=hoy, fin__gte=hoy)
        elif estado == "programada":
            consulta = consulta.filter(inicio__gt=hoy)
        elif estado == "vencida":
            consulta = consulta.filter(fin__lt=hoy)
        return consulta

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)
