/**
 * ==========================================================================
 * PUNTO ASADO - SALÓN EN VIVO PARA LOS MOZOS (PERSONAL.JS)
 * Vista pensada para el celular. Solo entran cuentas con rol "mozo" o "admin".
 * - Mapa de mesas a la hora actual (o a otra hora del día)
 * - Tocar una mesa: quién la tiene, "llegó", "liberar", "mover a…" o, si está
 *   libre, sentar clientes que llegan sin reserva
 * - Listas: llegan pronto, en mesa ahora y reservas sin mesa (con asistente)
 * - Grupos grandes: "Juntar mesas" (13-juntar-mesas.sql) les junta mesas vecinas
 * Cada acción pasa por una función de Supabase (supabase/11-personal.sql) que
 * revisa el rol y que la mesa siga libre: dos mozos no pueden darla a la vez.
 * Se actualiza sola cada 20 segundos.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const aviso = document.getElementById('pp-aviso');
  document.querySelectorAll('[data-cerrar-sesion]').forEach((b) => b.addEventListener('click', () => Sesion.cerrar()));
  if (!db) { aviso.hidden = false; aviso.textContent = 'Sin conexión con la base de datos.'; return; }

  const usuario = await Sesion.exigir();
  if (!usuario) return;
  const perfil = await Sesion.perfil();
  if (!perfil || !['mozo', 'admin'].includes(perfil.rol)) {
    window.location.replace('cuenta.html');
    return;
  }
  document.getElementById('pp-quien').textContent = `${perfil.nombre.split(' ')[0]} · ${perfil.rol === 'admin' ? 'administrador' : 'mozo'}`;

  const { hora12, minutos, masDos, choca, mesasDe, textoMesas } = PlanoMesas;
  const hhmm = (t) => String(t).slice(0, 5);
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };
  const boton = (clase, html, alClic) => {
    const b = crear('button', 'pp-btn ' + clase);
    b.type = 'button';
    b.innerHTML = html;
    b.addEventListener('click', alClic);
    return b;
  };
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const ahoraHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const nombreDe = (r) => r.nombre_mesa || r.perfiles?.nombre || (r.origen === 'local' ? 'Sin reserva' : 'Cliente');

  let hoy = aISO(new Date());
  let reservas = [];
  let apartadas = [];
  let enVivo = true;          // "Ahora": la hora sigue al reloj
  let mesaAbierta = null;
  let ultima = 0;

  const plano = PlanoMesas.crear(document.getElementById('mapa-personal'), {
    admin: true,
    leyenda: [['libre', 'Libre'], ['enmesa', 'Comiendo'], ['ocupada', 'Reservada (llega pronto)'], ['pendiente', 'Por confirmar']],
    alElegir(codigo) { abrirMesa(codigo); }
  });

  // ---------- reloj y hora que se mira ----------
  const reloj = document.getElementById('pp-reloj');
  const selectHora = document.getElementById('pp-hora-select');
  const botonAhora = document.getElementById('pp-ahora');
  for (let m = 12 * 60; m <= 23 * 60; m += 30) {
    const h = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    selectHora.append(new Option(hora12(h), h));
  }
  {
    const ahora = minutos(ahoraHHMM());
    const opcion = [...selectHora.options].find((op) => minutos(op.value) >= ahora);
    if (opcion) selectHora.value = opcion.value;
  }
  const horaVista = () => (enVivo ? ahoraHHMM() : selectHora.value);
  botonAhora.addEventListener('click', () => { enVivo = true; pintar(); });
  selectHora.addEventListener('change', () => { enVivo = false; pintar(); });
  setInterval(() => {
    reloj.textContent = hora12(ahoraHHMM());
    const seg = Math.round((Date.now() - ultima) / 1000);
    document.getElementById('pp-actualizado').textContent = ultima ? `Actualizado hace ${seg < 60 ? seg + ' s' : Math.round(seg / 60) + ' min'}` : '';
  }, 1000);
  reloj.textContent = hora12(ahoraHHMM());

  // ---------- datos ----------
  async function cargar() {
    hoy = aISO(new Date());
    const [res, ofertas] = await Promise.all([
      db.from('reservas')
        .select('id, fecha, hora, personas, mesa, mesas_extra, estado, paquete, ubicacion, tipo, preferencias, mensaje, origen, nombre_mesa, llegada_en, liberada_en, perfiles!usuario_id(nombre, telefono)')
        .eq('fecha', hoy)
        .in('estado', ['pendiente', 'confirmada'])
        .order('hora', { ascending: true }),
      db.from('reservas').select('id, oferta_mesa, oferta_hora, personas, perfiles!usuario_id(nombre)')
        .eq('oferta_fecha', hoy).eq('oferta_aceptada', false)
    ]);
    if (res.error) {
      aviso.hidden = false;
      aviso.textContent = 'No se pudieron cargar las mesas: ' + res.error.message;
      return;
    }
    aviso.hidden = true;
    reservas = res.data.filter((r) => !r.liberada_en);
    apartadas = (ofertas.data || []).filter((o) => o.oferta_mesa);
    ultima = Date.now();
    pintar();
  }

  function ocupaciones() {
    const lista = [];
    reservas.forEach((r) => {
      const base = { id: r.id, nombre: nombreDe(r), personas: r.personas, estado: r.estado, enMesa: Boolean(r.llegada_en) };
      // si ya llegaron, la mesa está tomada desde que se sentaron aunque se pasen de las 2 horas
      let desde = hhmm(r.hora);
      if (r.llegada_en && enVivo) {
        // siguen comiendo: la mesa cuenta como ocupada hasta que el mozo la libere
        const tope = Math.max(minutos(desde), minutos(ahoraHHMM()) - 60);
        desde = `${String(Math.floor(tope / 60)).padStart(2, '0')}:${String(tope % 60).padStart(2, '0')}`;
      }
      // un grupo grande ocupa todas sus mesas juntadas
      const suyas = mesasDe(r);
      const junta = suyas.length > 1 ? textoMesas(r) : null;
      suyas.forEach((mesa) => lista.push({ ...base, mesa, junta, desde, hasta: masDos(desde), motivo: 'reserva' }));
      if (r.paquete === 'Segundo piso exclusivo') {
        MESAS_LOCAL.filter((m) => m.piso === 'Segundo piso')
          .forEach((m) => lista.push({ ...base, mesa: m.codigo, desde: '00:00', hasta: '23:59', motivo: 'exclusivo' }));
      }
    });
    apartadas.forEach((o) => lista.push({ id: 'o' + o.id, mesa: o.oferta_mesa, desde: hhmm(o.oferta_hora), hasta: masDos(hhmm(o.oferta_hora)), motivo: 'reserva', nombre: (o.perfiles?.nombre || 'Cliente') + ' (ofrecida)', estado: 'pendiente' }));
    return lista;
  }

  const libresA = (hora, personas, excluir) => MESAS_LOCAL.filter((m) => m.capacidad >= personas &&
    !ocupaciones().some((o) => o.id !== excluir && o.mesa === m.codigo && (choca(o, hora) || (o.enMesa && minutos(o.desde) <= minutos(hora)))));

  // ---------- pintar ----------
  function pintar() {
    const hora = horaVista();
    botonAhora.classList.toggle('activo', enVivo);
    if (!enVivo) selectHora.classList.add('activo'); else selectHora.classList.remove('activo');
    const ocup = ocupaciones();
    plano.actualizar({ reservas: ocup, hora, apertura: '12:00' });

    const tomadas = new Set(ocup.filter((o) => choca(o, hora)).map((o) => o.mesa));
    const enMesa = reservas.filter((r) => r.llegada_en);
    const llegan = reservas.filter((r) => !r.llegada_en && minutos(hhmm(r.hora)) >= minutos(ahoraHHMM()) - 30)
      .filter((r) => minutos(hhmm(r.hora)) - minutos(ahoraHHMM()) <= 180);
    const sinMesa = reservas.filter((r) => !r.mesa && r.paquete !== 'Segundo piso exclusivo');
    const kpis = [
      ['bi-check-circle', MESAS_LOCAL.length - tomadas.size, 'Libres', 'libre'],
      ['bi-cup-hot', enMesa.length, 'Comiendo', 'enmesa'],
      ['bi-clock', llegan.length, 'Llegan en 3 h', 'llegan'],
      ['bi-inbox', sinMesa.length, 'Sin mesa', 'sinmesa']
    ];
    const ul = document.getElementById('pp-kpis');
    ul.innerHTML = '';
    kpis.forEach(([icono, valor, texto, clase]) => {
      const li = crear('li', 'pp-kpi pp-kpi-' + clase);
      li.innerHTML = `<i class="bi ${icono}" aria-hidden="true"></i>`;
      li.append(crear('strong', '', String(valor)), crear('span', '', texto));
      ul.append(li);
    });

    lista('pp-llegan', 'pp-n-llegan', llegan, (r) => {
      const acciones = [];
      if (r.mesa) acciones.push(boton('pp-ok', '<i class="bi bi-person-check"></i> Llegó', () => accion('mozo_llegada', { p_id: r.id }, `${nombreDe(r)} ya está en ${enMesas(r)}.`)));
      else acciones.push(botonAsistente(r));
      return acciones;
    }, 'Nadie más llega en las próximas 3 horas.');
    lista('pp-enmesa', 'pp-n-enmesa', enMesa, (r) => [
      boton('pp-liberar', '<i class="bi bi-door-open"></i> Se fueron', () => accion('mozo_liberar', { p_id: r.id }, `${mesasLibres(r)}.`))
    ], 'No hay mesas comiendo ahora.');
    lista('pp-sinmesa', 'pp-n-sinmesa', sinMesa, (r) => [botonAsistente(r)], 'Todas las reservas de hoy tienen mesa.');

    if (mesaAbierta) abrirMesa(mesaAbierta, true);
  }

  function lista(id, idCuenta, items, acciones, vacio) {
    const ul = document.getElementById(id);
    document.getElementById(idCuenta).textContent = items.length || '';
    ul.innerHTML = '';
    if (!items.length) { ul.append(crear('li', 'pp-vacio', vacio)); return; }
    items.forEach((r) => {
      const li = crear('li', 'pp-item');
      const mesa = crear('button', 'pp-mesa-chip' + (mesasDe(r).length > 1 ? ' pp-mesa-junta' : ''), r.mesa ? textoMesas(r) : '—');
      mesa.type = 'button';
      mesa.disabled = !r.mesa;
      mesa.setAttribute('aria-label', r.mesa ? 'Ver ' + enMesas(r) : 'Sin mesa');
      mesa.addEventListener('click', () => r.mesa && abrirMesa(r.mesa));
      const info = crear('div', 'pp-item-info');
      info.append(crear('strong', '', nombreDe(r)));
      const detalle = [`${hora12(hhmm(r.hora))}`, `${r.personas} pers.`];
      if (r.paquete) detalle.push(r.paquete);
      if (r.estado === 'pendiente') detalle.push('por confirmar');
      if (r.preferencias) detalle.push(r.preferencias);
      info.append(crear('small', '', detalle.join(' · ')));
      const caja = crear('div', 'pp-item-acciones');
      acciones(r).forEach((a) => caja.append(a));
      li.append(mesa, info, caja);
      ul.append(li);
    });
  }

  const enMesas = (r) => (mesasDe(r).length > 1 ? 'las mesas ' : 'la mesa ') + textoMesas(r);
  const mesasLibres = (r) => (mesasDe(r).length > 1 ? `Mesas ${textoMesas(r)} libres` : `Mesa ${r.mesa} libre`);

  // El asistente elige la mejor mesa libre (mejor_mesa) o, si el grupo no entra
  // en una sola, junta las mesas vecinas que mejor encajan (mejor_juntas)
  function botonAsistente(r, texto) {
    const grande = r.personas > 10;
    const etiqueta = texto || (grande ? '<i class="bi bi-link-45deg"></i> Juntar mesas' : '<i class="bi bi-stars"></i> Dar mesa');
    return boton('pp-ia', etiqueta, async (e) => {
      e.currentTarget.disabled = true;
      let mesa = null;
      if (!grande) {
        ({ data: mesa } = await db.rpc('mejor_mesa', {
          p_fecha: r.fecha, p_hora: hhmm(r.hora), p_personas: r.personas, p_ubicacion: r.ubicacion,
          p_preferencias: r.preferencias || null, p_tipo: r.tipo || null, p_paquete: r.paquete || null, p_excluir: r.id
        }));
      }
      if (mesa) { accion('mozo_asignar', { p_id: r.id, p_mesa: mesa }, `✨ Mesa ${mesa} para ${nombreDe(r)}.`); return; }
      const { data: juntas } = await db.rpc('mejor_juntas', {
        p_fecha: r.fecha, p_hora: hhmm(r.hora), p_personas: r.personas, p_ubicacion: r.ubicacion, p_excluir: r.id
      });
      if (!juntas || !juntas.length) { avisar(`No hay mesas libres que alcancen para ${r.personas} personas a esa hora, ni juntando mesas.`, true); pintar(); return; }
      accion('mozo_juntar', { p_id: r.id, p_mesas: juntas },
        `✨ Para ${r.personas} personas junten las mesas ${juntas.join(' + ')} (${PlanoMesas.mesa(juntas[0]).piso.toLowerCase()}).`);
    });
  }

  // ---------- hoja de una mesa ----------
  const hoja = document.getElementById('pp-hoja');
  const cuerpo = document.getElementById('pp-hoja-cuerpo');
  document.getElementById('pp-hoja-cerrar').addEventListener('click', () => { mesaAbierta = null; hoja.hidden = true; });

  function abrirMesa(codigo, refresco = false) {
    if (!codigo) { mesaAbierta = null; hoja.hidden = true; return; }
    mesaAbierta = codigo;
    const mesa = PlanoMesas.mesa(codigo);
    const hora = horaVista();
    const suyas = reservas.filter((r) => mesasDe(r).includes(codigo)).sort((a, b) => minutos(hhmm(a.hora)) - minutos(hhmm(b.hora)));
    const exclusivo = mesa.piso === 'Segundo piso' && reservas.find((r) => r.paquete === 'Segundo piso exclusivo');
    const activa = suyas.find((r) => r.llegada_en) || suyas.find((r) => choca({ desde: hhmm(r.hora) }, hora));
    cuerpo.innerHTML = '';

    const cab = crear('div', 'pp-hoja-cab');
    cab.append(crear('span', 'pp-hoja-codigo', mesa.codigo));
    const t = crear('div', '');
    t.append(crear('strong', '', `${mesa.piso} · ${mesa.zona}`), crear('small', '', `Hasta ${mesa.capacidad} personas`));
    cab.append(t);
    cuerpo.append(cab);

    if (exclusivo) {
      cuerpo.append(crear('p', 'pp-nota', `Segundo piso cerrado para el evento de ${nombreDe(exclusivo)} (${exclusivo.personas} personas).`));
    } else if (activa) {
      const tarjeta = crear('div', 'pp-ocupante ' + (activa.llegada_en ? 'en-mesa' : 'reservada'));
      tarjeta.append(crear('strong', '', nombreDe(activa)));
      if (mesasDe(activa).length > 1) {
        const junta = crear('small', 'pp-junta');
        junta.innerHTML = '<i class="bi bi-link-45deg" aria-hidden="true"></i> ';
        junta.append(`Mesas juntas: ${textoMesas(activa)}`);
        tarjeta.append(junta);
      }
      tarjeta.append(crear('small', '', activa.llegada_en
        ? `Comiendo desde las ${hora12(new Date(activa.llegada_en).toTimeString().slice(0, 5))} · ${activa.personas} personas`
        : `Reserva de ${hora12(hhmm(activa.hora))} a ${hora12(masDos(hhmm(activa.hora)))} · ${activa.personas} personas${activa.estado === 'pendiente' ? ' · por confirmar' : ''}`));
      if (activa.mensaje && activa.origen === 'web') tarjeta.append(crear('small', '', '“' + activa.mensaje + '”'));
      const acciones = crear('div', 'pp-hoja-acciones');
      if (!activa.llegada_en) acciones.append(boton('pp-ok', '<i class="bi bi-person-check"></i> Llegó', () => accion('mozo_llegada', { p_id: activa.id }, `${nombreDe(activa)} ya está en ${enMesas(activa)}.`)));
      else acciones.append(boton('pp-liberar', '<i class="bi bi-door-open"></i> Se fueron: liberar', () => accion('mozo_liberar', { p_id: activa.id }, `${mesasLibres(activa)}.`)));
      if (activa.personas > 10) acciones.append(botonAsistente(activa, '<i class="bi bi-link-45deg"></i> Juntar otras'));
      else acciones.append(selectorMover(activa));
      if (activa.perfiles?.telefono) {
        const tel = crear('a', 'pp-btn pp-tel');
        tel.href = 'tel:+51' + String(activa.perfiles.telefono).replace(/\D/g, '').slice(-9);
        tel.innerHTML = '<i class="bi bi-telephone"></i> Llamar';
        acciones.append(tel);
      }
      tarjeta.append(acciones);
      cuerpo.append(tarjeta);
    } else {
      // libre: sentar a clientes sin reserva
      const proxima = suyas.find((r) => minutos(hhmm(r.hora)) > minutos(hora));
      const libreHasta = proxima ? minutos(hhmm(proxima.hora)) - minutos(hora) : null;
      cuerpo.append(crear('p', 'pp-libre', proxima
        ? `Libre ahora. Próxima reserva a las ${hora12(hhmm(proxima.hora))} (${nombreDe(proxima)}).`
        : 'Libre el resto del día.'));
      if (enVivo && (libreHasta === null || libreHasta >= 120)) {
        const form = crear('form', 'pp-sentar');
        form.append(crear('strong', '', 'Sentar clientes sin reserva'));
        const fila = crear('div', 'pp-sentar-fila');
        const personas = crear('input', '');
        personas.type = 'number';
        personas.min = 1;
        personas.max = 30; // si son más que la mesa, se le juntan las vecinas
        personas.value = Math.min(2, mesa.capacidad);
        personas.setAttribute('aria-label', 'Personas');
        const nombre = crear('input', '');
        nombre.placeholder = 'Nombre (opcional)';
        nombre.maxLength = 60;
        nombre.setAttribute('aria-label', 'Nombre del cliente');
        const enviar = crear('button', 'pp-btn pp-ok', 'Sentar');
        enviar.type = 'submit';
        fila.append(personas, nombre, enviar);
        const pista = crear('small', 'pp-sentar-pista');
        const actualizarPista = () => {
          pista.textContent = Number(personas.value) > mesa.capacidad
            ? `Son más de ${mesa.capacidad}: el asistente le juntará las mesas libres más cercanas.`
            : '';
        };
        personas.addEventListener('input', actualizarPista);
        form.append(fila, pista);
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          enviar.disabled = true;
          accion('mozo_sentar', { p_mesa: codigo, p_personas: Number(personas.value), p_nombre: nombre.value.trim() || null },
            (id) => {
              const r = reservas.find((x) => x.id === id);
              return r && mesasDe(r).length > 1 ? `✨ Grupo sentado: junten las mesas ${textoMesas(r)}.` : `Mesa ${codigo} ocupada.`;
            });
        });
        cuerpo.append(form);
      } else if (enVivo) {
        cuerpo.append(crear('p', 'pp-nota', `Faltan menos de 2 horas para la próxima reserva: mejor sienta a los clientes en otra mesa.`));
      }
    }

    if (suyas.length) {
      const hoyLista = crear('ul', 'pp-dia');
      suyas.forEach((r) => {
        const li = crear('li', r === activa ? 'actual' : '');
        li.append(crear('span', '', `${hora12(hhmm(r.hora))} – ${hora12(masDos(hhmm(r.hora)))}`), crear('strong', '', nombreDe(r)));
        hoyLista.append(li);
      });
      cuerpo.append(crear('small', 'pp-dia-titulo', 'Hoy en esta mesa'), hoyLista);
    }
    hoja.hidden = false;
    if (!refresco && window.matchMedia('(max-width: 991.98px)').matches) hoja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function selectorMover(r) {
    const caja = crear('div', 'pp-mover');
    const select = crear('select', '');
    select.setAttribute('aria-label', 'Mover a otra mesa');
    select.append(new Option('Mover a…', ''));
    libresA(hhmm(r.hora), Math.min(r.personas, 10), r.id).filter((m) => m.codigo !== r.mesa)
      .forEach((m) => select.append(new Option(`${m.codigo} · ${m.capacidad}p · ${m.piso}`, m.codigo)));
    select.addEventListener('change', () => {
      if (select.value) accion('mozo_asignar', { p_id: r.id, p_mesa: select.value }, `${nombreDe(r)} pasó a la mesa ${select.value}.`);
    });
    caja.append(select);
    return caja;
  }

  // ---------- acciones (siempre por funciones de Supabase) ----------
  // ok: texto del aviso, o función que lo arma con lo que devolvió la base de datos
  async function accion(fn, args, ok) {
    const { data, error } = await db.rpc(fn, args);
    if (fn === 'mozo_asignar' && !error) mesaAbierta = args.p_mesa;
    if (fn === 'mozo_juntar' && !error) mesaAbierta = args.p_mesas[0];
    await cargar();
    if (error) avisar(error.message, true);
    else avisar(typeof ok === 'function' ? ok(data) : ok);
  }

  let toastTimer;
  function avisar(texto, error = false) {
    const toast = document.getElementById('pp-toast');
    toast.textContent = texto;
    toast.classList.toggle('error', error);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  document.getElementById('pp-actualizar').addEventListener('click', cargar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); });
  setInterval(() => { if (!document.hidden) cargar(); }, 20000);
  await cargar();
});
