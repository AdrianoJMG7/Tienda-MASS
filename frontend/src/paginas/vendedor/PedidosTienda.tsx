import { useEffect, useState, type FormEvent } from "react";
import { conFiltros, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import { soles } from "../../formato";
import type { EstadoPedido, MedioPago, Paginado, Pedido } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

const ESTADOS: { valor: EstadoPedido; texto: string }[] = [
  { valor: "recibido", texto: "Recibidos" },
  { valor: "en_preparacion", texto: "En preparación" },
  { valor: "listo", texto: "Listos para recoger" },
  { valor: "entregado", texto: "Entregados" },
  { valor: "cancelado", texto: "Cancelados" },
];

const MEDIOS: { valor: MedioPago; texto: string }[] = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "tarjeta", texto: "Tarjeta" },
  { valor: "yape_plin", texto: "Yape/Plin" },
];

const MOTIVOS = ["El cliente pidió cancelarlo", "Producto dañado o faltante", "El cliente no se pudo contactar"];

const ACTUALIZAR_CADA_MS = 30_000;

/** Horas que faltan para que el pedido venza (negativo si ya venció). */
function horasRestantes(venceEn: string) {
  return (new Date(venceEn).getTime() - Date.now()) / 3_600_000;
}

function FormularioEntrega({ pedido, alTerminar }: { pedido: Pedido; alTerminar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [medio, setMedio] = useState<MedioPago>(pedido.medio_pago);
  const { errores, general, enviando, enviar } = useEnvio();

  async function entregar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(() => post(`/pedidos/pedidos/${pedido.id}/entregar/`, { codigo, medio_pago: medio }));
    if (ok) alTerminar();
  }

  return (
    <form onSubmit={entregar} noValidate>
      <p>
        Pedido <strong>#{pedido.id}</strong> de {pedido.cliente_nombre} · <strong>{soles(pedido.total)}</strong>
      </p>
      {general && <p className="alerta" role="alert">{general}</p>}
      <Campo
        etiqueta="Código de recojo que muestra el cliente"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        error={errores.codigo}
        autoComplete="off"
        autoCapitalize="characters"
        className="entrada-codigo"
        placeholder="ABC123"
        autoFocus
        required
      />
      <fieldset className="medios-pago">
        <legend>¿Cómo pagó?</legend>
        {MEDIOS.map((m) => (
          <label key={m.valor} className={`opcion-tienda${medio === m.valor ? " elegida" : ""}`}>
            <input type="radio" name="medio" checked={medio === m.valor} onChange={() => setMedio(m.valor)} />
            <span>
              {m.texto}
              {m.valor === pedido.medio_pago && <small className="dato-secundario">Lo eligió al pedir</small>}
            </span>
          </label>
        ))}
      </fieldset>
      {errores.medio_pago && <p className="error-campo">{errores.medio_pago}</p>}
      <button className="boton-primario ancho grande" disabled={enviando || codigo.length !== 6}>
        {enviando ? "Registrando…" : `Entregar y cobrar ${soles(pedido.total)}`}
      </button>
    </form>
  );
}

function FormularioCancelacion({ pedido, alTerminar }: { pedido: Pedido; alTerminar: () => void }) {
  const [opcion, setOpcion] = useState(MOTIVOS[0]);
  const [otro, setOtro] = useState("");
  const { errores, general, enviando, enviar } = useEnvio();
  const motivo = opcion === "otro" ? otro : opcion;

  async function cancelar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(() => post(`/pedidos/pedidos/${pedido.id}/cancelar/`, { motivo }));
    if (ok) alTerminar();
  }

  return (
    <form onSubmit={cancelar} noValidate>
      <p>
        El stock reservado del pedido <strong>#{pedido.id}</strong> volverá a estar disponible.
      </p>
      {general && <p className="alerta" role="alert">{general}</p>}
      <fieldset className="medios-pago">
        <legend>Motivo</legend>
        {[...MOTIVOS, "otro"].map((m) => (
          <label key={m} className={`opcion-tienda${opcion === m ? " elegida" : ""}`}>
            <input type="radio" name="motivo" checked={opcion === m} onChange={() => setOpcion(m)} />
            <span>{m === "otro" ? "Otro motivo" : m}</span>
          </label>
        ))}
      </fieldset>
      {opcion === "otro" && (
        <Campo etiqueta="Describe el motivo" value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={200} autoFocus />
      )}
      {errores.motivo && <p className="error-campo">{errores.motivo}</p>}
      <button className="boton ancho peligro" disabled={enviando || motivo.trim().length < 3}>
        {enviando ? "Cancelando…" : "Cancelar pedido"}
      </button>
    </form>
  );
}

