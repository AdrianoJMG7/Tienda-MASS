import { useState, type FormEvent } from "react";
import { conFiltros, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Casilla from "../../componentes/Casilla";
import Dialogo from "../../componentes/Dialogo";
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
}

function FormularioProducto({ producto, categorias, alGuardar }: PropsFormulario) {
  const [datos, setDatos] = useState({
    nombre: producto?.nombre ?? "",
    marca: producto?.marca ?? "",
    codigo_barras: producto?.codigo_barras ?? "",
    categoria: producto ? String(producto.categoria) : "",
    precio: producto ? String(producto.precio) : "",
  });
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [foto, setFoto] = useState<File | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos({ ...datos, [campo]: e.target.value });

  const precio = Number(datos.precio);
  const cambiaPrecio = producto && datos.precio !== "" && precio !== producto.precio;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const formulario = new FormData();
    for (const [campo, valor] of Object.entries(datos)) formulario.append(campo, valor);
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
      <Campo etiqueta="Nombre y presentación" placeholder="Arroz extra 1 kg" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
      <div className="rejilla-formulario">
        <Campo etiqueta="Marca" value={datos.marca} onChange={cambiar("marca")} error={errores.marca} required />
        <Seleccion etiqueta="Categoría" value={datos.categoria} onChange={cambiar("categoria")} error={errores.categoria} required>
          <option value="">Elige una categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Seleccion>
        <Campo
          etiqueta="Código de barras"
          inputMode="numeric"
          value={datos.codigo_barras}
          onChange={cambiar("codigo_barras")}
          error={errores.codigo_barras}
          ayuda="Entre 8 y 14 dígitos."
          required
        />
        <Campo
          etiqueta="Precio de venta (S/)"
          type="number"
          min="0.1"
          step="0.01"
          value={datos.precio}
          onChange={cambiar("precio")}
          error={errores.precio}
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
      <Casilla marcada={activo} alCambiar={setActivo}>Activo (visible en el catálogo)</Casilla>
      <button className="boton ancho" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar producto"}
      </button>
    </form>
  );
}

function HistorialPrecios({ producto }: { producto: Producto }) {
  const { datos, error, cargando } = useCarga<CambioPrecio[]>(`/productos/productos/${producto.id}/historial/`);
  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (cargando) return <p className="estado">Cargando…</p>;
  if (!datos?.length) return <p className="estado">El precio de este producto no ha cambiado.</p>;
  return (
    <table className="tabla compacta">
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

export default function Productos() {
  const [filtros, setFiltros] = useState({ q: "", categoria: "", estado: "activos", marca_propia: false, en_oferta: false, page: 1 });
  const q = useRetraso(filtros.q);
  const { datos: categorias } = useCarga<Categoria[]>("/categorias/");
  const { datos, error, cargando, recargar } = useCarga<Paginado<Producto>>(conFiltros("/productos/productos/", { ...filtros, q }));
  const [editando, setEditando] = useState<Producto | null | undefined>(undefined);
  const [historial, setHistorial] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState("");
  const filtrar = (cambios: Partial<typeof filtros>) => setFiltros({ ...filtros, ...cambios, page: 1 });

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Catálogo y precios</h1>
          <p className="subtitulo">Un solo catálogo y un solo precio para la web y todas las tiendas.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>Nuevo producto</button>
      </div>

      <div className="filtros">
        <Campo etiqueta="Buscar" type="search" placeholder="Nombre, marca o código" value={filtros.q} onChange={(e) => filtrar({ q: e.target.value })} />
        <Seleccion etiqueta="Categoría" value={filtros.categoria} onChange={(e) => filtrar({ categoria: e.target.value })}>
          <option value="">Todas</option>
          {categorias?.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Seleccion>
        <Seleccion etiqueta="Estado" value={filtros.estado} onChange={(e) => filtrar({ estado: e.target.value })}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </Seleccion>
        <div className="filtros-casillas">
          <Casilla marcada={filtros.marca_propia} alCambiar={(marca_propia) => filtrar({ marca_propia })}>Marca propia</Casilla>
          <Casilla marcada={filtros.en_oferta} alCambiar={(en_oferta) => filtrar({ en_oferta })}>En oferta</Casilla>
        </div>
      </div>

      <p className="aviso" role="status">
        {aviso || (datos ? `${datos.count} productos` : "")}
      </p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando…</p>
      ) : datos?.results.length === 0 ? (
        <p className="estado">No hay productos con esos filtros.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Código</th>
              <th className="numero">Costo</th>
              <th className="numero">Precio</th>
              <th>Estado</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos?.results.map((p) => (
              <tr key={p.id}>
                <td data-titulo="Producto">
                  <div className="producto-celda">
                    <FotoProducto producto={p} />
                    <div>
                      <strong>{p.nombre}</strong>
                      <small className="dato-secundario">
                        {p.marca}
                        {p.marca_propia && <span className="insignia propia">Marca propia</span>}
                      </small>
                    </div>
                  </div>
                </td>
                <td data-titulo="Categoría">{p.categoria_nombre}</td>
                <td data-titulo="Código"><code>{p.codigo_barras}</code></td>
                <td data-titulo="Costo" className="numero">{p.costo != null ? soles(p.costo) : "—"}</td>
                <td data-titulo="Precio" className="numero">
                  {p.precio_oferta != null ? (
                    <>
                      <s className="dato-secundario">{soles(p.precio)}</s>
                      <strong className="precio-oferta">{soles(p.precio_oferta)}</strong>
                      <small className="dato-secundario">hasta {formatoFecha(p.oferta_fin!)}</small>
                    </>
                  ) : (
                    soles(p.precio)
                  )}
                </td>
                <td data-titulo="Estado">
                  <span className={`insignia ${p.activo ? "activa" : "inactiva"}`}>{p.activo ? "Activo" : "Inactivo"}</span>
                </td>
                <td className="acciones">
                  <button type="button" className="enlace" onClick={() => setEditando(p)}>Editar</button>
                  <button type="button" className="enlace" onClick={() => setHistorial(p)}>Historial</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} alCambiar={(page) => setFiltros({ ...filtros, page })} />

      <Dialogo titulo={editando ? "Editar producto" : "Nuevo producto"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioProducto
          producto={editando ?? null}
          categorias={categorias ?? []}
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
    </section>
  );
}
