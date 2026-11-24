-- ==========================================================================
-- PUNTO ASADO - ASISTENTE INTELIGENTE DE MESAS Y CANCELACIONES
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 09-mesas.sql.
-- Se puede volver a ejecutar.
--
-- 1. Más mesas: 15 en el primer piso, 12 en el segundo y 8 en el área libre
--    (son las que se ofrecen por la web; el local tiene más, pero no se muestran)
-- 2. Asistente de mesas: si el cliente no elige mesa, la base de datos le da
--    la mejor libre según su grupo, el piso que pidió, sus preferencias
--    (ventana, puerta), el tipo de reserva y el paquete
-- 3. Segundo piso exclusivo (evento cerrado): cuando el admin lo confirma,
--    las otras reservas del segundo piso de ese día se cancelan y a cada
--    cliente le llega una disculpa con otra mesa a la misma hora (o la más
--    cercana) y un 15% de descuento, que acepta con un botón en "Mi cuenta"
-- 4. El admin cancela o rechaza con un motivo y, si quiere, ofrece otra mesa,
--    otro horario y un descuento. El cliente recibe la notificación
-- 5. Reservas vencidas: las pendientes cuya fecha ya pasó quedan "vencidas"
--    y dejan de aparecer como "por confirmar"
-- 6. Datos de prueba para las mesas nuevas
-- ==========================================================================

-- ---------- 1. MESAS ----------
alter table public.mesas add column if not exists zona text;
alter table public.mesas add column if not exists etiquetas text[] not null default '{}';
alter table public.mesas drop constraint if exists mesas_piso_check;
alter table public.mesas add constraint mesas_piso_check
  check (piso in ('Primer piso', 'Segundo piso', 'Área libre'));

alter table public.reservas drop constraint if exists reservas_ubicacion_check;
alter table public.reservas add constraint reservas_ubicacion_check
  check (ubicacion in ('Primer piso', 'Segundo piso', 'Área libre'));

-- etiquetas que usa el asistente: ventana, puerta, parrilla, tranquila, grupo
insert into public.mesas (codigo, piso, capacidad, zona, etiquetas) values
  ('M1',  'Primer piso', 2,  'junto al ventanal',      '{ventana,tranquila}'),
  ('M2',  'Primer piso', 2,  'junto al ventanal',      '{ventana}'),
  ('M3',  'Primer piso', 2,  'junto al ventanal',      '{ventana}'),
  ('M4',  'Primer piso', 4,  'centro del salón',       '{}'),
  ('M5',  'Primer piso', 4,  'centro del salón',       '{}'),
  ('M6',  'Primer piso', 4,  'cerca de la entrada',    '{puerta}'),
  ('M7',  'Primer piso', 6,  'frente a la parrilla',   '{parrilla}'),
  ('M8',  'Primer piso', 6,  'centro del salón',       '{}'),
  ('M9',  'Primer piso', 8,  'junto a la barra',       '{grupo}'),
  ('M10', 'Primer piso', 10, 'mesa larga familiar',    '{grupo}'),
  ('M11', 'Primer piso', 2,  'junto al ventanal',      '{ventana,tranquila}'),
  ('M12', 'Primer piso', 4,  'frente a la parrilla',   '{parrilla}'),
  ('M13', 'Primer piso', 4,  'cerca de la entrada',    '{puerta}'),
  ('M14', 'Primer piso', 6,  'frente a la parrilla',   '{parrilla,grupo}'),
  ('M15', 'Primer piso', 8,  'cerca de la entrada',    '{puerta,grupo}'),
  ('S1',  'Segundo piso', 2,  'balcón',                 '{ventana,tranquila}'),
  ('S2',  'Segundo piso', 4,  'balcón',                 '{ventana}'),
  ('S3',  'Segundo piso', 4,  'balcón',                 '{ventana}'),
  ('S4',  'Segundo piso', 4,  'balcón',                 '{ventana}'),
  ('S5',  'Segundo piso', 6,  'salón privado',          '{tranquila}'),
  ('S6',  'Segundo piso', 6,  'salón privado',          '{tranquila}'),
  ('S7',  'Segundo piso', 8,  'junto a la cava de vinos','{grupo}'),
  ('S8',  'Segundo piso', 10, 'mesa larga para grupos', '{grupo}'),
  ('S9',  'Segundo piso', 2,  'rincón tranquilo',       '{tranquila}'),
  ('S10', 'Segundo piso', 2,  'rincón tranquilo',       '{tranquila}'),
  ('S11', 'Segundo piso', 4,  'salón privado',          '{tranquila}'),
  ('S12', 'Segundo piso', 6,  'junto a la escalera',    '{puerta}'),
  ('A1',  'Área libre', 2,  'jardín',                   '{tranquila}'),
  ('A2',  'Área libre', 2,  'jardín',                   '{tranquila}'),
  ('A3',  'Área libre', 4,  'terraza',                  '{}'),
  ('A4',  'Área libre', 4,  'terraza',                  '{}'),
  ('A5',  'Área libre', 4,  'terraza junto a la fogata','{parrilla}'),
  ('A6',  'Área libre', 6,  'bajo la pérgola',          '{grupo}'),
  ('A7',  'Área libre', 6,  'bajo la pérgola',          '{grupo}'),
  ('A8',  'Área libre', 8,  'mesa larga del jardín',    '{grupo,puerta}')
