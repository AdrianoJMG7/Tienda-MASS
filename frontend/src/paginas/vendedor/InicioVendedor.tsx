import { Link } from "react-router";
import { useSesion } from "../../auth";
import Icono, { type NombreIcono } from "../../componentes/Icono";
import type { Tienda } from "../../tipos";
import { useCarga } from "../../useCarga";

interface Inicio {
  saludo: string;
  menu: { clave: string; titulo: string; disponible?: boolean; ruta?: string }[];
}

const DETALLE: Record<string, { icono: NombreIcono; texto: string }> = {
  pedidos: { icono: "carrito", texto: "Gestiona los pedidos realizados por clientes en la tienda virtual." },
  caja: { icono: "registradora", texto: "Registra ventas presenciales en tu tienda." },
  inventario: { icono: "cajas", texto: "Consulta y actualiza el stock de tu tienda." },
};

/** Inicio del vendedor: el menú lo entrega el servidor según su permiso. */
export default function InicioVendedor() {
  const { usuario } = useSesion();
  const { datos: inicio, error } = useCarga<Inicio>("/inicio/vendedor/");
  const { datos: perfil } = useCarga<{ tienda_info: Tienda | null }>("/auth/yo/");
  const tienda = perfil?.tienda_info;

  return (
    <section className="inicio-vendedor">
      <header className="encabezado-pagina grande">
        <span className="encabezado-icono">
          <Icono nombre="tienda" tamano={84} />
        </span>
        <div className="encabezado-texto">
          <h1>Hola, {usuario?.nombre}</h1>
          <p className="subtitulo">Atiende los pedidos online, vende en caja y controla el stock de tu tienda.</p>
          {tienda && (
            <p className="pastilla-tienda">
              <Icono nombre="ubicacion" tamano={22} />
              <strong>
                Tienda: {tienda.nombre}
              </strong>
              <span className="pastilla-direccion">
                {tienda.direccion}, {tienda.distrito}
              </span>
            </p>
          )}
        </div>
      </header>

      {error && <p className="alerta" role="alert">{error}</p>}
      <ul className="accesos-vendedor">
        {inicio?.menu.map((opcion) => {
          const detalle = DETALLE[opcion.clave];
          return (
            <li key={opcion.clave} className="tarjeta acceso-vendedor">
              <span className="acceso-icono">
                <Icono nombre={detalle?.icono ?? "caja"} tamano={72} />
              </span>
              <h2>{opcion.titulo}</h2>
              <p>{detalle?.texto}</p>
              <Link to={opcion.ruta ?? `/vendedor/${opcion.clave}`} className="boton-primario ancho grande">
                Ingresar <Icono nombre="flechaDer" />
                <span className="solo-lector"> a {opcion.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
