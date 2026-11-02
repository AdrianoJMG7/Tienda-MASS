# Mass

Página web responsiva de compra online con recojo en tienda, ventas en caja e inventario por tienda, con tres roles: administrador, vendedor y cliente.

> **Propuesta académica con datos simulados.** El proyecto se presenta como propuesta a Tiendas Mass (InRetail) y usa su nombre y colores para la demo, pero no es el sitio oficial ni está afiliado a la empresa, y no contiene información interna. Las tiendas, personas, marcas de productos y cifras son ficticias.

Equipo: Oder, Adriano y Daniel. Ingeniería de Sistemas, Lima 2026.

## Avance

| Historia | Descripción | Estado |
|---|---|---|
| HU01 | Caso Mass (5 tiendas piloto simuladas, cuentas demo) y proyecto base Django REST + React | Hecho |
| HU02 | Registro de cliente: bcrypt, email único, aceptación de la política de privacidad (Ley 29733), mensajes claros | Hecho |
| HU03 | Inicio y cierre de sesión con JWT; cada rol ve solo su menú; permisos validados en el servidor | Hecho |
| HU04 | Tiendas (código, distrito, dirección, horario, estado) y vendedores asignados a una tienda; desactivar sin borrar | Hecho |
| HU05 | Catálogo central: productos con foto, costo, precio y marca propia; ofertas con fechas; historial de precios con fecha y usuario; carga de 800 productos | Hecho |
| HU06 | Catálogo público sin iniciar sesión: búsqueda, filtros, ofertas de la semana y disponibilidad en la tienda elegida | Hecho |
| HU07 | Carrito que se conserva al cerrar la página, tienda de recojo con dirección y horario, aviso de stock insuficiente | Hecho |
| HU08 | Confirmar pedido (solo clientes): código de recojo de 6 caracteres, medio de pago al recoger y correo con el resumen | Hecho |
| HU09 | Reservar stock del pedido al confirmar; liberar si se cancela o vence (48 horas) | Hecho |
| HU10 | Gestionar pedidos de la tienda: lista por estado, preparar, marcar listo, entregar y cancelar | Hecho |
| HU11 | Consultar estado e historial de pedidos del cliente; cancelar pedidos pendientes | Hecho |
| HU12 | Registrar venta en caja: agregar productos, calcular total, medios de pago con vuelto | Hecho |
| HU13 | Escanear código de barras: escanear QR con cámara o código de barras con escáner USB para agregar productos a la venta sin buscar | Hecho |
| HU14 | Consultar stock y alertas: stock disponible y reservado, alertas de stock bajo y vencimiento en 7 días | Hecho |
| HU15 | Registrar ingresos y mermas: ingreso con cantidad y vencimiento, merma con motivo (vencido/dañado), historial de movimientos | Hecho |
| HU16 a HU20 | Sprints 4 y 5 (reportes, diseño responsivo y demo) | Pendiente |

## Tecnologías

- **Backend:** Python 3.13, Django 6.1, Django REST Framework, SimpleJWT, bcrypt, drf-spectacular (OpenAPI)
- **Frontend:** React 19, Vite, TypeScript, React Router; CSS mobile first (360, 768 y 1280 px)
- **Base de datos:** SQLite en desarrollo, PostgreSQL en producción (`DATABASE_URL`)
- **Calidad:** pruebas de Django, oxlint, GitHub Actions

```
MASS/
├── backend/
│   ├── config/      configuración y rutas
│   ├── core/        roles, permisos, inicio por rol y comando cargar_demo
│   ├── cuentas/     usuario, registro, login, logout (HU02, HU03) y vendedores (HU04)
│   ├── tiendas/     tiendas (HU04)
│   ├── catalogo/    categorías, productos, ofertas, historial de precios y cargar_catalogo (HU05, HU06)
│   ├── inventario/  stock por tienda y cargar_stock (HU09, HU12)
│   ├── pedidos/     pedidos para recoger, código de recojo, correo (HU08) y gestión (HU10, HU11)
│   └── venta/       ventas en caja con descuento de stock (HU12)
└── frontend/
    └── src/
        ├── api.ts         cliente HTTP con JWT y renovación del token
        ├── auth.tsx       sesión del usuario
        ├── carrito.tsx    carrito guardado en el navegador (HU07)
        ├── componentes/   logo, campos, diálogo, paginación
        └── paginas/       Ingresar, Registro, Privacidad, InicioRol
            ├── admin/     Tiendas, Vendedores, Productos, Ofertas, Categorías
            ├── tienda/    Catálogo, Carrito, Confirmar, PedidoConfirmado, MisPedidos
            └── vendedor/  PedidosTienda, Caja
```

## Cómo ejecutarlo

Requisitos: Python 3.12 o superior y Node 20 o superior.

