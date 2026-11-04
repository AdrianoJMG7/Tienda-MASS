import { useState, type FormEvent } from "react";
import { patch, post } from "../../api";
import Campo from "../../componentes/Campo";
import Casilla from "../../componentes/Casilla";
import Dialogo from "../../componentes/Dialogo";
import DialogoConfirmar from "../../componentes/DialogoConfirmar";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import type { Tienda } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

const NUEVA = { codigo: "", nombre: "", distrito: "", direccion: "", horario: "Lun a Dom de 7:00 a 22:00", activa: true, meta_mensual: 15000 };

function FormularioTienda({ tienda, alGuardar, alCancelar }: { tienda: Tienda | null; alGuardar: () => void; alCancelar: () => void }) {
  const [datos, setDatos] = useState({ ...NUEVA, ...tienda });
  const { errores, general, enviando, enviar } = useEnvio();
  const cambiar = (campo: keyof typeof NUEVA) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(() => (tienda ? patch(`/tiendas/tiendas/${tienda.id}/`, datos) : post("/tiendas/tiendas/", datos)));
    if (ok) alGuardar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && <p className="alerta" role="alert">{general}</p>}
      <div className="rejilla-formulario">
        <Campo etiqueta="Código *" placeholder="T-006" value={datos.codigo} onChange={cambiar("codigo")} error={errores.codigo} required />
        <Campo etiqueta="Nombre *" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} required />
        <Campo etiqueta="Distrito *" value={datos.distrito} onChange={cambiar("distrito")} error={errores.distrito} required />
        <Campo etiqueta="Horario *" value={datos.horario} onChange={cambiar("horario")} error={errores.horario} required />
      </div>
      <Campo etiqueta="Dirección *" value={datos.direccion} onChange={cambiar("direccion")} error={errores.direccion} required />
      <Campo
        etiqueta="Meta de ventas mensual (S/)"
        type="number"
        min="0"
        step="100"
        value={datos.meta_mensual}
        onChange={cambiar("meta_mensual")}
        error={errores.meta_mensual}
        ayuda="La ve el vendedor en su historial y sus reportes."
      />
      <Casilla marcada={datos.activa} alCambiar={(activa) => setDatos({ ...datos, activa })}>
        Activa (aparece como punto de recojo)
      </Casilla>
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCancelar}>Cancelar</button>
        <button className="boton-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar tienda"}</button>
      </div>
    </form>
  );
}

/** HU04: registrar tiendas y decidir cuáles son punto de recojo. */
export default function Tiendas() {
  const { datos: tiendas, error, cargando, recargar } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const [editando, setEditando] = useState<Tienda | null | undefined>(undefined);
  const [desactivando, setDesactivando] = useState<Tienda | null>(null);
  const [aviso, setAviso] = useState("");

  async function cambiarEstado(tienda: Tienda, activa: boolean) {
    await patch(`/tiendas/tiendas/${tienda.id}/`, { activa });
    setAviso(`${tienda.nombre} fue ${activa ? "activada" : "desactivada"}.`);
    recargar();
  }

  return (
    <section>
      <EncabezadoPagina icono="tienda" titulo="Tiendas" subtitulo="Solo las tiendas activas aparecen como punto de recojo para los clientes.">
        <button type="button" className="boton-primario" onClick={() => setEditando(null)}>
          <Icono nombre="mas" /> Nueva tienda
        </button>
      </EncabezadoPagina>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !tiendas ? (
        <p className="estado">Cargando tiendas…</p>
      ) : (
        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tienda</th>
                <th>Dirección</th>
                <th>Horario</th>
                <th>Vendedores</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tiendas?.map((t) => (
                <tr key={t.id}>
                  <td data-titulo="Código"><strong>{t.codigo}</strong></td>
                  <td data-titulo="Tienda">
                    <span className="con-icono">
                      <Icono nombre="tienda" /> {t.nombre}
                    </span>
                  </td>
                  <td data-titulo="Dirección">
                    {t.direccion}
                    <small className="dato-secundario">{t.distrito}</small>
                  </td>
                  <td data-titulo="Horario">{t.horario}</td>
                  <td data-titulo="Vendedores">{t.vendedores_activos ?? 0}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${t.activa ? "disponible" : "inactivo"}`}>
                      <i aria-hidden="true" /> {t.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td data-titulo="Acciones">
                    <div className="acciones-fila">
                      <button type="button" className="boton-contorno pequeno" onClick={() => setEditando(t)}>
                        <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> {t.nombre}</span>
                      </button>
                      {t.activa ? (
                        <button type="button" className="boton pequeno-azul" onClick={() => setDesactivando(t)}>
                          <Icono nombre="apagar" tamano={18} /> Desactivar<span className="solo-lector"> {t.nombre}</span>
                        </button>
                      ) : (
                        <button type="button" className="boton pequeno-azul" onClick={() => void cambiarEstado(t, true)}>
                          <Icono nombre="iniciar" tamano={18} /> Activar<span className="solo-lector"> {t.nombre}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pie-tabla">
            <span>{tiendas && `Mostrando ${tiendas.length} ${tiendas.length === 1 ? "tienda" : "tiendas"}`}</span>
          </div>
        </div>
      )}

      <Dialogo titulo={editando ? `Editar ${editando.codigo}` : "Nueva tienda"} abierto={editando !== undefined} alCerrar={() => setEditando(undefined)}>
        <FormularioTienda
          tienda={editando ?? null}
          alCancelar={() => setEditando(undefined)}
          alGuardar={() => {
            setAviso(editando ? "Tienda actualizada." : "Tienda registrada.");
            setEditando(undefined);
            recargar();
          }}
        />
      </Dialogo>
      <DialogoConfirmar
        titulo="Desactivar tienda"
        abierto={desactivando !== null}
        textoConfirmar="Sí, desactivar"
        alCerrar={() => setDesactivando(null)}
        alConfirmar={() => cambiarEstado(desactivando!, false)}
      >
        <p>{desactivando?.nombre} dejará de aparecer como punto de recojo para los clientes.</p>
      </DialogoConfirmar>
    </section>
  );
}
