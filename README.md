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
| HU16 | Panel de ventas y pedidos: ventas por tienda y canal con ticket promedio, pedidos por estado, tiempo de preparación y productos más vendidos, filtrable por periodo y tienda | Hecho |
| HU17 | Exportar reportes a Excel o PDF respetando los filtros del panel | Hecho |
| HU18 | Simular operación y validar usabilidad: script de 1 mes de datos (ventas, pedidos, ingresos, mermas), protocolo de pruebas para 6 usuarios, reporte PDF con gráficos de tiempo por tarea | Hecho |
| HU19 | Verificar diseño responsivo y PWA: diseño adaptable (360, 768, 1280px), puntaje Lighthouse 90+, instalable como PWA | Hecho |
| HU20 | Preparar demo y presentación para Mass: cuentas demo, API documentada, video demo y presentación | Hecho |

## Tecnologías

- **Backend:** Python 3.13, Django 6.1, Django REST Framework, SimpleJWT, bcrypt, drf-spectacular (OpenAPI)
- **Frontend:** React 19, Vite, TypeScript, React Router; CSS mobile first (360, 768 y 1280 px)
- **Base de datos:** SQLite en desarrollo, PostgreSQL en producción (variables `DB_*`, ver `backend/.env.example`)
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
│   ├── venta/       ventas en caja con descuento de stock (HU12)
│   └── reporte/     panel de ventas y pedidos, exportación y simular_ventas (HU16, HU17)
└── frontend/
    └── src/
        ├── api.ts         cliente HTTP con JWT y renovación del token
        ├── auth.tsx       sesión del usuario
        ├── carrito.tsx    carrito guardado en el navegador (HU07)
        ├── componentes/   logo, campos, diálogo, paginación
        └── paginas/       Ingresar, Registro, Privacidad, InicioRol
            ├── admin/     Tiendas, Vendedores, Productos, Ofertas, Categorías, Reportes
            ├── tienda/    Catálogo, Carrito, Confirmar, PedidoConfirmado, MisPedidos
            └── vendedor/  PedidosTienda, Caja
