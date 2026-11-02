from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from usuarios.models import Rol
from usuarios.permisos import EsVendedor
from . import servicios
from .models import Venta
from .serializers import CrearVentaSerializer, VentaSerializer


class VentaViewSet(viewsets.ModelViewSet):
    """HU12: gestión de ventas en caja. Solo los vendedores pueden crear ventas."""

    serializer_class = VentaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == "crear":
            return [EsVendedor()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Venta.objects.select_related("vendedor", "tienda").prefetch_related("detalles__producto")

        if user.rol == Rol.VENDEDOR:
            return queryset.filter(tienda=user.tienda)
        elif user.rol == Rol.ADMIN:
            return queryset
        return queryset.none()

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
