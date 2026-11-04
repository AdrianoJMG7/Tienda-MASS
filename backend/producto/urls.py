from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FavoritoViewSet, OfertaViewSet, ProductoViewSet

router = DefaultRouter()
router.register(r"productos", ProductoViewSet, basename="producto")
router.register(r"ofertas", OfertaViewSet, basename="oferta")
router.register(r"favoritos", FavoritoViewSet, basename="favorito")

urlpatterns = [
    path("", include(router.urls)),
]
