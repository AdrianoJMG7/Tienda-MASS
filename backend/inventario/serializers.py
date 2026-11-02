from rest_framework import serializers

from .models import MovimientoStock, Stock


class StockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id",
            "tienda",
            "producto",
            "cantidad",
            "reservado",
            "stock_minimo",
            "fecha_vencimiento",
            "producto_nombre",
            "tienda_codigo",
        ]
        # Lo reservado solo cambia con los pedidos (HU09), nunca a mano.
        read_only_fields = ["reservado"]


class MovimientoStockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)
    usuario_nombre = serializers.CharField(source="usuario.nombre", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = MovimientoStock
        fields = [
            "id",
            "tienda",
            "producto",
            "tipo",
            "tipo_display",
            "cantidad",
            "motivo",
            "referencia",
            "usuario",
            "usuario_nombre",
            "fecha",
            "producto_nombre",
            "tienda_codigo",
        ]
        read_only_fields = ["tienda", "usuario", "fecha"]


class IngresoSerializer(serializers.Serializer):
    producto = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)
    motivo = serializers.CharField(required=False, allow_blank=True, max_length=120)


class MermaSerializer(serializers.Serializer):
    producto = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.ChoiceField(choices=[("vencido", "Vencido"), ("dañado", "Dañado")])
    nota = serializers.CharField(required=False, allow_blank=True, max_length=120)
