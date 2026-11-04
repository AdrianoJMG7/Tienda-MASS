import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, conFiltros, ErrorApi } from "../../api";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import { formatoFechaHora, soles } from "../../formato";
import type { FilaInventario } from "../../tipos";
import { useVentaCaja } from "../../ventaCaja";

// Los últimos escaneos son una ayuda para quien usa este equipo: quedan solo en este navegador.
const CLAVE_ESCANEOS = "mass.escaneos";
const MAX_ESCANEOS = 8;
// La cámara ve el mismo código muchas veces por segundo: cuenta otra vez solo si dejó de verlo un rato.
const PAUSA_MISMO_CODIGO_MS = 3000;

interface Escaneo {
  codigo: string;
  nombre: string;
  foto: string | null;
  fecha: string;
  accion: string;
  exitoso: boolean;
}

function leerEscaneos(): Escaneo[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ESCANEOS) ?? "[]");
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

const ETIQUETA_ESTADO = { disponible: "Disponible", bajo_stock: "Stock bajo", agotado: "Agotado" };

/** Controles que devuelve el lector al iniciar la cámara. */
interface ControlesLector {
  stop: () => void;
  switchTorch?: (encender: boolean) => Promise<void>;
}

/** HU13: escanear con la cámara un código QR o de barras para consultar el producto y agregarlo a la venta. */
export default function Escaner() {
  const { agregar } = useVentaCaja();
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<ControlesLector | null>(null);
  const ultimo = useRef({ codigo: "", hora: 0 });
  const [errorCamara, setErrorCamara] = useState("");
  const [hayLinterna, setHayLinterna] = useState(false);
  const [linterna, setLinterna] = useState(false);
  const [producto, setProducto] = useState<FilaInventario | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [manual, setManual] = useState("");
  const [escaneos, setEscaneos] = useState<Escaneo[]>(leerEscaneos);

  const anotar = useCallback((escaneo: Omit<Escaneo, "fecha">) => {
    setEscaneos((actuales) => {
      const nuevos = [{ ...escaneo, fecha: new Date().toISOString() }, ...actuales].slice(0, MAX_ESCANEOS);
      try {
        localStorage.setItem(CLAVE_ESCANEOS, JSON.stringify(nuevos));
      } catch {
        // Sin almacenamiento la lista dura mientras la página esté abierta.
      }
      return nuevos;
    });
  }, []);

  const consultar = useCallback(
    async (codigo: string) => {
      setMensaje("");
      try {
        const fila = await api<FilaInventario>(conFiltros("/inventario/inventario/consulta/", { codigo }));
        setProducto(fila);
        anotar({ codigo, nombre: fila.nombre, foto: fila.foto, accion: "Consultado", exitoso: true });
      } catch (e) {
        setProducto(null);
        const noExiste = e instanceof ErrorApi && e.estado === 404;
        setMensaje(noExiste ? `No hay ningún producto con el código ${codigo}.` : "No se pudo consultar el código.");
        if (noExiste) anotar({ codigo, nombre: "Código desconocido", foto: null, accion: "Sin resultado", exitoso: false });
      }
    },
    [anotar],
  );

  // La librería del lector pesa: se descarga solo al abrir esta pantalla.
  useEffect(() => {
    let vigente = true;
    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorCamara("Este navegador no permite usar la cámara. Abre la página con HTTPS o en localhost, o escribe el código.");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!vigente || !video.current) return;
        const lector = new BrowserMultiFormatReader();
        const iniciados = await lector.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current,
          (resultado) => {
            if (!resultado) return;
            const codigo = resultado.getText().trim();
            const ahora = Date.now();
            const repetido = codigo === ultimo.current.codigo && ahora - ultimo.current.hora < PAUSA_MISMO_CODIGO_MS;
            ultimo.current = { codigo, hora: ahora };
            if (repetido) return;
            void consultar(codigo);
          },
        );
        if (!vigente) {
          iniciados.stop();
          return;
        }
        controles.current = iniciados;
        setHayLinterna(Boolean(iniciados.switchTorch));
      } catch (e) {
        if (!vigente) return;
        const nombre = (e as { name?: string }).name;
        setErrorCamara(
          nombre === "NotAllowedError"
            ? "No hay permiso para usar la cámara. Actívalo en el candado de la barra de direcciones, o escribe el código."
            : nombre === "NotFoundError"
              ? "No se encontró una cámara en este equipo. Escribe el código o usa un lector USB en Caja."
              : "No se pudo iniciar la cámara. Escribe el código.",
        );
      }
    }
    void iniciar();
    return () => {
      vigente = false;
      controles.current?.stop();
      controles.current = null;
    };
  }, [consultar]);

  async function alternarLinterna() {
    try {
      await controles.current?.switchTorch?.(!linterna);
      setLinterna(!linterna);
    } catch {
      setHayLinterna(false);
    }
  }

  function buscarManual(evento: FormEvent) {
    evento.preventDefault();
    if (manual.trim()) void consultar(manual.trim());
    setManual("");
  }

  function agregarAVenta() {
    if (!producto) return;
    agregar({ producto: producto.producto, nombre: producto.nombre, foto: producto.foto, precio: producto.precio_final, disponible: producto.cantidad });
    anotar({ codigo: producto.codigo_barras, nombre: producto.nombre, foto: producto.foto, accion: "Agregado a la venta", exitoso: true });
    setMensaje(`${producto.nombre} se agregó a la venta.`);
  }

  return (
    <section className="pagina-escaner">
      <EncabezadoPagina icono="qr" titulo="Escáner QR de Productos" subtitulo="Escanea el código QR o de barras para consultar o registrar productos." />

      <div className="escaner-cuerpo">
        <div className="tarjeta escaner-camara">
          <div className="visor">
            <video ref={video} muted playsInline aria-label="Vista de la cámara" />
            {errorCamara ? (
              <div className="visor-error">
                <Icono nombre="camara" tamano={48} />
                <p role="alert">{errorCamara}</p>
              </div>
            ) : (
              <>
                <span className="visor-pista">
                  <Icono nombre="camara" /> Apunta la cámara al código
                </span>
                <div className="visor-marco" aria-hidden="true">
                  <i /><i /><i /><i />
                  <span className="visor-linea" />
                </div>
                {hayLinterna && (
                  <button type="button" className="visor-linterna" aria-pressed={linterna} onClick={alternarLinterna}>
                    <Icono nombre="linterna" /> {linterna ? "Apagar linterna" : "Activar linterna"}
                  </button>
                )}
              </>
            )}
          </div>
          <form className="escaner-manual" onSubmit={buscarManual}>
            <div className="buscador">
              <Icono nombre="etiqueta" />
              <label htmlFor="codigo-manual" className="solo-lector">Escribir el código del producto</label>
              <input id="codigo-manual" inputMode="numeric" placeholder="O escribe el código…" value={manual} onChange={(e) => setManual(e.target.value)} />
            </div>
            <button className="boton-contorno" disabled={!manual.trim()}>Consultar</button>
          </form>
        </div>

        <div className="tarjeta escaner-info">
          <h2 className="con-icono">
            <Icono nombre="caja" tamano={32} /> Información del producto
          </h2>
          {mensaje && <p className={producto ? "aviso" : "alerta"} role="status">{mensaje}</p>}
          {producto ? (
            <div className="producto-escaneado" key={producto.id}>
              <div className="producto-escaneado-datos">
                <FotoProducto producto={producto} tamano={150} />
                <div>
                  <h3>{producto.nombre}</h3>
                  <span className={`estado-stock ${producto.estado}`}>
                    <i aria-hidden="true" /> {ETIQUETA_ESTADO[producto.estado]}
                  </span>
                  <p>Categoría: <strong>{producto.categoria_nombre}</strong></p>
                  <p>Precio: <strong>{soles(producto.precio_final)}</strong></p>
                </div>
              </div>
              <div className="producto-escaneado-stock">
                <div>
                  <Icono nombre="caja" tamano={30} />
                  <span>Stock actual <strong>{producto.cantidad} und.</strong></span>
                </div>
                <div>
                  <Icono nombre="alerta" tamano={30} />
                  <span>Stock mínimo <strong>{producto.stock_minimo} und.</strong></span>
                </div>
              </div>
              <button type="button" className="boton-suave ancho" disabled={producto.cantidad === 0} onClick={agregarAVenta}>
                <Icono nombre="carrito" /> {producto.cantidad === 0 ? "Agotado en tu tienda" : "Agregar a la venta"}
              </button>
              <Link to="/vendedor/caja" className="enlace-flecha centrado">
                Ir a Caja <Icono nombre="flechaDer" tamano={18} />
              </Link>
            </div>
          ) : (
            !mensaje && <p className="venta-vacia">Escanea un producto para ver su información.</p>
          )}
        </div>
      </div>

      <div className="tarjeta ultimos-escaneos">
        <h2 className="con-icono">
          <Icono nombre="historial" tamano={28} /> Últimos escaneos
        </h2>
        {escaneos.length === 0 ? (
          <p className="venta-vacia">Aún no has escaneado productos en este equipo.</p>
        ) : (
          <table className="tabla tabla-vendedor">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Fecha y hora</th>
                <th>Acción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {escaneos.map((e, i) => (
                <tr key={`${e.fecha}-${i}`}>
                  <td data-titulo="Producto">
                    <span className="producto-celda">
                      <FotoProducto producto={e} tamano={36} />
                      {e.nombre}
                    </span>
                  </td>
                  <td data-titulo="Código">{e.codigo}</td>
                  <td data-titulo="Fecha y hora">{formatoFechaHora(e.fecha)}</td>
                  <td data-titulo="Acción">{e.accion}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${e.exitoso ? "disponible" : "agotado"}`}>
                      <i aria-hidden="true" /> {e.exitoso ? "Exitoso" : "Sin resultado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
