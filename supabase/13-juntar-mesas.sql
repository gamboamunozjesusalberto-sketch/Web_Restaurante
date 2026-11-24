-- ==========================================================================
-- PUNTO ASADO - JUNTAR MESAS PARA GRUPOS GRANDES
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 12-confirmar-con-mesa.sql.
-- Se puede volver a ejecutar. Si vuelves a ejecutar 10, 11 o 12, ejecuta
-- también este otra vez (este archivo amplía funciones de esos scripts).
--
-- Ninguna mesa suelta alcanza para más de 10 personas. Ahora una reserva
-- puede tener una mesa principal (mesa) y hasta 3 mesas más (mesas_extra):
-- - el asistente (mejor_juntas) busca 2, 3 o 4 mesas libres del mismo piso,
--   las que estén más cerca entre sí y desperdicien menos sillas
-- - al reservar o confirmar un grupo grande (Empresarial) se juntan solas
-- - el mozo puede "Juntar mesas" desde el Salón en vivo y sentar a un grupo
--   sin reserva más grande que la mesa que tocó (se le suman las vecinas)
-- - todas las mesas juntadas cuentan como ocupadas en el mapa
-- ==========================================================================

-- ---------- 1. POSICIÓN DE CADA MESA (igual que js/mesas.js) ----------
alter table public.mesas add column if not exists x int;
alter table public.mesas add column if not exists y int;
update public.mesas m set x = v.x, y = v.y
from (values
  ('M1', 10, 25), ('M2', 10, 42), ('M3', 10, 59), ('M11', 10, 76), ('M4', 26, 28), ('M5', 26, 51),
  ('M6', 26, 76), ('M7', 44, 28), ('M8', 44, 51), ('M13', 40, 77), ('M12', 61, 28), ('M14', 76, 28),
  ('M9', 67, 51), ('M10', 58, 77), ('M15', 79, 72),
  ('S1', 10, 24), ('S2', 26, 24), ('S3', 43, 24), ('S4', 60, 24), ('S9', 76, 24), ('S5', 17, 51),
  ('S6', 39, 51), ('S7', 63, 51), ('S10', 80, 51), ('S11', 13, 78), ('S8', 43, 78), ('S12', 72, 78),
  ('A1', 11, 30), ('A2', 11, 62), ('A3', 30, 22), ('A4', 30, 70), ('A5', 68, 40), ('A8', 80, 18),
  ('A6', 64, 78), ('A7', 84, 78)
) as v (codigo, x, y)
where m.codigo = v.codigo;

-- ---------- 2. MESAS EXTRA DE UNA RESERVA ----------
alter table public.reservas add column if not exists mesas_extra text[] not null default '{}';

