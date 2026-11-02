from django.urls import path

from .views import ExportarView, PanelView

urlpatterns = [
    path("panel/", PanelView.as_view(), name="reporte-panel"),
    path("exportar/", ExportarView.as_view(), name="reporte-exportar"),
]
