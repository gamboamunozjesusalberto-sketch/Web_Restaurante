-- ==========================================================================
-- PUNTO ASADO - SEGURIDAD: QUÉ COLUMNAS PUEDE LLENAR UN CLIENTE
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 13-juntar-mesas.sql.
-- Se puede volver a ejecutar.
--
-- Antes, un cliente con conocimientos (desde la consola del navegador) podía
-- crear una reserva escribiendo columnas que solo debe tocar el restaurante:
--   - descuento: ponerse hasta 50% de descuento
--   - oferta_mesa / oferta_descuento: inventarse una "mesa ofrecida" y aceptarla,
--     con lo que la reserva quedaba CONFIRMADA sin que el admin la viera
--   - origen = 'local': saltarse la revisión de fecha y horario
--   - llegada_en, liberada_en, motivo, atendido_por, mesas_extra
-- Ahora el cliente solo puede llenar los campos del formulario de reserva.
-- Las funciones del restaurante (aceptar_oferta, mozo_sentar, etc.) siguen
-- funcionando porque corren con permisos del dueño de la base de datos.
-- ==========================================================================

-- ---------- RESERVAS: solo los campos del formulario ----------
revoke insert on public.reservas from anon, authenticated;
grant insert (usuario_id, fecha, hora, personas, tipo, ubicacion, paquete, mesa,
              pedido, preferencias, mensaje)
  on public.reservas to authenticated;

-- ---------- OPINIONES: el cliente no elige la fecha ni si se ve ----------
revoke insert on public.opiniones from anon, authenticated;
grant insert (usuario_id, plato, calificacion, comentario, foto)
  on public.opiniones to authenticated;

-- Comprobación: debe listar solo esas columnas para "authenticated"
select table_name, string_agg(column_name, ', ' order by column_name) as columnas_que_llena_el_cliente
from information_schema.column_privileges
where grantee = 'authenticated' and privilege_type = 'INSERT'
  and table_schema = 'public' and table_name in ('reservas', 'opiniones')
group by table_name;
