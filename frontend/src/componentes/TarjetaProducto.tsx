import { Link } from "react-router";
import { useCarrito } from "../carrito";
import { useFavoritos } from "../favoritos";
import { descuento, soles } from "../formato";
import type { Producto } from "../tipos";
import Cantidad from "./Cantidad";
import Disponibilidad from "./Disponibilidad";
import FotoProducto from "./FotoProducto";
import Icono from "./Icono";

/** Corazón para guardar o quitar el producto de "Mis favoritos". */
export function BotonFavorito({ producto }: { producto: Pick<Producto, "id" | "nombre"> }) {
  const { esFavorito, alternar } = useFavoritos();
  const guardado = esFavorito(producto.id);
  return (
    <button
      type="button"
      className={`boton-favorito${guardado ? " guardado" : ""}`}
      aria-pressed={guardado}
      aria-label={`${guardado ? "Quitar de" : "Guardar en"} favoritos: ${producto.nombre}`}
      onClick={() => alternar(producto.id)}
    >
      <Icono nombre="corazon" relleno={guardado} />
    </button>
  );
}

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
  const rebaja = descuento(p.precio, p.precio_oferta);

  return (
    <article className="tarjeta-producto">
      {rebaja > 0 && <span className="sello-descuento">−{rebaja}%</span>}
      {puedeComprar && <BotonFavorito producto={p} />}
      <Link to={`/producto/${p.id}`} className="tarjeta-producto-enlace">
        <FotoProducto producto={p} tamano={112} />
        <h3>{p.nombre}</h3>
      </Link>
      <p className="dato-secundario tarjeta-producto-marca">
        {p.marca}
        {p.marca_propia && <span className="insignia propia">Marca Mass</span>}
      </p>
      <p className="precio">
        <strong className={p.precio_oferta != null ? "precio-oferta" : undefined}>{soles(p.precio_final)}</strong>
        {p.precio_oferta != null && (
          <s className="precio-antes">
            <span className="solo-lector">Antes </span>
            {soles(p.precio)}
          </s>
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
            <button type="button" className="boton-primario ancho" disabled={agotado} onClick={() => agregar(p)}>
              <Icono nombre="carrito" />
              {agotado ? "Agotado" : "Agregar"}
              <span className="solo-lector"> {p.nombre}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
