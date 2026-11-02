from django.contrib import admin

from .models import DetallePedido, Pedido


class DetallePedidoInline(admin.TabularInline):
    model = DetallePedido
    extra = 0
    readonly_fields = ["subtotal"]


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["codigo_recojo", "cliente", "tienda", "estado", "total", "creado"]
    list_filter = ["estado", "tienda", "creado"]
    search_fields = ["codigo_recojo", "cliente__nombre", "cliente__email"]
    ordering = ["-creado"]
    inlines = [DetallePedidoInline]
    readonly_fields = ["creado"]
