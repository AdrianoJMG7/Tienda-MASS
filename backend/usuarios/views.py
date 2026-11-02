from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Usuario
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegistroSerializer,
    UsuarioSerializer,
)


class RegistroView(generics.CreateAPIView):
    """HU02: un visitante crea su cuenta de cliente."""

    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


class LoginView(TokenObtainPairView):
    """HU03: inicio de sesión; devuelve tokens JWT y los datos del usuario (rol incluido)."""

    serializer_class = LoginSerializer


class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    """Cierra la sesión invalidando el token de renovación."""

    @extend_schema(request=LogoutSerializer, responses={205: None})
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            pass  # El token ya expiró o fue invalidado: la sesión ya está cerrada.
        return Response(status=status.HTTP_205_RESET_CONTENT)


class YoView(generics.RetrieveAPIView):
    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user


class InicioView(APIView):
    """Devuelve el menú de inicio según el rol del usuario."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, rol):
        if request.user.rol != rol:
            return Response({"detail": "No tienes permiso para ver esta página."}, status=status.HTTP_403_FORBIDDEN)

        saludo = f"Hola, {request.user.nombre}"
        tienda = None
        if request.user.tienda:
            tienda = {"codigo": request.user.tienda.codigo, "nombre": request.user.tienda.nombre}

        menu = []
        if rol == "admin":
            menu = [
                {"clave": "tiendas", "titulo": "Tiendas", "hu": "HU04", "disponible": True, "ruta": "/admin/tiendas"},
                {"clave": "vendedores", "titulo": "Vendedores", "hu": "HU04", "disponible": True, "ruta": "/admin/vendedores"},
                {"clave": "productos", "titulo": "Catálogo y precios", "hu": "HU05", "disponible": True, "ruta": "/admin/productos"},
                {"clave": "ofertas", "titulo": "Ofertas", "hu": "HU05", "disponible": True, "ruta": "/admin/ofertas"},
                {"clave": "categorias", "titulo": "Categorías", "hu": "HU05", "disponible": True, "ruta": "/admin/categorias"},
            ]
        elif rol == "vendedor":
            menu = [
                {"clave": "pedidos", "titulo": "Pedidos online", "hu": "HU10", "disponible": True, "ruta": "/vendedor/pedidos"},
                {"clave": "caja", "titulo": "Caja", "hu": "HU12", "disponible": True, "ruta": "/vendedor/caja"},
                {"clave": "inventario", "titulo": "Inventario", "hu": "HU14", "disponible": True, "ruta": "/vendedor/inventario"},
            ]
        elif rol == "cliente":
            menu = [
                {"clave": "catalogo", "titulo": "Catálogo", "hu": "HU06", "disponible": True, "ruta": "/catalogo"},
                {"clave": "carrito", "titulo": "Mi carrito", "hu": "HU07", "disponible": True, "ruta": "/carrito"},
                {"clave": "pedidos", "titulo": "Mis pedidos", "hu": "HU11", "disponible": True, "ruta": "/cliente/pedidos"},
            ]

        return Response({
            "saludo": saludo,
            "tienda": tienda,
            "menu": menu,
        })


@extend_schema(parameters=[OpenApiParameter("q", str)])
class UsuarioViewSet(viewsets.ModelViewSet):
    """El administrador gestiona usuarios."""

    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        consulta = Usuario.objects.all()
        if q := self.request.query_params.get("q", "").strip():
            consulta = consulta.filter(Q(nombre__icontains=q) | Q(email__icontains=q))
        return consulta.order_by("nombre")
