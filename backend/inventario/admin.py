from django.contrib import admin

from .models import StockTienda


@admin.register(StockTienda)
class StockTiendaAdmin(admin.ModelAdmin):
    list_display = ["producto", "tienda", "disponible", "reservado", "stock_minimo"]
    list_filter = ["tienda"]
    search_fields = ["producto__nombre", "producto__codigo_barras"]
    list_select_related = ["producto", "tienda"]
