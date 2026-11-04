from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Case, Count, F, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from inventario.models import Stock
from usuarios.models import Rol
from usuarios.permisos import EsAdmin, EsCliente, LecturaPublicaEscrituraAdmin

from .models import Favorito, HistorialPrecio, Oferta, Producto
from .serializers import HistorialPrecioSerializer, OfertaSerializer, ProductoSerializer


def _decimal(valor):
    try:
        return Decimal(valor)
    except (InvalidOperation, TypeError):
        return None


def _es_admin(usuario):
    return usuario.is_authenticated and usuario.rol == Rol.ADMIN


def _con_stock_total(consulta, stock):
    """Solo administrador: suma el stock de todas las tiendas y permite filtrar por él."""
    suma = Stock.objects.filter(producto=OuterRef("pk")).order_by().values("producto").annotate(s=Sum("cantidad")).values("s")
    consulta = consulta.annotate(stock_total=Coalesce(Subquery(suma), 0))
    if stock == "con_stock":
        return consulta.filter(stock_total__gt=0)
    if stock == "sin_stock":
        return consulta.filter(stock_total=0)
    return consulta


def _con_disponible(consulta, params):
    """HU06: con ?tienda= agrega `disponible` (unidades en esa tienda); con ?con_stock, solo los que hay."""
    if (tienda := params.get("tienda", "")).isdigit():
        stock = Stock.objects.filter(producto=OuterRef("pk"), tienda_id=tienda)
        consulta = consulta.annotate(disponible=Coalesce(Subquery(stock.values("cantidad")[:1]), 0))
        if params.get("con_stock") in ("1", "true"):
            consulta = consulta.filter(disponible__gt=0)
    return consulta


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Nombre, marca o código de barras"),
        OpenApiParameter("categoria", int, many=True, description="Una o varias categorías"),
        OpenApiParameter("marca", str, many=True, description="Una o varias marcas"),
        OpenApiParameter("marca_propia", bool),
        OpenApiParameter("en_oferta", bool),
        OpenApiParameter("precio_min", float),
        OpenApiParameter("precio_max", float),
        OpenApiParameter("estado", str, enum=["activos", "inactivos", "todos"], description="Solo administrador"),
        OpenApiParameter("stock", str, enum=["con_stock", "sin_stock"], description="Solo administrador"),
        OpenApiParameter("orden", str, enum=["nombre", "relevancia", "precio", "-precio"]),
        OpenApiParameter("tienda", int, description="Agrega `disponible`: unidades en esa tienda"),
        OpenApiParameter("con_stock", bool, description="Con ?tienda: solo productos disponibles"),
        OpenApiParameter("ids", str, description="Ids separados por coma (para refrescar el carrito)"),
    ]
)
class ProductoViewSet(viewsets.ModelViewSet):
    """HU05 y HU06: catálogo central de productos.

    Cualquiera puede consultarlo; solo el administrador crea y edita. Los productos no se
    eliminan: se desactivan con {"activo": false}. Cada cambio de precio queda registrado.
    """

    serializer_class = ProductoSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def _filtrar(self, excluir=()):
        """Aplica los filtros de la búsqueda; `excluir` omite algunos para contar sus opciones (facetas)."""
        p = self.request.query_params
        consulta = Producto.objects.select_related("categoria").con_precio_vigente()

        es_admin = _es_admin(self.request.user)
        estado = p.get("estado", "activos") if es_admin else "activos"
        if estado == "activos":
            consulta = consulta.filter(activo=True)
        elif estado == "inactivos":
            consulta = consulta.filter(activo=False)

        if es_admin:
            consulta = _con_stock_total(consulta, p.get("stock"))
        else:
            # Una categoría desactivada oculta sus productos de la tienda y de la caja.
            consulta = consulta.filter(categoria__activa=True)

        if q := p.get("q", "").strip():
            consulta = consulta.filter(Q(nombre__icontains=q) | Q(marca__icontains=q) | Q(codigo_barras=q))
        categorias = [c for valor in p.getlist("categoria") for c in valor.split(",") if c.isdigit()]
        if categorias and "categoria" not in excluir:
            consulta = consulta.filter(categoria_id__in=categorias)
        marcas = [m.strip() for m in p.getlist("marca") if m.strip()]
        if marcas and "marca" not in excluir:
            consulta = consulta.filter(marca__in=marcas)
        if p.get("marca_propia") in ("1", "true"):
            consulta = consulta.filter(marca_propia=True)
        if p.get("en_oferta") in ("1", "true"):
            consulta = consulta.filter(precio_oferta__isnull=False)
        if "precio" not in excluir:
            if (minimo := _decimal(p.get("precio_min"))) is not None:
                consulta = consulta.filter(precio_final__gte=minimo)
            if (maximo := _decimal(p.get("precio_max"))) is not None:
                consulta = consulta.filter(precio_final__lte=maximo)
        if ids := p.get("ids"):
            consulta = consulta.filter(id__in=[i for i in ids.split(",") if i.isdigit()][:100])
        return _con_disponible(consulta, p)

    def get_queryset(self):
        consulta = self._filtrar()
        p = self.request.query_params
        orden = p.get("orden")
        if orden == "relevancia" and (q := p.get("q", "").strip()):
            # Primero los que empiezan con lo buscado ("leche" antes que "café con leche").
            consulta = consulta.annotate(relevancia=Case(When(nombre__istartswith=q, then=Value(0)), default=Value(1)))
            return consulta.order_by("relevancia", "nombre", "id")
        campos = {"precio": "precio_final", "-precio": "-precio_final"}
        return consulta.order_by(campos.get(orden, "nombre"), "id")

    @action(detail=False)
    def facetas(self, request):
        """Opciones de los filtros del catálogo con cuántos productos tiene cada una.

        Cada grupo se cuenta con los demás filtros aplicados pero no el suyo, para que se vea
        cuántos productos sumaría marcar otra categoría o marca.
        """
        categorias = (
            self._filtrar(excluir={"categoria"})
            .values("categoria", categoria_nombre=F("categoria__nombre"))
            .annotate(productos=Count("id"))
            .order_by("categoria_nombre")
        )
        marcas = (
            self._filtrar(excluir={"marca"})
            .values("marca")
            .annotate(productos=Count("id"))
            .order_by("-productos", "marca")[:12]
        )
        precios = self._filtrar(excluir={"precio"}).aggregate(
            menos_de_5=Count("id", filter=Q(precio_final__lt=5)),
            de_5_a_10=Count("id", filter=Q(precio_final__gte=5, precio_final__lte=10)),
            mas_de_10=Count("id", filter=Q(precio_final__gt=10)),
        )
        return Response({"categorias": list(categorias), "marcas": list(marcas), "precios": precios})

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
    """HU05: ofertas con precio especial y fechas de inicio y fin."""

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


class FavoritoEntradaSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))


@extend_schema(parameters=[OpenApiParameter("tienda", int, description="Agrega `disponible` en esa tienda")])
class FavoritoViewSet(viewsets.GenericViewSet):
    """Mis favoritos: se agregan con {"producto": id} y se quitan con DELETE /favoritos/<id del producto>/."""

    serializer_class = ProductoSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        guardado = Favorito.objects.filter(usuario=self.request.user, producto=OuterRef("pk")).values("creado")[:1]
        consulta = (
            Producto.objects.filter(activo=True, categoria__activa=True)
            .select_related("categoria")
            .con_precio_vigente()
            .annotate(guardado=Subquery(guardado))
            .filter(guardado__isnull=False)
        )
        return _con_disponible(consulta, self.request.query_params).order_by("-guardado", "id")

    def list(self, request):
        pagina = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(self.get_serializer(pagina, many=True).data)

    @extend_schema(request=FavoritoEntradaSerializer, responses={201: FavoritoEntradaSerializer})
    def create(self, request):
        entrada = FavoritoEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        Favorito.objects.get_or_create(usuario=request.user, producto=entrada.validated_data["producto"])
        return Response(entrada.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        get_object_or_404(Favorito, usuario=request.user, producto_id=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={200: {"type": "array", "items": {"type": "integer"}}})
    @action(detail=False)
    def ids(self, request):
        """Ids de los productos favoritos, para marcar los corazones del catálogo."""
        favoritos = request.user.favoritos.filter(producto__activo=True)
        return Response(list(favoritos.values_list("producto_id", flat=True)))
