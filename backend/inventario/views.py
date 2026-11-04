from django.db.models import Count, F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from config.paginacion import Paginacion
from producto.models import Producto
from usuarios.permisos import EsAdmin, EsVendedor

from .models import MovimientoStock, Stock
from .serializers import (
    MOTIVOS_AUMENTO,
    MOTIVOS_REDUCCION,
    AjusteStockSerializer,
    IngresoSerializer,
    MermaSerializer,
    MovimientoStockSerializer,
    StockPanelSerializer,
    StockSerializer,
)
from .servicios import ajustar_stock, registrar_ingreso, registrar_merma


class StockViewSet(viewsets.ModelViewSet):
    """Gestión de stock de todas las tiendas: solo el administrador. El vendedor usa el inventario de su tienda."""

    serializer_class = StockSerializer
    permission_classes = [EsAdmin]
    queryset = Stock.objects.select_related("tienda", "producto").prefetch_related("producto")


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de movimientos de stock (solo lectura)."""

    serializer_class = MovimientoStockSerializer
    queryset = MovimientoStock.objects.select_related("tienda", "producto", "usuario")

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.is_staff:
            return queryset

        if hasattr(user, "tienda"):
            return queryset.filter(tienda=user.tienda)

        raise PermissionDenied("No tienes permiso para ver movimientos de stock.")


class InventarioViewSet(viewsets.ViewSet):
    """HU14: consulta de stock y alertas para vendedores."""

    def list(self, request):
        """Stock de la tienda del vendedor con alertas."""
        user = request.user

        if not (hasattr(user, "tienda") and user.rol == "vendedor"):
            raise PermissionDenied("Solo vendedores pueden ver el inventario.")

        tienda = user.tienda
        queryset = Stock.objects.filter(tienda=tienda).select_related("producto")

        # Filtros opcionales
        nombre = request.query_params.get("q")
        categoria = request.query_params.get("categoria")
        estado = request.query_params.get("estado")  # todos, bajo_stock, por_vencer

        if nombre:
            queryset = queryset.filter(producto__nombre__icontains=nombre)
        if categoria:
            queryset = queryset.filter(producto__categoria=categoria)

        hoy = timezone.now().date()
        en_7_dias = hoy + timezone.timedelta(days=7)

        if estado == "bajo_stock":
            queryset = queryset.filter(cantidad__lte=F("stock_minimo"))
        elif estado == "por_vencer":
            queryset = queryset.filter(fecha_vencimiento__isnull=False, fecha_vencimiento__lte=en_7_dias)

        serializer = StockSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def alertas(self, request):
        """HU14: alertas de stock bajo y vencimiento próximo."""
        user = request.user

        if not (hasattr(user, "tienda") and user.rol == "vendedor"):
            raise PermissionDenied("Solo vendedores pueden ver alertas.")

        tienda = user.tienda
        hoy = timezone.now().date()
        en_7_dias = hoy + timezone.timedelta(days=7)

        # Alertas de stock bajo
        bajo_stock = (
            Stock.objects.filter(tienda=tienda, cantidad__lte=F("stock_minimo"))
            .select_related("producto")
            .values(
                "producto",
                "producto__nombre",
                "cantidad",
                "stock_minimo",
            )
        )

        # Alertas de vencimiento próximo
        por_vencer = (
            Stock.objects.filter(tienda=tienda, fecha_vencimiento__isnull=False, fecha_vencimiento__lte=en_7_dias)
            .select_related("producto")
            .annotate(dias_para_vencer=F("fecha_vencimiento") - hoy)
            .values(
                "producto",
                "producto__nombre",
                "cantidad",
                "fecha_vencimiento",
                "dias_para_vencer",
            )
        )

        return Response(
            {
                "bajo_stock": list(bajo_stock),
                "por_vencer": list(por_vencer),
                "resumen": {
                    "bajo_stock_count": bajo_stock.count(),
                    "por_vencer_count": por_vencer.count(),
                },
            }
        )

    @action(detail=False, methods=["post"])
    def ingreso(self, request):
        """HU15: registrar ingreso de mercadería."""
        user = request.user

        if not (hasattr(user, "tienda") and user.rol == "vendedor"):
            raise PermissionDenied("Solo vendedores pueden registrar ingresos.")

        tienda = user.tienda

        serializer = IngresoSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        items = []
        fecha_vencimiento = None
        motivo = ""

        for item in serializer.validated_data:
            from producto.models import Producto

            producto = Producto.objects.get(id=item["producto"])
            items.append((producto, item["cantidad"]))
            if item.get("fecha_vencimiento"):
                fecha_vencimiento = item["fecha_vencimiento"]
            if item.get("motivo"):
                motivo = item["motivo"]

        try:
            registrar_ingreso(tienda, items, usuario=user, motivo=motivo, fecha_vencimiento=fecha_vencimiento)
            return Response({"mensaje": "Ingreso registrado correctamente"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def merma(self, request):
        """HU15: registrar merma de mercadería."""
        user = request.user

        if not (hasattr(user, "tienda") and user.rol == "vendedor"):
            raise PermissionDenied("Solo vendedores pueden registrar mermas.")

        tienda = user.tienda

        serializer = MermaSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        items = []
        motivo = ""

        for item in serializer.validated_data:
            from producto.models import Producto

            producto = Producto.objects.get(id=item["producto"])
            items.append((producto, item["cantidad"]))
            if item.get("motivo"):
                motivo = f"{item['motivo']}"
            if item.get("nota"):
                motivo += f" - {item['nota']}"

        try:
            registrar_merma(tienda, items, usuario=user, motivo=motivo)
            return Response({"mensaje": "Merma registrada correctamente"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _stock_tienda(self):
        return Stock.objects.filter(tienda=self.request.user.tienda).select_related("producto__categoria")

    @action(detail=False, permission_classes=[EsVendedor])
    def panel(self, request):
        """Tabla de inventario de la tienda, paginada, con cuántos productos tiene cada categoría."""
        p = request.query_params
        consulta = self._stock_tienda()
        if q := p.get("q", "").strip():
            consulta = consulta.filter(
                Q(producto__nombre__icontains=q) | Q(producto__marca__icontains=q) | Q(producto__codigo_barras=q)
            )
        estado = p.get("estado")
        if estado == "agotado":
            consulta = consulta.filter(cantidad=0)
        elif estado == "bajo_stock":
            consulta = consulta.filter(cantidad__gt=0, cantidad__lte=F("stock_minimo"))
        elif estado == "disponible":
            consulta = consulta.filter(cantidad__gt=F("stock_minimo"))
        elif estado == "por_vencer":
            limite = timezone.localdate() + timezone.timedelta(days=7)
            consulta = consulta.filter(fecha_vencimiento__isnull=False, fecha_vencimiento__lte=limite)

        categorias = list(
            consulta.values("producto__categoria", nombre=F("producto__categoria__nombre"))
            .annotate(productos=Count("id"))
            .order_by("nombre")
        )
        total = consulta.count()
        if (categoria := p.get("categoria", "")).isdigit():
            consulta = consulta.filter(producto__categoria_id=categoria)

        paginador = Paginacion()
        pagina = paginador.paginate_queryset(consulta.order_by("producto__nombre", "id"), request, view=self)
        respuesta = paginador.get_paginated_response(StockPanelSerializer(pagina, many=True, context={"request": request}).data)
        respuesta.data["total_tienda"] = total
        respuesta.data["categorias"] = [
            {"id": c["producto__categoria"], "nombre": c["nombre"], "productos": c["productos"]} for c in categorias
        ]
        return respuesta

    @action(detail=False, permission_classes=[EsVendedor])
    def consulta(self, request):
        """Escáner: datos del producto y su stock en la tienda, por código de barras o QR."""
        codigo = request.query_params.get("codigo", "").strip()
        producto = get_object_or_404(Producto.objects.filter(activo=True), codigo_barras=codigo)
        stock, _ = Stock.objects.get_or_create(tienda=request.user.tienda, producto=producto)
        return Response(StockPanelSerializer(stock, context={"request": request}).data)

    @action(detail=False, methods=["post"], permission_classes=[EsVendedor])
    def ajuste(self, request):
        """Actualizar stock: fija la cantidad contada; la diferencia queda registrada con su motivo."""
        entrada = AjusteStockSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        producto = get_object_or_404(Producto, pk=datos["producto"])
        tienda = request.user.tienda
        actual = Stock.objects.filter(tienda=tienda, producto=producto).values_list("cantidad", flat=True).first() or 0
        motivo = datos["motivo"]
        if datos["nuevo_stock"] > actual and motivo not in MOTIVOS_AUMENTO:
            return Response({"motivo": ["Ese motivo solo aplica cuando el stock baja."]}, status=status.HTTP_400_BAD_REQUEST)
        if datos["nuevo_stock"] < actual and motivo not in MOTIVOS_REDUCCION:
            return Response({"motivo": ["Ese motivo solo aplica cuando el stock sube."]}, status=status.HTTP_400_BAD_REQUEST)
        nombre = {**MOTIVOS_AUMENTO, **MOTIVOS_REDUCCION}[motivo]
        stock = ajustar_stock(
            tienda, producto, datos["nuevo_stock"], nombre, usuario=request.user,
            fecha_vencimiento=datos.get("fecha_vencimiento"), stock_minimo=datos.get("stock_minimo"),
        )
        stock = self._stock_tienda().get(pk=stock.pk)
        return Response(StockPanelSerializer(stock, context={"request": request}).data)
