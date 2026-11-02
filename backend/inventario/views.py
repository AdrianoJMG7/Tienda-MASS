from rest_framework import viewsets

from .models import Stock
from .serializers import StockSerializer


class StockViewSet(viewsets.ModelViewSet):
    """Gestión de stock por tienda."""

    serializer_class = StockSerializer
    queryset = Stock.objects.select_related("tienda", "producto")
