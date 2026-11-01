import { useId, type SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  error?: string;
}

export default function Seleccion({ etiqueta, error, children, ...select }: Props) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...select}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="error-campo">
          {error}
        </p>
      )}
    </div>
  );
}
