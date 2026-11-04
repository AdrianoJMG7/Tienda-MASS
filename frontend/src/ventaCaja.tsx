import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_POR_PRODUCTO } from "./carrito";

// La venta en curso se guarda en el navegador: sobrevive al ir al escáner o recargar la página.
const CLAVE = "mass.venta";

export interface ItemCaja {
  producto: number;
  cantidad: number;
  nombre: string;
  foto: string | null;
  precio: number;
  /** Unidades en la tienda al agregarlo; el servidor vuelve a validar al cobrar. */
  disponible: number;
}

interface VentaCaja {
  items: ItemCaja[];
  total: number;
  unidades: number;
  agregar: (item: Omit<ItemCaja, "cantidad">) => void;
  cambiarCantidad: (producto: number, cantidad: number) => void;
  limpiar: () => void;
}

function leer(): ItemCaja[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

const Contexto = createContext<VentaCaja | null>(null);

export function ProveedorVenta({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCaja[]>(leer);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      // Sin almacenamiento la venta dura mientras la página esté abierta.
    }
  }, [items]);

  const agregar = useCallback((item: Omit<ItemCaja, "cantidad">) => {
    setItems((actual) => {
      const existente = actual.find((i) => i.producto === item.producto);
      if (!existente) return [...actual, { ...item, cantidad: 1 }];
      const tope = Math.min(item.disponible, MAX_POR_PRODUCTO);
      return actual.map((i) => (i.producto === item.producto ? { ...i, ...item, cantidad: Math.min(i.cantidad + 1, tope) } : i));
    });
  }, []);

  const cambiarCantidad = useCallback((producto: number, cantidad: number) => {
    setItems((actual) =>
      cantidad <= 0 ? actual.filter((i) => i.producto !== producto) : actual.map((i) => (i.producto === producto ? { ...i, cantidad } : i)),
    );
  }, []);

  const limpiar = useCallback(() => setItems([]), []);

  const valor = useMemo(
    () => ({
      items,
      total: items.reduce((suma, i) => suma + i.precio * i.cantidad, 0),
      unidades: items.reduce((suma, i) => suma + i.cantidad, 0),
      agregar,
      cambiarCantidad,
      limpiar,
    }),
    [items, agregar, cambiarCantidad, limpiar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useVentaCaja() {
  const venta = useContext(Contexto);
  if (!venta) throw new Error("useVentaCaja debe usarse dentro de ProveedorVenta");
  return venta;
}
