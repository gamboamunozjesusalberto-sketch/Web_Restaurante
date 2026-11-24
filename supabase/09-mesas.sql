-- ==========================================================================
-- PUNTO ASADO - MAPA DE MESAS
-- Ejecutar UNA vez en Supabase → SQL Editor (después de 05 y, si los usan,
-- de 06 y 07 con los datos de prueba). Se puede volver a ejecutar.
--
-- 1. Tabla mesas: las 18 mesas del local (10 en el primer piso, 8 en el segundo)
-- 2. Columna reservas.mesa: la mesa que eligió el cliente o que asignó el admin
-- 3. validar_reserva(): ahora también revisa que la mesa exista, que alcance
--    para las personas y que nadie la tenga reservada en esas 2 horas
-- 4. mesas_ocupadas(fecha): qué mesas están tomadas ese día y de qué hora a
--    qué hora (sin nombres ni datos de clientes: la puede ver cualquiera)
-- 5. El admin puede asignar o cambiar la mesa de una reserva
-- 6. Datos de prueba: a las reservas DEMO se les asigna una mesa
-- 7. Datos de prueba: más reservas DEMO con mesa en las próximas 2 semanas
--
-- Cada reserva ocupa su mesa 2 horas desde la hora reservada.
-- ==========================================================================

-- ---------- 1. MESAS ----------
create table if not exists public.mesas (
  codigo     text primary key,
  piso       text not null check (piso in ('Primer piso', 'Segundo piso')),
  capacidad  int  not null check (capacidad between 1 and 12)
);

insert into public.mesas (codigo, piso, capacidad) values
  ('M1', 'Primer piso', 2), ('M2', 'Primer piso', 2), ('M3', 'Primer piso', 2),
  ('M4', 'Primer piso', 4), ('M5', 'Primer piso', 4), ('M6', 'Primer piso', 4),
  ('M7', 'Primer piso', 6), ('M8', 'Primer piso', 6), ('M9', 'Primer piso', 8),
  ('M10', 'Primer piso', 10),
  ('S1', 'Segundo piso', 2), ('S2', 'Segundo piso', 4), ('S3', 'Segundo piso', 4),
  ('S4', 'Segundo piso', 4), ('S5', 'Segundo piso', 6), ('S6', 'Segundo piso', 6),
  ('S7', 'Segundo piso', 8), ('S8', 'Segundo piso', 10)
on conflict (codigo) do update set piso = excluded.piso, capacidad = excluded.capacidad;

alter table public.mesas enable row level security;
drop policy if exists "ver mesas" on public.mesas;
create policy "ver mesas" on public.mesas for select using (true);
grant select on public.mesas to anon, authenticated;

-- ---------- 2. COLUMNA MESA ----------
alter table public.reservas add column if not exists mesa text references public.mesas (codigo);
create index if not exists reservas_fecha_mesa_idx on public.reservas (fecha, mesa);

-- ¿Otra reserva activa tiene esa mesa a menos de 2 horas de esa hora?
create or replace function public.mesa_ocupada(p_mesa text, p_fecha date, p_hora time, p_id bigint default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where r.mesa = p_mesa and r.fecha = p_fecha
      and r.estado in ('pendiente', 'confirmada')
      and r.id is distinct from p_id
      and abs(extract(epoch from r.hora - p_hora)) < 2 * 3600
  );
$$;
revoke execute on function public.mesa_ocupada(text, date, time, bigint) from public, anon, authenticated;

-- ---------- 3. VALIDACIÓN ----------
create or replace function public.validar_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  dia int := extract(dow from new.fecha);  -- 0 = domingo, 6 = sábado
  apertura time := case when dia in (0, 6) then time '12:00' else time '18:00' end;
  hoy date := (now() at time zone 'America/Lima')::date;
  m public.mesas;
  -- si el admin solo cambia la mesa, no se revisan otra vez fecha, hora ni estado
  cambia_fecha boolean := tg_op = 'INSERT' or new.fecha is distinct from old.fecha
                          or new.hora is distinct from old.hora;
