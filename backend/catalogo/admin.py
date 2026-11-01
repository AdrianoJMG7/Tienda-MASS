from django.contrib import admin

from .models import Categoria, HistorialPrecio, Oferta, Producto


class OfertaInline(admin.TabularInline):
    model = Oferta
    extra = 0
    exclude = ["creado_por"]


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "marca", "categoria", "precio", "marca_propia", "activo"]
    list_filter = ["categoria", "marca_propia", "activo"]
    search_fields = ["nombre", "marca", "codigo_barras"]
    inlines = [OfertaInline]


@admin.register(HistorialPrecio)
class HistorialPrecioAdmin(admin.ModelAdmin):
    list_display = ["producto", "precio_anterior", "precio_nuevo", "usuario", "fecha"]


admin.site.register(Categoria)
