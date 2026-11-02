from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Categoria


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
