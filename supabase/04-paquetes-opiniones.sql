-- ==========================================================================
-- PUNTO ASADO - PAQUETES, PEDIDO, OPINIONES Y ESTADÍSTICAS
-- Ejecutar UNA vez en Supabase → SQL Editor (después de esquema.sql,
-- 02-avisos-reservas.sql y 03-fotos-platos.sql). Se puede volver a ejecutar.
--
--   1. Reservas: paquete elegido y "qué piensas pedir" (pedido)
--   2. Validación de paquetes (personas, segundo piso exclusivo)
--   3. Tabla opiniones (comentarios de clientes con foto)
--   4. Funciones públicas para el chatbot y el dashboard
--   5. Carpeta de fotos de opiniones (Storage)
-- ==========================================================================


-- ---------- 1. RESERVAS: PAQUETE Y PEDIDO ----------

alter table public.reservas add column if not exists paquete text;
alter table public.reservas add column if not exists pedido  text[] not null default '{}';

alter table public.reservas drop constraint if exists reservas_paquete_check;
alter table public.reservas add constraint reservas_paquete_check
  check (paquete in ('Cumpleañero', 'Segundo piso exclusivo', 'Parrilla en vivo', 'Empresarial'));

alter table public.reservas drop constraint if exists reservas_pedido_check;
alter table public.reservas add constraint reservas_pedido_check
  check (cardinality(pedido) <= 15);

-- Con paquetes se aceptan grupos más grandes (el máximo exacto lo revisa el trigger)
alter table public.reservas drop constraint if exists reservas_personas_check;
alter table public.reservas add constraint reservas_personas_check
  check (personas between 1 and 40);

-- Nuevo tipo de reserva para el paquete empresarial
alter table public.reservas drop constraint if exists reservas_tipo_check;
alter table public.reservas add constraint reservas_tipo_check
  check (tipo in ('Cena', 'Aniversario', 'Cumpleaños', 'Reunión de trabajo'));


-- ---------- 2. VALIDACIÓN (reemplaza a la de esquema.sql) ----------
-- security definer: así puede revisar si el segundo piso ya está tomado
-- por OTRA persona (con RLS, el cliente solo ve sus propias reservas).

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
         and (r.paquete = 'Segundo piso exclusivo' or new.paquete = 'Segundo piso exclusivo')) then
    raise exception 'El segundo piso ya está reservado ese día. Elige el primer piso u otra fecha.';
  end if;

  new.estado := 'pendiente';  -- toda reserva nueva entra como pendiente
  return new;
end;
$$;


-- ---------- 3. OPINIONES DE LOS CLIENTES ----------

create table if not exists public.opiniones (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  autor         text,           -- lo pone el trigger: nombre e inicial del apellido
  plato         text check (char_length(plato) <= 80),
  calificacion  int  not null check (calificacion between 1 and 5),
  comentario    text not null check (char_length(comentario) between 10 and 500),
  foto          text,
  visible       boolean not null default true,
  creado_en     timestamptz not null default now()
);
create index if not exists opiniones_creado_idx on public.opiniones (creado_en desc);

-- Nombre público del autor ("Ana T."): sale del perfil, no lo escribe el cliente
create or replace function public.poner_autor_opinion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  nombre_completo text;
begin
  select p.nombre into nombre_completo from public.perfiles p where p.id = new.usuario_id;
  new.autor := split_part(coalesce(nombre_completo, 'Cliente'), ' ', 1)
            || coalesce(' ' || nullif(left(split_part(nombre_completo, ' ', 2), 1), '') || '.', '');
  new.visible := true;
  return new;
end;
$$;

drop trigger if exists al_crear_opinion on public.opiniones;
create trigger al_crear_opinion
  before insert on public.opiniones
  for each row execute function public.poner_autor_opinion();

alter table public.opiniones enable row level security;

grant select on public.opiniones to anon, authenticated;
grant insert, delete on public.opiniones to authenticated;
revoke update on public.opiniones from anon, authenticated;
grant  update (visible) on public.opiniones to authenticated;

drop policy if exists "ver opiniones" on public.opiniones;
create policy "ver opiniones" on public.opiniones
  for select using (visible or usuario_id = auth.uid() or public.es_admin());
drop policy if exists "crear mi opinion" on public.opiniones;
create policy "crear mi opinion" on public.opiniones
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "borrar mi opinion o admin" on public.opiniones;
create policy "borrar mi opinion o admin" on public.opiniones
  for delete using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists "admin oculta opiniones" on public.opiniones;
create policy "admin oculta opiniones" on public.opiniones
  for update using (public.es_admin()) with check (public.es_admin());



-- ---------- 4. FUNCIONES PÚBLICAS (chatbot y dashboard) ----------
-- Devuelven solo totales o fechas: ningún dato personal de los clientes.

-- Platos más pedidos (de las reservas) y más comentados (de las opiniones)
create or replace function public.platos_populares(limite int default 5)
returns table (nombre text, veces bigint)
language sql stable security definer set search_path = public
as $$
  select nombre, count(*) as veces
  from (
    select unnest(r.pedido) as nombre
    from public.reservas r
    where r.estado in ('pendiente', 'confirmada')
    union all
    select o.plato from public.opiniones o
    where o.visible and o.plato is not null
  ) t
  group by nombre
  order by veces desc, nombre
  limit least(greatest(limite, 1), 20);
$$;

-- Fechas en que el segundo piso ya está tomado como exclusivo
create or replace function public.segundo_piso_ocupado()
returns setof date
language sql stable security definer set search_path = public
as $$
  select distinct r.fecha
  from public.reservas r
  where r.paquete = 'Segundo piso exclusivo'
    and r.estado in ('pendiente', 'confirmada')
    and r.fecha >= (now() at time zone 'America/Lima')::date
  order by 1;
$$;

grant execute on function public.platos_populares(int) to anon, authenticated;
grant execute on function public.segundo_piso_ocupado() to anon, authenticated;


-- ---------- 5. FOTOS DE LAS OPINIONES (STORAGE) ----------
-- Cada cliente sube a su propia carpeta: fotos-opiniones/<su id>/archivo.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-opiniones', 'fotos-opiniones', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cliente sube foto de opinion" on storage.objects;
create policy "cliente sube foto de opinion" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-opiniones' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "borrar foto de opinion" on storage.objects;
create policy "borrar foto de opinion" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-opiniones'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