const fechaPedido = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** Situación del pedido: cuánto falta para que venza o cómo terminó. */
function EstadoFila({ pedido }: { pedido: Pedido }) {
  const horas = horasRestantes(pedido.vence_en);
  if (pedido.estado === "entregado") {
    return <span className="estado-fila listo"><Icono nombre="check" tamano={18} /> Entregado</span>;
  }
  if (pedido.estado === "cancelado") {
    return (
      <span className="estado-fila vence" title={pedido.motivo_cancelacion}>
        <Icono nombre="prohibir" tamano={18} /> Cancelado por {pedido.cancelado_por_display.toLowerCase()}
      </span>
    );
  }
  if (horas <= 0) return <span className="estado-fila vence"><Icono nombre="reloj" tamano={18} /> Venció: se cancelará solo</span>;
  if (pedido.estado === "listo") return <span className="estado-fila listo"><Icono nombre="check" tamano={18} /> Listo para entregar</span>;
  if (horas < 6) {
    return <span className="estado-fila vence"><Icono nombre="reloj" tamano={18} /> Vence en {horas < 1 ? "menos de 1 hora" : `${Math.floor(horas)} horas`}</span>;
  }
  if (pedido.estado === "en_preparacion") return <span className="estado-fila preparando"><Icono nombre="reloj" tamano={18} /> En preparación</span>;
  return <span className="estado-fila preparando"><Icono nombre="reloj" tamano={18} /> Vence en {Math.floor(horas)} horas</span>;
}

function TarjetaPedido({ pedido, alAccion }: { pedido: Pedido; alAccion: (accion: string, p: Pedido) => void }) {
  const activo = !["entregado", "cancelado"].includes(pedido.estado);
  const unidades = pedido.detalles.reduce((suma, d) => suma + d.cantidad, 0);
  const visibles = pedido.detalles.slice(0, 3);
  const resto = pedido.detalles.length - visibles.length;

  return (
    <article className="tarjeta fila-pedido">
      <div className="fila-pedido-id">
        <h2>Pedido #{pedido.id}</h2>
        <p className="con-icono">
          <Icono nombre="calendario" tamano={18} /> Recibido: {fechaPedido.format(new Date(pedido.creado))}
        </p>
      </div>
      <div className="fila-pedido-cliente">
        <p className="con-icono">
          <Icono nombre="usuario" tamano={18} /> {pedido.cliente_nombre}
        </p>
        {pedido.cliente_celular && (
          <a href={`tel:${pedido.cliente_celular}`} className="con-icono">
            <Icono nombre="telefono" tamano={18} /> {pedido.cliente_celular}
          </a>
        )}
      </div>
      <div className="fila-pedido-productos" title={pedido.detalles.map((d) => `${d.cantidad} × ${d.nombre}`).join(", ")}>
        <div className="miniaturas">
          {visibles.map((d) => (
            <FotoProducto key={d.producto} producto={d} tamano={48} />
          ))}
          {resto > 0 && <span className="miniatura-mas">+{resto}</span>}
        </div>
        <small>{unidades} {unidades === 1 ? "producto" : "productos"}</small>
      </div>
      <div className="fila-pedido-total">
        <strong>Total: {soles(pedido.total)}</strong>
        <p className="con-icono">
          <Icono nombre="tarjeta" tamano={18} /> Paga con: {pedido.pagado_con ?? pedido.medio_pago_display}
        </p>
        <EstadoFila pedido={pedido} />
      </div>
      {activo && (
        <div className="fila-pedido-acciones">
          {pedido.estado === "recibido" && (
            <button type="button" className="boton-primario" onClick={() => alAccion("preparar", pedido)}>
              <Icono nombre="iniciar" /> Empezar a preparar
            </button>
          )}
          {pedido.estado === "en_preparacion" && (
            <button type="button" className="boton-primario" onClick={() => alAccion("listo", pedido)}>
              <Icono nombre="check" /> Marcar listo
            </button>
          )}
          {pedido.estado === "listo" && (
            <button type="button" className="boton-primario" onClick={() => alAccion("entregar", pedido)}>
              <Icono nombre="camion" /> Entregar
            </button>
          )}
          <button type="button" className="boton-contorno" onClick={() => alAccion("cancelar", pedido)}>
            <Icono nombre="prohibir" /> Cancelar
          </button>
        </div>
      )}
    </article>
  );
}

