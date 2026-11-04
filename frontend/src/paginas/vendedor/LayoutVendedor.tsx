import { Outlet } from "react-router";
import { ProveedorVenta } from "../../ventaCaja";

/** Secciones del vendedor; el menú está en la cabecera. La venta en curso se comparte entre Caja y Escáner. */
export default function LayoutVendedor() {
  return (
    <ProveedorVenta>
      <div className="vendedor">
        <Outlet />
      </div>
    </ProveedorVenta>
  );
}
