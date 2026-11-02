import { NavLink, Outlet } from "react-router";

const SECCIONES = [
  { ruta: "/admin", texto: "Inicio", exacta: true },
  { ruta: "/admin/tiendas", texto: "Tiendas" },
  { ruta: "/admin/vendedores", texto: "Vendedores" },
  { ruta: "/admin/productos", texto: "Catálogo" },
  { ruta: "/admin/ofertas", texto: "Ofertas" },
  { ruta: "/admin/categorias", texto: "Categorías" },
  { ruta: "/admin/reportes", texto: "Reportes" },
];

export default function LayoutAdmin() {
  return (
    <>
      <nav className="subnav" aria-label="Administración">
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
