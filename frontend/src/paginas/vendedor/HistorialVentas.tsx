import { useState } from "react";
import { Link } from "react-router";
import { conFiltros, descargar, ErrorApi } from "../../api";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import TarjetaIndicador from "../../componentes/TarjetaIndicador";
import { formatoFechaHora, hoyIso, soles } from "../../formato";
import type { EstadoVenta, Paginado, Venta } from "../../tipos";
import { useCarga, useRetraso } from "../../useCarga";

const POR_PAGINA = 8;

interface Resumen {
  hoy: number;
  hoy_variacion: number | null;
  semana: number;
  semana_variacion: number | null;
  mes: number;
  meta_mensual: number;
}

const inicioSemana = () => hoyIso(-((new Date().getDay() + 6) % 7));
const inicioMes = () => hoyIso(1 - new Date().getDate());

const PERIODOS = [
  { texto: "Hoy", desde: () => hoyIso() },
  { texto: "Esta semana", desde: inicioSemana },
  { texto: "Este mes", desde: inicioMes },
];

const ICONO_ESTADO: Record<EstadoVenta, "check" | "info" | "devolver"> = {
  completada: "check",
  devolucion_parcial: "info",
  devuelta: "devolver",
};

function InsigniaVenta({ venta }: { venta: Venta }) {
  return (
    <span className={`insignia-venta ${venta.estado}`}>
      <Icono nombre={ICONO_ESTADO[venta.estado]} tamano={16} /> {venta.estado_nombre}
    </span>
  );
}

