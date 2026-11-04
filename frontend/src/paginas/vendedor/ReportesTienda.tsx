import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSesion } from "../../auth";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import TarjetaIndicador from "../../componentes/TarjetaIndicador";
import { soles } from "../../formato";
import type { PanelTienda } from "../../tipos";
import { useCarga } from "../../useCarga";

// Un solo color para las ventas y ámbar para resaltar al vendedor con sesión (tiene etiqueta y tabla de apoyo).
const AZUL = "#2a78d6";
const AMBAR = "#eda100";
const TINTA = "#4a5170";
const REJILLA = "#e6e8f0";

const PERIODOS = [
  { dias: 7, texto: "Últimos 7 días" },
  { dias: 30, texto: "Últimos 30 días" },
  { dias: 90, texto: "Últimos 90 días" },
];

const diaSemana = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const diaMes = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit" });
const aFecha = (iso: string) => new Date(`${iso}T12:00:00`);
const compacto = (valor: number) => (valor >= 1000 ? `${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)}k` : String(valor));

/** Reportes y rendimiento de la tienda del vendedor. */
export default function ReportesTienda() {
  const { usuario } = useSesion();
  const [dias, setDias] = useState(7);
  const { datos, error, cargando } = useCarga<PanelTienda>(`/reportes/tienda/?dias=${dias}`);
  const referencia = `vs ${dias} días anteriores`;
  const pocosDias = dias === 7;

  return (
    <section className="pagina-reportes-tienda">
      <EncabezadoPagina icono="grafico" titulo="Reportes y rendimiento" subtitulo="Consulta el desempeño de tu tienda y tus ventas.">
        <label className="solo-lector" htmlFor="periodo-reporte">Periodo</label>
        <select id="periodo-reporte" className="selector-pastilla" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>{p.texto}</option>
          ))}
        </select>
      </EncabezadoPagina>

      {error && <p className="alerta" role="alert">{error}</p>}
      {!datos && !error && <p className="estado">Cargando reportes…</p>}
      {datos && (
        <div className="reportes-cuerpo" aria-busy={cargando}>
          <div className="indicadores-vendedor cuatro">
            <TarjetaIndicador icono="monedas" titulo="Ventas totales" valor={soles(datos.resumen.ventas)} variacion={datos.variacion.ventas} referencia={referencia} />
            <TarjetaIndicador icono="carrito" titulo="Pedidos online" valor={datos.resumen.pedidos.toLocaleString("es-PE")} variacion={datos.variacion.pedidos} referencia={referencia} />
            <TarjetaIndicador icono="etiqueta" titulo="Ticket promedio" valor={soles(datos.resumen.ticket_promedio)} variacion={datos.variacion.ticket_promedio} referencia={referencia} />
            <TarjetaIndicador icono="cajas" titulo="Unidades vendidas" valor={datos.resumen.unidades.toLocaleString("es-PE")} variacion={datos.variacion.unidades} referencia={referencia} />
          </div>

          <div className="reportes-rejilla">
            <div className="tarjeta">
              <h2 className="con-icono titulo-tarjeta"><Icono nombre="barras" tamano={26} /> Ventas diarias (últimos {dias} días)</h2>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={datos.por_dia} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={REJILLA} />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(iso: string) => (pocosDias ? `${diaSemana.format(aFecha(iso))} ${diaMes.format(aFecha(iso))}` : diaMes.format(aFecha(iso)))}
                    tick={{ fill: TINTA, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: REJILLA }}
                    minTickGap={12}
                  />
                  <YAxis tickFormatter={compacto} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    formatter={(valor) => [soles(Number(valor)), "Ventas"]}
                    labelFormatter={(iso) => aFecha(String(iso)).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
                    cursor={{ fill: "rgba(9, 45, 181, 0.06)" }}
                  />
                  <Bar dataKey="total" fill={AZUL} maxBarSize={pocosDias ? 80 : 24} radius={[4, 4, 0, 0]}>
                    {pocosDias && <LabelList dataKey="total" position="top" formatter={(v) => soles(Number(v))} fill={TINTA} fontSize={12} />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="tarjeta">
              <h2 className="con-icono titulo-tarjeta"><Icono nombre="campana" tamano={26} /> Metas</h2>
              <ul className="alertas-metas">
                {datos.metas.map((m) => (
                  <li key={m.nombre} className={m.cumplida ? "cumplida" : "pendiente"}>
                    <Icono nombre={m.cumplida ? "check" : "alerta"} tamano={28} />
                    <span>
                      <strong>
                        {m.cumplida ? `Superaste la meta ${m.nombre}` : `Faltan ${soles(m.meta - m.actual)} para la meta ${m.nombre}`}
                      </strong>
                      <small>Meta: {soles(m.meta)} · Actual: {soles(m.actual)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tarjeta contenedor-tabla">
              <h2 className="con-icono titulo-tarjeta"><Icono nombre="trofeo" tamano={26} /> Top 5 productos</h2>
              {datos.top_productos.length === 0 ? (
                <p className="venta-vacia">Sin ventas en el periodo.</p>
              ) : (
                <table className="tabla tabla-vendedor">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Marca</th>
                      <th>Unidades</th>
                      <th>Total</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.top_productos.map((p, i) => (
                      <tr key={p.producto}>
                        <td data-titulo="#">{i + 1}</td>
                        <td data-titulo="Producto">{p.nombre}</td>
                        <td data-titulo="Marca">{p.marca}</td>
                        <td data-titulo="Unidades">{p.unidades}</td>
                        <td data-titulo="Total">{soles(p.total)}</td>
                        <td data-titulo="%">{p.porcentaje}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="tarjeta">
              <h2 className="con-icono titulo-tarjeta"><Icono nombre="usuarios" tamano={26} /> Comparativa de vendedores</h2>
              {datos.vendedores.length === 0 ? (
                <p className="venta-vacia">Sin ventas en el periodo.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(150, datos.vendedores.length * 44 + 30)}>
                  <BarChart data={datos.vendedores} layout="vertical" margin={{ top: 0, right: 90, left: 0, bottom: 0 }}>
                    <XAxis type="number" tickFormatter={compacto} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} />
                    <YAxis type="category" dataKey="vendedor" tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={{ stroke: REJILLA }} width={110} />
                    <Tooltip formatter={(valor) => [soles(Number(valor)), "Ventas"]} cursor={{ fill: "rgba(9, 45, 181, 0.06)" }} />
                    <Bar dataKey="total" maxBarSize={22} radius={[0, 4, 4, 0]}>
                      {datos.vendedores.map((v) => (
                        <Cell key={v.vendedor} fill={v.vendedor === usuario?.nombre ? AMBAR : AZUL} />
                      ))}
                      <LabelList dataKey="total" position="right" formatter={(v) => soles(Number(v))} fill={TINTA} fontSize={13} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
