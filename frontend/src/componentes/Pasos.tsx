import Icono from "./Icono";

const PASOS = ["Tu carrito", "Confirmar pedido", "Pedido confirmado"];

/** Avance de la compra: carrito → confirmar → confirmado. `actual` empieza en 1. */
export default function Pasos({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <ol className="pasos" aria-label="Pasos de la compra">
      {PASOS.map((texto, i) => {
        const numero = i + 1;
        const estado = numero < actual ? "hecho" : numero === actual ? "actual" : "pendiente";
        return (
          <li key={texto} className={`paso ${estado}`} aria-current={estado === "actual" ? "step" : undefined}>
            <span className="paso-numero">{estado === "hecho" ? <Icono nombre="check" tamano={18} /> : numero}</span>
            <span className="paso-texto">
              {texto}
              {estado === "hecho" && <span className="solo-lector"> (completado)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
