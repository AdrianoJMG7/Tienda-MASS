import { useState } from "react";
import { useNavigate } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { post } from "../../api";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import TarjetaIndicador from "../../componentes/TarjetaIndicador";
import { formatoFechaHora, soles } from "../../formato";
import type { MedioPago, TurnoCaja } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

// Colores fijos por medio de pago, validados para daltonismo; siempre van con su nombre y monto al lado.
const COLOR: Record<MedioPago, string> = { efectivo: "#2a78d6", tarjeta: "#eda100", yape_plin: "#6250d6" };

const horaTurno = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
const diaTurno = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Resumen y cierre del turno de caja: compara el efectivo contado con el esperado. */
export default function CierreCaja() {
  const navegar = useNavigate();
  const { datos: turno, error, recargar } = useCarga<TurnoCaja>("/ventas/cierres/turno/");
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [cerrado, setCerrado] = useState("");
  const { errores, general, enviando, enviar } = useEnvio();

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!turno) return <p className="estado">Cargando el turno…</p>;

  const hayContado = contado !== "" && Number(contado) >= 0;
  const diferencia = hayContado ? Number(contado) - turno.efectivo_esperado : null;
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.005;
  const conVentas = turno.medios.filter((m) => m.total > 0);

  async function cerrar() {
    const ok = await enviar(async () => {
      const cierre = await post<{ diferencia: number }>("/ventas/cierres/", { efectivo_contado: contado, notas });
      setCerrado(
        cierre.diferencia === 0
          ? "Caja cerrada. El efectivo coincide con lo esperado."
          : `Caja cerrada con una diferencia de ${soles(cierre.diferencia)}.`,
      );
    });
    setConfirmando(false);
    if (ok) {
      setContado("");
      setNotas("");
      recargar();
    }
  }

  return (
    <section className="pagina-cierre">
      <EncabezadoPagina icono="registradora" titulo="Cierre de caja" subtitulo="Resumen y finalización del turno de caja.">
        <p className="turno-actual">
          <Icono nombre="calendario" tamano={30} />
          <span>
            Turno actual:
            <strong>
              {diaTurno.format(new Date(turno.inicio))} {horaTurno.format(new Date(turno.inicio))} - {horaTurno.format(new Date(turno.fin))}
            </strong>
          </span>
        </p>
      </EncabezadoPagina>

      {cerrado && <p className="aviso" role="status">{cerrado}</p>}
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}

      <div className="indicadores-vendedor cuatro">
        <TarjetaIndicador icono="grafico" titulo="Ventas totales" valor={soles(turno.total)} variacion={turno.variacion.total} referencia="vs turno anterior" />
        <TarjetaIndicador icono="carrito" titulo="Ventas" valor={String(turno.ventas)} variacion={turno.variacion.ventas} referencia="vs turno anterior" />
        <TarjetaIndicador icono="caja" titulo="Productos" valor={String(turno.unidades)} variacion={turno.variacion.unidades} referencia="vs turno anterior" />
        <TarjetaIndicador icono="trofeo" titulo="Ticket más alto" valor={turno.ticket_mas_alto != null ? soles(turno.ticket_mas_alto) : "—"}>
          {turno.ticket_mas_alto_numero && <span className="dato-secundario">{turno.ticket_mas_alto_numero}</span>}
        </TarjetaIndicador>
      </div>

      <div className="cierre-rejilla">
        <div className="tarjeta">
          <h2 className="con-icono titulo-tarjeta"><Icono nombre="circular" tamano={30} /> Desglose por medio de pago</h2>
          {conVentas.length === 0 ? (
            <p className="venta-vacia">Aún no hay ventas en este turno.</p>
          ) : (
            <div className="desglose-pago">
              <div className="dona">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={conVentas} dataKey="total" nameKey="medio_display" innerRadius={58} outerRadius={96} startAngle={90} endAngle={-270} stroke="#ffffff" strokeWidth={2}>
                      {conVentas.map((m) => (
                        <Cell key={m.medio} fill={COLOR[m.medio]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(valor, nombre) => [soles(Number(valor)), String(nombre)]} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="dona-centro">
                  <strong>{soles(turno.total)}</strong>
                  <small>Total</small>
                </p>
              </div>
              <ul className="leyenda-pago">
                {turno.medios.map((m) => (
                  <li key={m.medio}>
                    <i style={{ background: COLOR[m.medio] }} aria-hidden="true" />
                    <span>{m.medio_display}</span>
                    <span>{m.porcentaje}%</span>
                    <strong>{soles(m.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="tarjeta resumen-cierre">
          <h2 className="con-icono titulo-tarjeta"><Icono nombre="calculadora" tamano={30} /> Resumen del cierre</h2>
          <div className="fila-cierre">
            <label htmlFor="efectivo-contado">Efectivo en caja actual</label>
            <input
              id="efectivo-contado"
              type="number"
              min="0"
              step="0.10"
              inputMode="decimal"
              placeholder="S/ 0.00"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              aria-invalid={errores.efectivo_contado ? true : undefined}
            />
          </div>
          {errores.efectivo_contado && <p className="error-campo">{errores.efectivo_contado}</p>}
          <div className="fila-cierre">
            <span>Ventas en efectivo</span>
            <output>{soles(turno.ventas_efectivo)}</output>
          </div>
          {turno.devoluciones_efectivo > 0 && (
            <div className="fila-cierre">
              <span>Devoluciones en efectivo</span>
              <output>− {soles(turno.devoluciones_efectivo)}</output>
            </div>
          )}
          <div className={`fila-cierre diferencia${diferencia === null ? "" : cuadra ? " cuadra" : " no-cuadra"}`}>
            <span>Diferencia</span>
            <strong>
              {diferencia !== null && <Icono nombre={cuadra ? "check" : "alerta"} tamano={20} />}
              {diferencia === null ? "—" : soles(diferencia)}
            </strong>
          </div>
          <div className="campo">
            <label htmlFor="notas-turno">Notas del turno (opcional)</label>
            <textarea id="notas-turno" rows={2} maxLength={300} placeholder="Agregar observaciones del turno…" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="cierre-pie">
        <p className="banda-info">
          <Icono nombre="info" tamano={30} />
          <span>
            <strong>{turno.ventas === 0 ? "No hay ventas para cerrar." : "Todo listo para cerrar la caja."}</strong>
            <small>Verifica que el efectivo en caja coincida con las ventas realizadas.</small>
          </span>
        </p>
        <button type="button" className="boton-contorno grande" onClick={() => navegar("/vendedor/caja")}>
          <Icono nombre="actualizar" /> Cancelar
        </button>
        <button type="button" className="boton-primario grande" disabled={!hayContado || turno.ventas === 0} onClick={() => setConfirmando(true)}>
          <Icono nombre="check" /> Cerrar caja
        </button>
      </div>

      <Dialogo titulo="Cerrar caja" abierto={confirmando} alCerrar={() => setConfirmando(false)}>
        <p>
          Se cerrará tu turno desde el {formatoFechaHora(turno.inicio)} con {soles(Number(contado))} contados
          {diferencia !== null && !cuadra && ` y una diferencia de ${soles(diferencia)}`}. No se puede deshacer.
        </p>
        <div className="acciones-dialogo">
          <button type="button" className="boton-contorno" onClick={() => setConfirmando(false)}>Volver</button>
          <button type="button" className="boton-primario" disabled={enviando} onClick={cerrar}>
            <Icono nombre="check" /> {enviando ? "Cerrando…" : "Sí, cerrar caja"}
          </button>
        </div>
      </Dialogo>
    </section>
  );
}
