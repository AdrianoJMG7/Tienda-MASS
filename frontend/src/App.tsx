import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router";
import type { Rol } from "./api";
import { RUTA_INICIO, useSesion } from "./auth";
import { useCarrito } from "./carrito";
import Icono from "./componentes/Icono";
import LogoMass from "./componentes/LogoMass";
import MiniCarrito from "./componentes/MiniCarrito";
import Carrito from "./paginas/tienda/Carrito";
import Catalogo from "./paginas/tienda/Catalogo";
import Confirmar from "./paginas/tienda/Confirmar";
import DetalleProducto from "./paginas/tienda/DetalleProducto";
import ElegirTienda from "./paginas/tienda/ElegirTienda";
import PedidoConfirmado from "./paginas/tienda/PedidoConfirmado";
import MisPedidos from "./paginas/tienda/MisPedidos";
import LayoutCuenta from "./paginas/cuenta/LayoutCuenta";
import MedioPagoPreferido from "./paginas/cuenta/MedioPagoPreferido";
import MisDatos from "./paginas/cuenta/MisDatos";
import MisFavoritos from "./paginas/cuenta/MisFavoritos";
import Categorias from "./paginas/admin/Categorias";
import LayoutAdmin from "./paginas/admin/LayoutAdmin";
import Ofertas from "./paginas/admin/Ofertas";
import Productos from "./paginas/admin/Productos";
import Tiendas from "./paginas/admin/Tiendas";
import Vendedores from "./paginas/admin/Vendedores";
import InicioAdmin from "./paginas/admin/InicioAdmin";
import LayoutVendedor from "./paginas/vendedor/LayoutVendedor";
import PedidosTienda from "./paginas/vendedor/PedidosTienda";
import Caja from "./paginas/vendedor/Caja";
import Devoluciones from "./paginas/vendedor/Devoluciones";
import Escaner from "./paginas/vendedor/Escaner";
import HistorialVentas from "./paginas/vendedor/HistorialVentas";
import InicioVendedor from "./paginas/vendedor/InicioVendedor";
import Inventario from "./paginas/vendedor/Inventario";
import MiPerfil from "./paginas/vendedor/MiPerfil";
import Ingresar from "./paginas/Ingresar";
import Privacidad from "./paginas/Privacidad";
import Registro from "./paginas/Registro";
import type { Tienda } from "./tipos";
import { useCarga } from "./useCarga";

// Los gráficos (Recharts) pesan; se descargan solo cuando el administrador abre los reportes.
const Reportes = lazy(() => import("./paginas/admin/Reportes"));
const ReportesTienda = lazy(() => import("./paginas/vendedor/ReportesTienda"));
const CierreCaja = lazy(() => import("./paginas/vendedor/CierreCaja"));

const SECCIONES_VENDEDOR = [
  { ruta: "/vendedor/pedidos", texto: "Pedidos Online" },
  { ruta: "/vendedor/caja", texto: "Caja" },
  { ruta: "/vendedor/inventario", texto: "Inventario" },
  { ruta: "/vendedor/escaner", texto: "Escáner QR" },
  { ruta: "/vendedor/historial", texto: "Historial de ventas" },
  { ruta: "/vendedor/devoluciones", texto: "Devoluciones" },
  { ruta: "/vendedor/reportes", texto: "Reportes" },
  { ruta: "/vendedor/perfil", texto: "Mi perfil" },
];

// En estas páginas ya se ven los productos elegidos: el panel del carrito estorbaría.
const RUTAS_SIN_PANEL = ["/carrito", "/confirmar"];

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

/** Buscador de la cabecera: lleva a la lista de productos (catálogo o inventario) con lo escrito. */
function Buscador({ destino = "/catalogo" }: { destino?: string }) {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const enCatalogo = pathname === destino;
  const [texto, setTexto] = useState("");

  // En el catálogo el buscador muestra lo que se está buscando.
  const qActual = enCatalogo ? (params.get("q") ?? "") : "";
  useEffect(() => setTexto(qActual), [qActual]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    navegar(q ? `${destino}?q=${encodeURIComponent(q)}` : destino);
  }

  return (
    <form className="buscador" role="search" onSubmit={buscar}>
      <Icono nombre="buscar" />
      <label htmlFor="buscar-productos" className="solo-lector">
        Buscar productos
      </label>
      <input id="buscar-productos" type="search" placeholder="Buscar productos…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {texto && (
        <button
          type="button"
          className="buscador-limpiar"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setTexto("");
            if (enCatalogo) navegar(destino);
          }}
        >
          <Icono nombre="cerrar" tamano={18} />
        </button>
      )}
    </form>
  );
}

