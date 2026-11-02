"""HU17: exporta el panel de reportes a Excel (openpyxl) o PDF (ReportLab) con los filtros aplicados."""

from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AZUL = "092DB5"
FORMATO_SOLES = '"S/" #,##0.00'


def _minutos(valor):
    return "—" if valor is None else f"{valor:.1f} min"


def _soles(valor):
    return f"S/ {valor:,.2f}"


def _secciones(datos):
    """Tablas comunes a ambos formatos: (título, encabezados, filas, columnas en soles)."""
    r = datos["resumen"]
    return [
        (
            "Resumen",
            ["Indicador", "Valor"],
            [
                ["Ventas (S/)", r["total"]],
                ["Número de ventas", r["ventas"]],
                ["Ticket promedio (S/)", r["ticket_promedio"]],
                ["Pedidos online", r["pedidos"]],
                ["Pedidos entregados", r["pedidos_entregados"]],
                ["Pedidos cancelados", r["pedidos_cancelados"]],
                ["Tiempo promedio de preparación", _minutos(r["minutos_preparacion"])],
            ],
            set(),
        ),
        (
            "Ventas por canal",
            ["Canal", "Ventas", "Total", "Ticket promedio"],
            [[c["canal_display"], c["ventas"], c["total"], c["ticket_promedio"]] for c in datos["por_canal"]],
            {2, 3},
        ),
        (
            "Ventas por tienda",
            ["Código", "Tienda", "Ventas", "Caja", "Web", "Total", "Ticket promedio", "Pedidos", "Preparación"],
            [
                [t["codigo"], t["nombre"], t["ventas"], t["caja"], t["web"], t["total"], t["ticket_promedio"],
                 t["pedidos"], _minutos(t["minutos_preparacion"])]
                for t in datos["por_tienda"]
            ],
            {3, 4, 5, 6},
        ),
        (
            "Pedidos online por estado",
            ["Estado", "Pedidos"],
            [[e["estado_display"], e["pedidos"]] for e in datos["por_estado"]],
            set(),
        ),
        (
            "Productos más vendidos",
            ["#", "Producto", "Marca", "Unidades", "Total"],
            [[i, p["nombre"], p["marca"], p["unidades"], p["total"]] for i, p in enumerate(datos["top_productos"], 1)],
            {4},
        ),
        (
            "Ventas por día",
            ["Fecha", "Caja", "Web", "Total"],
            [[d["fecha"], d["caja"], d["web"], d["caja"] + d["web"]] for d in datos["por_dia"]],
            {1, 2, 3},
        ),
    ]


def a_excel(datos):
    libro = Workbook()
    libro.remove(libro.active)
    negrita = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor=AZUL)
    for titulo, encabezados, filas, soles in _secciones(datos):
        hoja = libro.create_sheet(titulo[:31])
        hoja.append([f"Mass · {titulo}"])
        hoja["A1"].font = Font(bold=True, size=14)
        hoja.append([datos["filtros"]["descripcion"]])
        hoja.append([])
        hoja.append(encabezados)
        for celda in hoja[4]:
            celda.font, celda.fill = negrita, relleno
        for fila in filas:
            hoja.append(fila)
            for col in soles:
                hoja.cell(row=hoja.max_row, column=col + 1).number_format = FORMATO_SOLES
            if titulo == "Ventas por día":
                hoja.cell(row=hoja.max_row, column=1).number_format = "dd/mm/yyyy"
        if titulo == "Resumen":
            for fila in (5, 7):
                hoja.cell(row=fila, column=2).number_format = FORMATO_SOLES
        for i, encabezado in enumerate(encabezados, 1):
            ancho = max([len(str(encabezado))] + [len(str(f[i - 1])) for f in filas])
            hoja.column_dimensions[get_column_letter(i)].width = min(max(ancho + 4, 12), 45)
        hoja.freeze_panes = "A5"
    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()


def a_pdf(datos):
    salida = BytesIO()
    doc = SimpleDocTemplate(
        salida, pagesize=landscape(A4), leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        title="Reporte de ventas y pedidos - Mass",
    )
    estilos = getSampleStyleSheet()
    azul = colors.HexColor(f"#{AZUL}")
    contenido = [
        Paragraph("Mass · Reporte de ventas y pedidos", estilos["Title"]),
        Paragraph(datos["filtros"]["descripcion"], estilos["Normal"]),
        Paragraph(f"Generado el {timezone.localtime():%d/%m/%Y %H:%M}. Datos simulados.", estilos["Italic"]),
    ]
    for titulo, encabezados, filas, soles in _secciones(datos):
        if titulo == "Resumen":
            filas = [[f, _soles(v) if i in (0, 2) else v] for i, (f, v) in enumerate(filas)]
        filas = [
            [_soles(v) if j in soles else (v.strftime("%d/%m/%Y") if hasattr(v, "strftime") else v) for j, v in enumerate(f)]
            for f in filas
        ]
        tabla = Table([encabezados] + (filas or [["Sin datos en el periodo"] + [""] * (len(encabezados) - 1)]), repeatRows=1)
        tabla.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), azul),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D3D7E6")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            *[("ALIGN", (j, 1), (j, -1), "RIGHT") for j in soles],
        ]))
        contenido += [Spacer(1, 0.5 * cm), Paragraph(titulo, estilos["Heading2"]), tabla]
    doc.build(contenido)
    return salida.getvalue()
