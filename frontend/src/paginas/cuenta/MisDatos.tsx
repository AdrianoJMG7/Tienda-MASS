import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { patch, type Usuario } from "../../api";
import { useSesion } from "../../auth";
import Icono, { type NombreIcono } from "../../componentes/Icono";
import { hoyIso } from "../../formato";
import { useCarga, useEnvio } from "../../useCarga";

interface Perfil extends Usuario {
  dni: string;
  fecha_nacimiento: string | null;
}

const FOTO_MAX = 2 * 1024 * 1024;

/** Campo con ícono dentro de la caja, como en el resto de "Mi cuenta". */
function CampoIcono({ id, etiqueta, icono, error, children }: { id: string; etiqueta: string; icono: NombreIcono; error?: string; children: ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="entrada-icono">
        <Icono nombre={icono} />
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="error-campo">
          {error}
        </p>
      )}
    </div>
  );
}

function Formulario({ perfil }: { perfil: Perfil }) {
  const { actualizar } = useSesion();
  const [datos, setDatos] = useState({
    nombre: perfil.nombre,
    celular: perfil.celular,
    dni: perfil.dni,
    fecha_nacimiento: perfil.fecha_nacimiento ?? "",
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");
  const [guardado, setGuardado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const { errores, general, enviando, enviar } = useEnvio();

  const fotoNueva = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => {
    if (fotoNueva) URL.revokeObjectURL(fotoNueva);
  }, [fotoNueva]);
  const vistaPrevia = fotoNueva ?? (quitarFoto ? null : perfil.foto);
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => {
    setDatos({ ...datos, [campo]: e.target.value });
    setGuardado(false);
  };

  function elegirFoto(elegido: File | undefined) {
    setErrorFoto("");
    if (!elegido) return;
    if (!["image/jpeg", "image/png"].includes(elegido.type)) return setErrorFoto("La foto debe ser JPG o PNG.");
    if (elegido.size > FOTO_MAX) return setErrorFoto("La foto no debe pesar más de 2 MB.");
    setFoto(elegido);
    setQuitarFoto(false);
    setGuardado(false);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardado(false);
    const cuerpo = new FormData();
    Object.entries(datos).forEach(([campo, valor]) => cuerpo.append(campo, valor));
    if (foto) cuerpo.append("foto", foto);
    if (quitarFoto) cuerpo.append("quitar_foto", "true");
    const ok = await enviar(async () => actualizar(await patch<Usuario>("/auth/yo/", cuerpo)));
    if (ok) {
      setFoto(null);
      setQuitarFoto(false);
      setGuardado(true);
    }
  }

  const describir = (campo: string) => (errores[campo] ? `${campo}-error` : undefined);

  return (
    <form onSubmit={guardar} noValidate className="mis-datos">
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <div className="mis-datos-cuerpo">
        <div className="tarjeta">
          <h2 className="con-icono">
            <Icono nombre="usuario" tamano={26} /> Información personal
          </h2>
          <div className="rejilla-formulario">
            <CampoIcono id="nombre" etiqueta="Nombres y apellidos" icono="usuario" error={errores.nombre}>
              <input id="nombre" value={datos.nombre} onChange={cambiar("nombre")} autoComplete="name" required aria-invalid={!!errores.nombre} aria-describedby={describir("nombre")} />
            </CampoIcono>
            <CampoIcono id="email" etiqueta="Correo electrónico" icono="correo">
              <input id="email" value={perfil.email} readOnly aria-describedby="email-ayuda" />
            </CampoIcono>
            <CampoIcono id="celular" etiqueta="Celular" icono="celular" error={errores.celular}>
              <input id="celular" type="tel" inputMode="numeric" value={datos.celular} onChange={cambiar("celular")} autoComplete="tel" aria-invalid={!!errores.celular} aria-describedby={describir("celular")} />
            </CampoIcono>
            <CampoIcono id="dni" etiqueta="DNI" icono="dni" error={errores.dni}>
              <input id="dni" inputMode="numeric" maxLength={8} value={datos.dni} onChange={cambiar("dni")} aria-invalid={!!errores.dni} aria-describedby={describir("dni")} />
            </CampoIcono>
            <CampoIcono id="fecha_nacimiento" etiqueta="Fecha de nacimiento" icono="calendario" error={errores.fecha_nacimiento}>
              <input
                id="fecha_nacimiento"
                type="date"
                max={hoyIso()}
                value={datos.fecha_nacimiento}
                onChange={cambiar("fecha_nacimiento")}
                autoComplete="bday"
                aria-invalid={!!errores.fecha_nacimiento}
                aria-describedby={describir("fecha_nacimiento")}
              />
            </CampoIcono>
          </div>
          <p id="email-ayuda" className="ayuda">
            El correo es tu usuario para ingresar y no se puede cambiar.
          </p>
        </div>

        <div className="tarjeta foto-perfil">
          <h2 className="con-icono">
            <Icono nombre="camara" tamano={26} /> Foto de perfil
          </h2>
          <div className="foto-perfil-imagen">
            {vistaPrevia ? <img src={vistaPrevia} alt="Tu foto de perfil" /> : <Icono nombre="usuario" tamano={96} />}
            <button type="button" className="boton-icono flotante" aria-label="Cambiar foto" onClick={() => archivo.current?.click()}>
              <Icono nombre="lapiz" />
            </button>
          </div>
          <input ref={archivo} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => elegirFoto(e.target.files?.[0])} />
          <button type="button" className="boton-contorno" onClick={() => archivo.current?.click()}>
            <Icono nombre="subir" /> Cambiar foto
          </button>
          {vistaPrevia && (
            <button
              type="button"
              className="enlace peligro"
              onClick={() => {
                setFoto(null);
                setQuitarFoto(true);
                setGuardado(false);
              }}
            >
              Quitar foto
            </button>
          )}
          {(errorFoto || errores.foto) && <p className="error-campo">{errorFoto || errores.foto}</p>}
          <p className="ayuda texto-centro">
            Formatos permitidos: JPG, PNG.
            <br />
            Tamaño máximo: 2 MB.
          </p>
        </div>
      </div>
      <div className="acciones-centradas">
        <button className="boton-primario grande" disabled={enviando}>
          <Icono nombre="guardar" /> {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
        {guardado && (
          <p className="aviso" role="status">
            Tus datos se guardaron.
          </p>
        )}
      </div>
    </form>
  );
}

/** Mis datos: el cliente actualiza su información personal y su foto. */
export default function MisDatos() {
  const { datos: perfil, error } = useCarga<Perfil>("/auth/yo/");
  return (
    <section>
      <h1>Mis datos</h1>
      <p className="subtitulo">Actualiza tu información personal.</p>
      {error && <p className="alerta" role="alert">{error}</p>}
      {perfil ? <Formulario perfil={perfil} /> : !error && <p className="estado">Cargando tus datos…</p>}
    </section>
  );
}
