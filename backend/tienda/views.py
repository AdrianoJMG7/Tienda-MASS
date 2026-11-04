from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from usuarios.models import Rol
from usuarios.permisos import LecturaPublicaEscrituraAdmin

from .models import Tienda
from .serializers import TiendaSerializer


class NoPagination(PageNumberPagination):
    page_size = None


class TiendaViewSet(viewsets.ModelViewSet):
    """Gestión de tiendas.

    El público y los clientes solo ven las tiendas activas: son los puntos de recojo (HU07).
    El administrador ve todas y es el único que las registra o edita.
    """

    serializer_class = TiendaSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    pagination_class = NoPagination

    def get_queryset(self):
        usuario = self.request.user
        if usuario.is_authenticated and usuario.rol == Rol.ADMIN:
            return Tienda.objects.annotate(
                vendedores_activos=Count("vendedores", filter=Q(vendedores__is_active=True))
            )
        return Tienda.objects.filter(activa=True)