begin
  if cambia_fecha then
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
  end if;

  -- la mesa elegida define el piso
  if new.mesa is not null then
    if new.paquete = 'Segundo piso exclusivo' then
      raise exception 'El Segundo piso exclusivo ocupa todo el piso: no se elige mesa.';
    end if;
    select * into m from public.mesas where codigo = new.mesa;
    if not found then
      raise exception 'La mesa % no existe.', new.mesa;
    end if;
    if new.personas > m.capacidad then
      raise exception 'La mesa % es para % personas como máximo.', m.codigo, m.capacidad;
    end if;
    new.ubicacion := m.piso;
    if new.estado in ('pendiente', 'confirmada')
       and public.mesa_ocupada(new.mesa, new.fecha, new.hora, new.id) then
      raise exception 'La mesa % ya está reservada cerca de esa hora. Elige otra mesa u otra hora.', new.mesa;
    end if;
  end if;
  if new.paquete = 'Segundo piso exclusivo' then new.ubicacion := 'Segundo piso'; end if;

  -- el segundo piso exclusivo es uno por día y bloquea el segundo piso
  -- (se revisa si cambia la fecha, la hora o el piso)
  if new.ubicacion = 'Segundo piso' and new.estado in ('pendiente', 'confirmada')
     and (cambia_fecha or new.ubicacion is distinct from old.ubicacion) and exists (
       select 1 from public.reservas r
       where r.fecha = new.fecha and r.estado in ('pendiente', 'confirmada')
         and r.ubicacion = 'Segundo piso'
         and r.id is distinct from new.id
         and (r.paquete = 'Segundo piso exclusivo' or new.paquete = 'Segundo piso exclusivo')) then
    raise exception 'El segundo piso ya está reservado ese día. Elige el primer piso u otra fecha.';
  end if;

  if tg_op = 'INSERT' or (cambia_fecha and new.estado <> 'cancelada') then
    new.estado := 'pendiente';  -- reserva nueva o cambiada: el restaurante la vuelve a confirmar
  end if;
  return new;
end;
$$;

drop trigger if exists antes_de_reservar on public.reservas;
create trigger antes_de_reservar
  before insert or update of fecha, hora, mesa on public.reservas
  for each row execute function public.validar_reserva();

-- Al cambiar fecha u hora, el cliente conserva su mesa si sigue libre;
-- si no, queda "sin mesa" y el restaurante le asigna otra.
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

  update public.reservas
     set fecha = p_fecha, hora = p_hora,
         mesa = case when r.mesa is not null and public.mesa_ocupada(r.mesa, p_fecha, p_hora, p_id)
                     then null else r.mesa end
   where id = p_id;
end;
$$;
revoke execute on function public.cambiar_reserva(bigint, date, time) from public, anon;
grant  execute on function public.cambiar_reserva(bigint, date, time) to authenticated;

-- ---------- 4. MESAS OCUPADAS DE UN DÍA (público, sin datos personales) ----------
create or replace function public.mesas_ocupadas(p_fecha date)
returns table (mesa text, desde time, hasta time, motivo text)
language sql stable security definer set search_path = public
as $$
  select r.mesa, r.hora, (r.hora + interval '2 hours')::time, 'reserva'
  from public.reservas r
  where r.fecha = p_fecha and r.mesa is not null
    and r.estado in ('pendiente', 'confirmada')
  union all
  -- con el Segundo piso exclusivo, todas sus mesas quedan tomadas el día entero
  select m.codigo, time '00:00', time '23:59', 'exclusivo'
  from public.mesas m
  where m.piso = 'Segundo piso' and exists (
    select 1 from public.reservas r
    where r.fecha = p_fecha and r.paquete = 'Segundo piso exclusivo'
      and r.estado in ('pendiente', 'confirmada'))
  order by 1, 2;
$$;
revoke execute on function public.mesas_ocupadas(date) from public;
grant  execute on function public.mesas_ocupadas(date) to anon, authenticated;

-- ---------- 5. EL ADMIN ASIGNA MESAS ----------
-- (la política "admin cambia estado" ya deja al admin editar cualquier reserva;
--  aquí solo se habilita también la columna mesa)
grant update (estado, mesa) on public.reservas to authenticated;

-- ---------- 6. DATOS DE PRUEBA: MESA PARA LAS RESERVAS DEMO ----------
-- A cada reserva DEMO activa (de 10 personas o menos) se le da la mesa libre
-- más chica en la que entra, en su piso. Una de cada 8 queda "sin mesa" para
-- que el admin vea cómo se asigna. Si no hay reservas DEMO, no hace nada.
do $$
declare
  r record;
  libre text;
