from decimal import Decimal

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from core.choices import Rol

from .models import Categoria, HistorialPrecio, Oferta, Producto

FOTO_MAX_BYTES = 2 * 1024 * 1024


class CategoriaSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(
        max_length=60,
        validators=[UniqueValidator(Categoria.objects.all(), message="Ya existe esa categoría.", lookup="iexact")],
    )
    total_productos = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Categoria
        fields = ["id", "nombre", "total_productos"]

    def to_representation(self, instancia):
        datos = super().to_representation(instancia)
        if not hasattr(instancia, "total_productos"):
            datos.pop("total_productos", None)
        return datos


class ProductoSerializer(serializers.ModelSerializer):
    codigo_barras = serializers.CharField(
        max_length=14,
        validators=[UniqueValidator(Producto.objects.all(), message="Ya existe un producto con este código.")],
    )
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    precio_oferta = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True)
    oferta_fin = serializers.DateField(read_only=True, allow_null=True)
    precio_final = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    quitar_foto = serializers.BooleanField(write_only=True, required=False)
    disponible = serializers.IntegerField(read_only=True, allow_null=True, help_text="Solo con ?tienda=")

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre",
            "marca",
            "codigo_barras",
            "foto",
            "quitar_foto",
            "categoria",
            "categoria_nombre",
            "costo",
            "precio",
            "precio_oferta",
            "oferta_fin",
            "precio_final",
            "marca_propia",
            "activo",
            "disponible",
        ]
        extra_kwargs = {
            "costo": {"min_value": Decimal("0")},
            "precio": {"min_value": Decimal("0.10")},
            "foto": {"required": False},
        }

    def validate_codigo_barras(self, valor):
        valor = valor.strip()
        if not valor.isdigit() or not 8 <= len(valor) <= 14:
            raise serializers.ValidationError("El código de barras debe tener entre 8 y 14 dígitos.")
        return valor

    def validate_foto(self, foto):
        if foto and foto.size > FOTO_MAX_BYTES:
            raise serializers.ValidationError("La foto no debe pesar más de 2 MB.")
        return foto

    def validate(self, attrs):
        costo = attrs.get("costo", getattr(self.instance, "costo", None))
        precio = attrs.get("precio", getattr(self.instance, "precio", None))
        if costo is not None and precio is not None and precio < costo:
            raise serializers.ValidationError({"precio": "El precio de venta no puede ser menor al costo."})
        return attrs

    def update(self, instancia, datos):
        if datos.pop("quitar_foto", False) and "foto" not in datos:
            instancia.foto.delete(save=False)
            datos["foto"] = ""
        return super().update(instancia, datos)

    def create(self, datos):
        datos.pop("quitar_foto", None)
        return super().create(datos)

    def to_representation(self, instancia):
        datos = super().to_representation(instancia)
        # El costo es información interna: solo lo ve el administrador.
        usuario = getattr(self.context.get("request"), "user", None)
        if not (usuario and usuario.is_authenticated and usuario.rol == Rol.ADMIN):
            datos.pop("costo", None)
        # Justo después de crear o editar, el objeto no trae los precios anotados.
        if datos.get("precio_final") is None:
            datos["precio_final"] = instancia.precio_vigente()
        if not hasattr(instancia, "disponible"):
            datos.pop("disponible", None)
        return datos


class OfertaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    producto_marca = serializers.CharField(source="producto.marca", read_only=True)
    precio_normal = serializers.DecimalField(
        source="producto.precio", max_digits=10, decimal_places=2, read_only=True
    )
    estado = serializers.CharField(read_only=True)

    class Meta:
        model = Oferta
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "producto_marca",
            "precio_normal",
            "precio_especial",
            "inicio",
            "fin",
            "estado",
        ]
        extra_kwargs = {"precio_especial": {"min_value": Decimal("0.10")}}

    def validate(self, attrs):
        producto = attrs.get("producto", getattr(self.instance, "producto", None))
        inicio = attrs.get("inicio", getattr(self.instance, "inicio", None))
        fin = attrs.get("fin", getattr(self.instance, "fin", None))
        precio = attrs.get("precio_especial", getattr(self.instance, "precio_especial", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fin": "La fecha de fin no puede ser anterior a la de inicio."})
        if producto and precio is not None and precio >= producto.precio:
            raise serializers.ValidationError(
                {"precio_especial": f"Debe ser menor al precio normal (S/ {producto.precio})."}
            )
        return attrs


class HistorialPrecioSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre", read_only=True, default=None)

    class Meta:
        model = HistorialPrecio
        fields = ["id", "precio_anterior", "precio_nuevo", "usuario_nombre", "fecha"]
