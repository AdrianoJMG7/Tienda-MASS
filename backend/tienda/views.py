from rest_framework import permissions, viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Tienda
from .serializers import TiendaSerializer


class NoPagination(PageNumberPagination):
    page_size = None


class TiendaViewSet(viewsets.ModelViewSet):
    """Gestión de tiendas."""

    serializer_class = TiendaSerializer
    queryset = Tienda.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = NoPagination