-- Una mesa también está ocupada si se juntó para otro grupo
create or replace function public.mesa_ocupada(p_mesa text, p_fecha date, p_hora time, p_id bigint default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where (r.mesa = p_mesa or p_mesa = any (r.mesas_extra)) and r.fecha = p_fecha
      and r.estado in ('pendiente', 'confirmada') and r.liberada_en is null
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

create or replace function public.mesas_ocupadas(p_fecha date)
returns table (mesa text, desde time, hasta time, motivo text)
language sql stable security definer set search_path = public
as $$
  select m.codigo, r.hora, (r.hora + interval '2 hours')::time, 'reserva'
  from public.reservas r
  cross join lateral unnest(array[r.mesa] || r.mesas_extra) as m (codigo)
  where r.fecha = p_fecha and m.codigo is not null and r.estado in ('pendiente', 'confirmada')
    and r.liberada_en is null
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

-- "mesa M4" o "mesas M10 + M15" (para los avisos)
create or replace function public.texto_mesas(p_mesa text, p_extra text[])
returns text
language sql immutable
as $$
  select case
    when p_mesa is null then null
    when coalesce(cardinality(p_extra), 0) = 0 then 'mesa ' || p_mesa
    else 'mesas ' || array_to_string(array[p_mesa] || p_extra, ' + ')
  end;
$$;

-- ---------- 3. EL ASISTENTE JUNTA MESAS ----------
-- Devuelve las mesas a juntar (la más grande primero) o null si no hay:
--   - todas libres a esa hora y en el mismo piso, hasta 4 mesas
--   - puntaje: menos mesas, menos sillas sobrantes, mesas más cerca entre sí
--     y en el piso pedido
--   - p_incluir: una mesa que sí o sí debe estar (la que tocó el mozo)
create or replace function public.mejor_juntas(
  p_fecha date, p_hora time, p_personas int,
  p_ubicacion text default null, p_excluir bigint default null,
  p_incluir text default null, p_pisos text[] default null)
returns text[]
language sql stable security definer set search_path = public
as $$
  with recursive libres as (
    select m.codigo, m.piso, m.capacidad, coalesce(m.x, 50) as x, coalesce(m.y, 50) as y
    from public.mesas m
    where (p_pisos is null or m.piso = any (p_pisos))
      and not public.mesa_ocupada(m.codigo, p_fecha, p_hora, p_excluir)
      and not (m.piso = 'Segundo piso' and exists (
        select 1 from public.reservas x
        where x.fecha = p_fecha and x.paquete = 'Segundo piso exclusivo'
          and x.estado in ('pendiente', 'confirmada') and x.id is distinct from p_excluir))
  ),
  combos as (
    select array[l.codigo] as mesas, l.piso, l.capacidad as total,
           l.x as minx, l.x as maxx, l.y as miny, l.y as maxy, l.codigo as ultimo
    from libres l
    union all
    select c.mesas || l.codigo, c.piso, c.total + l.capacidad,
           least(c.minx, l.x), greatest(c.maxx, l.x), least(c.miny, l.y), greatest(c.maxy, l.y), l.codigo
    from combos c
    join libres l on l.piso = c.piso and l.codigo > c.ultimo
    where c.total < p_personas and cardinality(c.mesas) < 4
  ),
  mejor as (
    select c.mesas
    from combos c
    where c.total >= p_personas
      and (p_incluir is null or p_incluir = any (c.mesas))
      and (c.maxx - c.minx) + (c.maxy - c.miny) <= 70          -- que de verdad se puedan juntar
    order by (cardinality(c.mesas) - 1) * 25                   -- cuantas menos mesas, mejor
             + (c.total - p_personas) * 10                       -- sillas que sobran
             + 2 * ((c.maxx - c.minx) + (c.maxy - c.miny))      -- qué tan separadas están
             + case when c.piso = p_ubicacion then 0 else 30 end,
             c.mesas
    limit 1
  )
  select array(
    select u from mejor, unnest(mejor.mesas) as u
    join public.mesas m on m.codigo = u
    order by (u = p_incluir) desc, m.capacidad desc, u)
  from mejor;
$$;
revoke execute on function public.mejor_juntas(date, time, int, text, bigint, text, text[]) from public, anon;
grant  execute on function public.mejor_juntas(date, time, int, text, bigint, text, text[]) to authenticated;

-- ---------- 4. VALIDACIÓN ----------
-- La capacidad cuenta la mesa principal más las juntadas
do $$
declare
  cuerpo text;
  nuevo text;
begin
  select pg_get_functiondef('public.validar_reserva()'::regprocedure) into cuerpo;
  if position('mesas_extra' in cuerpo) = 0 then
    nuevo := replace(cuerpo,
      '    if new.personas > m.capacidad then
      raise exception ''La mesa % es para % personas como máximo.'', m.codigo, m.capacidad;',
      '    if new.personas > m.capacidad + coalesce((select sum(x.capacidad) from public.mesas x
                                                where x.codigo = any (new.mesas_extra)), 0) then
      raise exception ''La mesa % es para % personas como máximo. Para más personas junta mesas.'', m.codigo, m.capacidad;');
    if nuevo = cuerpo then
      raise exception 'No se encontró la revisión de capacidad en validar_reserva: ejecuta antes 10, 11 y 12.';
    end if;
    execute nuevo;
  end if;
end;
$$;

-- Revisa las mesas juntadas y, para un grupo grande sin mesa, las elige el asistente.
-- Corre después de antes_de_reservar (los disparadores van en orden alfabético).
create or replace function public.validar_juntas()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  juntas text[];
  u text;
  v_piso text;
  activa boolean := new.estado in ('pendiente', 'confirmada') and new.liberada_en is null;
