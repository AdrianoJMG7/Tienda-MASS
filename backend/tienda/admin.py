from django.contrib import admin

from .models import Tienda


@admin.register(Tienda)
class TiendaAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre", "distrito", "activa"]
    list_filter = ["activa", "distrito"]
    search_fields = ["codigo", "nombre", "distrito"]
    ordering = ["codigo"]
