import type { ReactNode } from "react";
import Icono, { type NombreIcono } from "./Icono";

interface Props {
  icono: NombreIcono;
  titulo: string;
  subtitulo: string;
  /** Acción a la derecha del título (actualizar, exportar, etc.). */
  children?: ReactNode;
}

/** Título de página del vendedor: ícono en círculo, título, descripción y acción opcional. */
export default function EncabezadoPagina({ icono, titulo, subtitulo, children }: Props) {
  return (
    <header className="encabezado-pagina">
      <span className="encabezado-icono">
        <Icono nombre={icono} tamano={48} />
      </span>
      <div className="encabezado-texto">
        <h1>{titulo}</h1>
        <p className="subtitulo">{subtitulo}</p>
      </div>
      {children && <div className="encabezado-accion">{children}</div>}
    </header>
  );
}
