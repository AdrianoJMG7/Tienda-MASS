from django.contrib import admin

from .models import DetallePedido, Pedido


class DetalleInline(admin.TabularInline):
    model = DetallePedido
    extra = 0
    readonly_fields = ["producto", "cantidad", "precio_unitario"]


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["codigo_recojo", "cliente", "tienda", "estado", "total", "creado"]
    list_filter = ["estado", "tienda"]
    search_fields = ["codigo_recojo", "cliente__email"]
    inlines = [DetalleInline]
