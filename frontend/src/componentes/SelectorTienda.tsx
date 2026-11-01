import { useId } from "react";
import type { Tienda } from "../tipos";

interface Props {
  tiendas: Tienda[];
  elegida: number | null;
  alElegir: (tienda: number) => void;
  compacto?: boolean;
}

/** HU07: elegir una tienda activa de recojo, mostrando su dirección y horario. */
export default function SelectorTienda({ tiendas, elegida, alElegir, compacto = false }: Props) {
  const id = useId();
  const actual = tiendas.find((t) => t.id === elegida);

  if (compacto) {
    return (
      <div className="selector-tienda compacto">
        <label htmlFor={id}>Recoger en</label>
        <select id={id} value={elegida ?? ""} onChange={(e) => alElegir(Number(e.target.value))}>
          <option value="" disabled>
            Elige tu tienda
          </option>
          {tiendas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        {actual && (
          <small className="dato-secundario">
            {actual.direccion}, {actual.distrito} · {actual.horario}
          </small>
        )}
      </div>
    );
  }

  return (
    <fieldset className="selector-tienda">
      <legend>¿En qué tienda recogerás?</legend>
      <div className="opciones-tienda">
        {tiendas.map((t) => (
          <label key={t.id} className={`opcion-tienda${t.id === elegida ? " elegida" : ""}`}>
            <input type="radio" name={id} checked={t.id === elegida} onChange={() => alElegir(t.id)} />
            <span>
              <strong>{t.nombre}</strong>
              <small className="dato-secundario">
                {t.direccion}, {t.distrito}
              </small>
              <small className="dato-secundario">{t.horario}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
