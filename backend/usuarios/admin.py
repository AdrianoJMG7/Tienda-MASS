from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ["email", "nombre", "rol", "tienda", "is_active"]
    list_filter = ["rol", "is_active", "tienda"]
    search_fields = ["email", "nombre"]
    ordering = ["nombre"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Información personal", {"fields": ("nombre", "celular", "rol", "tienda")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas importantes", {"fields": ("last_login", "date_joined", "acepto_privacidad_en")}),
    )

    add_fieldsets = (
        (None, {"fields": ("email", "nombre", "password1", "password2", "rol", "tienda")}),
    )
