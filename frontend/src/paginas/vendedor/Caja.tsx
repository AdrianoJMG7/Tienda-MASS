import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api, conFiltros, ErrorApi, post } from "../../api";
import { useSesion } from "../../auth";
import Cantidad from "../../componentes/Cantidad";
import Comprobante, { imprimirComprobante, type FormatoComprobante } from "../../componentes/Comprobante";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import { igvIncluido, soles } from "../../formato";
import { MEDIOS_PAGO } from "../../mediosPago";
import type { Categoria, FilaInventario, MedioPago, Paginado, Producto, Venta } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";
import { useVentaCaja } from "../../ventaCaja";

const POR_PAGINA = 8;

function ProcesarPago({ alTerminar }: { alTerminar: (venta: Venta) => void }) {
  const { items, total } = useVentaCaja();
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [recibido, setRecibido] = useState("");
  const { errores, general, enviando, enviar } = useEnvio();
  const monto = Number(recibido);
  const falta = medio === "efectivo" && monto < total;

  async function cobrar() {
    await enviar(async () => {
      const venta = await post<Venta>("/ventas/ventas/crear/", {
        medio_pago: medio,
        monto_recibido: medio === "efectivo" ? recibido : null,
        items: items.map((i) => ({ producto: i.producto, cantidad: i.cantidad })),
      });
      alTerminar(venta);
    });
  }

  return (
    <div className="procesar-pago">
      <p className="total-cobrar">
        <span>Total a cobrar</span>
        <strong>{soles(total)}</strong>
      </p>
      {general && <p className="alerta" role="alert">{general}</p>}
      <div className="opciones-pago" role="radiogroup" aria-label="Medio de pago">
        {MEDIOS_PAGO.map((m) => (
          <label key={m.valor} className={`opcion-pago${medio === m.valor ? " elegida" : ""}`}>
            <input type="radio" name="medio_caja" checked={medio === m.valor} onChange={() => setMedio(m.valor)} />
            <Icono nombre={m.icono} tamano={30} />
            <strong>{m.titulo}</strong>
          </label>
        ))}
      </div>
      {medio === "efectivo" && (
        <div className="campo">
          <label htmlFor="monto-recibido">Monto recibido (S/)</label>
          <input
            id="monto-recibido"
            type="number"
            min="0"
            step="0.10"
            inputMode="decimal"
            autoFocus
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            aria-invalid={errores.monto_recibido ? true : undefined}
          />
          {errores.monto_recibido && <p className="error-campo">{errores.monto_recibido}</p>}
          {recibido && !falta && <p className="vuelto">Vuelto: <strong>{soles(monto - total)}</strong></p>}
        </div>
      )}
      <button type="button" className="boton-primario ancho grande" disabled={enviando || falta} onClick={cobrar}>
        <Icono nombre="check" /> {enviando ? "Registrando…" : "Confirmar pago"}
      </button>
    </div>
  );
}

