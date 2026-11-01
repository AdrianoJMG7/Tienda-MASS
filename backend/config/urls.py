from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from catalogo.views import CategoriaViewSet, OfertaViewSet, ProductoViewSet
from core.views import InicioAdminView, InicioClienteView, InicioVendedorView
from cuentas.views import LoginView, LogoutView, RefreshView, RegistroView, VendedorViewSet, YoView
from pedidos.views import PedidoViewSet
from tiendas.views import TiendaViewSet

router = DefaultRouter()
router.register("tiendas", TiendaViewSet, basename="tienda")
router.register("vendedores", VendedorViewSet, basename="vendedor")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("productos", ProductoViewSet, basename="producto")
router.register("ofertas", OfertaViewSet, basename="oferta")
router.register("pedidos", PedidoViewSet, basename="pedido")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/registro/", RegistroView.as_view(), name="registro"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/yo/", YoView.as_view(), name="yo"),
    path("api/inicio/admin/", InicioAdminView.as_view(), name="inicio-admin"),
    path("api/inicio/vendedor/", InicioVendedorView.as_view(), name="inicio-vendedor"),
    path("api/inicio/cliente/", InicioClienteView.as_view(), name="inicio-cliente"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
