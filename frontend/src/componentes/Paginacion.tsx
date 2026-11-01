interface Props {
  pagina: number;
  total: number;
  porPagina?: number;
  alCambiar: (pagina: number) => void;
}

export default function Paginacion({ pagina, total, porPagina = 24, alCambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas === 1) return null;
  return (
    <nav className="paginacion" aria-label="Paginación">
      <button type="button" className="boton secundario" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
        Anterior
      </button>
      <span aria-live="polite">
        Página {pagina} de {paginas}
      </span>
      <button
        type="button"
        className="boton secundario"
        disabled={pagina >= paginas}
        onClick={() => alCambiar(pagina + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
