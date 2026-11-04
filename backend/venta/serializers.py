from rest_framework import serializers

from choices import MedioPago
from .models import CierreCaja, DetalleVenta, MotivoDevolucion, TipoReembolso, Venta


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
    producto_marca = serializers.CharField(source="producto.marca", read_only=True)
    producto_foto = serializers.ImageField(source="producto.foto", read_only=True)
    subtotal = serializers.ReadOnlyField()
    devuelto = serializers.ReadOnlyField()
    disponible_devolver = serializers.ReadOnlyField()

    class Meta:
        model = DetalleVenta
        fields = [
            "id", "producto", "producto_nombre", "producto_marca", "producto_foto", "cantidad", "precio_unitario",
            "subtotal", "devuelto", "disponible_devolver",
        ]


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    vendedor_nombre = serializers.CharField(source="vendedor.nombre", read_only=True)
    tienda_codigo = serializers.CharField(source="tienda.codigo", read_only=True)
    vuelto = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    cliente_celular = serializers.SerializerMethodField()
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)
    canal_display = serializers.CharField(source="get_canal_display", read_only=True)
    estado = serializers.SerializerMethodField()
    estado_nombre = serializers.SerializerMethodField(method_name="get_estado_display")

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
            "monto_recibido",
            "vuelto",
            "cliente_nombre",
            "cliente_celular",
            "medio_pago_display",
            "canal_display",
            "estado",
            "estado_nombre",
        ]
        # Las ventas web solo nacen al entregar un pedido (HU10), no se crean a mano.
        read_only_fields = ["fecha", "canal", "pedido", "monto_recibido"]

    def get_vuelto(self, obj):
        """HU12: vuelto de un pago en efectivo en caja."""
        if obj.monto_recibido is None:
            return None
        return max(obj.monto_recibido - obj.total, 0)

    def get_cliente_nombre(self, obj):
        # En caja se vende sin registrar al cliente; solo los pedidos online lo tienen.
        return obj.pedido.cliente.nombre if obj.pedido_id else None

    def get_cliente_celular(self, obj):
        return obj.pedido.cliente.celular if obj.pedido_id else None

    def get_estado(self, obj):
        detalles = obj.detalles.all()
        devueltas = sum(d.devuelto for d in detalles)
        if devueltas == 0:
            return "completada"
        return "devuelta" if devueltas >= sum(d.cantidad for d in detalles) else "devolucion_parcial"

    def get_estado_display(self, obj):
        return {"completada": "Completada", "devolucion_parcial": "Devolución parcial", "devuelta": "Devuelta"}[
            self.get_estado(obj)
        ]


class DevolverSerializer(serializers.Serializer):
    detalle = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.ChoiceField(choices=MotivoDevolucion.choices)
    tipo_reembolso = serializers.ChoiceField(choices=TipoReembolso.choices)


class CerrarCajaSerializer(serializers.Serializer):
    efectivo_contado = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True)


class CierreCajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CierreCaja
        fields = [
            "id", "inicio", "fin", "ventas", "unidades", "total", "efectivo_esperado", "efectivo_contado",
            "diferencia", "notas",
        ]
