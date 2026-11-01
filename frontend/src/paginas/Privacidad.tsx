export default function Privacidad() {
  return (
    <article className="tarjeta texto">
      <h1>Política de privacidad</h1>
      <p>
        Este sitio es un prototipo académico presentado como propuesta a Mass. Los datos que registras se usan solo para gestionar tu cuenta y tus
        pedidos, conforme a la Ley 29733 de Protección de Datos Personales del Perú.
      </p>
      <h2>Qué datos pedimos</h2>
      <p>Nombre, email y celular. Tu contraseña se guarda cifrada (bcrypt) y nadie puede leerla.</p>
      <h2>Para qué los usamos</h2>
      <p>Para identificarte al iniciar sesión, avisarte del estado de tus pedidos y contactarte sobre tu recojo.</p>
      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceder, corregir o eliminar tus datos escribiendo al equipo del proyecto. No compartimos tus
        datos con terceros.
      </p>
    </article>
  );
}
