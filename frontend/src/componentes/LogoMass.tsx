/** Logotipo: la palabra «Mass» en itálica gruesa seguida del check, en el azul de la marca. */
export default function LogoMass({ tamano = 28 }: { tamano?: number }) {
  return (
    <span className="logo-mass" style={{ fontSize: tamano }} aria-label="Mass" role="img">
      <span aria-hidden="true">Mass</span>
      <svg aria-hidden="true" viewBox="0 0 60 36" width={tamano * 1.15} height={tamano * 0.7}>
        <path
          d="M3 17c3-1.5 5.5-1 7.2 2.2L15 28.5C24 16 38 6 58 2c-17 6.5-30 18-39.5 32-1.6 2.3-4.7 2.2-5.8-.4L6.6 21.5C5.7 19.6 4.6 18.5 3 17z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
