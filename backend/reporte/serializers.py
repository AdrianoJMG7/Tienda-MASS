from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from tienda.models import Tienda

from .servicios import Filtros

MAX_DIAS = 366


class FiltrosReporteSerializer(serializers.Serializer):
    """Filtros del panel y de la exportación. Sin fechas, muestra los últimos 30 días."""

    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)
    tienda = serializers.PrimaryKeyRelatedField(queryset=Tienda.objects.all(), required=False, allow_null=True)

    def validate(self, datos):
        hasta = datos.get("hasta") or timezone.localdate()
        desde = datos.get("desde") or hasta - timedelta(days=29)
        if desde > hasta:
            raise serializers.ValidationError({"desde": "La fecha inicial no puede ser posterior a la final."})
        if (hasta - desde).days >= MAX_DIAS:
            raise serializers.ValidationError({"desde": "El periodo no puede superar un año."})
        return Filtros(desde=desde, hasta=hasta, tienda=datos.get("tienda"))


class ExportarSerializer(FiltrosReporteSerializer):
    formato = serializers.ChoiceField(choices=[("xlsx", "Excel"), ("pdf", "PDF")])

    def validate(self, datos):
        return {"filtros": super().validate(datos), "formato": datos["formato"]}


class TareaUsabilidadSerializer(serializers.Serializer):
    tarea = serializers.CharField(max_length=200)
    tiempo_segundos = serializers.IntegerField(min_value=0)
    completada = serializers.BooleanField()
    observaciones = serializers.CharField(required=False, allow_blank=True)


class PruebaUsabilidadSerializer(serializers.Serializer):
    usuario = serializers.CharField(max_length=100)
    rol = serializers.ChoiceField(choices=[("admin", "Admin"), ("vendedor", "Vendedor"), ("cliente", "Cliente")])
    tareas = TareaUsabilidadSerializer(many=True)
