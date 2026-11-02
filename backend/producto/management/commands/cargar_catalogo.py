"""Carga el catálogo inicial de unos 800 productos típicos de hard discount (HU05).

Las marcas son ficticias; «Buen Precio» y «Casa Simple» hacen de marcas propias.
Es determinista (mismos productos y códigos en cada ejecución) y no sobrescribe productos
que ya existan, para respetar los cambios hechos desde la administración.
"""

import random
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from categoria.models import Categoria
from producto.models import Oferta, Producto

MARCAS_PROPIAS = ["Buen Precio", "Casa Simple"]

# categoría: (marcas ficticias, [(producto, [(presentación, precio de referencia)])])
CATALOGO = {
    "Abarrotes": (
        ["Valle Sur", "Don Cosme", "La Chacrita", "Granero", "Inti Real", "Molino Rímac", "Costa Verde", "Andino"],
        [
            ("Arroz extra", [("750 g", 3.2), ("1 kg", 4.2), ("5 kg", 19.9)]),
            ("Azúcar rubia", [("1 kg", 3.9), ("2 kg", 7.6)]),
            ("Fideos spaghetti", [("500 g", 2.6), ("1 kg", 4.9)]),
            ("Aceite vegetal", [("900 ml", 8.9), ("1 L", 9.6), ("5 L", 42.9)]),
            ("Atún en trozos", [("140 g", 5.2), ("170 g", 5.9)]),
            ("Lentejas", [("500 g", 4.5), ("1 kg", 8.5)]),
            ("Harina sin preparar", [("1 kg", 4.3)]),
            ("Sal de mesa", [("1 kg", 1.6)]),
            ("Avena", [("400 g", 3.9), ("900 g", 7.5)]),
            ("Fideos tallarín", [("500 g", 2.7)]),
        ],
    ),
    "Bebidas": (
        ["Fresca", "Río Claro", "Tropical", "Kallpa", "Manantial", "Cumbre", "Nevado", "Sol de Ica"],
        [
            ("Gaseosa sabor cola", [("500 ml", 2.2), ("1.5 L", 5.5), ("3 L", 9.9)]),
            ("Agua sin gas", [("625 ml", 1.5), ("2.5 L", 3.2)]),
            ("Néctar de durazno", [("1 L", 4.2), ("1.5 L", 5.6)]),
            ("Bebida rehidratante", [("500 ml", 2.9)]),
            ("Gaseosa sabor naranja", [("500 ml", 2.0), ("3 L", 8.9)]),
            ("Jugo de naranja", [("1 L", 5.9)]),
            ("Té filtrante", [("25 unidades", 3.5)]),
            ("Café instantáneo", [("50 g", 6.9), ("100 g", 12.9)]),
        ],
    ),
    "Lácteos": (
        ["Vaquita Feliz", "Pradera", "Campo Andino", "Lactosur", "Granja Azul", "Ordeñito", "Valle Verde", "Montaña"],
        [
            ("Leche evaporada", [("400 g", 4.1), ("pack 6 x 400 g", 23.5)]),
            ("Yogurt sabor fresa", [("1 kg", 6.9)]),
            ("Queso fresco", [("500 g", 12.9)]),
            ("Mantequilla", [("200 g", 8.9)]),
            ("Huevos rosados", [("15 unidades", 9.9), ("30 unidades", 18.9)]),
            ("Leche UHT entera", [("1 L", 4.9)]),
            ("Yogurt natural", [("1 kg", 6.5)]),
            ("Margarina", [("250 g", 4.6)]),
        ],
    ),
    "Limpieza": (
        ["Brillo", "Limpiex", "Aroma Hogar", "Clarín", "Pureza", "Espuma", "Nítido", "Hogar Fácil"],
        [
            ("Detergente en polvo", [("500 g", 5.9), ("2 kg", 19.9)]),
            ("Lejía", [("1 L", 2.9), ("4 L", 9.9)]),
            ("Lavavajillas en pasta", [("450 g", 4.5)]),
            ("Papel higiénico", [("4 rollos", 5.9), ("12 rollos", 16.9)]),
            ("Limpiador multiusos", [("900 ml", 6.5)]),
            ("Suavizante de ropa", [("1 L", 9.9)]),
            ("Bolsas para basura", [("10 unidades", 3.9)]),
            ("Esponja lavavajillas", [("3 unidades", 2.9)]),
        ],
    ),
    "Aseo Personal": (
        ["Suavel", "Dermis", "Fresh Day", "Natural Vida", "Bambú", "Pétalo", "Sonrisa", "Alba"],
        [
            ("Champú", [("400 ml", 11.9)]),
            ("Jabón de tocador", [("pack 3 x 90 g", 5.9)]),
            ("Pasta dental", [("75 ml", 4.9), ("pack 3 x 75 ml", 12.9)]),
            ("Desodorante en barra", [("50 g", 9.9)]),
            ("Papel toalla", [("2 rollos", 6.9)]),
            ("Pañales talla G", [("30 unidades", 32.9)]),
            ("Toallas higiénicas", [("10 unidades", 4.9)]),
            ("Acondicionador", [("400 ml", 12.5)]),
        ],
    ),
    "Snacks": (
        ["Crujis", "Dulcería Lima", "Tentación", "Chasky", "Mordisco", "Golosín", "Picarón", "Kiwicha"],
        [
            ("Galletas de soda", [("pack 6 unidades", 3.2)]),
            ("Galletas rellenas de chocolate", [("pack 6 unidades", 4.5)]),
            ("Papas fritas", [("45 g", 2.0), ("150 g", 5.9)]),
            ("Chocolate de leche", [("30 g", 1.8)]),
            ("Caramelos surtidos", [("100 unidades", 6.9)]),
            ("Maní salado", [("100 g", 2.9)]),
            ("Gelatina en polvo", [("150 g", 2.4)]),
            ("Chifles", [("90 g", 2.9)]),
        ],
    ),
    "Panadería": (
        ["Buen Día", "Panadería Real", "Amanecer", "Trigal", "Quinua Andina", "Dorado", "Mañanero", "Colmena"],
        [
            ("Pan de molde blanco", [("500 g", 7.9)]),
            ("Mermelada de fresa", [("300 g", 5.9)]),
            ("Cereal de maíz", [("300 g", 8.9)]),
            ("Chocolate en polvo", [("400 g", 9.9)]),
            ("Hojuelas de quinua", [("400 g", 6.9)]),
            ("Pan de molde integral", [("600 g", 8.5)]),
            ("Miel de abeja", [("250 g", 12.9)]),
            ("Tostadas", [("200 g", 4.5)]),
        ],
    ),
}

