# Protocolo de Pruebas de Usabilidad - HU18

## Objetivo
Validar que el sistema Tienda MASS es útil y fácil de usar para los tres roles principales: admin, vendedor y cliente.

## Participantes
- 2 usuarios admin
- 2 usuarios vendedor
- 2 usuarios cliente

Total: 6 usuarios

## Metodología
- Cada usuario realiza las tareas correspondientes a su rol
- Se registra el tiempo (en segundos) para cada tarea
- Se marca si la tarea fue completada exitosamente (S/N)
- Se registran observaciones, errores o sugerencias

---

## Rol: ADMIN (2 usuarios)

### Tareas

1. **Iniciar sesión como admin**
   - URL: http://localhost:5173/login
   - Email: admin@mass.test
   - Contraseña: Demo1234!
   - Tiempo esperado: < 30 segundos

2. **Ver reportes de ventas**
   - Navegar a /admin/reportes
   - Ver métricas de ventas
   - Tiempo esperado: < 60 segundos

3. **Ver inventario global de todas las tiendas**
   - Navegar a la sección de inventario
   - Ver stock de todas las tiendas
   - Tiempo esperado: < 45 segundos

4. **Crear un nuevo producto**
   - Ir a la sección de productos
   - Hacer clic en "Nuevo producto"
   - Llenar formulario con datos de prueba
   - Tiempo esperado: < 90 segundos

5. **Editar un producto existente**
   - Seleccionar un producto de la lista
   - Modificar algún campo (ej: precio)
   - Guardar cambios
   - Tiempo esperado: < 60 segundos

6. **Ver lista de usuarios del sistema**
   - Navegar a la sección de usuarios
   - Ver lista de usuarios con roles
   - Tiempo esperado: < 30 segundos

7. **Ver reportes de rendimiento por tienda**
   - En reportes, filtrar por tienda específica
   - Ver métricas de esa tienda
   - Tiempo esperado: < 45 segundos

8. **Exportar reporte PDF**
   - En reportes, hacer clic en "Exportar PDF"
   - Descargar archivo
   - Tiempo esperado: < 30 segundos

---

## Rol: VENDEDOR (2 usuarios)

### Tareas

1. **Iniciar sesión como vendedor**
   - URL: http://localhost:5173/login
   - Email: luis@mass.test (u otro vendedor)
   - Contraseña: Demo1234!
   - Tiempo esperado: < 30 segundos

2. **Ver pedidos online recibidos**
   - Navegar a /vendedor/pedidos
   - Ver pestaña "Recibidos"
   - Tiempo esperado: < 30 segundos

3. **Mover pedido a "en preparación"**
   - Seleccionar un pedido recibido
   - Hacer clic en "Empezar a preparar"
   - Tiempo esperado: < 20 segundos

4. **Marcar pedido como "listo"**
   - Seleccionar un pedido en preparación
   - Hacer clic en "Marcar listo"
   - Tiempo esperado: < 20 segundos

5. **Entregar pedido con código de recojo**
   - Seleccionar un pedido listo
   - Ingresar código de recojo (6 caracteres)
   - Seleccionar medio de pago real
   - Confirmar entrega
   - Tiempo esperado: < 45 segundos

6. **Registrar venta en caja**
   - Navegar a /vendedor/caja
   - Buscar producto por nombre
   - Agregar al carrito
   - Completar venta
   - Tiempo esperado: < 60 segundos

7. **Escanear código QR de producto**
   - En caja, hacer clic en botón de escáner
   - Abrir panel lateral
   - Escanear código QR
   - Agregar producto a la venta
   - Tiempo esperado: < 45 segundos

8. **Ver inventario de la tienda**
   - Navegar a /vendedor/inventario
   - Ver tabla de stock
   - Tiempo esperado: < 30 segundos

9. **Registrar ingreso de inventario**
   - En inventario, hacer clic en "Registrar ingreso"
   - Llenar formulario (producto, cantidad, vencimiento)
   - Confirmar
   - Tiempo esperado: < 60 segundos

10. **Registrar merma de inventario**
    - En inventario, hacer clic en "Registrar merma"
    - Llenar formulario (producto, cantidad, motivo)
    - Confirmar
    - Tiempo esperado: < 60 segundos

---

## Rol: CLIENTE (2 usuarios)

### Tareas

1. **Iniciar sesión como cliente**
   - URL: http://localhost:5173/login
   - Email: rocio@correo.pe (u otro cliente)
   - Contraseña: Demo1234!
   - Tiempo esperado: < 30 segundos

