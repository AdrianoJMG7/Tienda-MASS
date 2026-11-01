import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { conFiltros } from "./api";
import type { Paginado, Producto, Tienda } from "./tipos";
import { useCarga } from "./useCarga";

// HU07: el carrito y la tienda elegida se guardan en el navegador para que se conserven
// aunque el cliente cierre la página.
const CLAVE = "mass.carrito";
export const MAX_POR_PRODUCTO = 99;

export interface ItemCarrito {
  producto: number;
  cantidad: number;
  // Copia para mostrar el carrito al instante; los precios y el stock se refrescan del servidor.
  nombre: string;
  marca: string;
  foto: string | null;
  precio: number;
}

interface Guardado {
  items: ItemCarrito[];
  tienda: number | null;
}

interface Carrito extends Guardado {
  unidades: number;
  cantidadDe: (producto: number) => number;
  agregar: (producto: Producto, cantidad?: number) => void;
  cambiarCantidad: (producto: number, cantidad: number) => void;
  quitar: (producto: number) => void;
  vaciar: () => void;
  elegirTienda: (tienda: number) => void;
}

function leer(): Guardado {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Guardado | null;
    if (guardado && Array.isArray(guardado.items)) return guardado;
  } catch {
    // Almacenamiento no disponible o dañado: se empieza con un carrito vacío.
  }
  return { items: [], tienda: null };
}

const ContextoCarrito = createContext<Carrito | null>(null);

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Guardado>(leer);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento el carrito dura mientras la página esté abierta.
    }
  }, [estado]);

  // Si el carrito cambia en otra pestaña, se sincroniza.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => e.key === CLAVE && setEstado(leer());
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const agregar = useCallback((p: Producto, cantidad = 1) => {
    setEstado((e) => {
      const existente = e.items.find((i) => i.producto === p.id);
      const items = existente
        ? e.items.map((i) =>
            i.producto === p.id ? { ...i, cantidad: Math.min(i.cantidad + cantidad, MAX_POR_PRODUCTO) } : i,
          )
        : [
            ...e.items,
            { producto: p.id, cantidad, nombre: p.nombre, marca: p.marca, foto: p.foto, precio: p.precio_final },
          ];
      return { ...e, items };
    });
  }, []);

  const cambiarCantidad = useCallback((producto: number, cantidad: number) => {
    setEstado((e) => ({
      ...e,
      items:
        cantidad <= 0
          ? e.items.filter((i) => i.producto !== producto)
          : e.items.map((i) => (i.producto === producto ? { ...i, cantidad: Math.min(cantidad, MAX_POR_PRODUCTO) } : i)),
    }));
  }, []);

  const quitar = useCallback((producto: number) => cambiarCantidad(producto, 0), [cambiarCantidad]);
  const vaciar = useCallback(() => setEstado((e) => ({ ...e, items: [] })), []);
  const elegirTienda = useCallback((tienda: number) => setEstado((e) => ({ ...e, tienda })), []);

  const valor = useMemo<Carrito>(
    () => ({
      ...estado,
      unidades: estado.items.reduce((suma, i) => suma + i.cantidad, 0),
      cantidadDe: (producto) => estado.items.find((i) => i.producto === producto)?.cantidad ?? 0,
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      elegirTienda,
    }),
    [estado, agregar, cambiarCantidad, quitar, vaciar, elegirTienda],
  );
  return <ContextoCarrito.Provider value={valor}>{children}</ContextoCarrito.Provider>;
}

export function useCarrito() {
  const carrito = useContext(ContextoCarrito);
  if (!carrito) throw new Error("useCarrito debe usarse dentro de ProveedorCarrito");
  return carrito;
}

export interface LineaCarrito extends ItemCarrito {
  /** El producto ya no está en el catálogo (fue desactivado). */
  retirado: boolean;
  /** Unidades en la tienda elegida (null si no se eligió tienda). */
  disponible: number | null;
  precioOferta: boolean;
  subtotal: number;
}

/** Carrito con precios vigentes y stock de la tienda elegida, consultados al servidor. */
export function useCarritoActualizado() {
  const { items, tienda } = useCarrito();
  const ids = items.map((i) => i.producto).sort((a, b) => a - b).join(",");
  const { datos: tiendas } = useCarga<Tienda[]>("/tiendas/");
  const consulta = useCarga<Paginado<Producto>>(
    ids ? conFiltros("/productos/", { ids, tienda: tienda ?? undefined, page_size: 100 }) : null,
  );

  const tiendaElegida = tiendas?.find((t) => t.id === tienda) ?? null;
  const frescos = new Map(consulta.datos?.results.map((p) => [p.id, p]));
  const listo = !ids || consulta.datos !== null;

  const lineas: LineaCarrito[] = items.map((item) => {
    const fresco = frescos.get(item.producto);
    const precio = fresco?.precio_final ?? item.precio;
    return {
      ...item,
      precio,
      foto: fresco?.foto ?? item.foto,
      retirado: listo && !!ids && !fresco,
      disponible: fresco && tiendaElegida ? (fresco.disponible ?? 0) : null,
      precioOferta: fresco?.precio_oferta != null,
      subtotal: precio * item.cantidad,
    };
  });

  const problemas = lineas.filter((l) => l.retirado || (l.disponible !== null && l.disponible < l.cantidad));
  return {
    lineas,
    tiendas: tiendas ?? [],
    tiendaElegida,
    total: lineas.filter((l) => !l.retirado).reduce((suma, l) => suma + l.subtotal, 0),
    problemas,
    cargando: !listo,
    error: consulta.error,
  };
}
