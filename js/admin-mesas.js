/**
 * ==========================================================================
 * PUNTO ASADO - PESTAÑA MESAS DEL PANEL (ADMIN-MESAS.JS)
 * - Mapa del local (js/mesas.js) para un día y una hora: qué mesas están
 *   ocupadas, por quién y de qué hora a qué hora
 * - Tocar una mesa: ver sus reservas del día, cambiarlas de mesa o quitarla
 * - Reservas sin mesa: asignarles una mesa libre que alcance para el grupo o,
 *   si son más de 10, juntar mesas vecinas (13-juntar-mesas.sql)
 * La base de datos (supabase/09-mesas.sql) vuelve a revisar capacidad y choques.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!db || !document.getElementById('panel-mesas') || typeof PlanoMesas === 'undefined') return;
  const perfil = await Sesion.perfil();
  if (!perfil || perfil.rol !== 'admin') return;

  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const { hora12, minutos, masDos, choca, mesasDe, textoMesas } = PlanoMesas;
  const hhmm = (t) => String(t).slice(0, 5);

  const inputDia = document.getElementById('mesas-dia');
  const selectHora = document.getElementById('mesas-hora');
  const detalle = document.getElementById('mesa-detalle');
  const listaSinMesa = document.getElementById('sin-mesa');
  const totalSinMesa = document.getElementById('sin-mesa-total');
  let reservas = [];
  let apartadas = []; // mesas ofrecidas a clientes tras una cancelación, aún sin aceptar
  let mesaVista = null;

  const plano = PlanoMesas.crear(document.getElementById('mapa-admin'), {
    admin: true,
    alElegir(codigo) { mesaVista = codigo; pintarDetalle(); }
  });

  // horarios del día: fines de semana desde las 12:00, el resto desde las 18:00, hasta las 22:30
  function horarios(fechaISO) {
    const dia = new Date(fechaISO + 'T12:00').getDay();
    const lista = [];
    for (let m = (dia === 0 || dia === 6 ? 12 : 18) * 60; m <= 22 * 60 + 30; m += 30) {
      lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    apartadas.forEach((o) => lista.push({
      id: 'oferta-' + o.id, mesa: o.oferta_mesa, desde: hhmm(o.oferta_hora), hasta: masDos(hhmm(o.oferta_hora)),
      motivo: 'reserva', nombre: (o.perfiles?.nombre || 'Cliente') + ' (ofrecida)', personas: o.personas, estado: 'pendiente'
    }));
    return lista;
  }

  function llenarHoras() {
    const anterior = selectHora.value;
    const lista = horarios(inputDia.value);
    selectHora.innerHTML = '';
    lista.forEach((h) => selectHora.append(new Option(hora12(h), h)));
    if (lista.includes(anterior)) selectHora.value = anterior;
    else {
      // hoy: la próxima media hora; otro día: las 8:00 p. m.
      const ahora = new Date();
      const actual = ahora.getHours() * 60 + ahora.getMinutes();
      const proxima = inputDia.value === aISO(ahora) && lista.find((h) => minutos(h) >= actual - 30);
      selectHora.value = proxima || (lista.includes('20:00') ? '20:00' : lista[0]);
    }
  }

  async function cargar() {
    const { data, error } = await db.from('reservas')
      .select('id, fecha, hora, personas, mesa, mesas_extra, estado, paquete, ubicacion, tipo, preferencias, origen, nombre_mesa, llegada_en, liberada_en, perfiles!usuario_id(nombre, telefono)')
      .eq('fecha', inputDia.value)
      .in('estado', ['pendiente', 'confirmada'])
      .order('hora', { ascending: true });
    if (error) {
      detalle.innerHTML = '';
      detalle.append(crear('p', 'form-feedback', 'No se pudieron cargar las reservas del día: ' + error.message));
      reservas = [];
    } else {
      // las mesas liberadas por el mozo (clientes que ya se fueron) no ocupan lugar
      reservas = data.filter((r) => !r.liberada_en)
        .map((r) => (r.nombre_mesa || r.origen === 'local' ? { ...r, perfiles: { ...(r.perfiles || {}), nombre: r.nombre_mesa || 'Sin reserva (salón)' } } : r));
    }
    const ofertas = await db.from('reservas')
      .select('id, oferta_mesa, oferta_hora, personas, perfiles!usuario_id(nombre)')
      .eq('oferta_fecha', inputDia.value)
      .eq('oferta_aceptada', false);
    apartadas = (ofertas.data || []).filter((o) => o.oferta_mesa);
    pintar();
  }

  // reservas del día en el formato del plano
  function ocupaciones() {
    const lista = [];
    reservas.forEach((r) => {
      const base = { id: r.id, nombre: r.perfiles?.nombre || 'Cliente', personas: r.personas, estado: r.estado };
      const suyas = mesasDe(r); // un grupo grande ocupa todas sus mesas juntadas
      const junta = suyas.length > 1 ? textoMesas(r) : null;
      suyas.forEach((mesa) => lista.push({ ...base, mesa, junta, desde: hhmm(r.hora), hasta: masDos(hhmm(r.hora)), motivo: 'reserva' }));
      if (r.paquete === 'Segundo piso exclusivo') {
        MESAS_LOCAL.filter((m) => m.piso === 'Segundo piso')
          .forEach((m) => lista.push({ ...base, mesa: m.codigo, desde: '00:00', hasta: '23:59', motivo: 'exclusivo' }));
      }
    });
    return lista;
  }

  // mesas donde puede ir una reserva (alcanza y nadie más la tiene en esas 2 horas)
  function mesasLibresPara(r) {
    const ocup = ocupaciones().filter((o) => o.id !== r.id);
    return MESAS_LOCAL.filter((m) => m.capacidad >= r.personas &&
      !ocup.some((o) => o.mesa === m.codigo && choca(o, hhmm(r.hora))));
  }

  function pintar() {
    const ocup = ocupaciones();
    const hora = selectHora.value;
    plano.actualizar({ reservas: ocup, hora, apertura: horarios(inputDia.value)[0] });

    const conMesa = reservas.filter((r) => r.mesa).length;
    const sinMesa = reservas.filter((r) => !r.mesa && r.paquete !== 'Segundo piso exclusivo');
    const ocupadasAhora = new Set(ocup.filter((o) => choca(o, hora)).map((o) => o.mesa)).size;
    const personas = reservas.reduce((s, r) => s + r.personas, 0);
    const kpis = [
      ['bi-calendar-check', reservas.length, 'Reservas del día'],
      ['bi-people-fill', personas, 'Personas esperadas'],
      ['bi-grid-3x3-gap', `${MESAS_LOCAL.length - ocupadasAhora}/${MESAS_LOCAL.length}`, `Libres a las ${hora12(hora)}`],
      ['bi-inbox', sinMesa.length, 'Sin mesa asignada']
    ];
    const ul = document.getElementById('mesas-kpis');
    ul.innerHTML = '';
    kpis.forEach(([icono, valor, texto]) => {
      const li = crear('li', 'dash-kpi');
      const i = crear('i', 'bi ' + icono);
      i.setAttribute('aria-hidden', 'true');
      li.append(i, crear('strong', '', String(valor)), crear('span', '', texto));
      ul.append(li);
    });

    totalSinMesa.hidden = !sinMesa.length;
    totalSinMesa.textContent = sinMesa.length;
    listaSinMesa.innerHTML = '';
    if (!sinMesa.length) {
      listaSinMesa.append(crear('li', 'sin-mesa-vacio', conMesa ? 'Todas las reservas del día tienen mesa.' : 'No hay reservas activas este día.'));
    }
    sinMesa.forEach((r) => listaSinMesa.append(filaReserva(r, true)));
    const asignables = sinMesa;
    if (asignables.length) {
      const li = crear('li', 'sin-mesa-auto');
      const boton = crear('button', 'btn-accion btn-confirmar');
      boton.type = 'button';
      boton.innerHTML = '<i class="bi bi-stars" aria-hidden="true"></i> Asignar todas con el asistente';
      boton.addEventListener('click', () => asignarTodas(asignables, boton));
      li.append(boton, crear('small', '', 'Elige para cada una la mesa libre que mejor encaja con su grupo, piso y preferencias. A los grupos de más de 10 les junta mesas vecinas.'));
      listaSinMesa.prepend(li);
    }
    pintarDetalle();
  }

  // Una reserva con su selector de mesa (para "sin mesa" y para el detalle de una mesa)
  function filaReserva(r, sinMesa) {
    const li = crear('li', 'reserva-mesa');
    const cab = crear('div', 'reserva-mesa-cab');
    const quien = crear('div', '');
    quien.append(crear('strong', '', r.perfiles?.nombre || 'Cliente'));
    quien.append(crear('small', '', `${hora12(hhmm(r.hora))} a ${hora12(masDos(hhmm(r.hora)))} · ${r.personas} personas${r.paquete ? ' · ' + r.paquete : ''}`));
    if (mesasDe(r).length > 1) {
      const junta = crear('small', 'reserva-mesa-junta');
      junta.innerHTML = '<i class="bi bi-link-45deg" aria-hidden="true"></i> ';
      junta.append(`Mesas juntas: ${textoMesas(r)}`);
      quien.append(junta);
    }
    const estado = crear('span', 'estado', r.estado);
    estado.dataset.estado = r.estado;
    cab.append(quien, estado);
    li.append(cab);

    const libres = mesasLibresPara(r).filter((m) => !mesasDe(r).includes(m.codigo));
    const acciones = crear('div', 'reserva-mesa-acciones');
    // grupo grande (o ninguna mesa sola alcanza): el asistente junta mesas vecinas
    if (r.paquete !== 'Segundo piso exclusivo' && (r.personas > 10 || (!libres.length && sinMesa))) {
      const juntar = crear('button', 'btn-accion btn-confirmar');
      juntar.type = 'button';
      juntar.innerHTML = `<i class="bi bi-link-45deg" aria-hidden="true"></i> ${r.mesa ? 'Juntar otras mesas' : 'Juntar mesas'}`;
      juntar.addEventListener('click', () => juntarMesas(r, li));
      acciones.append(juntar);
    }
    if (libres.length) {
      const select = crear('select', 'reserva-mesa-select');
      select.setAttribute('aria-label', 'Mesa para ' + (r.perfiles?.nombre || 'el cliente'));
      select.append(new Option(sinMesa ? 'Elegir mesa…' : 'Mover a…', ''));
      ['Primer piso', 'Segundo piso', 'Área libre'].forEach((piso) => {
        const grupo = document.createElement('optgroup');
        grupo.label = piso;
        libres.filter((m) => m.piso === piso)
          .forEach((m) => grupo.append(new Option(`${m.codigo} · ${m.capacidad} personas · ${m.zona}`, m.codigo)));
        if (grupo.children.length) select.append(grupo);
      });
      const boton = crear('button', 'btn-accion btn-confirmar', sinMesa ? 'Asignar' : 'Mover');
      boton.type = 'button';
      boton.addEventListener('click', () => {
        if (!select.value) return select.focus();
        guardarMesa(r, select.value, li);
      });
      acciones.append(select, boton);
    }
    if (!sinMesa) {
      const quitar = crear('button', 'btn-accion btn-rechazar', 'Quitar mesa');
      quitar.type = 'button';
      quitar.addEventListener('click', () => guardarMesa(r, null, li));
      acciones.append(quitar);
    }
    if (sinMesa) {
      const ver = crear('button', 'reserva-mesa-ver', 'Ver a esa hora');
      ver.type = 'button';
      ver.addEventListener('click', () => { selectHora.value = hhmm(r.hora); pintar(); });
      acciones.append(ver);
    }
    li.append(acciones);
    return li;
  }

  function pintarDetalle() {
    if (!mesaVista) return;
    const mesa = PlanoMesas.mesa(mesaVista);
    detalle.innerHTML = '';
    detalle.append(crear('h3', 'dash-titulo', `Mesa ${mesa.codigo}`));
    detalle.append(crear('p', 'dash-nota', `${mesa.piso}, ${mesa.zona} · hasta ${mesa.capacidad} personas`));
    const exclusiva = reservas.find((r) => r.paquete === 'Segundo piso exclusivo');
    if (mesa.piso === 'Segundo piso' && exclusiva) {
      detalle.append(crear('p', 'reserva-mesa-nota', `Todo el segundo piso es de ${exclusiva.perfiles?.nombre || 'un cliente'} (Segundo piso exclusivo, ${exclusiva.personas} personas, desde las ${hora12(hhmm(exclusiva.hora))}).`));
    }
    const suyas = reservas.filter((r) => mesasDe(r).includes(mesa.codigo));
    if (!suyas.length) {
      detalle.append(crear('p', 'sin-mesa-vacio', 'Libre todo el día.'));
      return;
    }
    const ul = crear('ul', 'sin-mesa');
    suyas.forEach((r) => ul.append(filaReserva(r, false)));
    detalle.append(ul);
  }

  // El asistente (función mejor_mesa de la base de datos) elige y se guarda una por una
  async function asignarTodas(lista, boton) {
    boton.disabled = true;
    let ok = 0;
    for (const r of lista) {
      const mesas = await buscarMesas(r);
      if (!mesas) continue;
      const { error } = mesas.length > 1
        ? await db.rpc('mozo_juntar', { p_id: r.id, p_mesas: mesas })
        : await db.rpc('mozo_asignar', { p_id: r.id, p_mesa: mesas[0] });
      if (!error) ok++;
    }
    await cargar();
    detalle.innerHTML = '';
    detalle.append(crear('p', 'dash-nota mb-0', ok
      ? `✨ El asistente ubicó ${ok} de ${lista.length} reserva${lista.length === 1 ? '' : 's'}.`
      : 'No quedaban mesas libres que alcancen para esas reservas.'));
  }

  // Una mesa sola (mejor_mesa) o, si el grupo no entra en ninguna, mesas juntas (mejor_juntas)
  async function buscarMesas(r) {
    if (r.personas <= 10) {
      const { data: mesa } = await db.rpc('mejor_mesa', {
        p_fecha: r.fecha, p_hora: hhmm(r.hora), p_personas: r.personas, p_ubicacion: r.ubicacion,
        p_preferencias: r.preferencias || null, p_tipo: r.tipo || null, p_paquete: r.paquete || null, p_excluir: r.id
      });
      if (mesa) return [mesa];
    }
    const { data: juntas } = await db.rpc('mejor_juntas', {
      p_fecha: r.fecha, p_hora: hhmm(r.hora), p_personas: r.personas, p_ubicacion: r.ubicacion, p_excluir: r.id
    });
    return juntas && juntas.length ? juntas : null;
  }

  async function juntarMesas(r, li) {
    li.querySelectorAll('button, select').forEach((el) => { el.disabled = true; });
    li.querySelector('.reserva-mesa-error')?.remove();
    const { data: juntas } = await db.rpc('mejor_juntas', {
      p_fecha: r.fecha, p_hora: hhmm(r.hora), p_personas: r.personas, p_ubicacion: r.ubicacion, p_excluir: r.id
    });
    const { error } = juntas && juntas.length
      ? await db.rpc('mozo_juntar', { p_id: r.id, p_mesas: juntas })
      : { error: { message: `no hay mesas libres que alcancen para ${r.personas} personas a esa hora, ni juntando mesas del mismo piso.` } };
    if (error) {
      li.querySelectorAll('button, select').forEach((el) => { el.disabled = false; });
      li.append(crear('small', 'reserva-mesa-error', 'No se pudo: ' + error.message));
      return;
    }
    mesaVista = juntas[0];
    plano.actualizar({ elegida: juntas[0] });
    await cargar();
    detalle.prepend(crear('p', 'dash-nota', `✨ El asistente juntó las mesas ${juntas.join(' + ')} (${PlanoMesas.mesa(juntas[0]).piso.toLowerCase()}) para ${r.perfiles?.nombre || 'el grupo'}.`));
  }

  // Siempre por la función de la base de datos: al cambiar a una mesa sola se sueltan las juntadas
  async function guardarMesa(r, mesa, li) {
    li.querySelectorAll('button, select').forEach((el) => { el.disabled = true; });
    const { error } = await db.rpc('mozo_asignar', { p_id: r.id, p_mesa: mesa });
    if (error) {
      li.querySelectorAll('button, select').forEach((el) => { el.disabled = false; });
      li.querySelector('.reserva-mesa-error')?.remove();
      li.append(crear('small', 'reserva-mesa-error', 'No se pudo: ' + error.message));
      return;
    }
    if (mesa) { mesaVista = mesa; plano.actualizar({ elegida: mesa }); }
    await cargar();
  }

  inputDia.value = aISO(new Date());
  llenarHoras();
  inputDia.addEventListener('change', () => { if (!inputDia.value) return; llenarHoras(); mesaVista = null; detalle.innerHTML = '<p class="dash-nota mb-0">Toca una mesa del mapa para ver sus reservas del día.</p>'; cargar(); });
  selectHora.addEventListener('change', pintar);
  document.getElementById('tab-mesas').addEventListener('click', cargar); // siempre trae lo último
});
