import type { Producto } from "../tipos";

/** Foto del producto o, si no tiene, la inicial de su nombre. */
export default function FotoProducto({ producto, tamano = 48 }: { producto: Pick<Producto, "foto" | "nombre">; tamano?: number }) {
  return producto.foto ? (
    <img className="foto-producto" src={producto.foto} alt="" width={tamano} height={tamano} loading="lazy" />
  ) : (
    <span className="foto-producto vacia" style={{ width: tamano, height: tamano, fontSize: tamano * 0.4 }} aria-hidden="true">
      {producto.nombre.charAt(0)}
    </span>
  );
}
