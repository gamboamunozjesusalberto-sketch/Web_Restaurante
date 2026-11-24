-- ==========================================================================
-- PUNTO ASADO - ASISTENCIA: "ATENDIDA", "NO VINO" Y 15 MINUTOS DE TOLERANCIA
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 15-ultima-reserva.sql.
-- Se puede volver a ejecutar.
--
-- - Estados nuevos: 'atendida' (el cliente vino) y 'no_vino' (no se presentó)
-- - Tolerancia de 15 minutos: si a la hora de la reserva el cliente no llegó,
--   se le avisa que lo esperamos; a los 15 minutos la reserva pasa a "no vino",
--   la mesa queda libre y el cliente recibe otro aviso
-- - Cuando el mozo toca "Se fueron", la reserva queda "atendida"
-- - El mozo o el admin pueden corregirlo (marcar_asistencia): "sí vino" / "no vino"
-- - Las pendientes vencen también después de los 15 minutos (antes vencían
--   apenas pasaba la hora, aunque el cliente estuviera entrando)
-- vencer_reservas() hace todo esto; la llaman el Salón en vivo (cada 20 s),
-- el Panel y Mi cuenta. Además mesa_ocupada ya no cuenta una reserva que pasó
-- la tolerancia, aunque nadie haya abierto la web todavía.
-- ==========================================================================

alter table public.reservas drop constraint if exists reservas_estado_check;
alter table public.reservas add constraint reservas_estado_check
  check (estado in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'vencida', 'atendida', 'no_vino'));
alter table public.reservas add column if not exists aviso_espera timestamptz;  -- ya se le avisó que lo esperamos

-- Inicio de la reserva en hora de Lima, para comparar con "ahora"
create or replace function public.ahora_lima()
returns timestamp
language sql stable
as $$ select now() at time zone 'America/Lima'; $$;

-- ---------- 1. LA MESA SE LIBERA A LOS 15 MINUTOS SI NO LLEGAN ----------
create or replace function public.mesa_ocupada(p_mesa text, p_fecha date, p_hora time, p_id bigint default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where (r.mesa = p_mesa or p_mesa = any (r.mesas_extra)) and r.fecha = p_fecha
      and r.estado in ('pendiente', 'confirmada') and r.liberada_en is null
      and not (r.llegada_en is null and r.fecha + r.hora + interval '15 minutes' < public.ahora_lima())
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
    and not (r.llegada_en is null and r.fecha + r.hora + interval '15 minutes' < public.ahora_lima())
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

-- ---------- 2. CIERRE AUTOMÁTICO DE LAS RESERVAS ----------
create or replace function public.vencer_reservas()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  ahora timestamp := public.ahora_lima();
  n int := 0;
  k int;
  r record;
begin
  -- a) Pendientes que nadie confirmó y pasaron la tolerancia: vencidas
  update public.reservas set estado = 'vencida'
  where estado = 'pendiente' and llegada_en is null and liberada_en is null
    and fecha + hora + interval '15 minutes' < ahora;
  get diagnostics k = row_count;  n := n + k;

  -- b) Es la hora y el cliente aún no llegó: se le avisa que lo esperamos (una sola vez)
  for r in
    update public.reservas set aviso_espera = now()
    where estado = 'confirmada' and origen = 'web' and llegada_en is null and aviso_espera is null
      and fecha + hora <= ahora and fecha + hora + interval '15 minutes' >= ahora
    returning usuario_id, hora, mesa, mesas_extra
  loop
    insert into public.notificaciones (usuario_id, titulo, mensaje)
    values (r.usuario_id, 'Te estamos esperando',
            format('Tu %s está lista desde las %s. La guardamos 15 minutos, hasta las %s. Si te retrasas, escríbenos por WhatsApp al +51 919 293 435.',
                   coalesce(public.texto_mesas(r.mesa, r.mesas_extra), 'mesa'),
                   to_char(r.hora, 'HH24:MI'), to_char(r.hora + interval '15 minutes', 'HH24:MI')));
  end loop;

  -- c) Confirmadas sin llegar después de 15 minutos: "no vino", la mesa queda libre y se avisa
  for r in
    update public.reservas set estado = 'no_vino', liberada_en = now()
    where estado = 'confirmada' and llegada_en is null and liberada_en is null
      and fecha + hora + interval '15 minutes' < ahora
    returning usuario_id, origen, fecha, hora
  loop
    n := n + 1;
    if r.origen = 'web' then
      insert into public.notificaciones (usuario_id, titulo, mensaje)
      values (r.usuario_id, 'Liberamos tu mesa',
              format('Te esperamos 15 minutos en tu reserva del %s a las %s y no llegaste, así que liberamos la mesa. Si fue un error o quieres venir otro día, escríbenos por WhatsApp o haz una nueva reserva.',
                     to_char(r.fecha, 'DD/MM'), to_char(r.hora, 'HH24:MI')));
    end if;
  end loop;

  -- d) Clientes que ya se fueron, o que llegaron y pasaron más de 4 horas: atendidas
  update public.reservas set estado = 'atendida', liberada_en = coalesce(liberada_en, now())
  where estado = 'confirmada' and llegada_en is not null
    and (liberada_en is not null or fecha + hora + interval '4 hours' < ahora);
  get diagnostics k = row_count;  n := n + k;
  return n;
