import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { ErrorApi, post } from "../../api";
import { useCarrito, useCarritoActualizado } from "../../carrito";
import { soles } from "../../formato";
import type { MedioPago, Pedido } from "../../tipos";

const MEDIOS: { valor: MedioPago; texto: string }[] = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "tarjeta", texto: "Tarjeta de débito o crédito" },
  { valor: "yape_plin", texto: "Yape o Plin" },
];

interface SinStock {
  producto: number;
  nombre: string;
  disponible: number;
  solicitado: number;
}

/** HU08: resumen del pedido, medio de pago al recoger y confirmación. */
export default function Confirmar() {
  const navegar = useNavigate();
  const { items, tienda, vaciar } = useCarrito();
  const { lineas, tiendaElegida, total, problemas, cargando } = useCarritoActualizado();
  const [medioPago, setMedioPago] = useState<MedioPago | "">("");
  const [error, setError] = useState("");
  const [sinStock, setSinStock] = useState<SinStock[]>([]);
  const [enviando, setEnviando] = useState(false);

  if (items.length === 0 && !enviando) return <Navigate to="/carrito" replace />;
  if (cargando) return <p className="estado">Preparando tu resumen…</p>;
  if (!tiendaElegida || problemas.length > 0) {
    return (
      <section className="tarjeta vacio">
        <h1>Revisa tu carrito</h1>
        <p className="subtitulo">
          {tiendaElegida ? "Algunos productos no tienen stock suficiente." : "Falta elegir la tienda de recojo."}
        </p>
        <Link to="/carrito" className="boton">
          Volver al carrito
        </Link>
      </section>
    );
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!medioPago) {
      setError("Elige cómo pagarás al recoger.");
      return;
    }
    setError("");
    setSinStock([]);
    setEnviando(true);
    try {
      const pedido = await post<Pedido>("/pedidos/pedidos/", {
        tienda,
        medio_pago: medioPago,
        items: items.map((i) => ({ producto: i.producto, cantidad: i.cantidad })),
      });
      vaciar();
      navegar(`/pedido/${pedido.id}`, { replace: true, state: { nuevo: true } });
    } catch (e) {
      setEnviando(false);
      if (e instanceof ErrorApi) {
        setError(e.message);
        const cuerpo = e.cuerpo as { productos?: SinStock[] } | null;
        if (e.estado === 409 && cuerpo?.productos) setSinStock(cuerpo.productos);
      } else {
        setError("No se pudo confirmar el pedido.");
      }
    }
  }

  return (
    <section>
      <h1>Confirma tu pedido</h1>
      <form className="confirmar" onSubmit={confirmar} noValidate>
        <div className="tarjeta">
          <h2>Productos</h2>
          <ul className="resumen-productos">
            {lineas.map((l) => (
              <li key={l.producto}>
                <span>
                  {l.cantidad} × {l.nombre}
                  <small className="dato-secundario">
                    {l.marca} · {soles(l.precio)} c/u
                  </small>
                </span>
                <strong>{soles(l.subtotal)}</strong>
              </li>
            ))}
          </ul>
          <p className="total-confirmar">
            <span>Total a pagar al recoger</span>
            <strong>{soles(total)}</strong>
          </p>
        </div>

        <div className="tarjeta">
          <h2>Recojo</h2>
          <p>
            <strong>{tiendaElegida.nombre}</strong>
            <small className="dato-secundario">
              {tiendaElegida.direccion}, {tiendaElegida.distrito}
            </small>
            <small className="dato-secundario">{tiendaElegida.horario}</small>
          </p>
          <p className="dato-secundario">
            Te avisaremos por correo cuando tu pedido esté listo. Tienes 48 horas para recogerlo.{" "}
            <Link to="/carrito">Cambiar tienda o productos</Link>
          </p>

          <fieldset className="medios-pago" aria-describedby={error && !sinStock.length ? "error-confirmar" : undefined}>
            <legend>¿Cómo pagarás al recoger?</legend>
            {MEDIOS.map((m) => (
              <label key={m.valor} className={`opcion-tienda${medioPago === m.valor ? " elegida" : ""}`}>
                <input
                  type="radio"
                  name="medio_pago"
                  value={m.valor}
                  checked={medioPago === m.valor}
                  onChange={() => setMedioPago(m.valor)}
                />
                <span>{m.texto}</span>
              </label>
            ))}
          </fieldset>

          {error && (
            <div id="error-confirmar" className="alerta" role="alert">
              <p>{error}</p>
              {sinStock.length > 0 && (
                <>
                  <ul>
                    {sinStock.map((s) => (
                      <li key={s.producto}>
                        {s.nombre}: pediste {s.solicitado}, quedan {s.disponible}.
                      </li>
                    ))}
                  </ul>
                  <Link to="/carrito">Ajustar el carrito</Link>
                </>
              )}
            </div>
          )}
          <button className="boton ancho" disabled={enviando}>
            {enviando ? "Confirmando…" : `Confirmar pedido · ${soles(total)}`}
          </button>
        </div>
      </form>
    </section>
  );
}
