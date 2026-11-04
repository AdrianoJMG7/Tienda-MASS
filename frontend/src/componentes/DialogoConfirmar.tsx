import { useState, type ReactNode } from "react";
import Dialogo from "./Dialogo";
import Icono from "./Icono";

interface Props {
  titulo: string;
  abierto: boolean;
  textoConfirmar: string;
  alCerrar: () => void;
  /** Si falla, el mensaje de error se muestra dentro del diálogo. */
  alConfirmar: () => Promise<void>;
  children: ReactNode;
}

/** Pide confirmar una acción con el mismo diseño del resto de la aplicación. */
export default function DialogoConfirmar({ titulo, abierto, textoConfirmar, alCerrar, alConfirmar, children }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      await alConfirmar();
      alCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={titulo} abierto={abierto} alCerrar={alCerrar}>
      <div>{children}</div>
      {error && <p className="alerta" role="alert">{error}</p>}
      <div className="acciones-dialogo">
        <button type="button" className="boton-contorno" onClick={alCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton-primario" disabled={enviando} onClick={confirmar}>
          <Icono nombre="check" /> {enviando ? "Guardando…" : textoConfirmar}
        </button>
      </div>
    </Dialogo>
  );
}
