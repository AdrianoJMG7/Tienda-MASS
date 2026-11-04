import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { ErrorApi, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import DialogoConfirmar from "../../componentes/DialogoConfirmar";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import type { Categoria } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

const IMAGEN_MAX = 2 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

function FormularioCategoria({ categoria, alGuardar, alCancelar }: { categoria: Categoria | null; alGuardar: () => void; alCancelar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? "");
  const [activa, setActiva] = useState(categoria?.activa ?? true);
  const [imagen, setImagen] = useState<File | null>(null);
  const [quitar, setQuitar] = useState(false);
  const [errorImagen, setErrorImagen] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const { errores, general, enviando, enviar } = useEnvio();

  const nueva = useMemo(() => (imagen ? URL.createObjectURL(imagen) : null), [imagen]);
  useEffect(() => () => {
    if (nueva) URL.revokeObjectURL(nueva);
  }, [nueva]);
  const vista = nueva ?? (quitar ? null : categoria?.imagen);

  function elegir(archivo: File | undefined) {
    setErrorImagen("");
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) return setErrorImagen("La imagen debe ser JPG, PNG o WebP.");
    if (archivo.size > IMAGEN_MAX) return setErrorImagen("La imagen no debe pesar más de 2 MB.");
    setImagen(archivo);
    setQuitar(false);
  }

  function soltar(evento: DragEvent) {
    evento.preventDefault();
    setArrastrando(false);
    elegir(evento.dataTransfer.files[0]);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = new FormData();
    cuerpo.append("nombre", nombre);
    cuerpo.append("descripcion", descripcion);
    cuerpo.append("activa", String(activa));
    if (imagen) cuerpo.append("imagen", imagen);
    else if (quitar) cuerpo.append("quitar_imagen", "true");
    const ok = await enviar(() => (categoria ? patch(`/categorias/categorias/${categoria.id}/`, cuerpo) : post("/categorias/categorias/", cuerpo)));
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombre de la categoría *" placeholder="Ej.: Snacks" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} required />
      <Campo etiqueta="Descripción" placeholder="Breve descripción de la categoría" maxLength={200} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} error={errores.descripcion} />

      <div className="campo">
        <span className="etiqueta-campo">Estado</span>
        <label className="interruptor">
          <input type="checkbox" role="switch" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          <i aria-hidden="true" />
          {activa ? "Activa" : "Inactiva: sus productos no se muestran en la tienda ni en caja"}
        </label>
      </div>

      <div className="campo">
        <span className="etiqueta-campo">Imagen (opcional)</span>
        <label
          className={`zona-imagen${arrastrando ? " activa" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          {vista ? <img src={vista} alt="" /> : <span className="zona-imagen-icono"><Icono nombre="imagen" tamano={40} /></span>}
          <span>
            Arrastra una imagen aquí o selecciona un archivo
            <small>JPG, PNG o WebP (máx. 2 MB)</small>
          </span>
          <input type="file" accept={TIPOS.join(",")} className="solo-lector" onChange={(e) => elegir(e.target.files?.[0])} />
        </label>
        {vista && (
          <button
            type="button"
            className="enlace peligro"
            onClick={() => {
              setImagen(null);
              setQuitar(true);
            }}
          >
            Quitar imagen
          </button>
        )}
        {(errorImagen || errores.imagen) && <p className="error-campo">{errorImagen || errores.imagen}</p>}
      </div>

      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar categoría"}</button>
      </div>
    </form>
  );
}

/** HU05: categorías del catálogo. Solo se eliminan si no tienen productos. */
export default function Categorias() {
  const { datos, error, cargando, recargar } = useCarga<Categoria[]>("/categorias/categorias/");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Categoria | null>(null);
  const [aviso, setAviso] = useState("");
  const busqueda = texto.trim().toLowerCase();
  const visibles = datos?.filter((c) => !busqueda || c.nombre.toLowerCase().includes(busqueda));

  return (
    <section>
      <EncabezadoPagina icono="cuadricula" titulo="Categorías" subtitulo="Organiza los productos del catálogo." />

      <div className="filtros-admin">
        <div className="buscador">
          <Icono nombre="buscar" />
          <label htmlFor="buscar-categoria" className="solo-lector">Buscar categoría</label>
          <input id="buscar-categoria" type="search" placeholder="Buscar categoría" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <button type="button" className="boton-primario accion-derecha" onClick={() => setEditando(null)}>
          <Icono nombre="mas" /> Nueva categoría
        </button>
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando categorías…</p>
      ) : (
        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Productos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles?.map((c) => (
                <tr key={c.id}>
                  <td data-titulo="Categoría">
                    <span className="producto-celda">
                      <FotoProducto producto={{ foto: c.imagen ?? null, nombre: c.nombre }} tamano={44} />
                      <strong className="texto-azul-oscuro">{c.nombre}</strong>
                    </span>
                  </td>
                  <td data-titulo="Descripción">{c.descripcion || "—"}</td>
                  <td data-titulo="Productos">{c.total_productos ?? 0}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${c.activa ? "disponible" : "inactivo"}`}>
                      <i aria-hidden="true" /> {c.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td data-titulo="Acciones">
                    <div className="acciones-fila">
                      <button type="button" className="boton-contorno pequeno" onClick={() => setEditando(c)}>
                        <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> {c.nombre}</span>
                      </button>
                      <button
                        type="button"
                        className="boton-contorno pequeno"
                        disabled={(c.total_productos ?? 0) > 0}
                        title={(c.total_productos ?? 0) > 0 ? "Solo se eliminan las categorías sin productos" : undefined}
                        onClick={() => setBorrando(c)}
                      >
                        <Icono nombre="basura" tamano={18} /> Eliminar<span className="solo-lector"> {c.nombre}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles?.length === 0 && <p className="estado">No hay categorías con esa búsqueda.</p>}
          <div className="pie-tabla">
            <span>{visibles && `Mostrando ${visibles.length} de ${datos?.length} categorías`}</span>
          </div>
        </div>
      )}

      <Dialogo titulo={editando ? "Editar categoría" : "Nueva categoría"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioCategoria
          categoria={editando ?? null}
          alCancelar={() => setEditando(undefined)}
          alGuardar={() => {
            setAviso(editando ? "Categoría actualizada." : "Categoría creada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
      <DialogoConfirmar
        titulo="Eliminar categoría"
        abierto={borrando !== null}
        textoConfirmar="Sí, eliminar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          try {
            await eliminar(`/categorias/categorias/${borrando!.id}/`);
          } catch (e) {
            throw new Error(e instanceof ErrorApi ? e.message : "No se pudo eliminar la categoría.");
          }
          setAviso("Categoría eliminada.");
          recargar();
        }}
      >
        <p>Se eliminará la categoría {borrando?.nombre}.</p>
      </DialogoConfirmar>
    </section>
  );
}
