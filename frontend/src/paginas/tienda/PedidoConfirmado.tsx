import { Link, useLocation, useParams } from "react-router";
import { useSesion } from "../../auth";
import FotoProducto from "../../componentes/FotoProducto";
import { formatoFechaHora, soles } from "../../formato";
import type { Pedido } from "../../tipos";
import { useCarga } from "../../useCarga";

/** HU08: pedido confirmado, con su código de recojo. */
export default function PedidoConfirmado() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const nuevo = (useLocation().state as { nuevo?: boolean } | null)?.nuevo;
  const { datos: pedido, error } = useCarga<Pedido>(`/pedidos/pedidos/${id}/`);

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!pedido) return <p className="estado">Cargando tu pedido…</p>;

  return (
    <section className="pedido-confirmado">
      <div className="tarjeta codigo-recojo">
        <h1>{nuevo ? "¡Pedido confirmado!" : `Pedido ${pedido.codigo_recojo}`}</h1>
        <p>Tu código de recojo es</p>
        <p className="codigo" aria-label={`Código ${pedido.codigo_recojo.split("").join(" ")}`}>
          {pedido.codigo_recojo}
        </p>
        <p className="dato-secundario">Muéstralo en caja cuando vayas a recoger.</p>
        <span className="insignia programada">{pedido.estado_display}</span>
        {nuevo && usuario && (
          <p className="dato-secundario">Te enviamos el resumen a {usuario.email}.</p>
        )}
      </div>

      <div className="tarjeta">
        <h2>Recojo</h2>
        <p>
          <strong>{pedido.tienda.nombre}</strong>
          <small className="dato-secundario">
            {pedido.tienda.direccion}, {pedido.tienda.distrito}
          </small>
          <small className="dato-secundario">{pedido.tienda.horario}</small>
        </p>
        <p>
          Recógelo antes del <strong>{formatoFechaHora(pedido.vence_en)}</strong>. Pagas con{" "}
          <strong>{pedido.medio_pago_display}</strong>.
        </p>

        <h2>Productos</h2>
        <ul className="resumen-productos">
          {pedido.detalles.map((d) => (
            <li key={d.producto}>
              <span className="producto-celda">
                <FotoProducto producto={d} tamano={40} />
                <span>
                  {d.cantidad} × {d.nombre}
                  <small className="dato-secundario">
                    {d.marca} · {soles(d.precio_unitario)} c/u
                  </small>
                </span>
              </span>
              <strong>{soles(d.subtotal)}</strong>
            </li>
          ))}
        </ul>
        <p className="total-confirmar">
          <span>Total a pagar al recoger</span>
          <strong>{soles(pedido.total)}</strong>
        </p>
      </div>
      <Link to="/catalogo" className="boton">
        Seguir comprando
      </Link>
    </section>
  );
}
