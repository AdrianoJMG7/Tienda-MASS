import { useEffect, useState, type FormEvent } from "react";
import { conFiltros, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import Paginacion from "../../componentes/Paginacion";
import { formatoFechaHora, soles } from "../../formato";
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
      <button className="boton ancho" disabled={enviando || codigo.length !== 6}>
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

function TarjetaPedido({ pedido, alAccion }: { pedido: Pedido; alAccion: (accion: string, p: Pedido) => void }) {
  const horas = horasRestantes(pedido.vence_en);
  const activo = !["entregado", "cancelado"].includes(pedido.estado);
  const unidades = pedido.detalles.reduce((suma, d) => suma + d.cantidad, 0);

  return (
    <article className="tarjeta tarjeta-pedido">
      <header className="pedido-cabecera">
        <div>
          <h2>Pedido #{pedido.id}</h2>
          <small className="dato-secundario">Recibido {formatoFechaHora(pedido.creado)}</small>
        </div>
        <span className={`insignia ${pedido.estado}`}>{pedido.estado_display}</span>
      </header>

      <p className="pedido-cliente">
        <strong>{pedido.cliente_nombre}</strong>
        {pedido.cliente_celular && (
          <a href={`tel:${pedido.cliente_celular}`} className="dato-secundario">
            {pedido.cliente_celular}
          </a>
        )}
      </p>

      <ul className="pedido-items">
        {pedido.detalles.map((d) => (
          <li key={d.producto}>
            <strong>{d.cantidad} ×</strong> {d.nombre} <span className="dato-secundario">{d.marca}</span>
          </li>
        ))}
      </ul>

      <p className="pedido-total">
        <span>
          {unidades} {unidades === 1 ? "unidad" : "unidades"} · paga con {pedido.pagado_con ?? pedido.medio_pago_display}
        </span>
        <strong>{soles(pedido.total)}</strong>
      </p>

      {activo && (
        <p className={`pedido-vence${horas < 6 ? " pronto" : ""}`}>
          {horas > 0
            ? `Vence ${formatoFechaHora(pedido.vence_en)} (en ${horas < 1 ? "menos de 1 hora" : `${Math.floor(horas)} h`})`
            : "Venció: se cancelará automáticamente"}
        </p>
      )}
      {pedido.estado === "entregado" && pedido.entregado_en && (
        <p className="dato-secundario">Entregado {formatoFechaHora(pedido.entregado_en)}</p>
      )}
      {pedido.estado === "cancelado" && (
        <p className="dato-secundario">
          Cancelado por {pedido.cancelado_por_display.toLowerCase()}: {pedido.motivo_cancelacion}
        </p>
      )}

      {activo && (
        <div className="pedido-acciones">
          {pedido.estado === "recibido" && (
            <button type="button" className="boton secundario" onClick={() => alAccion("preparar", pedido)}>
              Empezar a preparar
            </button>
          )}
          {pedido.estado !== "listo" && (
            <button type="button" className="boton" onClick={() => alAccion("listo", pedido)}>
              Marcar listo
            </button>
          )}
          {pedido.estado === "listo" && (
            <button type="button" className="boton" onClick={() => alAccion("entregar", pedido)}>
              Entregar
            </button>
          )}
          <button type="button" className="enlace peligro" onClick={() => alAccion("cancelar", pedido)}>
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}

/** HU10: pedidos online de la tienda del vendedor, por estado. */
export default function PedidosTienda() {
  const [filtros, setFiltros] = useState<{ estado: EstadoPedido; q: string; page: number }>({
    estado: "recibido",
    q: "",
    page: 1,
  });
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Pedido>>(
    conFiltros("/pedidos/pedidos/", { ...filtros, q }),
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
      <div className="barra-titulo">
        <div>
          <h1>Pedidos online</h1>
          <p className="subtitulo">Prepara los pedidos de tu tienda y entrégalos validando el código de recojo.</p>
        </div>
        <button type="button" className="boton secundario" onClick={actualizar}>
          Actualizar
        </button>
      </div>

      <div className="pestanas" role="group" aria-label="Estado del pedido">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            type="button"
            aria-pressed={filtros.estado === e.valor}
            onClick={() => setFiltros({ ...filtros, estado: e.valor, page: 1 })}
          >
            {e.texto}
            {conteos.datos && <span className="contador">{conteos.datos[e.valor]}</span>}
          </button>
        ))}
      </div>
      <div className="filtros">
        <Campo
          etiqueta="Buscar"
          type="search"
          placeholder="N.º de pedido o nombre del cliente"
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })}
        />
      </div>

      <p className="aviso" role="status">{aviso}</p>
      {(error || errorAccion) && <p className="alerta" role="alert">{errorAccion || error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando pedidos…</p>
      ) : datos?.results.length === 0 ? (
        <p className="estado">No hay pedidos en este estado.</p>
      ) : (
        <div className="lista-pedidos" aria-busy={cargando}>
          {datos?.results.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} alAccion={alAccion} />
          ))}
        </div>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} alCambiar={(page) => setFiltros({ ...filtros, page })} />

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
