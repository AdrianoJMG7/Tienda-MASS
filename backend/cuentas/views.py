from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.choices import Rol
from core.permisos import EsAdmin

from .models import Usuario
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegistroSerializer,
    UsuarioSerializer,
    VendedorSerializer,
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


@extend_schema(parameters=[OpenApiParameter("tienda", int), OpenApiParameter("q", str)])
class VendedorViewSet(viewsets.ModelViewSet):
    """HU04: el administrador crea, edita y desactiva vendedores asignándoles una tienda.

    DELETE no borra la cuenta: la desactiva, para conservar el historial de ventas.
    Se reactiva con PATCH {"is_active": true}.
    """

    serializer_class = VendedorSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        consulta = Usuario.objects.filter(rol=Rol.VENDEDOR).select_related("tienda").order_by("tienda__codigo", "nombre")
        if tienda := self.request.query_params.get("tienda"):
            consulta = consulta.filter(tienda_id=tienda)
        if q := self.request.query_params.get("q", "").strip():
            consulta = consulta.filter(Q(nombre__icontains=q) | Q(email__icontains=q))
        return consulta

    def perform_destroy(self, instancia):
        instancia.is_active = False
        instancia.save(update_fields=["is_active"])

