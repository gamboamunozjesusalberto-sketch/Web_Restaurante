/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE CONTACTO (CONTACTO.JS)
 * Funcionalidades exclusivas de contacto.html:
 * - Resalta el día actual y muestra si estamos abiertos
 * - Formulario de reserva: se guarda en Supabase con la cuenta del cliente
 *   (si Supabase no está configurado, se envía por WhatsApp)
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const WHATSAPP = '51919293435';

  // día actual y estado según la tabla de horarios //
  const ahora = new Date();
  const dia = ahora.getDay();
  const fila = document.querySelector(`.tabla-horario tr[data-dia="${dia}"]`);
  const estado = document.getElementById('hoy-estado');

  if (fila) fila.classList.add('hoy');

  if (estado) {
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const finDeSemana = dia === 0 || dia === 6;
    const apertura = (finDeSemana ? 12 : 18) * 60;
    const cierre = 23 * 60;
    const abierto = minutos >= apertura && minutos < cierre;

    estado.textContent = abierto ? 'Abierto ahora · cerramos a las 11:00 p. m.' : 'Cerrado ahora';
    estado.classList.add(abierto ? 'abierto' : 'cerrado');
    estado.hidden = false;
  }

  // ---------- formulario de reserva ----------
  // Con Supabase conectado: la reserva se guarda en la base de datos con los
  // datos de la cuenta. Sin Supabase (o sin configurar): se envía por WhatsApp.
  const form = document.getElementById('form-reserva');
  const feedback = document.getElementById('form-feedback');
  if (!form) return;

  // fecha y hora son campos ocultos: se llenan al tocar los botones de día y hora
  const fechaInput = form.elements.fecha;
  const horaInput = form.elements.hora;
  const DIAS_A_MOSTRAR = 30; // la base de datos acepta hasta 60 días adelante

  // fecha local en formato AAAA-MM-DD (sin pasar por UTC)
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const hoyISO = aISO(ahora);

  // ---------- días en tarjetas (en vez del calendario del navegador) ----------
  const contenedorDias = document.getElementById('dias-reserva');

  function pintarDias() {
    contenedorDias.innerHTML = '';
    for (let i = 0; i < DIAS_A_MOSTRAR; i++) {
      const f = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i, 12);
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'dia';
      boton.dataset.fecha = aISO(f);
      boton.setAttribute('role', 'radio');
      boton.setAttribute('aria-checked', 'false');
      const nombre = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : f.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');
      const mes = f.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
      boton.innerHTML = `<span class="dia-nombre">${nombre}</span><strong>${f.getDate()}</strong><span class="dia-mes">${mes}</span>`;
      boton.setAttribute('aria-label', f.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }));
      // hoy se apaga si ya no quedan horas
      if (i === 0 && !horariosDelDia(boton.dataset.fecha).some((h) => !horaPasada(h))) boton.disabled = true;
      contenedorDias.append(boton);
    }
  }

  contenedorDias.addEventListener('click', (e) => {
    const boton = e.target.closest('.dia');
    if (!boton || boton.disabled) return;
    contenedorDias.querySelectorAll('.dia').forEach((b) => {
      b.classList.toggle('activo', b === boton);
      b.setAttribute('aria-checked', b === boton);
    });
    fechaInput.value = boton.dataset.fecha;
    calendario.value = boton.dataset.fecha;
    contenedorDias.classList.remove('campo-error');
    pintarHorarios();
  });

  // también se puede marcar la fecha en el calendario del navegador
  const calendario = document.getElementById('r-calendario');
  const limite = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 60, 12);
  calendario.min = hoyISO;
  calendario.max = aISO(limite);

  function elegirDelCalendario() {
    const valor = calendario.value;
    if (!valor || valor < calendario.min || valor > calendario.max) return;
    fechaInput.value = valor;
    let tarjeta = null;
    contenedorDias.querySelectorAll('.dia').forEach((b) => {
      const es = b.dataset.fecha === valor;
      b.classList.toggle('activo', es);
      b.setAttribute('aria-checked', es);
      if (es) tarjeta = b;
    });
    if (tarjeta) tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    contenedorDias.classList.remove('campo-error');
    pintarHorarios();
  }
  calendario.addEventListener('change', elegirDelCalendario);
  calendario.addEventListener('input', elegirDelCalendario);

  // flechas para desplazar la fila de días
  document.querySelectorAll('.dias-flecha').forEach((flecha) => {
    flecha.addEventListener('click', () => {
      contenedorDias.scrollBy({ left: Number(flecha.dataset.mover) * contenedorDias.clientWidth * 0.8, behavior: 'smooth' });
    });
  });

  function horaPasada(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m <= ahora.getHours() * 60 + ahora.getMinutes();
  }

  // ---------- horarios en botones (en vez del reloj del navegador) ----------
  // Lunes a viernes de 18:00 a 22:30 · sábado y domingo de 12:00 a 22:30, cada 30 minutos.
  const contenedorHoras = document.getElementById('horas-reserva');

  function horariosDelDia(fechaISO) {
    const dia = new Date(fechaISO + 'T12:00').getDay();
    const desde = (dia === 0 || dia === 6) ? 12 * 60 : 18 * 60;
    const lista = [];
    for (let m = desde; m <= 22 * 60 + 30; m += 30) {
      lista.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    }
    return lista;
  }

  function hora12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  }

  function pintarHorarios() {
    horaInput.value = '';
    contenedorHoras.innerHTML = '';
    if (!fechaInput.value) {
      contenedorHoras.innerHTML = '<p class="horarios-vacio"><i class="bi bi-calendar-event" aria-hidden="true"></i> Primero elige el día para ver los horarios.</p>';
      return;
    }
    const esHoy = fechaInput.value === hoyISO;
    horariosDelDia(fechaInput.value).forEach((hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'horario';
      boton.textContent = hora12(hhmm);
      boton.setAttribute('role', 'radio');
      boton.setAttribute('aria-checked', 'false');
      boton.dataset.hora = hhmm;
      // si es hoy, las horas que ya pasaron no se pueden elegir
      if (esHoy && horaPasada(hhmm)) boton.disabled = true;
      contenedorHoras.append(boton);
    });
    if (!contenedorHoras.querySelector('.horario:not(:disabled)')) {
      contenedorHoras.innerHTML = '<p class="horarios-vacio">Ya no quedan horarios para hoy. Elige otra fecha.</p>';
    }
  }

  // un solo listener para todos los botones (delegación de eventos)
  contenedorHoras.addEventListener('click', (e) => {
    const boton = e.target.closest('.horario');
    if (!boton || boton.disabled) return;
    contenedorHoras.querySelectorAll('.horario').forEach((b) => {
      b.classList.remove('activo');
      b.setAttribute('aria-checked', 'false');
    });
    boton.classList.add('activo');
    boton.setAttribute('aria-checked', 'true');
    horaInput.value = boton.dataset.hora;
    contenedorHoras.classList.remove('campo-error');
  });

  pintarDias();

  // contador de personas con botones − y +
  document.querySelectorAll('[data-contador]').forEach((contador) => {
    const input = contador.querySelector('input');
    contador.addEventListener('click', (e) => {
      const boton = e.target.closest('.contador-btn');
      if (!boton) return;
      const valor = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value || 0) + Number(boton.dataset.paso)));
      input.value = valor;
    });
  });

  const mostrar = (texto, ok = false) => {
    feedback.textContent = texto;
    feedback.classList.toggle('ok', ok);
  };

  form.addEventListener('input', (e) => e.target.classList.remove('campo-error'));

  // validación nativa con mensaje propio //
  function formularioValido() {
    form.querySelectorAll('.campo-error').forEach((el) => el.classList.remove('campo-error'));
    // día y hora son campos ocultos: se revisan a mano
    if (!fechaInput.value) {
      contenedorDias.classList.add('campo-error');
      contenedorDias.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mostrar('Elige el día de tu reserva.');
      return false;
    }
    if (!horaInput.value) {
      contenedorHoras.classList.add('campo-error');
      contenedorHoras.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mostrar('Elige una hora para tu reserva.');
      return false;
    }
    if (form.checkValidity()) return true;
    const invalido = form.querySelector(':invalid');
    invalido.classList.add('campo-error');
    invalido.focus();
    mostrar('Revisa el campo marcado: ' + (invalido.validationMessage || 'dato no válido') + '.');
    return false;
  }

  // ----- Modo WhatsApp (cuando todavía no hay base de datos) -----
  function enviarPorWhatsApp() {
    const d = new FormData(form);
    const [anio, mes, diaMes] = d.get('fecha').split('-');
    const preferencias = d.getAll('preferencia');
    const mensaje = (d.get('mensaje') || '').trim();
    const lineas = [
      '¡Hola Punto Asado! Quisiera reservar una mesa:',
      '',
      `• Nombre: ${d.get('nombre').trim()}`,
      `• Celular: ${d.get('telefono').trim()}`,
      `• Fecha: ${diaMes}/${mes}/${anio}`,
      `• Hora: ${d.get('hora')}`,
      `• Personas: ${d.get('personas')}`,
      `• Tipo: ${d.get('tipo')}`,
      `• Ubicación: ${d.get('ubicacion')}`
    ];
    if (preferencias.length) lineas.push(`• Preferencias: ${preferencias.join(', ')}`);
    if (mensaje) lineas.push(`• Mensaje: ${mensaje}`);
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lineas.join('\n'))}`;
    const ventana = window.open(url, '_blank', 'noopener');
    mostrar(
      ventana
        ? 'Listo: se abrió WhatsApp con tu reserva. Envía el mensaje para que la confirmemos.'
        : 'Tu navegador bloqueó la ventana. Permite las ventanas emergentes o escríbenos al +51 919 293 435.',
      Boolean(ventana)
    );
  }

  if (!db) {
    const boton = document.getElementById('btn-reservar');
    boton.innerHTML = '<i class="bi bi-whatsapp me-2" aria-hidden="true"></i>Enviar reserva por WhatsApp';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (formularioValido()) enviarPorWhatsApp();
    });
    return;
  }

  // ----- Modo cuenta (Supabase) -----
  const boton = document.getElementById('btn-reservar');
  const aviso = document.getElementById('aviso-cuenta');
  let perfil = null;

  Sesion.perfil().then((p) => {
    perfil = p;
    if (!perfil) {
      // sin sesión: se muestra el aviso y el formulario queda bloqueado
      aviso.hidden = false;
      form.classList.add('bloqueado');
      form.setAttribute('aria-hidden', 'true');
      form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      return;
    }
    // con sesión: nombre y celular salen de la cuenta y no se pueden cambiar aquí
    form.elements.nombre.value = perfil.nombre;
    form.elements.nombre.readOnly = true;
    form.elements.telefono.value = perfil.telefono || '';
    form.elements.telefono.readOnly = Boolean(perfil.telefono);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!perfil || !formularioValido()) return;

    const d = new FormData(form);
    boton.disabled = true;
    mostrar('Guardando tu reserva…', true);

    const { error } = await db.from('reservas').insert({
      fecha: d.get('fecha'),
      hora: d.get('hora'),
      personas: Number(d.get('personas')),
      tipo: d.get('tipo'),
      ubicacion: d.get('ubicacion'),
      preferencias: d.getAll('preferencia').join(', ') || null,
      mensaje: (d.get('mensaje') || '').trim() || null
    });

    boton.disabled = false;
    if (error) {
      // los mensajes de validación de la base de datos ya vienen en español
      mostrar('No se pudo guardar: ' + error.message);
      return;
    }
    form.elements.fecha.value = '';
    calendario.value = '';
    pintarDias();
    pintarHorarios();
    form.elements.mensaje.value = '';
    feedback.classList.add('ok');
    feedback.innerHTML = '¡Reserva enviada! Está <strong>pendiente</strong> de confirmación. Puedes verla en <a href="cuenta.html#mis-reservas">Mi cuenta</a>.';
  });
});
