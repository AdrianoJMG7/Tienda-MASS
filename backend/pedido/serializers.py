from rest_framework import serializers

from .models import DetallePedido, Pedido


class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = DetallePedido
        fields = ["id", "producto", "producto_nombre", "cantidad", "precio_unitario", "subtotal"]


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "tienda",
            "tienda_codigo",
            "estado",
            "codigo_recojo",
            "medio_pago",
            "total",
            "creado",
            "vence_en",
            "detalles",
        ]
        read_only_fields = ["creado"]
