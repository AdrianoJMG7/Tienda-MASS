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
}

export interface Categoria {
  id: number;
  nombre: string;
  total_productos?: number;
}

export interface Producto {
  id: number;
  nombre: string;
  marca: string;
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

export type CanalVenta = "caja" | "web";

export interface DetalleVenta {
  id: number;
  producto: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Venta {
  id: number;
  tienda: number;
  tienda_codigo: string;
  vendedor: number;
  vendedor_nombre: string;
  fecha: string;
  total: number;
  medio_pago: MedioPago;
  numero_ticket: string | null;
  canal: CanalVenta;
  pedido: number | null;
  detalles: DetalleVenta[];
  vuelto: number | null;
}

export interface ItemVenta {
  producto: number;
  cantidad: number;
}

export interface Stock {
  id: number;
  tienda: number;
  producto: number;
  cantidad: number;
  reservado: number;
  stock_minimo: number;
  fecha_vencimiento: string | null;
  producto_nombre: string;
  tienda_codigo: string;
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

export interface AlertaStock {
  producto: number;
  producto_nombre: string;
  cantidad: number;
  stock_minimo?: number;
  fecha_vencimiento?: string;
  dias_para_vencer?: number;
}

export interface AlertasResponse {
  bajo_stock: AlertaStock[];
  por_vencer: AlertaStock[];
  resumen: {
    bajo_stock_count: number;
    por_vencer_count: number;
  };
}

export interface ItemIngreso {
  producto: number;
  cantidad: number;
  fecha_vencimiento?: string;
  motivo?: string;
}

export interface ItemMerma {
  producto: number;
  cantidad: number;
  motivo: "vencido" | "dañado";
  nota?: string;
}
