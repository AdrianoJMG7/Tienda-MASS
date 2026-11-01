import { useCarrito } from "../carrito";
import { formatoFecha, soles } from "../formato";
import type { Producto } from "../tipos";
import Cantidad from "./Cantidad";
import Disponibilidad from "./Disponibilidad";
import FotoProducto from "./FotoProducto";

interface Props {
  producto: Producto;
  /** false para el personal de la cadena: ven el catálogo pero no compran. */
  puedeComprar: boolean;
  hayTienda: boolean;
}

export default function TarjetaProducto({ producto: p, puedeComprar, hayTienda }: Props) {
  const { cantidadDe, agregar, cambiarCantidad } = useCarrito();
  const enCarrito = cantidadDe(p.id);
  const disponible = hayTienda ? (p.disponible ?? 0) : null;
  const agotado = disponible === 0;
  const descuento = p.precio_oferta != null ? Math.round((1 - p.precio_oferta / p.precio) * 100) : 0;

  return (
    <article className="tarjeta-producto">
      <div className="tarjeta-producto-foto">
        <FotoProducto producto={p} tamano={120} />
        {descuento > 0 && <span className="sello-oferta">−{descuento} %</span>}
      </div>
      <h3>{p.nombre}</h3>
      <p className="dato-secundario">
        {p.marca}
        {p.marca_propia && <span className="insignia propia">Marca propia</span>}
      </p>
      <p className="precio">
        {p.precio_oferta != null ? (
          <>
            <strong className="precio-oferta">{soles(p.precio_oferta)}</strong>
            <s className="dato-secundario">{soles(p.precio)}</s>
            <small className="dato-secundario">Hasta el {formatoFecha(p.oferta_fin!)}</small>
          </>
        ) : (
          <strong>{soles(p.precio)}</strong>
        )}
      </p>
      <Disponibilidad unidades={disponible} />
      {puedeComprar && (
        <div className="tarjeta-producto-accion">
          {enCarrito > 0 ? (
            <Cantidad
              valor={enCarrito}
              maximo={disponible ?? undefined}
              nombre={p.nombre}
              alCambiar={(c) => cambiarCantidad(p.id, c)}
            />
          ) : (
            <button type="button" className="boton ancho" disabled={agotado} onClick={() => agregar(p)}>
              {agotado ? "Agotado" : "Agregar"}
              <span className="solo-lector"> {p.nombre}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