function MenuCuenta() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const menu = useRef<HTMLDetailsElement>(null);

  // Se cierra al cambiar de página o al hacer clic fuera.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("click", alClic);
    return () => document.removeEventListener("click", alClic);
  }, []);

  if (!usuario) {
    return (
      <Link to="/ingresar" className="cabecera-cuenta">
        <Icono nombre="usuario" tamano={22} />
        <span>Ingresar</span>
      </Link>
    );
  }

  async function cerrarSesion() {
    await salir();
    navegar("/ingresar");
  }

  const esCliente = usuario.rol === "cliente";
  return (
    <details className="menu-cuenta" ref={menu}>
      <summary className="cabecera-cuenta">
        <Icono nombre="usuario" tamano={22} />
        <span>
          {esCliente ? "Mi cuenta" : usuario.rol === "admin" ? NOMBRE_ROL.admin : usuario.nombre}
        </span>
        <Icono nombre="abajo" tamano={16} />
      </summary>
      <div className="menu-cuenta-lista">
        <p className="menu-cuenta-nombre">
          {usuario.nombre}
          <small>{usuario.email}</small>
        </p>
        {esCliente ? (
          <>
            <Link to="/cliente/pedidos">
              <Icono nombre="caja" /> Mis pedidos
            </Link>
            <Link to="/cliente/favoritos">
              <Icono nombre="corazon" /> Mis favoritos
            </Link>
            <Link to="/cliente/datos">
              <Icono nombre="usuario" /> Mis datos
            </Link>
          </>
        ) : usuario.rol === "vendedor" ? (
          <>
            <Link to="/vendedor/perfil">
              <Icono nombre="usuario" /> Mi perfil
            </Link>
            <Link to="/vendedor/caja/cierre">
              <Icono nombre="registradora" /> Cierre de caja
            </Link>
          </>
        ) : (
          <Link to={RUTA_INICIO[usuario.rol]}>
            <Icono nombre="casa" /> Mi panel
          </Link>
        )}
        <button type="button" onClick={cerrarSesion}>
          <Icono nombre="salir" /> Cerrar sesión
        </button>
      </div>
    </details>
  );
}

const SECCIONES_ADMIN = [
  { ruta: "/admin/tiendas", texto: "Tiendas" },
  { ruta: "/admin/vendedores", texto: "Vendedores" },
  { ruta: "/admin/productos", texto: "Catálogo" },
  { ruta: "/admin/ofertas", texto: "Ofertas" },
  { ruta: "/admin/categorias", texto: "Categorías" },
  { ruta: "/admin/reportes", texto: "Reportes" },
];

