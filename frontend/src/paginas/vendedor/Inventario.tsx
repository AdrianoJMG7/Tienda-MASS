import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { conFiltros, post } from "../../api";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import FotoProducto from "../../componentes/FotoProducto";
import Icono from "../../componentes/Icono";
import Paginacion from "../../componentes/Paginacion";
import { formatoFecha, formatoFechaHora, hoyIso } from "../../formato";
import type { FilaInventario, MovimientoStock, Paginado, PanelInventario } from "../../tipos";
import { useCarga, useEnvio, useRetraso } from "../../useCarga";

const POR_PAGINA = 8;

const ESTADOS = [
  { valor: "", texto: "Todos los estados" },
  { valor: "disponible", texto: "Disponible" },
  { valor: "bajo_stock", texto: "Stock bajo" },
  { valor: "agotado", texto: "Agotado" },
  { valor: "por_vencer", texto: "Por vencer (7 días)" },
];

const ETIQUETA_ESTADO = { disponible: "Disponible", bajo_stock: "Stock bajo", agotado: "Agotado" };

const MOTIVOS_SUBE = [
  { valor: "reposicion", texto: "Reposición de stock" },
  { valor: "conteo", texto: "Corrección por conteo" },
];
const MOTIVOS_BAJA = [
  { valor: "vencido", texto: "Vencido" },
  { valor: "danado", texto: "Dañado" },
  { valor: "robo", texto: "Robo" },
  { valor: "conteo", texto: "Corrección por conteo" },
];

/** HU15: fija el stock contado; la diferencia queda registrada como ingreso o merma con su motivo. */
function ActualizarStock({ fila, alGuardar }: { fila: FilaInventario; alGuardar: (nueva: FilaInventario) => void }) {
  const [nuevo, setNuevo] = useState(String(fila.cantidad));
  const [minimo, setMinimo] = useState(String(fila.stock_minimo));
  const [motivo, setMotivo] = useState("");
  const [vencimiento, setVencimiento] = useState(fila.fecha_vencimiento ?? "");
  const { errores, general, enviando, enviar } = useEnvio();

  const cantidad = Number(nuevo);
  const valido = nuevo !== "" && Number.isInteger(cantidad) && cantidad >= 0;
  const sube = cantidad > fila.cantidad;
  const baja = valido && cantidad < fila.cantidad;
  const motivos = sube ? MOTIVOS_SUBE : baja ? MOTIVOS_BAJA : [];
  const motivoValido = motivos.some((m) => m.valor === motivo);
  const cambioMinimo = minimo !== String(fila.stock_minimo);
  const cambioVencimiento = vencimiento !== (fila.fecha_vencimiento ?? "");
  const hayCambio = sube || baja || cambioMinimo || cambioVencimiento;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    await enviar(async () => {
      const actualizada = await post<FilaInventario>("/inventario/inventario/ajuste/", {
        producto: fila.producto,
        nuevo_stock: cantidad,
        motivo: motivoValido ? motivo : "conteo",
        stock_minimo: Number(minimo),
        ...(vencimiento ? { fecha_vencimiento: vencimiento } : {}),
      });
      alGuardar(actualizada);
    });
  }

  return (
    <form className="tarjeta panel-stock" onSubmit={guardar} noValidate>
      <h2 className="con-icono">
        <Icono nombre="etiqueta" tamano={28} /> Actualizar stock
      </h2>
      <div className="panel-stock-producto">
        <FotoProducto producto={fila} tamano={80} />
        <span>
          <strong>{fila.nombre}</strong>
          <small className="dato-secundario">{fila.marca} · {fila.codigo_barras}</small>
        </span>
      </div>
      {general && <p className="alerta" role="alert">{general}</p>}

      <p className="etiqueta-campo">Stock actual</p>
      <p className="stock-actual">{fila.cantidad}</p>
      {fila.reservado > 0 && <p className="ayuda">{fila.reservado} más reservadas por pedidos online.</p>}

      <div className="rejilla-stock">
        <div className="campo">
          <label htmlFor="nuevo-stock">Nuevo stock *</label>
          <input id="nuevo-stock" type="number" min="0" step="1" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-invalid={errores.nuevo_stock ? true : undefined} />
          {errores.nuevo_stock && <p className="error-campo">{errores.nuevo_stock}</p>}
        </div>
        <div className="campo">
          <label htmlFor="stock-minimo">Stock mínimo</label>
          <input id="stock-minimo" type="number" min="0" step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} aria-invalid={errores.stock_minimo ? true : undefined} />
          {errores.stock_minimo && <p className="error-campo">{errores.stock_minimo}</p>}
        </div>
      </div>

      {motivos.length > 0 && (
        <div className="campo">
          <label htmlFor="motivo-ajuste">Motivo del ajuste *</label>
          <select id="motivo-ajuste" value={motivoValido ? motivo : ""} onChange={(e) => setMotivo(e.target.value)}>
            <option value="" disabled>Elige un motivo</option>
            {motivos.map((m) => (
              <option key={m.valor} value={m.valor}>{m.texto}</option>
            ))}
          </select>
          {errores.motivo && <p className="error-campo">{errores.motivo}</p>}
        </div>
      )}

      <div className="campo">
        <label htmlFor="vencimiento">Fecha de vencimiento del lote</label>
        <input id="vencimiento" type="date" min={hoyIso()} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
      </div>

      <button className="boton-primario ancho grande" disabled={enviando || !valido || !hayCambio || (motivos.length > 0 && !motivoValido)}>
        <Icono nombre="guardar" /> {enviando ? "Guardando…" : "Guardar ajuste"}
      </button>
    </form>
  );
}

