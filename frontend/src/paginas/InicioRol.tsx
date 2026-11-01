import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, ErrorApi, type Rol } from "../api";

interface Inicio {
  saludo: string;
  tienda?: { codigo: string; nombre: string };
  menu: { clave: string; titulo: string; hu: string; disponible?: boolean; ruta?: string }[];
}

const DESCRIPCION: Record<Rol, string> = {
  admin: "Gestiona la cadena: tiendas, vendedores, catálogo y reportes.",
  vendedor: "Atiende los pedidos online, vende en caja y controla el stock de tu tienda.",
  cliente: "Revisa el catálogo, arma tu carrito y recoge tu pedido en la tienda que elijas.",
};

/** Inicio de cada rol: el menú lo entrega el servidor solo si el rol tiene permiso. */
export default function InicioRol({ rol }: { rol: Rol }) {
  const [inicio, setInicio] = useState<Inicio | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Inicio>(`/inicio/${rol}/`)
      .then(setInicio)
      .catch((e) => setError(e instanceof ErrorApi ? e.message : "No se pudo cargar el inicio."));
  }, [rol]);

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!inicio) return <p className="estado">Cargando…</p>;

  return (
    <section>
      <h1>{inicio.saludo}</h1>
      <p className="subtitulo">
        {DESCRIPCION[rol]}
        {inicio.tienda && ` Tienda: ${inicio.tienda.codigo} · ${inicio.tienda.nombre}.`}
      </p>
      <ul className="opciones">
        {inicio.menu.map((opcion) => (
          <li key={opcion.clave}>
            {opcion.disponible ? (
              <Link to={opcion.ruta ?? `/${rol}/${opcion.clave}`} className="tarjeta opcion disponible">
                <strong>{opcion.titulo}</strong>
                <span className="etiqueta lista">{opcion.hu}</span>
              </Link>
            ) : (
              <div className="tarjeta opcion" aria-disabled="true">
                <strong>{opcion.titulo}</strong>
                <span className="etiqueta">Próximamente · {opcion.hu}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