on conflict (codigo) do update
  set piso = excluded.piso, capacidad = excluded.capacidad, zona = excluded.zona, etiquetas = excluded.etiquetas;

-- ---------- columnas nuevas de reservas ----------
alter table public.reservas drop constraint if exists reservas_estado_check;
alter table public.reservas add constraint reservas_estado_check
  check (estado in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'vencida'));
alter table public.reservas add column if not exists motivo           text check (char_length(motivo) <= 500);
alter table public.reservas add column if not exists oferta_mesa      text references public.mesas (codigo);
alter table public.reservas add column if not exists oferta_fecha     date;
alter table public.reservas add column if not exists oferta_hora      time;
alter table public.reservas add column if not exists oferta_descuento int check (oferta_descuento between 0 and 50);
alter table public.reservas add column if not exists oferta_aceptada  boolean not null default false;
alter table public.reservas add column if not exists descuento        int check (descuento between 0 and 50);

-- Una mesa ofrecida a un cliente (por una cancelación) queda apartada para él
-- hasta que la acepte, igual que una reserva
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
  ) or exists (
    select 1 from public.reservas r
    where r.oferta_mesa = p_mesa and r.oferta_fecha = p_fecha and not r.oferta_aceptada
      and r.id is distinct from p_id
      and abs(extract(epoch from r.oferta_hora - p_hora)) < 2 * 3600
  );
$$;
revoke execute on function public.mesa_ocupada(text, date, time, bigint) from public, anon, authenticated;

-- mesas_ocupadas (de 09) ahora también muestra las mesas apartadas por una oferta
create or replace function public.mesas_ocupadas(p_fecha date)
returns table (mesa text, desde time, hasta time, motivo text)
language sql stable security definer set search_path = public
as $$
  select r.mesa, r.hora, (r.hora + interval '2 hours')::time, 'reserva'
  from public.reservas r
  where r.fecha = p_fecha and r.mesa is not null and r.estado in ('pendiente', 'confirmada')
  union all
  select r.oferta_mesa, r.oferta_hora, (r.oferta_hora + interval '2 hours')::time, 'reserva'
  from public.reservas r
  where r.oferta_fecha = p_fecha and r.oferta_mesa is not null and not r.oferta_aceptada
  union all
  select m.codigo, time '00:00', time '23:59', 'exclusivo'
  from public.mesas m
  where m.piso = 'Segundo piso' and exists (
    select 1 from public.reservas r
    where r.fecha = p_fecha and r.paquete = 'Segundo piso exclusivo' and r.estado in ('pendiente', 'confirmada'))
  order by 1, 2;
$$;

