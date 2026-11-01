from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["email", "nombre", "rol", "tienda", "is_active"]
    list_filter = ["rol", "tienda", "is_active"]
    search_fields = ["email", "nombre"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Datos", {"fields": ["nombre", "celular", "rol", "tienda", "acepto_privacidad_en"]}),
        ("Permisos", {"fields": ["is_active", "is_staff", "is_superuser"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "nombre", "rol", "tienda", "password1", "password2"]}),
    ]
