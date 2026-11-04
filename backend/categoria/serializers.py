from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Categoria


IMAGEN_MAX_BYTES = 2 * 1024 * 1024


class CategoriaSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(
        max_length=60,
        validators=[UniqueValidator(Categoria.objects.all(), message="Ya existe esa categoría.", lookup="iexact")],
    )
    total_productos = serializers.IntegerField(read_only=True, required=False)
    quitar_imagen = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Categoria
        fields = ["id", "nombre", "descripcion", "imagen", "quitar_imagen", "activa", "total_productos"]
        extra_kwargs = {"imagen": {"required": False}, "descripcion": {"required": False}}

    def validate_imagen(self, imagen):
        if imagen and imagen.size > IMAGEN_MAX_BYTES:
            raise serializers.ValidationError("La imagen no debe pesar más de 2 MB.")
        return imagen

    def create(self, datos):
        datos.pop("quitar_imagen", None)
        return super().create(datos)

    def update(self, instancia, datos):
        if datos.pop("quitar_imagen", False) and "imagen" not in datos:
            instancia.imagen.delete(save=False)
            datos["imagen"] = ""
        return super().update(instancia, datos)

    def to_representation(self, instancia):
        datos = super().to_representation(instancia)
        if not hasattr(instancia, "total_productos"):
            datos.pop("total_productos", None)
        return datos
