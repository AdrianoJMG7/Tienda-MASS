import { useEffect, useRef, useState } from "react";
import { api, conFiltros } from "../../api";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import EscanerQR from "../../componentes/EscanerQR";
import type { ItemVenta, MedioPago, Paginado, Producto } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

/** HU12: registrar ventas en caja con búsqueda de productos y cálculo de vuelto. HU13: escanear códigos QR y USB. */
export default function Caja() {
  const [busqueda, setBusqueda] = useState("");
  const q = useRetraso(busqueda);
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [ventaReciente, setVentaReciente] = useState<any>(null);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [codigoEscaneado, setCodigoEscaneado] = useState<string | null>(null);
  const teclasRef = useRef<string[]>([]);
  const tiempoTeclasRef = useRef<number>(0);

  const { datos: productos } = useCarga<Paginado<Producto>>(
    q ? conFiltros("/productos/productos/", { q, page_size: 10 }) : null
  );

  const { errores, general, enviando, enviar } = useEnvio();

  const total = items.reduce((sum, item) => {
    const producto = productos?.results?.find((p) => p.id === item.producto);
    return sum + (producto ? producto.precio_final * item.cantidad : 0);
  }, 0);

  const vuelto = medioPago === "efectivo" && montoRecibido ? Math.max(0, parseFloat(montoRecibido) - total) : 0;

  function agregarProducto(producto: Producto) {
    const existente = items.find((i) => i.producto === producto.id);
    if (existente) {
      setItems(items.map((i) => (i.producto === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)));
    } else {
      setItems([...items, { producto: producto.id, cantidad: 1 }]);
    }
    setBusqueda("");
  }

  function cambiarCantidad(productoId: number, delta: number) {
    setItems(
      items
        .map((i) => {
          if (i.producto === productoId) {
            const nuevaCantidad = Math.max(1, i.cantidad + delta);
            return nuevaCantidad > 0 ? { ...i, cantidad: nuevaCantidad } : null;
          }
          return i;
        })
        .filter((i): i is ItemVenta => i !== null)
    );
  }

  function quitarProducto(productoId: number) {
    setItems(items.filter((i) => i.producto !== productoId));
  }

  async function confirmarVenta() {
    await enviar(async () => {
      const respuesta = await api("/ventas/ventas/crear/", {
        method: "POST",
        body: JSON.stringify({
          medio_pago: medioPago,
          monto_recibido: medioPago === "efectivo" ? montoRecibido : null,
          items,
        }),
      });
      setVentaReciente(respuesta);
      setItems([]);
      setMontoRecibido("");
      setMostrarConfirmar(false);
    });
  }

  function nuevaVenta() {
    setVentaReciente(null);
  }

  // Detección de escáner USB (actúa como teclado rápido)
  useEffect(() => {
    function manejarKeyDown(evento: KeyboardEvent) {
      const ahora = Date.now();
      
      // Si el campo de búsqueda tiene foco, no procesar como escáner USB
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "search") {
        return;
      }

      // Si no teclas en los últimos 100ms, reiniciar buffer
      if (ahora - tiempoTeclasRef.current > 100) {
        teclasRef.current = [];
      }
      
      tiempoTeclasRef.current = ahora;
      
      if (evento.key === "Enter") {
        // Si hay teclas acumuladas, es probablemente un escáner USB
        if (teclasRef.current.length > 0) {
          const codigo = teclasRef.current.join("");
          teclasRef.current = [];
          evento.preventDefault();
          manejarEscanear(codigo);
        }
      } else if (evento.key.length === 1) {
        // Acumular teclas (solo caracteres imprimibles)
        teclasRef.current.push(evento.key);
      }
    }

    window.addEventListener("keydown", manejarKeyDown);
    return () => window.removeEventListener("keydown", manejarKeyDown);
  }, []);

  async function buscarPorCodigoBarras(codigo: string) {
    try {
      const respuesta = await api<Paginado<Producto>>(
        conFiltros("/productos/productos/", { codigo_barras: codigo, page_size: 1 })
      );
      return respuesta.results?.[0] || null;
    } catch (error) {
      console.error("Error al buscar por código de barras:", error);
      return null;
    }
  }

  async function manejarEscanear(codigo: string) {
    const producto = await buscarPorCodigoBarras(codigo);
    if (producto) {
      agregarProducto(producto);
    } else {
      alert("Código no encontrado en el catálogo. Por favor, busca el producto por nombre.");
      setBusqueda(codigo);
      // Cerrar el escáner y poner foco en el campo de búsqueda
      setEscanerAbierto(false);
      setTimeout(() => {
        const input = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }

  return (
    <section>
      <div className="barra-titulo">
        <div>
          <h1>Caja</h1>
          <p className="subtitulo">Registrar ventas en tienda para clientes presenciales.</p>
        </div>
      </div>

      {ventaReciente ? (
        <div className="tarjeta texto-centro">
          <h2 className="exito">¡Venta registrada!</h2>
          <p>
            <strong>Ticket:</strong> {ventaReciente.numero_ticket}
          </p>
          <p>
            <strong>Total:</strong> S/ {ventaReciente.total.toFixed(2)}
          </p>
          {ventaReciente.vuelto !== null && ventaReciente.vuelto > 0 && (
            <p>
              <strong>Vuelto:</strong> S/ {ventaReciente.vuelto.toFixed(2)}
            </p>
          )}
          <button type="button" className="boton" onClick={nuevaVenta}>
            Nueva venta
          </button>
        </div>
      ) : (
        <>
          <div className="filtros campo-con-escaner">
            <Campo
              etiqueta="Buscar producto (código o nombre)"
              type="search"
              placeholder="Arroz, leche, código de barras…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="boton-escaner"
              onClick={() => setEscanerAbierto(true)}
              aria-label="Escanear código QR"
              title="Escanear código QR"
            >
              📷
            </button>
          </div>

          {productos && productos.results && productos.results.length > 0 && (
            <ul className="resultados-busqueda">
              {productos.results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => agregarProducto(p)}>
                    <span className="producto-celda">
                      {p.foto ? (
                        <img src={p.foto} alt="" className="foto-producto" width="40" height="40" />
                      ) : (
                        <div className="foto-producto vacia" style={{ width: 40, height: 40 }}>
                          {p.nombre[0]}
                        </div>
                      )}
                      <div>
                        <strong>{p.nombre}</strong>
                        <br />
                        <small>{p.marca}</small>
                      </div>
                    </span>
                    <span>S/ {p.precio_final.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="carrito">
              <div className="lineas-carrito">
                {items.map((item) => {
                  const producto = productos?.results?.find((p) => p.id === item.producto);
                  if (!producto) return null;
                  return (
                    <li key={item.producto} className="linea-carrito">
                      <span className="producto-celda">
                        {producto.foto ? (
                          <img src={producto.foto} alt="" className="foto-producto" width="50" height="50" />
                        ) : (
                          <div className="foto-producto vacia" style={{ width: 50, height: 50 }}>
                            {producto.nombre[0]}
                          </div>
                        )}
                        <div>
                          <strong>{producto.nombre}</strong>
                          <br />
                          <small>{producto.marca}</small>
                        </div>
                      </span>
                      <div className="linea-acciones">
                        <div className="cantidad">
                          <button type="button" onClick={() => cambiarCantidad(item.producto, -1)}>
                            −
                          </button>
                          <output>{item.cantidad}</output>
                          <button type="button" onClick={() => cambiarCantidad(item.producto, 1)}>
                            +
                          </button>
                        </div>
                        <div className="linea-subtotal">
                          <strong>S/ {(producto.precio_final * item.cantidad).toFixed(2)}</strong>
                        </div>
                        <button
                          type="button"
                          className="enlace peligro"
                          onClick={() => quitarProducto(item.producto)}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </div>

              <div className="resumen tarjeta">
                <h2>Resumen de venta</h2>
                <div className="totales">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>S/ {total.toFixed(2)}</dd>
                  </div>
                  <div className="total">
                    <dt>Total a pagar</dt>
                    <dd>S/ {total.toFixed(2)}</dd>
                  </div>
                </div>

                <div className="campo">
                  <label>Medio de pago</label>
                  <select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="yape_plin">Yape/Plin</option>
                  </select>
                </div>

                {medioPago === "efectivo" && (
                  <Campo
                    etiqueta="Monto recibido"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    error={errores.monto_recibido}
                  />
                )}

                {medioPago === "efectivo" && montoRecibido && vuelto > 0 && (
                  <p className="aviso">
                    <strong>Vuelto: S/ {vuelto.toFixed(2)}</strong>
                  </p>
                )}

                {general && <p className="alerta">{general}</p>}

                <button
                  type="button"
                  className="boton ancho"
                  onClick={() => setMostrarConfirmar(true)}
                  disabled={items.length === 0 || (medioPago === "efectivo" && !montoRecibido)}
                >
                  Confirmar venta
                </button>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <p className="estado texto-centro">
              Agrega productos para comenzar la venta.
            </p>
          )}

          {mostrarConfirmar && (
            <Dialogo titulo="Confirmar venta" abierto={mostrarConfirmar} alCerrar={() => setMostrarConfirmar(false)}>
              <p>
                <strong>Total:</strong> S/ {total.toFixed(2)}
              </p>
              <p>
                <strong>Medio de pago:</strong> {medioPago === "efectivo" ? "Efectivo" : medioPago === "tarjeta" ? "Tarjeta" : "Yape/Plin"}
              </p>
              {medioPago === "efectivo" && (
                <p>
                  <strong>Monto recibido:</strong> S/ {parseFloat(montoRecibido).toFixed(2)}
                </p>
              )}
              {medioPago === "efectivo" && vuelto > 0 && (
                <p>
                  <strong>Vuelto:</strong> S/ {vuelto.toFixed(2)}
                </p>
              )}
              <p>¿Confirmar la venta?</p>
              <div className="acciones-dialogo">
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => setMostrarConfirmar(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="boton"
                  onClick={confirmarVenta}
                  disabled={enviando}
                >
                  {enviando ? "Procesando…" : "Confirmar"}
                </button>
              </div>
            </Dialogo>
          )}

          <EscanerQR abierto={escanerAbierto} alCerrar={() => setEscanerAbierto(false)} alEscanear={manejarEscanear} />
        </>
      )}
    </section>
  );
}