-- ---------- 2. ASISTENTE: LA MEJOR MESA LIBRE ----------
-- Da puntos a cada mesa libre y devuelve la de más puntos:
--   - que sobren pocos asientos (no poner a 2 personas en una mesa de 10)
--   - que esté en el piso que pidió el cliente
--   - preferencias: ventana, puerta; paquete Parrilla en vivo → cerca de la parrilla;
--     Aniversario → zona tranquila; grupos grandes → mesas de grupo
--   - que encaje justo antes o después de otra reserva (así se llenan mejor los horarios)
create or replace function public.mejor_mesa(
  p_fecha date, p_hora time, p_personas int,
  p_ubicacion text default null, p_preferencias text default null,
  p_tipo text default null, p_paquete text default null,
  p_excluir bigint default null, p_pisos text[] default null)
returns text
language sql stable security definer set search_path = public
as $$
  select m.codigo
  from public.mesas m
  where m.capacidad >= p_personas
    and (p_pisos is null or m.piso = any (p_pisos))
    and not public.mesa_ocupada(m.codigo, p_fecha, p_hora, p_excluir)
    -- con el Segundo piso exclusivo, sus mesas no se dan a nadie más
    and not (m.piso = 'Segundo piso' and exists (
      select 1 from public.reservas x
      where x.fecha = p_fecha and x.paquete = 'Segundo piso exclusivo'
        and x.estado in ('pendiente', 'confirmada') and x.id is distinct from p_excluir))
  order by
    ( - (m.capacidad - p_personas) * 10
      + case when m.piso = p_ubicacion then 30 else 0 end
      + case when p_preferencias ilike '%ventana%' and 'ventana' = any (m.etiquetas) then 15 else 0 end
      + case when p_preferencias ilike '%puerta%'  and 'puerta'  = any (m.etiquetas) then 15 else 0 end
      + case when p_paquete = 'Parrilla en vivo'   and 'parrilla' = any (m.etiquetas) then 20 else 0 end
      + case when p_tipo = 'Aniversario'           and 'tranquila' = any (m.etiquetas) then 10 else 0 end
      + case when p_personas >= 7                  and 'grupo' = any (m.etiquetas) then 5 else 0 end
      + 4 * (select count(*) from public.reservas r
             where r.mesa = m.codigo and r.fecha = p_fecha and r.estado in ('pendiente', 'confirmada')
               and abs(extract(epoch from r.hora - p_hora)) between 2 * 3600 and 2.5 * 3600)
    ) desc, m.capacidad, m.codigo
  limit 1;
$$;
revoke execute on function public.mejor_mesa(date, time, int, text, text, text, text, bigint, text[]) from public, anon;
grant  execute on function public.mejor_mesa(date, time, int, text, text, text, text, bigint, text[]) to authenticated;

-- Hasta 3 opciones para reubicar una reserva: la misma hora primero y luego
-- las horas más cercanas del mismo día (dentro del horario de atención)
create or replace function public.sugerir_mesas(p_id bigint, p_pisos text[] default null)
returns table (mesa text, piso text, zona text, fecha date, hora time)
language plpgsql stable security definer set search_path = public
as $$
declare
  r public.reservas;
  apertura time;
  h time;
  v_codigo text;
  n int := 0;
begin
  select * into r from public.reservas where id = p_id;
  if not found then return; end if;
  if not public.es_admin() and r.usuario_id is distinct from auth.uid() then return; end if;
  apertura := case when extract(dow from r.fecha) in (0, 6) then time '12:00' else time '18:00' end;
  for h in
    select t::time from generate_series(r.fecha + apertura, r.fecha + time '22:30', interval '30 minutes') t
    where r.fecha > (now() at time zone 'America/Lima')::date
       or t::time > (now() at time zone 'America/Lima')::time
    order by abs(extract(epoch from t::time - r.hora)), t
  loop
    v_codigo := public.mejor_mesa(r.fecha, h, least(r.personas, 10), r.ubicacion, r.preferencias, r.tipo, r.paquete, r.id, p_pisos);
    -- no ofrecer el mismo lugar que se está cancelando
    if v_codigo is not null and not (v_codigo is not distinct from r.mesa and h = r.hora) then
      select m.codigo, m.piso, m.zona, r.fecha, h into mesa, piso, zona, fecha, hora from public.mesas m where m.codigo = v_codigo;
      return next;
      n := n + 1;
      exit when n >= 3;
    end if;
  end loop;
