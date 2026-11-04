from rest_framework import serializers

from usuarios.models import Rol

from .models import Tienda


class TiendaSerializer(serializers.ModelSerializer):
    vendedores_activos = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Tienda
        fields = ["id", "codigo", "nombre", "distrito", "direccion", "horario", "activa", "meta_mensual", "vendedores_activos"]

    def to_representation(self, instancia):
        datos = super().to_representation(instancia)
        # La meta y el personal son datos internos: solo los ve el administrador.
        usuario = getattr(self.context.get("request"), "user", None)
        if not (usuario and usuario.is_authenticated and usuario.rol == Rol.ADMIN):
            datos.pop("meta_mensual", None)
        if not hasattr(instancia, "vendedores_activos"):
            datos.pop("vendedores_activos", None)
        return datos
