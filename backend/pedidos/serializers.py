from rest_framework import serializers

from core.choices import MedioPago
from tiendas.models import Tienda
from tiendas.serializers import TiendaSerializer

from .models import DetallePedido, Pedido


class ItemPedidoSerializer(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=99)


class CrearPedidoSerializer(serializers.Serializer):
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
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)
    detalles = DetallePedidoSerializer(many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "codigo_recojo",
            "estado",
            "estado_display",
            "tienda",
            "medio_pago",
            "medio_pago_display",
            "total",
            "creado",
            "vence_en",
            "detalles",
        ]
