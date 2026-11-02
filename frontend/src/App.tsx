import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router";
import type { Rol } from "./api";
import { RUTA_INICIO, useSesion } from "./auth";
import { useCarrito } from "./carrito";
import LogoMass from "./componentes/LogoMass";
import Carrito from "./paginas/tienda/Carrito";
import Catalogo from "./paginas/tienda/Catalogo";
import Confirmar from "./paginas/tienda/Confirmar";
import PedidoConfirmado from "./paginas/tienda/PedidoConfirmado";
import MisPedidos from "./paginas/tienda/MisPedidos";
import Categorias from "./paginas/admin/Categorias";
import LayoutAdmin from "./paginas/admin/LayoutAdmin";
import Ofertas from "./paginas/admin/Ofertas";
import Productos from "./paginas/admin/Productos";
import Tiendas from "./paginas/admin/Tiendas";
import Vendedores from "./paginas/admin/Vendedores";
import InicioRol from "./paginas/InicioRol";
import LayoutVendedor from "./paginas/vendedor/LayoutVendedor";
import PedidosTienda from "./paginas/vendedor/PedidosTienda";
import Caja from "./paginas/vendedor/Caja";
import Inventario from "./paginas/vendedor/Inventario";
import Ingresar from "./paginas/Ingresar";
import Privacidad from "./paginas/Privacidad";
import Registro from "./paginas/Registro";

const NOMBRE_ROL: Record<Rol, string> = { admin: "Administrador", vendedor: "Vendedor", cliente: "Cliente" };

/** Deja pasar solo al rol indicado; el servidor vuelve a validar el permiso en cada petición. */
function SoloRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const ubicacion = useLocation();
  if (cargando) return <p className="estado">Cargando…</p>;
  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname }} />;
  if (usuario.rol !== rol) return <Navigate to={RUTA_INICIO[usuario.rol]} replace />;
  return children;
}

/** Visitantes y clientes empiezan en el catálogo; el personal, en su panel. */
function Inicio() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="estado">Cargando…</p>;
  if (usuario && usuario.rol !== "cliente") return <Navigate to={RUTA_INICIO[usuario.rol]} replace />;
  return <Catalogo />;
}

function Cabecera() {
  const { usuario, salir } = useSesion();
  const { unidades } = useCarrito();
  const navegar = useNavigate();
  const compra = !usuario || usuario.rol === "cliente";

  async function cerrarSesion() {
    await salir();
    navegar("/ingresar");
  }

  return (
    <header className="cabecera">
      <Link to="/" className="marca" aria-label="Mass, ir al inicio">
        <LogoMass tamano={30} />
      </Link>
      {compra && (
        <nav className="menu-tienda" aria-label="Tienda">
          <NavLink to="/catalogo">Catálogo</NavLink>
          {usuario && <NavLink to="/cliente/pedidos">Mis pedidos</NavLink>}
          {usuario && <NavLink to="/cliente">Mi cuenta</NavLink>}
          <NavLink to="/carrito" className="enlace-carrito">
            Carrito
            <span className="contador" aria-label={`${unidades} productos`}>
              {unidades}
            </span>
          </NavLink>
        </nav>
      )}
      {usuario ? (
        <nav className="menu-usuario" aria-label="Sesión">
          <span className="usuario">
            {usuario.nombre}
            <small>
              {NOMBRE_ROL[usuario.rol]}
              {usuario.tienda_nombre ? ` · ${usuario.tienda_nombre}` : ""}
            </small>
          </span>
          <button type="button" className="boton secundario" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </nav>
      ) : (
        <nav className="menu-usuario" aria-label="Cuenta">
          <NavLink to="/ingresar">Ingresar</NavLink>
          <NavLink to="/registro" className="boton">
            Crear cuenta
          </NavLink>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route
            path="/confirmar"
            element={
              <SoloRol rol="cliente">
                <Confirmar />
              </SoloRol>
            }
          />
          <Route
            path="/pedido/:id"
            element={
              <SoloRol rol="cliente">
                <PedidoConfirmado />
              </SoloRol>
            }
          />
          <Route
            path="/admin"
            element={
              <SoloRol rol="admin">
                <LayoutAdmin />
              </SoloRol>
            }
          >
            <Route index element={<InicioRol rol="admin" />} />
            <Route path="tiendas" element={<Tiendas />} />
            <Route path="vendedores" element={<Vendedores />} />
            <Route path="productos" element={<Productos />} />
            <Route path="ofertas" element={<Ofertas />} />
            <Route path="categorias" element={<Categorias />} />
          </Route>
          <Route
            path="/vendedor"
            element={
              <SoloRol rol="vendedor">
                <LayoutVendedor />
              </SoloRol>
            }
          >
            <Route index element={<InicioRol rol="vendedor" />} />
            <Route path="pedidos" element={<PedidosTienda />} />
            <Route path="caja" element={<Caja />} />
            <Route path="inventario" element={<Inventario />} />
          </Route>
          <Route
            path="/cliente"
            element={
              <SoloRol rol="cliente">
                <InicioRol rol="cliente" />
              </SoloRol>
            }
          />
          <Route
            path="/cliente/pedidos"
            element={
              <SoloRol rol="cliente">
                <MisPedidos />
              </SoloRol>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="pie">
        Prototipo académico con datos simulados, presentado como propuesta a Tiendas Mass (InRetail). No es el sitio
        oficial de Mass.
      </footer>
    </>
  );
}