/** HU12: registrar ventas en caja. HU13: también se agregan productos con un lector de códigos USB. */
export default function Caja() {
  const { usuario } = useSesion();
  const { items, total, unidades, agregar, cambiarCantidad, limpiar } = useVentaCaja();
  const [busqueda, setBusqueda] = useState("");
  const q = useRetraso(busqueda.trim());
  const [categoria, setCategoria] = useState<number | "">("");
  const [pagina, setPagina] = useState(1);
  const [cobrando, setCobrando] = useState(false);
  const [venta, setVenta] = useState<Venta | null>(null);
  // La última venta se puede volver a imprimir mientras se atiende al siguiente cliente.
  const [ultima, setUltima] = useState<Venta | null>(null);
  const [formato, setFormato] = useState<FormatoComprobante>("ticket");
  const [aviso, setAviso] = useState("");

  const { datos: categorias } = useCarga<Categoria[]>("/categorias/categorias/");
  const { datos: productos, cargando, error } = useCarga<Paginado<Producto>>(
    conFiltros("/productos/productos/", { q, categoria, tienda: usuario?.tienda ?? undefined, page: pagina, page_size: POR_PAGINA }),
  );

  function agregarProducto(p: Producto) {
    agregar({ producto: p.id, nombre: p.nombre, foto: p.foto, precio: p.precio_final, disponible: p.disponible ?? 0 });
  }

  const agregarPorCodigo = useCallback(
    async (codigo: string) => {
      try {
        const fila = await api<FilaInventario>(conFiltros("/inventario/inventario/consulta/", { codigo }));
        if (fila.cantidad === 0) {
          setAviso(`${fila.nombre} está agotado en tu tienda.`);
          return;
        }
        agregar({ producto: fila.producto, nombre: fila.nombre, foto: fila.foto, precio: fila.precio_final, disponible: fila.cantidad });
        setAviso(`Agregado: ${fila.nombre}.`);
      } catch (e) {
        setAviso(e instanceof ErrorApi && e.estado === 404 ? `No hay ningún producto con el código ${codigo}.` : "No se pudo leer el código.");
      }
    },
    [agregar],
  );

  // Un lector USB escribe como un teclado muy rápido y termina con Enter.
  const teclas = useRef({ texto: "", ultima: 0 });
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      const objetivo = evento.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName) || objetivo.closest("dialog")) return;
      const ahora = Date.now();
      if (ahora - teclas.current.ultima > 100) teclas.current.texto = "";
      teclas.current.ultima = ahora;
      if (evento.key === "Enter" && teclas.current.texto.length >= 8) {
        evento.preventDefault();
        void agregarPorCodigo(teclas.current.texto);
        teclas.current.texto = "";
      } else if (evento.key.length === 1) {
        teclas.current.texto += evento.key;
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [agregarPorCodigo]);

  function imprimir(nuevo: FormatoComprobante) {
    setFormato(nuevo);
    imprimirComprobante();
  }

  function terminarVenta(registrada: Venta) {
    setVenta(registrada);
    setUltima(registrada);
    setCobrando(false);
    limpiar();
  }

  return (
    <section className="pagina-caja">
      <div className="caja-catalogo">
        <EncabezadoPagina icono="registradora" titulo="Caja" subtitulo="Registra ventas presenciales en tu tienda.">
          <Link to="/vendedor/escaner" className="boton-contorno">
            <Icono nombre="qr" /> Escanear
          </Link>
          <Link to="/vendedor/caja/cierre" className="boton-contorno">
            <Icono nombre="calculadora" /> Cierre de caja
          </Link>
        </EncabezadoPagina>

        <form
          className="buscador buscador-pagina"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            // Un código completo escrito a mano o con el lector se agrega directo.
            if (/^\d{8,14}$/.test(busqueda.trim())) {
              void agregarPorCodigo(busqueda.trim());
              setBusqueda("");
            }
          }}
        >
          <Icono nombre="buscar" />
          <label htmlFor="buscar-caja" className="solo-lector">
            Buscar productos por nombre o código
          </label>
          <input
            id="buscar-caja"
            type="search"
            placeholder="Buscar productos por nombre o código…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </form>

        <div className="chips-categorias" role="group" aria-label="Categoría">
          <button
            type="button"
            className={`chip-amarillo${categoria === "" ? " activo" : ""}`}
            aria-pressed={categoria === ""}
            onClick={() => {
              setCategoria("");
              setPagina(1);
            }}
          >
            Todos
          </button>
          {categorias?.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip-amarillo${categoria === c.id ? " activo" : ""}`}
              aria-pressed={categoria === c.id}
              onClick={() => {
                setCategoria(c.id);
                setPagina(1);
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {aviso && <p className="aviso" role="status">{aviso}</p>}
        {error && <p className="alerta" role="alert">{error}</p>}
        {cargando && !productos ? (
          <p className="estado">Cargando productos…</p>
        ) : productos?.results.length === 0 ? (
          <p className="estado">No encontramos productos con esa búsqueda.</p>
        ) : (
          <div className="grilla-caja" aria-busy={cargando}>
            {productos?.results.map((p) => {
              const hay = p.disponible ?? 0;
              return (
                <article key={p.id} className="tarjeta producto-caja">
                  <FotoProducto producto={p} tamano={84} />
                  <h3>{p.nombre}</h3>
                  <small className="dato-secundario">{p.marca}</small>
                  <strong>{soles(p.precio_final)}</strong>
                  <button type="button" className="boton-contorno pequeno" disabled={hay === 0} onClick={() => agregarProducto(p)}>
                    <Icono nombre="carrito" tamano={18} /> {hay === 0 ? "Agotado" : "Agregar"}
                    <span className="solo-lector"> {p.nombre}</span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
        <Paginacion pagina={pagina} total={productos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={setPagina} />

        <div className="acciones-impresion caja-impresion">
          <button type="button" className="boton-contorno grande" disabled={!ultima} onClick={() => imprimir("boleta")}>
            <Icono nombre="imprimir" /> Imprimir boleta
          </button>
          <button type="button" className="boton-contorno grande" disabled={!ultima} onClick={() => imprimir("ticket")}>
            <Icono nombre="documento" /> Imprimir ticket
          </button>
        </div>
      </div>

      <aside className="caja-venta">
        <div className="tarjeta venta-actual">
          <div className="venta-actual-titulo">
            <h2 className="con-icono">
              <Icono nombre="carrito" tamano={30} /> Venta actual
            </h2>
            <button type="button" className="boton-contorno pequeno" disabled={items.length === 0} onClick={limpiar}>
              <Icono nombre="basura" tamano={18} /> Limpiar venta
            </button>
          </div>

          {items.length === 0 ? (
            <p className="venta-vacia">Agrega productos o escanea un código para empezar.</p>
          ) : (
            <table className="tabla-venta">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th className="numero">Precio unit.</th>
                  <th className="numero">Subtotal</th>
                  <th><span className="solo-lector">Quitar</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.producto} className="fila-entrando">
                    <td>
                      <span className="producto-celda">
                        <FotoProducto producto={i} tamano={40} />
                        {i.nombre}
                      </span>
                    </td>
                    <td>
                      <Cantidad valor={i.cantidad} maximo={i.disponible} nombre={i.nombre} alCambiar={(c) => cambiarCantidad(i.producto, c)} />
                    </td>
                    <td className="numero">{soles(i.precio)}</td>
                    <td className="numero">{soles(i.precio * i.cantidad)}</td>
                    <td>
                      <button type="button" className="boton-papelera" aria-label={`Quitar ${i.nombre}`} onClick={() => cambiarCantidad(i.producto, 0)}>
                        <Icono nombre="basura" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <dl className="totales-venta">
            <div>
              <dt>Subtotal ({unidades} productos):</dt>
              <dd>{soles(total)}</dd>
            </div>
            <div>
              <dt>IGV (18 %) incluido:</dt>
              <dd>{soles(igvIncluido(total))}</dd>
            </div>
            <div className="total">
              <dt>Total:</dt>
              <dd aria-live="polite">{soles(total)}</dd>
            </div>
          </dl>
        </div>

        <button type="button" className="boton-primario ancho procesar" disabled={items.length === 0} onClick={() => setCobrando(true)}>
          <Icono nombre="tarjeta" tamano={28} /> Procesar pago
        </button>
      </aside>

      <Dialogo titulo="Procesar pago" abierto={cobrando} alCerrar={() => setCobrando(false)}>
        <ProcesarPago alTerminar={terminarVenta} />
      </Dialogo>

      <Dialogo titulo="Venta registrada" abierto={venta !== null} alCerrar={() => setVenta(null)}>
        {venta && (
          <div className="venta-registrada">
            <span className="check-animado" aria-hidden="true">
              <Icono nombre="check" tamano={40} />
            </span>
            <p>
              Ticket <strong>{venta.numero_ticket}</strong>
            </p>
            <p className="total-cobrar">
              <span>Total</span>
              <strong>{soles(venta.total)}</strong>
            </p>
            {venta.vuelto != null && (
              <p className="vuelto grande">
                Vuelto: <strong>{soles(venta.vuelto)}</strong>
              </p>
            )}
            <div className="acciones-impresion">
              <button type="button" className="boton-contorno" onClick={() => imprimir("boleta")}>
                <Icono nombre="imprimir" /> Imprimir boleta
              </button>
              <button type="button" className="boton-contorno" onClick={() => imprimir("ticket")}>
                <Icono nombre="documento" /> Imprimir ticket
              </button>
            </div>
            <button type="button" className="boton-primario ancho" onClick={() => setVenta(null)}>
              Nueva venta
            </button>
          </div>
        )}
      </Dialogo>
      {ultima && <Comprobante venta={ultima} formato={formato} />}
    </section>
  );
}
