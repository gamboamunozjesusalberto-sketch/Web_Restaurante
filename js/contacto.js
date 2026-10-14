/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE CONTACTO (CONTACTO.JS)
 * Funcionalidades exclusivas de contacto.html:
 * - Resalta el día actual y muestra si estamos abiertos
 * - Formulario de reserva que se envía por WhatsApp
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

  // formulario de reserva a whatsApp //
  const form = document.getElementById('form-reserva');
  const feedback = document.getElementById('form-feedback');
  if (!form) return;

  // no permitir fechas pasadas //
  const fechaInput = form.elements.fecha;
  const hoy = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  fechaInput.min = hoy.toISOString().split('T')[0];

  const mostrar = (texto, ok = false) => {
    feedback.textContent = texto;
    feedback.classList.toggle('ok', ok);
  };

  form.addEventListener('input', (e) => e.target.classList.remove('campo-error'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.campo-error').forEach((el) => el.classList.remove('campo-error'));

    // validación nativa con mensaje propio //
    if (!form.checkValidity()) {
      const invalido = form.querySelector(':invalid');
      invalido.classList.add('campo-error');
      invalido.focus();
      mostrar('Revisa el campo marcado: ' + (invalido.validationMessage || 'dato no válido') + '.');
      return;
    }

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
  });
});
