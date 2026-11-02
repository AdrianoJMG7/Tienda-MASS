import { NavLink, Outlet } from "react-router";

const SECCIONES = [
  { ruta: "/vendedor", texto: "Inicio", exacta: true },
  { ruta: "/vendedor/pedidos", texto: "Pedidos online" },
  { ruta: "/vendedor/caja", texto: "Caja" },
];

export default function LayoutVendedor() {
  return (
    <>
      <nav className="subnav" aria-label="Mi tienda">
        {SECCIONES.map((s) => (
          <NavLink key={s.ruta} to={s.ruta} end={s.exacta}>
            {s.texto}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
