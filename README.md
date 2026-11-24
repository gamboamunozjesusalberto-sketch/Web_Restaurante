# Punto Asado – Web Restaurante

Sitio web del restaurante Punto Asado (Ica). Es un sitio estático (HTML, CSS y JavaScript con Bootstrap 5.3.3 por CDN) con base de datos en Supabase y está publicado en GitHub Pages:
https://gamboamunozjesusalberto-sketch.github.io/Web_Restaurante/

## Páginas

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Público | Portada: carrusel, promociones, recomendaciones del chef, galería y paquetes |
| `menu.html` | Público | Carta con filtros, buscador y ficha de cada plato. Los precios del Panel la actualizan |
| `nosotros.html` | Público | Historia, ambientes y logros |
| `contacto.html` | Público y clientes | Datos, horario y reserva con mapa de mesas y asistente que recomienda mesa |
| `login.html` | Todos | Ingresar, crear cuenta y recuperar contraseña |
| `cuenta.html` | Cliente | Mis reservas (cambiar fecha, cancelar, aceptar mesa ofrecida), mis datos, opiniones y notificaciones |
| `admin.html` | Administrador | Reservas, mesas, carta, promociones, dashboard, opiniones, clientes y personal |
| `personal.html` | Mozos y admin | "Salón en vivo" para el celular: mesas libres y ocupadas, llegadas, liberar mesas, juntar mesas y sentar clientes sin reserva |

En todas las páginas públicas está "Asadito", el chatbot que responde horarios y platos y hace reservas paso a paso.

## Roles

- **cliente:** cualquier persona que crea su cuenta en la web.
- **mozo:** el admin lo nombra en Panel → Clientes → Personal, con el correo de una cuenta ya creada.
- **admin:** se asigna en Supabase (ver `supabase/esquema.sql`, paso 4).

## Base de datos (Supabase)

Hay que ejecutar los scripts de `supabase/` en el SQL Editor **en este orden**:

1. `esquema.sql`: tablas, seguridad (RLS) y validaciones
2. `02-avisos-reservas.sql` a `08-quitar-platos.sql`: avisos, fotos, paquetes y opiniones, cambiar reserva, datos de demostración y quitar platos
3. `09-mesas.sql`: mapa de mesas
4. `10-asistente-mesas.sql`: asistente que elige mesa, segundo piso exclusivo, cancelaciones con aviso y reservas vencidas
5. `11-personal.sql`: rol mozo y Salón en vivo
6. `12-confirmar-con-mesa.sql`: solo se confirma una reserva si hay mesa libre
7. `13-juntar-mesas.sql`: juntar mesas para grupos grandes
8. `14-seguridad.sql`: limita qué columnas puede llenar un cliente al reservar

Los scripts 11 y 13 amplían funciones de los anteriores. Si vuelves a ejecutar uno de los primeros, ejecuta otra vez todos los que van después.

La clave que usa la web (`js/supabase-config.js`) es la *publishable key*: es pública a propósito y la seguridad la dan las políticas RLS. **Nunca** se pone la `service_role` key en el código.

## Archivos de caché

Los HTML cargan CSS y JS con `?v=N`. Al cambiar un archivo hay que subir ese número en todos los HTML para que GitHub Pages no muestre la versión vieja.
