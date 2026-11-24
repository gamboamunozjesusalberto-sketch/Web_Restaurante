/**
 * ==========================================================================
 * PUNTO ASADO - CHATBOT "ASADITO" (CHATBOT.JS)
 * Asistente con reglas (sin inteligencia artificial externa):
 * - Responde horarios, días disponibles, ubicación y contacto
 * - Recomienda los platos más pedidos (función platos_populares de Supabase)
 * - Explica cómo se prepara cada plato y su precio (js/carta-datos.js)
 * - Explica los paquetes
 * - Hace la reserva paso a paso: día → hora → personas → paquete → confirmar
 *   (se guarda en la tabla reservas con la cuenta del cliente; la base de
 *    datos vuelve a validar todo con el trigger validar_reserva)
 * Todo el texto del usuario se muestra con textContent (nunca como HTML).
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof CARTA === 'undefined' || typeof PAQUETES === 'undefined') return;
  cartaVisible(); // saca de CARTA los platos que el admin quitó

  const WHATSAPP = '51919293435';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const conDb = typeof db !== 'undefined' && db;

  // ---------- utilidades ----------
  // minúsculas y sin tildes, para comparar lo que escribe el usuario
  const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ').trim();
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const hoy = () => { const f = new Date(); f.setHours(12, 0, 0, 0); return f; };
  const fechaLarga = (f) => `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
  const hora12 = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  const soles = (n) => 'S/ ' + Number(n).toFixed(2);

  // horas de reserva de un día: cada 30 min desde la apertura hasta las 21:30 (última reserva)
  function horasDelDia(fecha) {
    const [h0] = HORARIO.apertura(fecha.getDay()).split(':').map(Number);
    const lista = [];
    for (let m = h0 * 60; m <= 21 * 60 + 30; m += 30) {
      lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    if (aISO(fecha) !== aISO(hoy())) return lista;
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return lista.filter((hh) => { const [h, m] = hh.split(':').map(Number); return h * 60 + m > minAhora; });
  }

  // próximos días con horarios libres
  function proximosDias(cantidad) {
    const dias = [];
    for (let i = 0; dias.length < cantidad && i < 60; i++) {
      const f = hoy();
      f.setDate(f.getDate() + i);
      if (horasDelDia(f).length) dias.push(f);
    }
    return dias;
  }

  // entiende "hoy", "mañana", "sábado", "25/11", "25 de noviembre"
  function leerFecha(texto) {
    const t = normalizar(texto);
    const base = hoy();
    if (/\bhoy\b/.test(t)) return base;
    if (/pasado manana/.test(t)) { base.setDate(base.getDate() + 2); return base; }
    if (/\bmanana\b/.test(t)) { base.setDate(base.getDate() + 1); return base; }
    const diaSemana = DIAS.map(normalizar).findIndex((d) => new RegExp('\\b' + d + '\\b').test(t));
    if (diaSemana >= 0) {
      const f = hoy();
      const suma = (diaSemana - f.getDay() + 7) % 7;
      f.setDate(f.getDate() + suma);
      return f;
    }
    let m = t.match(/(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?/);
    let dia, mes;
    if (m) { dia = Number(m[1]); mes = Number(m[2]) - 1; } else {
      m = t.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);
      if (!m) return null;
      dia = Number(m[1]);
      mes = m[2] === 'setiembre' ? 8 : MESES.indexOf(m[2]);
    }
    const f = new Date(base.getFullYear(), mes, dia, 12);
    if (f.getMonth() !== mes) return null; // por ejemplo 31/11
    if (f < base) f.setFullYear(f.getFullYear() + 1);
    return f;
  }

  // entiende "8 pm", "20:00", "8:30 de la noche", "1 de la tarde"
  function leerHora(texto) {
    const t = normalizar(texto);
    const m = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|a m|pm|p m|de la noche|de la tarde|de la manana)?/);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const sufijo = m[3] || '';
    if (/pm|p m|noche|tarde/.test(sufijo) && h < 12) h += 12;
    if (!sufijo && h >= 1 && h <= 10) h += 12; // "a las 8" en un restaurante = 8 p. m.
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // busca un plato de la carta en el texto (por nombre o palabras clave)
  function buscarPlato(texto) {
    const t = normalizar(texto);
    let mejor = null;
    let puntos = 0;
    CARTA.forEach((p) => {
      const nombre = normalizar(p.nombre);
      if (t.includes(nombre)) { if (nombre.length * 10 > puntos) { mejor = p; puntos = nombre.length * 10; } return; }
      const palabras = nombre.split(' ').filter((w) => w.length > 3 && !['parrilla', 'argentina', 'argentinas', 'angus'].includes(w));
      const coinciden = palabras.filter((w) => t.includes(w)).length;
      if (coinciden && coinciden * 5 > puntos) { mejor = p; puntos = coinciden * 5; }
    });
    return mejor;
  }

  // ¿el texto menciona un paquete? ("para un cumpleaños", "reunión de la empresa"...)
  function paqueteEnTexto(t) {
    if (/cumple/.test(t)) return 'Cumpleañero';
    if (/empresa|trabajo|corporativ|oficina/.test(t)) return 'Empresarial';
    if (/segundo piso|piso completo|exclusiv/.test(t)) return 'Segundo piso exclusivo';
    if (/en vivo|asador/.test(t)) return 'Parrilla en vivo';
    return undefined;
  }

  // ---------- interfaz ----------
  const lanzador = document.createElement('button');
  lanzador.type = 'button';
  lanzador.className = 'chat-lanzador';
  lanzador.setAttribute('aria-label', 'Abrir el asistente de Punto Asado');
  lanzador.setAttribute('aria-expanded', 'false');
  lanzador.innerHTML = '<i class="bi bi-chat-dots-fill" aria-hidden="true"></i><span class="chat-burbuja">¿Te ayudo a reservar?</span>';

  const ventana = document.createElement('section');
  ventana.className = 'chat-ventana';
  ventana.hidden = true;
  ventana.setAttribute('role', 'dialog');
  ventana.setAttribute('aria-label', 'Asistente de Punto Asado');
  ventana.innerHTML = `
    <header class="chat-cabecera">
      <span class="chat-avatar" aria-hidden="true"><i class="bi bi-fire"></i></span>
      <div><strong>Asadito</strong><small>Asistente de Punto Asado</small></div>
      <button type="button" class="chat-cerrar" aria-label="Cerrar el asistente"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
    </header>
    <div class="chat-mensajes" role="log" aria-live="polite"></div>
    <div class="chat-opciones"></div>
    <form class="chat-form">
      <label class="visually-hidden" for="chat-texto">Escribe tu pregunta</label>
      <input id="chat-texto" type="text" autocomplete="off" maxlength="200" placeholder="Escribe tu pregunta…">
      <button type="submit" aria-label="Enviar"><i class="bi bi-send-fill" aria-hidden="true"></i></button>
    </form>`;
  document.body.append(lanzador, ventana);

  const mensajes = ventana.querySelector('.chat-mensajes');
  const opciones = ventana.querySelector('.chat-opciones');
  const formChat = ventana.querySelector('.chat-form');
  const entrada = ventana.querySelector('#chat-texto');

  function burbuja(quien, partes) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + quien;
    // partes: texto, o lista de textos / { enlace, texto } / { negrita }
    (Array.isArray(partes) ? partes : [partes]).forEach((p) => {
      if (typeof p === 'string') div.append(document.createTextNode(p));
      else if (p.enlace) {
        const a = document.createElement('a');
        a.href = p.enlace;
        a.textContent = p.texto;
        if (p.enlace.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        div.append(a);
      } else if (p.negrita) {
        const b = document.createElement('strong');
        b.textContent = p.negrita;
        div.append(b);
      } else if (p.salto) div.append(document.createElement('br'));
    });
    mensajes.append(div);
    mensajes.scrollTop = mensajes.scrollHeight;
    return div;
  }

  const bot = (partes) => burbuja('bot', partes);

  // botones de respuesta rápida: [{ texto, accion }]
  function chips(lista) {
    opciones.innerHTML = '';
    lista.forEach(({ texto, accion }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.textContent = texto;
      b.addEventListener('click', () => { burbuja('yo', texto); opciones.innerHTML = ''; accion(); });
      opciones.append(b);
    });
  }

  const menuPrincipal = () => chips([
    { texto: 'Reservar una mesa', accion: iniciarReserva },
    { texto: 'Días y horarios', accion: responderHorario },
    { texto: 'Platos recomendados', accion: () => responderRecomendados('') },
    { texto: 'Paquetes', accion: responderPaquetes },
    { texto: '¿Cómo se prepara…?', accion: preguntarPlato },
    { texto: 'Hablar con una persona', accion: responderContacto }
  ]);

  let saludado = false;
  function abrir() {
    ventana.hidden = false;
    lanzador.setAttribute('aria-expanded', 'true');
    lanzador.classList.add('abierto');
    if (!saludado) {
      saludado = true;
      bot('¡Hola! Soy Asadito 🔥 Te ayudo a reservar, te cuento qué días atendemos, qué platos son los más pedidos y cómo los preparamos. ¿Qué necesitas?');
      menuPrincipal();
    }
    entrada.focus();
  }
  function cerrar() {
    ventana.hidden = true;
    lanzador.setAttribute('aria-expanded', 'false');
    lanzador.classList.remove('abierto');
    lanzador.focus();
  }
  lanzador.addEventListener('click', () => (ventana.hidden ? abrir() : cerrar()));
  ventana.querySelector('.chat-cerrar').addEventListener('click', cerrar);
  ventana.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  // ---------- respuestas ----------
  function responderHorario() {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const [ha] = HORARIO.apertura(ahora.getDay()).split(':').map(Number);
    const abierto = min >= ha * 60 && min < 23 * 60;
    bot(['Atendemos ', { negrita: HORARIO.texto }, { salto: true }, abierto ? 'Ahora mismo estamos abiertos.' : 'Ahora mismo estamos cerrados.', { salto: true }, 'Las reservas se toman hasta las 9:30 p. m.']);
    responderDias();
  }

  async function responderDias() {
    const dias = proximosDias(5);
    const partes = ['Los próximos días con horarios libres:'];
    dias.forEach((f) => partes.push({ salto: true }, `• ${fechaLarga(f)}: desde las ${hora12(horasDelDia(f)[0])}`));
    bot(partes);
    if (conDb) {
      const { data } = await db.rpc('segundo_piso_ocupado');
      if (data && data.length) {
        const fechas = data.slice(0, 4).map((d) => fechaLarga(new Date((d.segundo_piso_ocupado || d) + 'T12:00'))).join(', ');
        bot(`Ojo: el segundo piso está reservado completo el ${fechas}. El primer piso sí está disponible.`);
      }
    }
    chips([{ texto: 'Reservar una mesa', accion: iniciarReserva }, { texto: 'Volver al menú', accion: menuPrincipal }]);
  }

  async function responderRecomendados(texto) {
    const t = normalizar(texto);
    const categoria = /vino|tomar|maridaj/.test(t) ? 'vinos' : /postre|dulce/.test(t) ? 'postres' : /entrada|comenzar|picar/.test(t) ? 'entradas' : null;
    let populares = [];
    if (conDb && !categoria) {
      const { data } = await db.rpc('platos_populares', { limite: 5 });
      populares = (data || []).map((p) => CARTA.find((c) => c.nombre === p.nombre) || { nombre: p.nombre, veces: p.veces }).filter(Boolean);
    }
    let lista;
    let intro;
    if (categoria) {
      lista = CARTA.filter((p) => p.categoria === categoria).slice(0, 4);
      intro = categoria === 'vinos' ? 'Para acompañar la parrilla te recomiendo:' : 'Te recomiendo:';
    } else if (populares.length >= 3) {
      lista = populares;
      intro = 'Estos son los platos que más piden nuestros clientes:';
    } else {
      // sin datos suficientes: los cortes de la casa
      lista = ['Bife de Chorizo', 'Entraña Fina', 'Picaña Angus', 'Gran Parrillada', 'Provoleta Perfecta'].map((n) => CARTA.find((p) => p.nombre === n));
      intro = 'Los favoritos de la casa:';
    }
    const partes = [intro];
    lista.forEach((p, i) => partes.push({ salto: true }, `${i + 1}. `, { negrita: p.nombre }, p.precio ? ` (${soles(p.precio)})` : ''));
    partes.push({ salto: true }, { enlace: 'menu.html', texto: 'Ver la carta completa' });
    bot(partes);
    chips([
      ...lista.slice(0, 3).filter((p) => p.coccion).map((p) => ({ texto: `¿Cómo es ${p.nombre}?`, accion: () => responderPlato(p) })),
      { texto: 'Reservar una mesa', accion: iniciarReserva }
    ]);
  }

  function responderPlato(p) {
    bot([{ negrita: p.nombre }, p.precio != null ? ` · ${soles(p.precio)}` : ' · precio a consultar', { salto: true }, p.coccion || 'Pregúntanos por WhatsApp cómo lo preparamos.']);
    chips([
      { texto: 'Otro plato', accion: preguntarPlato },
      { texto: 'Platos recomendados', accion: () => responderRecomendados('') },
      { texto: 'Reservar una mesa', accion: iniciarReserva }
    ]);
  }

  function preguntarPlato() {
    bot('¿De qué plato quieres saber? Escribe su nombre, por ejemplo "entraña" o "picaña".');
    esperando = (texto) => {
      const p = buscarPlato(texto);
      if (p) { esperando = null; responderPlato(p); return true; }
      return false;
    };
  }

  function responderPaquetes() {
    const partes = ['Tenemos estos paquetes:'];
    PAQUETES.forEach((p) => partes.push({ salto: true }, '• ', { negrita: p.id }, ` (${p.min} a ${p.max} personas): ${p.resumen}`));
    partes.push({ salto: true }, 'El precio se coordina por WhatsApp al confirmar.');
    bot(partes);
    chips([...PAQUETES.map((p) => ({ texto: 'Reservar ' + p.id, accion: () => iniciarReserva(p.id) })), { texto: 'Volver al menú', accion: menuPrincipal }]);
  }

  function responderContacto() {
    bot(['Puedes escribirnos por ', { enlace: `https://wa.me/${WHATSAPP}`, texto: 'WhatsApp (+51 919 293 435)' }, ' o visitarnos en Av. La Angostura 396, Residencial La Angostura, Ica.']);
    menuPrincipal();
  }

  // ---------- reserva paso a paso ----------
  let reserva = null;
  let esperando = null; // función que interpreta lo que el usuario escribe en este paso

  async function iniciarReserva(paquete) {
    esperando = null;
    if (!conDb) { responderContacto(); return; }
    const usuario = await Sesion.usuario();
    if (!usuario) {
      const volver = encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.hash);
      bot(['Para reservar necesito que inicies sesión, así la reserva queda en tu cuenta. ', { enlace: `login.html?volver=${volver}`, texto: 'Iniciar sesión o crear cuenta' }, '. También puedes reservar por ', { enlace: `https://wa.me/${WHATSAPP}`, texto: 'WhatsApp' }, '.']);
      menuPrincipal();
      return;
    }
    reserva = { paquete: typeof paquete === 'string' ? paquete : null };
    if (reserva.paquete) bot(`Genial, te anoto el paquete ${reserva.paquete}.`);
    pedirDia();
  }

  function pedirDia() {
    bot('¿Qué día quieres venir? Elige uno o escríbelo (por ejemplo "sábado" o "28/11").');
    chips([
      ...proximosDias(6).map((f, i) => ({ texto: i === 0 && aISO(f) === aISO(hoy()) ? 'Hoy' : `${DIAS[f.getDay()].slice(0, 3)} ${f.getDate()}`, accion: () => elegirDia(f) })),
      { texto: 'Cancelar', accion: cancelarReserva }
    ]);
    esperando = (texto) => {
      const f = leerFecha(texto);
      if (!f) return false;
      elegirDia(f);
      return true;
    };
  }

  function elegirDia(f) {
    const limite = hoy();
    limite.setDate(limite.getDate() + 60);
    if (f < hoy() || f > limite) { bot('Solo puedo reservar desde hoy y hasta 60 días adelante. Elige otra fecha.'); return pedirDia(); }
    const horas = horasDelDia(f);
    if (!horas.length) { bot('Para ese día ya no quedan horarios. Elige otra fecha.'); return pedirDia(); }
    reserva.fecha = aISO(f);
    reserva.fechaTexto = fechaLarga(f);
    bot(`Perfecto, el ${reserva.fechaTexto}. ¿A qué hora? Ese día atendemos desde las ${hora12(HORARIO.apertura(f.getDay()))}`);
    const sugeridas = horas.filter((h) => h.endsWith(':00')).slice(-6);
    chips([...sugeridas.map((h) => ({ texto: hora12(h), accion: () => elegirHora(h) })), { texto: 'Cancelar', accion: cancelarReserva }]);
    esperando = (texto) => {
      const h = leerHora(texto);
      if (!h) return false;
      elegirHora(h);
      return true;
    };
  }

  function elegirHora(h) {
    const f = new Date(reserva.fecha + 'T12:00');
    const [hh, mm] = h.split(':').map(Number);
    if (mm % 30 !== 0 || !horasDelDia(f).includes(h)) {
      bot(`A esa hora no puedo reservar. Ese día atendemos de ${hora12(HORARIO.apertura(f.getDay()))} a 9:30 p. m. (última reserva), cada media hora.`);
      return elegirDia(f);
    }
    reserva.hora = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    bot('¿Para cuántas personas?');
    chips([...[2, 4, 6, 8, 15, 20].map((n) => ({ texto: `${n} personas`, accion: () => elegirPersonas(n) })), { texto: 'Cancelar', accion: cancelarReserva }]);
    esperando = (texto) => {
      const m = normalizar(texto).match(/\d{1,2}/);
      if (!m) return false;
      elegirPersonas(Number(m[0]));
      return true;
    };
  }

  function elegirPersonas(n) {
    if (n < 1 || n > 40) { bot('Puedo reservar de 1 a 40 personas. ¿Cuántas serán?'); return; }
    reserva.personas = n;
    esperando = null;
    // si ya venía con paquete, se revisa que el número le quede
    const elegido = PAQUETES.find((p) => p.id === reserva.paquete);
    if (elegido && n >= elegido.min && n <= elegido.max) return resumen();
    const posibles = PAQUETES.filter((p) => n >= p.min && n <= p.max);
    if (n > 10 && !posibles.length) { bot('Para tantas personas escríbenos por WhatsApp y lo coordinamos.'); return responderContacto(); }
    bot(n > 10 ? 'Para más de 10 personas necesitas uno de estos paquetes:' : '¿Quieres agregar un paquete? Es opcional.');
    chips([
      ...(n <= 10 ? [{ texto: 'Sin paquete', accion: () => { reserva.paquete = null; resumen(); } }] : []),
      ...posibles.map((p) => ({ texto: p.id, accion: () => { reserva.paquete = p.id; resumen(); } })),
      { texto: 'Cancelar', accion: cancelarReserva }
    ]);
  }

  function resumen() {
    bot(['Revisa tu reserva:', { salto: true },
      '📅 ', { negrita: reserva.fechaTexto }, ` a las ${hora12(reserva.hora)}`, { salto: true },
      `👥 ${reserva.personas} ${reserva.personas === 1 ? 'persona' : 'personas'}`,
      ...(reserva.paquete ? [{ salto: true }, '🎁 Paquete ', { negrita: reserva.paquete }] : [])]);
    chips([
      { texto: 'Confirmar reserva', accion: guardarReserva },
      { texto: 'Cambiar el día', accion: pedirDia },
      { texto: 'Cancelar', accion: cancelarReserva }
    ]);
  }

  async function guardarReserva() {
    const espera = bot('Guardando tu reserva…');
    const exclusivo = reserva.paquete === 'Segundo piso exclusivo';
    const { data: guardada, error } = await db.from('reservas').insert({
      fecha: reserva.fecha,
      hora: reserva.hora,
      personas: reserva.personas,
      tipo: reserva.paquete === 'Cumpleañero' ? 'Cumpleaños' : 'Cena',
      ubicacion: exclusivo ? 'Segundo piso' : 'Primer piso',
      paquete: reserva.paquete,
      mensaje: 'Reserva hecha con el asistente Asadito'
    }).select('mesa, mesas_extra').single(); // el asistente de mesas le aparta una
    espera.remove();
    if (error) {
      // los mensajes de la base de datos ya vienen en español
      bot(`No se pudo guardar: ${error.message}`);
      chips([{ texto: 'Intentar con otro día', accion: pedirDia }, { texto: 'Hablar con una persona', accion: responderContacto }]);
      return;
    }
    const mesas = guardada && guardada.mesa ? [guardada.mesa, ...(guardada.mesas_extra || [])] : [];
    bot(['¡Listo! Tu reserva quedó ', { negrita: 'pendiente de confirmación' },
      ...(mesas.length ? [mesas.length > 1 ? '. Te apartamos las mesas ' : '. Te apartamos la mesa ', { negrita: mesas.join(' + ') }] : []),
      '. Te avisaremos en ', { enlace: 'cuenta.html#mis-reservas', texto: 'Mi cuenta' }, ' cuando la confirmemos.']);
    reserva = null;
    menuPrincipal();
  }

  function cancelarReserva() {
    reserva = null;
    esperando = null;
    bot('Listo, no reservé nada. ¿Te ayudo con algo más?');
    menuPrincipal();
  }

  // ---------- lo que el usuario escribe ----------
  function entender(texto) {
    const t = normalizar(texto);
    if (/^(cancelar|salir|olvidalo)\b/.test(t) && reserva) return cancelarReserva();
    if (esperando && esperando(texto)) return;
    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(t) && t.length < 25) { bot('¡Hola! ¿En qué te ayudo?'); return menuPrincipal(); }
    if (/reserv|separar|apartar|mesa para/.test(t)) {
      return iniciarReserva(paqueteEnTexto(t));
    }
    if (/paquete|cumple|empresa|segundo piso|evento|parrilla en vivo/.test(t)) return responderPaquetes();
    const plato = buscarPlato(texto);
    if (plato && /como|cocc|prepar|termino|precio|cuesta|vale|que es|lleva/.test(t)) return responderPlato(plato);
    if (/recomien|popular|mas pedid|mas vendid|que pido|que me|sugier|favorit|bueno|rico|vino|postre|entrada/.test(t)) return responderRecomendados(texto);
    if (/disponib|libre|que dias|cuando|fecha|dia/.test(t)) return responderDias();
    if (/horario|hora|abren|abierto|cierran|atienden/.test(t)) return responderHorario();
    if (/donde|direccion|ubica|llegar|whatsapp|telefono|celular|contacto|persona|humano/.test(t)) return responderContacto();
    if (plato) return responderPlato(plato);
    if (/gracias/.test(t)) { bot('¡Con gusto! Te esperamos en Punto Asado.'); return menuPrincipal(); }
    bot('No te entendí bien 😅 Puedes preguntarme por horarios, días disponibles, platos recomendados, cómo se prepara un plato o hacer tu reserva.');
    menuPrincipal();
  }

  formChat.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    burbuja('yo', texto);
    entrada.value = '';
    opciones.innerHTML = '';
    entender(texto);
  });
});
