from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from choices import EstadoPedido
from usuarios.models import Rol
from usuarios.permisos import EsCliente, EsVendedor

from . import servicios
from .models import CanceladoPor, Pedido
from .serializers import CancelarSerializer, CrearPedidoSerializer, EntregarSerializer, PedidoSerializer


@extend_schema(
    parameters=[
        OpenApiParameter("estado", str, enum=[e.value for e in EstadoPedido]),
        OpenApiParameter("q", str, description="Número de pedido o nombre del cliente"),
    ]
)
class PedidoViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """HU08 a HU10: pedidos para recoger en tienda.

    Solo un cliente con sesión confirma pedidos. El cliente ve solo los suyos; el vendedor,
    los de su tienda, y es quien los prepara, entrega o cancela; el administrador ve todos.
    """

    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == "create":
            return [EsCliente()]
        if self.action in ("preparar", "listo", "entregar", "cancelar", "conteos"):
            return [EsVendedor()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Pedido.objects.select_related("cliente", "tienda", "venta").prefetch_related("detalles__producto")

        if user.rol == Rol.CLIENTE:
            queryset = queryset.filter(cliente=user)
        elif user.rol == Rol.VENDEDOR:
            queryset = queryset.filter(tienda=user.tienda)
        elif user.rol != Rol.ADMIN:
            return queryset.none()

        if self.action == "list":
            p = self.request.query_params
            if estado := p.get("estado"):
                queryset = queryset.filter(estado=estado)
            if q := p.get("q", "").strip().lstrip("#"):
                queryset = queryset.filter(id=q) if q.isdigit() else queryset.filter(cliente__nombre__icontains=q)
            # Los pedidos activos se atienden por orden de llegada.
            if estado in (EstadoPedido.RECIBIDO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO):
                queryset = queryset.order_by("creado")
        return queryset

    def _responder(self, pedido):
        return Response(self.get_serializer(self.get_queryset().get(pk=pedido.pk)).data)

    @extend_schema(request=CrearPedidoSerializer, responses={201: PedidoSerializer})
    def create(self, request):
        entrada = CrearPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        pedido = servicios.crear_pedido(request.user, datos["tienda"], datos["items"], datos["medio_pago"])
        pedido = self.get_queryset().get(pk=pedido.pk)
        return Response(self.get_serializer(pedido).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: PedidoSerializer})
    @action(detail=True, methods=["post"])
    def preparar(self, request, pk=None):
        """HU10: empezar a preparar un pedido recibido."""
        return self._responder(servicios.preparar(self.get_object(), request.user))

    @extend_schema(request=None, responses={200: PedidoSerializer})
    @action(detail=True, methods=["post"])
    def listo(self, request, pk=None):
        """HU10: marcar como listo para recoger; avisa al cliente por correo."""
        return self._responder(servicios.marcar_listo(self.get_object(), request.user))

    @extend_schema(request=EntregarSerializer, responses={200: PedidoSerializer})
    @action(detail=True, methods=["post"])
    def entregar(self, request, pk=None):
        """HU10: entregar validando el código de recojo y registrando el medio de pago."""
        entrada = EntregarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        return self._responder(servicios.entregar(self.get_object(), request.user, datos["codigo"], datos["medio_pago"]))

    @extend_schema(request=CancelarSerializer, responses={200: PedidoSerializer})
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        """HU10: cancelar indicando el motivo; libera el stock reservado (HU09)."""
        entrada = CancelarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        pedido = servicios.cancelar(
            self.get_object(), CanceladoPor.VENDEDOR, entrada.validated_data["motivo"], usuario=request.user
        )
        return self._responder(pedido)

    @action(detail=False)
    def conteos(self, request):
        """HU10: cuántos pedidos hay en cada estado en la tienda del vendedor."""
        filas = Pedido.objects.filter(tienda=request.user.tienda).values("estado").annotate(total=Count("id"))
        conteos = {estado.value: 0 for estado in EstadoPedido}
        conteos.update({fila["estado"]: fila["total"] for fila in filas})
        return Response(conteos)
