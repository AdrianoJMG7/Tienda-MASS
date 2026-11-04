import { useState } from "react";
import { Link } from "react-router";
import { conFiltros } from "../../api";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import { soles } from "../../formato";
import type { EstadoPedido, Paginado, Pedido } from "../../tipos";
import { useCarga, useRetraso } from "../../useCarga";

const POR_PAGINA = 10;

const FILTROS: { texto: string; estado: string }[] = [
  { texto: "Todos", estado: "" },
  { texto: "Pendiente de recojo", estado: "recibido,en_preparacion,listo" },
  { texto: "Recogido", estado: "entregado" },
  { texto: "Cancelado", estado: "cancelado" },
];

const ESTADO: Record<EstadoPedido, { texto: string; icono: "reloj" | "check" | "cerrar"; clase: string }> = {
  recibido: { texto: "Pendiente de recojo", icono: "reloj", clase: "pendiente" },
  en_preparacion: { texto: "En preparación", icono: "reloj", clase: "pendiente" },
  listo: { texto: "Listo para recoger", icono: "check", clase: "listo" },
  entregado: { texto: "Recogido", icono: "check", clase: "recogido" },
  cancelado: { texto: "Cancelado", icono: "cerrar", clase: "cancelado" },
};

const fecha = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** HU11: historial de pedidos del cliente con su estado; el detalle permite cancelar. */
export default function MisPedidos() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useRetraso(texto.trim());
  const { datos, error, cargando } = useCarga<Paginado<Pedido>>(
    conFiltros("/pedidos/pedidos/", { q, estado, page: pagina, page_size: POR_PAGINA }),
  );

  return (
    <section className="mis-pedidos">
      <h1>Mis pedidos</h1>
      <p className="subtitulo">Consulta el estado y los detalles de tus compras.</p>

      <div className="buscador buscador-pagina">
        <Icono nombre="buscar" />
        <label htmlFor="buscar-pedido" className="solo-lector">
          Buscar por código de pedido
        </label>
        <input
          id="buscar-pedido"
          type="search"
          placeholder="Buscar por código de pedido…"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
        />
      </div>

      <div className="chips" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            type="button"
            className={`chip${estado === f.estado ? " activo" : ""}`}
            aria-pressed={estado === f.estado}
            onClick={() => {
              setEstado(f.estado);
              setPagina(1);
            }}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {error && <p className="alerta" role="alert">{error}</p>}
      {!datos ? (
        <p className="estado">Cargando pedidos…</p>
      ) : datos.results.length === 0 ? (
        <div className="tarjeta vacio">
          <Icono nombre="caja" tamano={44} />
          <p>{q || estado ? "No hay pedidos con esos filtros." : "Aún no tienes pedidos."}</p>
          {!q && !estado && (
            <Link to="/catalogo" className="boton-primario">
              Ir al catálogo
            </Link>
          )}
        </div>
      ) : (
        <ul className="lista-pedidos" aria-busy={cargando}>
          {datos.results.map((p) => {
            const e = ESTADO[p.estado];
            return (
              <li key={p.id} className="tarjeta tarjeta-pedido">
                <div className="pedido-datos">
                  <h2>{p.codigo_recojo}</h2>
                  <p className="con-icono">
                    <Icono nombre="calendario" tamano={18} /> Fecha de compra: {fecha.format(new Date(p.creado))}
                  </p>
                  <p className="con-icono">
                    <Icono nombre="ubicacion" tamano={18} />
                    <span>
                      <strong className="texto-azul">{p.tienda.nombre}</strong>
                      <small className="dato-secundario">
                        {p.tienda.direccion}, {p.tienda.distrito}
                      </small>
                    </span>
                  </p>
                </div>
                <p className="pedido-total">
                  <small>Total</small>
                  <strong>{soles(p.total)}</strong>
                </p>
                <span className={`estado-pedido ${e.clase}`}>
                  <Icono nombre={e.icono} tamano={18} /> {e.texto}
                </span>
                <Link to={`/pedido/${p.id}`} className="boton-contorno">
                  <Icono nombre="ojo" /> Ver detalle<span className="solo-lector"> del pedido {p.codigo_recojo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Paginacion pagina={pagina} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={setPagina} />
    </section>
  );
}
