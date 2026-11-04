import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { guardarTokens, patch, post, type Usuario } from "../../api";
import { useSesion } from "../../auth";
import Campo from "../../componentes/Campo";
import Dialogo from "../../componentes/Dialogo";
import EncabezadoPagina from "../../componentes/EncabezadoPagina";
import Icono from "../../componentes/Icono";
import { formatoFechaHora } from "../../formato";
import type { Tienda } from "../../tipos";
import { useCarga, useEnvio } from "../../useCarga";

interface Perfil extends Usuario {
  rol_display: string;
  tienda_info: Tienda | null;
}

interface Sesion {
  id: number;
  dispositivo: string;
  fecha: string;
}

const FOTO_MAX = 2 * 1024 * 1024;

function EditarPerfil({ perfil, alGuardar }: { perfil: Perfil; alGuardar: (nuevo: Perfil) => void }) {
  const [nombre, setNombre] = useState(perfil.nombre);
  const [celular, setCelular] = useState(perfil.celular);
  const { errores, general, enviando, enviar } = useEnvio();

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    await enviar(async () => alGuardar(await patch<Perfil>("/auth/yo/", { nombre, celular })));
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Nombres y apellidos" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoComplete="name" required />
      <Campo etiqueta="Celular" type="tel" inputMode="numeric" value={celular} onChange={(e) => setCelular(e.target.value)} error={errores.celular} autoComplete="tel" />
      <button className="boton-primario ancho" disabled={enviando}>
        <Icono nombre="guardar" /> {enviando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function CambiarPassword({ alTerminar }: { alTerminar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const { errores, general, enviando, enviar } = useEnvio();
  const noCoinciden = repetida !== "" && nueva !== repetida;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await enviar(async () => {
      // Las demás sesiones se cierran; esta sigue activa con tokens nuevos.
      guardarTokens(await post<{ access: string; refresh: string }>("/auth/cambiar-password/", { actual, nueva }));
    });
    if (ok) alTerminar();
  }

  return (
    <form onSubmit={guardar} noValidate>
      {general && !Object.keys(errores).length && <p className="alerta" role="alert">{general}</p>}
      <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} error={errores.actual} required />
      <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} error={errores.nueva} required />
      <Campo etiqueta="Repite la contraseña nueva" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} error={noCoinciden ? "Las contraseñas no coinciden." : undefined} required />
      <p className="ayuda">Al cambiarla se cerrarán tus sesiones en otros dispositivos.</p>
      <button className="boton-primario ancho" disabled={enviando || !actual || !nueva || nueva !== repetida}>
        <Icono nombre="candado" /> {enviando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

/** Mi perfil del vendedor: datos, foto, contraseña, tienda asignada y últimos accesos. */
export default function MiPerfil() {
  const { salir, actualizar } = useSesion();
  const navegar = useNavigate();
  const { datos, error, recargar } = useCarga<Perfil>("/auth/yo/");
  const { datos: sesiones } = useCarga<Sesion[]>("/auth/sesiones/");
  const [dialogo, setDialogo] = useState<"" | "perfil" | "password">("");
  const [aviso, setAviso] = useState("");
  const [errorFoto, setErrorFoto] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  if (error) return <p className="alerta" role="alert">{error}</p>;
  if (!datos) return <p className="estado">Cargando tu perfil…</p>;
  const tienda = datos.tienda_info;

  async function cambiarFoto(elegido: File | undefined) {
    setErrorFoto("");
    if (!elegido) return;
    if (!["image/jpeg", "image/png"].includes(elegido.type)) return setErrorFoto("La foto debe ser JPG o PNG.");
    if (elegido.size > FOTO_MAX) return setErrorFoto("La foto no debe pesar más de 2 MB.");
    const cuerpo = new FormData();
    cuerpo.append("foto", elegido);
    try {
      actualizar(await patch<Usuario>("/auth/yo/", cuerpo));
      recargar();
    } catch {
      setErrorFoto("No se pudo guardar la foto.");
    }
  }

  async function cerrarSesion() {
    await salir();
    navegar("/ingresar");
  }

  return (
    <section className="pagina-perfil">
      <EncabezadoPagina icono="usuario" titulo="Mi perfil" subtitulo="Gestiona tu información personal." />
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      <div className="perfil-cuerpo">
        <div className="tarjeta perfil-datos">
          <div className="perfil-foto">
            <div className="foto-perfil-imagen">
              {datos.foto ? <img src={datos.foto} alt="Tu foto de perfil" /> : <Icono nombre="usuario" tamano={96} />}
              <button type="button" className="boton-icono flotante" aria-label="Cambiar foto" onClick={() => archivo.current?.click()}>
                <Icono nombre="camara" />
              </button>
            </div>
            <input ref={archivo} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => void cambiarFoto(e.target.files?.[0])} />
            <button type="button" className="boton-contorno pequeno" onClick={() => archivo.current?.click()}>
              <Icono nombre="camara" tamano={18} /> Cambiar foto
            </button>
            {errorFoto && <p className="error-campo" role="alert">{errorFoto}</p>}
          </div>
          <div className="perfil-info">
            <div className="perfil-nombre">
              <h2>{datos.nombre}</h2>
              <button type="button" className="boton-contorno pequeno" onClick={() => setDialogo("perfil")}>
                <Icono nombre="lapiz" tamano={18} /> Editar perfil
              </button>
            </div>
            <p className="con-icono"><Icono nombre="correo" /> {datos.email}</p>
            <p className="con-icono"><Icono nombre="telefono" /> {datos.celular || "Sin celular registrado"}</p>
            <p className="con-icono"><Icono nombre="usuario" /> {datos.rol_display}</p>
            {tienda && <p className="con-icono"><Icono nombre="tienda" /> Tienda {tienda.codigo} - {tienda.nombre}</p>}
            <button type="button" className="boton-contorno ancho" onClick={() => setDialogo("password")}>
              <Icono nombre="candado" /> Cambiar contraseña
            </button>
          </div>
        </div>

        {tienda && (
          <div className="tarjeta perfil-tienda">
            <div className="perfil-tienda-titulo">
              <h2 className="con-icono"><Icono nombre="tienda" tamano={32} /> Mi tienda</h2>
              <span className={`insignia-venta ${tienda.activa ? "completada" : "devuelta"}`}>
                <Icono nombre={tienda.activa ? "check" : "prohibir"} tamano={16} /> {tienda.activa ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="perfil-tienda-cuerpo">
              <span className="foto-tienda grande" aria-hidden="true">
                <Icono nombre="tienda" tamano={56} />
                <span>Mass</span>
              </span>
              <div>
                <h3>{tienda.codigo}</h3>
                <p className="perfil-tienda-nombre">{tienda.nombre}</p>
                <p className="con-icono"><Icono nombre="ubicacion" tamano={18} /> {tienda.direccion}</p>
                <p className="con-icono"><Icono nombre="etiqueta" tamano={18} /> {tienda.distrito}</p>
                <p className="con-icono"><Icono nombre="reloj" tamano={18} /> {tienda.horario}</p>
              </div>
            </div>
          </div>
        )}

        <div className="tarjeta perfil-sesiones">
          <h2 className="con-icono titulo-tarjeta"><Icono nombre="historial" tamano={30} /> Sesiones recientes</h2>
          <p className="subtitulo">Últimos accesos a tu cuenta.</p>
          <table className="tabla tabla-vendedor">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Dispositivo / Navegador</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sesiones?.map((s, i) => (
                <tr key={s.id}>
                  <td data-titulo="Fecha y hora">{formatoFechaHora(s.fecha)}</td>
                  <td data-titulo="Dispositivo">{s.dispositivo}</td>
                  <td data-titulo="Estado">
                    <span className={`insignia-venta ${i === 0 ? "completada" : "anterior"}`}>{i === 0 ? "Última" : "Anterior"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sesiones?.length === 0 && <p className="dato-secundario">Tus próximos accesos aparecerán aquí.</p>}
        </div>

        <div className="tarjeta perfil-acciones">
          <h2 className="con-icono titulo-tarjeta"><Icono nombre="escudo" tamano={30} /> Acciones</h2>
          <button type="button" className="boton-primario ancho grande" onClick={cerrarSesion}>
            <Icono nombre="salir" /> Cerrar sesión
          </button>
          <Link to="/privacidad" className="boton-contorno ancho grande">
            <Icono nombre="documento" /> Política de privacidad
          </Link>
        </div>
      </div>

      <Dialogo titulo="Editar perfil" abierto={dialogo === "perfil"} alCerrar={() => setDialogo("")}>
        <EditarPerfil
          perfil={datos}
          alGuardar={(nuevo) => {
            actualizar(nuevo);
            recargar();
            setDialogo("");
            setAviso("Tus datos se guardaron.");
          }}
        />
      </Dialogo>
      <Dialogo titulo="Cambiar contraseña" abierto={dialogo === "password"} alCerrar={() => setDialogo("")}>
        <CambiarPassword
          alTerminar={() => {
            setDialogo("");
            setAviso("Tu contraseña se cambió. Se cerraron tus sesiones en otros dispositivos.");
          }}
        />
      </Dialogo>
    </section>
  );
}
