from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from usuarios.views import InicioView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("usuarios.urls")),
    path("api/inicio/<str:rol>/", InicioView.as_view(), name="inicio"),
    path("api/tiendas/", include("tienda.urls")),
    path("api/categorias/", include("categoria.urls")),
    path("api/productos/", include("producto.urls")),
    path("api/inventario/", include("inventario.urls")),
    path("api/pedidos/", include("pedido.urls")),
    path("api/ventas/", include("venta.urls")),
    path("api/reportes/", include("reporte.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
