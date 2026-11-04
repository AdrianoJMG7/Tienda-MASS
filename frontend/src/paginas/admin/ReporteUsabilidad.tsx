import { useState } from "react";
import { descargarConDatos, ErrorApi } from "../../api";
import Campo from "../../componentes/Campo";
import Icono from "../../componentes/Icono";
import Seleccion from "../../componentes/Seleccion";

interface TareaUsabilidad {
  tarea: string;
  tiempo_segundos: number;
  completada: boolean;
  observaciones: string;
}

interface PruebaUsabilidad {
  usuario: string;
  rol: "admin" | "vendedor" | "cliente";
  tareas: TareaUsabilidad[];
}

/** HU18: registra los resultados de las pruebas de usabilidad y genera su reporte en PDF. */
export default function ReporteUsabilidad() {
  const [pruebas, setPruebas] = useState<PruebaUsabilidad[]>([]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  async function generar() {
    setGenerando(true);
    setError("");
    try {
      await descargarConDatos("/reportes/usabilidad/", pruebas);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo generar el reporte de usabilidad.");
    } finally {
      setGenerando(false);
    }
  }

  const cambiarPrueba = (indice: number, cambios: Partial<PruebaUsabilidad>) =>
    setPruebas(pruebas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));

  const cambiarTarea = (indice: number, tarea: number, cambios: Partial<TareaUsabilidad>) =>
    cambiarPrueba(indice, { tareas: pruebas[indice].tareas.map((t, i) => (i === tarea ? { ...t, ...cambios } : t)) });

  return (
    <div className="tarjeta tarjeta-usabilidad">
      <div className="barra-titulo">
        <div>
          <h2>Reporte de pruebas de usabilidad</h2>
          <p className="subtitulo">Ingresa los datos de las pruebas para generar el reporte PDF.</p>
        </div>
        <div className="acciones-fila">
          <button type="button" className="boton-contorno" onClick={() => setPruebas([...pruebas, { usuario: "", rol: "admin", tareas: [] }])}>
            <Icono nombre="mas" /> Agregar prueba
          </button>
          <button type="button" className="boton-primario" disabled={generando || pruebas.length === 0} onClick={generar}>
            <Icono nombre="descargar" /> {generando ? "Generando…" : "Generar PDF"}
          </button>
        </div>
      </div>

      {error && <p className="alerta" role="alert">{error}</p>}

      {pruebas.length === 0 ? (
        <p className="venta-vacia">No hay pruebas registradas. Agrega una prueba para comenzar.</p>
      ) : (
        <div className="pruebas-usabilidad">
          {pruebas.map((prueba, i) => (
            <div key={i} className="tarjeta-prueba">
              <div className="fila-prueba">
                <Campo etiqueta="Usuario" value={prueba.usuario} onChange={(e) => cambiarPrueba(i, { usuario: e.target.value })} />
                <Seleccion etiqueta="Rol" value={prueba.rol} onChange={(e) => cambiarPrueba(i, { rol: e.target.value as PruebaUsabilidad["rol"] })}>
                  <option value="admin">Admin</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="cliente">Cliente</option>
                </Seleccion>
              </div>

              <div className="seccion-tareas">
                <div className="cabecera-tareas">
                  <h3>Tareas</h3>
                  <button
                    type="button"
                    className="boton-contorno pequeno"
                    onClick={() => cambiarPrueba(i, { tareas: [...prueba.tareas, { tarea: "", tiempo_segundos: 0, completada: false, observaciones: "" }] })}
                  >
                    <Icono nombre="mas" tamano={18} /> Agregar tarea
                  </button>
                </div>

                {prueba.tareas.map((tarea, t) => (
                  <div key={t} className="tarea-item">
                    <div className="fila-tarea">
                      <Campo etiqueta="Tarea" value={tarea.tarea} onChange={(e) => cambiarTarea(i, t, { tarea: e.target.value })} />
                      <Campo
                        etiqueta="Tiempo (s)"
                        type="number"
                        min="0"
                        value={tarea.tiempo_segundos}
                        onChange={(e) => cambiarTarea(i, t, { tiempo_segundos: parseInt(e.target.value) || 0 })}
                      />
                      <label className="checkbox-tarea">
                        <input type="checkbox" checked={tarea.completada} onChange={(e) => cambiarTarea(i, t, { completada: e.target.checked })} />
                        Completada
                      </label>
                    </div>
                    <Campo etiqueta="Observaciones" value={tarea.observaciones} onChange={(e) => cambiarTarea(i, t, { observaciones: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
