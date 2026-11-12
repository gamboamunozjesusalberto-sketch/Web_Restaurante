-- ==========================================================================
-- PUNTO ASADO - AVISO AL CLIENTE CUANDO SE CONFIRMA O RECHAZA SU RESERVA
-- Ejecutar UNA vez en Supabase → SQL Editor (después de esquema.sql).
-- Cuando el admin cambia el estado de una reserva a "confirmada" o
-- "rechazada", el cliente recibe una notificación en "Mi cuenta".
-- ==========================================================================

create or replace function public.avisar_estado_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado is distinct from old.estado and new.estado in ('confirmada', 'rechazada') then
    insert into public.notificaciones (usuario_id, titulo, mensaje)
    values (
      new.usuario_id,
      case when new.estado = 'confirmada' then 'Tu reserva está confirmada' else 'Tu reserva no pudo confirmarse' end,
      format('Reserva del %s a las %s para %s %s: %s',
             to_char(new.fecha, 'DD/MM/YYYY'), to_char(new.hora, 'HH24:MI'),
             new.personas, case when new.personas = 1 then 'persona' else 'personas' end,
             case when new.estado = 'confirmada' then '¡te esperamos!' else 'escríbenos por WhatsApp para buscar otro horario.' end)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists al_cambiar_estado_reserva on public.reservas;
create trigger al_cambiar_estado_reserva
  after update of estado on public.reservas
  for each row execute function public.avisar_estado_reserva();
