import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { ErrorApi, post } from "../../api";
import { useSesion } from "../../auth";
import { useCarrito, useCarritoActualizado } from "../../carrito";
import Canasta from "../../componentes/Canasta";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Pasos from "../../componentes/Pasos";
import { igvIncluido, soles } from "../../formato";
import { MEDIOS_PAGO } from "../../mediosPago";
import type { MedioPago, Pedido } from "../../tipos";

interface SinStock {
  producto: number;
  nombre: string;
  disponible: number;
  solicitado: number;
}

/** HU08: resumen del pedido, medio de pago al recoger y confirmación. */
export default function Confirmar() {
  const navegar = useNavigate();
  const { usuario } = useSesion();
  const { items, tienda, vaciar } = useCarrito();
  const { lineas, tiendaElegida, total, problemas, cargando } = useCarritoActualizado();
  const [medioPago, setMedioPago] = useState<MedioPago | "">(usuario?.medio_pago_preferido ?? "");
  const [error, setError] = useState("");
  const [sinStock, setSinStock] = useState<SinStock[]>([]);
  const [enviando, setEnviando] = useState(false);
  const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0);

  if (items.length === 0 && !enviando) return <Navigate to="/carrito" replace />;
  if (cargando) return <p className="estado">Preparando tu resumen…</p>;
  if (!tiendaElegida || problemas.length > 0) {
    return (
      <section className="tarjeta vacio">
        <h1>Revisa tu carrito</h1>
        <p className="subtitulo">
          {tiendaElegida ? "Algunos productos no tienen stock suficiente." : "Falta elegir la tienda de recojo."}
        </p>
        <Link to={tiendaElegida ? "/carrito" : "/tiendas"} state={{ desde: "/confirmar" }} className="boton-primario">
          {tiendaElegida ? "Volver al carrito" : "Elegir tienda"}
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
    <section className="pagina-confirmar">
      <div className="cabecera-compra">
        <div>
          <Pasos actual={2} />
          <h1>Confirmar pedido</h1>
          <p className="subtitulo">Revisa tus datos y elige tu medio de pago.</p>
        </div>
        <div className="lema" aria-hidden="true">
          <p>
            Todo lo que necesitas,
            <br />
            más cerca de ti
          </p>
          <Canasta ancho={150} />
        </div>
      </div>

      <form className="confirmar" onSubmit={confirmar} noValidate>
        <div className="confirmar-principal">
          <div className="tarjeta bloque-tienda">
            <span className="icono-circulo">
              <Icono nombre="tienda" tamano={28} />
            </span>
            <div className="bloque-tienda-datos">
              <div className="bloque-tienda-titulo">
                <h2>Tienda de recojo</h2>
                <Link to="/tiendas" state={{ desde: "/confirmar" }} className="boton-contorno pequeno">
                  <Icono nombre="cambiar" tamano={18} /> Cambiar tienda
                </Link>
              </div>
              <p className="bloque-tienda-nombre">
                <strong>{tiendaElegida.nombre}</strong>
                <span className="insignia disponible">
                  <Icono nombre="check" tamano={14} /> Disponible
                </span>
              </p>
              <p className="con-icono">
                <Icono nombre="ubicacion" tamano={18} /> {tiendaElegida.direccion}, {tiendaElegida.distrito}
              </p>
              <p className="horario">
                <Icono nombre="reloj" tamano={18} /> Horario de recojo: {tiendaElegida.horario}
              </p>
            </div>
          </div>

          <div className="tarjeta">
            <fieldset className="medios-pago" aria-describedby={error && !sinStock.length ? "error-confirmar" : undefined}>
              <legend>
                <Icono nombre="tarjeta" tamano={28} /> Medio de pago
              </legend>
              <div className="opciones-pago">
                {MEDIOS_PAGO.map((m) => (
                  <label key={m.valor} className={`opcion-pago${medioPago === m.valor ? " elegida" : ""}`}>
                    <input type="radio" name="medio_pago" value={m.valor} checked={medioPago === m.valor} onChange={() => setMedioPago(m.valor)} />
                    <Icono nombre={m.icono} tamano={34} />
                    <strong>{m.titulo}</strong>
                    <small>{m.texto}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="banda-info">
              <Icono nombre="info" tamano={22} />
              Te avisaremos por correo cuando tu pedido esté listo. Tienes 48 horas para recogerlo.
            </p>
          </div>
        </div>

        <aside className="tarjeta resumen">
          <h2>
            <Icono nombre="documento" tamano={26} /> Resumen de tu pedido
          </h2>
          <ul className="resumen-productos">
            {lineas.map((l) => (
              <li key={l.producto}>
                <span className="producto-celda">
                  <FotoProducto producto={l} tamano={52} />
                  <span>
                    <strong>{l.nombre}</strong>
                    <small className="dato-secundario">{l.marca}</small>
                    <small className="dato-secundario">Cantidad: {l.cantidad}</small>
                  </span>
                </span>
                <strong className="precio-linea">{soles(l.subtotal)}</strong>
              </li>
            ))}
          </ul>
          <dl className="totales">
            <div>
              <dt>Subtotal ({unidades} productos)</dt>
              <dd>{soles(total)}</dd>
            </div>
            <div className="igv">
              <dt>IGV (18 %) incluido</dt>
              <dd>{soles(igvIncluido(total))}</dd>
            </div>
            <div className="total destacado">
              <dt>Total a pagar al recoger</dt>
              <dd>{soles(total)}</dd>
            </div>
          </dl>

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
          <button className="boton-primario ancho" disabled={enviando}>
            <Icono nombre="check" /> {enviando ? "Confirmando…" : "Confirmar pedido"}
          </button>
          <Link to="/carrito" className="enlace-flecha centrado">
            <Icono nombre="flechaIzq" tamano={18} /> Volver al carrito
          </Link>
        </aside>
      </form>
    </section>
  );
}
