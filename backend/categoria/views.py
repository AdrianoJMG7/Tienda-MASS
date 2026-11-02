from rest_framework import permissions, viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Categoria
from .serializers import CategoriaSerializer


class NoPagination(PageNumberPagination):
    page_size = None


class CategoriaViewSet(viewsets.ModelViewSet):
    """Gestión de categorías."""

    serializer_class = CategoriaSerializer
    queryset = Categoria.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = NoPagination
