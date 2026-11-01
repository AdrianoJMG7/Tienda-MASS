import { useId, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

/** Campo de formulario con etiqueta y mensaje de error accesibles. */
export default function Campo({ etiqueta, error, ayuda, ...input }: Props) {
  const id = useId();
  const idMensaje = `${id}-mensaje`;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || ayuda ? idMensaje : undefined}
        {...input}
      />
      {error ? (
        <p id={idMensaje} className="error-campo">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={idMensaje} className="ayuda">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}
