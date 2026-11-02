from django.contrib import admin

from .models import Producto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "marca", "categoria", "precio", "activo"]
    list_filter = ["activo", "categoria", "marca"]
    search_fields = ["nombre", "marca", "codigo_barras"]
    ordering = ["nombre"]