begin
  for r in
    select id, fecha, hora, personas, ubicacion
    from public.reservas
    where mensaje = 'DEMO - dato de prueba para el dashboard'
      and mesa is null and estado in ('pendiente', 'confirmada')
      and personas <= 10 and paquete is distinct from 'Segundo piso exclusivo'
    order by fecha, hora, id
  loop
    continue when r.id % 8 = 0;
    select m.codigo into libre
    from public.mesas m
    where m.capacidad >= r.personas
      and m.piso = r.ubicacion
      and not public.mesa_ocupada(m.codigo, r.fecha, r.hora, r.id)
    order by m.capacidad, m.codigo
    limit 1;
    if libre is not null then
      begin
        update public.reservas set mesa = libre where id = r.id;
      exception when others then null;  -- si choca con alguna regla, se queda sin mesa
      end;
    end if;
  end loop;
end;
$$;

-- ---------- 7. DATOS DE PRUEBA: MÁS RESERVAS LAS PRÓXIMAS 2 SEMANAS ----------
-- Para que el mapa se vea con movimiento en la presentación: cerca de la mitad
-- de las mesas tiene una reserva DEMO cada día (más los fines de semana).
-- Siempre salen las mismas, así que se puede volver a ejecutar sin duplicar.
-- Se borran con el mismo comando de 07: delete ... where mensaje = 'DEMO - ...'.
do $$
declare
  marca    constant text := 'DEMO - dato de prueba para el dashboard';
  hoy      date := (now() at time zone 'America/Lima')::date;
  noche    time[] := array['19:00','19:30','20:00','20:30','21:00','21:30']::time[];
  almuerzo time[] := array['12:30','13:00','13:30','14:00']::time[];
  clientes uuid[];
  d date;
  m public.mesas;
  h int;
  v_hora time;
  nuevo bigint;
begin
  select array_agg(p.id order by p.id) into clientes
  from public.perfiles p join auth.users u on u.id = p.id
  where u.email like '%@demo.puntoasado.pe';
  if clientes is null then
    select array_agg(id) into clientes from public.perfiles where rol = 'admin';
  end if;
  if clientes is null then
    raise notice 'No hay clientes de prueba ni admin: se omiten las reservas DEMO de mesas.';
    return;
  end if;

  alter table public.reservas disable trigger al_cambiar_estado_reserva;  -- sin avisos a clientes falsos
  for d in select generate_series(hoy, hoy + 13, interval '1 day')::date loop
    for m in select * from public.mesas order by codigo loop
      h := abs(hashtext(d::text || m.codigo)) % 100;
      continue when h >= case when extract(dow from d) in (0, 5, 6) then 60 else 40 end;
      continue when exists (select 1 from public.reservas r where r.fecha = d and r.mesa = m.codigo
                            and r.estado in ('pendiente', 'confirmada'));
      v_hora := case when extract(dow from d) in (0, 6) and h % 3 = 0
                     then almuerzo[1 + h % array_length(almuerzo, 1)]
                     else noche[1 + h % array_length(noche, 1)] end;
      begin
        insert into public.reservas (usuario_id, fecha, hora, personas, mesa, pedido, mensaje)
        values (clientes[1 + h % array_length(clientes, 1)], d, v_hora,
                greatest(1, m.capacidad - h % 2 - (h / 10) % greatest(m.capacidad / 2, 1)),
                m.codigo, '{}', marca)
        returning id into nuevo;
        if h % 5 < 3 then
          update public.reservas set estado = 'confirmada' where id = nuevo;
        end if;
      exception when others then null;  -- hora pasada, segundo piso exclusivo, etc.: se salta
      end;
    end loop;
  end loop;
  alter table public.reservas enable trigger al_cambiar_estado_reserva;
end;
$$;

-- Revisión: reservas activas de hoy en adelante, con y sin mesa
select count(*) filter (where mesa is not null) as con_mesa,
       count(*) filter (where mesa is null)     as sin_mesa
from public.reservas
where fecha >= (now() at time zone 'America/Lima')::date
  and estado in ('pendiente', 'confirmada');