end;
$$;
revoke execute on function public.sugerir_mesas(bigint, text[]) from public, anon;
grant  execute on function public.sugerir_mesas(bigint, text[]) to authenticated;

-- ---------- VALIDACIÓN (reemplaza la de 09) ----------
create or replace function public.validar_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  dia int := extract(dow from new.fecha);  -- 0 = domingo, 6 = sábado
  apertura time := case when dia in (0, 6) then time '12:00' else time '18:00' end;
  hoy date := (now() at time zone 'America/Lima')::date;
  m public.mesas;
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

    -- el asistente elige la mesa si el cliente no eligió una
    if new.mesa is null and new.personas <= 10 and new.paquete is distinct from 'Segundo piso exclusivo'
       and new.estado in ('pendiente', 'confirmada') then
      new.mesa := public.mejor_mesa(new.fecha, new.hora, new.personas, new.ubicacion,
                                    new.preferencias, new.tipo, new.paquete, new.id);
    end if;
  end if;

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

  if new.estado in ('pendiente', 'confirmada')
     and (cambia_fecha or new.ubicacion is distinct from old.ubicacion) then
    if new.paquete = 'Segundo piso exclusivo' then
      -- un solo evento cerrado por día; las mesas sueltas del segundo piso se reubican al confirmarlo
      if exists (select 1 from public.reservas r
                 where r.fecha = new.fecha and r.paquete = 'Segundo piso exclusivo'
                   and r.estado in ('pendiente', 'confirmada') and r.id is distinct from new.id) then
        raise exception 'El segundo piso ya está reservado como evento exclusivo ese día. Elige otra fecha.';
      end if;
    elsif new.ubicacion = 'Segundo piso' and exists (
       select 1 from public.reservas r
       where r.fecha = new.fecha and r.paquete = 'Segundo piso exclusivo'
         and r.estado in ('pendiente', 'confirmada') and r.id is distinct from new.id) then
      raise exception 'El segundo piso está cerrado por un evento ese día. Elige el primer piso o el área libre.';
    end if;
  end if;

  if tg_op = 'INSERT' or (cambia_fecha and new.estado <> 'cancelada') then
    new.estado := 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists antes_de_reservar on public.reservas;
create trigger antes_de_reservar
  before insert or update of fecha, hora, mesa on public.reservas
  for each row execute function public.validar_reserva();

-- El aviso automático de confirmada / rechazada no se manda si ya va un
-- mensaje propio (con motivo) para no duplicar notificaciones
create or replace function public.avisar_estado_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado is distinct from old.estado and new.estado in ('confirmada', 'rechazada')
     and new.motivo is not distinct from old.motivo then
    insert into public.notificaciones (usuario_id, titulo, mensaje)
    values (
      new.usuario_id,
      case when new.estado = 'confirmada' then 'Tu reserva está confirmada' else 'Tu reserva no pudo confirmarse' end,
      format('Reserva del %s a las %s para %s %s%s: %s',
             to_char(new.fecha, 'DD/MM/YYYY'), to_char(new.hora, 'HH24:MI'),
             new.personas, case when new.personas = 1 then 'persona' else 'personas' end,
             case when new.mesa is not null and new.estado = 'confirmada' then ', mesa ' || new.mesa else '' end,
             case when new.estado = 'confirmada' then '¡te esperamos!' else 'escríbenos por WhatsApp para buscar otro horario.' end)
    );
  end if;
  return new;
end;
$$;

