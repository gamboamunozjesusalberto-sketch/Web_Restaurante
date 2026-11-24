-- ==========================================================================
-- PUNTO ASADO - CONFIRMAR UNA RESERVA SOLO SI HAY MESA
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 11-personal.sql.
-- Se puede volver a ejecutar.
--
-- Cuando el admin confirma una reserva (estado → confirmada):
-- - si ya tiene mesa, se revisa que siga libre a esa hora
-- - si no tiene mesa, el asistente (mejor_mesa) le busca la mejor libre
-- - si no hay ninguna libre que alcance, NO se confirma y el admin ve el aviso
-- Los grupos de más de 10 personas (Empresarial) y el Segundo piso exclusivo
-- no usan una mesa suelta, así que se confirman igual.
-- ==========================================================================

create or replace function public.mesa_al_confirmar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado <> 'confirmada' or old.estado = 'confirmada'
     or new.personas > 10 or new.paquete = 'Segundo piso exclusivo' then
    return new;
  end if;

  if new.mesa is not null and public.mesa_ocupada(new.mesa, new.fecha, new.hora, new.id) then
    new.mesa := null;  -- la mesa que tenía ya no está libre: se busca otra
  end if;

  if new.mesa is null then
    new.mesa := public.mejor_mesa(new.fecha, new.hora, new.personas, new.ubicacion,
                                  new.preferencias, new.tipo, new.paquete, new.id);
    if new.mesa is null then
      raise exception 'No hay ninguna mesa libre para % personas el % a las %. No se puede confirmar: recházala y ofrécele otro horario.',
        new.personas, to_char(new.fecha, 'DD/MM'), to_char(new.hora, 'HH24:MI');
    end if;
    new.ubicacion := (select piso from public.mesas where codigo = new.mesa);
  end if;
  return new;
end;
$$;

drop trigger if exists al_confirmar_con_mesa on public.reservas;
create trigger al_confirmar_con_mesa
  before update of estado on public.reservas
  for each row execute function public.mesa_al_confirmar();
