import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useCarrito, useCarritoActualizado } from "../carrito";
import { igvIncluido, soles } from "../formato";
import Cantidad from "./Cantidad";
import FotoProducto from "./FotoProducto";
import Icono from "./Icono";

/** Panel con los productos elegidos: se despliega al agregar uno o al pulsar el carrito, sin tapar el catálogo. */
export default function MiniCarrito() {
  const { unidades, cambiarCantidad, quitar, cerrarPanel, panelPorClic } = useCarrito();
  const { lineas, tiendaElegida, total } = useCarritoActualizado();
  const { pathname } = useLocation();
  const panel = useRef<HTMLElement>(null);
  const rutaInicial = useRef(pathname);

  // Al abrirlo con el botón del carrito el foco entra al panel; al agregar, el cliente sigue en el catálogo.
  useEffect(() => {
    if (panelPorClic) panel.current?.focus();
  }, [panelPorClic]);

  useEffect(() => {
    if (pathname !== rutaInicial.current) cerrarPanel();
  }, [pathname, cerrarPanel]);

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      cerrarPanel();
      document.querySelector<HTMLElement>(".cabecera-carrito")?.focus();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cerrarPanel]);

  return (
    <aside id="mini-carrito" className="mini-carrito" ref={panel} tabIndex={-1} aria-label="Productos seleccionados">
      <div className="mini-carrito-cabecera">
        <h2 className="con-icono">
          <Icono nombre="carrito" tamano={24} /> Tu carrito
          <span className="mini-carrito-cuenta" aria-live="polite">
            ({unidades} {unidades === 1 ? "producto" : "productos"})
          </span>
        </h2>
        <button type="button" className="boton-icono" aria-label="Cerrar el carrito" onClick={cerrarPanel}>
          <Icono nombre="cerrar" />
        </button>
      </div>

      {lineas.length === 0 ? (
        <p className="mini-carrito-vacio">Aún no agregas productos.</p>
      ) : (
        <>
          <ul className="mini-carrito-lista">
            {lineas.map((l) => (
              <li key={l.producto}>
                <FotoProducto producto={l} tamano={56} />
                <div className="mini-carrito-datos">
                  <Link to={`/producto/${l.producto}`} className="linea-nombre">
                    {l.nombre}
                  </Link>
                  <small className="dato-secundario">{l.marca}</small>
                  {l.retirado && <small className="aviso-linea">Ya no está disponible.</small>}
                  {!l.retirado && l.disponible !== null && l.disponible < l.cantidad && (
                    <small className="aviso-linea">
                      {l.disponible === 0 ? "Agotado en tu tienda." : `Solo quedan ${l.disponible} en tu tienda.`}
                    </small>
                  )}
                  <div className="mini-carrito-acciones">
                    {!l.retirado && (
                      <Cantidad
                        valor={l.cantidad}
                        maximo={l.disponible !== null ? Math.max(l.disponible, 1) : undefined}
                        nombre={l.nombre}
                        alCambiar={(c) => cambiarCantidad(l.producto, c)}
                      />
                    )}
                    <strong className="precio-linea">{soles(l.subtotal)}</strong>
                    <button type="button" className="boton-papelera" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l.producto)}>
                      <Icono nombre="basura" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mini-carrito-pie">
            {!tiendaElegida && (
              <p className="nota">
                <Link to="/tiendas" state={{ desde: "/carrito" }}>Elige tu tienda de recojo</Link> para confirmar el stock.
              </p>
            )}
            <dl className="totales">
              <div className="igv">
                <dt>IGV (18 %) incluido</dt>
                <dd>{soles(igvIncluido(total))}</dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{soles(total)}</dd>
              </div>
            </dl>
            <Link to="/carrito" className="boton-primario ancho">
              <Icono nombre="bolsa" /> Ver carrito y continuar
            </Link>
            <button type="button" className="boton-contorno ancho" onClick={cerrarPanel}>
              Seguir comprando
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