-- ---------- texto de la oferta (lo usan 3 y 4) ----------
create or replace function public.texto_oferta(p_mesa text, p_fecha date, p_hora time, p_descuento int)
returns text
language sql stable security definer set search_path = public
as $$
  select case when p_mesa is null then '' else
    format(' Te ofrecemos la mesa %s (%s, %s) el %s a las %s%s. Acéptala con un toque desde Mi cuenta.',
      m.codigo, lower(m.piso), m.zona, to_char(p_fecha, 'DD/MM'), to_char(p_hora, 'HH24:MI'),
      case when coalesce(p_descuento, 0) > 0 then format(', con %s%% de descuento en tu consumo', p_descuento) else '' end)
  end
  from (select 1) uno left join public.mesas m on m.codigo = p_mesa;
$$;

-- ---------- 3. EVENTO CERRADO: REUBICAR AL SEGUNDO PISO ----------
create or replace function public.reubicar_por_exclusivo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r public.reservas;
  op record;
begin
  if new.paquete is distinct from 'Segundo piso exclusivo' or new.estado <> 'confirmada'
     or old.estado = 'confirmada' then
    return new;
  end if;
  for r in
    select * from public.reservas x
    where x.fecha = new.fecha and x.id <> new.id and x.ubicacion = 'Segundo piso'
      and x.estado in ('pendiente', 'confirmada')
  loop
    select * into op from public.sugerir_mesas(r.id, array['Primer piso', 'Área libre']) limit 1;
    update public.reservas set
      estado = 'cancelada',
      motivo = 'El segundo piso se cerró para un evento privado.',
      oferta_mesa = op.mesa, oferta_fecha = op.fecha, oferta_hora = op.hora,
      oferta_descuento = case when op.mesa is not null then 15 end
    where id = r.id;
    insert into public.notificaciones (usuario_id, titulo, mensaje)
    values (r.usuario_id, 'Te pedimos disculpas: cambiamos tu reserva',
      format('Tu reserva del %s a las %s en el segundo piso se canceló porque ese día el piso se cerró para un evento privado. Lo sentimos mucho.%s',
             to_char(r.fecha, 'DD/MM'), to_char(r.hora, 'HH24:MI'),
             case when op.mesa is not null then public.texto_oferta(op.mesa, op.fecha, op.hora, 15)
                  else ' Escríbenos por WhatsApp y te buscamos otro día con 15% de descuento.' end));
  end loop;
  return new;
end;
$$;

drop trigger if exists al_confirmar_exclusivo on public.reservas;
create trigger al_confirmar_exclusivo
  after update of estado on public.reservas
  for each row execute function public.reubicar_por_exclusivo();