/** Cabecera del personal: busca productos y muestra su tienda o el panel, en lugar de un carrito. */
function CabeceraPersonal() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  const esAdmin = usuario?.rol === "admin";
  const inicio = esAdmin ? "/admin" : "/vendedor";
  const secciones = esAdmin ? SECCIONES_ADMIN : SECCIONES_VENDEDOR;

  async function cerrarSesion() {
    await salir();
    navegar("/ingresar");
  }

  return (
    <header className="cabecera">
      <div className="cabecera-barra">
        <Link to="/" className="marca" aria-label="Mass, ir al inicio">
          <LogoMass tamano={30} />
        </Link>
        <Buscador destino={esAdmin ? "/admin/productos" : "/vendedor/inventario"} />
        <div className="cabecera-acciones">
          <Link to={esAdmin ? "/admin/tiendas" : "/vendedor/perfil"} className="cabecera-tienda">
            <Icono nombre="ubicacion" tamano={22} />
            <span>
              <small>{esAdmin ? "Panel de administración" : "Mi tienda"}</small>
              <strong>{esAdmin ? "Todas las tiendas" : usuario?.tienda_nombre}</strong>
            </span>
          </Link>
          <span className="cabecera-separador" aria-hidden="true" />
          <MenuCuenta />
          <span className="cabecera-separador" aria-hidden="true" />
          <button type="button" className="cabecera-salir" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={cerrarSesion}>
            <Icono nombre="salir" tamano={26} />
          </button>
        </div>
      </div>
      <nav className={`cabecera-nav${esAdmin ? " con-separadores" : ""}`} aria-label={esAdmin ? "Administración" : "Mi tienda"}>
        <NavLink to={inicio} end aria-label="Inicio">
          <Icono nombre="casa" />
        </NavLink>
        <NavLink to={inicio} end>
          Inicio
        </NavLink>
        {secciones.map((s) => (
          <NavLink key={s.ruta} to={s.ruta}>
            {s.texto}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function Cabecera() {
  const { usuario } = useSesion();
  const { unidades, tienda, panelAbierto, alternarPanel } = useCarrito();
  const { pathname } = useLocation();
  const compra = !usuario || usuario.rol === "cliente";
  const { datos: tiendas } = useCarga<Tienda[]>(compra ? "/tiendas/tiendas/" : null);
  const tiendaElegida = tiendas?.find((t) => t.id === tienda);

  return (
    <header className="cabecera">
      <div className="cabecera-barra">
        <Link to="/" className="marca" aria-label="Mass, ir al inicio">
          <LogoMass tamano={30} />
        </Link>
        {compra && <Buscador />}
        <div className="cabecera-acciones">
          {compra && (
            <Link to="/tiendas" className="cabecera-tienda">
              <Icono nombre="ubicacion" tamano={22} />
              <span>
                <small>Tienda de recojo</small>
                <strong>{tiendaElegida?.nombre ?? "Seleccionar tienda"}</strong>
              </span>
              <Icono nombre="abajo" tamano={16} />
            </Link>
          )}
          <MenuCuenta />
          {compra &&
            (RUTAS_SIN_PANEL.includes(pathname) ? (
              <Link to="/carrito" className="cabecera-carrito" aria-label={`Carrito, ${unidades} productos`}>
                <Icono nombre="carrito" tamano={26} />
                <span className="contador" aria-hidden="true">
                  {unidades}
                </span>
              </Link>
            ) : (
              <button
                type="button"
                className="cabecera-carrito"
                aria-label={`Carrito, ${unidades} productos`}
                aria-expanded={panelAbierto}
                aria-controls="mini-carrito"
                onClick={alternarPanel}
              >
                <Icono nombre="carrito" tamano={26} />
                <span className="contador" aria-hidden="true">
                  {unidades}
                </span>
              </button>
            ))}
        </div>
      </div>
      {compra && (
        <nav className="cabecera-nav" aria-label="Tienda">
          <NavLink to="/" end aria-label="Inicio">
            <Icono nombre="casa" />
          </NavLink>
          <NavLink to="/catalogo">Catálogo</NavLink>
          <NavLink to="/tiendas">Tiendas</NavLink>
          {usuario && <NavLink to="/cliente">Mi cuenta</NavLink>}
        </nav>
      )}
    </header>
  );
}

/** Si el cliente tiene una tienda favorita y aún no eligió una para este carrito, se usa esa. */
function TiendaPreferida() {
  const { usuario } = useSesion();
  const { tienda, elegirTienda } = useCarrito();
  const preferida = usuario?.rol === "cliente" ? usuario.tienda_preferida : null;
  useEffect(() => {
    if (preferida && tienda == null) elegirTienda(preferida);
  }, [preferida, tienda, elegirTienda]);
  return null;
}

export default function App() {
  const { usuario } = useSesion();
  const { panelAbierto } = useCarrito();
  const { pathname } = useLocation();
  const esPersonal = usuario !== null && usuario.rol !== "cliente";
  const pie = usuario?.rol === "admin" ? "Tiendas Mass · Sistema de administración" : usuario?.rol === "vendedor" ? "Tiendas Mass · Sistema para vendedores" : "Tienda Online Mass · Prototipo académico";
  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <TiendaPreferida />
      {esPersonal ? <CabeceraPersonal /> : <Cabecera />}
      {!esPersonal && panelAbierto && !RUTAS_SIN_PANEL.includes(pathname) && <MiniCarrito />}
      <main id="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/producto/:id" element={<DetalleProducto />} />
          <Route path="/tiendas" element={<ElegirTienda />} />
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
            <Route index element={<InicioAdmin />} />
            <Route path="tiendas" element={<Tiendas />} />
            <Route path="vendedores" element={<Vendedores />} />
            <Route path="productos" element={<Productos />} />
            <Route path="ofertas" element={<Ofertas />} />
            <Route path="categorias" element={<Categorias />} />
            <Route
              path="reportes"
              element={
                <Suspense fallback={<p className="estado">Cargando reportes…</p>}>
                  <Reportes />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/vendedor"
            element={
              <SoloRol rol="vendedor">
                <LayoutVendedor />
              </SoloRol>
            }
          >
            <Route index element={<InicioVendedor />} />
            <Route path="pedidos" element={<PedidosTienda />} />
            <Route path="caja" element={<Caja />} />
            <Route
              path="caja/cierre"
              element={
                <Suspense fallback={<p className="estado">Cargando el turno…</p>}>
                  <CierreCaja />
                </Suspense>
              }
            />
            <Route path="inventario" element={<Inventario />} />
            <Route path="escaner" element={<Escaner />} />
            <Route path="historial" element={<HistorialVentas />} />
            <Route path="devoluciones" element={<Devoluciones />} />
            <Route
              path="reportes"
              element={
                <Suspense fallback={<p className="estado">Cargando reportes…</p>}>
                  <ReportesTienda />
                </Suspense>
              }
            />
            <Route path="perfil" element={<MiPerfil />} />
          </Route>
          <Route
            path="/cliente"
            element={
              <SoloRol rol="cliente">
                <LayoutCuenta />
              </SoloRol>
            }
          >
            <Route index element={<Navigate to="pedidos" replace />} />
            <Route path="pedidos" element={<MisPedidos />} />
            <Route path="favoritos" element={<MisFavoritos />} />
            <Route path="datos" element={<MisDatos />} />
            <Route path="medio-pago" element={<MedioPagoPreferido />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="pie">
        <p className="pie-linea">
          <span>{pie}</span>
        </p>
        <p>
          Datos simulados, presentado como propuesta a Tiendas Mass (InRetail). No es el sitio oficial de Mass.
        </p>
      </footer>
    </>
  );
}