begin
  if new.mesa is null or new.paquete = 'Segundo piso exclusivo' then
    new.mesas_extra := '{}';
  end if;

  if new.mesa is null and new.personas > 10 and new.paquete is distinct from 'Segundo piso exclusivo' and activa
     and (tg_op = 'INSERT' or new.fecha is distinct from old.fecha or new.hora is distinct from old.hora) then
    juntas := public.mejor_juntas(new.fecha, new.hora, new.personas, new.ubicacion, new.id);
    if juntas is not null then
      new.mesa := juntas[1];
      new.mesas_extra := juntas[2:];
      new.ubicacion := (select piso from public.mesas where codigo = new.mesa);
    end if;
  end if;

  if cardinality(new.mesas_extra) > 0 then
    if cardinality(new.mesas_extra) > 3 then
      raise exception 'Se pueden juntar hasta 4 mesas.';
    end if;
    if new.mesa = any (new.mesas_extra)
       or (select count(distinct e) from unnest(new.mesas_extra) e) <> cardinality(new.mesas_extra) then
      raise exception 'Hay una mesa repetida entre las que se juntan.';
    end if;
    foreach u in array new.mesas_extra loop
      select piso into v_piso from public.mesas where codigo = u;
      if not found then
        raise exception 'La mesa % no existe.', u;
      end if;
      if v_piso is distinct from (select piso from public.mesas where codigo = new.mesa) then
        raise exception 'Solo se juntan mesas del mismo piso (% no está en el piso de %).', u, new.mesa;
      end if;
      if activa and public.mesa_ocupada(u, new.fecha, new.hora, new.id) then
        raise exception 'La mesa % ya está ocupada cerca de esa hora: no se puede juntar.', u;
      end if;
    end loop;
    if new.personas > (select sum(capacidad) from public.mesas
                       where codigo = any (array[new.mesa] || new.mesas_extra)) then
      raise exception 'Esas mesas juntas no alcanzan para % personas.', new.personas;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists antes_de_reservar_juntas on public.reservas;
create trigger antes_de_reservar_juntas
  before insert or update of fecha, hora, mesa, mesas_extra, estado on public.reservas
  for each row execute function public.validar_juntas();

-- ---------- 5. CONFIRMAR: también junta mesas para grupos grandes ----------
create or replace function public.mesa_al_confirmar()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  juntas text[];
  todas text[];
begin
  if new.estado <> 'confirmada' or old.estado = 'confirmada'
     or new.paquete = 'Segundo piso exclusivo' then
    return new;
  end if;

  -- si alguna de sus mesas ya no está libre, o no alcanzan, se busca de nuevo
  if new.mesa is not null then
    todas := array[new.mesa] || new.mesas_extra;
    if exists (select 1 from unnest(todas) t where public.mesa_ocupada(t, new.fecha, new.hora, new.id))
       or new.personas > (select sum(capacidad) from public.mesas where codigo = any (todas)) then
      new.mesa := null;
      new.mesas_extra := '{}';
    end if;
  end if;

  if new.mesa is null then
    if new.personas <= 10 then
      new.mesa := public.mejor_mesa(new.fecha, new.hora, new.personas, new.ubicacion,
                                    new.preferencias, new.tipo, new.paquete, new.id);
    end if;
    if new.mesa is null then
      -- grupo grande, o ninguna mesa suelta alcanza: el asistente junta mesas
      juntas := public.mejor_juntas(new.fecha, new.hora, new.personas, new.ubicacion, new.id);
      if juntas is not null then
        new.mesa := juntas[1];
        new.mesas_extra := juntas[2:];
      end if;
    end if;
    if new.mesa is null then
      raise exception 'No hay ninguna mesa libre para % personas el % a las % (ni juntando mesas). No se puede confirmar: recházala y ofrécele otro horario.',
        new.personas, to_char(new.fecha, 'DD/MM'), to_char(new.hora, 'HH24:MI');
    end if;
    new.ubicacion := (select piso from public.mesas where codigo = new.mesa);
  end if;
  return new;
end;
$$;

-- El aviso al cliente nombra todas sus mesas
create or replace function public.avisar_estado_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.origen = 'web' and new.estado is distinct from old.estado and new.estado in ('confirmada', 'rechazada')
     and new.motivo is not distinct from old.motivo then
    insert into public.notificaciones (usuario_id, titulo, mensaje)
    values (
      new.usuario_id,
      case when new.estado = 'confirmada' then 'Tu reserva está confirmada' else 'Tu reserva no pudo confirmarse' end,
      format('Reserva del %s a las %s para %s %s%s: %s',
             to_char(new.fecha, 'DD/MM/YYYY'), to_char(new.hora, 'HH24:MI'),
             new.personas, case when new.personas = 1 then 'persona' else 'personas' end,
             case when new.mesa is not null and new.estado = 'confirmada' then ', ' || public.texto_mesas(new.mesa, new.mesas_extra) else '' end,
             case when new.estado = 'confirmada' then '¡te esperamos!' else 'escríbenos por WhatsApp para buscar otro horario.' end)
    );
  end if;
  return new;
