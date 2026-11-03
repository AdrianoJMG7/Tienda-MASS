import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, conFiltros, descargar, ErrorApi, leerTokens } from "../../api";
import Campo from "../../componentes/Campo";
import Seleccion from "../../componentes/Seleccion";
import { formatoFecha, hoyIso, soles } from "../../formato";
import type { Paginado, PanelReportes, Tienda } from "../../tipos";
import { useCarga } from "../../useCarga";

interface TareaUsabilidad {
  tarea: string;
  tiempo_segundos: number;
  completada: boolean;
  observaciones: string;
}

interface PruebaUsabilidad {
  usuario: string;
  rol: "admin" | "vendedor" | "cliente";
  tareas: TareaUsabilidad[];
}

// Colores por canal (validados para daltonismo); el ámbar tiene poco contraste, por eso hay leyenda y tablas.
const COLOR = { caja: "#2a78d6", web: "#eda100" };
const TINTA = "#4a5170";
const REJILLA = "#e6e8f0";
const SUPERFICIE = "#ffffff";

const PERIODOS = [
  { dias: 7, texto: "7 días" },
  { dias: 30, texto: "30 días" },
  { dias: 90, texto: "90 días" },
];

const diaCorto = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" });
const fechaCorta = (iso: string) => diaCorto.format(new Date(`${iso}T12:00:00`));
const solesCortos = (valor: number) => (valor >= 1000 ? `S/ ${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)} mil` : `S/ ${valor}`);
const minutos = (valor: number | null) => (valor == null ? "—" : `${valor.toLocaleString("es-PE")} min`);

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="indicador">
      <span className="indicador-titulo">{titulo}</span>
      <strong className="indicador-valor">{valor}</strong>
      {detalle && <span className="dato-secundario">{detalle}</span>}
    </div>
  );
}

