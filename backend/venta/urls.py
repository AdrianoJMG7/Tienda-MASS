from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CierreCajaViewSet, VentaViewSet

router = DefaultRouter()
router.register(r"ventas", VentaViewSet, basename="venta")
router.register(r"cierres", CierreCajaViewSet, basename="cierre")

urlpatterns = [
    path("", include(router.urls)),
]
