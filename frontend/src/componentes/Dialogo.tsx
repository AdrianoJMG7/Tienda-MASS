import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  titulo: string;
  abierto: boolean;
  alCerrar: () => void;
  children: ReactNode;
  /** "lateral" lo muestra como panel a la derecha, como los detalles del vendedor. */
  variante?: "lateral";
}

/** Ventana modal nativa (<dialog>): atrapa el foco y se cierra con Escape. */
export default function Dialogo({ titulo, abierto, alCerrar, children, variante }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog ref={ref} className={variante ? `dialogo ${variante}` : "dialogo"} aria-labelledby={idTitulo} onClose={alCerrar}>
      <div className="dialogo-cabecera">
        <h2 id={idTitulo}>{titulo}</h2>
        <button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>
          ×
        </button>
      </div>
      {/* El contenido se monta solo al abrir, así cada formulario empieza limpio. */}
      {abierto && children}
    </dialog>
  );
}
