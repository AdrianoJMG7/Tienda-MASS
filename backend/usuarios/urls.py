from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    InicioView,
    LoginView,
    LogoutView,
    RefreshView,
    RegistroView,
    UsuarioViewSet,
    YoView,
)

router = DefaultRouter()
router.register(r"usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("registro/", RegistroView.as_view(), name="registro"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("yo/", YoView.as_view(), name="yo"),
    path("inicio/<str:rol>/", InicioView.as_view(), name="inicio"),
    path("", include(router.urls)),
]
