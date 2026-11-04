import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { conFiltros, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Casilla from "../../componentes/Casilla";
import Dialogo from "../../componentes/Dialogo";
import DialogoConfirmar from "../../componentes/DialogoConfirmar";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import FotoProducto from "../../componentes/FotoProducto";
import Paginacion from "../../componentes/Paginacion";
import Seleccion from "../../componentes/Seleccion";
import { formatoFecha, formatoFechaHora, soles } from "../../formato";
import type { CambioPrecio, Categoria, Paginado, Producto } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

interface PropsFormulario {
  producto: Producto | null;
  categorias: Categoria[];
  alGuardar: () => void;
  alCancelar: () => void;
}

function FormularioProducto({ producto, categorias, alGuardar, alCancelar }: PropsFormulario) {
  const [datos, setDatos] = useState({
    nombre: producto?.nombre ?? "",
    marca: producto?.marca ?? "",
    descripcion: producto?.descripcion ?? "",
    codigo_barras: producto?.codigo_barras ?? "",
    categoria: producto ? String(producto.categoria) : "",
    costo: producto?.costo != null ? String(producto.costo) : "",
    precio: producto ? String(producto.precio) : "",
  });
  const [marcaPropia, setMarcaPropia] = useState(producto?.marca_propia ?? false);
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [foto, setFoto] = useState<File | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos({ ...datos, [campo]: e.target.value });

  const costo = Number(datos.costo);
  const precio = Number(datos.precio);
  // Margen sobre el precio de venta: qué parte del precio queda después de cubrir el costo.
  const margen = costo > 0 && precio > 0 ? ((precio - costo) / precio) * 100 : null;
  const cambiaPrecio = producto && datos.precio !== "" && precio !== producto.precio;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const formulario = new FormData();
    for (const [campo, valor] of Object.entries(datos)) formulario.append(campo, valor);
    formulario.append("marca_propia", String(marcaPropia));
    formulario.append("activo", String(activo));
    if (foto) formulario.append("foto", foto);
    else if (quitarFoto) formulario.append("quitar_foto", "true");
    const ok = await enviar(() =>
      producto ? patch(`/productos/productos/${producto.id}/`, formulario) : post("/productos/productos/", formulario),
    );
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombre y presentación *" placeholder="Ej.: Arroz extra 1 kg" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
      <div className="campo">
        <label htmlFor="descripcion-producto">Descripción (opcional)</label>
        <textarea
          id="descripcion-producto"
          rows={3}
          placeholder="Lo que verá el cliente en la ficha del producto"
          value={datos.descripcion}
          onChange={cambiar("descripcion")}
          aria-invalid={errores.descripcion ? true : undefined}
        />
        {errores.descripcion && <p className="error-campo">{errores.descripcion}</p>}
      </div>
      <div className="rejilla-formulario">
        <Campo etiqueta="Marca *" placeholder="Ej.: Don Vittorio" value={datos.marca} onChange={cambiar("marca")} error={errores.marca} required />
        <Seleccion etiqueta="Categoría *" value={datos.categoria} onChange={cambiar("categoria")} error={errores.categoria} required>
          <option value="">Elige una categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Seleccion>
        <Campo
          etiqueta="Código de barras *"
          inputMode="numeric"
          value={datos.codigo_barras}
          onChange={cambiar("codigo_barras")}
          error={errores.codigo_barras}
          ayuda="Entre 8 y 14 dígitos."
          required
        />
        <div />
        <Campo etiqueta="Costo (S/) *" type="number" min="0" step="0.01" value={datos.costo} onChange={cambiar("costo")} error={errores.costo} required />
        <Campo
          etiqueta="Precio de venta (S/) *"
          type="number"
          min="0.1"
          step="0.01"
          value={datos.precio}
          onChange={cambiar("precio")}
          error={errores.precio}
          ayuda={margen !== null ? `Margen: ${margen.toFixed(1)} %` : undefined}
          required
        />
      </div>
      {cambiaPrecio && (
        <p className="nota" role="note">
          El nuevo precio regirá en la web y en todas las tiendas, y quedará en el historial con tu nombre.
        </p>
      )}
      <div className="campo">
        <label htmlFor="foto-producto">Foto</label>
        <input id="foto-producto" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        {errores.foto && <p className="error-campo">{errores.foto}</p>}
        <p className="ayuda">JPG, PNG o WebP de hasta 2 MB.</p>
      </div>
      {producto?.foto && !foto && (
        <Casilla marcada={quitarFoto} alCambiar={setQuitarFoto}>Quitar la foto actual</Casilla>
      )}
      <Casilla marcada={marcaPropia} alCambiar={setMarcaPropia}>Marca propia</Casilla>
      <Casilla marcada={activo} alCambiar={setActivo}>Activo (visible en el catálogo)</Casilla>
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar producto"}</button>
      </div>
    </form>
  );
}

