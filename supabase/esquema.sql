-- ==========================================================================
-- PUNTO ASADO - ESQUEMA DE LA BASE DE DATOS (SUPABASE / POSTGRESQL)
-- Cómo usarlo: en Supabase, abre "SQL Editor", pega todo este archivo y
-- presiona "Run". Se puede ejecutar una sola vez en un proyecto nuevo.
--
-- Tablas:
--   perfiles        datos de cada cuenta (nombre, DNI, teléfono, rol)
--   platos          la carta (la administra el admin)
--   reservas        reservas de los clientes
--   promociones     promociones que publica el admin
--   notificaciones  avisos que recibe cada cliente (una por promoción)
--
-- Seguridad: todas las tablas tienen RLS (Row Level Security) activado.
-- La base de datos decide qué puede ver y cambiar cada usuario, así que
-- aunque alguien modifique el JavaScript del navegador no puede saltarse
-- estas reglas.
-- ==========================================================================


-- ---------- 1. TABLAS ----------

create table public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 2 and 80),
  dni            text check (dni ~ '^[0-9]{8}$'),
  telefono       text check (telefono ~ '^[0-9+ -]{7,15}$'),
  rol            text not null default 'cliente' check (rol in ('cliente', 'admin')),
  acepta_promos  boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table public.platos (
  id           bigint generated always as identity primary key,
  nombre       text not null check (char_length(nombre) between 2 and 80),
  descripcion  text check (char_length(descripcion) <= 300),
  categoria    text not null default 'parrilla',
  precio       numeric(8, 2) check (precio >= 0),
  imagen       text,
  visible      boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table public.reservas (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  fecha         date not null,
  hora          time not null,
  personas      int  not null check (personas between 1 and 10),
  tipo          text not null default 'Cena' check (tipo in ('Cena', 'Aniversario', 'Cumpleaños')),
  ubicacion     text not null default 'Primer piso' check (ubicacion in ('Primer piso', 'Segundo piso')),
  preferencias  text check (char_length(preferencias) <= 200),
  mensaje       text check (char_length(mensaje) <= 500),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'rechazada', 'cancelada')),
  creado_en     timestamptz not null default now()
);

create table public.promociones (
  id           bigint generated always as identity primary key,
  titulo       text not null check (char_length(titulo) between 3 and 80),
  descripcion  text not null check (char_length(descripcion) <= 400),
  imagen       text,
  activa       boolean not null default true,
  hasta        date,
  creado_en    timestamptz not null default now()
);

create table public.notificaciones (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  promocion_id  bigint references public.promociones (id) on delete cascade,
  titulo        text not null,
  mensaje       text not null,
  leida         boolean not null default false,
  creado_en     timestamptz not null default now()
);

create index reservas_usuario_idx       on public.reservas (usuario_id);
create index reservas_fecha_idx         on public.reservas (fecha);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida);


-- Permisos básicos de la API (por si "Automatically expose new tables" está desactivado).
-- Aunque existan estos permisos, RLS (más abajo) decide qué filas ve cada usuario.
grant usage on schema public to anon, authenticated;
grant select on public.platos, public.promociones to anon, authenticated;
grant select on public.perfiles, public.notificaciones to authenticated;
grant select, insert on public.reservas to authenticated;
grant insert, update, delete on public.platos, public.promociones to authenticated;
grant usage on all sequences in schema public to authenticated;


-- ---------- 2. FUNCIONES DE APOYO ----------

-- ¿El usuario que hace la consulta es administrador?
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Al crear una cuenta (registro), se crea su perfil con los datos del formulario.
-- El rol siempre empieza como 'cliente': nadie puede registrarse como admin.
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, dni, telefono, acepta_promos)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'dni', ''),
    nullif(new.raw_user_meta_data ->> 'telefono', ''),
    coalesce((new.raw_user_meta_data ->> 'acepta_promos')::boolean, true)
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Valida cada reserva nueva en el servidor (además de la validación del formulario):
-- no fechas pasadas, máximo 60 días adelante y dentro del horario de atención.
--   Lunes a viernes: 18:00 a 22:30 · Sábado y domingo: 12:00 a 22:30
create or replace function public.validar_reserva()
returns trigger
language plpgsql
as $$
declare
  dia int := extract(dow from new.fecha);  -- 0 = domingo, 6 = sábado
  apertura time := case when dia in (0, 6) then time '12:00' else time '18:00' end;
