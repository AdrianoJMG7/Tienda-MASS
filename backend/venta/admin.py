from django.contrib import admin

from .models import DetalleVenta, Venta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    readonly_fields = ["subtotal"]


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ["id", "tienda", "vendedor", "fecha", "total", "medio_pago"]
    list_filter = ["tienda", "fecha", "medio_pago"]
    search_fields = ["numero_ticket", "vendedor__nombre"]
    ordering = ["-fecha"]
    inlines = [DetalleVentaInline]
    readonly_fields = ["fecha"]
