from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import InventarioViewSet, MovimientoStockViewSet, StockViewSet

router = DefaultRouter()
router.register(r"stock", StockViewSet, basename="stock")
router.register(r"movimientos", MovimientoStockViewSet, basename="movimientostock")
router.register(r"inventario", InventarioViewSet, basename="inventario")

urlpatterns = [
    path("", include(router.urls)),
]
