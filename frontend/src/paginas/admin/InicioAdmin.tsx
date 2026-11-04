import { Link } from "react-router";
import { useSesion } from "../../auth";
import Icono, { type NombreIcono } from "../../componentes/Icono";
import { useCarga } from "../../useCarga";

interface Inicio {
  menu: { clave: string; titulo: string; hu: string; disponible?: boolean; ruta?: string }[];
}

const DETALLE: Record<string, { icono: NombreIcono; texto: string }> = {
  tiendas: { icono: "tienda", texto: "Administra los locales y puntos de recojo." },
  vendedores: { icono: "usuarios", texto: "Gestiona usuarios y su asignación por tienda." },
  productos: { icono: "caja", texto: "Administra productos, precios y stock." },
  ofertas: { icono: "etiqueta", texto: "Programa y controla las ofertas vigentes." },
  categorias: { icono: "cuadricula", texto: "Organiza los productos del catálogo." },
  reportes: { icono: "barras", texto: "Consulta ventas, pedidos y métricas." },
};

/** Inicio del administrador: el menú lo entrega el servidor según su permiso. */
export default function InicioAdmin() {
  const { usuario } = useSesion();
  const { datos: inicio, error } = useCarga<Inicio>("/inicio/admin/");

  return (
    <section className="inicio-admin">
      <header className="encabezado-pagina grande">
        <span className="encabezado-icono">
          <Icono nombre="tienda" tamano={84} />
        </span>
        <div className="encabezado-texto">
          <h1>Hola, {usuario?.nombre}</h1>
          <p className="subtitulo">Gestiona la cadena: tiendas, vendedores, catálogo y reportes.</p>
          <p className="pastilla-tienda">
            <Icono nombre="ubicacion" tamano={22} />
            <strong>Panel de administración · Tiendas Mass</strong>
          </p>
        </div>
      </header>

      {error && <p className="alerta" role="alert">{error}</p>}
      <ul className="accesos-admin">
        {inicio?.menu.map((opcion) => {
          const detalle = DETALLE[opcion.clave];
          return (
            <li key={opcion.clave} className="tarjeta acceso-admin">
              <span className="etiqueta-hu">{opcion.hu}</span>
              <div className="acceso-admin-cuerpo">
                <span className="acceso-icono">
                  <Icono nombre={detalle?.icono ?? "caja"} tamano={60} />
                </span>
                <div>
                  <h2>{opcion.titulo}</h2>
                  <p>{detalle?.texto}</p>
                </div>
              </div>
              <Link to={opcion.ruta ?? `/admin/${opcion.clave}`} className="boton-primario ancho">
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
