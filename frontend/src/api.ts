// Cliente HTTP de la API: agrega el token JWT y lo renueva una vez si expiró.

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
const CLAVE_TOKENS = "mass.tokens";

export type Rol = "admin" | "vendedor" | "cliente";

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  celular: string;
  rol: Rol;
  tienda: number | null;
  tienda_nombre: string | null;
}

interface Tokens {
  access: string;
  refresh: string;
}

/** Error de la API con el mensaje general y, si los hay, los errores por campo. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly campos: Record<string, string>;
  /** Respuesta JSON original, para errores con datos extra (p. ej. productos sin stock). */
  readonly cuerpo: unknown;

  constructor(estado: number, mensaje: string, campos: Record<string, string> = {}, cuerpo: unknown = null) {
    super(mensaje);
    this.estado = estado;
    this.campos = campos;
    this.cuerpo = cuerpo;
  }
}

/** Convierte errores anidados de DRF (listas y objetos) en un texto legible. */
function aTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(aTexto).filter(Boolean).join(" ");
  if (valor && typeof valor === "object") return Object.values(valor).map(aTexto).filter(Boolean).join(" ");
  return valor == null ? "" : String(valor);
}

export function leerTokens(): Tokens | null {
  try {
    const texto = localStorage.getItem(CLAVE_TOKENS);
    return texto ? (JSON.parse(texto) as Tokens) : null;
  } catch {
    return null;
  }
}

export function guardarTokens(tokens: Tokens | null) {
  try {
    if (tokens) localStorage.setItem(CLAVE_TOKENS, JSON.stringify(tokens));
    else localStorage.removeItem(CLAVE_TOKENS);
  } catch {
    // Sin almacenamiento disponible la sesión dura solo mientras la página esté abierta.
  }
}

async function convertirError(respuesta: Response): Promise<ErrorApi> {
  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Respuesta sin JSON (p. ej. error 500 del servidor).
  }
  const campos: Record<string, string> = {};
  let mensaje = "No se pudo completar la operación. Intenta de nuevo.";
  if (cuerpo && typeof cuerpo === "object") {
    for (const [campo, valor] of Object.entries(cuerpo)) {
      if (campo === "code" || campo === "messages") continue;
      const texto = aTexto(valor);
      if (campo === "detail" || campo === "non_field_errors") mensaje = texto;
      else campos[campo] = texto;
    }
    if (Object.keys(campos).length > 0 && !("detail" in cuerpo)) mensaje = "Revisa los datos marcados.";
  }
  if (respuesta.status === 0 || respuesta.status >= 500) mensaje = "El servidor no está disponible en este momento.";
  return new ErrorApi(respuesta.status, mensaje, campos, cuerpo);
}

async function renovar(refresh: string): Promise<boolean> {
  const respuesta = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!respuesta.ok) {
    guardarTokens(null);
    return false;
  }
  const nuevos = (await respuesta.json()) as Partial<Tokens>;
  guardarTokens({ access: nuevos.access!, refresh: nuevos.refresh ?? refresh });
  return true;
}

export async function api<T>(ruta: string, opciones: RequestInit = {}, reintentar = true): Promise<T> {
  const tokens = leerTokens();
  const headers = new Headers(opciones.headers);
  // Con FormData (fotos) el navegador pone el Content-Type multipart con su separador.
  if (opciones.body && !(opciones.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, { ...opciones, headers });
  } catch {
    throw new ErrorApi(0, "No hay conexión con el servidor.");
  }

  if (respuesta.status === 401 && tokens && reintentar && (await renovar(tokens.refresh))) {
    return api<T>(ruta, opciones, false);
  }
  if (!respuesta.ok) throw await convertirError(respuesta);
  if (respuesta.status === 204 || respuesta.status === 205) return undefined as T;
  return (await respuesta.json()) as T;
}

const cuerpo = (datos: unknown) => (datos instanceof FormData ? datos : JSON.stringify(datos));

export const post = <T>(ruta: string, datos: unknown) => api<T>(ruta, { method: "POST", body: cuerpo(datos) });
export const patch = <T>(ruta: string, datos: unknown) => api<T>(ruta, { method: "PATCH", body: cuerpo(datos) });
export const eliminar = (ruta: string) => api<void>(ruta, { method: "DELETE" });

/** Arma la ruta con sus filtros, omitiendo los vacíos. */
export function conFiltros(ruta: string, filtros: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "" && valor !== false) params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

// Funciones específicas para inventario (HU14, HU15)
export const getInventario = (filtros?: Record<string, string | number | boolean | undefined>) =>
  api<any[]>(conFiltros("/inventario/inventario/", filtros || {}));

export const getAlertas = () => api<any>("/inventario/inventario/alertas/");

export const getMovimientos = (filtros?: Record<string, string | number | boolean | undefined>) =>
  api<any[]>(conFiltros("/inventario/movimientos/", filtros || {}));

export const registrarIngreso = (items: unknown[]) => post<any>("/inventario/inventario/ingreso/", items);

export const registrarMerma = (items: unknown[]) => post<any>("/inventario/inventario/merma/", items);
