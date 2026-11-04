import Icono from "./Icono";

interface Props {
  pagina: number;
  total: number;
  porPagina?: number;
  alCambiar: (pagina: number) => void;
}

/** Páginas visibles: la primera, la última y las vecinas de la actual, con "…" entre saltos. */
function paginasVisibles(actual: number, total: number): (number | "…")[] {
  const numeros = [...new Set([1, actual - 1, actual, actual + 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado: (number | "…")[] = [];
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) resultado.push("…");
    resultado.push(n);
  });
  return resultado;
}

export default function Paginacion({ pagina, total, porPagina = 24, alCambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas === 1) return null;
  return (
    <nav className="paginacion" aria-label="Paginación">
      <button type="button" className="pagina flecha" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} aria-label="Página anterior">
        <Icono nombre="flechaIzq" />
      </button>
      {paginasVisibles(pagina, paginas).map((n, i) =>
        n === "…" ? (
          <span key={`salto-${i}`} className="pagina-salto" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`pagina${n === pagina ? " actual" : ""}`}
            aria-current={n === pagina ? "page" : undefined}
            aria-label={`Página ${n}`}
            onClick={() => alCambiar(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className="pagina flecha" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)} aria-label="Página siguiente">
        <Icono nombre="flechaDer" />
      </button>
    </nav>
  );
}
