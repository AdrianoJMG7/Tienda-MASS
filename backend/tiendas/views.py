from django.db.models import Count, Q
from rest_framework import viewsets

from core.choices import Rol
from core.permisos import LecturaPublicaEscrituraAdmin

from .models import Tienda
from .serializers import TiendaSerializer


class TiendaViewSet(viewsets.ModelViewSet):
    """HU04: tiendas de la cadena.

    El público y los clientes solo ven las tiendas activas: son los puntos de recojo.
    El administrador ve todas y las registra o edita. No se eliminan: se desactivan con
    PATCH {"activa": false} para conservar su historial.
    """

    serializer_class = TiendaSerializer
    permission_classes = [LecturaPublicaEscrituraAdmin]
    pagination_class = None
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        usuario = self.request.user
        if usuario.is_authenticated and usuario.rol == Rol.ADMIN:
            return Tienda.objects.annotate(
                vendedores_activos=Count("vendedores", filter=Q(vendedores__is_active=True))
            )
        return Tienda.objects.filter(activa=True)
