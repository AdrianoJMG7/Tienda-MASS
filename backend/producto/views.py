from rest_framework import permissions, viewsets

from .models import Producto
from .serializers import ProductoSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    """Gestión de productos."""

    serializer_class = ProductoSerializer
    queryset = Producto.objects.select_related("categoria")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