TOTAL_OBJETIVO = 800


def _redondear(valor):
    """Precio terminado en décimos (p. ej. 4.90), como en el anaquel."""
    return Decimal(str(valor)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))


def _ean13(numero12):
    """Código EAN-13 con dígito verificador. El prefijo 2 es de uso interno: no choca con productos reales."""
    suma = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(numero12))
    return numero12 + str((10 - suma % 10) % 10)


def generar_productos():
    azar = random.Random(2026)
    combinaciones = []
    for categoria, (marcas, productos) in CATALOGO.items():
        for base, presentaciones in productos:
            for marca in marcas + MARCAS_PROPIAS:
                for presentacion, referencia in presentaciones:
                    combinaciones.append((categoria, marca, base, presentacion, referencia))
    azar.shuffle(combinaciones)
    elegidos = sorted(combinaciones[:TOTAL_OBJETIVO], key=lambda c: (c[0], c[2], c[1], c[3]))

    for i, (categoria, marca, base, presentacion, referencia) in enumerate(elegidos, start=1):
        propia = marca in MARCAS_PROPIAS
        factor = azar.uniform(0.78, 0.88) if propia else azar.uniform(0.92, 1.15)
        precio = max(_redondear(referencia * factor), Decimal("0.50"))
        costo = (precio * Decimal(str(azar.uniform(0.68, 0.8)))).quantize(Decimal("0.01"))
        yield {
            "categoria": categoria,
            "nombre": f"{base} {presentacion}",
            "marca": marca,
            "codigo_barras": _ean13(f"20{i:010d}"),
            "costo": costo,
            "precio": precio,
            "marca_propia": propia,
        }


class Command(BaseCommand):
    help = "Carga el catálogo inicial (unos 800 productos) y algunas ofertas de ejemplo."

    @transaction.atomic
    def handle(self, *args, **opciones):
        categorias = {nombre: Categoria.objects.get_or_create(nombre=nombre)[0] for nombre in CATALOGO}
        existentes = set(Producto.objects.values_list("codigo_barras", flat=True))
        nuevos = [
            Producto(**{**datos, "categoria": categorias[datos["categoria"]]})
            for datos in generar_productos()
            if datos["codigo_barras"] not in existentes
        ]
        Producto.objects.bulk_create(nuevos)

        ofertas = 0
        if not Oferta.objects.exists():
            ofertas = self._crear_ofertas()

        self.stdout.write(
            self.style.SUCCESS(
                f"Catálogo listo: {Producto.objects.count()} productos en {len(categorias)} categorías "
                f"({len(nuevos)} nuevos, {ofertas} ofertas de ejemplo)."
            )
        )

    def _crear_ofertas(self):
        """Ofertas de ejemplo: vigentes, programadas y vencidas, de 10 % a 25 % de descuento."""
        azar = random.Random(7)
        hoy = timezone.localdate()
        productos = list(Producto.objects.order_by("id"))
        tramos = [(-3, 7, 40), (5, 14, 10), (-20, -6, 10)]  # (inicio, fin) en días desde hoy, cantidad
        ofertas = []
        for desde, hasta, cantidad in tramos:
            for producto in azar.sample(productos, cantidad):
                descuento = Decimal(str(azar.choice([0.10, 0.15, 0.20, 0.25])))
                ofertas.append(
                    Oferta(
                        producto=producto,
                        precio_especial=_redondear(producto.precio * (1 - descuento)),
                        inicio=hoy + timedelta(days=desde),
                        fin=hoy + timedelta(days=hasta),
                    )
                )
        Oferta.objects.bulk_create(ofertas)
        return len(ofertas)
