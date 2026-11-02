from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.response import Response

from usuarios.models import Rol
from usuarios.permisos import EsCliente

from .models import Pedido
from .serializers import CrearPedidoSerializer, PedidoSerializer
from .servicios import crear_pedido


class PedidoViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """HU08: pedidos para recoger en tienda.

    Solo un cliente con sesión iniciada confirma pedidos. El cliente ve solo los suyos;
    el vendedor, los de su tienda; el administrador, todos. Los cambios de estado
    (preparar, entregar, cancelar) llegan con las HU10 y HU11.
    """

    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == "create":
            return [EsCliente()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Pedido.objects.select_related("cliente", "tienda").prefetch_related("detalles__producto")

        if user.rol == Rol.CLIENTE:
            return queryset.filter(cliente=user)
        elif user.rol == Rol.VENDEDOR:
            return queryset.filter(tienda=user.tienda)
        elif user.rol == Rol.ADMIN:
            return queryset
        return queryset.none()

    @extend_schema(request=CrearPedidoSerializer, responses={201: PedidoSerializer})
    def create(self, request):
        entrada = CrearPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        pedido = crear_pedido(request.user, datos["tienda"], datos["items"], datos["medio_pago"])
        pedido = self.get_queryset().get(pk=pedido.pk)
        return Response(self.get_serializer(pedido).data, status=status.HTTP_201_CREATED)
