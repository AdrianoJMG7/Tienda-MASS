import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { conFiltros } from "../../api";
import { useSesion } from "../../auth";
import { useCarrito } from "../../carrito";
import Casilla from "../../componentes/Casilla";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import TarjetaProducto from "../../componentes/TarjetaProducto";
import type { Paginado, Producto, Tienda } from "../../tipos";
import { useCarga } from "../../useCarga";

const POR_PAGINA = 24;

type RangoPrecio = "" | "menos_de_5" | "de_5_a_10" | "mas_de_10";

const RANGOS: { valor: Exclude<RangoPrecio, "">; texto: string; min?: number; max?: number }[] = [
  { valor: "menos_de_5", texto: "Menos de S/ 5", max: 4.99 },
  { valor: "de_5_a_10", texto: "S/ 5 – S/ 10", min: 5, max: 10 },
  { valor: "mas_de_10", texto: "Más de S/ 10", min: 10.01 },
];

interface Facetas {
  categorias: { categoria: number; categoria_nombre: string; productos: number }[];
  marcas: { marca: string; productos: number }[];
  precios: Record<Exclude<RangoPrecio, "">, number>;
}

const SIN_FILTROS = {
  categoria: [] as number[],
  marca: [] as string[],
  precio: "" as RangoPrecio,
  con_stock: false,
  en_oferta: false,
  marca_propia: false,
};

const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

