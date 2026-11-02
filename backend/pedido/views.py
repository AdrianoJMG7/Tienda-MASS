from rest_framework import permissions, viewsets

from usuarios.models import Usuario
from .models import Pedido
from .serializers import PedidoSerializer


class PedidoViewSet(viewsets.ModelViewSet):
    """Gestión de pedidos online."""

    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Pedido.objects.select_related("cliente", "tienda").prefetch_related("detalles__producto")

        if user.rol == Usuario.CLIENTE:
            return queryset.filter(cliente=user)
        elif user.rol == Usuario.VENDEDOR:
            return queryset.filter(tienda=user.tienda)
        elif user.rol == Usuario.ADMIN:
            return queryset
        return queryset.none()
