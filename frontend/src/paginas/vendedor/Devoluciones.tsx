import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, conFiltros, ErrorApi, post } from "../../api";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import { formatoFechaHora, soles } from "../../formato";
import type { DetalleVenta, Paginado, Venta } from "../../tipos";
import { useEnvio } from "../../useCarga";

const MOTIVOS = [
  { valor: "danado", texto: "Producto dañado", reingresa: false },
  { valor: "vencido", texto: "Producto vencido", reingresa: false },
  { valor: "cambio_opinion", texto: "El cliente cambió de opinión", reingresa: true },
  { valor: "error_venta", texto: "Error en la venta", reingresa: true },
];

function ProcesarDevolucion({ venta, detalle, alTerminar, alCancelar }: { venta: Venta; detalle: DetalleVenta; alTerminar: (venta: Venta) => void; alCancelar: () => void }) {
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("danado");
  const [reembolso, setReembolso] = useState("efectivo");
  const { errores, general, enviando, enviar } = useEnvio();
  const unidades = Number(cantidad);
  const valido = Number.isInteger(unidades) && unidades >= 1 && unidades <= detalle.disponible_devolver;
  const reingresa = MOTIVOS.find((m) => m.valor === motivo)?.reingresa;

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    await enviar(async () => {
      const actualizada = await post<Venta>(`/ventas/ventas/${venta.id}/devolver/`, {
        detalle: detalle.id,
        cantidad: unidades,
        motivo,
        tipo_reembolso: reembolso,
      });
      alTerminar(actualizada);
    });
  }

  return (
    <form onSubmit={confirmar} noValidate className="procesar-devolucion">
      <div className="panel-stock-producto">
        <FotoProducto producto={{ foto: detalle.producto_foto, nombre: detalle.producto_nombre }} tamano={80} />
        <span>
          <strong>{detalle.producto_nombre}</strong>
          <small className="dato-secundario">{soles(detalle.precio_unitario)} c/u</small>
        </span>
      </div>
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <div className="rejilla-stock">
        <div className="campo">
          <label htmlFor="cantidad-devolver">Cantidad a devolver *</label>
          <input id="cantidad-devolver" type="number" min="1" max={detalle.disponible_devolver} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-invalid={errores.cantidad ? true : undefined} />
          {errores.cantidad ? <p className="error-campo">{errores.cantidad}</p> : <p className="ayuda">Máximo {detalle.disponible_devolver}.</p>}
        </div>
        <div className="campo">
          <label htmlFor="motivo-devolucion">Motivo *</label>
          <select id="motivo-devolucion" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => (
              <option key={m.valor} value={m.valor}>{m.texto}</option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="tipo-reembolso">
        <legend>Tipo de reembolso *</legend>
        {[
          { valor: "efectivo", texto: "Efectivo" },
          { valor: "nota_credito", texto: "Nota de crédito" },
        ].map((t) => (
          <label key={t.valor}>
            <input type="radio" name="reembolso" checked={reembolso === t.valor} onChange={() => setReembolso(t.valor)} /> {t.texto}
          </label>
        ))}
      </fieldset>
      <p className="banda-info">
        <Icono nombre="info" tamano={22} />
        <span>
          Se reembolsará: <strong>{soles(valido ? unidades * detalle.precio_unitario : 0)}</strong>.{" "}
          {reingresa ? "Las unidades vuelven al stock." : "Las unidades no vuelven al stock."}
        </span>
      </p>
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando || !valido}>
          <Icono nombre="check" /> {enviando ? "Registrando…" : "Confirmar devolución"}
        </button>
      </div>
    </form>
  );
}

