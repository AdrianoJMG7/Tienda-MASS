import { useState, type FormEvent } from "react";
import { patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Casilla from "../../componentes/Casilla";
import Dialogo from "../../componentes/Dialogo";
import type { Tienda } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

const NUEVA = { codigo: "", nombre: "", distrito: "", direccion: "", horario: "Lun a Dom de 7:00 a 22:00", activa: true };

function FormularioTienda({ tienda, alGuardar }: { tienda: Tienda | null; alGuardar: () => void }) {
  const [datos, setDatos] = useState(tienda ?? NUEVA);
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof NUEVA) => (e: { target: { value: string } }) =>
    setDatos({ ...datos, [campo]: e.target.value });

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(() => (tienda ? patch(`/tiendas/tiendas/${tienda.id}/`, datos) : post("/tiendas/tiendas/", datos)));
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      <div className="rejilla-formulario">
        <Campo etiqueta="Código" placeholder="T-006" value={datos.codigo} onChange={cambiar("codigo")} error={errores.codigo} required />
        <Campo etiqueta="Nombre" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
        <Campo etiqueta="Distrito" value={datos.distrito} onChange={cambiar("distrito")} error={errores.distrito} required />
        <Campo etiqueta="Horario" value={datos.horario} onChange={cambiar("horario")} error={errores.horario} required />
      </div>
      <Campo etiqueta="Dirección" value={datos.direccion} onChange={cambiar("direccion")} error={errores.direccion} required />
      <Casilla marcada={datos.activa} alCambiar={(activa) => setDatos({ ...datos, activa })}>
        Activa (aparece como punto de recojo)
      </Casilla>
      <button className="boton ancho" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar tienda"}
      </button>
    </form>
  );
}

export default function Tiendas() {
  const { datos: tiendas, error, cargando, recargar } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const [editando, setEditando] = useState<Tienda | null | undefined>(undefined);
  const [aviso, setAviso] = useState("");

  async function alternar(tienda: Tienda) {
    const accion = tienda.activa ? "desactivar" : "activar";
    if (tienda.activa && !confirm(`¿Desactivar ${tienda.nombre}? Dejará de aparecer como punto de recojo.`)) return;
    try {
      await patch(`/tiendas/tiendas/${tienda.id}/`, { activa: !tienda.activa });
      setAviso(`${tienda.nombre} fue ${tienda.activa ? "desactivada" : "activada"}.`);
      recargar();
    } catch {
      setAviso(`No se pudo ${accion} ${tienda.nombre}.`);
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Tiendas</h1>
          <p className="subtitulo">Solo las tiendas activas aparecen como punto de recojo para los clientes.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>
          Nueva tienda
        </button>
      </div>
      <p className="aviso" role="status">{aviso}</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !tiendas ? (
        <p className="estado">Cargando…</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tienda</th>
              <th>Dirección</th>
              <th>Horario</th>
              <th>Vendedores</th>
              <th>Estado</th>
              <th><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {tiendas?.map((t) => (
              <tr key={t.id}>
                <td data-titulo="Código"><strong>{t.codigo}</strong></td>
                <td data-titulo="Tienda">
                  {t.nombre}
                  <small className="dato-secundario">{t.distrito}</small>
                </td>
                <td data-titulo="Dirección">{t.direccion}</td>
                <td data-titulo="Horario">{t.horario}</td>
                <td data-titulo="Vendedores">{t.vendedores_activos ?? 0}</td>
                <td data-titulo="Estado">
                  <span className={`insignia ${t.activa ? "activa" : "inactiva"}`}>{t.activa ? "Activa" : "Inactiva"}</span>
                </td>
                <td className="acciones">
                  <button type="button" className="enlace" onClick={() => setEditando(t)}>Editar</button>
                  <button type="button" className="enlace" onClick={() => alternar(t)}>
                    {t.activa ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Dialogo
        titulo={editando ? `Editar ${editando.codigo}` : "Nueva tienda"}
        abierto={editando !== undefined}
        alCerrar={() => setEditando(undefined)}
      >
        <FormularioTienda
          tienda={editando ?? null}
          alGuardar={() => {
            setAviso(editando ? "Tienda actualizada." : "Tienda registrada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
    </section>
  );
}