end;
$$;
revoke execute on function public.vencer_reservas() from public, anon;
grant  execute on function public.vencer_reservas() to authenticated;

-- ---------- 3. ACCIONES DEL MOZO Y DEL ADMIN ----------
-- "Se fueron": la mesa queda libre y la reserva, atendida
create or replace function public.mozo_liberar(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas
  set liberada_en = now(), atendido_por = auth.uid(), estado = 'atendida',
      llegada_en = coalesce(llegada_en, now())
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa mesa ya estaba libre.'; end if;
end;
$$;

-- Marcar o corregir si el cliente vino (p_vino true) o no (false).
-- Solo para reservas cuya hora ya llegó.
create or replace function public.marcar_asistencia(p_id bigint, p_vino boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.reservas;
begin
  perform public.exigir_personal();
  select * into r from public.reservas where id = p_id;
  if not found or r.estado not in ('pendiente', 'confirmada', 'atendida', 'no_vino', 'vencida') then
    raise exception 'Esa reserva no se puede marcar.';
  end if;
  if r.fecha + r.hora > public.ahora_lima() then
    raise exception 'Todavía no es la hora de esa reserva.';
  end if;
  if p_vino then
    update public.reservas
    set estado = 'atendida', llegada_en = coalesce(llegada_en, now()),
        liberada_en = coalesce(liberada_en, now()), atendido_por = auth.uid()
    where id = p_id;
  else
    update public.reservas
    set estado = 'no_vino', llegada_en = null, liberada_en = coalesce(liberada_en, now()), atendido_por = auth.uid()
    where id = p_id;
    if r.estado <> 'no_vino' and r.origen = 'web' then
      insert into public.notificaciones (usuario_id, titulo, mensaje)
      values (r.usuario_id, 'Liberamos tu mesa',
              format('Te esperamos en tu reserva del %s a las %s y no llegaste, así que liberamos la mesa. Si fue un error, escríbenos por WhatsApp.',
                     to_char(r.fecha, 'DD/MM'), to_char(r.hora, 'HH24:MI')));
    end if;
  end if;
end;
$$;

revoke execute on function public.mozo_liberar(bigint) from public, anon;
revoke execute on function public.marcar_asistencia(bigint, boolean) from public, anon;
grant execute on function public.mozo_liberar(bigint) to authenticated;
grant execute on function public.marcar_asistencia(bigint, boolean) to authenticated;

-- ---------- 4. LLEGÓ TARDE ----------
-- Si el cliente llega después de los 15 minutos (ya figura "no vino"), el mozo
-- igual toca "Llegó": la reserva vuelve a estar activa. Si su mesa ya se la
-- dieron a otro, el asistente le busca otra (12-confirmar-con-mesa.sql).
create or replace function public.mozo_llegada(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas
  set llegada_en = coalesce(llegada_en, now()), atendido_por = auth.uid(), liberada_en = null,
      estado = 'confirmada'
  where id = p_id
    and ((estado in ('pendiente', 'confirmada') and liberada_en is null)
         or (estado in ('no_vino', 'vencida') and fecha = (public.ahora_lima())::date));
  if not found then raise exception 'Esa reserva ya no está activa.'; end if;
end;
$$;
revoke execute on function public.mozo_llegada(bigint) from public, anon;
grant execute on function public.mozo_llegada(bigint) to authenticated;

-- ---------- 6. AVISO DE CONFIRMADA ----------
-- No se manda "Tu reserva está confirmada" a quien ya está sentado en la mesa
-- (el mozo tocó "Llegó"), ni al volver de "no vino" porque llegó tarde
create or replace function public.avisar_estado_reserva()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.origen = 'web' and new.estado is distinct from old.estado and new.estado in ('confirmada', 'rechazada')
     and new.motivo is not distinct from old.motivo
     and new.llegada_en is null and old.estado not in ('no_vino', 'vencida') then
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

-- ---------- 5. RESERVAS QUE YA PASARON ANTES DE ESTE SCRIPT ----------
-- Antes no se marcaba quién llegaba: las confirmadas de días anteriores se dan
-- por atendidas (si alguna no vino, el admin la corrige con "No vino").
update public.reservas set estado = 'atendida', liberada_en = coalesce(liberada_en, now())
where estado = 'confirmada' and fecha < (public.ahora_lima())::date;
update public.reservas set aviso_espera = coalesce(aviso_espera, now())
where fecha < (public.ahora_lima())::date;
select public.vencer_reservas() as reservas_cerradas_ahora;

select estado, count(*) from public.reservas group by estado order by estado;
