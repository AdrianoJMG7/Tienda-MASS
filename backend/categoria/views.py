from django.db.models import Count
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from usuarios.models import Rol
from usuarios.permisos import LecturaPublicaEscrituraAdmin

from .models import Categoria
from .serializers import CategoriaSerializer


class NoPagination(PageNumberPagination):
    page_size = None


class CategoriaViewSet(viewsets.ModelViewSet):
    """Gestión de categorías: lectura pública, escritura solo del administrador."""

    serializer_class = CategoriaSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    pagination_class = NoPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        usuario = self.request.user
        if usuario.is_authenticated and usuario.rol == Rol.ADMIN:
            return Categoria.objects.annotate(total_productos=Count("productos"))
        return Categoria.objects.filter(activa=True)

    def perform_destroy(self, instancia):
        if instancia.productos.exists():
            raise ValidationError({"detail": "No se puede eliminar: la categoría tiene productos."})
        instancia.delete()
