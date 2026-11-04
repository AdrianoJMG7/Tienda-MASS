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


class StockPanelSerializer(serializers.ModelSerializer):
    """Fila de la tabla de inventario del vendedor."""

    nombre = serializers.CharField(source="producto.nombre", read_only=True)
    marca = serializers.CharField(source="producto.marca", read_only=True)
    codigo_barras = serializers.CharField(source="producto.codigo_barras", read_only=True)
    foto = serializers.ImageField(source="producto.foto", read_only=True)
    categoria = serializers.IntegerField(source="producto.categoria_id", read_only=True)
    categoria_nombre = serializers.CharField(source="producto.categoria.nombre", read_only=True)
    precio_final = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            "id", "producto", "nombre", "marca", "codigo_barras", "foto", "categoria", "categoria_nombre",
            "precio_final", "cantidad", "reservado", "stock_minimo", "fecha_vencimiento", "estado",
        ]

    def get_precio_final(self, stock):
        return stock.producto.precio_vigente()

    def get_estado(self, stock):
        if stock.cantidad == 0:
            return "agotado"
        return "bajo_stock" if stock.cantidad <= stock.stock_minimo else "disponible"


MOTIVOS_AUMENTO = {"reposicion": "Reposición de stock", "conteo": "Corrección por conteo"}
MOTIVOS_REDUCCION = {"vencido": "Vencido", "danado": "Dañado", "robo": "Robo", "conteo": "Corrección por conteo"}


class AjusteStockSerializer(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    nuevo_stock = serializers.IntegerField(min_value=0)
    motivo = serializers.ChoiceField(choices=[*MOTIVOS_AUMENTO.items(), *MOTIVOS_REDUCCION.items()])
    stock_minimo = serializers.IntegerField(min_value=0, required=False)
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)


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