-- ---------- 4. EL ADMIN CANCELA CON MOTIVO Y OFERTA ----------
create or replace function public.cancelar_con_aviso(
  p_id bigint, p_motivo text,
  p_oferta_mesa text default null, p_oferta_fecha date default null,
  p_oferta_hora time default null, p_descuento int default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.reservas;
  nuevo text;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede hacer esto.';
  end if;
  select * into r from public.reservas where id = p_id;
  if not found or r.estado not in ('pendiente', 'confirmada') then
    raise exception 'Esa reserva ya no está activa.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo para el cliente.';
  end if;
  if p_oferta_mesa is not null then
    if p_oferta_fecha is null or p_oferta_hora is null then
      raise exception 'Indica fecha y hora de la mesa que ofreces.';
    end if;
    if public.mesa_ocupada(p_oferta_mesa, p_oferta_fecha, p_oferta_hora, p_id) then
      raise exception 'La mesa % ya está tomada a esa hora.', p_oferta_mesa;
    end if;
    if (select capacidad from public.mesas where codigo = p_oferta_mesa) < least(r.personas, 10) then
      raise exception 'La mesa % es chica para ese grupo.', p_oferta_mesa;
    end if;
  end if;

  nuevo := case when r.estado = 'pendiente' then 'rechazada' else 'cancelada' end;
  update public.reservas set
    estado = nuevo, motivo = trim(p_motivo),
    oferta_mesa = p_oferta_mesa, oferta_fecha = p_oferta_fecha, oferta_hora = p_oferta_hora,
    oferta_descuento = case when p_oferta_mesa is not null then nullif(p_descuento, 0) end
  where id = p_id;

  insert into public.notificaciones (usuario_id, titulo, mensaje)
  values (r.usuario_id,
    case when nuevo = 'rechazada' then 'No pudimos confirmar tu reserva' else 'Tuvimos que cancelar tu reserva' end,
    format('Reserva del %s a las %s. Motivo: %s%s', to_char(r.fecha, 'DD/MM'), to_char(r.hora, 'HH24:MI'),
           trim(p_motivo) || case when trim(p_motivo) ~ '[.!?]$' then '' else '.' end,
           public.texto_oferta(p_oferta_mesa, p_oferta_fecha, p_oferta_hora, p_descuento)));
end;
$$;
revoke execute on function public.cancelar_con_aviso(bigint, text, text, date, time, int) from public, anon;
grant  execute on function public.cancelar_con_aviso(bigint, text, text, date, time, int) to authenticated;

-- El cliente acepta la mesa ofrecida: se crea una reserva nueva, ya confirmada
create or replace function public.aceptar_oferta(p_id bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  r public.reservas;
  nueva bigint;
begin
  select * into r from public.reservas where id = p_id;
  if not found or r.usuario_id is distinct from auth.uid() then
    raise exception 'No encontramos esa reserva en tu cuenta.';
  end if;
  if r.oferta_mesa is null or r.oferta_aceptada then
    raise exception 'Esa oferta ya no está disponible.';
  end if;
  update public.reservas set oferta_aceptada = true where id = p_id;  -- suelta la mesa apartada
  insert into public.reservas
    (usuario_id, fecha, hora, personas, tipo, ubicacion, paquete, pedido, preferencias, mensaje, mesa, descuento)
  values
    (r.usuario_id, r.oferta_fecha, r.oferta_hora, least(r.personas, 10), r.tipo, 'Primer piso',
     case when r.paquete = 'Segundo piso exclusivo' then null else r.paquete end,
     r.pedido, r.preferencias, format('Reubicada desde la reserva #%s', r.id), r.oferta_mesa, r.oferta_descuento)
  returning id into nueva;
  update public.reservas set estado = 'confirmada' where id = nueva;  -- ya la ofreció el restaurante
  return nueva;
end;
$$;
revoke execute on function public.aceptar_oferta(bigint) from public, anon;
grant  execute on function public.aceptar_oferta(bigint) to authenticated;

-- ---------- 5. RESERVAS VENCIDAS ----------
-- Pendientes cuya fecha (u hora de hoy) ya pasó: nadie las confirmó, quedan vencidas.
create or replace function public.vencer_reservas()
returns int
language sql security definer set search_path = public
as $$
  with v as (
    update public.reservas set estado = 'vencida'
    where estado = 'pendiente'
      and (fecha < (now() at time zone 'America/Lima')::date
           or (fecha = (now() at time zone 'America/Lima')::date
               and hora < (now() at time zone 'America/Lima')::time))
    returning 1)
  select count(*)::int from v;
$$;
revoke execute on function public.vencer_reservas() from public, anon;
grant  execute on function public.vencer_reservas() to authenticated;
select public.vencer_reservas() as reservas_vencidas;

-- ---------- 6. DATOS DE PRUEBA PARA LAS MESAS NUEVAS ----------
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
  if clientes is null then return; end if;

  alter table public.reservas disable trigger al_cambiar_estado_reserva;
  for d in select generate_series(hoy, hoy + 13, interval '1 day')::date loop
    for m in select * from public.mesas where codigo in
             ('M11','M12','M13','M14','M15','S9','S10','S11','S12','A1','A2','A3','A4','A5','A6','A7','A8') loop
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
      exception when others then null;
      end;
    end loop;
  end loop;
  alter table public.reservas enable trigger al_cambiar_estado_reserva;
end;
$$;

-- Revisión
select piso, count(*) as mesas, sum(capacidad) as asientos from public.mesas group by piso order by piso;
