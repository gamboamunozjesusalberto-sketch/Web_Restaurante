-- ==========================================================================
-- PUNTO ASADO - CUENTAS DEL PERSONAL (MOZOS)
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de 10-asistente-mesas.sql.
-- Se puede volver a ejecutar.
--
-- - Rol nuevo "mozo": entra a personal.html desde su celular
-- - Ve todas las reservas del día y las mesas libres y ocupadas
-- - Asigna o cambia mesas, marca "llegó", libera la mesa cuando se van y
--   sienta a clientes que llegan sin reserva
-- - Todo pasa por funciones que revisan el rol y los choques de mesa, así
--   dos mozos no pueden dar la misma mesa a la vez
--
-- CÓMO CREAR LAS 2 CUENTAS DE MOZO:
--   1. Cada mozo se registra en la web (login.html → Crear cuenta)
--   2. El admin, en el Panel → Clientes → "Personal", escribe su correo y
--      toca "Hacer mozo" (o aquí abajo, en el paso 6, cambia los correos)
-- ==========================================================================

-- ---------- 1. ROL MOZO ----------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('cliente', 'admin', 'mozo'));

create or replace function public.es_personal()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('admin', 'mozo'));
$$;
grant execute on function public.es_personal() to authenticated;

-- El personal ve las reservas y el nombre / celular de quien reservó
drop policy if exists "personal ve reservas" on public.reservas;
create policy "personal ve reservas" on public.reservas for select using (public.es_personal());
drop policy if exists "personal ve perfiles" on public.perfiles;
create policy "personal ve perfiles" on public.perfiles for select using (public.es_personal());

-- ---------- 2. COLUMNAS DEL SALÓN ----------
alter table public.reservas add column if not exists origen       text not null default 'web' check (origen in ('web', 'local'));
alter table public.reservas add column if not exists nombre_mesa  text check (char_length(nombre_mesa) <= 60);  -- cliente sin reserva
alter table public.reservas add column if not exists llegada_en   timestamptz;
alter table public.reservas add column if not exists liberada_en  timestamptz;
alter table public.reservas add column if not exists atendido_por uuid;  -- sin llave foránea: una 2.ª relación con perfiles confunde a la API (perfiles(...))
alter table public.reservas drop constraint if exists reservas_atendido_por_fkey;

-- Una mesa liberada (los clientes ya se fueron) vuelve a estar libre
create or replace function public.mesa_ocupada(p_mesa text, p_fecha date, p_hora time, p_id bigint default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where r.mesa = p_mesa and r.fecha = p_fecha
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
  select r.mesa, r.hora, (r.hora + interval '2 hours')::time, 'reserva'
  from public.reservas r
  where r.fecha = p_fecha and r.mesa is not null and r.estado in ('pendiente', 'confirmada')
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

-- La validación de 10 no revisa "hora pasada" ni horario para los clientes
-- que el mozo sienta en el momento (origen = 'local')
do $$
declare
  cuerpo text;
begin
  select pg_get_functiondef('public.validar_reserva()'::regprocedure) into cuerpo;
  if position('origen' in cuerpo) = 0 then
    cuerpo := replace(cuerpo, '  if cambia_fecha then
    if new.fecha < hoy then',
      '  if cambia_fecha and new.origen = ''local'' then
    null;  -- cliente sentado por el mozo: entra ya, a la hora actual
  elsif cambia_fecha then
    if new.fecha < hoy then');
    execute cuerpo;
  end if;
end;
$$;

-- Sin avisos automáticos para las mesas que abre el mozo
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
             case when new.mesa is not null and new.estado = 'confirmada' then ', mesa ' || new.mesa else '' end,
             case when new.estado = 'confirmada' then '¡te esperamos!' else 'escríbenos por WhatsApp para buscar otro horario.' end)
    );
  end if;
  return new;
end;
$$;

-- ---------- 3. ACCIONES DEL MOZO ----------
create or replace function public.exigir_personal()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Solo el personal del restaurante puede hacer esto.';
  end if;
end;
$$;

