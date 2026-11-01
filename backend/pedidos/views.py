from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from core.choices import Rol
from core.permisos import EsCliente

from .models import Pedido
from .serializers import CrearPedidoSerializer, PedidoSerializer
from .servicios import crear_pedido


class PedidoViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """HU08: pedidos para recoger en tienda.

    Solo un cliente con sesión iniciada puede confirmar un pedido. El cliente ve solo los
    suyos; el vendedor, los de su tienda; el administrador, todos.
    """

    serializer_class = PedidoSerializer

    def get_permissions(self):
        if self.action == "create":
            return [EsCliente()]
        return super().get_permissions()

    def get_queryset(self):
        usuario = self.request.user
        consulta = Pedido.objects.select_related("tienda").prefetch_related("detalles__producto")
        if usuario.rol == Rol.CLIENTE:
            return consulta.filter(cliente=usuario)
        if usuario.rol == Rol.VENDEDOR:
            return consulta.filter(tienda_id=usuario.tienda_id)
        return consulta

    @extend_schema(request=CrearPedidoSerializer, responses={201: PedidoSerializer})
    def create(self, request):
        entrada = CrearPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        pedido = crear_pedido(request.user, datos["tienda"], datos["items"], datos["medio_pago"])
        pedido = self.get_queryset().get(pk=pedido.pk)
        return Response(self.get_serializer(pedido).data, status=status.HTTP_201_CREATED)
