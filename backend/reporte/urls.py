from django.urls import path

from .views import ExportarView, PanelTiendaView, PanelView, UsabilidadView

urlpatterns = [
    path("panel/", PanelView.as_view(), name="reporte-panel"),
    path("exportar/", ExportarView.as_view(), name="reporte-exportar"),
    path("tienda/", PanelTiendaView.as_view(), name="reporte-tienda"),
    path("usabilidad/", UsabilidadView.as_view(), name="reporte-usabilidad"),
]