2. **Ver tienda y seleccionar una**
   - Ver listado de tiendas
   - Seleccionar una tienda
   - Tiempo esperado: < 30 segundos

3. **Buscar productos por nombre**
   - Usar campo de búsqueda
   - Ingresar nombre de producto
   - Ver resultados
   - Tiempo esperado: < 30 segundos

4. **Agregar producto al carrito**
   - Seleccionar un producto
   - Hacer clic en "Agregar al carrito"
   - Tiempo esperado: < 20 segundos

5. **Modificar cantidad en carrito**
   - Ir al carrito
   - Cambiar cantidad de un producto
   - Tiempo esperado: < 20 segundos

6. **Ver total del carrito**
   - Ver resumen de compra
   - Ver total a pagar
   - Tiempo esperado: < 15 segundos

7. **Seleccionar método de pago**
   - En checkout, seleccionar medio de pago
   - Tiempo esperado: < 15 segundos

8. **Completar checkout**
   - Confirmar pedido
   - Ver confirmación
   - Tiempo esperado: < 30 segundos

9. **Ver mis pedidos**
   - Navegar a "Mis pedidos"
   - Ver lista de pedidos
   - Tiempo esperado: < 30 segundos

10. **Ver estado de un pedido**
    - Seleccionar un pedido
    - Ver estado y detalles
    - Tiempo esperado: < 20 segundos

---

## Hoja de Registro de Pruebas

| ID Prueba | Usuario | Rol | Tarea | Tiempo (segundos) | Completada (S/N) | Observaciones |
|-----------|---------|-----|-------|-------------------|------------------|---------------|
| 1 | | Admin | Iniciar sesión | | | |
| 2 | | Admin | Ver reportes de ventas | | | |
| 3 | | Admin | Ver inventario global | | | |
| 4 | | Admin | Crear nuevo producto | | | |
| 5 | | Admin | Editar producto | | | |
| 6 | | Admin | Ver lista de usuarios | | | |
| 7 | | Admin | Ver reportes por tienda | | | |
| 8 | | Admin | Exportar reporte PDF | | | |
| 9 | | Vendedor | Iniciar sesión | | | |
| 10 | | Vendedor | Ver pedidos recibidos | | | |
| 11 | | Vendedor | Mover a preparación | | | |
| 12 | | Vendedor | Marcar listo | | | |
| 13 | | Vendedor | Entregar pedido | | | |
| 14 | | Vendedor | Registrar venta en caja | | | |
| 15 | | Vendedor | Escanear código QR | | | |
| 16 | | Vendedor | Ver inventario | | | |
| 17 | | Vendedor | Registrar ingreso | | | |
| 18 | | Vendedor | Registrar merma | | | |
| 19 | | Cliente | Iniciar sesión | | | |
| 20 | | Cliente | Seleccionar tienda | | | |
| 21 | | Cliente | Buscar productos | | | |
| 22 | | Cliente | Agregar al carrito | | | |
| 23 | | Cliente | Modificar cantidad | | | |
| 24 | | Cliente | Ver total | | | |
| 25 | | Cliente | Seleccionar pago | | | |
| 26 | | Cliente | Completar checkout | | | |
| 27 | | Cliente | Ver mis pedidos | | | |
| 28 | | Cliente | Ver estado pedido | | | |

---

## Instrucciones para el Facilitador

1. **Preparación del ambiente:**
   - Asegurarse de que el backend y frontend estén corriendo
   - Verificar que los usuarios de prueba existan
   - Ejecutar el comando de simulación para tener datos de prueba

2. **Durante la prueba:**
   - No dar instrucciones sobre cómo hacer las tareas
   - Si el usuario se bloquea por más de 2 minutos, anotarlo como observación
   - Si el usuario pide ayuda, anotarlo como observación
   - Cronómetro: iniciar al inicio de cada tarea, detener al completar

3. **Después de la prueba:**
   - Preguntar al usuario qué fue fácil/difícil
   - Registrar sugerencias espontáneas
   - Ingresar datos en el sistema para generar reporte PDF

---

## Generación del Reporte PDF

1. Ir a la página de admin
2. Navegar a la sección de reportes de usabilidad
3. Ingresar los datos de las pruebas registradas
4. Hacer clic en "Generar reporte PDF"
5. El PDF se descargará automáticamente con:
   - Gráfico de tiempo promedio por rol
   - Gráfico de tiempo promedio por tarea
   - Gráfico de tasa de completación por tarea
   - Tabla detallada por usuario
