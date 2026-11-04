/** Ilustración decorativa: canasta azul de Mass con abarrotes. */
export default function Canasta({ ancho = 240 }: { ancho?: number }) {
  return (
    <svg className="canasta" viewBox="0 0 240 200" width={ancho} height={(ancho * 200) / 240} aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="120" rx="112" ry="72" fill="#e7ebfa" />
      {/* Destellos */}
      <g stroke="#ffd101" strokeWidth="7" strokeLinecap="round">
        <path d="M206 44l10-14M212 64l18-6M210 84l16 4" />
      </g>
      {/* Lechuga */}
      <circle cx="70" cy="78" r="24" fill="#3f9b3a" />
      <circle cx="88" cy="66" r="20" fill="#56b74b" />
      <circle cx="58" cy="62" r="16" fill="#6cc65f" />
      {/* Botella */}
      <rect x="104" y="30" width="22" height="56" rx="8" fill="#c7643a" />
      <rect x="109" y="20" width="12" height="14" rx="3" fill="#2f6d34" />
      {/* Caja de leche */}
      <path d="M140 40h36v58h-36z" fill="#ffffff" stroke="#9bb3ef" strokeWidth="3" />
      <path d="M140 40l8-14h20l8 14z" fill="#3a6fe0" />
      <rect x="146" y="56" width="24" height="14" rx="3" fill="#3a6fe0" />
      {/* Manzana y plátanos */}
      <circle cx="118" cy="88" r="15" fill="#e0342b" />
      <path d="M78 92c18 16 50 18 70 4-6 14-46 20-70-4z" fill="#ffd101" stroke="#e6bc00" strokeWidth="2" />
      {/* Canasta */}
      <path d="M38 92h164l-16 86H54z" fill="#092db5" />
      <path d="M38 92h164" stroke="#061f80" strokeWidth="10" strokeLinecap="round" />
      <g fill="#061f80">
        <rect x="62" y="108" width="9" height="56" rx="4" />
        <rect x="80" y="108" width="9" height="56" rx="4" />
      </g>
      <text x="152" y="150" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontStyle="italic" fontSize="28" fill="#ffd101">
        Mass
      </text>
      <path d="M190 132l5 6 12-16" stroke="#ffd101" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
