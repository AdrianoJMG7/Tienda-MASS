const moneda = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const fecha = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" });
const fechaHora = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" });

export const soles = (valor: number) => moneda.format(valor);

/** Fecha "AAAA-MM-DD" del servidor, sin desplazarla por zona horaria. */
export const formatoFecha = (iso: string) => fecha.format(new Date(`${iso}T12:00:00`));

export const formatoFechaHora = (iso: string) => fechaHora.format(new Date(iso));

/** Fecha de hoy en formato AAAA-MM-DD (hora local), para los campos de fecha. */
export function hoyIso(diasExtra = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasExtra);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** IGV (18 %) que ya está incluido en un precio al público; solo es referencial. */
export const igvIncluido = (total: number) => Math.round((total - total / 1.18) * 100) / 100;

/** Descuento de una oferta en porcentaje entero (0 si no hay oferta). */
export const descuento = (precio: number, oferta: number | null) => (oferta != null ? Math.round((1 - oferta / precio) * 100) : 0);
