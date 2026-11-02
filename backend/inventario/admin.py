from django.contrib import admin

from .models import Stock


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ["producto", "tienda", "cantidad"]
    list_filter = ["tienda"]
    search_fields = ["producto__nombre", "producto__codigo_barras"]
    list_select_related = ["producto", "tienda"]
