/**
 * ==========================================================================
 * PUNTO ASADO - MI CUENTA (CUENTA.JS)
 * Perfil del cliente:
 * - Resumen (próxima reserva, pendientes y notificaciones sin leer)
 * - Mis reservas con filtro y opción de cancelar las pendientes
 * - Editar mis datos (nombre, celular y si acepta promociones)
 * - Notificaciones de promociones (marcar como leídas)
 * - Crear nueva contraseña cuando se entra desde el correo de recuperación
 * Todo se lee y guarda en Supabase; las reglas RLS impiden ver datos de otros.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const listaReservas = document.getElementById('lista-reservas');
  const listaNotif = document.getElementById('lista-notificaciones');

  if (!db) {
    listaReservas.innerHTML = '<li class="vacio">Las cuentas todavía no están conectadas.</li>';
    listaNotif.innerHTML = '';
    return;
  }

  // Al entrar desde el correo "recuperar contraseña" se muestra el formulario
  db.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
      const seccion = document.getElementById('nueva-clave');
      seccion.hidden = false;
      seccion.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const usuario = await Sesion.exigir();
  if (!usuario) return;
  const perfil = await Sesion.perfil();
  if (!perfil) return;

  // ---------- utilidades ----------
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const hoyISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const hora12 = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  // Crea un elemento con texto seguro (textContent evita inyección de HTML)
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  };
  const avisar = (form, texto, ok) => {
    const p = form.querySelector('.form-feedback');
    p.textContent = texto;
    p.classList.toggle('ok', ok);
  };

  document.getElementById('saludo-nombre').textContent = perfil.nombre.split(' ')[0];
  document.querySelectorAll('.btn-salir[data-cerrar-sesion]').forEach((b) => b.addEventListener('click', () => Sesion.cerrar()));

  // ---------- MIS RESERVAS ----------
  let reservas = [];
  let filtro = 'proximas';

  // una reserva cancelada por el restaurante puede traer otra mesa ofrecida para aceptar
  const conOferta = (r) => r.oferta_mesa && !r.oferta_aceptada && r.oferta_fecha >= hoyISO;

  async function cargarReservas() {
    await db.rpc('vencer_reservas'); // las pendientes que ya pasaron sin confirmar quedan vencidas
    const { data, error } = await db.from('reservas')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
    if (error) {
      listaReservas.innerHTML = '<li class="vacio">No se pudieron cargar tus reservas.</li>';
      return;
    }
    reservas = data;
    pintarReservas();
    pintarResumen();
  }

  function pintarReservas() {
    const visibles = reservas.filter((r) => {
      if (filtro === 'proximas') return (r.fecha >= hoyISO && (r.estado === 'pendiente' || r.estado === 'confirmada')) || conOferta(r);
      if (filtro === 'pasadas') return !conOferta(r) && (r.fecha < hoyISO || ['cancelada', 'rechazada', 'vencida', 'atendida', 'no_vino'].includes(r.estado));
      return true;
    });
    if (filtro !== 'proximas') visibles.reverse(); // las más recientes primero

    listaReservas.innerHTML = '';
    if (!visibles.length) {
      const vacio = crear('li', 'vacio');
      vacio.innerHTML = filtro === 'proximas'
        ? 'No tienes reservas próximas. <a href="contacto.html#reserva">Reserva una mesa</a>.'
        : 'No hay reservas para mostrar.';
      listaReservas.append(vacio);
      return;
    }

    visibles.forEach((r) => {
      const [, mes, dia] = r.fecha.split('-');
      const li = crear('li', 'reserva-item');

      const fecha = crear('div', 'reserva-fecha');
      fecha.append(crear('b', '', Number(dia)), crear('small', '', MESES[Number(mes) - 1]));

      const info = crear('div', 'reserva-info');
      info.append(
        crear('h3', '', `${r.paquete ? 'Paquete ' + r.paquete : r.tipo} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`),
        crear('p', '', `${hora12(r.hora)} · ${r.ubicacion}${r.mesa ? ((r.mesas_extra || []).length ? ' · Mesas juntas ' : ' · Mesa ') + [r.mesa, ...(r.mesas_extra || [])].join(' + ') : ''}${r.preferencias ? ' · ' + r.preferencias : ''}`)
      );
      if (r.descuento) info.append(crear('p', 'reserva-descuento', `🎁 Tienes ${r.descuento}% de descuento en tu consumo`));
      if (r.motivo) info.append(crear('p', 'reserva-motivo', 'Motivo: ' + r.motivo));
      if (r.estado === 'vencida') info.append(crear('p', 'reserva-motivo', 'Venció sin confirmarse. Puedes hacer una nueva reserva.'));
      if (r.estado === 'no_vino') info.append(crear('p', 'reserva-motivo', 'Te esperamos 15 minutos y no llegaste, así que liberamos la mesa. Si fue un error, escríbenos por WhatsApp.'));
      if (r.estado === 'atendida') {
        const gracias = crear('p', 'reserva-descuento');
        gracias.innerHTML = '¡Gracias por venir! <a href="#opinar">Cuéntanos qué tal te fue</a>.';
        info.append(gracias);
      }
      if (conOferta(r)) {
        const oferta = crear('div', 'reserva-oferta');
        const [, om, od] = r.oferta_fecha.split('-');
        oferta.append(crear('p', '', `Te ofrecemos la mesa ${r.oferta_mesa} el ${od}/${om} a las ${hora12(r.oferta_hora)}${r.oferta_descuento ? ` con ${r.oferta_descuento}% de descuento` : ''}.`));
        const aceptar = crear('button', 'btn-aceptar-oferta', 'Aceptar esta mesa');
        aceptar.type = 'button';
        aceptar.addEventListener('click', async () => {
          aceptar.disabled = true;
          const { error } = await db.rpc('aceptar_oferta', { p_id: r.id });
          if (error) {
            aceptar.disabled = false;
            oferta.append(crear('small', 'reserva-error', 'No se pudo: ' + error.message));
            return;
          }
          await cargarReservas();
        });
        oferta.append(aceptar);
        info.append(oferta);
      } else if (r.oferta_aceptada) {
        info.append(crear('p', 'reserva-descuento', 'Aceptaste la mesa que te ofrecimos ✔'));
      }

      const acciones = crear('div', 'reserva-acciones');
      const estado = crear('span', 'estado', r.estado.replace('_', ' '));
      estado.dataset.estado = r.estado;
      acciones.append(estado);
      if (r.estado === 'pendiente' && r.fecha >= hoyISO) {
        const cancelar = crear('button', 'btn-cancelar', 'Cancelar');
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => cancelarReserva(r));
        const cambiar = crear('button', 'btn-cambiar', 'Cambiar fecha');
        cambiar.type = 'button';
        cambiar.addEventListener('click', () => abrirCambio(li, r));
        acciones.append(cambiar, cancelar);
      }

      li.append(fecha, info, acciones);
      listaReservas.append(li);
    });
  }

  // ---------- CAMBIAR FECHA U HORA (solo reservas pendientes) ----------
  // Se guarda con la función cambiar_reserva() de Supabase, que vuelve a
  // validar el horario, los 60 días y el segundo piso.
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

  function horasDelDia(fechaISO) {
    const dia = new Date(fechaISO + 'T12:00').getDay();
    const apertura = typeof HORARIO !== 'undefined' ? HORARIO.apertura(dia) : (dia === 0 || dia === 6 ? '12:00' : '18:00');
    const [h0] = apertura.split(':').map(Number);
    const horas = [];
    for (let min = h0 * 60; min <= 21 * 60 + 30; min += 30) {
      horas.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
    }
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return horas.filter((hh) => fechaISO !== hoyISO || Number(hh.slice(0, 2)) * 60 + Number(hh.slice(3)) > minutosAhora);
  }

  function abrirCambio(li, r) {
    const abierto = li.querySelector('.reserva-cambio');
    if (abierto) { abierto.remove(); return; }
    document.querySelectorAll('.reserva-cambio').forEach((el) => el.remove());

    const form = crear('form', 'reserva-cambio');
    form.noValidate = true;
    const etFecha = crear('label', '', 'Nueva fecha');
    const fecha = crear('input');
    fecha.type = 'date';
    fecha.required = true;
    fecha.min = hoyISO;
    const limite = new Date();
    limite.setDate(limite.getDate() + 60);
    fecha.max = aISO(limite);
    fecha.value = r.fecha >= hoyISO ? r.fecha : hoyISO;
    etFecha.append(fecha);

    const etHora = crear('label', '', 'Nueva hora');
    const hora = crear('select');
    hora.required = true;
    etHora.append(hora);

    const llenarHoras = () => {
      const actual = hora.value || r.hora.slice(0, 5);
      hora.innerHTML = '';
      const horas = fecha.value ? horasDelDia(fecha.value) : [];
      if (!horas.length) hora.append(new Option('Sin horarios ese día', ''));
      horas.forEach((hh) => hora.append(new Option(hora12(hh), hh, false, hh === actual)));
    };
    fecha.addEventListener('change', llenarHoras);
    llenarHoras();

    const guardar = crear('button', 'btn btn-celeste btn-sm px-3', 'Guardar cambio');
    guardar.type = 'submit';
    const cerrar = crear('button', 'btn-cancelar', 'Cerrar');
    cerrar.type = 'button';
    cerrar.addEventListener('click', () => form.remove());
    const aviso = crear('p', 'form-feedback');
    aviso.setAttribute('role', 'status');
    const botones = crear('div', 'reserva-cambio-botones');
    botones.append(guardar, cerrar);
    form.append(etFecha, etHora, botones, aviso);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fecha.value || !hora.value) {
        aviso.textContent = 'Elige una fecha y una hora disponibles.';
        return;
      }
      if (fecha.value === r.fecha && hora.value === r.hora.slice(0, 5)) {
        aviso.textContent = 'Es la misma fecha y hora que ya tienes.';
        return;
      }
      guardar.disabled = true;
      aviso.classList.add('ok');
      aviso.textContent = 'Guardando…';
      const { error } = await db.rpc('cambiar_reserva', { p_id: r.id, p_fecha: fecha.value, p_hora: hora.value });
      guardar.disabled = false;
      if (error) {
        aviso.classList.remove('ok');
        aviso.textContent = 'No se pudo cambiar: ' + error.message;
        return;
      }
      cargarReservas();
    });

    li.append(form);
    fecha.focus();
  }

  async function cancelarReserva(r) {
    if (!confirm(`¿Seguro que quieres cancelar tu reserva del ${r.fecha.split('-').reverse().join('/')}?`)) return;
    const { error } = await db.from('reservas').update({ estado: 'cancelada' }).eq('id', r.id);
    if (error) return alert('No se pudo cancelar: ' + error.message);
    r.estado = 'cancelada';
    pintarReservas();
    pintarResumen();
  }

  document.querySelectorAll('.filtro-btn').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.querySelectorAll('.filtro-btn').forEach((b) => b.classList.remove('active'));
      boton.classList.add('active');
      filtro = boton.dataset.filtro;
      pintarReservas();
    });
  });

  // ---------- RESUMEN ----------
  function pintarResumen() {
    const proxima = reservas.find((r) => r.fecha >= hoyISO && (r.estado === 'pendiente' || r.estado === 'confirmada'));
    document.getElementById('resumen-proxima').textContent = proxima
      ? `${Number(proxima.fecha.split('-')[2])} ${MESES[Number(proxima.fecha.split('-')[1]) - 1]} · ${hora12(proxima.hora)}`
      : 'Sin reservas';
    document.getElementById('resumen-pendientes').textContent =
      reservas.filter((r) => r.estado === 'pendiente' && r.fecha >= hoyISO).length;
    document.getElementById('resumen-notificaciones').textContent =
      notificaciones.filter((n) => !n.leida).length;
  }

  // ---------- MIS DATOS ----------
  const formDatos = document.getElementById('form-datos');
  formDatos.elements.nombre.value = perfil.nombre;
  formDatos.elements.telefono.value = perfil.telefono || '';
  document.getElementById('c-dni').value = perfil.dni || '—';
  document.getElementById('c-email').value = perfil.email;
  formDatos.elements.acepta_promos.checked = perfil.acepta_promos;

  formDatos.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formDatos.reportValidity()) return;
    const cambios = {
      nombre: formDatos.elements.nombre.value.trim(),
      telefono: formDatos.elements.telefono.value.trim(),
      acepta_promos: formDatos.elements.acepta_promos.checked
    };
    const { error } = await db.from('perfiles').update(cambios).eq('id', usuario.id);
    if (error) return avisar(formDatos, 'No se pudo guardar: ' + error.message, false);
    avisar(formDatos, 'Datos actualizados.', true);
    document.getElementById('saludo-nombre').textContent = cambios.nombre.split(' ')[0];
  });

  // ---------- NUEVA CONTRASEÑA ----------
  const formClave = document.getElementById('form-clave');
  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formClave.reportValidity()) return;
    const { error } = await db.auth.updateUser({ password: document.getElementById('c-clave').value });
    if (error) return avisar(formClave, 'No se pudo cambiar: ' + error.message, false);
    avisar(formClave, 'Contraseña actualizada.', true);
    setTimeout(() => { document.getElementById('nueva-clave').hidden = true; }, 2000);
  });

  // ---------- NOTIFICACIONES ----------
  let notificaciones = [];

  async function cargarNotificaciones() {
    const { data, error } = await db.from('notificaciones')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(30);
    notificaciones = error ? [] : data;
    pintarNotificaciones();
    pintarResumen();
  }

  function pintarNotificaciones() {
    listaNotif.innerHTML = '';
    if (!notificaciones.length) {
      listaNotif.append(crear('li', 'vacio', 'Aún no tienes notificaciones. Cuando lancemos una promoción te llegará aquí.'));
      return;
    }
    notificaciones.forEach((n) => {
      const li = crear('li', 'notif-item' + (n.leida ? '' : ' no-leida'));
      // promoción = megáfono · aviso de reserva = calendario
      const icono = crear('i', n.promocion_id ? 'bi bi-megaphone' : 'bi bi-calendar-check');
      icono.setAttribute('aria-hidden', 'true');
      const texto = crear('div');
      const fecha = crear('time', '', new Date(n.creado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }));
      fecha.dateTime = n.creado_en;
      texto.append(crear('h3', '', n.titulo), crear('p', '', n.mensaje), fecha);
      li.append(icono, texto);
      li.addEventListener('click', () => marcarLeidas([n]));
      listaNotif.append(li);
    });
  }

  async function marcarLeidas(lista) {
    const ids = lista.filter((n) => !n.leida).map((n) => n.id);
    if (!ids.length) return;
    const { error } = await db.from('notificaciones').update({ leida: true }).in('id', ids);
    if (error) return;
    lista.forEach((n) => { n.leida = true; });
    pintarNotificaciones();
    pintarResumen();
    // actualiza la campanita de la barra
    document.querySelectorAll('.nav-badge').forEach((b) => {
      const quedan = notificaciones.filter((n) => !n.leida).length;
      b.textContent = quedan;
      b.hidden = quedan === 0;
    });
    document.querySelectorAll('.nav-badge-item').forEach((b) => {
      const quedan = notificaciones.filter((n) => !n.leida).length;
      b.textContent = quedan ? `(${quedan})` : '';
    });
  }

  document.getElementById('marcar-todas').addEventListener('click', () => marcarLeidas(notificaciones));

  await Promise.all([cargarReservas(), cargarNotificaciones()]);
  // ir a la sección pedida (ej. cuenta.html#notificaciones)
  if (/^#[a-z-]+$/.test(location.hash)) document.querySelector(location.hash)?.scrollIntoView();
});
