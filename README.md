# Punto Asado – Web Restaurante

Sitio estático (HTML + CSS + JavaScript, Bootstrap 5.3.3 por CDN) publicado en GitHub Pages:
https://gamboamunozjesusalberto-sketch.github.io/Web_Restaurante/

Las cuentas, las reservas y las notificaciones usan **Supabase** (base de datos PostgreSQL + login), conectado directo desde el JavaScript.

## Estructura
- `index.html`, `menu.html`, `nosotros.html`, `contacto.html`, `login.html`, `cuenta.html` (perfil del cliente), `admin.html` (panel de administrador)
- `css/variables.css` (colores y tokens) · `components.css` (navbar y footer compartidos) · `paginas.css` (capa común de páginas internas) · un CSS por página
- `js/supabase-config.js` (URL y clave pública de Supabase) · `sesion.js` (sesión y menú de la cuenta en la barra) · `main.js` (común) · `landing.js` · `menu.js` · `contacto.js` (reservas) · `login.js` (login y registro) · `cuenta.js` (mi cuenta) · `admin.js` (panel de administrador)
- `supabase/esquema.sql` → tablas, reglas de seguridad (RLS) y triggers de la base de datos
- `supabase/02-avisos-reservas.sql` → aviso al cliente cuando se confirma o rechaza su reserva (ya incluido en esquema.sql para proyectos nuevos)
- `images/` → todas las fotos del proyecto (incluye `images/nosotros/`)

## Notas
- Navbar y footer idénticos en todas las páginas.
- `js/menu.js` fue escrito a partir del HTML; si tienen el original, reemplácenlo.
- La carta incluye cortes, postres y vinos nuevos con "Consultar precio": completar los precios reales en `menu.html`.
- La portada tiene una galería "Brasas & Ambiente".
- `css/style-original.css`: la hoja `style.css` original, solo de referencia (no se carga en ninguna página).

## Base de datos (Supabase)
1. En Supabase → **SQL Editor**, pega y ejecuta `supabase/esquema.sql` (una sola vez).
2. En **Project Settings → API Keys**, copia la clave pública (anon / publishable) a `js/supabase-config.js`. Nunca la `service_role`.
3. En **Authentication → URL Configuration**, pon el enlace de GitHub Pages como Site URL y en Redirect URLs.
4. Para volver administrador a una cuenta, ejecuta en el SQL Editor:
   `update public.perfiles set rol = 'admin' where id = (select id from auth.users where email = 'correo@ejemplo.com');`

### Seguridad
- Contraseñas cifradas por Supabase Auth; confirmación por correo.
- RLS en todas las tablas: cada cliente solo ve y cancela sus reservas; solo el admin gestiona carta, promociones y confirma reservas.
- Nadie puede registrarse como admin ni cambiarse el rol (permisos por columna).
- La base de datos valida cada reserva: no fechas pasadas, máximo 60 días y dentro del horario (lun-vie 18:00–22:30, sáb-dom 12:00–22:30).
- El JavaScript nunca inserta texto del usuario con `innerHTML` (usa `textContent`) y el parámetro `?volver=` del login solo acepta páginas propias.
- Si `supabase-config.js` no tiene clave, el sitio sigue funcionando y la reserva se envía por WhatsApp.
