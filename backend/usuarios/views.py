from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Rol, SesionUsuario, Usuario
from .permisos import EsAdmin
from .serializers import (
    CambiarPasswordSerializer,
    SesionUsuarioSerializer,
    LoginSerializer,
    LogoutSerializer,
    PerfilSerializer,
    RegistroSerializer,
    UsuarioSerializer,
    VendedorSerializer,
)


def describir_dispositivo(agente):
    """Resume el navegador y el sistema, p. ej. "Chrome en Windows"; no se guarda nada más del equipo."""
    navegadores = (("Edg/", "Edge"), ("OPR/", "Opera"), ("Chrome/", "Chrome"), ("Firefox/", "Firefox"), ("Safari/", "Safari"))
    sistemas = (("Android", "Android"), ("iPhone", "iOS"), ("iPad", "iOS"), ("Windows", "Windows"), ("Mac OS", "macOS"), ("Linux", "Linux"))
    navegador = next((nombre for clave, nombre in navegadores if clave in agente), "Navegador")
    sistema = next((nombre for clave, nombre in sistemas if clave in agente), "dispositivo desconocido")
    return f"{navegador} en {sistema}"


class RegistroView(generics.CreateAPIView):
    """HU02: un visitante crea su cuenta de cliente."""

    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


class LoginView(TokenObtainPairView):
    """HU03: inicio de sesión; devuelve tokens JWT y los datos del usuario (rol incluido)."""

    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        respuesta = super().post(request, *args, **kwargs)
        if respuesta.status_code == status.HTTP_200_OK:
            SesionUsuario.objects.create(
                usuario_id=respuesta.data["usuario"]["id"],
                dispositivo=describir_dispositivo(request.headers.get("User-Agent", "")),
            )
        return respuesta


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


class YoView(generics.RetrieveUpdateAPIView):
    """Datos del usuario con sesión; el cliente los actualiza desde "Mi cuenta" (PATCH)."""

    serializer_class = PerfilSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class CambiarPasswordView(APIView):
    """Cambia la contraseña y cierra las demás sesiones; devuelve tokens nuevos para esta."""

    @extend_schema(request=CambiarPasswordSerializer, responses={200: LoginSerializer})
    def post(self, request):
        entrada = CambiarPasswordSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)
        request.user.set_password(entrada.validated_data["nueva"])
        request.user.save(update_fields=["password"])
        for token in OutstandingToken.objects.filter(user=request.user):
            BlacklistedToken.objects.get_or_create(token=token)
        refresh = RefreshToken.for_user(request.user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class SesionesView(generics.ListAPIView):
    """Últimos inicios de sesión del usuario."""

    serializer_class = SesionUsuarioSerializer
    pagination_class = None

    def get_queryset(self):
        return self.request.user.sesiones.all()[:5]


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
                {"clave": "reportes", "titulo": "Reportes", "hu": "HU16", "disponible": True, "ruta": "/admin/reportes"},
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


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Nombre o email"),
        OpenApiParameter("tienda", int),
        OpenApiParameter("estado", str, enum=["activos", "inactivos"]),
    ]
)
class UsuarioViewSet(viewsets.ModelViewSet):
    """HU04: el administrador gestiona a los vendedores. Un vendedor no se borra: se desactiva, porque tiene ventas."""

    serializer_class = VendedorSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        p = self.request.query_params
        consulta = Usuario.objects.filter(rol=Rol.VENDEDOR).select_related("tienda")
        if q := p.get("q", "").strip():
            consulta = consulta.filter(Q(nombre__icontains=q) | Q(email__icontains=q))
        if (tienda := p.get("tienda", "")).isdigit():
            consulta = consulta.filter(tienda_id=tienda)
        if p.get("estado") in ("activos", "inactivos"):
            consulta = consulta.filter(is_active=p["estado"] == "activos")
        return consulta.order_by("nombre")

    def perform_destroy(self, vendedor):
        vendedor.is_active = False
        vendedor.save(update_fields=["is_active"])
