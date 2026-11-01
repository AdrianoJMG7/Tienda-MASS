"""Inicio de cada rol (HU03).

Cada endpoint devuelve el menú que corresponde al rol. Los permisos se validan aquí, en el
servidor: aunque alguien manipule la interfaz, un cliente no puede leer el inicio del administrador.
Las opciones sin "disponible" se implementan en los sprints siguientes.
"""

from rest_framework.response import Response
from rest_framework.views import APIView

from .permisos import EsAdmin, EsCliente, EsVendedor

MENUS = {
    "admin": [
        {"clave": "tiendas", "titulo": "Tiendas", "hu": "HU04", "disponible": True},
        {"clave": "vendedores", "titulo": "Vendedores", "hu": "HU04", "disponible": True},
        {"clave": "productos", "titulo": "Catálogo y precios", "hu": "HU05", "disponible": True},
        {"clave": "ofertas", "titulo": "Ofertas", "hu": "HU05", "disponible": True},
        {"clave": "categorias", "titulo": "Categorías", "hu": "HU05", "disponible": True},
        {"clave": "panel", "titulo": "Panel de ventas y pedidos", "hu": "HU16"},
    ],
    "vendedor": [
        {"clave": "pedidos", "titulo": "Pedidos de mi tienda", "hu": "HU10"},
        {"clave": "caja", "titulo": "Venta en caja", "hu": "HU12"},
        {"clave": "stock", "titulo": "Stock y alertas", "hu": "HU14"},
    ],
    "cliente": [
        {"clave": "catalogo", "titulo": "Catálogo y ofertas", "hu": "HU06", "disponible": True, "ruta": "/catalogo"},
        {"clave": "carrito", "titulo": "Mi carrito", "hu": "HU07", "disponible": True, "ruta": "/carrito"},
        {"clave": "pedidos", "titulo": "Mis pedidos", "hu": "HU11"},
    ],
}


def _respuesta(request, rol):
    usuario = request.user
    datos = {"rol": rol, "saludo": f"Hola, {usuario.nombre.split()[0]}", "menu": MENUS[rol]}
    if usuario.tienda_id:
        datos["tienda"] = {"codigo": usuario.tienda.codigo, "nombre": usuario.tienda.nombre}
    return Response(datos)


class InicioAdminView(APIView):
    permission_classes = [EsAdmin]

    def get(self, request):
        return _respuesta(request, "admin")


class InicioVendedorView(APIView):
    permission_classes = [EsVendedor]

    def get(self, request):
        return _respuesta(request, "vendedor")


class InicioClienteView(APIView):
    permission_classes = [EsCliente]

    def get(self, request):
        return _respuesta(request, "cliente")
