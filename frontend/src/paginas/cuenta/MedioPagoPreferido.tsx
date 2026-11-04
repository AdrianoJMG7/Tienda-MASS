import { useState } from "react";
import { patch, type Usuario } from "../../api";
import { useSesion } from "../../auth";
import Icono from "../../componentes/Icono";
import { MEDIOS_PAGO } from "../../mediosPago";
import { useEnvio } from "../../useCarga";

const PASOS = [
  "Elige tu medio de pago preferido en esta lista.",
  "Al confirmar un pedido lo marcaremos por ti; puedes cambiarlo en ese momento.",
  "Pagas al recoger tu pedido en la caja de la tienda.",
];

/** Medio de pago preferido: se marca solo al confirmar cada pedido. No se guardan datos de tarjetas. */
export default function MedioPagoPreferido() {
  const { usuario, actualizar } = useSesion();
  const [elegido, setElegido] = useState(usuario?.medio_pago_preferido ?? "");
  const [guardado, setGuardado] = useState(false);
  const { general, enviando, enviar } = useEnvio();

  async function guardar() {
    setGuardado(false);
    const ok = await enviar(async () => actualizar(await patch<Usuario>("/auth/yo/", { medio_pago_preferido: elegido })));
    setGuardado(ok);
  }

  return (
    <section>
      <h1>Medio de pago</h1>
      <p className="subtitulo">Gestiona tu medio de pago preferido.</p>

      <div className="medio-pago-cuerpo">
        <div className="tarjeta">
          <fieldset className="medios-pago">
            <legend>
              <Icono nombre="tarjeta" tamano={28} /> Mi medio de pago preferido
            </legend>
            <div className="opciones-pago lista">
              {MEDIOS_PAGO.map((m) => (
                <label key={m.valor} className={`opcion-pago${elegido === m.valor ? " elegida" : ""}`}>
                  <input
                    type="radio"
                    name="medio_pago"
                    checked={elegido === m.valor}
                    onChange={() => {
                      setElegido(m.valor);
                      setGuardado(false);
                    }}
                  />
                  <span className="logo-pago" aria-hidden="true">
                    <Icono nombre={m.icono} tamano={34} />
                  </span>
                  <span>
                    <strong>{m.titulo}</strong>
                    <small>{m.texto}</small>
                    {usuario?.medio_pago_preferido === m.valor && (
                      <span className="insignia disponible">
                        <Icono nombre="check" tamano={14} /> Predeterminado
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="tarjeta">
          <h2 className="con-icono titulo-tarjeta">
            <Icono nombre="info" tamano={28} /> ¿Cómo funciona?
          </h2>
          <ol className="pasos-pago">
            {PASOS.map((paso, i) => (
              <li key={paso}>
                <span className="paso-numero">{i + 1}</span>
                {paso}
              </li>
            ))}
          </ol>
          <p className="banda-info">
            <Icono nombre="candado" tamano={22} />
            Por tu seguridad, Mass no guarda números de tarjeta ni códigos de seguridad.
          </p>
          {general && <p className="alerta" role="alert">{general}</p>}
          <button type="button" className="boton-primario ancho grande" disabled={!elegido || enviando} onClick={guardar}>
            <Icono nombre="guardar" /> {enviando ? "Guardando…" : "Guardar preferencia"}
          </button>
          {guardado && (
            <p className="aviso" role="status">
              Listo, usaremos este medio por defecto.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
