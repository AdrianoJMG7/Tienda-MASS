from django.urls import path

from .views import ExportarView, PanelView, UsabilidadView

urlpatterns = [
    path("panel/", PanelView.as_view(), name="reporte-panel"),
    path("exportar/", ExportarView.as_view(), name="reporte-exportar"),
    path("usabilidad/", UsabilidadView.as_view(), name="reporte-usabilidad"),
]
