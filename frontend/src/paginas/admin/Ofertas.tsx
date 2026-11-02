import { useState, type FormEvent } from "react";
import { conFiltros, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import Paginacion from "../../componentes/Paginacion";
import { formatoFecha, hoyIso, soles } from "../../formato";
import type { EstadoOferta, Oferta, Paginado, Producto } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";
import FotoProducto from "../../componentes/FotoProducto";

const ESTADOS: { valor: "" | EstadoOferta; texto: string }[] = [
  { valor: "", texto: "Todas" },
  { valor: "vigente", texto: "Vigentes" },
  { valor: "programada", texto: "Programadas" },
  { valor: "vencida", texto: "Vencidas" },
];

type ProductoElegido = Pick<Producto, "id" | "nombre" | "marca" | "precio" | "foto">;

/** Busca un producto por nombre, marca o código para asignarle la oferta. */
function BuscadorProducto({ alElegir }: { alElegir: (p: ProductoElegido) => void }) {
  const [texto, setTexto] = useState("");
  const q = useRetraso(texto.trim());
  const { datos, cargando } = useCarga<Paginado<Producto>>(q.length >= 2 ? conFiltros("/productos/productos/", { q, page_size: 6 }) : null);
  return (
    <div>
      <Campo etiqueta="Producto" type="search" placeholder="Escribe al menos 2 letras" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {q.length >= 2 && (
        <ul className="resultados-busqueda" aria-busy={cargando}>
          {datos?.results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => alElegir(p)}>
                <FotoProducto producto={p} tamano={32} />
                <span>
                  {p.nombre} · {p.marca}
                  <small className="dato-secundario">{soles(p.precio)}</small>
                </span>
              </button>
            </li>
          ))}
          {datos?.results.length === 0 && <li className="estado">Sin resultados.</li>}
        </ul>
      )}
    </div>
  );
}

function FormularioOferta({ oferta, alGuardar }: { oferta: Oferta | null; alGuardar: () => void }) {
  const [producto, setProducto] = useState<ProductoElegido | null>(
    oferta
      ? { id: oferta.producto, nombre: oferta.producto_nombre, marca: oferta.producto_marca, precio: oferta.precio_normal, foto: null }
      : null,
  );
  const [datos, setDatos] = useState({
    precio_especial: oferta ? String(oferta.precio_especial) : "",
    inicio: oferta?.inicio ?? hoyIso(),
    fin: oferta?.fin ?? hoyIso(7),
  });
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });
  const descuento = producto && Number(datos.precio_especial) > 0 ? (1 - Number(datos.precio_especial) / producto.precio) * 100 : null;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { ...datos, producto: producto?.id ?? null };
    const ok = await enviar(() => (oferta ? patch(`/productos/ofertas/${oferta.id}/`, cuerpo) : post("/productos/ofertas/", cuerpo)));
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      {producto ? (
        <div className="producto-elegido">
          <FotoProducto producto={producto} tamano={40} />
          <div>
            <strong>{producto.nombre}</strong>
            <small className="dato-secundario">{producto.marca} · precio normal {soles(producto.precio)}</small>
          </div>
          {!oferta && (
            <button type="button" className="enlace" onClick={() => setProducto(null)}>Cambiar</button>
          )}
        </div>
      ) : (
        <>
          <BuscadorProducto alElegir={setProducto} />
          {errores.producto && <p className="error-campo">Elige un producto.</p>}
        </>
      )}
      <Campo
        etiqueta="Precio de oferta (S/)"
        type="number"
        min="0.1"
        step="0.01"
        value={datos.precio_especial}
        onChange={cambiar("precio_especial")}
        error={errores.precio_especial}
        ayuda={descuento !== null && descuento > 0 ? `Descuento: ${descuento.toFixed(0)} %` : undefined}
        required
      />
      <div className="rejilla-formulario">
        <Campo etiqueta="Desde" type="date" value={datos.inicio} onChange={cambiar("inicio")} error={errores.inicio} required />
        <Campo etiqueta="Hasta" type="date" min={datos.inicio} value={datos.fin} onChange={cambiar("fin")} error={errores.fin} required />
      </div>
      <button className="boton ancho" disabled={enviando || !producto}>
        {enviando ? "Guardando…" : "Guardar oferta"}
      </button>
    </form>
  );
}

export default function Ofertas() {
  const [filtros, setFiltros] = useState({ estado: "vigente", q: "", page: 1 });
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Oferta>>(conFiltros("/productos/ofertas/", { ...filtros, q }));
  const [editando, setEditando] = useState<Oferta | null | undefined>(undefined);
  const [aviso, setAviso] = useState("");

  async function borrar(o: Oferta) {
    if (!confirm(`¿Eliminar la oferta de ${o.producto_nombre}?`)) return;
    try {
      await eliminar(`/productos/ofertas/${o.id}/`);
      setAviso("Oferta eliminada.");
      recargar();
    } catch {
      setAviso("No se pudo eliminar la oferta.");
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Ofertas</h1>
          <p className="subtitulo">Mientras una oferta está vigente, su precio especial se aplica en la web y en las tiendas.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>Nueva oferta</button>
      </div>

      <div className="pestanas" role="group" aria-label="Estado de la oferta">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            type="button"
            aria-pressed={filtros.estado === e.valor}
            onClick={() => setFiltros({ ...filtros, estado: e.valor, page: 1 })}
          >
            {e.texto}
          </button>
        ))}
      </div>
      <div className="filtros">
        <Campo etiqueta="Buscar producto" type="search" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })} />
      </div>

      <p className="aviso" role="status">{aviso}</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando…</p>
      ) : datos?.results.length === 0 ? (
        <p className="estado">No hay ofertas con ese filtro.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="numero">Normal</th>
              <th className="numero">Oferta</th>
              <th>Vigencia</th>
              <th>Estado</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos?.results.map((o) => (
              <tr key={o.id}>
                <td data-titulo="Producto">
                  <strong>{o.producto_nombre}</strong>
                  <small className="dato-secundario">{o.producto_marca}</small>
                </td>
                <td data-titulo="Normal" className="numero">{soles(o.precio_normal)}</td>
                <td data-titulo="Oferta" className="numero">
                  <strong className="precio-oferta">{soles(o.precio_especial)}</strong>
                  <small className="dato-secundario">−{Math.round((1 - o.precio_especial / o.precio_normal) * 100)} %</small>
                </td>
                <td data-titulo="Vigencia">
                  {formatoFecha(o.inicio)} – {formatoFecha(o.fin)}
                </td>
                <td data-titulo="Estado">
                  <span className={`insignia ${o.estado}`}>{o.estado}</span>
                </td>
                <td className="acciones">
                  <button type="button" className="enlace" onClick={() => setEditando(o)}>Editar</button>
                  <button type="button" className="enlace peligro" onClick={() => borrar(o)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} alCambiar={(page) => setFiltros({ ...filtros, page })} />

      <Dialogo titulo={editando ? "Editar oferta" : "Nueva oferta"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioOferta
          oferta={editando ?? null}
          alGuardar={() => {
            setAviso(editando ? "Oferta actualizada." : "Oferta creada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
    </section>
  );
}