-- Asignar, cambiar o quitar (p_mesa null) la mesa de una reserva
create or replace function public.mozo_asignar(p_id bigint, p_mesa text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas set mesa = p_mesa, atendido_por = auth.uid()
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa reserva ya no está activa.'; end if;
end;
$$;

-- Los clientes llegaron: la reserva queda confirmada y "en mesa"
create or replace function public.mozo_llegada(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas set llegada_en = coalesce(llegada_en, now()), atendido_por = auth.uid(),
                             estado = 'confirmada'
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa reserva ya no está activa.'; end if;
end;
$$;

-- Los clientes se fueron: la mesa queda libre para otros
create or replace function public.mozo_liberar(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.exigir_personal();
  update public.reservas set liberada_en = now(), atendido_por = auth.uid()
  where id = p_id and estado in ('pendiente', 'confirmada') and liberada_en is null;
  if not found then raise exception 'Esa mesa ya estaba libre.'; end if;
end;
$$;

-- Clientes que llegan sin reserva: se ocupa la mesa desde ahora por 2 horas
create or replace function public.mozo_sentar(p_mesa text, p_personas int, p_nombre text default null)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  ahora timestamp := now() at time zone 'America/Lima';
  nueva bigint;
begin
  perform public.exigir_personal();
  if p_personas not between 1 and 12 then
    raise exception 'Indica cuántas personas son (1 a 12).';
  end if;
  insert into public.reservas (usuario_id, fecha, hora, personas, tipo, ubicacion, mesa, pedido,
                               origen, nombre_mesa, llegada_en, atendido_por, mensaje)
  values (auth.uid(), ahora::date, date_trunc('minute', ahora)::time, p_personas, 'Cena', 'Primer piso',
          p_mesa, '{}', 'local', nullif(trim(p_nombre), ''), now(), auth.uid(), 'Cliente sin reserva')
  returning id into nueva;
  update public.reservas set estado = 'confirmada' where id = nueva;
  return nueva;
end;
$$;

revoke execute on function public.exigir_personal() from public, anon;
revoke execute on function public.mozo_asignar(bigint, text) from public, anon;
revoke execute on function public.mozo_llegada(bigint) from public, anon;
revoke execute on function public.mozo_liberar(bigint) from public, anon;
revoke execute on function public.mozo_sentar(text, int, text) from public, anon;
grant execute on function public.exigir_personal() to authenticated;
grant execute on function public.mozo_asignar(bigint, text) to authenticated;
grant execute on function public.mozo_llegada(bigint) to authenticated;
grant execute on function public.mozo_liberar(bigint) to authenticated;
grant execute on function public.mozo_sentar(text, int, text) to authenticated;

-- ---------- 4. EL ADMIN NOMBRA O QUITA MOZOS ----------
create or replace function public.cambiar_rol(p_correo text, p_rol text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede hacer esto.'; end if;
  if p_rol not in ('cliente', 'mozo') then raise exception 'Rol no válido.'; end if;
  select u.id, p.nombre into v_id, v_nombre
  from auth.users u join public.perfiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_correo));
  if v_id is null then raise exception 'No hay ninguna cuenta con ese correo. Primero debe registrarse en la web.'; end if;
  if v_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol.'; end if;
  update public.perfiles set rol = p_rol where id = v_id and rol <> 'admin';
  if not found then raise exception 'Esa cuenta es de administrador.'; end if;
  return v_nombre;
end;
$$;
revoke execute on function public.cambiar_rol(text, text) from public, anon;
grant  execute on function public.cambiar_rol(text, text) to authenticated;

-- ---------- 5. QUIÉN ES PERSONAL (para el Panel) ----------
create or replace function public.lista_personal()
returns table (nombre text, correo text, rol text)
language sql stable security definer set search_path = public
as $$
  select p.nombre, u.email::text, p.rol
  from public.perfiles p join auth.users u on u.id = p.id
  where p.rol in ('admin', 'mozo') and public.es_admin()
  order by p.rol, p.nombre;
$$;
revoke execute on function public.lista_personal() from public, anon;
grant  execute on function public.lista_personal() to authenticated;

-- ---------- 6. (OPCIONAL) NOMBRAR MOZOS DESDE AQUÍ ----------
-- Cambia los correos por los de las 2 cuentas que crearon y quita los "--":
-- update public.perfiles set rol = 'mozo'
-- where id in (select id from auth.users where email in ('mozo1@correo.com', 'mozo2@correo.com'));

select rol, count(*) from public.perfiles group by rol order by rol;
