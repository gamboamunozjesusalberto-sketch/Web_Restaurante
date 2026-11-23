-- ==========================================================================
-- PUNTO ASADO - EL CLIENTE CAMBIA LA FECHA U HORA DE SU RESERVA
-- Ejecutar UNA vez en Supabase → SQL Editor (después de 04-paquetes-opiniones.sql).
-- Se puede volver a ejecutar.
--
-- El cliente no tiene permiso para editar la tabla reservas directamente
-- (solo puede cancelar). Por eso el cambio pasa por la función
-- cambiar_reserva(), que revisa que la reserva sea suya, que siga pendiente
-- y que no sea de una fecha pasada. La nueva fecha y hora se validan con
-- las mismas reglas de una reserva nueva (horario, 60 días, segundo piso).
-- ==========================================================================

-- Validación (igual que en 04, pero sin contarse a sí misma al cambiar de fecha)
create or replace function public.validar_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  dia int := extract(dow from new.fecha);  -- 0 = domingo, 6 = sábado
  apertura time := case when dia in (0, 6) then time '12:00' else time '18:00' end;
  hoy date := (now() at time zone 'America/Lima')::date;
begin
  if new.fecha < hoy then
    raise exception 'No se puede reservar en una fecha pasada.';
  end if;
  if new.fecha = hoy and new.hora < (now() at time zone 'America/Lima')::time then
    raise exception 'Esa hora ya pasó.';
  end if;
  if new.fecha > hoy + 60 then
    raise exception 'Solo se puede reservar hasta 60 días antes.';
  end if;
  if new.hora < apertura or new.hora > time '22:30' then
    raise exception 'Ese día atendemos de % a 22:30.', to_char(apertura, 'HH24:MI');
  end if;

  -- personas según el paquete
  if new.paquete is null and new.personas > 10 then
    raise exception 'Para más de 10 personas elige el paquete Empresarial o Segundo piso exclusivo.';
  elsif new.paquete = 'Cumpleañero' and new.personas not between 2 and 10 then
    raise exception 'El paquete Cumpleañero es de 2 a 10 personas.';
  elsif new.paquete = 'Parrilla en vivo' and new.personas not between 4 and 10 then
    raise exception 'El paquete Parrilla en vivo es de 4 a 10 personas.';
  elsif new.paquete = 'Empresarial' and new.personas not between 8 and 30 then
    raise exception 'El paquete Empresarial es de 8 a 30 personas.';
  elsif new.paquete = 'Segundo piso exclusivo' and new.personas not between 15 and 40 then
    raise exception 'El Segundo piso exclusivo es de 15 a 40 personas.';
  end if;

  if new.paquete = 'Cumpleañero' then new.tipo := 'Cumpleaños'; end if;
  if new.paquete = 'Empresarial' then new.tipo := 'Reunión de trabajo'; end if;
  if new.paquete = 'Segundo piso exclusivo' then new.ubicacion := 'Segundo piso'; end if;

  -- el segundo piso exclusivo es uno por día y bloquea el segundo piso
  if new.ubicacion = 'Segundo piso' and exists (
       select 1 from public.reservas r
       where r.fecha = new.fecha and r.estado in ('pendiente', 'confirmada')
         and r.id is distinct from new.id  -- al cambiar la fecha, no contarse a sí misma
         and (r.paquete = 'Segundo piso exclusivo' or new.paquete = 'Segundo piso exclusivo')) then
    raise exception 'El segundo piso ya está reservado ese día. Elige el primer piso u otra fecha.';
  end if;

  new.estado := 'pendiente';  -- toda reserva nueva entra como pendiente
  return new;
end;
$$;

-- Ahora la validación también corre cuando cambia la fecha o la hora
drop trigger if exists antes_de_reservar on public.reservas;
create trigger antes_de_reservar
  before insert or update of fecha, hora on public.reservas
  for each row execute function public.validar_reserva();

create or replace function public.cambiar_reserva(p_id bigint, p_fecha date, p_hora time)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_id;
  if not found or r.usuario_id is distinct from auth.uid() then
    raise exception 'No encontramos esa reserva en tu cuenta.';
  end if;
  if r.estado <> 'pendiente' then
    raise exception 'Solo puedes cambiar una reserva pendiente. Si ya está confirmada, escríbenos por WhatsApp.';
  end if;
  if r.fecha < (now() at time zone 'America/Lima')::date then
    raise exception 'Esa reserva ya pasó.';
  end if;
  if r.fecha = p_fecha and r.hora = p_hora then
    raise exception 'Elige una fecha u hora distinta a la actual.';
  end if;

  update public.reservas set fecha = p_fecha, hora = p_hora where id = p_id;
end;
$$;

revoke execute on function public.cambiar_reserva(bigint, date, time) from public, anon;
grant  execute on function public.cambiar_reserva(bigint, date, time) to authenticated;
