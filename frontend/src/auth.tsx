import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, guardarTokens, leerTokens, post, type Rol, type Usuario } from "./api";

interface DatosRegistro {
  email: string;
  nombre: string;
  celular: string;
  password: string;
  acepta_privacidad: boolean;
}

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  ingresar: (email: string, password: string) => Promise<Usuario>;
  registrarse: (datos: DatosRegistro) => Promise<Usuario>;
  salir: () => Promise<void>;
}

const ContextoSesion = createContext<Sesion | null>(null);

export const RUTA_INICIO: Record<Rol, string> = {
  admin: "/admin",
  vendedor: "/vendedor",
  cliente: "/cliente",
};

// Páginas de la tienda online a las que un cliente vuelve tras ingresar (p. ej. desde el carrito).
const RUTAS_TIENDA = ["/catalogo", "/carrito", "/confirmar", "/pedido/"];

/** A dónde ir después de ingresar o registrarse: a la página de origen si el rol puede verla. */
export function destinoTrasIngresar(rol: Rol, desde?: string) {
  const inicio = RUTA_INICIO[rol];
  if (desde?.startsWith(inicio)) return desde;
  if (rol === "cliente" && desde && RUTAS_TIENDA.some((ruta) => desde.startsWith(ruta))) return desde;
  return inicio;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(() => leerTokens() !== null);

  // Al abrir la página se recupera la sesión guardada, si sigue siendo válida.
  useEffect(() => {
    if (!leerTokens()) return;
    api<Usuario>("/auth/yo/")
      .then(setUsuario)
      .catch(() => guardarTokens(null))
      .finally(() => setCargando(false));
  }, []);

  const ingresar = useCallback(async (email: string, password: string) => {
    const r = await post<{ access: string; refresh: string; usuario: Usuario }>("/auth/login/", { email, password });
    guardarTokens({ access: r.access, refresh: r.refresh });
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const registrarse = useCallback(
    async (datos: DatosRegistro) => {
      await post("/auth/registro/", datos);
      return ingresar(datos.email, datos.password);
    },
    [ingresar],
  );

  const salir = useCallback(async () => {
    const tokens = leerTokens();
    if (tokens) await post("/auth/logout/", { refresh: tokens.refresh }).catch(() => undefined);
    guardarTokens(null);
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, ingresar, registrarse, salir }),
    [usuario, cargando, ingresar, registrarse, salir],
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  return sesion;
}