/** Procesar devoluciones de ventas en caja o de pedidos online, por número de ticket. */
export default function Devoluciones() {
  const [params] = useSearchParams();
  const inicial = params.get("ticket") ?? "";
  const [texto, setTexto] = useState(inicial);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [opciones, setOpciones] = useState<Venta[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [detalle, setDetalle] = useState<DetalleVenta | null>(null);

  async function buscar(ticket: string) {
    setError("");
    setMensaje("");
    setVenta(null);
    setOpciones([]);
    if (!ticket.trim()) return;
    setBuscando(true);
    try {
      const { results } = await api<Paginado<Venta>>(conFiltros("/ventas/ventas/", { q: ticket.trim(), page_size: 10 }));
      const exacta = results.find((v) => v.numero_ticket.toLowerCase() === ticket.trim().toLowerCase());
      if (exacta || results.length === 1) setVenta(exacta ?? results[0]);
      else if (results.length > 1) setOpciones(results);
      else setError("No encontramos ventas con ese ticket en tu tienda.");
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo buscar la venta.");
    } finally {
      setBuscando(false);
    }
  }

  // Al venir desde el historial, la venta se abre directamente.
  useEffect(() => {
    if (inicial) void buscar(inicial);
  }, [inicial]);

  return (
    <section className="pagina-devoluciones">
      <EncabezadoPagina icono="devolver" titulo="Gestión de devoluciones" subtitulo="Procesa devoluciones de tus ventas en caja o pedidos online." />

      <form
        className="buscar-ticket"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(texto);
        }}
      >
        <div className="buscador">
          <Icono nombre="buscar" />
          <label htmlFor="buscar-ticket" className="solo-lector">Número de ticket</label>
          <input id="buscar-ticket" type="search" placeholder="Número de ticket o nombre del cliente" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <button className="boton grande-azul" disabled={buscando || !texto.trim()}>
          <Icono nombre="buscar" /> {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}

      {opciones.length > 0 && (
        <ul className="opciones-ticket">
          {opciones.map((v) => (
            <li key={v.id}>
              <button type="button" className="tarjeta" onClick={() => { setVenta(v); setOpciones([]); }}>
                <strong>{v.numero_ticket}</strong>
                <span>{formatoFechaHora(v.fecha)}</span>
                <span>{v.cliente_nombre ?? "Cliente en tienda"}</span>
                <strong className="texto-azul">{soles(v.total)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}

      {venta ? (
        <>
          <div className="resumen-ticket">
            <span className="resumen-ticket-icono"><Icono nombre="documento" tamano={36} /></span>
            <div>
              <h2>
                Ticket {venta.numero_ticket} <span className={`insignia-venta ${venta.estado}`}>{venta.estado_nombre}</span>
              </h2>
              <p className="con-icono"><Icono nombre="calendario" tamano={18} /> {formatoFechaHora(venta.fecha)}</p>
              <p className="con-icono">
                <Icono nombre="usuario" tamano={18} /> {venta.cliente_nombre ?? "Cliente en tienda"}
                {venta.cliente_celular && <><Icono nombre="telefono" tamano={18} /> {venta.cliente_celular}</>}
              </p>
            </div>
            <div className="resumen-ticket-dato">
              <Icono nombre="carrito" tamano={32} />
              <span>Total <strong>{soles(venta.total)}</strong></span>
            </div>
            <div className="resumen-ticket-dato">
              <Icono nombre="billete" tamano={32} />
              <span>Medio de pago <strong>{venta.medio_pago_display}</strong></span>
            </div>
          </div>

          <div className="tarjeta contenedor-tabla">
            <h2 className="con-icono titulo-tarjeta">
              <Icono nombre="caja" tamano={28} /> Productos de la venta
            </h2>
            <table className="tabla tabla-vendedor">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio unit.</th>
                  <th>Subtotal</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {venta.detalles.map((d) => (
                  <tr key={d.id}>
                    <td data-titulo="Producto">
                      <span className="producto-celda">
                        <FotoProducto producto={{ foto: d.producto_foto, nombre: d.producto_nombre }} tamano={44} />
                        <span>
                          {d.producto_nombre}
                          {d.devuelto > 0 && <small className="dato-secundario">{d.devuelto} ya devuelta(s)</small>}
                        </span>
                      </span>
                    </td>
                    <td data-titulo="Cantidad">{d.cantidad}</td>
                    <td data-titulo="Precio unit.">{soles(d.precio_unitario)}</td>
                    <td data-titulo="Subtotal">{soles(d.subtotal)}</td>
                    <td data-titulo="Acción">
                      <button type="button" className="boton-devolver" disabled={d.disponible_devolver === 0} onClick={() => setDetalle(d)}>
                        <Icono nombre="devolver" tamano={18} /> {d.disponible_devolver === 0 ? "Devuelto" : "Devolver"}
                        <span className="solo-lector"> {d.producto_nombre}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        !error && opciones.length === 0 && (
          <div className="tarjeta vacio">
            <Icono nombre="documento" tamano={44} />
            <p>Busca el ticket de la venta para ver sus productos. Lo encuentras en el comprobante o en el historial.</p>
          </div>
        )
      )}

      <Link to="/vendedor/historial" className="boton-contorno volver-historial">
        <Icono nombre="flechaIzq" /> Volver
      </Link>

      <Dialogo titulo="Procesar devolución" abierto={detalle !== null} alCerrar={() => setDetalle(null)} variante="lateral">
        {detalle && venta && (
          <ProcesarDevolucion
            venta={venta}
            detalle={detalle}
            alCancelar={() => setDetalle(null)}
            alTerminar={(actualizada) => {
              setVenta(actualizada);
              setDetalle(null);
              setMensaje(`Devolución de ${detalle.producto_nombre} registrada.`);
            }}
          />
        )}
      </Dialogo>
    </section>
  );
}
