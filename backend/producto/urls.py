from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import OfertaViewSet, ProductoViewSet

router = DefaultRouter()
router.register(r"productos", ProductoViewSet, basename="producto")
router.register(r"ofertas", OfertaViewSet, basename="oferta")

urlpatterns = [
    path("", include(router.urls)),
]
