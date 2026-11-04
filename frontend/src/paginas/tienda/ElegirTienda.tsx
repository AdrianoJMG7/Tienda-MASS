import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { patch, type Usuario } from "../../api";
import { useSesion } from "../../auth";
import { useCarrito } from "../../carrito";
import Casilla from "../../componentes/Casilla";
import Icono from "../../componentes/Icono";
import type { Tienda } from "../../tipos";
import { useCarga } from "../../useCarga";

function FichaTienda({ tienda }: { tienda: Tienda }) {
  return (
    <>
      <span className="foto-tienda" aria-hidden="true">
        <Icono nombre="tienda" tamano={34} />
        <span>Mass</span>
      </span>
      <span className="ficha-tienda">
        <strong>{tienda.nombre}</strong>
        <span className="con-icono">
          <Icono nombre="ubicacion" tamano={16} /> {tienda.direccion}, {tienda.distrito}
        </span>
        <span className="con-icono">
          <Icono nombre="reloj" tamano={16} /> {tienda.horario}
        </span>
        <span className="disponibilidad hay">
          <span className="punto" aria-hidden="true" /> Disponible
        </span>
      </span>
    </>
  );
}

/** HU07: elegir la tienda de recojo. Para el cliente con sesión queda guardada como su tienda habitual. */
export default function ElegirTienda() {
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;
  const { usuario, actualizar } = useSesion();
  const { tienda, elegirTienda } = useCarrito();
  const { datos: tiendas, error } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const [elegida, setElegida] = useState<number | null>(tienda);
  const [distritos, setDistritos] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const todosDistritos = [...new Set(tiendas?.map((t) => t.distrito))].sort();
  const busqueda = texto.trim().toLowerCase();
  const visibles = (tiendas ?? []).filter(
    (t) =>
      (distritos.length === 0 || distritos.includes(t.distrito)) &&
      (!busqueda || `${t.nombre} ${t.distrito} ${t.direccion}`.toLowerCase().includes(busqueda)),
  );
  const seleccionada = tiendas?.find((t) => t.id === elegida);

  async function confirmar() {
    if (!seleccionada) return;
    elegirTienda(seleccionada.id);
    if (usuario?.rol === "cliente" && usuario.tienda_preferida !== seleccionada.id) {
      setGuardando(true);
      try {
        actualizar(await patch<Usuario>("/auth/yo/", { tienda_preferida: seleccionada.id }));
      } catch {
        // La tienda ya quedó elegida para este carrito aunque no se guarde como habitual.
      } finally {
        setGuardando(false);
      }
    }
    if (desde) navegar(desde);
    else setAviso(`Listo: recogerás tus pedidos en ${seleccionada.nombre}.`);
  }

  return (
    <section className="elegir-tienda">
      <h1>Selecciona tu tienda de recojo</h1>
      <p className="subtitulo">Elige dónde deseas recoger tu pedido.</p>
      {error && <p className="alerta" role="alert">{error}</p>}

      <div className="elegir-tienda-cuerpo">
        <fieldset className="tarjeta grupo-filtro distritos">
          <legend>
            <Icono nombre="ubicacion" /> Distritos
          </legend>
          {todosDistritos.map((d) => (
            <Casilla key={d} marcada={distritos.includes(d)} alCambiar={(marcada) => setDistritos(marcada ? [...distritos, d] : distritos.filter((x) => x !== d))}>
              {d}
            </Casilla>
          ))}
        </fieldset>

        <div className="lista-tiendas">
          <div className="buscador buscador-pagina">
            <Icono nombre="buscar" />
            <label htmlFor="buscar-tienda" className="solo-lector">
              Buscar por distrito o dirección
            </label>
            <input id="buscar-tienda" type="search" placeholder="Buscar por distrito o dirección…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          {!tiendas ? (
            <p className="estado">Cargando tiendas…</p>
          ) : visibles.length === 0 ? (
            <p className="estado">No hay tiendas con esa búsqueda.</p>
          ) : (
            <div role="radiogroup" aria-label="Tiendas" className="opciones-tiendas">
              {visibles.map((t) => (
                <label key={t.id} className={`tarjeta opcion-tienda-grande${t.id === elegida ? " elegida" : ""}`}>
                  <FichaTienda tienda={t} />
                  <input type="radio" name="tienda" checked={t.id === elegida} onChange={() => setElegida(t.id)} aria-label={t.nombre} />
                </label>
              ))}
            </div>
          )}
        </div>

        <aside className="tienda-elegida">
          <div className="tarjeta">
            <h2 className="con-icono">
              <Icono nombre="tienda" tamano={26} /> Tienda seleccionada
            </h2>
            {seleccionada ? (
              <div className="opcion-tienda-grande fija">
                <FichaTienda tienda={seleccionada} />
              </div>
            ) : (
              <p className="dato-secundario">Aún no eliges una tienda.</p>
            )}
          </div>
          <button type="button" className="boton-primario ancho grande" disabled={!seleccionada || guardando} onClick={confirmar}>
            <Icono nombre="check" /> {guardando ? "Guardando…" : "Confirmar tienda"}
          </button>
          {aviso && (
            <p className="aviso" role="status">
              {aviso}
            </p>
          )}
          {usuario?.rol === "cliente" && <p className="dato-secundario">La guardaremos como tu tienda habitual.</p>}
        </aside>
      </div>
    </section>
  );
}
