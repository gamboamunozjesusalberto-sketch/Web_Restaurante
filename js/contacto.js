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

  // no permitir fechas pasadas ni más de 60 días adelante //
  const fechaInput = form.elements.fecha;
  const horaInput = form.elements.hora;
  const hoy = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  const limite = new Date(hoy.getTime() + 60 * 86400000);
  fechaInput.min = hoy.toISOString().split('T')[0];
  fechaInput.max = limite.toISOString().split('T')[0];

  // la hora mínima cambia según el día: lun-vie 18:00, sáb-dom 12:00 //
  fechaInput.addEventListener('change', () => {
    if (!fechaInput.value) return;
    const diaElegido = new Date(fechaInput.value + 'T12:00').getDay();
    horaInput.min = (diaElegido === 0 || diaElegido === 6) ? '12:00' : '18:00';
    if (horaInput.value && horaInput.value < horaInput.min) horaInput.value = horaInput.min;
  });

  const mostrar = (texto, ok = false) => {
    feedback.textContent = texto;
    feedback.classList.toggle('ok', ok);
  };

  form.addEventListener('input', (e) => e.target.classList.remove('campo-error'));

  // validación nativa con mensaje propio //
  function formularioValido() {
    form.querySelectorAll('.campo-error').forEach((el) => el.classList.remove('campo-error'));
    // mensajes propios en español para la hora y la fecha
    horaInput.setCustomValidity(
      horaInput.validity.rangeUnderflow ? `Ese día atendemos desde las ${horaInput.min} horas`
        : horaInput.validity.rangeOverflow ? 'La última reserva es a las 22:30' : ''
    );
    fechaInput.setCustomValidity(
      fechaInput.validity.rangeUnderflow ? 'No se puede reservar en una fecha pasada'
        : fechaInput.validity.rangeOverflow ? 'Solo se puede reservar hasta 60 días antes' : ''
    );
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
    form.elements.hora.value = '';
    form.elements.mensaje.value = '';
    feedback.classList.add('ok');
    feedback.innerHTML = '¡Reserva enviada! Está <strong>pendiente</strong> de confirmación. Puedes verla en <a href="cuenta.html#mis-reservas">Mi cuenta</a>.';
  });
});