/** Tooltip con los montos en soles y el total de la barra apilada. */
function TooltipSoles({ active, payload, label, formatoEtiqueta }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatoEtiqueta?: (valor: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((suma, p) => suma + Number(p.value), 0);
  return (
    <div className="tooltip-grafico">
      <strong>{formatoEtiqueta && label ? formatoEtiqueta(label) : label}</strong>
      {payload.map((p) => (
        <span key={p.name}>
          <i className="muestra" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: {soles(Number(p.value))}
        </span>
      ))}
      {payload.length > 1 && <span className="tooltip-total">Total: {soles(total)}</span>}
    </div>
  );
}

/** HU16 y HU17: panel de ventas y pedidos por tienda y canal, exportable a Excel o PDF.
    HU18: generación de reporte de pruebas de usabilidad en PDF. */
export default function Reportes() {
  const [filtros, setFiltros] = useState({ desde: hoyIso(-29), hasta: hoyIso(), tienda: "" });
  const { datos, error, cargando } = useCarga<PanelReportes>(conFiltros("/reportes/panel/", filtros));
  const { datos: tiendas } = useCarga<Paginado<Tienda>>("/tiendas/tiendas/?page_size=100");
  const [exportando, setExportando] = useState<"" | "xlsx" | "pdf" | "usabilidad">("");
  const [errorExportar, setErrorExportar] = useState("");
  const [mostrarUsabilidad, setMostrarUsabilidad] = useState(false);
  const [datosUsabilidad, setDatosUsabilidad] = useState<PruebaUsabilidad[] | null>(null);

  const filtrar = (cambios: Partial<typeof filtros>) => setFiltros({ ...filtros, ...cambios });
  const periodoActivo = PERIODOS.find((p) => filtros.hasta === hoyIso() && filtros.desde === hoyIso(1 - p.dias));

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(formato);
    setErrorExportar("");
    try {
      await descargar(conFiltros("/reportes/exportar/", { ...filtros, formato }));
    } catch (e) {
      setErrorExportar(e instanceof ErrorApi ? e.message : "No se pudo descargar el reporte.");
    } finally {
      setExportando("");
    }
  }

  async function generarReporteUsabilidad() {
    setExportando("usabilidad");
    setErrorExportar("");
    try {
      const tokens = leerTokens();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tokens) headers["Authorization"] = `Bearer ${tokens.access}`;

      const respuesta = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/reportes/usabilidad/`, {
        method: "POST",
        headers,
        body: JSON.stringify(datosUsabilidad),
      });

      if (!respuesta.ok) {
        const texto = await respuesta.text();
        throw new ErrorApi(respuesta.status, texto || "No se pudo generar el reporte de usabilidad.");
      }

      const blob = await respuesta.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reporte-usabilidad-mass.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setErrorExportar(e instanceof ErrorApi ? e.message : "No se pudo generar el reporte de usabilidad.");
    } finally {
      setExportando("");
    }
  }

  function agregarPruebaUsabilidad() {
    setDatosUsabilidad((prev) => [...(prev || []), {
      usuario: "",
      rol: "admin",
      tareas: []
    }]);
  }

  function actualizarPrueba(index: number, campo: string, valor: string) {
    setDatosUsabilidad((prev) => {
      const nuevo = [...(prev || [])];
      nuevo[index] = { ...nuevo[index], [campo]: valor };
      return nuevo;
    });
  }

  function agregarTarea(pruebaIndex: number) {
    setDatosUsabilidad((prev) => {
      const nuevo = [...(prev || [])];
      nuevo[pruebaIndex].tareas.push({
        tarea: "",
        tiempo_segundos: 0,
        completada: false,
        observaciones: ""
      });
      return nuevo;
    });
  }

  function actualizarTarea(pruebaIndex: number, tareaIndex: number, campo: string, valor: string | number | boolean) {
    setDatosUsabilidad((prev) => {
      const nuevo = [...(prev || [])];
      nuevo[pruebaIndex].tareas[tareaIndex] = { ...nuevo[pruebaIndex].tareas[tareaIndex], [campo]: valor };
      return nuevo;
    });
  }

  const r = datos?.resumen;
  const canal = (c: "caja" | "web") => datos?.por_canal.find((x) => x.canal === c);
  const altoTiendas = Math.max(160, (datos?.por_tienda.length ?? 0) * 44 + 40);

  return (
    <section className="reportes">
      <div className="barra-titulo">
        <div>
          <h1>Reportes</h1>
          <p className="subtitulo">Ventas en caja y web, y pedidos online por tienda.</p>
        </div>
        <div className="acciones-exportar">
          <button type="button" className="boton secundario" disabled={!!exportando} onClick={() => exportar("xlsx")}>
            {exportando === "xlsx" ? "Generando…" : "Exportar Excel"}
          </button>
          <button type="button" className="boton secundario" disabled={!!exportando} onClick={() => exportar("pdf")}>
            {exportando === "pdf" ? "Generando…" : "Exportar PDF"}
          </button>
          <button type="button" className="boton secundario" disabled={!!exportando} onClick={() => setMostrarUsabilidad(!mostrarUsabilidad)}>
            {mostrarUsabilidad ? "Ocultar usabilidad" : "Reporte usabilidad"}
          </button>
        </div>
      </div>

      <div className="filtros filtros-reporte">
        <Campo etiqueta="Desde" type="date" value={filtros.desde} max={filtros.hasta} onChange={(e) => e.target.value && filtrar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={filtros.hasta} min={filtros.desde} max={hoyIso()} onChange={(e) => e.target.value && filtrar({ hasta: e.target.value })} />
        <Seleccion etiqueta="Tienda" value={filtros.tienda} onChange={(e) => filtrar({ tienda: e.target.value })}>
          <option value="">Todas las tiendas</option>
          {tiendas?.results?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.nombre}
            </option>
          ))}
        </Seleccion>
        <div className="periodos" role="group" aria-label="Periodo rápido">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              className={`chip${periodoActivo === p ? " activo" : ""}`}
              aria-pressed={periodoActivo === p}
              onClick={() => filtrar({ desde: hoyIso(1 - p.dias), hasta: hoyIso() })}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {errorExportar && <p className="alerta" role="alert">{errorExportar}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}
      {!datos && !error && <p className="estado">Cargando reportes…</p>}

      {datos && r && (
        <div className="panel-reportes" aria-busy={cargando}>
          <p className="dato-secundario" aria-live="polite">
            {datos.filtros.descripcion}
          </p>

          <div className="indicadores">
            <Indicador titulo="Ventas" valor={soles(r.total)} detalle={`${r.ventas.toLocaleString("es-PE")} tickets`} />
            <Indicador titulo="Ticket promedio" valor={soles(r.ticket_promedio)} detalle={`Caja ${soles(canal("caja")?.ticket_promedio ?? 0)} · Web ${soles(canal("web")?.ticket_promedio ?? 0)}`} />
            <Indicador titulo="Pedidos online" valor={r.pedidos.toLocaleString("es-PE")} detalle={`${r.pedidos_entregados} entregados · ${r.pedidos_cancelados} cancelados`} />
            <Indicador titulo="Preparación promedio" valor={minutos(r.minutos_preparacion)} detalle="Desde que se confirma hasta que está listo" />
          </div>

          <div className="tarjeta grafico">
            <h2>Ventas por día</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={datos.por_dia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} minTickGap={16} />
                <YAxis tickFormatter={solesCortos} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<TooltipSoles formatoEtiqueta={formatoFecha} />} cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} />
                <Legend iconType="circle" wrapperStyle={{ color: TINTA, fontSize: 14 }} />
                <Bar dataKey="caja" name="Caja" stackId="canal" fill={COLOR.caja} stroke={SUPERFICIE} strokeWidth={1} maxBarSize={28} />
                <Bar dataKey="web" name="Web" stackId="canal" fill={COLOR.web} stroke={SUPERFICIE} strokeWidth={1} maxBarSize={28} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <details>
              <summary>Ver como tabla</summary>
              <table className="tabla compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Caja</th>
                    <th>Web</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.por_dia.map((d) => (
                    <tr key={d.fecha}>
                      <td data-titulo="Fecha">{formatoFecha(d.fecha)}</td>
                      <td data-titulo="Caja">{soles(d.caja)}</td>
                      <td data-titulo="Web">{soles(d.web)}</td>
                      <td data-titulo="Total">{soles(d.caja + d.web)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          <div className="tarjeta grafico">
            <h2>Ventas por tienda y canal</h2>
            <ResponsiveContainer width="100%" height={altoTiendas}>
              <BarChart data={datos.por_tienda} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={REJILLA} />
                <XAxis type="number" tickFormatter={solesCortos} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nombre" tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} width={120} />
                <Tooltip content={<TooltipSoles />} cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} />
                <Legend iconType="circle" wrapperStyle={{ color: TINTA, fontSize: 14 }} />
                <Bar dataKey="caja" name="Caja" stackId="canal" fill={COLOR.caja} stroke={SUPERFICIE} strokeWidth={1} maxBarSize={24} />
                <Bar dataKey="web" name="Web" stackId="canal" fill={COLOR.web} stroke={SUPERFICIE} strokeWidth={1} maxBarSize={24} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="tabla compacta">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Caja</th>
                  <th>Web</th>
                  <th>Total</th>
                  <th>Ticket promedio</th>
                  <th>Pedidos</th>
                  <th>Preparación</th>
                </tr>
              </thead>
              <tbody>
                {datos.por_tienda.map((t) => (
                  <tr key={t.tienda}>
                    <td data-titulo="Tienda">
                      <strong>{t.nombre}</strong>
                      <small className="dato-secundario">{t.codigo}</small>
                    </td>
                    <td data-titulo="Caja">{soles(t.caja)}</td>
                    <td data-titulo="Web">{soles(t.web)}</td>
                    <td data-titulo="Total">
                      <strong>{soles(t.total)}</strong>
                    </td>
                    <td data-titulo="Ticket promedio">{soles(t.ticket_promedio)}</td>
                    <td data-titulo="Pedidos">{t.pedidos}</td>
                    <td data-titulo="Preparación">{minutos(t.minutos_preparacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rejilla-reportes">
            <div className="tarjeta grafico">
              <h2>Pedidos online por estado</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datos.por_estado} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="estado_display" tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} width={130} />
                  <Tooltip cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} formatter={(valor) => [valor, "Pedidos"]} />
                  <Bar dataKey="pedidos" name="Pedidos" fill={COLOR.caja} maxBarSize={22} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="pedidos" position="right" fill={TINTA} fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="tarjeta">
              <h2>Productos más vendidos</h2>
              {datos.top_productos.length === 0 ? (
                <p className="estado">Sin ventas en el periodo.</p>
              ) : (
                <ol className="top-productos">
                  {datos.top_productos.map((p) => (
                    <li key={p.producto}>
                      <span>
                        {p.nombre}
                        <small className="dato-secundario">{p.marca}</small>
                      </span>
                      <span className="top-cifras">
                        <strong>{p.unidades.toLocaleString("es-PE")} u.</strong>
                        <small className="dato-secundario">{soles(p.total)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarUsabilidad && (
        <div className="tarjeta tarjeta-usabilidad">
          <div className="barra-titulo">
            <div>
              <h2>Reporte de Pruebas de Usabilidad (HU18)</h2>
              <p className="subtitulo">Ingresa los datos de las pruebas de usabilidad para generar el reporte PDF.</p>
            </div>
            <div className="acciones-exportar">
              <button type="button" className="boton" disabled={!!exportando || !datosUsabilidad?.length} onClick={agregarPruebaUsabilidad}>
                Agregar prueba
              </button>
              <button type="button" className="boton secundario" disabled={!!exportando || !datosUsabilidad?.length} onClick={generarReporteUsabilidad}>
                {exportando === "usabilidad" ? "Generando…" : "Generar PDF"}
              </button>
            </div>
          </div>

          {errorExportar && <p className="alerta" role="alert">{errorExportar}</p>}

          {!datosUsabilidad?.length ? (
            <p className="estado">No hay pruebas de usabilidad registradas. Agrega una prueba para comenzar.</p>
          ) : (
            <div className="pruebas-usabilidad">
              {datosUsabilidad.map((prueba: any, pruebaIndex: number) => (
                <div key={pruebaIndex} className="tarjeta-prueba">
                  <div className="fila-prueba">
                    <Campo
                      etiqueta="Usuario"
                      value={prueba.usuario}
                      onChange={(e) => actualizarPrueba(pruebaIndex, "usuario", e.target.value)}
                    />
                    <Seleccion
                      etiqueta="Rol"
                      value={prueba.rol}
                      onChange={(e) => actualizarPrueba(pruebaIndex, "rol", e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="cliente">Cliente</option>
                    </Seleccion>
                  </div>

                  <div className="seccion-tareas">
                    <div className="cabecera-tareas">
                      <h3>Tareas</h3>
                      <button type="button" className="boton secundario" onClick={() => agregarTarea(pruebaIndex)}>
                        Agregar tarea
                      </button>
                    </div>

                    {prueba.tareas.map((tarea: any, tareaIndex: number) => (
                      <div key={tareaIndex} className="tarea-item">
                        <div className="fila-tarea">
                          <Campo
                            etiqueta="Tarea"
                            value={tarea.tarea}
                            onChange={(e) => actualizarTarea(pruebaIndex, tareaIndex, "tarea", e.target.value)}
                          />
                          <Campo
                            etiqueta="Tiempo (s)"
                            type="number"
                            min="0"
                            value={tarea.tiempo_segundos}
                            onChange={(e) => actualizarTarea(pruebaIndex, tareaIndex, "tiempo_segundos", parseInt(e.target.value) || 0)}
                          />
                          <label className="checkbox-tarea">
                            <input
                              type="checkbox"
                              checked={tarea.completada}
                              onChange={(e) => actualizarTarea(pruebaIndex, tareaIndex, "completada", e.target.checked)}
                            />
                            Completada
                          </label>
                        </div>
                        <Campo
                          etiqueta="Observaciones"
                          value={tarea.observaciones || ""}
                          onChange={(e) => actualizarTarea(pruebaIndex, tareaIndex, "observaciones", e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
