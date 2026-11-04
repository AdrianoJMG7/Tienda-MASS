import { createPortal } from "react-dom";
import { formatoFechaHora, igvIncluido, soles } from "../formato";
import type { Venta } from "../tipos";

export type FormatoComprobante = "boleta" | "ticket";

/** Abre el diálogo de impresión después de que el comprobante se pintó con el formato elegido. */
export function imprimirComprobante() {
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/** Comprobante de una venta: solo se ve al imprimir. Es un prototipo, no un documento tributario. */
export default function Comprobante({ venta, formato }: { venta: Venta; formato: FormatoComprobante }) {
  return createPortal(
    <div className={`comprobante ${formato}`}>
      <h1>Mass</h1>
      <p>{formato === "boleta" ? "Boleta de venta" : "Ticket de venta"}</p>
      <p>N.º {venta.numero_ticket}</p>
      <p>{formatoFechaHora(venta.fecha)}</p>
      <p>Atendió: {venta.vendedor_nombre}</p>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalles.map((d) => (
            <tr key={d.id}>
              <td>{d.producto_nombre}</td>
              <td>{d.cantidad}</td>
              <td>{soles(d.precio_unitario)}</td>
              <td>{soles(d.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>IGV (18 %) incluido: {soles(igvIncluido(venta.total))}</p>
      <p className="comprobante-total">Total: {soles(venta.total)}</p>
      <p>Pago: {venta.medio_pago_display}</p>
      {venta.monto_recibido != null && <p>Recibido: {soles(venta.monto_recibido)}</p>}
      {venta.vuelto != null && <p>Vuelto: {soles(venta.vuelto)}</p>}
      <p className="comprobante-nota">Prototipo académico con datos simulados: no es un comprobante tributario.</p>
    </div>,
    document.body,
  );
}
