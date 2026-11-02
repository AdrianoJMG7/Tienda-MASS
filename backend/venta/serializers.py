from rest_framework import serializers

from choices import MedioPago
from .models import DetalleVenta, Venta


class ItemVentaSerializer(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=99)


class CrearVentaSerializer(serializers.Serializer):
    """Lo que envía el vendedor al registrar una venta en caja."""

    medio_pago = serializers.ChoiceField(
        choices=MedioPago.choices, error_messages={"invalid_choice": "Elige efectivo, tarjeta o Yape/Plin."}
    )
    monto_recibido = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True,
        help_text="Monto recibido en efectivo (solo para pagos en efectivo)"
    )
    items = ItemVentaSerializer(many=True, max_length=60)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La venta debe tener al menos un producto.")
        return items

    def validate(self, datos):
        if datos["medio_pago"] == MedioPago.EFECTIVO and not datos.get("monto_recibido"):
            raise serializers.ValidationError({"monto_recibido": "El monto recibido es obligatorio para pagos en efectivo."})
        return datos


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
    vuelto = serializers.SerializerMethodField()

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
            "canal",
            "pedido",
            "detalles",
            "vuelto",
        ]
        # Las ventas web solo nacen al entregar un pedido (HU10), no se crean a mano.
        read_only_fields = ["fecha", "canal", "pedido"]

    def get_vuelto(self, obj):
        """Calcula el vuelto para ventas en efectivo (HU12)."""
        # Para ventas web, no hay vuelto
        if obj.canal == "web":
            return None
        # Para ventas en caja, el vuelto se calcula al crear la venta
        return getattr(obj, "_vuelto", None)