function HistorialPrecios({ producto }: { producto: Producto }) {
  const { datos, error, cargando } = useCarga<CambioPrecio[]>(`/productos/productos/${producto.id}/historial/`);
  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (cargando) return <p className="estado">Cargando…</p>;
  if (!datos?.length) return <p className="estado">El precio de este producto no ha cambiado.</p>;
  return (
    <table className="tabla tabla-vendedor">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Antes</th>
          <th>Después</th>
          <th>Usuario</th>
        </tr>
      </thead>
      <tbody>
        {datos.map((c) => (
          <tr key={c.id}>
            <td data-titulo="Fecha">{formatoFechaHora(c.fecha)}</td>
            <td data-titulo="Antes">{soles(c.precio_anterior)}</td>
            <td data-titulo="Después">{soles(c.precio_nuevo)}</td>
            <td data-titulo="Usuario">{c.usuario_nombre ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const POR_PAGINA = 10;

/** HU05: catálogo central. Los productos no se borran: se desactivan. */
export default function Productos() {
  const [params] = useSearchParams();
  const qCabecera = params.get("q") ?? "";
  const [filtros, setFiltros] = useState({ q: qCabecera, categoria: "", stock: "", estado: "todos", page: 1 });
  const q = useRetraso(filtros.q);
  const { datos: categorias } = useCarga<Categoria[]>("/categorias/categorias/");
  const { datos, error, cargando, recargar } = useCarga<Paginado<Producto>>(conFiltros("/productos/productos/", { ...filtros, q, page_size: POR_PAGINA }));
  const [editando, setEditando] = useState<Producto | null | undefined>(undefined);
  const [historial, setHistorial] = useState<Producto | null>(null);
  const [desactivando, setDesactivando] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState("");
  const [errorAccion, setErrorAccion] = useState("");
  const filtrar = (cambios: Partial<typeof filtros>) => setFiltros({ ...filtros, ...cambios, page: 1 });

  // El buscador de la cabecera también filtra esta tabla.
  useEffect(() => {
    setFiltros((f) => ({ ...f, q: qCabecera, page: 1 }));
  }, [qCabecera]);

  async function cambiarEstado(p: Producto, activo: boolean) {
    setErrorAccion("");
    await patch(`/productos/productos/${p.id}/`, { activo });
    setAviso(`${p.nombre} fue ${activo ? "activado" : "desactivado"}.`);
    recargar();
  }

  return (
    <section>
      <EncabezadoPagina icono="cuadricula" titulo="Catálogo" subtitulo="Productos que se venden en la web y en las tiendas." />

      <div className="filtros-admin">
        <div className="buscador">
          <Icono nombre="buscar" />
          <label htmlFor="buscar-producto" className="solo-lector">Buscar por nombre, marca o código</label>
          <input id="buscar-producto" type="search" placeholder="Buscar nombre, marca o código" value={filtros.q} onChange={(e) => filtrar({ q: e.target.value })} />
        </div>
        <span className="filtro-icono">
          <Icono nombre="etiqueta" />
          <label htmlFor="filtro-categoria" className="solo-lector">Categoría</label>
          <select id="filtro-categoria" value={filtros.categoria} onChange={(e) => filtrar({ categoria: e.target.value })}>
            <option value="">Categoría: Todas</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </span>
        <span className="filtro-icono">
          <Icono nombre="caja" />
          <label htmlFor="filtro-stock" className="solo-lector">Stock</label>
          <select id="filtro-stock" value={filtros.stock} onChange={(e) => filtrar({ stock: e.target.value })}>
            <option value="">Stock: Todos</option>
            <option value="con_stock">Con stock</option>
            <option value="sin_stock">Sin stock</option>
          </select>
        </span>
        <span className="filtro-icono">
          <Icono nombre="check" />
          <label htmlFor="filtro-estado" className="solo-lector">Estado</label>
          <select id="filtro-estado" value={filtros.estado} onChange={(e) => filtrar({ estado: e.target.value })}>
            <option value="todos">Estado: Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </span>
        <button type="button" className="boton-primario accion-derecha" onClick={() => setEditando(null)}>
          <Icono nombre="mas" /> Nuevo producto
        </button>
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {(error || errorAccion) && <p className="alerta" role="alert">{errorAccion || error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando productos…</p>
      ) : (
        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor" aria-busy={cargando}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Código de barras</th>
                <th>Costo (S/)</th>
                <th>Precio (S/)</th>
                <th>Stock total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos?.results.map((p) => (
                <tr key={p.id}>
                  <td data-titulo="Producto">
                    <span className="producto-celda">
                      <FotoProducto producto={p} tamano={44} />
                      <span>
                        <strong>{p.nombre}</strong>
                        <small className="dato-secundario">
                          {p.marca}
                          {p.marca_propia && <span className="insignia propia">Marca propia</span>}
                        </small>
                      </span>
                    </span>
                  </td>
                  <td data-titulo="Categoría">{p.categoria_nombre}</td>
                  <td data-titulo="Código de barras">{p.codigo_barras}</td>
                  <td data-titulo="Costo (S/)">{p.costo != null ? soles(p.costo) : "—"}</td>
                  <td data-titulo="Precio (S/)">
                    {p.precio_oferta != null ? (
                      <>
                        <strong className="precio-oferta">{soles(p.precio_oferta)}</strong>
                        <small className="dato-secundario">
                          <s>{soles(p.precio)}</s> hasta {formatoFecha(p.oferta_fin!)}
                        </small>
                      </>
                    ) : (
                      soles(p.precio)
                    )}
                  </td>
                  <td data-titulo="Stock total">{p.stock_total ?? 0}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${p.activo ? "disponible" : "agotado"}`}>
                      <i aria-hidden="true" /> {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td data-titulo="Acciones">
                    <div className="acciones-fila">
                      <button type="button" className="boton-contorno pequeno" onClick={() => setEditando(p)}>
                        <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> {p.nombre}</span>
                      </button>
                      {p.activo ? (
                        <button type="button" className="boton-contorno pequeno" onClick={() => setDesactivando(p)}>
                          <Icono nombre="apagar" tamano={18} /> Desactivar<span className="solo-lector"> {p.nombre}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="boton-contorno pequeno"
                          onClick={() => cambiarEstado(p, true).catch((e: Error) => setErrorAccion(e.message))}
                        >
                          <Icono nombre="iniciar" tamano={18} /> Activar<span className="solo-lector"> {p.nombre}</span>
                        </button>
                      )}
                      <button type="button" className="boton-icono pequeno" aria-label={`Historial de precios de ${p.nombre}`} title="Historial de precios" onClick={() => setHistorial(p)}>
                        <Icono nombre="historial" tamano={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos?.results.length === 0 && <p className="estado">No hay productos con esos filtros.</p>}
          <div className="pie-tabla">
            <span>
              {datos && datos.count > 0 &&
                `Mostrando ${(filtros.page - 1) * POR_PAGINA + 1} – ${Math.min(filtros.page * POR_PAGINA, datos.count)} de ${datos.count} productos`}
            </span>
            <Paginacion pagina={filtros.page} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={(page) => setFiltros({ ...filtros, page })} />
          </div>
        </div>
      )}

      <Dialogo titulo={editando ? "Editar producto" : "Nuevo producto"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioProducto
          producto={editando ?? null}
          categorias={categorias ?? []}
          alCancelar={() => setEditando(undefined)}
          alGuardar={() => {
            setAviso(editando ? "Producto actualizado." : "Producto creado.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
      <Dialogo titulo={`Historial de precios: ${historial?.nombre ?? ""}`} abierto={historial !== null} alCerrar={() => setHistorial(null)}>
        {historial && <HistorialPrecios producto={historial} />}
      </Dialogo>
      <DialogoConfirmar
        titulo="Desactivar producto"
        abierto={desactivando !== null}
        textoConfirmar="Sí, desactivar"
        alCerrar={() => setDesactivando(null)}
        alConfirmar={() => cambiarEstado(desactivando!, false)}
      >
        <p>{desactivando?.nombre} dejará de mostrarse en la tienda y en caja.</p>
      </DialogoConfirmar>
    </section>
  );
}