**Backend** (en `backend/`):

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py cargar_demo     # 5 tiendas, cuentas demo, 800 productos y su stock
python manage.py runserver
```

**Frontend** (en `frontend/`, en otra terminal):

```bash
npm install
npm run dev
```

Abre http://localhost:5173. En desarrollo Vite reenvía `/api` y `/media` a Django (puerto 8000). Al desplegar, se define `VITE_API_URL` con la URL de la API.

## Cuentas demo

Todas usan la contraseña `Demo1234!`. Los correos usan el dominio reservado `mass.test`, que no recibe correo real.

| Rol | Email | Tienda |
|---|---|---|
| Administradora (Patricia) | admin@mass.test | Todas |
| Vendedor (Luis) | luis@mass.test | T-003 Los Olivos |
| Vendedores | vendedor.t001@mass.test … vendedor.t005@mass.test | T-001, T-002, T-004, T-005 |
| Cliente (Rocío) | rocio@correo.pe | — |

## API

La documentación interactiva está en http://localhost:8000/api/docs/ (Swagger/OpenAPI).

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| POST | `/api/auth/registro/` | Público | Crear cuenta de cliente |
| POST | `/api/auth/login/` | Público | Devuelve `access`, `refresh` y el usuario con su rol |
| POST | `/api/auth/refresh/` | Público | Renueva el token |
| POST | `/api/auth/logout/` | Con sesión | Invalida el `refresh` |
| GET | `/api/auth/yo/` | Con sesión | Datos del usuario |
| GET | `/api/inicio/{admin,vendedor,cliente}/` | Solo ese rol | Menú del rol (403 para los demás) |
| GET | `/api/tiendas/` | Público | Tiendas activas (el administrador ve todas) |
| POST, PATCH | `/api/tiendas/` | Administrador | Registrar y editar tiendas; `{"activa": false}` la desactiva |
| CRUD | `/api/vendedores/` | Administrador | Vendedores; DELETE desactiva la cuenta |
| CRUD | `/api/categorias/` | Lectura pública | Categorías; solo se eliminan si no tienen productos |
| GET | `/api/productos/` | Público | Catálogo con filtros `q`, `categoria`, `marca_propia`, `en_oferta`, `precio_min`, `precio_max`, `orden`; con `tienda` agrega `disponible` (y `con_stock`); `ids` para el carrito |
| POST, PATCH | `/api/productos/` | Administrador | Crear y editar (JSON o multipart con `foto`) |
| GET | `/api/productos/{id}/historial/` | Administrador | Cambios de precio con fecha y usuario |
| CRUD | `/api/ofertas/` | Administrador | Ofertas; filtro `estado` = vigente, programada o vencida |
| POST | `/api/pedidos/` | Cliente | Confirmar pedido `{tienda, medio_pago, items: [{producto, cantidad}]}`; 409 si falta stock |
| GET | `/api/pedidos/`, `/api/pedidos/{id}/` | Con sesión | El cliente ve los suyos; el vendedor, los de su tienda; el administrador, todos |
| POST | `/api/pedidos/{id}/cancelar/` | Cliente/Vendedor | Cancelar pedido con motivo; libera el stock reservado |
| POST | `/api/ventas/crear/` | Vendedor | Registrar venta en caja `{medio_pago, monto_recibido, items: [{producto, cantidad}]}`; descuenta stock |
| GET | `/api/ventas/` | Vendedor/Admin | Ventas de la tienda (vendedor) o todas (admin) |
| GET | `/api/inventario/inventario/` | Vendedor | Stock de la tienda con filtros `q`, `categoria`, `estado` (bajo_stock, por_vencer) |
| GET | `/api/inventario/inventario/alertas/` | Vendedor | Alertas de stock bajo y productos por vencer en 7 días |
| GET | `/api/inventario/movimientos/` | Vendedor/Admin | Historial de movimientos de stock de la tienda (vendedor) o todas (admin) |
| POST | `/api/inventario/inventario/ingreso/` | Vendedor | Registrar ingreso `[{producto, cantidad, fecha_vencimiento?, motivo?}]` |
| POST | `/api/inventario/inventario/merma/` | Vendedor | Registrar merma `[{producto, cantidad, motivo: vencido/dañado, nota?}]` |

## Pruebas

```bash
cd backend && python manage.py test      # 50 pruebas de HU02 a HU08
cd frontend && npm run lint && npm run build
```

GitHub Actions ejecuta lo mismo en cada pull request (`.github/workflows/ci.yml`).

## Flujo de trabajo

- Una rama por historia (por ejemplo `feature/hu04-tiendas-vendedores`) que sale de la rama del sprint.
- Los cambios entran por pull request revisado por otro integrante, con las pruebas en verde.
- Una historia está terminada cuando cumple sus criterios de aceptación, tiene pruebas, se ve bien en celular, tablet y computadora, fue revisada y está desplegada.
