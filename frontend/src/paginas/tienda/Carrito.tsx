import { Link } from "react-router";
import { useSesion } from "../../auth";
import { useCarrito, useCarritoActualizado, type LineaCarrito } from "../../carrito";
import Cantidad from "../../componentes/Cantidad";
import FotoProducto from "../../componentes/FotoProducto";
import SelectorTienda from "../../componentes/SelectorTienda";
import { soles } from "../../formato";

function AvisoStock({ linea, tienda }: { linea: LineaCarrito; tienda: string }) {
  const { cambiarCantidad, quitar } = useCarrito();
  if (linea.retirado) {
    return (
      <p className="aviso-linea" role="alert">
        Este producto ya no está disponible.{" "}
        <button type="button" className="enlace" onClick={() => quitar(linea.producto)}>
          Quitarlo
        </button>
      </p>
    );
  }
  if (linea.disponible === null || linea.disponible >= linea.cantidad) return null;
  return (
    <p className="aviso-linea" role="alert">
      {linea.disponible === 0 ? `Agotado en ${tienda}.` : `Solo quedan ${linea.disponible} en ${tienda}.`}{" "}
      <button
        type="button"
        className="enlace"
        onClick={() => (linea.disponible ? cambiarCantidad(linea.producto, linea.disponible) : quitar(linea.producto))}
      >
        {linea.disponible ? `Dejar ${linea.disponible}` : "Quitarlo"}
      </button>
    </p>
  );
}

/** HU07: armar el carrito y elegir la tienda de recojo. */
export default function Carrito() {
  const { usuario } = useSesion();
  const { tienda, unidades, cambiarCantidad, quitar, elegirTienda } = useCarrito();
  const { lineas, tiendas, tiendaElegida, total, problemas, cargando, error } = useCarritoActualizado();

  if (lineas.length === 0) {
    return (
      <section className="tarjeta vacio">
        <h1>Tu carrito está vacío</h1>
        <p className="subtitulo">Revisa el catálogo y las ofertas de la semana.</p>
        <Link to="/catalogo" className="boton">
          Ir al catálogo
        </Link>
      </section>
    );
  }

  const esPersonal = usuario && usuario.rol !== "cliente";
  let bloqueo = "";
  if (!tiendaElegida) bloqueo = "Elige la tienda donde recogerás tu pedido.";
  else if (problemas.length > 0) bloqueo = "Corrige los productos marcados para continuar.";

  return (
    <section>
      <h1>Mi carrito</h1>
      {error && <p className="alerta" role="alert">{error}</p>}
      <div className="carrito">
        <div>
          <ul className="lineas-carrito" aria-busy={cargando}>
            {lineas.map((l) => (
              <li key={l.producto} className={`linea-carrito${problemas.includes(l) ? " con-problema" : ""}`}>
                <FotoProducto producto={l} tamano={64} />
                <div className="linea-info">
                  <strong>{l.nombre}</strong>
                  <small className="dato-secundario">
                    {l.marca} · {soles(l.precio)} c/u{l.precioOferta && <span className="insignia propia">Oferta</span>}
                  </small>
                  <AvisoStock linea={l} tienda={tiendaElegida?.nombre ?? ""} />
                </div>
                <div className="linea-acciones">
                  {!l.retirado && (
                    <Cantidad
                      valor={l.cantidad}
                      maximo={l.disponible !== null ? Math.max(l.disponible, 1) : undefined}
                      nombre={l.nombre}
                      alCambiar={(c) => cambiarCantidad(l.producto, c)}
                    />
                  )}
                  <strong className="linea-subtotal">{soles(l.subtotal)}</strong>
                  <button type="button" className="enlace peligro" onClick={() => quitar(l.producto)}>
                    Quitar<span className="solo-lector"> {l.nombre}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/catalogo">← Seguir comprando</Link>
        </div>

        <aside className="tarjeta resumen">
          <SelectorTienda tiendas={tiendas} elegida={tiendaElegida ? tienda : null} alElegir={elegirTienda} />
          <dl className="totales">
            <div>
              <dt>Productos</dt>
              <dd>{unidades}</dd>
            </div>
            <div className="total">
              <dt>Total</dt>
              <dd aria-live="polite">{soles(total)}</dd>
            </div>
          </dl>
          <p className="dato-secundario">Pagas al recoger: efectivo, tarjeta o Yape/Plin.</p>

          {esPersonal ? (
            <p className="nota">Las cuentas del personal de tienda no pueden hacer pedidos.</p>
          ) : (
            <>
              {bloqueo && <p className="aviso-linea">{bloqueo}</p>}
              {bloqueo || cargando ? (
                <button type="button" className="boton ancho" disabled>
                  {usuario ? "Continuar" : "Ingresar para confirmar"}
                </button>
              ) : usuario ? (
                <Link to="/confirmar" className="boton ancho">
                  Continuar
                </Link>
              ) : (
                <Link to="/ingresar" state={{ desde: "/confirmar" }} className="boton ancho">
                  Ingresar para confirmar
                </Link>
              )}
              {!usuario && (
                <p className="texto-centro">
                  ¿Eres nuevo?{" "}
                  <Link to="/registro" state={{ desde: "/confirmar" }}>
                    Crea tu cuenta
                  </Link>
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
