import { useState } from "react";
import { Link, useParams } from "react-router";
import { conFiltros } from "../../api";
import { useSesion } from "../../auth";
import { MAX_POR_PRODUCTO, useCarrito } from "../../carrito";
import Disponibilidad from "../../componentes/Disponibilidad";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Recomendados from "../../componentes/Recomendados";
import { BotonFavorito } from "../../componentes/TarjetaProducto";
import { descuento, formatoFecha, soles } from "../../formato";
import type { Paginado, Producto } from "../../tipos";
import { useCarga } from "../../useCarga";

const BENEFICIOS = [
  { icono: "medalla", titulo: "Calidad garantizada", texto: "Productos frescos y de calidad" },
  { icono: "bolsa", titulo: "Compra fácil", texto: "Pide online y paga al recoger" },
  { icono: "tienda", titulo: "Recojo en tienda", texto: "Elige tu tienda más cercana" },
] as const;

/** Ficha del producto: precio vigente, disponibilidad en la tienda elegida y productos de la misma categoría. */
export default function DetalleProducto() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const puedeComprar = !usuario || usuario.rol === "cliente";
  const { tienda, agregar, cantidadDe } = useCarrito();
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  // Se consulta por la lista para recibir el precio vigente y el stock de la tienda elegida.
  const { datos, error, cargando } = useCarga<Paginado<Producto>>(
    conFiltros("/productos/productos/", { ids: id, tienda: tienda ?? undefined }),
  );
  const producto = datos?.results[0];

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (cargando && !producto) return <p className="estado">Cargando producto…</p>;
  if (!producto) {
    return (
      <section className="tarjeta vacio">
        <h1>Producto no disponible</h1>
        <p className="subtitulo">Puede que ya no esté en el catálogo.</p>
        <Link to="/catalogo" className="boton-primario">
          Ir al catálogo
        </Link>
      </section>
    );
  }

  const disponible = tienda != null ? (producto.disponible ?? 0) : null;
  const enCarrito = cantidadDe(producto.id);
  const tope = Math.max(0, Math.min(disponible ?? MAX_POR_PRODUCTO, MAX_POR_PRODUCTO) - enCarrito);
  const rebaja = descuento(producto.precio, producto.precio_oferta);

  function agregarAlCarrito() {
    agregar(producto!, Math.min(cantidad, tope));
    setCantidad(1);
    setAgregado(true);
  }

  return (
    <section className="detalle-producto">
      <nav className="migas" aria-label="Ruta de navegación">
        <Link to="/catalogo" className="enlace-flecha">
          <Icono nombre="flechaIzq" tamano={18} /> Volver al catálogo
        </Link>
        <ol>
          <li>
            <Link to="/">Inicio</Link>
          </li>
          <li>
            <Link to={`/catalogo`}>{producto.categoria_nombre}</Link>
          </li>
          <li aria-current="page">{producto.nombre}</li>
        </ol>
      </nav>

      <div className="detalle-cuerpo">
        <div className="tarjeta detalle-foto">
          {puedeComprar && <BotonFavorito producto={producto} />}
          <FotoProducto producto={producto} tamano={280} />
        </div>

        <div className="tarjeta detalle-info">
          <h1>{producto.nombre}</h1>
          <p className="detalle-marca">
            {producto.marca}
            {producto.marca_propia && <span className="insignia propia">Marca Mass</span>}
          </p>
          <Disponibilidad unidades={disponible} />

          <p className="detalle-precio">
            <strong className={rebaja > 0 ? "precio-oferta" : undefined}>{soles(producto.precio_final)}</strong>
            {rebaja > 0 && (
              <>
                <s className="precio-antes">
                  <span className="solo-lector">Antes </span>
                  {soles(producto.precio)}
                </s>
                <span className="pastilla-descuento">−{rebaja}%</span>
              </>
            )}
          </p>
          {producto.oferta_fin && <p className="dato-secundario">Oferta válida hasta el {formatoFecha(producto.oferta_fin)}.</p>}
          {producto.descripcion && <p className="detalle-descripcion">{producto.descripcion}</p>}

          {puedeComprar && (
            <div className="detalle-compra">
              <div className="cantidad" role="group" aria-label="Cantidad a agregar">
                <button type="button" aria-label="Una menos" disabled={cantidad <= 1} onClick={() => setCantidad(cantidad - 1)}>
                  −
                </button>
                <output aria-live="polite">{cantidad}</output>
                <button type="button" aria-label="Una más" disabled={cantidad >= tope} onClick={() => setCantidad(cantidad + 1)}>
                  +
                </button>
              </div>
              <button type="button" className="boton-primario" disabled={tope === 0} onClick={agregarAlCarrito}>
                <Icono nombre="carrito" />
                {disponible === 0 ? "Agotado en tu tienda" : tope === 0 ? "Ya tienes el máximo" : "Agregar al carrito"}
              </button>
            </div>
          )}
          {agregado && (
            <p className="aviso" role="status">
              Agregado. <Link to="/carrito">Ver carrito ({enCarrito})</Link>
            </p>
          )}

          <div className="banda-recojo">
            <Icono nombre="tienda" tamano={26} />
            <span>
              <strong>Recojo en tienda</strong>
              <small>{tienda != null ? "Disponibilidad según tu tienda de recojo." : "Elige tu tienda para ver si hay stock."}</small>
            </span>
            <Link to="/tiendas" state={{ desde: `/producto/${producto.id}` }} className="enlace-flecha">
              Ver tiendas <Icono nombre="flechaDer" tamano={18} />
            </Link>
          </div>
        </div>

        <aside className="tarjeta detalle-beneficios" aria-label="Beneficios">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="beneficio">
              <Icono nombre={b.icono} tamano={32} />
              <span>
                <strong>{b.titulo}</strong>
                <small>{b.texto}</small>
              </span>
            </div>
          ))}
        </aside>
      </div>

      <Recomendados
        filtros={{ categoria: producto.categoria }}
        excluir={[producto.id]}
        enlace="/catalogo"
        puedeComprar={puedeComprar}
      />
    </section>
  );
}
