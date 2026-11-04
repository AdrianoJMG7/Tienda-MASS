import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ErrorApi } from "../api";
import { destinoTrasIngresar, useSesion } from "../auth";
import Canasta from "../componentes/Canasta";
import Icono from "../componentes/Icono";

const CUENTAS_DEMO = [
  { rol: "Administrador", email: "admin@mass.test", password: "Admin1234" },
  { rol: "Vendedor (T-001)", email: "vendedor1@mass.test", password: "Vendedor1234" },
  { rol: "Cliente", email: "cliente@mass.test", password: "Cliente1234" },
];

const BENEFICIOS = ["Compra más rápido", "Guarda tus productos favoritos", "Revisa tu historial de pedidos"];

export default function Ingresar() {
  const { usuario, ingresar } = useSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destinoTrasIngresar(usuario.rol, desde)} replace />;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const u = await ingresar(email, password, recordar);
      navegar(destinoTrasIngresar(u.rol, desde), { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  const registro = <Link to="/registro" state={desde ? { desde } : undefined} className="boton-contorno ancho">Crear una cuenta</Link>;

  return (
    <section className="tarjeta pantalla-ingreso">
      <div className="ingreso-formulario">
        <h1>Bienvenido a Mass</h1>
        <p className="subtitulo">Ingresa a tu cuenta para disfrutar de nuestras ofertas.</p>
        <form onSubmit={enviar} noValidate>
          {error && (
            <p className="alerta" role="alert">
              {error}
            </p>
          )}
          <div className="campo">
            <label htmlFor="email" className="solo-lector">
              Correo electrónico
            </label>
            <div className="entrada-icono grande">
              <Icono nombre="correo" tamano={22} />
              <input id="email" type="email" autoComplete="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="password" className="solo-lector">
              Contraseña
            </label>
            <div className="entrada-icono grande">
              <Icono nombre="candado" tamano={22} />
              <input
                id="password"
                type={verPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="ver-password" aria-pressed={verPassword} aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVerPassword(!verPassword)}>
                <Icono nombre={verPassword ? "ojoTachado" : "ojo"} tamano={22} />
              </button>
            </div>
          </div>
          <div className="campo casilla">
            <input id="recordar" type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            <label htmlFor="recordar">Recordarme en este dispositivo</label>
          </div>
          <button className="boton-primario ancho grande" disabled={enviando || !email || !password}>
            {enviando ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
        <p className="separador-o" aria-hidden="true">
          <span>o</span>
        </p>
        {registro}
        <details className="demo">
          <summary>Cuentas demo</summary>
          <ul>
            {CUENTAS_DEMO.map((c) => (
              <li key={c.email}>
                <button
                  type="button"
                  className="enlace"
                  onClick={() => {
                    setEmail(c.email);
                    setPassword(c.password);
                  }}
                >
                  {c.rol}: {c.email}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="ingreso-invitacion">
        <Canasta ancho={260} />
        <h2>¿Aún no tienes cuenta?</h2>
        <p className="subtitulo">Regístrate y disfruta de grandes beneficios.</p>
        <ul className="lista-beneficios">
          {BENEFICIOS.map((b) => (
            <li key={b}>
              <span className="check-circulo" aria-hidden="true">
                <Icono nombre="check" tamano={16} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <Link to="/registro" state={desde ? { desde } : undefined} className="boton-primario ancho grande">
          Crear una cuenta
        </Link>
      </div>
    </section>
  );
}
