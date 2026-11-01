from django.conf import settings
from django.db import models
from django.db.models import OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone


class Categoria(models.Model):
    nombre = models.CharField(max_length=60, unique=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class ProductoQuerySet(models.QuerySet):
    def con_precio_vigente(self, fecha=None):
        """Anota precio_oferta y oferta_fin (si hay una oferta vigente) y precio_final."""
        fecha = fecha or timezone.localdate()
        ofertas = Oferta.objects.filter(producto=OuterRef("pk"), inicio__lte=fecha, fin__gte=fecha).order_by(
            "precio_especial"
        )
        return self.annotate(
            precio_oferta=Subquery(ofertas.values("precio_especial")[:1]),
            oferta_fin=Subquery(ofertas.values("fin")[:1]),
        ).annotate(precio_final=Coalesce("precio_oferta", "precio"))


class Producto(models.Model):
    """Producto del catálogo central: el mismo precio rige en la web y en todas las tiendas."""

    nombre = models.CharField(max_length=150)
    marca = models.CharField(max_length=60)
    codigo_barras = models.CharField(max_length=14, unique=True)
    foto = models.ImageField(upload_to="productos/", blank=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="productos")
    costo = models.DecimalField(max_digits=10, decimal_places=2)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    marca_propia = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)
    actualizado = models.DateTimeField(auto_now=True)

    objects = ProductoQuerySet.as_manager()

    class Meta:
        ordering = ["nombre"]
        indexes = [models.Index(fields=["nombre"]), models.Index(fields=["marca"])]

    def __str__(self):
        return f"{self.nombre} ({self.marca})"

    def precio_vigente(self, fecha=None):
        fecha = fecha or timezone.localdate()
        oferta = self.ofertas.filter(inicio__lte=fecha, fin__gte=fecha).order_by("precio_especial").first()
        return oferta.precio_especial if oferta else self.precio


class Oferta(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="ofertas")
    precio_especial = models.DecimalField(max_digits=10, decimal_places=2)
    inicio = models.DateField()
    fin = models.DateField()
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-inicio", "producto__nombre"]

    @property
    def estado(self):
        hoy = timezone.localdate()
        if self.fin < hoy:
            return "vencida"
        return "vigente" if self.inicio <= hoy else "programada"

    def __str__(self):
        return f"{self.producto} a S/ {self.precio_especial}"


class HistorialPrecio(models.Model):
    """Registro de cada cambio de precio: fecha y usuario que lo hizo."""

    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="historial_precios")
    precio_anterior = models.DecimalField(max_digits=10, decimal_places=2)
    precio_nuevo = models.DecimalField(max_digits=10, decimal_places=2)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-fecha", "-id"]
