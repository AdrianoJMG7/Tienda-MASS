import { Outlet } from "react-router";

/** Secciones del administrador; el menú está en la cabecera. Comparte el diseño de las pantallas del vendedor. */
export default function LayoutAdmin() {
  return (
    <div className="vendedor panel-admin">
      <Outlet />
    </div>
  );
}
