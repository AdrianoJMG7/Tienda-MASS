from rest_framework import serializers

from .models import Stock


class StockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)

    class Meta:
        model = Stock
        fields = ["id", "tienda", "producto", "cantidad", "reservado", "producto_nombre", "tienda_codigo"]
        # Lo reservado solo cambia con los pedidos (HU09), nunca a mano.
        read_only_fields = ["reservado"]
