import { useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ErrorApi, post } from "../../api";
import { useSesion } from "../../auth";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Pasos from "../../componentes/Pasos";
import { formatoFechaHora, soles } from "../../formato";
import { MEDIOS_PAGO } from "../../mediosPago";
import type { Pedido } from "../../tipos";
import { useCarga } from "../../useCarga";

const fechaLarga = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Botón para copiar el código de recojo. */
function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el código igual está a la vista.
    }
  }
  return (
    <button type="button" className="boton-icono" onClick={copiar} aria-label={copiado ? "Código copiado" : "Copiar código"}>
      <Icono nombre={copiado ? "check" : "copiar"} />
    </button>
  );
}

/** HU08 y HU11: pedido confirmado con su código de recojo; el cliente puede cancelarlo mientras no esté listo. */
export default function PedidoConfirmado() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const nuevo = (useLocation().state as { nuevo?: boolean } | null)?.nuevo;
  const { datos: pedido, error, recargar } = useCarga<Pedido>(`/pedidos/pedidos/${id}/`);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorCancelar, setErrorCancelar] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!pedido) return <p className="estado">Cargando tu pedido…</p>;
  const codigo = pedido.codigo_recojo ?? "";
  const medio = MEDIOS_PAGO.find((m) => m.valor === pedido.medio_pago);
  const pendiente = pedido.estado === "recibido" || pedido.estado === "en_preparacion" || pedido.estado === "listo";
  const puedeCancelar = pedido.estado === "recibido" || pedido.estado === "en_preparacion";

  async function cancelar(evento: FormEvent) {
    evento.preventDefault();
    setErrorCancelar("");
    setEnviando(true);
    try {
      await post(`/pedidos/pedidos/${pedido!.id}/cancelar/`, { motivo });
      setCancelando(false);
      recargar();
    } catch (e) {
      setErrorCancelar(e instanceof ErrorApi ? e.message : "No se pudo cancelar el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pedido-confirmado">
      {nuevo ? (
        <Pasos actual={3} />
      ) : (
        <Link to="/cliente/pedidos" className="enlace-flecha">
          <Icono nombre="flechaIzq" tamano={18} /> Mis pedidos
        </Link>
      )}

      <div className="pedido-cabecera">
        <div className="ilustracion-pedido" aria-hidden="true">
          <span className="ilustracion-hoja">
            <Icono nombre={pedido.estado === "cancelado" ? "cerrar" : "check"} tamano={44} />
          </span>
          <span className="ilustracion-bolsa">
            <Icono nombre="bolsa" tamano={40} />
          </span>
        </div>

        <div className="codigo-recojo">
          <h1>{nuevo ? "¡Pedido confirmado!" : "Detalle del pedido"}</h1>
          <p className="subtitulo">
            {nuevo ? "Tu compra ha sido registrada correctamente." : `Hiciste este pedido el ${fechaLarga.format(new Date(pedido.creado))}`}
          </p>
          <p className="codigo-caja">
            <span className="codigo" aria-label={`Código ${codigo.split("").join(" ")}`}>
              {codigo}
            </span>
            <CopiarCodigo codigo={codigo} />
          </p>
          <p className="dato-secundario">Muéstralo en caja cuando vayas a recoger tu pedido.</p>
          {nuevo && usuario && <p className="dato-secundario">Te enviamos el resumen a {usuario.email}.</p>}
        </div>

        <div className={`estado-recojo ${pedido.estado}`}>
          <Icono nombre={pedido.estado === "entregado" ? "check" : pedido.estado === "cancelado" ? "cerrar" : "reloj"} tamano={44} />
          <div>
            {pendiente ? (
              <>
                <strong>{pedido.estado === "listo" ? "Listo para recoger" : "Pendiente de recojo"}</strong>
                <p>
                  Tienes hasta el <strong>{fechaLarga.format(new Date(pedido.vence_en))}</strong> para recoger tu pedido.
                </p>
                <span className={`insignia ${pedido.estado}`}>{pedido.estado_display}</span>
              </>
            ) : pedido.estado === "entregado" ? (
              <>
                <strong>Recogido</strong>
                <p>Lo recogiste el {pedido.entregado_en ? formatoFechaHora(pedido.entregado_en) : "—"}</p>
              </>
            ) : (
              <>
                <strong>Cancelado</strong>
                {pedido.motivo_cancelacion && <p>Motivo: {pedido.motivo_cancelacion}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pedido-cuerpo">
        <div className="tarjeta">
          <div className="bloque-tienda">
            <span className="icono-circulo">
              <Icono nombre="tienda" tamano={28} />
            </span>
            <div className="bloque-tienda-datos">
              <h2>Tienda de recojo</h2>
              <p className="bloque-tienda-nombre">
                <strong>{pedido.tienda.nombre}</strong>
              </p>
              <p className="con-icono">
                <Icono nombre="ubicacion" tamano={18} /> {pedido.tienda.direccion}, {pedido.tienda.distrito}
              </p>
              <p className="con-icono">
                <Icono nombre="reloj" tamano={18} /> Horario: {pedido.tienda.horario}
              </p>
            </div>
          </div>

          <h2 className="con-icono">
            <Icono nombre="caja" tamano={26} /> Productos comprados
          </h2>
          <ul className="resumen-productos">
            {pedido.detalles.map((d) => (
              <li key={d.producto}>
                <span className="producto-celda">
                  <FotoProducto producto={d} tamano={52} />
                  <span>
                    <strong>{d.nombre}</strong>
                    <small className="dato-secundario">{d.marca}</small>
                  </span>
                </span>
                <span className="dato-secundario">Cantidad: {d.cantidad}</span>
                <strong className="precio-linea">{soles(d.subtotal)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="pedido-lateral">
          <div className="tarjeta">
            <h2 className="con-icono">
              <Icono nombre="tarjeta" tamano={28} /> Medio de pago
            </h2>
            <div className="opcion-pago elegida fija">
              {medio && <Icono nombre={medio.icono} tamano={34} />}
              <span>
                <strong>{medio?.titulo ?? pedido.medio_pago_display}</strong>
                <small>{pedido.estado === "entregado" ? "Pagado al recoger" : medio?.texto}</small>
              </span>
            </div>
            <p className="total-confirmar">
              <span>Total de compra</span>
              <strong>{soles(pedido.total)}</strong>
            </p>
          </div>
          <div className="acciones-pedido">
            <Link to="/catalogo" className="boton-primario">
              <Icono nombre="carrito" /> Seguir comprando
            </Link>
            <Link to="/cliente/pedidos" className="boton-contorno">
              <Icono nombre="documento" /> Ver mis pedidos
            </Link>
          </div>
          {puedeCancelar && (
            <button type="button" className="enlace peligro centrado" onClick={() => setCancelando(true)}>
              Cancelar este pedido
            </button>
          )}
        </div>
      </div>

      <Dialogo titulo="Cancelar pedido" abierto={cancelando} alCerrar={() => setCancelando(false)}>
        <form onSubmit={cancelar} noValidate>
          <p>Los productos reservados volverán a estar disponibles en la tienda.</p>
          {errorCancelar && <p className="alerta" role="alert">{errorCancelar}</p>}
          <Campo etiqueta="Motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Ya no necesito los productos" maxLength={200} />
          <div className="acciones-dialogo">
            <button type="button" className="boton secundario" onClick={() => setCancelando(false)}>
              No cancelar
            </button>
            <button className="boton peligro" disabled={!motivo.trim() || enviando}>
              {enviando ? "Cancelando…" : "Sí, cancelar pedido"}
            </button>
          </div>
        </form>
      </Dialogo>
    </section>
  );
}
