import { useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { conFiltros, descargar, ErrorApi } from "../../api";
import Campo from "../../componentes/Campo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import TarjetaIndicador from "../../componentes/TarjetaIndicador";
import { formatoFecha, hoyIso, soles } from "../../formato";
import type { PanelReportes, Tienda } from "../../tipos";
import { useCarga } from "../../useCarga";
import ReporteUsabilidad from "./ReporteUsabilidad";

// Colores validados para daltonismo, en orden fijo; siempre van con leyenda y cifras porque el ámbar contrasta poco.
const COLORES = ["#2a78d6", "#eda100", "#6250d6", "#1baf7a"];
const COLOR = { caja: COLORES[0], web: COLORES[1] };
const TINTA = "#4a5170";
const REJILLA = "#e6e8f0";

const PESTANAS = ["Ventas", "Productos", "Tiendas", "Vendedores", "Pedidos", "Ofertas", "Usabilidad"] as const;
type Pestana = (typeof PESTANAS)[number];

const PERIODOS = [
  { valor: "7", texto: "Últimos 7 días" },
  { valor: "30", texto: "Últimos 30 días" },
  { valor: "90", texto: "Últimos 90 días" },
  { valor: "otro", texto: "Otro periodo" },
];

const ETIQUETA_OFERTA = { vigente: "Vigente", programada: "Programada", vencida: "Vencida" };
const CLASE_OFERTA = { vigente: "disponible", programada: "bajo_stock", vencida: "inactivo" };

const diaCorto = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit" });
const fechaCorta = (iso: string) => diaCorto.format(new Date(`${iso}T12:00:00`));
const compacto = (valor: number) => (valor >= 1000 ? `${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)}k` : String(valor));
const minutos = (valor: number | null) => (valor == null ? "—" : `${valor.toLocaleString("es-PE")} min`);

function Variacion({ valor }: { valor: number | null }) {
  if (valor == null) return <>—</>;
  return (
    <span className={`pastilla-variacion ${valor < 0 ? "baja" : "sube"}`}>
      <Icono nombre={valor < 0 ? "flechaBaja" : "flechaSube"} tamano={14} />
      {valor > 0 ? "+" : ""}
      {valor}%
    </span>
  );
}

/** Tabla comparativa de las tiendas; se usa en las pestañas Ventas y Tiendas. */
function ResumenTiendas({ datos, completo = false }: { datos: PanelReportes; completo?: boolean }) {
  return (
    <table className="tabla tabla-vendedor">
      <thead>
        <tr>
          <th>Tienda</th>
          {completo && <th>Caja</th>}
          {completo && <th>Web</th>}
          <th>Ventas totales</th>
          <th>Pedidos</th>
          <th>Ticket promedio</th>
          {completo && <th>Preparación</th>}
          <th>Variación</th>
        </tr>
      </thead>
      <tbody>
        {datos.por_tienda.map((t) => (
          <tr key={t.tienda}>
            <td data-titulo="Tienda">{t.codigo} - {t.nombre}</td>
            {completo && <td data-titulo="Caja">{soles(t.caja)}</td>}
            {completo && <td data-titulo="Web">{soles(t.web)}</td>}
            <td data-titulo="Ventas totales">{soles(t.total)}</td>
            <td data-titulo="Pedidos">{t.pedidos.toLocaleString("es-PE")}</td>
            <td data-titulo="Ticket promedio">{soles(t.ticket_promedio)}</td>
            {completo && <td data-titulo="Preparación">{minutos(t.minutos_preparacion)}</td>}
            <td data-titulo="Variación"><Variacion valor={t.variacion} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PestanaVentas({ datos }: { datos: PanelReportes }) {
  const porDia = datos.por_dia.map((d) => ({ fecha: d.fecha, total: d.caja + d.web }));
  // Las tres categorías mayores y el resto junto, para no pasar de cuatro colores.
  const mayores = datos.por_categoria.slice(0, 3);
  const resto = datos.por_categoria.slice(3);
  const categorias = resto.length
    ? [...mayores, { categoria: "Otros", total: resto.reduce((s, c) => s + c.total, 0), porcentaje: resto.reduce((s, c) => s + c.porcentaje, 0) }]
    : mayores;
  const primera = categorias[0];

  return (
    <div className="rejilla-admin">
      <div className="tarjeta">
        <h2 className="titulo-tarjeta">Ventas por día</h2>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={porDia} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={REJILLA} vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} minTickGap={32} />
            <YAxis tickFormatter={compacto} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip formatter={(valor) => [soles(Number(valor)), "Ventas"]} labelFormatter={(iso) => formatoFecha(String(iso))} />
            <Area type="monotone" dataKey="total" stroke={COLORES[0]} strokeWidth={2} fill={COLORES[0]} fillOpacity={0.12} dot={porDia.length <= 31 ? { r: 3, fill: COLORES[0] } : false} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="tarjeta">
        <h2 className="titulo-tarjeta">Ventas por categoría</h2>
        {categorias.length === 0 ? (
          <p className="venta-vacia">Sin ventas en el periodo.</p>
        ) : (
          <div className="desglose-pago">
            <div className="dona">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={categorias} dataKey="total" nameKey="categoria" innerRadius={58} outerRadius={90} startAngle={90} endAngle={-270} stroke="#ffffff" strokeWidth={2}>
                    {categorias.map((c, i) => (
                      <Cell key={c.categoria} fill={COLORES[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(valor, nombre) => [soles(Number(valor)), String(nombre)]} />
                </PieChart>
              </ResponsiveContainer>
              <p className="dona-centro">
                <strong className="dona-grande">{primera.porcentaje}%</strong>
                <small>{primera.categoria}</small>
              </p>
            </div>
            <ul className="leyenda-pago leyenda-corta">
              {categorias.map((c, i) => (
                <li key={c.categoria}>
                  <i style={{ background: COLORES[i] }} aria-hidden="true" />
                  <span>{c.categoria}</span>
                  <strong>{c.porcentaje}%</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="tarjeta contenedor-tabla">
        <h2 className="titulo-tarjeta">Resumen por tienda</h2>
        <ResumenTiendas datos={datos} />
      </div>

      <div className="banda-reportes">
        <Icono nombre="info" tamano={26} />
        <p>La variación compara el periodo elegido con el periodo anterior de la misma duración. Los datos se calculan al abrir o filtrar el reporte.</p>
        <span aria-hidden="true"><Icono nombre="grafico" tamano={64} /></span>
      </div>
    </div>
  );
}

function PestanaProductos({ datos }: { datos: PanelReportes }) {
  return (
    <div className="rejilla-admin">
      <div className="tarjeta contenedor-tabla">
        <h2 className="titulo-tarjeta">Productos más vendidos</h2>
        <table className="tabla tabla-vendedor">
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Marca</th>
              <th>Unidades</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.top_productos.map((p, i) => (
              <tr key={p.producto}>
                <td data-titulo="#">{i + 1}</td>
                <td data-titulo="Producto">{p.nombre}</td>
                <td data-titulo="Marca">{p.marca}</td>
                <td data-titulo="Unidades">{p.unidades.toLocaleString("es-PE")}</td>
                <td data-titulo="Total">{soles(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {datos.top_productos.length === 0 && <p className="venta-vacia">Sin ventas en el periodo.</p>}
      </div>
      <div className="tarjeta contenedor-tabla">
        <h2 className="titulo-tarjeta">Todas las categorías</h2>
        <table className="tabla tabla-vendedor">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Total</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {datos.por_categoria.map((c) => (
              <tr key={c.categoria}>
                <td data-titulo="Categoría">{c.categoria}</td>
                <td data-titulo="Total">{soles(c.total)}</td>
                <td data-titulo="%">{c.porcentaje}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PestanaTiendas({ datos }: { datos: PanelReportes }) {
  return (
    <div className="columna-admin">
      <div className="tarjeta">
        <h2 className="titulo-tarjeta">Ventas por tienda y canal</h2>
        <ResponsiveContainer width="100%" height={Math.max(180, datos.por_tienda.length * 46 + 50)}>
          <BarChart data={datos.por_tienda} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={REJILLA} />
            <XAxis type="number" tickFormatter={compacto} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nombre" tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} width={130} />
            <Tooltip formatter={(valor, nombre) => [soles(Number(valor)), String(nombre)]} cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} />
            <Legend iconType="circle" wrapperStyle={{ color: TINTA, fontSize: 14 }} />
            <Bar dataKey="caja" name="Caja" stackId="canal" fill={COLOR.caja} stroke="#ffffff" maxBarSize={24} />
            <Bar dataKey="web" name="Web" stackId="canal" fill={COLOR.web} stroke="#ffffff" maxBarSize={24} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="tarjeta contenedor-tabla">
        <h2 className="titulo-tarjeta">Comparativo de tiendas</h2>
        <ResumenTiendas datos={datos} completo />
      </div>
    </div>
  );
}

function PestanaVendedores({ datos }: { datos: PanelReportes }) {
  return (
    <div className="tarjeta contenedor-tabla">
      <h2 className="titulo-tarjeta">Ventas por vendedor</h2>
      <table className="tabla tabla-vendedor">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Tienda</th>
            <th>Ventas</th>
            <th>Total</th>
            <th>Ticket promedio</th>
          </tr>
        </thead>
        <tbody>
          {datos.por_vendedor.map((v) => (
            <tr key={`${v.vendedor}-${v.tienda}`}>
              <td data-titulo="Vendedor">{v.vendedor}</td>
              <td data-titulo="Tienda">{v.tienda}</td>
              <td data-titulo="Ventas">{v.ventas.toLocaleString("es-PE")}</td>
              <td data-titulo="Total">{soles(v.total)}</td>
              <td data-titulo="Ticket promedio">{soles(v.ticket_promedio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {datos.por_vendedor.length === 0 && <p className="venta-vacia">Sin ventas en el periodo.</p>}
    </div>
  );
}

function PestanaPedidos({ datos }: { datos: PanelReportes }) {
  return (
    <div className="rejilla-admin">
      <div className="tarjeta">
        <h2 className="titulo-tarjeta">Pedidos online por estado</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={datos.por_estado} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="estado_display" tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} width={130} />
            <Tooltip formatter={(valor) => [String(valor), "Pedidos"]} cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} />
            <Bar dataKey="pedidos" fill={COLORES[0]} maxBarSize={22} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="pedidos" position="right" fill={TINTA} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="tarjeta contenedor-tabla">
        <h2 className="titulo-tarjeta">Ventas por canal</h2>
        <table className="tabla tabla-vendedor">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Ventas</th>
              <th>Total</th>
              <th>Ticket promedio</th>
            </tr>
          </thead>
          <tbody>
            {datos.por_canal.map((c) => (
              <tr key={c.canal}>
                <td data-titulo="Canal">{c.canal_display}</td>
                <td data-titulo="Ventas">{c.ventas.toLocaleString("es-PE")}</td>
                <td data-titulo="Total">{soles(c.total)}</td>
                <td data-titulo="Ticket promedio">{soles(c.ticket_promedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="banda-info">
          <Icono nombre="reloj" tamano={22} />
          Preparación promedio: <strong>{minutos(datos.resumen.minutos_preparacion)}</strong>, desde que se confirma el pedido hasta que está listo.
        </p>
      </div>
    </div>
  );
}

function PestanaOfertas({ datos }: { datos: PanelReportes }) {
  return (
    <div className="tarjeta contenedor-tabla">
      <h2 className="titulo-tarjeta">Ofertas del periodo</h2>
      <p className="subtitulo">Lo vendido de cada producto mientras su oferta estuvo activa.</p>
      <table className="tabla tabla-vendedor">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Normal</th>
            <th>Oferta</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Unidades</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {datos.ofertas.map((o) => (
            <tr key={o.oferta}>
              <td data-titulo="Producto">
                {o.producto}
                <small className="dato-secundario">{o.marca}</small>
              </td>
              <td data-titulo="Normal">{soles(o.precio_normal)}</td>
              <td data-titulo="Oferta">{soles(o.precio_especial)}</td>
              <td data-titulo="Vigencia">{formatoFecha(o.inicio)} – {formatoFecha(o.fin)}</td>
              <td data-titulo="Estado">
                <span className={`estado-stock ${CLASE_OFERTA[o.estado]}`}>
                  <i aria-hidden="true" /> {ETIQUETA_OFERTA[o.estado]}
                </span>
              </td>
              <td data-titulo="Unidades">{o.unidades.toLocaleString("es-PE")}</td>
              <td data-titulo="Total">{soles(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {datos.ofertas.length === 0 && <p className="venta-vacia">No hubo ofertas en el periodo.</p>}
    </div>
  );
}

/** HU16 y HU17: panel de ventas y pedidos de toda la cadena, exportable a Excel o PDF. HU18: reporte de usabilidad. */
export default function Reportes() {
  const [pestana, setPestana] = useState<Pestana>("Ventas");
  const [periodo, setPeriodo] = useState("30");
  const [fechas, setFechas] = useState({ desde: hoyIso(-29), hasta: hoyIso() });
  const [tienda, setTienda] = useState("");
  const filtros = { ...fechas, tienda };
  const { datos, error, cargando } = useCarga<PanelReportes>(conFiltros("/reportes/panel/", filtros));
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);

  function elegirPeriodo(valor: string) {
    setPeriodo(valor);
    if (valor !== "otro") setFechas({ desde: hoyIso(1 - Number(valor)), hasta: hoyIso() });
  }

  async function exportar(formato: "xlsx" | "pdf") {
    if (menu.current) menu.current.open = false;
    setExportando(true);
    setErrorExportar("");
    try {
      await descargar(conFiltros("/reportes/exportar/", { ...filtros, formato }));
    } catch (e) {
      setErrorExportar(e instanceof ErrorApi ? e.message : "No se pudo descargar el reporte.");
    } finally {
      setExportando(false);
    }
  }

  const r = datos?.resumen;

  return (
    <section className="reportes-admin">
      <EncabezadoPagina icono="barras" titulo="Reportes" subtitulo="Consulta el desempeño de tus tiendas y de la cadena." />

      <div className="filtros-admin">
        <div className="pestanas-vendedor azules" role="group" aria-label="Sección del reporte">
          {PESTANAS.map((p) => (
            <button key={p} type="button" className={pestana === p ? "activa" : undefined} aria-pressed={pestana === p} onClick={() => setPestana(p)}>
              {p}
            </button>
          ))}
        </div>
        {pestana !== "Usabilidad" && <div className="acciones-reporte accion-derecha">
          <span className="filtro-icono">
            <Icono nombre="tienda" />
            <label htmlFor="reporte-tienda" className="solo-lector">Tienda</label>
            <select id="reporte-tienda" value={tienda} onChange={(e) => setTienda(e.target.value)}>
              <option value="">Todas las tiendas</option>
              {tiendas?.map((t) => (
                <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>
              ))}
            </select>
          </span>
          <span className="filtro-icono">
            <Icono nombre="calendario" />
            <label htmlFor="reporte-periodo" className="solo-lector">Periodo</label>
            <select id="reporte-periodo" value={periodo} onChange={(e) => elegirPeriodo(e.target.value)}>
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>{p.texto}</option>
              ))}
            </select>
          </span>
          <details className="menu-cuenta menu-descarga" ref={menu}>
            <summary className="boton-primario">
              <Icono nombre="descargar" /> {exportando ? "Generando…" : "Descargar reporte"}
            </summary>
            <div className="menu-cuenta-lista">
              <button type="button" onClick={() => exportar("xlsx")}><Icono nombre="documento" /> Excel</button>
              <button type="button" onClick={() => exportar("pdf")}><Icono nombre="imprimir" /> PDF</button>
            </div>
          </details>
        </div>}
      </div>

      {periodo === "otro" && pestana !== "Usabilidad" && (
        <div className="fechas-reporte">
          <Campo etiqueta="Desde" type="date" value={fechas.desde} max={fechas.hasta} onChange={(e) => e.target.value && setFechas({ ...fechas, desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" value={fechas.hasta} min={fechas.desde} max={hoyIso()} onChange={(e) => e.target.value && setFechas({ ...fechas, hasta: e.target.value })} />
        </div>
      )}

      {errorExportar && <p className="alerta" role="alert">{errorExportar}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}
      {!datos && !error && <p className="estado">Cargando reportes…</p>}

      {datos && r && pestana !== "Usabilidad" && (
        <div className="columna-admin" aria-busy={cargando}>
          <div className="indicadores-vendedor cuatro">
            <TarjetaIndicador icono="carrito" titulo="Total de ventas" valor={soles(r.total)} variacion={datos.variacion.total} />
            <TarjetaIndicador icono="documento" titulo="Pedidos realizados" valor={r.pedidos.toLocaleString("es-PE")} variacion={datos.variacion.pedidos} />
            <TarjetaIndicador icono="usuarios" titulo="Clientes únicos (online)" valor={datos.clientes_unicos.toLocaleString("es-PE")} variacion={datos.variacion.clientes} />
            <TarjetaIndicador icono="tienda" titulo="Ticket promedio" valor={soles(r.ticket_promedio)} variacion={datos.variacion.ticket_promedio} />
          </div>
          {pestana === "Ventas" && <PestanaVentas datos={datos} />}
          {pestana === "Productos" && <PestanaProductos datos={datos} />}
          {pestana === "Tiendas" && <PestanaTiendas datos={datos} />}
          {pestana === "Vendedores" && <PestanaVendedores datos={datos} />}
          {pestana === "Pedidos" && <PestanaPedidos datos={datos} />}
          {pestana === "Ofertas" && <PestanaOfertas datos={datos} />}
        </div>
      )}
      {pestana === "Usabilidad" && <ReporteUsabilidad />}
    </section>
  );
}
