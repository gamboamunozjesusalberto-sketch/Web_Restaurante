-- ==========================================================================
-- PUNTO ASADO - QUITAR PLATOS DE LA CARTA DESDE EL PANEL
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar.
--
-- Los platos que vienen escritos en menu.html no están en la tabla platos.
-- Cuando el admin los elimina desde el Panel, se guarda una fila con
-- visible = false. Esta función le dice a la página pública qué platos
-- esconder. Solo devuelve nombres: nada privado.
-- ==========================================================================

create or replace function public.platos_ocultos()
returns setof text
language sql stable security definer set search_path = public
as $$
  select nombre from public.platos where not visible;
$$;

grant execute on function public.platos_ocultos() to anon, authenticated;
