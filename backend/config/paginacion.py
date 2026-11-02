from rest_framework.pagination import PageNumberPagination


class Paginacion(PageNumberPagination):
    """Paginación por defecto; el frontend puede pedir otro tamaño con ?page_size= (máximo 200)."""

    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 200
