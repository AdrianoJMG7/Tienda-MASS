import type { ReactNode } from "react";
import Icono, { type NombreIcono } from "./Icono";

interface Props {
  icono: NombreIcono;
  titulo: string;
  valor: string;
  /** Variación porcentual contra el periodo anterior; null si no hay con qué comparar. */
  variacion?: number | null;
  /** Con qué se compara, p. ej. "vs ayer". */
  referencia?: string;
  children?: ReactNode;
}

/** Tarjeta con un indicador (ventas, pedidos…) y su variación. */
export default function TarjetaIndicador({ icono, titulo, valor, variacion, referencia, children }: Props) {
  return (
    <div className="tarjeta tarjeta-indicador">
      <span className="indicador-icono">
        <Icono nombre={icono} tamano={32} />
      </span>
      <div>
        <span className="indicador-titulo">{titulo}</span>
        <strong className="indicador-valor">{valor}</strong>
        {variacion != null && (
          <span className={`indicador-variacion ${variacion < 0 ? "baja" : "sube"}`}>
            <Icono nombre={variacion < 0 ? "flechaBaja" : "flechaSube"} tamano={16} />
            {variacion > 0 ? "+" : ""}
            {variacion}% {referencia}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
