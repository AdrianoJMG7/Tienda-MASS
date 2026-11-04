import { useState, type FormEvent } from "react";
import { conFiltros, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import DialogoConfirmar from "../../componentes/DialogoConfirmar";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
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
      <Campo etiqueta="Producto *" type="search" placeholder="Escribe al menos 2 letras" value={texto} onChange={(e) => setTexto(e.target.value)} />
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

function FormularioOferta({ oferta, alGuardar, alCancelar }: { oferta: Oferta | null; alGuardar: () => void; alCancelar: () => void }) {
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
        etiqueta="Precio de oferta (S/) *"
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
        <Campo etiqueta="Desde *" type="date" value={datos.inicio} onChange={cambiar("inicio")} error={errores.inicio} required />
        <Campo etiqueta="Hasta *" type="date" min={datos.inicio} value={datos.fin} onChange={cambiar("fin")} error={errores.fin} required />
      </div>
      <p className="banda-info">
        <Icono nombre="info" tamano={22} />
        La oferta se aplicará en la web y en todas las tiendas mientras esté vigente.
      </p>
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando || !producto}>{enviando ? "Guardando…" : "Guardar oferta"}</button>
      </div>
    </form>
  );
}

const POR_PAGINA = 10;
const ETIQUETA_ESTADO: Record<EstadoOferta, string> = { vigente: "Vigente", programada: "Programada", vencida: "Vencida" };
const CLASE_ESTADO: Record<EstadoOferta, string> = { vigente: "disponible", programada: "bajo_stock", vencida: "inactivo" };

/** HU05: ofertas con precio especial y fechas de inicio y fin. */
export default function Ofertas() {
  const [filtros, setFiltros] = useState({ estado: "", q: "", page: 1 });
  const q = useRetraso(filtros.q);
  const { datos, error, cargando, recargar } = useCarga<Paginado<Oferta>>(conFiltros("/productos/ofertas/", { ...filtros, q, page_size: POR_PAGINA }));
  const [editando, setEditando] = useState<Oferta | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Oferta | null>(null);
  const [aviso, setAviso] = useState("");

  return (
    <section>
      <EncabezadoPagina icono="etiqueta" titulo="Ofertas" subtitulo="Mientras una oferta está vigente, su precio especial se aplica en la web y en las tiendas." />

      <div className="filtros-admin">
        <div className="pestanas-vendedor azules" role="group" aria-label="Estado de la oferta">
          {ESTADOS.map((e) => (
            <button
              key={e.valor}
              type="button"
              className={filtros.estado === e.valor ? "activa" : undefined}
              aria-pressed={filtros.estado === e.valor}
              onClick={() => setFiltros({ ...filtros, estado: e.valor, page: 1 })}
            >
              {e.texto}
            </button>
          ))}
        </div>
        <button type="button" className="boton-primario accion-derecha" onClick={() => setEditando(null)}>
          <Icono nombre="mas" /> Nueva oferta
        </button>
      </div>
      <div className="buscador buscador-pagina buscador-corto">
        <Icono nombre="buscar" />
        <label htmlFor="buscar-oferta" className="solo-lector">Buscar producto</label>
        <input id="buscar-oferta" type="search" placeholder="Buscar producto" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value, page: 1 })} />
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando ofertas…</p>
      ) : (
        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor" aria-busy={cargando}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Normal (S/)</th>
                <th>Oferta (S/)</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos?.results.map((o) => (
                <tr key={o.id}>
                  <td data-titulo="Producto">
                    <span className="producto-celda">
                      <FotoProducto producto={{ foto: o.producto_foto ?? null, nombre: o.producto_nombre }} tamano={44} />
                      <span>
                        <strong>{o.producto_nombre}</strong>
                        <small className="dato-secundario">{o.producto_marca}</small>
                      </span>
                    </span>
                  </td>
                  <td data-titulo="Normal (S/)">{soles(o.precio_normal)}</td>
                  <td data-titulo="Oferta (S/)">
                    <span className="precio-rebajado">
                      <strong>{soles(o.precio_especial)}</strong>
                      <span className="pastilla-rebaja">−{Math.round((1 - o.precio_especial / o.precio_normal) * 100)}%</span>
                    </span>
                  </td>
                  <td data-titulo="Vigencia">{formatoFecha(o.inicio)} – {formatoFecha(o.fin)}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${CLASE_ESTADO[o.estado]}`}>
                      <i aria-hidden="true" /> {ETIQUETA_ESTADO[o.estado]}
                    </span>
                  </td>
                  <td data-titulo="Acciones">
                    <div className="acciones-fila">
                      <button type="button" className="boton-contorno pequeno" onClick={() => setEditando(o)}>
                        <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> {o.producto_nombre}</span>
                      </button>
                      <button type="button" className="boton-contorno pequeno" onClick={() => setBorrando(o)}>
                        <Icono nombre="basura" tamano={18} /> Eliminar<span className="solo-lector"> {o.producto_nombre}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos?.results.length === 0 && <p className="estado">No hay ofertas con ese filtro.</p>}
          <div className="pie-tabla">
            <span>
              {datos && datos.count > 0 &&
                `Mostrando ${(filtros.page - 1) * POR_PAGINA + 1} – ${Math.min(filtros.page * POR_PAGINA, datos.count)} de ${datos.count} ofertas`}
            </span>
            <Paginacion pagina={filtros.page} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={(page) => setFiltros({ ...filtros, page })} />
          </div>
        </div>
      )}

      <Dialogo titulo={editando ? "Editar oferta" : "Nueva oferta"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioOferta
          oferta={editando ?? null}
          alCancelar={() => setEditando(undefined)}
          alGuardar={() => {
            setAviso(editando ? "Oferta actualizada." : "Oferta creada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
      <DialogoConfirmar
        titulo="Eliminar oferta"
        abierto={borrando !== null}
        textoConfirmar="Sí, eliminar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          await eliminar(`/productos/ofertas/${borrando!.id}/`);
          setAviso("Oferta eliminada.");
          recargar();
        }}
      >
        <p>Se eliminará la oferta de {borrando?.producto_nombre}. Volverá a venderse a su precio normal.</p>
      </DialogoConfirmar>
    </section>
  );
}