end;
$$;

-- ---------- 6. ACCIONES DEL MOZO ----------
-- Asignar una sola mesa (suelta las que estaban juntadas)
create or replace function public.mozo_asignar(p_id bigint, p_mesa text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas set mesa = p_mesa, mesas_extra = '{}', atendido_por = auth.uid()
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa reserva ya no está activa.'; end if;
end;
$$;

-- Juntar mesas para una reserva: la primera es la principal
create or replace function public.mozo_juntar(p_id bigint, p_mesas text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  if coalesce(cardinality(p_mesas), 0) not between 1 and 4 then
    raise exception 'Elige de 1 a 4 mesas para juntar.';
  end if;
  update public.reservas set mesa = p_mesas[1], mesas_extra = p_mesas[2:], atendido_por = auth.uid()
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa reserva ya no está activa.'; end if;
end;
$$;

-- Clientes sin reserva: si son más de lo que entra en la mesa tocada,
-- el asistente le junta las mesas libres más cercanas del mismo piso
create or replace function public.mozo_sentar(p_mesa text, p_personas int, p_nombre text default null)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  ahora timestamp := now() at time zone 'America/Lima';
  m public.mesas;
  juntas text[] := array[p_mesa];
  nueva bigint;
begin
  perform public.exigir_personal();
  if p_personas not between 1 and 30 then
    raise exception 'Indica cuántas personas son (1 a 30).';
  end if;
  select * into m from public.mesas where codigo = p_mesa;
  if not found then raise exception 'La mesa % no existe.', p_mesa; end if;
  if p_personas > m.capacidad then
    juntas := public.mejor_juntas(ahora::date, date_trunc('minute', ahora)::time, p_personas,
                                  m.piso, null, p_mesa, array[m.piso]);
    if juntas is null then
      raise exception 'No hay mesas libres junto a la % para % personas. Prueba con otra mesa u otro piso.', p_mesa, p_personas;
    end if;
  end if;
  insert into public.reservas (usuario_id, fecha, hora, personas, tipo, ubicacion, mesa, mesas_extra, pedido,
                               origen, nombre_mesa, llegada_en, atendido_por, mensaje)
  values (auth.uid(), ahora::date, date_trunc('minute', ahora)::time, p_personas, 'Cena', m.piso,
          juntas[1], juntas[2:], '{}', 'local', nullif(trim(p_nombre), ''), now(), auth.uid(), 'Cliente sin reserva')
  returning id into nueva;
  update public.reservas set estado = 'confirmada' where id = nueva;
  return nueva;
end;
$$;

revoke execute on function public.mozo_asignar(bigint, text) from public, anon;
revoke execute on function public.mozo_juntar(bigint, text[]) from public, anon;
revoke execute on function public.mozo_sentar(text, int, text) from public, anon;
grant execute on function public.mozo_asignar(bigint, text) to authenticated;
grant execute on function public.mozo_juntar(bigint, text[]) to authenticated;
grant execute on function public.mozo_sentar(text, int, text) to authenticated;

-- ---------- 7. GRUPOS GRANDES QUE YA ESTABAN SIN MESA ----------
-- (los de hoy en adelante; si no hay lugar se quedan sin mesa y el admin decide)
do $$
declare
  r record;
  juntas text[];
begin
  for r in
    select * from public.reservas
    where mesa is null and personas > 10 and paquete is distinct from 'Segundo piso exclusivo'
      and estado in ('pendiente', 'confirmada') and liberada_en is null
      and fecha >= (now() at time zone 'America/Lima')::date
    order by fecha, hora
  loop
    juntas := public.mejor_juntas(r.fecha, r.hora, r.personas, r.ubicacion, r.id);
    if juntas is not null then
      update public.reservas set mesa = juntas[1], mesas_extra = juntas[2:] where id = r.id;
    end if;
  end loop;
end;
$$;

select id, fecha, hora, personas, paquete, public.texto_mesas(mesa, mesas_extra) as mesas
from public.reservas
where cardinality(mesas_extra) > 0
order by fecha, hora;
