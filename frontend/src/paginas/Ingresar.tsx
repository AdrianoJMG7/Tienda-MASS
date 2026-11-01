import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ErrorApi } from "../api";
import { destinoTrasIngresar, useSesion } from "../auth";
import Campo from "../componentes/Campo";

const CUENTAS_DEMO = [
  { rol: "Administradora", email: "admin@mass.test" },
  { rol: "Vendedor (T-003)", email: "luis@mass.test" },
  { rol: "Cliente", email: "rocio@correo.pe" },
];

export default function Ingresar() {
  const { usuario, ingresar } = useSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destinoTrasIngresar(usuario.rol, desde)} replace />;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const u = await ingresar(email, password);
      navegar(destinoTrasIngresar(u.rol, desde), { replace: true });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta formulario">
      <h1>Ingresar</h1>
      <form onSubmit={enviar} noValidate>
        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="boton ancho" disabled={enviando || !email || !password}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
      <p className="texto-centro">
        ¿No tienes cuenta?{" "}
        <Link to="/registro" state={desde ? { desde } : undefined}>
          Créala aquí
        </Link>
      </p>
      <details className="demo">
        <summary>Cuentas demo (contraseña Demo1234!)</summary>
        <ul>
          {CUENTAS_DEMO.map((c) => (
            <li key={c.email}>
              <button
                type="button"
                className="enlace"
                onClick={() => {
                  setEmail(c.email);
                  setPassword("Demo1234!");
                }}
              >
                {c.rol}: {c.email}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
