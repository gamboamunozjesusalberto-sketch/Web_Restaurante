-- ==========================================================================
-- PUNTO ASADO - DATOS DE PRUEBA PARA EL DASHBOARD (OPCIONAL)
-- Ejecutar en Supabase → SQL Editor (después de 04 y 05) para que el
-- Dashboard del Panel tenga datos que mostrar en la presentación.
--
-- - Crea unas 300 reservas de ejemplo: los últimos 90 días y las próximas
--   3 semanas, con más clientes de viernes a domingo y en la noche.
-- - Quedan a nombre del usuario admin (así ningún cliente real las ve en
--   "Mi cuenta") y con el mensaje "DEMO - dato de prueba para el dashboard".
-- - Si se vuelve a ejecutar, borra las de prueba anteriores y crea nuevas.
--
-- PARA BORRARLAS después de la presentación, ejecutar solo esta línea:
--   delete from public.reservas where mensaje = 'DEMO - dato de prueba para el dashboard';
-- ==========================================================================

-- Las reservas pasadas no pasarían la validación ("fecha pasada"),
-- así que se apaga el trigger solo mientras se cargan los datos.
alter table public.reservas disable trigger antes_de_reservar;

do $$
declare
  marca     constant text := 'DEMO - dato de prueba para el dashboard';
  admin_id  uuid;
  hoy       date := (now() at time zone 'America/Lima')::date;
  d         date;
  dia       int;
  cantidad  int;
  i         int;
  k         int;
  v_hora    time;
  v_personas int;
  v_paquete text;
  v_tipo    text;
  v_ubic    text;
  v_estado  text;
  v_pedido  text[];
  piso_tomado boolean;

  -- reservas base por día: domingo, lunes ... sábado
  por_dia   int[] := array[5, 1, 1, 2, 3, 5, 7];
  -- las horas se repiten para que unas salgan más que otras (horas pico)
  horas_noche text[] := array['18:30','19:00','19:00','19:30','19:30','19:30','20:00','20:00','20:00','20:00',
                              '20:30','20:30','20:30','21:00','21:00','21:30','22:00'];
  horas_almuerzo text[] := array['12:30','13:00','13:00','13:30','13:30','13:30','14:00','14:00','14:30','15:00'];
  -- los platos que aparecen más veces en la lista salen como "más pedidos"
  platos text[] := array[
    'Gran Parrillada','Gran Parrillada','Gran Parrillada','Gran Parrillada','Gran Parrillada','Gran Parrillada',
    'Bife Ancho','Bife Ancho','Bife Ancho','Bife Ancho','Bife Ancho',
    'Picaña Angus','Picaña Angus','Picaña Angus','Picaña Angus',
    'Parrilla para Dos','Parrilla para Dos','Parrilla para Dos','Parrilla para Dos',
    'Provoleta Perfecta','Provoleta Perfecta','Provoleta Perfecta',
    'Empanadas Argentinas','Empanadas Argentinas','Empanadas Argentinas',
    'Bife de Chorizo','Bife de Chorizo','Bife de Chorizo',
    'Entraña Fina','Entraña Fina','Tomahawk Angus','Tomahawk Angus',
    'Costillar a la Leña','Costillar a la Leña','Milanesa Napolitana','Milanesa Napolitana',
    'Parrilla para Cuatro','Colita de Cuadril','Cordero a las Brasas','Matambrito a la Parrilla',
    'Papas Patagonia','Papas Patagonia','Mollejas de Res','Trilogía de Chorizos','Empanadas Angus',
    'Pollo Punto Asado','Pollo al Limón','Pastel de Papa','Milanesa Argentina','Panceta Braseada',
    'Panqueque de Dulce de Leche','Panqueque de Dulce de Leche','Volcán de Chocolate','Volcán de Chocolate',
    'Suspiro a la Limeña','Tres Leches','Flan con Dulce de Leche','Brownie con Helado',
    'Malbec Pampas','Nostrum Tacama'];
  paquetes text[] := array['Cumpleañero','Cumpleañero','Cumpleañero','Parrilla en vivo','Parrilla en vivo',
                           'Empresarial','Segundo piso exclusivo'];