function DetalleVenta({ venta, alCerrar }: { venta: Venta; alCerrar: () => void }) {
  return (
    <div className="detalle-venta">
      <div className="detalle-venta-titulo">
        <h3>Venta {venta.numero_ticket}</h3>
        <InsigniaVenta venta={venta} />
      </div>
      <p className="detalle-venta-datos">
        <span className="con-icono"><Icono nombre="calendario" tamano={16} /> {formatoFechaHora(venta.fecha)}</span>
        <span className="con-icono"><Icono nombre="usuario" tamano={16} /> {venta.cliente_nombre ?? "Cliente en tienda"}</span>
      </p>
      <table className="tabla-venta">
        <thead>
          <tr>
            <th>Productos</th>
            <th>Cant.</th>
            <th className="numero">Precio unit.</th>
            <th className="numero">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalles.map((d) => (
            <tr key={d.id}>
              <td>
                <span className="producto-celda">
                  <FotoProducto producto={{ foto: d.producto_foto, nombre: d.producto_nombre }} tamano={36} />
                  <span>
                    {d.producto_nombre}
                    {d.devuelto > 0 && <small className="dato-secundario">{d.devuelto} devuelta(s)</small>}
                  </span>
                </span>
              </td>
              <td>{d.cantidad}</td>
              <td className="numero">{soles(d.precio_unitario)}</td>
              <td className="numero">{soles(d.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="totales-venta">
        <div className="total"><dt>Total:</dt><dd>{soles(venta.total)}</dd></div>
        <div><dt>Medio de pago:</dt><dd>{venta.medio_pago_display}</dd></div>
        {venta.monto_recibido != null && <div><dt>Monto recibido:</dt><dd>{soles(venta.monto_recibido)}</dd></div>}
        {venta.vuelto != null && <div><dt>Vuelto:</dt><dd>{soles(venta.vuelto)}</dd></div>}
      </dl>
      <div className="acciones-dialogo">
        {venta.estado !== "devuelta" && (
          <Link to={`/vendedor/devoluciones?ticket=${encodeURIComponent(venta.numero_ticket)}`} className="boton-contorno pequeno">
            <Icono nombre="devolver" tamano={18} /> Devolver
          </Link>
        )}
        <button type="button" className="boton-primario" onClick={alCerrar}>
          <Icono nombre="check" /> Cerrar
        </button>
      </div>
    </div>
  );
}

/** Registro de las ventas de la tienda, con totales del periodo, filtros y exportación a Excel. */
export default function HistorialVentas() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(() => hoyIso());
  const [estado, setEstado] = useState("");
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [errorExportar, setErrorExportar] = useState("");
  const [exportando, setExportando] = useState(false);
  const q = useRetraso(texto.trim());

  const filtros = { desde, hasta, estado, q };
  const { datos: resumen } = useCarga<Resumen>("/ventas/ventas/resumen/");
  const { datos, error, cargando } = useCarga<Paginado<Venta>>(conFiltros("/ventas/ventas/", { ...filtros, page: pagina, page_size: POR_PAGINA }));

  const filtrar = (cambio: () => void) => {
    cambio();
    setPagina(1);
  };

  async function exportar() {
    setErrorExportar("");
    setExportando(true);
    try {
      await descargar(conFiltros("/ventas/ventas/exportar/", filtros));
    } catch (e) {
      setErrorExportar(e instanceof ErrorApi ? e.message : "No se pudo descargar el reporte.");
    } finally {
      setExportando(false);
    }
  }

  const avanceMeta = resumen ? Math.min(100, (resumen.mes / resumen.meta_mensual) * 100) : 0;

  return (
    <section className="pagina-historial">
      <EncabezadoPagina icono="grafico" titulo="Historial de ventas" subtitulo="Registro de todas las ventas de tu tienda.">
        <button type="button" className="boton-contorno" disabled={exportando} onClick={exportar}>
          <Icono nombre="descargar" /> {exportando ? "Generando…" : "Exportar reporte"}
        </button>
      </EncabezadoPagina>

      <div className="indicadores-vendedor tres">
        <TarjetaIndicador icono="calendario" titulo="Ventas hoy" valor={soles(resumen?.hoy ?? 0)} variacion={resumen?.hoy_variacion} referencia="vs ayer" />
        <TarjetaIndicador icono="calendario" titulo="Ventas esta semana" valor={soles(resumen?.semana ?? 0)} variacion={resumen?.semana_variacion} referencia="vs semana pasada" />
        <TarjetaIndicador icono="monedas" titulo="Ventas este mes" valor={soles(resumen?.mes ?? 0)}>
          {resumen && (
            <span className="meta-mes">
              <span className="barra-meta" role="progressbar" aria-valuenow={Math.round(avanceMeta)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la meta del mes">
                <i style={{ width: `${avanceMeta}%` }} />
              </span>
              Meta: {soles(resumen.meta_mensual)}
            </span>
          )}
        </TarjetaIndicador>
      </div>

      <div className="filtros-historial">
        <div className="rango-fechas">
          <Icono nombre="calendario" />
          <label className="solo-lector" htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={desde} max={hasta} onChange={(e) => e.target.value && filtrar(() => setDesde(e.target.value))} />
          <span aria-hidden="true">–</span>
          <label className="solo-lector" htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={hasta} min={desde} max={hoyIso()} onChange={(e) => e.target.value && filtrar(() => setHasta(e.target.value))} />
        </div>
        <div className="chips-categorias" role="group" aria-label="Periodo rápido">
          {PERIODOS.map((p) => {
            const activo = desde === p.desde() && hasta === hoyIso();
            return (
              <button
                key={p.texto}
                type="button"
                className={`chip-amarillo${activo ? " activo" : ""}`}
                aria-pressed={activo}
                onClick={() =>
                  filtrar(() => {
                    setDesde(p.desde());
                    setHasta(hoyIso());
                  })
                }
              >
                {p.texto}
              </button>
            );
          })}
        </div>
        <div className="filtro-estado">
          <label htmlFor="estado-venta">Estado:</label>
          <select id="estado-venta" className="selector-pastilla" value={estado} onChange={(e) => filtrar(() => setEstado(e.target.value))}>
            <option value="">Todas</option>
            <option value="completada">Completadas</option>
            <option value="devolucion_parcial">Devolución parcial</option>
            <option value="devuelta">Devueltas</option>
          </select>
        </div>
        <div className="buscador">
          <Icono nombre="buscar" />
          <label htmlFor="buscar-venta" className="solo-lector">Buscar por ticket o cliente</label>
          <input id="buscar-venta" type="search" placeholder="Buscar por ticket, cliente…" value={texto} onChange={(e) => filtrar(() => setTexto(e.target.value))} />
        </div>
      </div>

      {(error || errorExportar) && <p className="alerta" role="alert">{errorExportar || error}</p>}

      <div className="tarjeta contenedor-tabla">
        <table className="tabla tabla-vendedor" aria-busy={cargando}>
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Ticket</th>
              <th>Cliente</th>
              <th>Items</th>
              <th>Total</th>
              <th>Medio de pago</th>
              <th>Estado</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos?.results.map((v) => {
              const unidades = v.detalles.reduce((suma, d) => suma + d.cantidad, 0);
              return (
                <tr key={v.id}>
                  <td data-titulo="Fecha y hora">{formatoFechaHora(v.fecha)}</td>
                  <td data-titulo="Ticket">{v.numero_ticket}</td>
                  <td data-titulo="Cliente">{v.cliente_nombre ?? "Cliente en tienda"}</td>
                  <td data-titulo="Items">{unidades} {unidades === 1 ? "producto" : "productos"}</td>
                  <td data-titulo="Total">{soles(v.total)}</td>
                  <td data-titulo="Medio de pago">{v.medio_pago_display}</td>
                  <td data-titulo="Estado"><InsigniaVenta venta={v} /></td>
                  <td data-titulo="Acciones">
                    <button type="button" className="boton-contorno pequeno" onClick={() => setDetalle(v)}>
                      <Icono nombre="ojo" tamano={18} /> Ver detalles<span className="solo-lector"> de {v.numero_ticket}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {datos?.results.length === 0 && <p className="estado">No hay ventas con esos filtros.</p>}
      </div>
      <div className="pie-tabla fuera">
        <Paginacion pagina={pagina} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={setPagina} />
        <span>
          {datos && datos.count > 0 && `Mostrando ${(pagina - 1) * POR_PAGINA + 1} - ${Math.min(pagina * POR_PAGINA, datos.count)} de ${datos.count} ventas`}
        </span>
      </div>

      <Dialogo titulo="Detalles de venta" abierto={detalle !== null} alCerrar={() => setDetalle(null)} variante="lateral">
        {detalle && <DetalleVenta venta={detalle} alCerrar={() => setDetalle(null)} />}
      </Dialogo>
    </section>
  );
}
