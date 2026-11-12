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

  async function cargarReservas() {
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
      if (filtro === 'proximas') return r.fecha >= hoyISO && (r.estado === 'pendiente' || r.estado === 'confirmada');
      if (filtro === 'pasadas') return r.fecha < hoyISO || r.estado === 'cancelada' || r.estado === 'rechazada';
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
        crear('h3', '', `${r.tipo} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`),
        crear('p', '', `${hora12(r.hora)} · ${r.ubicacion}${r.preferencias ? ' · ' + r.preferencias : ''}`)
      );

      const acciones = crear('div', 'reserva-acciones');
      const estado = crear('span', 'estado', r.estado);
      estado.dataset.estado = r.estado;
      acciones.append(estado);
      if (r.estado === 'pendiente' && r.fecha >= hoyISO) {
        const cancelar = crear('button', 'btn-cancelar', 'Cancelar');
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => cancelarReserva(r));
        acciones.append(cancelar);
      }

      li.append(fecha, info, acciones);
      listaReservas.append(li);
    });
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
