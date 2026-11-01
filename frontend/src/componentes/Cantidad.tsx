import { MAX_POR_PRODUCTO } from "../carrito";

interface Props {
  valor: number;
  maximo?: number;
  nombre: string;
  alCambiar: (valor: number) => void;
}

/** Control − cantidad + con botones de 44px para usar cómodamente en el celular. */
export default function Cantidad({ valor, maximo = MAX_POR_PRODUCTO, nombre, alCambiar }: Props) {
  const tope = Math.min(maximo, MAX_POR_PRODUCTO);
  return (
    <div className="cantidad" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button type="button" aria-label={valor === 1 ? `Quitar ${nombre}` : "Una menos"} onClick={() => alCambiar(valor - 1)}>
        −
      </button>
      <output aria-live="polite">{valor}</output>
      <button type="button" aria-label="Una más" disabled={valor >= tope} onClick={() => alCambiar(valor + 1)}>
        +
      </button>
    </div>
  );
}
