import { useState } from "react";
import { conFiltros } from "../../api";
import { useSesion } from "../../auth";
import { useCarrito } from "../../carrito";
import Campo from "../../componentes/Campo";
import Casilla from "../../componentes/Casilla";
import Paginacion from "../../componentes/Paginacion";
import Seleccion from "../../componentes/Seleccion";
import SelectorTienda from "../../componentes/SelectorTienda";
import TarjetaProducto from "../../componentes/TarjetaProducto";
import type { Categoria, Paginado, Producto, Tienda } from "../../tipos";
import { useCarga, useRetraso } from "../../useCarga";

const POR_PAGINA = 24;
const SIN_FILTROS = { q: "", categoria: "", marca_propia: false, en_oferta: false, precio_min: "", precio_max: "", orden: "nombre", page: 1 };

/** HU06: catálogo público con búsqueda, filtros, ofertas y disponibilidad por tienda. */
export default function Catalogo() {
  const { usuario } = useSesion();
  const puedeComprar = !usuario || usuario.rol === "cliente";
  const { tienda, elegirTienda } = useCarrito();
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/tiendas/");
  const { datos: categorias } = useCarga<Categoria[]>("/categorias/categorias/");

  const [filtros, setFiltros] = useState(SIN_FILTROS);
  // Los campos de texto esperan a que el cliente deje de escribir antes de consultar.
  const q = useRetraso(filtros.q);
  const precio_min = useRetraso(filtros.precio_min);
  const precio_max = useRetraso(filtros.precio_max);
  const filtrar = (cambios: Partial<typeof filtros>) => setFiltros({ ...filtros, ...cambios, page: 1 });
  const hayFiltros = JSON.stringify({ ...filtros, orden: "nombre", page: 1 }) !== JSON.stringify(SIN_FILTROS);

  // Solo se consulta la disponibilidad de una tienda activa.
  const tiendaActiva = tiendas?.some((t) => t.id === tienda) ? tienda! : undefined;
  const { datos, error, cargando } = useCarga<Paginado<Producto>>(
    tiendas ? conFiltros("/productos/", { ...filtros, q, precio_min, precio_max, tienda: tiendaActiva, page_size: POR_PAGINA }) : null,
  );
  const ofertas = useCarga<Paginado<Producto>>(
    tiendas && !hayFiltros ? conFiltros("/productos/", { en_oferta: true, tienda: tiendaActiva, page_size: 12 }) : null,
  );

  function cambiarPagina(page: number) {
    setFiltros({ ...filtros, page });
    document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Catálogo</h1>
          <p className="subtitulo">Pide online y recoge en tu tienda, sin colas. Pagas al recoger.</p>
        </div>
        {tiendas && <SelectorTienda compacto tiendas={tiendas} elegida={tiendaActiva ?? null} alElegir={elegirTienda} />}
      </div>
      {tiendas && !tiendaActiva && (
        <p className="nota">Elige tu tienda de recojo para ver qué productos hay disponibles.</p>
      )}

      {!hayFiltros && ofertas.datos && ofertas.datos.results.length > 0 && (
        <section aria-labelledby="titulo-ofertas" className="ofertas-destacadas">
          <h2 id="titulo-ofertas">Ofertas de la semana</h2>
          <div className="carrusel">
            {ofertas.datos.results.map((p) => (
              <TarjetaProducto key={p.id} producto={p} puedeComprar={puedeComprar} hayTienda={!!tiendaActiva} />
            ))}
          </div>
        </section>
      )}

      <div className="filtros filtros-catalogo">
        <Campo
          etiqueta="Buscar"
          type="search"
          placeholder="Arroz, leche, detergente…"
          value={filtros.q}
          onChange={(e) => filtrar({ q: e.target.value })}
        />
        <Seleccion etiqueta="Categoría" value={filtros.categoria} onChange={(e) => filtrar({ categoria: e.target.value })}>
          <option value="">Todas</option>
          {categorias?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Seleccion>
        <div className="rango-precio">
          <Campo etiqueta="Precio desde" type="number" min="0" step="0.5" inputMode="decimal" value={filtros.precio_min} onChange={(e) => filtrar({ precio_min: e.target.value })} />
          <Campo etiqueta="hasta" type="number" min="0" step="0.5" inputMode="decimal" value={filtros.precio_max} onChange={(e) => filtrar({ precio_max: e.target.value })} />
        </div>
        <Seleccion etiqueta="Ordenar por" value={filtros.orden} onChange={(e) => setFiltros({ ...filtros, orden: e.target.value, page: 1 })}>
          <option value="nombre">Nombre</option>
          <option value="precio">Menor precio</option>
          <option value="-precio">Mayor precio</option>
        </Seleccion>
        <div className="filtros-casillas">
          <Casilla marcada={filtros.en_oferta} alCambiar={(en_oferta) => filtrar({ en_oferta })}>
            Solo ofertas
          </Casilla>
          <Casilla marcada={filtros.marca_propia} alCambiar={(marca_propia) => filtrar({ marca_propia })}>
            Marca propia
          </Casilla>
          {hayFiltros && (
            <button type="button" className="enlace" onClick={() => setFiltros({ ...SIN_FILTROS, orden: filtros.orden })}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p id="resultados" className="conteo" role="status">
        {datos ? `${datos.count} productos` : ""}
      </p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {cargando && !datos ? (
        <p className="estado">Cargando productos…</p>
      ) : datos?.results.length === 0 ? (
        <p className="estado">No encontramos productos con esos filtros.</p>
      ) : (
        <div className="grilla-productos" aria-busy={cargando}>
          {datos?.results.map((p) => (
            <TarjetaProducto key={p.id} producto={p} puedeComprar={puedeComprar} hayTienda={!!tiendaActiva} />
          ))}
        </div>
      )}
      <Paginacion pagina={filtros.page} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={cambiarPagina} />
    </section>
  );
}
