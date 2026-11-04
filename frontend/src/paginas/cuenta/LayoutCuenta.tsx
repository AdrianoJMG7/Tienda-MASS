import { NavLink, Outlet, useNavigate } from "react-router";
import { useSesion } from "../../auth";
import Icono, { type NombreIcono } from "../../componentes/Icono";

const SECCIONES: { ruta: string; texto: string; icono: NombreIcono }[] = [
  { ruta: "/cliente/pedidos", texto: "Mis pedidos", icono: "caja" },
  { ruta: "/cliente/favoritos", texto: "Mis favoritos", icono: "corazon" },
  { ruta: "/cliente/datos", texto: "Mis datos", icono: "usuario" },
  { ruta: "/tiendas", texto: "Mi tienda", icono: "ubicacion" },
  { ruta: "/cliente/medio-pago", texto: "Medio de pago", icono: "tarjeta" },
];

/** Mi cuenta del cliente: menú lateral y la sección elegida. */
export default function LayoutCuenta() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();

  async function cerrarSesion() {
    await salir();
    navegar("/ingresar");
  }

  return (
    <div className="cuenta">
      <aside className="tarjeta menu-lateral">
        <div className="menu-lateral-usuario">
          {usuario?.foto ? (
            <img src={usuario.foto} alt="" className="avatar" width={56} height={56} />
          ) : (
            <span className="avatar" aria-hidden="true">
              <Icono nombre="usuario" tamano={28} />
            </span>
          )}
          <span>
            <strong>Hola, {usuario?.nombre.split(" ")[0]}</strong>
            <small>{usuario?.email}</small>
          </span>
        </div>
        <nav aria-label="Mi cuenta">
          {SECCIONES.map((s) => (
            <NavLink key={s.ruta} to={s.ruta}>
              <Icono nombre={s.icono} /> {s.texto}
            </NavLink>
          ))}
          <button type="button" onClick={cerrarSesion}>
            <Icono nombre="salir" /> Cerrar sesión
          </button>
        </nav>
      </aside>
      <div className="cuenta-contenido">
        <Outlet />
      </div>
    </div>
  );
}