```

## Pantallas del administrador

Cuenta demo: `admin@mass.test` / `Admin1234`.

| Pantalla | Qué hace |
|---|---|
| Tiendas | Registrar, editar y desactivar tiendas; meta de ventas mensual |
| Vendedores | Crear vendedores (con contraseña elegida o generada), asignarlos a una tienda y desactivarlos |
| Catálogo | Productos con costo, precio, margen y stock total; historial de precios |
| Ofertas | Precio especial con fechas de inicio y fin |
| Categorías | Descripción, imagen y estado; una categoría inactiva oculta sus productos |
| Reportes | Ventas, productos, tiendas, vendedores, pedidos y ofertas, con descarga en Excel o PDF; reporte de usabilidad |

## Pantallas del vendedor

Cuenta demo: `vendedor1@mass.test` / `Vendedor1234`.

| Pantalla | Qué hace |
|---|---|
| Inicio | Accesos a pedidos, caja e inventario, con los datos de la tienda |
| Pedidos Online | Preparar, marcar listo, entregar validando el código y cancelar |
| Caja | Venta en curso, cobro con vuelto, boleta y ticket imprimibles, lector de códigos USB |
| Cierre de caja | Resumen del turno, desglose por medio de pago y efectivo contado contra el esperado |
| Inventario | Stock con su estado, ajustes con motivo, stock mínimo, vencimiento y movimientos |
| Escáner QR | Lee códigos QR y de barras con la cámara (requiere HTTPS o localhost) |
| Historial de ventas | Totales de hoy, la semana y el mes, filtros y exportación a Excel |
| Devoluciones | Devuelve unidades de una venta; lo dañado o vencido no vuelve al stock |
| Reportes | Ventas diarias, metas, productos más vendidos y comparativa de vendedores |
| Mi perfil | Datos, foto, contraseña, tienda asignada y últimos accesos |

La meta mensual de cada tienda la define el administrador en la pantalla Tiendas.

## Cómo ejecutarlo

Requisitos: Python 3.12 o superior y Node 20 o superior.

**Backend** (en `backend/`):

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py cargar_demo     # 5 tiendas, cuentas demo, 800 productos y su stock
python manage.py simular_ventas  # 30 días de ventas, pedidos, ingresos y mermas para los reportes (opcional: --dias 90)
python manage.py runserver
python manage.py simular_ventas --dias 30
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
| GET | `/api/reportes/panel/` | Administrador | Panel de ventas y pedidos con filtros `desde`, `hasta`, `tienda` |
| GET | `/api/reportes/exportar/` | Administrador | Exportar reporte en Excel (`formato=xlsx`) o PDF (`formato=pdf`) |
| POST | `/api/reportes/usabilidad/` | Administrador | Generar reporte PDF de pruebas de usabilidad con datos de tiempo por tarea |

## Pruebas

```bash
cd backend && python manage.py test      # 50 pruebas de HU02 a HU08
cd frontend && npm run lint && npm run build
```

GitHub Actions ejecuta lo mismo en cada pull request (`.github/workflows/ci.yml`).

## Pruebas de Usabilidad (HU18)

El proyecto incluye un protocolo de pruebas de usabilidad para validar que el sistema es útil y fácil de usar.

**Protocolo de pruebas:** Ver `PROTOCOLO_USABILIDAD.md` para las tareas específicas por rol (admin, vendedor, cliente) y la hoja de registro.

**Generación de reporte:**
1. Ejecutar el comando de simulación: `python manage.py simular_ventas --dias 30`
2. Iniciar sesión como admin y navegar a Reportes
3. Hacer clic en "Reporte usabilidad"
4. Ingresar los datos de las pruebas (usuario, rol, tareas con tiempo y completada)
5. Hacer clic en "Generar PDF" para descargar el reporte con gráficos

**Gráficos incluidos en el reporte:**
- Tiempo promedio por rol
- Tiempo promedio por tarea
- Tasa de completación por tarea
- Tabla detallada por usuario

GitHub Actions ejecuta lo mismo en cada pull request (`.github/workflows/ci.yml`).

## HU19 - Verificar diseño responsivo y PWA

### Diseño Responsivo
El diseño está implementado con CSS mobile-first y se adapta a:
- **360px**: Celular (base)
- **768px**: Tablet
- **1280px**: Computadora

**Cómo verificar:**
1. Abre el inspector de Chrome (F12)
2. Activa el modo de diseño adaptable (Ctrl+Shift+M)
3. Prueba los tamaños: 360px, 768px y 1280px
4. Verifica que todas las páginas se vean correctamente en cada tamaño

### Puntaje de Accesibilidad (Lighthouse)
**Cómo verificar:**
1. Abre Chrome DevTools (F12)
2. Ve a la pestaña "Lighthouse"
3. Selecciona "Accesibilidad"
4. Ejecuta el análisis
5. El puntaje debe ser 90 o más

### PWA (Progressive Web App)
El proyecto está configurado como PWA con `vite-plugin-pwa`.

**Cómo probar la instalación:**
1. Ejecuta `npm run build` para generar la versión de producción
2. Ejecuta `npm run preview` para ver la versión compilada
3. En Chrome móvil, aparecerá el botón "Instalar" en la barra de direcciones
4. Instala la app y verifica que funcione offline

**En producción:** El service worker se registra automáticamente para permitir acceso offline.

## HU20 - Preparar demo y presentación para Mass

### Cuentas Demo
Las cuentas demo se generan con `python manage.py cargar_demo`:

| Rol | Email | Contraseña | Tienda |
|---|---|---|---|
| Administradora | admin@mass.test | Demo1234! | Todas |
| Vendedor | luis@mass.test | Demo1234! | T-003 Los Olivos |
| Cliente | rocio@correo.pe | Demo1234! | — |

### API Documentada
La documentación interactiva está disponible en:
- **Swagger UI:** http://localhost:8000/api/docs/
- **OpenAPI Schema:** http://localhost:8000/api/schema/

Incluye todos los endpoints con ejemplos de request/response.

### Video Demo y Presentación
**Sugerencia para el video de 3 minutos:**
1. **Intro (30s):** Mostrar el caso Mass, las 5 tiendas y los roles
2. **Cliente (1min):** Registrarse, buscar productos, armar carrito, confirmar pedido, ver "Mis pedidos"
3. **Vendedor (1min):** Ver pedidos online, preparar y entregar pedido, registrar venta en caja, consultar stock
4. **Cierre (30s):** Mostrar el panel de reportes como administrador y resumen de funcionalidades

**Presentación para Mass:**
- Incluir capturas de pantalla de cada rol
- Mostrar arquitectura: Django REST + React
- Destacar: diseño responsivo, PWA, accesibilidad (Lighthouse 90+)
- Aclarar: datos simulados, propuesta académica, no afiliado oficial

## Flujo de trabajo

- Una rama por historia (por ejemplo `feature/hu04-tiendas-vendedores`) que sale de la rama del sprint.
- Los cambios entran por pull request revisado por otro integrante, con las pruebas en verde.
- Una historia está terminada cuando cumple sus criterios de aceptación, tiene pruebas, se ve bien en celular, tablet y computadora, fue revisada y está desplegada.