const POR_PAGINA = 10;

/** HU10: pedidos online de la tienda del vendedor, por estado. */
export default function PedidosTienda() {
  const [filtros, setFiltros] = useState<{ estado: EstadoPedido; q: string; page: number }>({
    estado: "recibido",
    q: "",
    page: 1,
  });
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Pedido>>(
    conFiltros("/pedidos/pedidos/", { ...filtros, q, page_size: POR_PAGINA }),
  );
  const conteos = useCarga<Record<EstadoPedido, number>>("/pedidos/pedidos/conteos/");
  const [dialogo, setDialogo] = useState<{ tipo: "entregar" | "cancelar"; pedido: Pedido } | null>(null);
  const [aviso, setAviso] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  const recargarConteos = conteos.recargar;
  function actualizar() {
    recargar();
    recargarConteos();
  }

  // Los pedidos nuevos llegan sin aviso: la lista se refresca sola cada 30 segundos.
  useEffect(() => {
    const temporizador = setInterval(() => {
      recargar();
      recargarConteos();
    }, ACTUALIZAR_CADA_MS);
    return () => clearInterval(temporizador);
  }, [recargar, recargarConteos]);

  async function alAccion(accion: string, pedido: Pedido) {
    setErrorAccion("");
    if (accion === "entregar" || accion === "cancelar") {
      setDialogo({ tipo: accion, pedido });
      return;
    }
    try {
      await post(`/pedidos/pedidos/${pedido.id}/${accion}/`, {});
      setAviso(
        accion === "listo"
          ? `Pedido #${pedido.id} listo. Le avisamos por correo a ${pedido.cliente_nombre}.`
          : `Pedido #${pedido.id} en preparación.`,
      );
      actualizar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo actualizar el pedido.");
      actualizar();
    }
  }

  function terminarDialogo() {
    if (dialogo) {
      setAviso(
        dialogo.tipo === "entregar"
          ? `Pedido #${dialogo.pedido.id} entregado y cobrado.`
          : `Pedido #${dialogo.pedido.id} cancelado. Su stock volvió a estar disponible.`,
      );
    }
    setDialogo(null);
    actualizar();
  }

  return (
    <section>
      <EncabezadoPagina icono="carrito" titulo="Pedidos Online" subtitulo="Prepara los pedidos de tu tienda y entrégalos validando el código de recojo.">
        <button type="button" className="boton-contorno" onClick={actualizar}>
          <Icono nombre="actualizar" className={cargando ? "girando" : undefined} /> Actualizar
        </button>
      </EncabezadoPagina>

      <div className="pestanas-vendedor" role="group" aria-label="Estado del pedido">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            type="button"
            className={filtros.estado === e.valor ? "activa" : undefined}
            aria-pressed={filtros.estado === e.valor}
            onClick={() => setFiltros({ ...filtros, estado: e.valor, page: 1 })}
          >
            {e.texto}
            {conteos.datos && ` (${conteos.datos[e.valor]})`}
          </button>
        ))}
      </div>
      <div className="buscador buscador-pagina">
        <Icono nombre="buscar" />
        <label htmlFor="buscar-pedido" className="solo-lector">
          Buscar por número de pedido o nombre del cliente
        </label>
        <input
          id="buscar-pedido"
          type="search"
          placeholder="N.º de pedido o nombre del cliente"
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })}
        />
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {(error || errorAccion) && <p className="alerta" role="alert">{errorAccion || error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando pedidos…</p>
      ) : datos?.results.length === 0 ? (
        <div className="tarjeta vacio">
          <Icono nombre="caja" tamano={44} />
          <p>No hay pedidos en este estado.</p>
        </div>
      ) : (
        <div className="filas-pedidos" aria-busy={cargando}>
          {datos?.results.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} alAccion={alAccion} />
          ))}
        </div>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={(page) => setFiltros({ ...filtros, page })} />

      <Dialogo
        titulo={dialogo?.tipo === "entregar" ? "Entregar pedido" : "Cancelar pedido"}
        abierto={dialogo !== null}
        alCerrar={() => setDialogo(null)}
      >
        {dialogo?.tipo === "entregar" && <FormularioEntrega pedido={dialogo.pedido} alTerminar={terminarDialogo} />}
        {dialogo?.tipo === "cancelar" && <FormularioCancelacion pedido={dialogo.pedido} alTerminar={terminarDialogo} />}
      </Dialogo>
    </section>
  );
}
