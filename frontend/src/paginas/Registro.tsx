import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ErrorApi } from "../api";
import { destinoTrasIngresar, useSesion } from "../auth";
import Campo from "../componentes/Campo";

const VACIO = { nombre: "", email: "", celular: "", password: "", confirmar: "" };
type Datos = typeof VACIO;

/** Validación en el navegador para avisar antes de enviar; el servidor valida lo mismo. */
function validar(d: Datos, acepta: boolean) {
  const errores: Record<string, string> = {};
  if (d.nombre.trim().length < 3) errores.nombre = "Escribe tu nombre completo.";
  if (!/^\S+@\S+\.\S+$/.test(d.email)) errores.email = "Ingresa un email válido.";
  if (!/^9\d{8}$/.test(d.celular.replace(/\s/g, ""))) errores.celular = "Ingresa un celular de 9 dígitos que empiece con 9.";
  if (d.password.length < 8) errores.password = "La contraseña debe tener al menos 8 caracteres.";
  else if (/^\d+$/.test(d.password)) errores.password = "La contraseña no puede tener solo números.";
  if (d.confirmar !== d.password) errores.confirmar = "Las contraseñas no coinciden.";
  if (!acepta) errores.acepta_privacidad = "Debes aceptar la política de privacidad.";
  return errores;
}

export default function Registro() {
  const { usuario, registrarse } = useSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;
  const [datos, setDatos] = useState(VACIO);
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destinoTrasIngresar(usuario.rol, desde)} replace />;

  const cambiar = (campo: keyof Datos) => (e: ChangeEvent<HTMLInputElement>) =>
    setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGeneral("");
    const encontrados = validar(datos, acepta);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const { confirmar: _, ...resto } = datos;
      await registrarse({ ...resto, celular: resto.celular.replace(/\s/g, ""), acepta_privacidad: acepta });
      navegar(destinoTrasIngresar("cliente", desde), { replace: true });
    } catch (e) {
      if (e instanceof ErrorApi) {
        setErrores(e.campos);
        setGeneral(e.message);
      } else {
        setGeneral("No se pudo crear la cuenta.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta formulario">
      <h1>Crear cuenta</h1>
      <p className="subtitulo">Regístrate para pedir online y recoger en tu tienda.</p>
      <form onSubmit={enviar} noValidate>
        {general && (
          <p className="alerta" role="alert">
            {general}
          </p>
        )}
        <Campo etiqueta="Nombre completo" autoComplete="name" value={datos.nombre} onChange={cambiar("nombre")} error={errores.nombre} />
        <Campo etiqueta="Email" type="email" autoComplete="email" value={datos.email} onChange={cambiar("email")} error={errores.email} />
        <Campo
          etiqueta="Celular"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9XXXXXXXX"
          value={datos.celular}
          onChange={cambiar("celular")}
          error={errores.celular}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          value={datos.password}
          onChange={cambiar("password")}
          error={errores.password}
          ayuda="Mínimo 8 caracteres, que no sean solo números."
        />
        <Campo
          etiqueta="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={datos.confirmar}
          onChange={cambiar("confirmar")}
          error={errores.confirmar}
        />
        <div className="campo casilla">
          <input
            id="acepta"
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            aria-invalid={errores.acepta_privacidad ? true : undefined}
            aria-describedby={errores.acepta_privacidad ? "acepta-error" : undefined}
          />
          <label htmlFor="acepta">
            Acepto la <Link to="/privacidad" target="_blank">política de privacidad</Link> y el tratamiento de mis
            datos según la Ley 29733.
          </label>
          {errores.acepta_privacidad && (
            <p id="acepta-error" className="error-campo">
              {errores.acepta_privacidad}
            </p>
          )}
        </div>
        <button className="boton ancho" disabled={enviando}>
          {enviando ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p className="texto-centro">
        ¿Ya tienes cuenta?{" "}
        <Link to="/ingresar" state={desde ? { desde } : undefined}>
          Ingresa
        </Link>
      </p>
    </section>
  );
}