/** HU06: catálogo público con búsqueda, filtros con conteos, ofertas y disponibilidad por tienda. */
function Resultados({ q }: { q: string }) {
  const { usuario } = useSesion();
  const puedeComprar = !usuario || usuario.rol === "cliente";
  const { tienda } = useCarrito();
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/tiendas/");

  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [orden, setOrden] = useState(q ? "relevancia" : "nombre");
  const [pagina, setPagina] = useState(1);
  const [verFiltros, setVerFiltros] = useState(false);
  const filtrar = (cambios: Partial<typeof filtros>) => {
    setFiltros({ ...filtros, ...cambios });
    setPagina(1);
  };
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);

  // Solo se consulta la disponibilidad de una tienda activa.
  const tiendaActiva = tiendas?.some((t) => t.id === tienda) ? tienda! : undefined;
  const rango = RANGOS.find((r) => r.valor === filtros.precio);
  const consulta = {
    q,
    categoria: filtros.categoria,
    marca: filtros.marca,
    precio_min: rango?.min,
    precio_max: rango?.max,
    con_stock: filtros.con_stock && !!tiendaActiva,
    en_oferta: filtros.en_oferta,
    marca_propia: filtros.marca_propia,
    tienda: tiendaActiva,
  };
  const listo = tiendas !== null;
  const { datos, error, cargando } = useCarga<Paginado<Producto>>(
    listo ? conFiltros("/productos/productos/", { ...consulta, orden, page: pagina, page_size: POR_PAGINA }) : null,
  );
  const { datos: facetas } = useCarga<Facetas>(listo ? conFiltros("/productos/productos/facetas/", consulta) : null);
  const ofertas = useCarga<Paginado<Producto>>(
    listo && !q && !hayFiltros ? conFiltros("/productos/productos/", { en_oferta: true, tienda: tiendaActiva, page_size: 12 }) : null,
  );

  function cambiarPagina(nueva: number) {
    setPagina(nueva);
    document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="catalogo">
      <div className="barra-titulo">
        <div>
          <h1>
            {q ? (
              <>
                Resultados de búsqueda para <em>{q}</em>
              </>
            ) : (
              "Catálogo"
            )}
          </h1>
          <p className="subtitulo" role="status">
            {datos ? `Se encontraron ${datos.count.toLocaleString("es-PE")} productos` : "Buscando productos…"}
          </p>
        </div>
        <div className="ordenar">
          <label htmlFor="orden">Ordenar por:</label>
          <select
            id="orden"
            value={orden}
            onChange={(e) => {
              setOrden(e.target.value);
              setPagina(1);
            }}
          >
            {q && <option value="relevancia">Relevancia</option>}
            <option value="nombre">Nombre</option>
            <option value="precio">Menor precio</option>
            <option value="-precio">Mayor precio</option>
          </select>
        </div>
      </div>

      {tiendas && !tiendaActiva && (
        <p className="nota">
          <Link to="/tiendas" state={{ desde: "/catalogo" }}>
            Elige tu tienda de recojo
          </Link>{" "}
          para ver qué productos hay disponibles.
        </p>
      )}

      {!q && !hayFiltros && ofertas.datos && ofertas.datos.results.length > 0 && (
        <section aria-labelledby="titulo-ofertas" className="ofertas-destacadas">
          <h2 id="titulo-ofertas">Ofertas de la semana</h2>
          <div className="carrusel">
            {ofertas.datos.results.map((p) => (
              <TarjetaProducto key={p.id} producto={p} puedeComprar={puedeComprar} hayTienda={!!tiendaActiva} />
            ))}
          </div>
        </section>
      )}

      <div className="catalogo-cuerpo">
        <button type="button" className="boton-contorno boton-filtros" aria-expanded={verFiltros} aria-controls="filtros-catalogo" onClick={() => setVerFiltros(!verFiltros)}>
          <Icono nombre="filtro" /> {verFiltros ? "Ocultar filtros" : "Filtrar"}
        </button>

        <aside id="filtros-catalogo" className={`filtros-lateral${verFiltros ? " abierto" : ""}`} aria-label="Filtros">
          <fieldset className="grupo-filtro">
            <legend>
              <Icono nombre="filtro" /> Categoría
            </legend>
            {facetas?.categorias.map((c) => (
              <Casilla key={c.categoria} marcada={filtros.categoria.includes(c.categoria)} alCambiar={() => filtrar({ categoria: alternar(filtros.categoria, c.categoria) })}>
                {c.categoria_nombre} <span className="conteo-filtro">({c.productos})</span>
              </Casilla>
            ))}
          </fieldset>

          {facetas && facetas.marcas.length > 0 && (
            <fieldset className="grupo-filtro">
              <legend>
                <Icono nombre="etiqueta" /> Marca
              </legend>
              {facetas.marcas.map((m) => (
                <Casilla key={m.marca} marcada={filtros.marca.includes(m.marca)} alCambiar={() => filtrar({ marca: alternar(filtros.marca, m.marca) })}>
                  {m.marca} <span className="conteo-filtro">({m.productos})</span>
                </Casilla>
              ))}
            </fieldset>
          )}

          <fieldset className="grupo-filtro">
            <legend>
              <Icono nombre="billete" /> Rango de precios
            </legend>
            {RANGOS.map((r) => (
              <Casilla key={r.valor} marcada={filtros.precio === r.valor} alCambiar={(marcada) => filtrar({ precio: marcada ? r.valor : "" })}>
                {r.texto} <span className="conteo-filtro">({facetas?.precios[r.valor] ?? 0})</span>
              </Casilla>
            ))}
          </fieldset>

          <fieldset className="grupo-filtro">
            <legend>
              <Icono nombre="check" /> Disponibilidad y ofertas
            </legend>
            <Casilla marcada={filtros.con_stock && !!tiendaActiva} alCambiar={(con_stock) => filtrar({ con_stock })}>
              En stock{!tiendaActiva && <span className="conteo-filtro"> (elige tu tienda)</span>}
            </Casilla>
            <Casilla marcada={filtros.en_oferta} alCambiar={(en_oferta) => filtrar({ en_oferta })}>
              Solo ofertas
            </Casilla>
            <Casilla marcada={filtros.marca_propia} alCambiar={(marca_propia) => filtrar({ marca_propia })}>
              Marca Mass
            </Casilla>
          </fieldset>

          {hayFiltros && (
            <button type="button" className="enlace" onClick={() => filtrar(SIN_FILTROS)}>
              Limpiar filtros
            </button>
          )}
        </aside>

        <div id="resultados" className="catalogo-resultados">
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
          <Paginacion pagina={pagina} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={cambiarPagina} />
        </div>
      </div>
    </section>
  );
}

export default function Catalogo() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  // Una búsqueda nueva empieza con los filtros limpios.
  return <Resultados key={q} q={q} />;
}
