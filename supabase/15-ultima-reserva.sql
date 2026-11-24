-- ==========================================================================
-- PUNTO ASADO - ÚLTIMA RESERVA A LAS 9:30 P. M.
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 14-seguridad.sql.
-- Se puede volver a ejecutar. Si vuelves a ejecutar 10, 11 o 13, ejecuta
-- también este otra vez.
--
-- Cerramos a las 11:00 p. m. y cada reserva ocupa la mesa 2 horas: la última
-- reserva pasa de las 10:30 p. m. a las 9:30 p. m. (la mesa queda libre a las
-- 11:30 p. m. como máximo). Los clientes que el mozo sienta sin reserva no
-- tienen este límite.
-- ==========================================================================

do $$
declare
  f text;
  cuerpo text;
  nuevo text;
begin
  foreach f in array array['public.validar_reserva()', 'public.sugerir_mesas(bigint, text[])'] loop
    select pg_get_functiondef(f::regprocedure) into cuerpo;
    nuevo := replace(replace(cuerpo, 'time ''22:30''', 'time ''21:30'''),
                     'Ese día atendemos de % a 22:30.', 'Ese día recibimos reservas de % a 21:30.');
    if nuevo <> cuerpo then
      execute nuevo;
      raise notice '% actualizada', f;
    elsif position('21:30' in cuerpo) = 0 then
      raise exception 'No se encontró la hora 22:30 en %: ejecuta antes los scripts 10 a 14.', f;
    end if;
  end loop;
end;
$$;

-- Comprobación: las dos deben decir true
select position('21:30' in pg_get_functiondef('public.validar_reserva()'::regprocedure)) > 0 as validar_ok,
       position('21:30' in pg_get_functiondef('public.sugerir_mesas(bigint, text[])'::regprocedure)) > 0 as sugerir_ok;
