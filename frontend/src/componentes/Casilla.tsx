import { useId, type ReactNode } from "react";

interface Props {
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  children: ReactNode;
}

export default function Casilla({ marcada, alCambiar, children }: Props) {
  const id = useId();
  return (
    <div className="campo casilla">
      <input id={id} type="checkbox" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}
