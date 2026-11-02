import { useState } from "react";
import { conFiltros, registrarIngreso, registrarMerma } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import Seleccion from "../../componentes/Seleccion";
import { formatoFecha } from "../../formato";
import type { AlertasResponse, Stock } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

const ESTADOS = [
  { valor: "", texto: "Todos" },
  { valor: "bajo_stock", texto: "Bajo stock" },
  { valor: "por_vencer", texto: "Por vencer" },
];

const MOTIVOS_MERMA = [
  { valor: "vencido", texto: "Vencido" },
  { valor: "dañado", texto: "Dañado" },
];

/** HU14: consultar stock y alertas. HU15: registrar ingresos y mermas. */
export default function Inventario() {
  const [filtros, setFiltros] = useState({ q: "", estado: "" });
  const [modalIngreso, setModalIngreso] = useState(false);
  const [modalMerma, setModalMerma] = useState(false);
  const [productoIngreso, setProductoIngreso] = useState("");
  const [cantidadIngreso, setCantidadIngreso] = useState("");
  const [vencimientoIngreso, setVencimientoIngreso] = useState("");
  const [motivoIngreso, setMotivoIngreso] = useState("");
  const [productoMerma, setProductoMerma] = useState("");
  const [cantidadMerma, setCantidadMerma] = useState("");
  const [motivoMerma, setMotivoMerma] = useState("vencido");
  const [notaMerma, setNotaMerma] = useState("");

  const { datos: inventario, error, cargando, recargar } = useCarga<Stock[]>(
    conFiltros("/inventario/inventario/", filtros),
  );
  const { datos: alertas, recargar: recargarAlertas } = useCarga<AlertasResponse>("/inventario/inventario/alertas/");

  const { enviando: enviandoIngreso, enviar: enviarIngreso, general: errorIngreso } = useEnvio();
  const { enviando: enviandoMerma, enviar: enviarMerma, general: errorMerma } = useEnvio();

  async function handleSubmitIngreso(evento: React.FormEvent) {
    evento.preventDefault();
    const ok = await enviarIngreso(() =>
      registrarIngreso([
        {
          producto: Number(productoIngreso),
          cantidad: Number(cantidadIngreso),
          fecha_vencimiento: vencimientoIngreso || undefined,
          motivo: motivoIngreso,
        },
      ]),
    );
    if (ok) {
      setModalIngreso(false);
      setProductoIngreso("");
      setCantidadIngreso("");
      setVencimientoIngreso("");
      setMotivoIngreso("");
      recargar();
      recargarAlertas();
    }
  }

  async function handleSubmitMerma(evento: React.FormEvent) {
    evento.preventDefault();
    const ok = await enviarMerma(() =>
      registrarMerma([
        {
          producto: Number(productoMerma),
          cantidad: Number(cantidadMerma),
          motivo: motivoMerma as "vencido" | "dañado",
          nota: notaMerma,
        },
      ]),
    );
    if (ok) {
      setModalMerma(false);
      setProductoMerma("");
      setCantidadMerma("");
      setNotaMerma("");
      recargar();
      recargarAlertas();
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Inventario</h1>
          <p className="subtitulo">Stock de tu tienda, alertas y movimientos</p>
        </div>
        <div className="acciones">
          <button type="button" className="boton secundario" onClick={() => setModalIngreso(true)}>
            Registrar ingreso
          </button>
          <button type="button" className="boton secundario" onClick={() => setModalMerma(true)}>
            Registrar merma
          </button>
        </div>
      </div>

      {alertas && (alertas.resumen.bajo_stock_count > 0 || alertas.resumen.por_vencer_count > 0) && (
        <section className="alertas-inventario">
          {alertas.resumen.bajo_stock_count > 0 && (
            <div className="alerta-stock bajo">
              <h3>⚠️ Stock bajo</h3>
              <p>{alertas.resumen.bajo_stock_count} productos están por debajo del mínimo</p>
            </div>
          )}
          {alertas.resumen.por_vencer_count > 0 && (
            <div className="alerta-stock vencimiento">
              <h3>📅 Por vencer</h3>
              <p>{alertas.resumen.por_vencer_count} productos vencen en los próximos 7 días</p>
            </div>
          )}
        </section>
      )}

      <div className="filtros filtros-catalogo">
        <Campo
          etiqueta="Buscar producto"
          type="search"
          placeholder="Nombre del producto..."
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
        />
        <Seleccion etiqueta="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.texto}
            </option>
          ))}
        </Seleccion>
      </div>

      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !inventario ? (
        <p className="estado">Cargando inventario…</p>
      ) : inventario?.length === 0 ? (
        <p className="estado">No hay productos en el inventario.</p>
      ) : (
        <table className="tabla-stock">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Marca</th>
              <th>Disponible</th>
              <th>Reservado</th>
              <th>Mínimo</th>
              <th>Vencimiento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {inventario?.map((stock) => {
              const bajoStock = stock.cantidad <= stock.stock_minimo && stock.stock_minimo > 0;
              const vencimiento = stock.fecha_vencimiento ? new Date(stock.fecha_vencimiento) : null;
              const diasParaVencer = vencimiento
                ? Math.ceil((vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const porVencer = diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer >= 0;

              return (
                <tr key={stock.id} className={bajoStock || porVencer ? "fila-alerta" : ""}>
                  <td>{stock.producto_nombre}</td>
                  <td className="dato-secundario">-</td>
                  <td>
                    <strong>{stock.cantidad}</strong>
                  </td>
                  <td className="dato-secundario">{stock.reservado}</td>
                  <td className="dato-secundario">{stock.stock_minimo}</td>
                  <td className="dato-secundario">
                    {stock.fecha_vencimiento ? formatoFecha(stock.fecha_vencimiento) : "-"}
                  </td>
                  <td>
                    {bajoStock && <span className="insignia programada">Bajo stock</span>}
                    {porVencer && (
                      <span className="insignia programada">
                        {diasParaVencer === 0 ? "Vence hoy" : `Vence en ${diasParaVencer} días`}
                      </span>
                    )}
                    {!bajoStock && !porVencer && <span className="dato-secundario">OK</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal de ingreso */}
      {modalIngreso && (
        <Dialogo abierto={modalIngreso} alCerrar={() => setModalIngreso(false)} titulo="Registrar ingreso">
          <form onSubmit={handleSubmitIngreso} noValidate>
            {errorIngreso && <p className="alerta" role="alert">{errorIngreso}</p>}
            <Campo
              etiqueta="ID del producto"
              type="number"
              value={productoIngreso}
              onChange={(e) => setProductoIngreso(e.target.value)}
              required
            />
            <Campo
              etiqueta="Cantidad"
              type="number"
              min="1"
              value={cantidadIngreso}
              onChange={(e) => setCantidadIngreso(e.target.value)}
              required
            />
            <Campo
              etiqueta="Fecha de vencimiento (opcional)"
              type="date"
              value={vencimientoIngreso}
              onChange={(e) => setVencimientoIngreso(e.target.value)}
            />
            <Campo
              etiqueta="Motivo (opcional)"
              type="text"
              value={motivoIngreso}
              onChange={(e) => setMotivoIngreso(e.target.value)}
              placeholder="Ej: Reposición semanal"
            />
            <div className="dialogo-botones">
              <button type="button" className="boton secundario" onClick={() => setModalIngreso(false)}>
                Cancelar
              </button>
              <button type="submit" className="boton" disabled={enviandoIngreso}>
                {enviandoIngreso ? "Registrando…" : "Registrar ingreso"}
              </button>
            </div>
          </form>
        </Dialogo>
      )}

      {/* Modal de merma */}
      {modalMerma && (
        <Dialogo abierto={modalMerma} alCerrar={() => setModalMerma(false)} titulo="Registrar merma">
          <form onSubmit={handleSubmitMerma} noValidate>
            {errorMerma && <p className="alerta" role="alert">{errorMerma}</p>}
            <Campo
              etiqueta="ID del producto"
              type="number"
              value={productoMerma}
              onChange={(e) => setProductoMerma(e.target.value)}
              required
            />
            <Campo
              etiqueta="Cantidad"
              type="number"
              min="1"
              value={cantidadMerma}
              onChange={(e) => setCantidadMerma(e.target.value)}
              required
            />
            <Seleccion etiqueta="Motivo" value={motivoMerma} onChange={(e) => setMotivoMerma(e.target.value)}>
              {MOTIVOS_MERMA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.texto}
                </option>
              ))}
            </Seleccion>
            <Campo
              etiqueta="Nota adicional (opcional)"
              type="text"
              value={notaMerma}
              onChange={(e) => setNotaMerma(e.target.value)}
              placeholder="Detalles adicionales..."
            />
            <div className="dialogo-botones">
              <button type="button" className="boton secundario" onClick={() => setModalMerma(false)}>
                Cancelar
              </button>
              <button type="submit" className="boton" disabled={enviandoMerma}>
                {enviandoMerma ? "Registrando…" : "Registrar merma"}
              </button>
            </div>
          </form>
        </Dialogo>
      )}
    </section>
  );
}
