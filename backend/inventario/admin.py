from django.contrib import admin

from .models import MovimientoStock, Stock


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ["producto", "tienda", "cantidad", "reservado"]
    list_filter = ["tienda"]
    search_fields = ["producto__nombre", "producto__codigo_barras"]
    list_select_related = ["producto", "tienda"]


@admin.register(MovimientoStock)
class MovimientoStockAdmin(admin.ModelAdmin):
    list_display = ["fecha", "tienda", "producto", "tipo", "cantidad", "referencia", "usuario"]
    list_filter = ["tipo", "tienda"]
    search_fields = ["producto__nombre", "referencia"]
    list_select_related = ["producto", "tienda", "usuario"]
