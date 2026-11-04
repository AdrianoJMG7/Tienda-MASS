import type { ReactElement } from "react";

// Íconos de trazo (24×24) dibujados para Mass: heredan el color del texto que los rodea.
const TRAZOS = {
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.6-4.6" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  carrito: (
    <>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </>
  ),
  corazon: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  casa: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  caja: (
    <>
      <path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
    </>
  ),
  tarjeta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  billetera: (
    <>
      <path d="M17 7V5H5a2 2 0 0 0 0 4" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13.5h2" />
    </>
  ),
  billete: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 16l-4-4 4-4M6 12h10" />
    </>
  ),
  tienda: (
    <>
      <path d="M3 9l2-5h14l2 5M3 9h18" />
      <path d="M5 9v11h14V9M10 20v-5h4v5" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  basura: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  ojo: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ojoTachado: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </>
  ),
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" />
    </>
  ),
  flechaIzq: <path d="M19 12H5M11 18l-6-6 6-6" />,
  flechaDer: <path d="M5 12h14M13 6l6 6-6 6" />,
  abajo: <path d="M6 9l6 6 6-6" />,
  derecha: <path d="M9 6l6 6-6 6" />,
  izquierda: <path d="M15 6l-6 6 6 6" />,
  estrella: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  filtro: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  etiqueta: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  copiar: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  celular: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  dni: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M14 10h4M14 14h4M6 16c.5-1.4 1.6-2 3-2s2.5.6 3 2" />
    </>
  ),
  camara: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  lapiz: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  subir: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  guardar: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M7 3v5h8V3M7 21v-7h10v7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  medalla: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14L7 21l5-3 5 3-1.5-7M9.5 9l1.8 1.8L14.8 7.5" />
    </>
  ),
  bolsa: <path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2" />,
  documento: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  cambiar: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  apagar: <path d="M12 3v9M6.3 6.7a8 8 0 1 0 11.4 0" />,
  cuadricula: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  imagen: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  registradora: (
    <>
      <path d="M8 9V4h8v5M6 9h12l2 7H4z" />
      <rect x="3" y="16" width="18" height="5" rx="1" />
      <path d="M8 12h2M13 12h3M10 18.5h4" />
    </>
  ),
  cajas: (
    <>
      <path d="M12 3l4 2v4l-4 2-4-2V5zM7 11l4 2v4l-4 2-4-2v-4zM17 11l4 2v4l-4 2-4-2v-4z" />
      <path d="M8 5l4 2 4-2M3 13l4 2 4-2M13 13l4 2 4-2" />
    </>
  ),
  qr: (
    <>
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
      <rect x="7" y="7" width="4" height="4" />
      <rect x="13" y="7" width="4" height="4" />
      <rect x="7" y="13" width="4" height="4" />
      <path d="M13 13h2v2M17 13v.01M13 17h4v-2" />
    </>
  ),
  historial: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  grafico: (
    <>
      <path d="M4 20v-5h4v5zM10 20v-9h4v9zM16 20V8h4v12z" />
      <path d="M4 10l5-5 4 3 6-6M15 2h4v4" />
    </>
  ),
  barras: <path d="M4 20v-6h4v6zM10 20V6h4v14zM16 20v-9h4v9z" />,
  actualizar: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 8.5M4 13a8 8 0 0 0 14 4.5l2-2" />
      <path d="M4 4v4.5h4.5M20 20v-4.5h-4.5" />
    </>
  ),
  iniciar: <path d="M7 4l13 8-13 8z" />,
  prohibir: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.7 5.7l12.6 12.6" />
    </>
  ),
  camion: (
    <>
      <path d="M2 6h12v11H2zM14 10h4l4 4v3h-8z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  linterna: <path d="M7 3h10v4l-2 4v10H9V11L7 7zM7 7h10M12 14v2" />,
  descargar: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  imprimir: (
    <>
      <path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3" />
      <rect x="7" y="14" width="10" height="7" />
    </>
  ),
  devolver: (
    <>
      <path d="M4 9h11a5 5 0 0 1 0 10H9" />
      <path d="M8 5L4 9l4 4" />
    </>
  ),
  escudo: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  trofeo: (
    <>
      <path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4" />
      <path d="M12 14v4M9 18h6v3H9z" />
    </>
  ),
  campana: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  monedas: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v4c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 10v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4M4 14v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
    </>
  ),
  alerta: <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />,
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5c2 .8 3.5 2.8 3.5 5.5" />
    </>
  ),
  calculadora: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </>
  ),
  circular: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </>
  ),
  flechaSube: <path d="M6 18L18 6M9 6h9v9" />,
  flechaBaja: <path d="M6 6l12 12M18 9v9H9" />,
  telefono: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />,
} satisfies Record<string, ReactElement>;

export type NombreIcono = keyof typeof TRAZOS;

interface Props {
  nombre: NombreIcono;
  tamano?: number;
  /** Rellena el ícono (p. ej. el corazón de un favorito guardado). */
  relleno?: boolean;
  className?: string;
}

/** Ícono decorativo: el texto o el aria-label del control que lo contiene es el que se lee. */
export default function Icono({ nombre, tamano = 20, relleno = false, className }: Props) {
  return (
    <svg
      className={className ? `icono ${className}` : "icono"}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill={relleno ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
