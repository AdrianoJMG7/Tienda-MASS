from rest_framework import permissions, viewsets

from usuarios.models import Rol
from .models import Venta
from .serializers import VentaSerializer


class VentaViewSet(viewsets.ModelViewSet):
    """Gestión de ventas en caja."""

    serializer_class = VentaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Venta.objects.select_related("vendedor", "tienda").prefetch_related("detalles__producto")

        if user.rol == Rol.VENDEDOR:
            return queryset.filter(tienda=user.tienda)
        elif user.rol == Rol.ADMIN:
            return queryset
        return queryset.none()
