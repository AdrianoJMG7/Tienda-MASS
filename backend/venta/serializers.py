from rest_framework import serializers

from .models import DetalleVenta, Venta


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = DetalleVenta
        fields = ["id", "producto", "producto_nombre", "cantidad", "precio_unitario", "subtotal"]


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    vendedor_nombre = serializers.CharField(source="vendedor.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)

    class Meta:
        model = Venta
        fields = [
            "id",
            "tienda",
            "tienda_codigo",
            "vendedor",
            "vendedor_nombre",
            "fecha",
            "total",
            "medio_pago",
            "numero_ticket",
            "detalles",
        ]
        read_only_fields = ["fecha"]
