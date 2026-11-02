from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TiendaViewSet

router = DefaultRouter()
router.register(r"tiendas", TiendaViewSet, basename="tienda")

urlpatterns = [
    path("", include(router.urls)),
]
