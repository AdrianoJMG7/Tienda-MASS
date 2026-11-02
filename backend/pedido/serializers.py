from rest_framework import serializers

from choices import MedioPago
from tienda.models import Tienda
from tienda.serializers import TiendaSerializer

from .models import DetallePedido, Pedido


class ItemPedidoSerializer(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=99)


class CrearPedidoSerializer(serializers.Serializer):
    """Lo que envía el cliente al confirmar: el resto (código, precios, total) lo calcula el servidor."""

    tienda = serializers.PrimaryKeyRelatedField(queryset=Tienda.objects.all())
    medio_pago = serializers.ChoiceField(
        choices=MedioPago.choices, error_messages={"invalid_choice": "Elige efectivo, tarjeta o Yape/Plin."}
    )
    items = ItemPedidoSerializer(many=True, max_length=60)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Tu carrito está vacío.")
        return items


class DetallePedidoSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="producto.nombre", read_only=True)
    marca = serializers.CharField(source="producto.marca", read_only=True)
    foto = serializers.ImageField(source="producto.foto", read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = DetallePedido
        fields = ["producto", "nombre", "marca", "foto", "cantidad", "precio_unitario", "subtotal"]


class PedidoSerializer(serializers.ModelSerializer):
    tienda = TiendaSerializer(read_only=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    cliente_celular = serializers.CharField(source="cliente.celular", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)
    cancelado_por_display = serializers.CharField(source="get_cancelado_por_display", read_only=True)
    pagado_con = serializers.CharField(source="venta.get_medio_pago_display", read_only=True, default=None)
    detalles = DetallePedidoSerializer(many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "codigo_recojo",
            "estado",
            "estado_display",
            "cliente_nombre",
            "cliente_celular",
            "tienda",
            "medio_pago",
            "medio_pago_display",
            "pagado_con",
            "total",
            "creado",
            "vence_en",
            "preparado_en",
            "listo_en",
            "entregado_en",
            "cancelado_en",
            "cancelado_por",
            "cancelado_por_display",
            "motivo_cancelacion",
            "detalles",
        ]

    def to_representation(self, pedido):
        datos = super().to_representation(pedido)
        # El código de recojo es la "contraseña" del pedido: solo lo ve su cliente. Así, al
        # entregar, el vendedor valida el código que le dicta el cliente sin poder verlo antes.
        usuario = getattr(self.context.get("request"), "user", None)
        if not usuario or usuario.pk != pedido.cliente_id:
            datos.pop("codigo_recojo")
        return datos


class EntregarSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=6, help_text="Código de recojo que muestra el cliente")
    medio_pago = serializers.ChoiceField(
        choices=MedioPago.choices, error_messages={"invalid_choice": "Elige efectivo, tarjeta o Yape/Plin."}
    )


class CancelarSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, error_messages={"blank": "Indica el motivo de la cancelación."})

    def validate_motivo(self, valor):
        valor = valor.strip()
        if len(valor) < 3:
            raise serializers.ValidationError("Indica el motivo de la cancelación.")
        return valor