begin
  if new.fecha < (now() at time zone 'America/Lima')::date then
    raise exception 'No se puede reservar en una fecha pasada.';
  end if;
  if new.fecha = (now() at time zone 'America/Lima')::date
     and new.hora < (now() at time zone 'America/Lima')::time then
    raise exception 'Esa hora ya pasó.';
  end if;
  if new.fecha > (now() at time zone 'America/Lima')::date + 60 then
    raise exception 'Solo se puede reservar hasta 60 días antes.';
  end if;
  if new.hora < apertura or new.hora > time '22:30' then
    raise exception 'Ese día atendemos de % a 22:30.', to_char(apertura, 'HH24:MI');
  end if;
  new.estado := 'pendiente';  -- toda reserva nueva entra como pendiente
  return new;
end;
$$;

create trigger antes_de_reservar
  before insert on public.reservas
  for each row execute function public.validar_reserva();

-- Cuando el admin publica una promoción activa, cada cliente que aceptó
-- recibir novedades recibe una notificación.
create or replace function public.notificar_promocion()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.activa then
    insert into public.notificaciones (usuario_id, promocion_id, titulo, mensaje)
    select p.id, new.id, new.titulo, new.descripcion
    from public.perfiles p
    where p.acepta_promos and p.rol = 'cliente';
  end if;
  return new;
end;
$$;

create trigger al_publicar_promocion
  after insert on public.promociones
  for each row execute function public.notificar_promocion();


-- ---------- 3. SEGURIDAD: RLS Y PERMISOS ----------

alter table public.perfiles       enable row level security;
alter table public.platos         enable row level security;
alter table public.reservas       enable row level security;
alter table public.promociones    enable row level security;
alter table public.notificaciones enable row level security;

-- PERFILES: cada uno ve el suyo; el admin ve todos.
create policy "ver mi perfil o admin" on public.perfiles
  for select using (id = auth.uid() or public.es_admin());
create policy "editar mi perfil" on public.perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin edita perfiles" on public.perfiles
  for update using (public.es_admin());
-- Un cliente solo puede cambiar estas columnas (no su rol ni su DNI).
revoke update on public.perfiles from anon, authenticated;
grant  update (nombre, telefono, acepta_promos) on public.perfiles to authenticated;

-- PLATOS: cualquiera (incluso sin cuenta) ve los visibles; solo el admin los gestiona.
create policy "ver carta" on public.platos
  for select using (visible or public.es_admin());
create policy "admin gestiona carta" on public.platos
  for all using (public.es_admin()) with check (public.es_admin());

-- RESERVAS
create policy "ver mis reservas o admin" on public.reservas
  for select using (usuario_id = auth.uid() or public.es_admin());
create policy "crear mi reserva" on public.reservas
  for insert to authenticated with check (usuario_id = auth.uid());
-- El cliente solo puede cancelar una reserva suya que siga pendiente.
create policy "cancelar mi reserva" on public.reservas
  for update using (usuario_id = auth.uid() and estado = 'pendiente')
  with check (usuario_id = auth.uid() and estado = 'cancelada');
-- El admin puede confirmar o rechazar cualquiera.
create policy "admin cambia estado" on public.reservas
  for update using (public.es_admin()) with check (public.es_admin());
revoke update on public.reservas from anon, authenticated;
grant  update (estado) on public.reservas to authenticated;

-- PROMOCIONES: cualquiera ve las activas; solo el admin las gestiona.
create policy "ver promociones activas" on public.promociones
  for select using (activa or public.es_admin());
create policy "admin gestiona promociones" on public.promociones
  for all using (public.es_admin()) with check (public.es_admin());

-- NOTIFICACIONES: cada cliente ve las suyas y solo puede marcarlas como leídas.
create policy "ver mis notificaciones" on public.notificaciones
  for select using (usuario_id = auth.uid());
create policy "marcar leida" on public.notificaciones
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke update on public.notificaciones from anon, authenticated;
grant  update (leida) on public.notificaciones to authenticated;


-- ---------- 4. CÓMO VOLVER ADMIN A UNA CUENTA ----------
-- Primero crea la cuenta desde la web (login.html → Crear cuenta).
-- Luego ejecuta esto aquí, cambiando el correo:
--
--   update public.perfiles set rol = 'admin'
--   where id = (select id from auth.users where email = 'correo-del-admin@gmail.com');