begin
  select id into admin_id from public.perfiles where rol = 'admin' order by creado_en limit 1;
  if admin_id is null then
    raise exception 'Primero crea un usuario con rol admin.';
  end if;

  delete from public.reservas where mensaje = marca;
  perform setseed(0.42);  -- siempre salen los mismos datos

  for d in select generate_series(hoy - 90, hoy + 21, interval '1 day')::date loop
    dia := extract(dow from d);
    cantidad := por_dia[dia + 1] + floor(random() * 3)::int - 1;
    if d > hoy then cantidad := cantidad / 2; end if;  -- a futuro hay menos reservas todavía
    piso_tomado := false;

    for i in 1 .. greatest(cantidad, 0) loop
      -- hora: fines de semana también hay almuerzo
      if dia in (0, 6) and random() < 0.45 then
        v_hora := horas_almuerzo[1 + floor(random() * array_length(horas_almuerzo, 1))::int];
      else
        v_hora := horas_noche[1 + floor(random() * array_length(horas_noche, 1))::int];
      end if;

      -- paquete (uno de cada 5 reservas, aprox.)
      v_paquete := null;
      if random() < 0.2 then
        v_paquete := paquetes[1 + floor(random() * array_length(paquetes, 1))::int];
        if v_paquete = 'Segundo piso exclusivo' and (piso_tomado or dia not in (0, 5, 6)) then
          v_paquete := 'Cumpleañero';
        end if;
      end if;

      v_tipo := case when random() < 0.75 then 'Cena' when random() < 0.5 then 'Aniversario' else 'Cumpleaños' end;
      v_ubic := case when random() < 0.7 then 'Primer piso' else 'Segundo piso' end;
      if piso_tomado then v_ubic := 'Primer piso'; end if;

      v_personas := case v_paquete
        when 'Cumpleañero'            then 4 + floor(random() * 7)::int    -- 4 a 10
        when 'Parrilla en vivo'       then 4 + floor(random() * 7)::int    -- 4 a 10
        when 'Empresarial'            then 8 + floor(random() * 15)::int   -- 8 a 22
        when 'Segundo piso exclusivo' then 18 + floor(random() * 20)::int  -- 18 a 37
        else 2 + floor(random() * 5)::int                                  -- 2 a 6
      end;
      if v_paquete = 'Cumpleañero' then v_tipo := 'Cumpleaños'; end if;
      if v_paquete = 'Empresarial' then v_tipo := 'Reunión de trabajo'; end if;
      if v_paquete = 'Segundo piso exclusivo' then v_ubic := 'Segundo piso'; piso_tomado := true; end if;

      -- "¿qué piensas pedir?": 7 de cada 10 anotan de 1 a 3 platos
      v_pedido := '{}';
      if random() < 0.7 then
        for k in 1 .. 1 + floor(random() * 3)::int loop
          v_pedido := array(select distinct unnest(v_pedido || platos[1 + floor(random() * array_length(platos, 1))::int]));
        end loop;
      end if;

      -- estado: las pasadas casi todas confirmadas; las futuras, algunas pendientes
      if d < hoy then
        v_estado := case when random() < 0.86 then 'confirmada' when random() < 0.7 then 'cancelada' else 'rechazada' end;
      else
        v_estado := case when random() < 0.6 then 'confirmada' else 'pendiente' end;
      end if;

      insert into public.reservas
        (usuario_id, fecha, hora, personas, tipo, ubicacion, paquete, pedido, estado, mensaje, creado_en)
      values
        (admin_id, d, v_hora, v_personas, v_tipo, v_ubic, v_paquete, v_pedido, v_estado, marca,
         least(now(), d - (1 + floor(random() * 10))::int + time '10:00'));
    end loop;
  end loop;
end;
$$;

alter table public.reservas enable trigger antes_de_reservar;

-- Resumen de lo que se cargó
select estado, count(*) as reservas, sum(personas) as personas
from public.reservas
where mensaje = 'DEMO - dato de prueba para el dashboard'
group by estado
order by reservas desc;
