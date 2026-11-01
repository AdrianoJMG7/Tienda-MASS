/** HU06: disponibilidad del producto en la tienda elegida. */
export default function Disponibilidad({ unidades }: { unidades: number | null | undefined }) {
  if (unidades == null) return null;
  if (unidades === 0) return <span className="disponibilidad agotado">Agotado en esta tienda</span>;
  if (unidades <= 5) return <span className="disponibilidad pocas">Quedan {unidades}</span>;
  return <span className="disponibilidad hay">Disponible</span>;
}
