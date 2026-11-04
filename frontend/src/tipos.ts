export interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Tienda {
  id: number;
  codigo: string;
  nombre: string;
  distrito: string;
  direccion: string;
  horario: string;
  activa: boolean;
  vendedores_activos?: number;
  /** Solo la recibe el administrador. */
  meta_mensual?: number;
}

export interface Vendedor {
  id: number;
  email: string;
  nombre: string;
  celular: string;
  tienda: number;
  tienda_codigo: string;
  tienda_nombre: string;
  is_active: boolean;
  /** Solo al crearlo sin contraseña: se muestra una vez para entregársela. */
  password_temporal?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  imagen?: string | null;
  activa?: boolean;
  total_productos?: number;
}

export interface Producto {
  id: number;
  nombre: string;
  marca: string;
  descripcion: string;
  codigo_barras: string;
  foto: string | null;
  categoria: number;
  categoria_nombre: string;
  costo?: number;
  precio: number;
  precio_oferta: number | null;
  oferta_fin: string | null;
  precio_final: number;
  marca_propia: boolean;
  activo: boolean;
  /** Unidades en la tienda elegida; solo viene cuando se consulta con ?tienda= */
  disponible?: number;
  /** Solo la recibe el administrador: suma de todas las tiendas. */
  stock_total?: number;
}

export type MedioPago = "efectivo" | "tarjeta" | "yape_plin";

export interface DetallePedido {
  producto: number;
  nombre: string;
  marca: string;
  foto: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export type EstadoPedido = "recibido" | "en_preparacion" | "listo" | "entregado" | "cancelado";

export interface Pedido {
  id: number;
  /** Solo lo recibe el cliente dueño del pedido; el vendedor lo valida al entregar sin verlo. */
  codigo_recojo?: string;
  estado: EstadoPedido;
  estado_display: string;
  cliente_nombre: string;
  cliente_celular: string;
  tienda: Tienda;
  medio_pago: MedioPago;
  medio_pago_display: string;
  /** Medio con el que realmente pagó al recoger (solo pedidos entregados). */
  pagado_con: string | null;
  total: number;
  creado: string;
  vence_en: string;
  preparado_en: string | null;
  listo_en: string | null;
  entregado_en: string | null;
  cancelado_en: string | null;
  cancelado_por: "" | "cliente" | "vendedor" | "sistema";
  cancelado_por_display: string;
  motivo_cancelacion: string;
  detalles: DetallePedido[];
}

export type EstadoOferta = "vigente" | "programada" | "vencida";

export interface Oferta {
  id: number;
  producto: number;
  producto_nombre: string;
  producto_marca: string;
  producto_foto?: string | null;
  precio_normal: number;
  precio_especial: number;
  inicio: string;
  fin: string;
  estado: EstadoOferta;
}

export interface CambioPrecio {
  id: number;
  precio_anterior: number;
  precio_nuevo: number;
  usuario_nombre: string | null;
  fecha: string;
}

export type TipoMovimiento = "reserva" | "liberacion" | "venta" | "ingreso" | "merma";

export interface MovimientoStock {
  id: number;
  tienda: number;
  producto: number;
  tipo: TipoMovimiento;
  tipo_display: string;
  cantidad: number;
  motivo: string;
  referencia: string;
  usuario: number | null;
  usuario_nombre: string | null;
  fecha: string;
  producto_nombre: string;
  tienda_codigo: string;
}

/** HU16: panel de ventas y pedidos. Montos en soles. */
export interface PanelReportes {
  filtros: { desde: string; hasta: string; tienda: number | null; descripcion: string };
  resumen: {
    ventas: number;
    total: number;
    ticket_promedio: number;
    pedidos: number;
    pedidos_entregados: number;
    pedidos_cancelados: number;
    minutos_preparacion: number | null;
  };
  por_canal: { canal: "caja" | "web"; canal_display: string; ventas: number; total: number; ticket_promedio: number }[];
  por_tienda: {
    tienda: number;
    codigo: string;
    nombre: string;
    ventas: number;
    total: number;
    caja: number;
    web: number;
    ticket_promedio: number;
    pedidos: number;
    minutos_preparacion: number | null;
    variacion: number | null;
  }[];
  variacion: Record<"total" | "ventas" | "pedidos" | "clientes" | "ticket_promedio", number | null>;
  clientes_unicos: number;
  por_categoria: { categoria: string; total: number; porcentaje: number }[];
  por_vendedor: { vendedor: string; tienda: string; ventas: number; total: number; ticket_promedio: number }[];
  ofertas: {
    oferta: number;
    producto: string;
    marca: string;
    precio_normal: number;
    precio_especial: number;
    inicio: string;
    fin: string;
    estado: EstadoOferta;
    unidades: number;
    total: number;
  }[];
  por_dia: { fecha: string; caja: number; web: number }[];
  por_estado: { estado: EstadoPedido; estado_display: string; pedidos: number }[];
  top_productos: { producto: number; nombre: string; marca: string; unidades: number; total: number }[];
}

/** Línea de una venta, con lo que aún se puede devolver. */
export interface DetalleVenta {
  id: number;
  producto: number;
  producto_nombre: string;
  producto_marca: string;
  producto_foto: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  devuelto: number;
  disponible_devolver: number;
}

export type EstadoVenta = "completada" | "devolucion_parcial" | "devuelta";

export interface Venta {
  id: number;
  vendedor_nombre: string;
  fecha: string;
  total: number;
  medio_pago: MedioPago;
  medio_pago_display: string;
  numero_ticket: string;
  canal: "caja" | "web";
  canal_display: string;
  detalles: DetalleVenta[];
  monto_recibido: number | null;
  vuelto: number | null;
  /** Solo las ventas de pedidos online tienen cliente registrado. */
  cliente_nombre: string | null;
  cliente_celular: string | null;
  estado: EstadoVenta;
  estado_nombre: string;
}

export interface FilaInventario {
  id: number;
  producto: number;
  nombre: string;
  marca: string;
  codigo_barras: string;
  foto: string | null;
  categoria: number;
  categoria_nombre: string;
  precio_final: number;
  cantidad: number;
  reservado: number;
  stock_minimo: number;
  fecha_vencimiento: string | null;
  estado: "disponible" | "bajo_stock" | "agotado";
}

export interface PanelInventario extends Paginado<FilaInventario> {
  total_tienda: number;
  categorias: { id: number; nombre: string; productos: number }[];
}

export interface TurnoCaja {
  inicio: string;
  fin: string;
  ventas: number;
  unidades: number;
  total: number;
  ticket_mas_alto: number | null;
  ticket_mas_alto_numero: string | null;
  medios: { medio: MedioPago; medio_display: string; total: number; porcentaje: number }[];
  ventas_efectivo: number;
  devoluciones_efectivo: number;
  efectivo_esperado: number;
  variacion: { total: number | null; ventas: number | null; unidades: number | null };
}

export interface PanelTienda {
  dias: number;
  resumen: { ventas: number; tickets: number; ticket_promedio: number; pedidos: number; unidades: number };
  variacion: Record<"ventas" | "tickets" | "ticket_promedio" | "pedidos" | "unidades", number | null>;
  por_dia: { fecha: string; total: number }[];
  top_productos: { producto: number; nombre: string; marca: string; unidades: number; total: number; porcentaje: number }[];
  vendedores: { vendedor: string; total: number }[];
  metas: { nombre: string; meta: number; actual: number; cumplida: boolean }[];
}
