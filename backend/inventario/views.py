from django.db.models import F, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import MovimientoStock, Stock
from .serializers import IngresoSerializer, MermaSerializer, MovimientoStockSerializer, StockSerializer
from .servicios import registrar_ingreso, registrar_merma


class StockViewSet(viewsets.ModelViewSet):
    """Gestión de stock por tienda."""

    serializer_class = StockSerializer
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
