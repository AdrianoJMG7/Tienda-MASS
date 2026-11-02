import { useState } from "react";
import { api, conFiltros } from "../../api";
import { useSesion } from "../../auth";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import type { Paginado, Pedido } from "../../tipos";
import { useCarga } from "../../useCarga";

/** HU11: historial de pedidos del cliente con estado y opción de cancelar. */
export default function MisPedidos() {
  const { usuario } = useSesion();
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cancelando, setCancelando] = useState<Pedido | null>(null);
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const { datos, recargar } = useCarga<Paginado<Pedido>>(
    usuario ? conFiltros("/pedidos/pedidos/", { estado: filtroEstado }) : null
  );

  async function cancelarPedido() {
    if (!cancelando || !motivo.trim()) return;
    setCargando(true);
    setMensaje("");
    try {
      await api(`/pedidos/pedidos/${cancelando.id}/cancelar/`, { method: "POST", body: JSON.stringify({ motivo }) });
      setMensaje("Pedido cancelado correctamente.");
      setCancelando(null);
      setMotivo("");
      recargar();
    } catch (error: any) {
      setMensaje(error.mensaje || "No se pudo cancelar el pedido.");
    } finally {
      setCargando(false);
    }
  }

  function puedeCancelar(pedido: Pedido) {
    return pedido.estado === "recibido" || pedido.estado === "en_preparacion";
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Mis pedidos</h1>
          <p className="subtitulo">Historial de tus pedidos online para recoger en tienda.</p>
        </div>
      </div>

      <div className="filtros">
        <div className="campo">
          <label>Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="recibido">Recibidos</option>
            <option value="en_preparacion">En preparación</option>
            <option value="listo">Listos para recoger</option>
            <option value="entregado">Entregados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
      </div>

      {mensaje && <p className={mensaje.includes("cancelado") ? "exito" : "alerta"} role="alert">{mensaje}</p>}

      {!datos ? (
        <p className="estado">Cargando pedidos…</p>
      ) : datos.results.length === 0 ? (
        <p className="estado">No tienes pedidos aún.</p>
      ) : (
        <div className="lista-pedidos">
          {datos.results.map((pedido) => (
            <article key={pedido.id} className="tarjeta-pedido">
              <div className="pedido-cabecera">
                <div>
                  <h3>Pedido #{pedido.id}</h3>
                  <p className="fecha">{new Date(pedido.creado).toLocaleDateString("es-PE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}</p>
                </div>
                <span className={`estado estado-${pedido.estado}`}>
                  {pedido.estado_display}
                </span>
              </div>

              <div className="pedido-tienda">
                <strong>Tienda:</strong> {pedido.tienda.nombre} ({pedido.tienda.codigo})
                <br />
                <small>{pedido.tienda.direccion}</small>
              </div>

              <div className="pedido-detalles">
                <h4>Productos</h4>
                <ul>
                  {pedido.detalles.map((detalle) => (
                    <li key={detalle.producto}>
                      {detalle.cantidad}x {detalle.nombre} - S/ {detalle.subtotal.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pedido-total">
                <strong>Total: S/ {pedido.total.toFixed(2)}</strong>
                <br />
                <small>Pago: {pedido.medio_pago_display}</small>
              </div>

              {pedido.codigo_recojo && (
                <div className="pedido-codigo">
                  <strong>Código de recojo:</strong> <code>{pedido.codigo_recojo}</code>
                </div>
              )}

              {puedeCancelar(pedido) && (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => setCancelando(pedido)}
                >
                  Cancelar pedido
                </button>
              )}

              {pedido.estado === "cancelado" && pedido.motivo_cancelacion && (
                <p className="motivo-cancelacion">
                  <strong>Motivo de cancelación:</strong> {pedido.motivo_cancelacion}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {cancelando && (
        <Dialogo titulo="Cancelar pedido" abierto={!!cancelando} alCerrar={() => { setCancelando(null); setMotivo(""); setMensaje(""); }}>
          <p>¿Estás seguro de que quieres cancelar este pedido? Esta acción liberará el stock reservado.</p>
          <Campo
            etiqueta="Motivo de cancelación"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Ya no necesito los productos"
          />
          {mensaje && <p className="alerta">{mensaje}</p>}
          <div className="acciones-dialogo">
            <button
              type="button"
              className="boton secundario"
              onClick={() => { setCancelando(null); setMotivo(""); setMensaje(""); }}
            >
              No cancelar
            </button>
            <button
              type="button"
              className="boton peligro"
              onClick={cancelarPedido}
              disabled={!motivo.trim() || cargando}
            >
              {cargando ? "Cancelando…" : "Sí, cancelar pedido"}
            </button>
          </div>
        </Dialogo>
      )}
    </section>
  );
}