function Movimientos() {
  const [pagina, setPagina] = useState(1);
  const { datos, error } = useCarga<Paginado<MovimientoStock>>(conFiltros("/inventario/movimientos/", { page: pagina, page_size: 10 }));
  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!datos) return <p className="estado">Cargando movimientos…</p>;
  return (
    <>
      <table className="tabla tabla-vendedor">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Motivo</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody>
          {datos.results.map((m) => (
            <tr key={m.id}>
              <td data-titulo="Fecha">{formatoFechaHora(m.fecha)}</td>
              <td data-titulo="Producto">{m.producto_nombre}</td>
              <td data-titulo="Tipo">{m.tipo_display}</td>
              <td data-titulo="Cantidad">{m.cantidad}</td>
              <td data-titulo="Motivo">{m.motivo || m.referencia || "—"}</td>
              <td data-titulo="Usuario">{m.usuario_nombre ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paginacion pagina={pagina} total={datos.count} porPagina={10} alCambiar={setPagina} />
    </>
  );
}

/** HU14: stock de la tienda con su estado. HU15: ajustes con motivo e historial de movimientos. */
export default function Inventario() {
  const [params] = useSearchParams();
  const qCabecera = params.get("q") ?? "";
  const [texto, setTexto] = useState(qCabecera);
  const [categoria, setCategoria] = useState<number | "">("");
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [elegida, setElegida] = useState<FilaInventario | null>(null);
  const [verMovimientos, setVerMovimientos] = useState(false);
  const [aviso, setAviso] = useState("");
  const q = useRetraso(texto.trim());

  // El buscador de la cabecera también filtra esta tabla.
  useEffect(() => {
    setTexto(qCabecera);
    setPagina(1);
  }, [qCabecera]);

  const { datos, error, cargando, recargar } = useCarga<PanelInventario>(
    conFiltros("/inventario/inventario/panel/", { q, categoria, estado, page: pagina, page_size: POR_PAGINA }),
  );
  const actual = elegida ?? datos?.results[0] ?? null;

  const filtrar = (cambio: () => void) => {
    cambio();
    setPagina(1);
  };

  return (
    <section className="pagina-inventario">
      <div className="inventario-principal">
        <EncabezadoPagina icono="caja" titulo="Inventario" subtitulo="Consulta y actualiza el stock de tu tienda.">
          <button type="button" className="boton-contorno" onClick={() => setVerMovimientos(true)}>
            <Icono nombre="historial" /> Movimientos
          </button>
          <button type="button" className="boton-contorno" onClick={recargar}>
            <Icono nombre="actualizar" className={cargando ? "girando" : undefined} /> Actualizar stock
          </button>
        </EncabezadoPagina>

        <div className="pestanas-vendedor" role="group" aria-label="Categoría">
          <button type="button" className={categoria === "" ? "activa" : undefined} aria-pressed={categoria === ""} onClick={() => filtrar(() => setCategoria(""))}>
            Todos{datos && ` (${datos.total_tienda})`}
          </button>
          {datos?.categorias.map((c) => (
            <button key={c.id} type="button" className={categoria === c.id ? "activa" : undefined} aria-pressed={categoria === c.id} onClick={() => filtrar(() => setCategoria(c.id))}>
              {c.nombre} ({c.productos})
            </button>
          ))}
        </div>

        <div className="filtros-inventario">
          <div className="buscador">
            <Icono nombre="buscar" />
            <label htmlFor="buscar-inventario" className="solo-lector">Buscar producto</label>
            <input id="buscar-inventario" type="search" placeholder="Buscar producto o código…" value={texto} onChange={(e) => filtrar(() => setTexto(e.target.value))} />
          </div>
          <label className="solo-lector" htmlFor="estado-stock">Estado del stock</label>
          <select id="estado-stock" className="selector-pastilla" value={estado} onChange={(e) => filtrar(() => setEstado(e.target.value))}>
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>{e.texto}</option>
            ))}
          </select>
        </div>

        {aviso && <p className="aviso" role="status">{aviso}</p>}
        {error && <p className="alerta" role="alert">{error}</p>}

        <div className="tarjeta contenedor-tabla">
          <table className="tabla tabla-vendedor" aria-busy={cargando}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Categoría</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
                <th><span className="solo-lector">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {datos?.results.map((f) => (
                <tr key={f.id} className={actual?.id === f.id ? "fila-elegida" : undefined}>
                  <td data-titulo="Producto">
                    <span className="producto-celda">
                      <FotoProducto producto={f} tamano={40} />
                      <span>
                        {f.nombre}
                        <small className="dato-secundario">{f.marca}</small>
                      </span>
                    </span>
                  </td>
                  <td data-titulo="Código">{f.codigo_barras}</td>
                  <td data-titulo="Categoría">{f.categoria_nombre}</td>
                  <td data-titulo="Stock actual"><strong>{f.cantidad}</strong></td>
                  <td data-titulo="Stock mínimo">{f.stock_minimo}</td>
                  <td data-titulo="Estado">
                    <span className={`estado-stock ${f.estado}`}>
                      <i aria-hidden="true" /> {ETIQUETA_ESTADO[f.estado]}
                    </span>
                    {f.fecha_vencimiento && <small className="dato-secundario">Vence {formatoFecha(f.fecha_vencimiento)}</small>}
                  </td>
                  <td data-titulo="Acciones">
                    <button
                      type="button"
                      className="boton-contorno pequeno"
                      onClick={() => {
                        setElegida(f);
                        setAviso("");
                      }}
                    >
                      <Icono nombre="lapiz" tamano={18} /> Editar<span className="solo-lector"> {f.nombre}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos?.results.length === 0 && <p className="estado">No hay productos con esos filtros.</p>}
          <div className="pie-tabla">
            <span>
              {datos && datos.count > 0 &&
                `Mostrando ${(pagina - 1) * POR_PAGINA + 1} - ${Math.min(pagina * POR_PAGINA, datos.count)} de ${datos.count} productos`}
            </span>
            <Paginacion pagina={pagina} total={datos?.count ?? 0} porPagina={POR_PAGINA} alCambiar={setPagina} />
          </div>
        </div>
      </div>

      {actual && (
        <ActualizarStock
          key={`${actual.id}-${actual.cantidad}-${actual.stock_minimo}`}
          fila={actual}
          alGuardar={(nueva) => {
            setElegida(nueva);
            setAviso(`Stock de ${nueva.nombre} actualizado a ${nueva.cantidad}.`);
            recargar();
          }}
        />
      )}

      <Dialogo titulo="Movimientos de stock" abierto={verMovimientos} alCerrar={() => setVerMovimientos(false)}>
        <Movimientos />
      </Dialogo>
    </section>
  );
}
