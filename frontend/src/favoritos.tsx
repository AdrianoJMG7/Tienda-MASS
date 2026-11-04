import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { api, eliminar, post } from "./api";
import { useSesion } from "./auth";

interface Favoritos {
  esFavorito: (producto: number) => boolean;
  /** Guarda o quita el producto; a un visitante lo lleva a ingresar. */
  alternar: (producto: number) => void;
}

const ContextoFavoritos = createContext<Favoritos | null>(null);

/** "Mis favoritos" del cliente: se marcan con el corazón de cada producto. */
export function ProveedorFavoritos({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const esCliente = usuario?.rol === "cliente";
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!esCliente) {
      setIds(new Set());
      return;
    }
    let vigente = true;
    api<number[]>("/productos/favoritos/ids/")
      .then((lista) => vigente && setIds(new Set(lista)))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [esCliente]);

  const alternar = useCallback(
    (producto: number) => {
      if (!usuario) {
        navegar("/ingresar", { state: { desde: pathname } });
        return;
      }
      if (!esCliente) return;
      const guardado = ids.has(producto);
      // Se marca al instante y se revierte si el servidor no lo acepta.
      const cambiar = (agregar: boolean) =>
        setIds((actual) => {
          const nuevo = new Set(actual);
          if (agregar) nuevo.add(producto);
          else nuevo.delete(producto);
          return nuevo;
        });
      cambiar(!guardado);
      const peticion = guardado ? eliminar(`/productos/favoritos/${producto}/`) : post("/productos/favoritos/", { producto });
      peticion.catch(() => cambiar(guardado));
    },
    [usuario, esCliente, ids, navegar, pathname],
  );

  const valor = useMemo(() => ({ esFavorito: (producto: number) => ids.has(producto), alternar }), [ids, alternar]);
  return <ContextoFavoritos.Provider value={valor}>{children}</ContextoFavoritos.Provider>;
}

export function useFavoritos() {
  const favoritos = useContext(ContextoFavoritos);
  if (!favoritos) throw new Error("useFavoritos debe usarse dentro de ProveedorFavoritos");
  return favoritos;
}
