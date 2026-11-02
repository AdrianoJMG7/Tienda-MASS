from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from tienda.models import Tienda
from categoria.models import Categoria
from producto.models import Producto
from inventario.models import Stock
from pedido import servicios as servicios_pedido
from pedido.models import Pedido
from venta.models import Venta, DetalleVenta
from usuarios.models import Usuario


class Command(BaseCommand):
    help = "Carga datos de prueba para el sistema"

    def handle(self, *args, **options):
        self.stdout.write("Cargando datos de prueba...")

        # Crear superusuario si no existe
        if not Usuario.objects.filter(email="admin@mass.test").exists():
            admin = Usuario.objects.create_superuser(
                email="admin@mass.test",
                nombre="Administrador",
                password="Admin1234",
            )
            self.stdout.write(f"[OK] Superusuario creado: {admin.email}")
        else:
            self.stdout.write("[OK] Superusuario ya existe")

        # Crear tiendas
        tiendas_data = [
            {"codigo": "T-001", "nombre": "Mass Miraflores", "distrito": "Miraflores", "direccion": "Av. Benavides 123"},
            {"codigo": "T-002", "nombre": "Mass San Isidro", "distrito": "San Isidro", "direccion": "Av. Brasil 456"},
            {"codigo": "T-003", "nombre": "Mass Surco", "distrito": "Surco", "direccion": "Av. Larco 789"},
            {"codigo": "T-004", "nombre": "Mass La Molina", "distrito": "La Molina", "direccion": "Av. Javier Prado 321"},
            {"codigo": "T-005", "nombre": "Mass San Miguel", "distrito": "San Miguel", "direccion": "Av. La Marina 654"},
        ]

        for tienda_data in tiendas_data:
            tienda, created = Tienda.objects.get_or_create(
                codigo=tienda_data["codigo"],
                defaults=tienda_data,
            )
            if created:
                self.stdout.write(f"[OK] Tienda creada: {tienda.codigo}")
            else:
                self.stdout.write(f"[OK] Tienda ya existe: {tienda.codigo}")

        # Crear categorías
        categorias_data = [
            "Lácteos",
            "Bebidas",
            "Panadería",
            "Carnes",
            "Frutas y Verduras",
            "Limpieza",
            "Aseo Personal",
            "Snacks",
            "Cereales",
            "Conservas",
        ]

        for cat_nombre in categorias_data:
            categoria, created = Categoria.objects.get_or_create(nombre=cat_nombre)
            if created:
                self.stdout.write(f"[OK] Categoría creada: {categoria.nombre}")
            else:
                self.stdout.write(f"[OK] Categoría ya existe: {categoria.nombre}")

        # Crear productos
        productos_data = [
            {"nombre": "Leche Entera 1L", "marca": "Gloria", "codigo_barras": "1234567890123", "categoria": "Lácteos", "precio": 5.50},
            {"nombre": "Leche Deslactosada 1L", "marca": "Gloria", "codigo_barras": "1234567890124", "categoria": "Lácteos", "precio": 5.80},
            {"nombre": "Yogurt Natural 1L", "marca": "Gloria", "codigo_barras": "1234567890125", "categoria": "Lácteos", "precio": 6.50},
            {"nombre": "Coca Cola 2L", "marca": "Coca Cola", "codigo_barras": "2234567890123", "categoria": "Bebidas", "precio": 8.90},
            {"nombre": "Inca Kola 2L", "marca": "Inca Kola", "codigo_barras": "2234567890124", "categoria": "Bebidas", "precio": 7.50},
            {"nombre": "Agua Mineral 1L", "marca": "San Mateo", "codigo_barras": "2234567890125", "categoria": "Bebidas", "precio": 2.50},
            {"nombre": "Pan Molde Blanco", "marca": "Harina Pan", "codigo_barras": "3234567890123", "categoria": "Panadería", "precio": 4.50},
            {"nombre": "Pan Integral", "marca": "Harina Pan", "codigo_barras": "3234567890124", "categoria": "Panadería", "precio": 5.20},
            {"nombre": "Croissant", "marca": "Harina Pan", "codigo_barras": "3234567890125", "categoria": "Panadería", "precio": 3.80},
            {"nombre": "Pollo Entero", "marca": "San Fernando", "codigo_barras": "4234567890123", "categoria": "Carnes", "precio": 18.90},
            {"nombre": "Pechuga de Pollo", "marca": "San Fernando", "codigo_barras": "4234567890124", "categoria": "Carnes", "precio": 15.50},
            {"nombre": "Carne Molida", "marca": "San Fernando", "codigo_barras": "4234567890125", "categoria": "Carnes", "precio": 22.00},
            {"nombre": "Manzana Roja kg", "marca": "Variedad", "codigo_barras": "5234567890123", "categoria": "Frutas y Verduras", "precio": 8.50},
            {"nombre": "Plátano kg", "marca": "Variedad", "codigo_barras": "5234567890124", "categoria": "Frutas y Verduras", "precio": 3.20},
            {"nombre": "Tomate kg", "marca": "Variedad", "codigo_barras": "5234567890125", "categoria": "Frutas y Verduras", "precio": 5.80},
            {"nombre": "Detergente Líquido 1L", "marca": "Ariel", "codigo_barras": "6234567890123", "categoria": "Limpieza", "precio": 12.50},
            {"nombre": "Cloro 1L", "marca": "Clorox", "codigo_barras": "6234567890124", "categoria": "Limpieza", "precio": 4.50},
            {"nombre": "Jabón Líquido 500ml", "marca": "Lux", "codigo_barras": "6234567890125", "categoria": "Limpieza", "precio": 8.90},
            {"nombre": "Shampoo 400ml", "marca": "Pantene", "codigo_barras": "7234567890123", "categoria": "Aseo Personal", "precio": 18.50},
            {"nombre": "Desodorante", "marca": "Rexona", "codigo_barras": "7234567890124", "categoria": "Aseo Personal", "precio": 12.00},
            {"nombre": "Pasta Dental 100g", "marca": "Colgate", "codigo_barras": "7234567890125", "categoria": "Aseo Personal", "precio": 7.50},
            {"nombre": "Papas Fritas 150g", "marca": "Lays", "codigo_barras": "8234567890123", "categoria": "Snacks", "precio": 6.50},
            {"nombre": "Galletas 150g", "marca": "Oreo", "codigo_barras": "8234567890124", "categoria": "Snacks", "precio": 5.80},
            {"nombre": "Chocolates 100g", "marca": "Hershey's", "codigo_barras": "8234567890125", "categoria": "Snacks", "precio": 8.00},
            {"nombre": "Avena 500g", "marca": "Quaker", "codigo_barras": "9234567890123", "categoria": "Cereales", "precio": 12.50},
            {"nombre": "Corn Flakes 500g", "marca": "Kellogg's", "codigo_barras": "9234567890124", "categoria": "Cereales", "precio": 14.00},
            {"nombre": "Muesli 400g", "marca": "Naturaleza", "codigo_barras": "9234567890125", "categoria": "Cereales", "precio": 16.50},
            {"nombre": "Atún en Agua 140g", "marca": "Gallo", "codigo_barras": "0234567890123", "categoria": "Conservas", "precio": 6.50},
            {"nombre": "Atún en Aceite 140g", "marca": "Gallo", "codigo_barras": "0234567890124", "categoria": "Conservas", "precio": 7.80},
            {"nombre": "Sardinas 125g", "marca": "Gallo", "codigo_barras": "0234567890125", "categoria": "Conservas", "precio": 5.50},
        ]

        for prod_data in productos_data:
            categoria = Categoria.objects.get(nombre=prod_data["categoria"])
            producto, created = Producto.objects.get_or_create(
                codigo_barras=prod_data["codigo_barras"],
                defaults={
                    "nombre": prod_data["nombre"],
                    "marca": prod_data["marca"],
                    "categoria": categoria,
                    "precio": prod_data["precio"],
                    "activo": True,
                },
            )
            if created:
                self.stdout.write(f"[OK] Producto creado: {producto.nombre}")
            else:
                self.stdout.write(f"[OK] Producto ya existe: {producto.nombre}")

        # Crear vendedores
        tiendas = list(Tienda.objects.all())
        for i, tienda in enumerate(tiendas[:3], 1):
            email = f"vendedor{i}@mass.test"
            if not Usuario.objects.filter(email=email).exists():
                vendedor = Usuario.objects.create_user(
                    email=email,
                    nombre=f"Vendedor {i}",
                    password="Vendedor1234",
                    rol="vendedor",
                    tienda=tienda,
                )
                self.stdout.write(f"[OK] Vendedor creado: {vendedor.email}")
            else:
                self.stdout.write(f"[OK] Vendedor ya existe: {email}")

        # Crear cliente
        if not Usuario.objects.filter(email="cliente@mass.test").exists():
            cliente = Usuario.objects.create_user(
                email="cliente@mass.test",
                nombre="Cliente Test",
                celular="987654321",
                password="Cliente1234",
                rol="cliente",
                acepto_privacidad_en=timezone.now(),
            )
            self.stdout.write(f"[OK] Cliente creado: {cliente.email}")
        else:
            self.stdout.write("[OK] Cliente ya existe")

        # Crear stock para cada tienda
        productos = list(Producto.objects.all())
        for tienda in tiendas:
            for producto in productos:
                stock, created = Stock.objects.get_or_create(
                    tienda=tienda,
                    producto=producto,
                    defaults={"cantidad": 50},
                )
                if created:
                    self.stdout.write(f"[OK] Stock creado: {producto.nombre} en {tienda.codigo}")

        # Crear algunos pedidos de ejemplo
        cliente = Usuario.objects.get(email="cliente@mass.test")
        tienda = tiendas[0]
        productos_pedido = productos[:3]

        if not Pedido.objects.filter(cliente=cliente).exists():
            # Se crean con el servicio real para que reserven stock (HU09), y en distintos
            # estados para que el vendedor de la tienda tenga pedidos que atender (HU10).
            vendedor_tienda = Usuario.objects.filter(rol="vendedor", tienda=tienda).first()
            for i, estado in enumerate(["recibido", "en_preparacion", "listo"]):
                items = [{"producto": p.id, "cantidad": 2} for p in productos_pedido[i : i + 2]]
                pedido = servicios_pedido.crear_pedido(cliente, tienda, items, "efectivo")
                if estado != "recibido":
                    pedido = servicios_pedido.preparar(pedido, vendedor_tienda)
                if estado == "listo":
                    pedido = servicios_pedido.marcar_listo(pedido, vendedor_tienda)
                self.stdout.write(f"[OK] Pedido #{pedido.id} creado ({pedido.get_estado_display()})")

        # Crear algunas ventas de ejemplo
        vendedor = Usuario.objects.filter(rol="vendedor").first()
        if vendedor:
            if not Venta.objects.filter(vendedor=vendedor).exists():
                venta = Venta.objects.create(
                    tienda=vendedor.tienda,
                    vendedor=vendedor,
                    total=15.50,
                    medio_pago="tarjeta",
                    numero_ticket="T-001-001",
                )
                for producto in productos[:2]:
                    DetalleVenta.objects.create(
                        venta=venta,
                        producto=producto,
                        cantidad=1,
                        precio_unitario=producto.precio,
                    )
                self.stdout.write(f"[OK] Venta creada: {venta.numero_ticket}")

        # HU05: catálogo inicial de unos 800 productos y stock simulado por tienda (HU06, HU07).
        call_command("cargar_catalogo", stdout=self.stdout)
        call_command("cargar_stock", stdout=self.stdout)

        self.stdout.write(self.style.SUCCESS("[OK] Datos de prueba cargados exitosamente"))
        self.stdout.write("\nCredenciales de prueba:")
        self.stdout.write("  Admin: admin@mass.test / Admin1234")
        self.stdout.write("  Vendedor: vendedor1@mass.test / Vendedor1234")
        self.stdout.write("  Cliente: cliente@mass.test / Cliente1234")
