import re

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Tienda

CODIGO_RE = re.compile(r"^T-\d{3}$")


class TiendaSerializer(serializers.ModelSerializer):
    codigo = serializers.CharField(
        max_length=10,
        validators=[UniqueValidator(Tienda.objects.all(), message="Ya existe una tienda con este código.")],
    )
    vendedores_activos = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Tienda
        fields = ["id", "codigo", "nombre", "distrito", "direccion", "horario", "activa", "vendedores_activos"]

    def validate_codigo(self, valor):
        valor = valor.strip().upper()
        if not CODIGO_RE.match(valor):
            raise serializers.ValidationError("Usa el formato T-000 (por ejemplo, T-006).")
        return valor

    def to_representation(self, instancia):
        datos = super().to_representation(instancia)
        if not hasattr(instancia, "vendedores_activos"):
            datos.pop("vendedores_activos", None)
        return datos
