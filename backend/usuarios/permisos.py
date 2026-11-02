from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Rol


def tiene_rol(usuario, *roles):
    return bool(usuario and usuario.is_authenticated and usuario.is_active and usuario.rol in roles)


class EsAdmin(BasePermission):
    message = "Solo el administrador puede realizar esta acción."

    def has_permission(self, request, view):
        return tiene_rol(request.user, Rol.ADMIN)


class EsCliente(BasePermission):
    message = "Solo los clientes pueden realizar esta acción."

    def has_permission(self, request, view):
        return tiene_rol(request.user, Rol.CLIENTE)


class LecturaPublicaEscrituraAdmin(BasePermission):
    """Cualquiera puede consultar (tiendas, catálogo); solo el administrador modifica."""

    message = "Solo el administrador puede realizar esta acción."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or tiene_rol(request.user, Rol.ADMIN)
