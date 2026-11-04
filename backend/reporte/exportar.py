"""HU17: exporta el panel de reportes a Excel (openpyxl) o PDF (ReportLab) con los filtros aplicados.
HU18: generación de reporte de pruebas de usabilidad en PDF.
"""

from io import BytesIO
from collections import defaultdict

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
            "Ventas por categoría",
            ["Categoría", "Total", "Porcentaje"],
            [[c["categoria"], c["total"], f'{c["porcentaje"]} %'] for c in datos["por_categoria"]],
            {1},
        ),
        (
            "Ventas por vendedor",
            ["Vendedor", "Tienda", "Ventas", "Total", "Ticket promedio"],
            [[v["vendedor"], v["tienda"], v["ventas"], v["total"], v["ticket_promedio"]] for v in datos["por_vendedor"]],
            {3, 4},
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


def pdf_usabilidad(datos_pruebas):
    """HU18: genera PDF con gráficos de tiempo por tarea para pruebas de usabilidad."""
    salida = BytesIO()
    doc = SimpleDocTemplate(
        salida, pagesize=A4, leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        title="Reporte de Pruebas de Usabilidad - Mass",
    )
    estilos = getSampleStyleSheet()
    azul = colors.HexColor(f"#{AZUL}")
    verde = colors.HexColor("#1E7B34")
    amarillo = colors.HexColor("#FFD101")

    # Agrupar datos por rol y tarea
    por_rol = defaultdict(list)
    por_tarea = defaultdict(list)
    tareas_completadas = defaultdict(int)
    tareas_totales = defaultdict(int)

    for prueba in datos_pruebas:
        rol = prueba["rol"]
        for tarea in prueba["tareas"]:
            por_rol[rol].append(tarea["tiempo_segundos"])
            por_tarea[tarea["tarea"]].append(tarea["tiempo_segundos"])
            tareas_totales[tarea["tarea"]] += 1
            if tarea["completada"]:
                tareas_completadas[tarea["tarea"]] += 1

    # Calcular promedios
    promedio_por_rol = {rol: sum(tiempos) / len(tiempos) if tiempos else 0 for rol, tiempos in por_rol.items()}
    promedio_por_tarea = {tarea: sum(tiempos) / len(tiempos) if tiempos else 0 for tarea, tiempos in por_tarea.items()}

    # Calcular tasa de completación
    tasa_completacion = {
        tarea: (tareas_completadas[tarea] / tareas_totales[tarea] * 100) if tareas_totales[tarea] > 0 else 0
        for tarea in tareas_totales
    }

    contenido = [
        Paragraph("Mass · Reporte de Pruebas de Usabilidad", estilos["Title"]),
        Paragraph(f"Generado el {timezone.localtime():%d/%m/%Y %H:%M}.", estilos["Normal"]),
        Spacer(1, 0.5 * cm),
    ]

    # Gráfico 1: Tiempo promedio por rol
    contenido.append(Paragraph("Tiempo promedio por rol (segundos)", estilos["Heading2"]))
    filas_rol = [["Rol", "Tiempo promedio (s)"]]
    colores_rol = {"admin": azul, "vendedor": verde, "cliente": amarillo}
    for rol in ["admin", "vendedor", "cliente"]:
        filas_rol.append([rol.capitalize(), f"{promedio_por_rol[rol]:.1f}" if rol in promedio_por_rol else "—"])
    tabla_rol = Table(filas_rol, repeatRows=1, colWidths=[5 * cm, 5 * cm])
    tabla_rol.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), azul),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D3D7E6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
    ]))
    contenido.extend([tabla_rol, Spacer(1, 0.5 * cm)])

    # Gráfico 2: Tiempo promedio por tarea
    contenido.append(Paragraph("Tiempo promedio por tarea (segundos)", estilos["Heading2"]))
    filas_tarea = [["Tarea", "Tiempo promedio (s)"]]
    for tarea, tiempo in sorted(promedio_por_tarea.items(), key=lambda x: x[1], reverse=True):
        filas_tarea.append([tarea[:50], f"{tiempo:.1f}"])
    tabla_tarea = Table(filas_tarea, repeatRows=1, colWidths=[10 * cm, 5 * cm])
    tabla_tarea.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), azul),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D3D7E6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
    ]))
    contenido.extend([tabla_tarea, Spacer(1, 0.5 * cm)])

    # Gráfico 3: Tasa de completación por tarea
    contenido.append(Paragraph("Tasa de completación por tarea (%)", estilos["Heading2"]))
    filas_completacion = [["Tarea", "Completadas", "Tasa"]]
    for tarea, tasa in sorted(tasa_completacion.items(), key=lambda x: x[1], reverse=True):
        filas_completacion.append([
            tarea[:50],
            f"{tareas_completadas[tarea]}/{tareas_totales[tarea]}",
            f"{tasa:.1f}%"
        ])
    tabla_completacion = Table(filas_completacion, repeatRows=1, colWidths=[8 * cm, 3 * cm, 3 * cm])
    tabla_completacion.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), azul),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D3D7E6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (2, -1), "RIGHT"),
    ]))
    contenido.extend([tabla_completacion, Spacer(1, 0.5 * cm)])

    # Tabla detallada por usuario
    contenido.append(Paragraph("Detalle por usuario", estilos["Heading2"]))
    filas_detalle = [["Usuario", "Rol", "Tarea", "Tiempo (s)", "Completada"]]
    for prueba in datos_pruebas:
        for tarea in prueba["tareas"]:
            filas_detalle.append([
                prueba["usuario"],
                prueba["rol"],
                tarea["tarea"][:40],
                str(tarea["tiempo_segundos"]),
                "Sí" if tarea["completada"] else "No"
            ])
    tabla_detalle = Table(filas_detalle, repeatRows=1, colWidths=[3 * cm, 2 * cm, 6 * cm, 2 * cm, 2 * cm])
    tabla_detalle.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), azul),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D3D7E6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    contenido.append(tabla_detalle)

    doc.build(contenido)
    return salida.getvalue()
