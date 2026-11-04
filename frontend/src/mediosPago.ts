import type { NombreIcono } from "./componentes/Icono";
import type { MedioPago } from "./tipos";

/** Medios de pago: todos se pagan al recoger, en la caja de la tienda. No se guardan datos de tarjetas. */
export const MEDIOS_PAGO: { valor: MedioPago; titulo: string; texto: string; icono: NombreIcono }[] = [
  { valor: "efectivo", titulo: "Efectivo", texto: "Pagas al recoger en caja", icono: "billete" },
  { valor: "tarjeta", titulo: "Tarjeta de crédito o débito", texto: "Visa, Mastercard y más, al recoger", icono: "tarjeta" },
  { valor: "yape_plin", titulo: "Billetera digital", texto: "Yape o Plin, al recoger", icono: "billetera" },
];
