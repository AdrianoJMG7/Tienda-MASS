import { useRef } from "react";
import { Link } from "react-router";
import { conFiltros } from "../api";
import { useCarrito } from "../carrito";
import type { Paginado, Producto } from "../tipos";
import { useCarga } from "../useCarga";
import Icono from "./Icono";
import TarjetaProducto from "./TarjetaProducto";

interface Props {
  /** Filtros de la consulta, p. ej. { en_oferta: true } o { categoria: 3 }. */
  filtros: Record<string, string | number | boolean | undefined>;
  /** Productos que no se deben repetir (el que se está viendo o los del carrito). */
  excluir?: number[];
  enlace?: string;
  puedeComprar?: boolean;
}

/** "También te puede interesar": fila de productos que se desplaza con flechas o con el dedo. */
export default function Recomendados({ filtros, excluir = [], enlace = "/catalogo", puedeComprar = true }: Props) {
  const { tienda } = useCarrito();
  const fila = useRef<HTMLDivElement>(null);
  const { datos } = useCarga<Paginado<Producto>>(conFiltros("/productos/productos/", { ...filtros, tienda: tienda ?? undefined, page_size: 12 }));
  const productos = datos?.results.filter((p) => !excluir.includes(p.id)) ?? [];
  if (productos.length === 0) return null;

  const desplazar = (sentido: 1 | -1) => fila.current?.scrollBy({ left: sentido * fila.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="tarjeta recomendados" aria-labelledby="titulo-recomendados">
      <div className="recomendados-cabecera">
        <h2 id="titulo-recomendados">
          <Icono nombre="estrella" relleno className="icono-estrella" />
          También te puede interesar
        </h2>
        <Link to={enlace} className="enlace-flecha">
          Ver más productos <Icono nombre="flechaDer" tamano={18} />
        </Link>
      </div>
      <div className="recomendados-fila">
        <button type="button" className="flecha-fila izquierda" aria-label="Ver anteriores" onClick={() => desplazar(-1)}>
          <Icono nombre="izquierda" />
        </button>
        <div className="carrusel" ref={fila}>
          {productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} puedeComprar={puedeComprar} hayTienda={tienda != null} />
          ))}
        </div>
        <button type="button" className="flecha-fila derecha" aria-label="Ver más" onClick={() => desplazar(1)}>
          <Icono nombre="derecha" />
        </button>
      </div>
    </section>
  );
}
