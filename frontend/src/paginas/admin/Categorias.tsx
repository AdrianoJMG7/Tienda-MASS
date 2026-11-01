import { useState, type FormEvent } from "react";
import { ErrorApi, eliminar, patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import type { Categoria } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

function FormularioCategoria({ categoria, alGuardar }: { categoria: Categoria | null; alGuardar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const { errores, general, enviando, enviar } = useEnvio();

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(() =>
      categoria ? patch(`/categorias/${categoria.id}/`, { nombre }) : post("/categorias/", { nombre }),
    );
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} required />
      <button className="boton ancho" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar categoría"}
      </button>
    </form>
  );
}

export default function Categorias() {
  const { datos, error, cargando, recargar } = useCarga<Categoria[]>("/categorias/");
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);
  const [aviso, setAviso] = useState("");

  async function borrar(c: Categoria) {
    if (!confirm(`¿Eliminar la categoría ${c.nombre}?`)) return;
    try {
      await eliminar(`/categorias/${c.id}/`);
      setAviso("Categoría eliminada.");
      recargar();
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : "No se pudo eliminar la categoría.");
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Categorías</h1>
          <p className="subtitulo">Agrupan los productos del catálogo. Solo se eliminan si no tienen productos.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>Nueva categoría</button>
      </div>
      <p className="aviso" role="status">{aviso}</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando…</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Categoría</th>
              <th className="numero">Productos</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos?.map((c) => (
              <tr key={c.id}>
                <td data-titulo="Categoría"><strong>{c.nombre}</strong></td>
                <td data-titulo="Productos" className="numero">{c.total_productos ?? 0}</td>
                <td className="acciones">
                  <button type="button" className="enlace" onClick={() => setEditando(c)}>Renombrar</button>
                  {!c.total_productos && (
                    <button type="button" className="enlace peligro" onClick={() => borrar(c)}>Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Dialogo titulo={editando ? "Renombrar categoría" : "Nueva categoría"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioCategoria
          categoria={editando ?? null}
          alGuardar={() => {
            setAviso(editando ? "Categoría actualizada." : "Categoría creada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
    </section>
  );
}
