import { useState } from "react";
import { Link } from "react-router";
import { useSesion } from "../../auth";
import { useCarrito, useCarritoActualizado, type LineaCarrito } from "../../carrito";
import Cantidad from "../../componentes/Cantidad";
import Dialogo from "../../componentes/Dialogo";
import Disponibilidad from "../../componentes/Disponibilidad";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Recomendados from "../../componentes/Recomendados";
import { igvIncluido, soles } from "../../formato";

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

/** HU07: armar el carrito y revisar la tienda de recojo. */
export default function Carrito() {
  const { usuario } = useSesion();
  const { items, unidades, cambiarCantidad, quitar, vaciar } = useCarrito();
  const { lineas, tiendaElegida, total, problemas, cargando, error } = useCarritoActualizado();
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const enCarrito = items.map((i) => i.producto);

  if (lineas.length === 0) {
    return (
      <>
        <section className="tarjeta vacio">
          <Icono nombre="carrito" tamano={48} />
          <h1>Tu carrito está vacío</h1>
          <p className="subtitulo">Revisa el catálogo y las ofertas de la semana.</p>
          <Link to="/catalogo" className="boton-primario">
            Ir al catálogo
          </Link>
        </section>
        <Recomendados filtros={{ en_oferta: true }} />
      </>
    );
  }

  const esPersonal = usuario && usuario.rol !== "cliente";
  let bloqueo = "";
  if (!tiendaElegida) bloqueo = "Elige la tienda donde recogerás tu pedido.";
  else if (problemas.length > 0) bloqueo = "Corrige los productos marcados para continuar.";

  return (
    <section className="pagina-carrito">
      <Link to="/catalogo" className="enlace-flecha">
        <Icono nombre="flechaIzq" tamano={18} /> Volver al catálogo
      </Link>
      <div className="titulo-con-icono">
        <Icono nombre="carrito" tamano={40} />
        <div>
          <h1>Tu carrito</h1>
          <p className="subtitulo">Revisa tus productos antes de continuar con tu compra.</p>
        </div>
      </div>
      {error && <p className="alerta" role="alert">{error}</p>}

      <div className="carrito">
        <div>
          <ul className="lineas-carrito" aria-busy={cargando}>
            {lineas.map((l) => (
              <li key={l.producto} className={`tarjeta linea-carrito${problemas.includes(l) ? " con-problema" : ""}`}>
                <Link to={`/producto/${l.producto}`} tabIndex={-1} aria-hidden="true">
                  <FotoProducto producto={l} tamano={80} />
                </Link>
                <div className="linea-info">
                  <Link to={`/producto/${l.producto}`} className="linea-nombre">
                    {l.nombre}
                  </Link>
                  <small className="dato-secundario">{l.marca}</small>
                  <Disponibilidad unidades={l.retirado ? null : l.disponible} />
                  <strong className={l.precioOferta ? "precio-oferta" : undefined}>
                    {soles(l.precio)}
                    {l.precioOferta && <span className="insignia propia">Oferta</span>}
                  </strong>
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
                  <button type="button" className="boton-icono" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l.producto)}>
                    <Icono nombre="basura" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="banda-recojo">
            <Icono nombre="tienda" tamano={26} />
            <span>
              {tiendaElegida ? (
                <>
                  <span className="banda-texto">
                    Recoges en <strong>{tiendaElegida.nombre}</strong>, sin costo adicional.
                  </span>
                  <small>
                    {tiendaElegida.direccion}, {tiendaElegida.distrito}
                  </small>
                </>
              ) : (
                <>Recoge tus productos en la tienda que elijas, sin costo adicional.</>
              )}
            </span>
            <Link to="/tiendas" state={{ desde: "/carrito" }} className="enlace-flecha">
              {tiendaElegida ? "Cambiar tienda" : "Elegir tienda"}
            </Link>
          </div>
        </div>

        <aside className="tarjeta resumen">
          <h2>Resumen de tu compra</h2>
          <dl className="totales">
            <div>
              <dt>Subtotal ({unidades} productos)</dt>
              <dd>{soles(total)}</dd>
            </div>
            <div className="igv">
              <dt>IGV (18 %) incluido</dt>
              <dd>{soles(igvIncluido(total))}</dd>
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
              {bloqueo && (
                <p className="aviso-linea">
                  {bloqueo}{" "}
                  {!tiendaElegida && (
                    <Link to="/tiendas" state={{ desde: "/carrito" }}>
                      Elegir tienda
                    </Link>
                  )}
                </p>
              )}
              {bloqueo || cargando ? (
                <button type="button" className="boton-primario ancho" disabled>
                  <Icono nombre="bolsa" /> Continuar con la compra
                </button>
              ) : usuario ? (
                <Link to="/confirmar" className="boton-primario ancho">
                  <Icono nombre="bolsa" /> Continuar con la compra <Icono nombre="flechaDer" />
                </Link>
              ) : (
                <Link to="/ingresar" state={{ desde: "/confirmar" }} className="boton-primario ancho">
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
          <p className="separador-o" aria-hidden="true">
            <span>o</span>
          </p>
          <button type="button" className="boton-contorno ancho" onClick={() => setConfirmarVaciar(true)}>
            <Icono nombre="basura" /> Vaciar carrito
          </button>
        </aside>
      </div>

      <Recomendados filtros={{ en_oferta: true }} excluir={enCarrito} puedeComprar={!esPersonal} />

      <Dialogo titulo="Vaciar carrito" abierto={confirmarVaciar} alCerrar={() => setConfirmarVaciar(false)}>
        <p>Se quitarán los {unidades} productos de tu carrito.</p>
        <div className="acciones-dialogo">
          <button type="button" className="boton secundario" onClick={() => setConfirmarVaciar(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton peligro"
            onClick={() => {
              vaciar();
              setConfirmarVaciar(false);
            }}
          >
            Sí, vaciar
          </button>
        </div>
      </Dialogo>
    </section>
  );
}
