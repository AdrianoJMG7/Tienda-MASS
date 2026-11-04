import { useState } from "react";
import { Link } from "react-router";
import { conFiltros } from "../../api";
import { useCarrito } from "../../carrito";
import { useFavoritos } from "../../favoritos";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import TarjetaProducto from "../../componentes/TarjetaProducto";
import type { Paginado, Producto } from "../../tipos";
import { useCarga } from "../../useCarga";

const POR_PAGINA = 12;

/** Productos que el cliente guardó con el corazón. */
export default function MisFavoritos() {
  const { tienda } = useCarrito();
  const { esFavorito } = useFavoritos();
  const [pagina, setPagina] = useState(1);
  const { datos, error } = useCarga<Paginado<Producto>>(
    conFiltros("/productos/favoritos/", { tienda: tienda ?? undefined, page: pagina, page_size: POR_PAGINA }),
  );
  // Al quitar un corazón, el producto desaparece de la lista sin recargar.
  const productos = datos?.results.filter((p) => esFavorito(p.id)) ?? [];

  return (
    <section>
      <h1>Mis favoritos</h1>
      <p className="subtitulo">Guarda los productos que más te gustan.</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {!datos ? (
        <p className="estado">Cargando favoritos…</p>
      ) : productos.length === 0 ? (
        <div className="tarjeta vacio">
          <Icono nombre="corazon" tamano={44} />
          <p>Aún no guardas favoritos. Toca el corazón de un producto para verlo aquí.</p>
          <Link to="/catalogo" className="boton-primario">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="grilla-productos">
          {productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} puedeComprar hayTienda={tienda != null} />
          ))}
        </div>
      )}
      <Paginacion pagina={pagina} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={setPagina} />
    </section>
  );
}
