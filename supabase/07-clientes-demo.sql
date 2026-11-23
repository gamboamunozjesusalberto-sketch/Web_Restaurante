-- ==========================================================================
-- PUNTO ASADO - CLIENTES DE PRUEBA (OPCIONAL, PARA LA PRESENTACIÓN)
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 06-datos-demo.sql.
--
-- - Crea 40 cuentas de cliente de prueba, registradas entre junio y
--   noviembre (cada mes un poco más, para que se vea el crecimiento).
-- - Reparte entre ellas las reservas de prueba del script 06, así el
--   Panel muestra nombres de clientes y "Ya reservaron" tiene datos.
-- - Las cuentas usan correos @demo.puntoasado.pe y una contraseña al azar:
--   nadie puede iniciar sesión con ellas.
-- - Se puede volver a ejecutar: borra los clientes de prueba anteriores.
--
-- PARA BORRAR TODO LO DE PRUEBA después de la presentación:
--   delete from public.reservas where mensaje = 'DEMO - dato de prueba para el dashboard';
--   delete from auth.users where email like '%@demo.puntoasado.pe';
-- ==========================================================================

do $$
declare
  marca    constant text := 'DEMO - dato de prueba para el dashboard';
  admin_id uuid;
  nombres  text[] := array[
    'Carla Mendoza','Diego Paredes','Rosa Quispe','Mario Huamán','Lucía Flores','Pedro Salas','Elena Cruz',
    'Jorge Rojas','Valeria Chávez','Andrés Torres','Camila Vargas','Luis Gutiérrez','Fernanda Ramos',
    'Ricardo Castillo','Daniela Medina','José Herrera','María Fernanda Ríos','Gabriel Aguilar','Sofía Navarro',
    'Martín Soto','Paola Espinoza','Renato Silva','Andrea Campos','César Romero','Natalia Vega','Hugo Cárdenas',
    'Ximena Palacios','Álvaro Delgado','Brenda Cabrera','Sebastián Luna','Patricia Montes','Óscar Zapata',
    'Milagros Peña','Kevin Arias','Gianella Benites','Franco Uribe','Lorena Tello','Bruno Salazar',
    'Alexandra Rivas','Joaquín Ochoa'];
  -- cuántos se registran cada mes (junio a noviembre): 3+4+6+7+9+11 = 40
  por_mes  int[] := array[3, 4, 6, 7, 9, 11];
  inicio   date := date_trunc('month', (now() at time zone 'America/Lima'))::date - interval '5 months';
  hoy      date := (now() at time zone 'America/Lima')::date;
  mes_ini  date;
  mes_fin  date;
  n        int := 0;
  m        int;
  k        int;
  nuevo_id uuid;
  registro timestamptz;
begin
  select id into admin_id from public.perfiles where rol = 'admin' order by creado_en limit 1;
  if admin_id is null then
    raise exception 'Primero crea un usuario con rol admin.';
  end if;

  -- si ya se ejecutó antes: las reservas de prueba vuelven al admin y se borran los clientes de prueba
  update public.reservas set usuario_id = admin_id
  where mensaje = marca
    and usuario_id in (select id from auth.users where email like '%@demo.puntoasado.pe');
  delete from auth.users where email like '%@demo.puntoasado.pe';

  perform setseed(0.7);

  for m in 1 .. 6 loop
    mes_ini := (inicio + make_interval(months => m - 1))::date;
    mes_fin := least((mes_ini + interval '1 month' - interval '1 day')::date, hoy);
    for k in 1 .. por_mes[m] loop
      n := n + 1;
      nuevo_id := gen_random_uuid();
      registro := (mes_ini + floor(random() * (mes_fin - mes_ini + 1))::int) + time '09:00'
                  + make_interval(mins => floor(random() * 720)::int);

      -- crear el usuario: el trigger al_crear_usuario arma su perfil con estos datos
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values (
        '00000000-0000-0000-0000-000000000000', nuevo_id, 'authenticated', 'authenticated',
        'cliente' || n || '@demo.puntoasado.pe',
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
        registro,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object(
          'nombre', nombres[n],
          'telefono', '9' || lpad(floor(random() * 100000000)::text, 8, '0'),
          'acepta_promos', random() < 0.75),
        registro, registro, '', '', '', '');

      update public.perfiles set creado_en = registro where id = nuevo_id;
    end loop;
  end loop;

  -- repartir las reservas de prueba entre clientes que ya estaban registrados
  -- antes de esa reserva (unas pocas quedan con el admin si no hay ninguno)
  update public.reservas r
  set usuario_id = coalesce((
        select p.id from public.perfiles p
        join auth.users u on u.id = p.id
        where u.email like '%@demo.puntoasado.pe'
          and p.creado_en <= r.creado_en
        order by md5(p.id::text || r.id::text)
        limit 1), admin_id)
  where r.mensaje = marca;
end;
$$;

-- Resumen
select count(*) as clientes_de_prueba,
       count(*) filter (where p.acepta_promos) as reciben_promos,
       (select count(distinct usuario_id) from public.reservas
         where mensaje = 'DEMO - dato de prueba para el dashboard') as con_reservas
from public.perfiles p join auth.users u on u.id = p.id
where u.email like '%@demo.puntoasado.pe';
