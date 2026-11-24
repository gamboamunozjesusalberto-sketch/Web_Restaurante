/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE CONTACTO (CONTACTO.JS)
 * Funcionalidades exclusivas de contacto.html:
 * - Resalta el día actual y muestra si estamos abiertos
 * - Formulario de reserva: se guarda en Supabase con la cuenta del cliente
 * - Paquetes (cumpleañero, parrilla en vivo, empresarial, segundo piso) y pedido anticipado
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

  // Estado en vivo: "Abierto · cerramos en 1 h 20 min" (se actualiza cada 30 segundos)
  const duracion = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
  const aperturaDe = (d) => ((d === 0 || d === 6) ? 12 : 18) * 60;
  const horaTexto = (min) => (min === 12 * 60 ? '12:00 m.' : `${((Math.floor(min / 60) + 11) % 12) + 1}:00 p. m.`);
  function actualizarEstado() {
    const t = new Date();
    const d = t.getDay();
    const minutos = t.getHours() * 60 + t.getMinutes();
    const apertura = aperturaDe(d);
    const cierre = 23 * 60;
    const abierto = minutos >= apertura && minutos < cierre;
    let texto;
    if (abierto) texto = `Abierto ahora · cerramos en ${duracion(cierre - minutos)}`;
    else if (minutos < apertura) texto = `Cerrado · abrimos hoy a las ${horaTexto(apertura)} (en ${duracion(apertura - minutos)})`;
    else texto = `Cerrado · abrimos mañana a las ${horaTexto(aperturaDe((d + 1) % 7))}`;
    estado.textContent = texto;
    estado.classList.toggle('abierto', abierto);
    estado.classList.toggle('cerrado', !abierto);
  }
  if (estado) {
    actualizarEstado();
    estado.hidden = false;
    setInterval(actualizarEstado, 30000);
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
  let planoMesas = null; // mapa de mesas: se crea más abajo

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
    refrescarMesas();
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
    refrescarMesas();
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
      input.dispatchEvent(new Event('input', { bubbles: true })); // avisa al mapa de mesas
    });
  });

  // ---------- paquetes (datos en js/carta-datos.js) ----------
  const personasInput = form.elements.personas;
  const personasAyuda = document.getElementById('r-personas-ayuda');
  const contenedorPaquetes = document.getElementById('paquetes-reserva');
  let paqueteElegido = null;

  function pintarPaquetes() {
    const opciones = [{ id: '', icono: 'bi-dash-circle', resumen: 'Reserva normal, de 1 a 10 personas.', min: 1, max: 10 }, ...PAQUETES];
    opciones.forEach((paq) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'paquete' + (paq.id === '' ? ' activo' : '');
      boton.dataset.paquete = paq.id;
      boton.setAttribute('role', 'radio');
      boton.setAttribute('aria-checked', String(paq.id === ''));
      const icono = document.createElement('i');
      icono.className = 'bi ' + paq.icono;
      icono.setAttribute('aria-hidden', 'true');
      const titulo = document.createElement('strong');
      titulo.textContent = paq.id || 'Sin paquete';
      const texto = document.createElement('span');
      texto.textContent = paq.resumen;
      const rango = document.createElement('small');
      rango.textContent = `${paq.min} a ${paq.max} personas`;
      boton.append(icono, titulo, texto, rango);
      contenedorPaquetes.append(boton);
    });
  }

  function elegirPaquete(id) {
    paqueteElegido = PAQUETES.find((p) => p.id === id) || null;
    contenedorPaquetes.querySelectorAll('.paquete').forEach((b) => {
      const activo = b.dataset.paquete === (id || '');
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-checked', String(activo));
    });
    const min = paqueteElegido ? paqueteElegido.min : 1;
    const max = paqueteElegido ? paqueteElegido.max : 10;
    personasInput.min = min;
    personasInput.max = max;
    personasInput.value = Math.min(max, Math.max(min, Number(personasInput.value) || min));
    personasAyuda.textContent = paqueteElegido
      ? `Con el paquete ${paqueteElegido.id}: de ${min} a ${max} personas.`
      : 'De 1 a 10 personas. Para grupos más grandes, elige un paquete.';
    // el paquete decide algunos campos
    const ubicacion = form.elements.ubicacion;
    const exclusivo = id === 'Segundo piso exclusivo';
    if (exclusivo) ubicacion.value = 'Segundo piso';
    ubicacion.disabled = exclusivo;
    if (id === 'Cumpleañero') form.querySelector('[name="tipo"][value="Cumpleaños"]').checked = true;
    refrescarMesas();
  }

  contenedorPaquetes.addEventListener('click', (e) => {
    const boton = e.target.closest('.paquete');
    if (boton) elegirPaquete(boton.dataset.paquete);
  });
  pintarPaquetes();

  // ---------- mapa de mesas (plano en js/mesas.js) ----------
  // Muestra qué mesas están libres a la hora elegida. Los datos vienen de la
  // función mesas_ocupadas de Supabase: solo mesa y horario, nunca nombres.
  const mesaInput = form.elements.mesa;
  const mesaAyuda = document.getElementById('r-mesa-ayuda');
  const botonRecomendada = document.getElementById('r-mesa-recomendada');
  const ocupacion = {}; // fecha → [{ mesa, desde, hasta, motivo }]
  let mesaSoltada = null; // mesa que dejó de servir al cambiar hora o personas

  if (typeof PlanoMesas !== 'undefined' && document.getElementById('mapa-mesas')) {
    planoMesas = PlanoMesas.crear(document.getElementById('mapa-mesas'), {
      alElegir(codigo, soltada) {
        mesaInput.value = codigo || '';
        if (botonRecomendada) botonRecomendada.hidden = !planoMesas || !planoMesas.recomendada || planoMesas.recomendada === codigo;
        if (codigo) {
          const mesa = PlanoMesas.mesa(codigo);
          form.elements.ubicacion.value = mesa.piso;
          mesaAyuda.textContent = `Elegiste la mesa ${codigo} (${mesa.piso.toLowerCase()}, ${mesa.zona}). Se guarda con tu reserva.`;
        }
        if (soltada) mesaSoltada = soltada;
      }
    });
    // al cambiar de piso en el desplegable, el mapa también cambia
    form.elements.ubicacion.addEventListener('change', () => {
      planoMesas.piso(form.elements.ubicacion.value);
      if (mesaInput.value && PlanoMesas.mesa(mesaInput.value).piso !== form.elements.ubicacion.value) soltarMesa();
      refrescarMesas();
    });
    document.getElementById('r-mesa-cualquiera').addEventListener('click', () => {
      soltarMesa();
      mesaAyuda.textContent = 'Listo: al guardar, nuestro asistente te asigna la mejor mesa libre según tu grupo, el piso y tus preferencias.';
    });
    botonRecomendada.addEventListener('click', () => planoMesas.elegirRecomendada());
    personasInput.addEventListener('input', () => refrescarMesas());
    // el tipo de reserva y las preferencias cambian la mesa que recomienda el asistente
    form.querySelectorAll('[name="tipo"], [name="preferencia"]').forEach((el) => el.addEventListener('change', () => refrescarMesas()));
  } else {
    document.getElementById('r-mesa-cualquiera')?.remove();
    botonRecomendada?.remove();
  }

  function soltarMesa() {
    mesaInput.value = '';
    if (planoMesas) planoMesas.actualizar({ elegida: null });
  }

  async function ocupacionDe(fecha) {
    if (!db) return []; // modo WhatsApp: no hay datos, se muestran todas libres
    if (!ocupacion[fecha]) {
      const { data, error } = await db.rpc('mesas_ocupadas', { p_fecha: fecha });
      ocupacion[fecha] = error || !data ? [] : data.map((r) => ({
        mesa: r.mesa, desde: String(r.desde).slice(0, 5), hasta: String(r.hasta).slice(0, 5), motivo: r.motivo
      }));
    }
    return ocupacion[fecha];
  }

  async function refrescarMesas(recargar = false) {
    if (!planoMesas) return;
    const fecha = fechaInput.value;
    if (recargar) Object.keys(ocupacion).forEach((f) => delete ocupacion[f]);
    const personas = Number(personasInput.value) || 1;
    let bloqueo = null;
    if (paqueteElegido && paqueteElegido.id === 'Segundo piso exclusivo') {
      bloqueo = 'Con el Segundo piso exclusivo tienes todo el segundo piso para tu grupo: no hace falta elegir mesa.';
    } else if (personas > 10) {
      bloqueo = `Para ${personas} personas juntamos varias mesas: el restaurante prepara el espacio y te lo confirma.`;
    }
    const reservas = fecha ? await ocupacionDe(fecha) : [];
    if (fecha !== fechaInput.value) return; // cambió de día mientras cargaba
    const hora = horaInput.value || null;
    const perfilMesa = {
      ubicacion: form.elements.ubicacion.value,
      preferencias: [...form.querySelectorAll('[name="preferencia"]:checked')].map((c) => c.value).join(', '),
      tipo: (form.querySelector('[name="tipo"]:checked') || {}).value,
      paquete: paqueteElegido ? paqueteElegido.id : null
    };
    planoMesas.actualizar({ reservas, hora, personas, bloqueo, perfil: perfilMesa, apertura: fecha ? horariosDelDia(fecha)[0] : '12:00' });
    const rec = planoMesas.recomendada;
    botonRecomendada.hidden = !rec || mesaInput.value === rec;
    if (rec) {
      const m = PlanoMesas.mesa(rec);
      botonRecomendada.querySelector('span').textContent = `Elegir la recomendada: ${rec} (${m.piso.toLowerCase()}, ${m.zona})`;
    }

    if (!fecha) mesaAyuda.textContent = 'Elige día, hora y personas, y toca la mesa que más te guste. Cada reserva tiene su mesa por 2 horas.';
    else if (!hora) mesaAyuda.textContent = 'Ahora elige la hora para ver qué mesas están libres. Abajo ves de qué hora a qué hora está tomada cada una.';
    else if (bloqueo) mesaAyuda.textContent = '';
    else if (!mesaInput.value) {
      const libres = planoMesas.libresPara(hora, personas).length;
      const antes = mesaSoltada ? `La mesa ${mesaSoltada} ya no sirve con esos datos. ` : '';
      mesaSoltada = null;
      mesaAyuda.textContent = antes + (libres
        ? `A las ${hora12(hora)} hay ${libres} mesa${libres === 1 ? '' : 's'} libre${libres === 1 ? '' : 's'} para ${personas} persona${personas === 1 ? '' : 's'}. Toca la que prefieras (opcional).`
        : `A las ${hora12(hora)} no quedan mesas libres para ${personas} personas. Prueba otra hora o deja que el restaurante te ubique.`);
    }
  }

  // permite llegar con un paquete ya elegido: contacto.html?paquete=Cumpleañero#reserva
  const paqueteUrl = new URLSearchParams(location.search).get('paquete');
  if (paqueteUrl && PAQUETES.some((p) => p.id === paqueteUrl)) elegirPaquete(paqueteUrl);

  // ---------- "¿qué piensas pedir?" ----------
  const selectPlato = document.getElementById('r-plato');
  const listaPedido = document.getElementById('pedido-lista');
  const pedido = [];
  const MAX_PEDIDO = 15;
  const NOMBRES_CATEGORIA = { entradas: 'Para comenzar', parrilla: 'A la parrilla', platos: 'Nuestros platos', postres: 'Postres', vinos: 'Vinos', bebidas: 'Bebidas' };

  function llenarPlatos(lista) {
    selectPlato.innerHTML = '<option value="">Elige un plato de la carta…</option>';
    Object.entries(NOMBRES_CATEGORIA).forEach(([cat, nombre]) => {
      const grupo = document.createElement('optgroup');
      grupo.label = nombre;
      lista.filter((p) => p.categoria === cat).forEach((p) => {
        const op = document.createElement('option');
        op.value = op.textContent = p.nombre;
        grupo.append(op);
      });
      if (grupo.children.length) selectPlato.append(grupo);
    });
  }

  function pintarPedido() {
    listaPedido.innerHTML = '';
    pedido.forEach((nombre, i) => {
      const li = document.createElement('li');
      li.textContent = nombre;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.setAttribute('aria-label', 'Quitar ' + nombre);
      quitar.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
      quitar.addEventListener('click', () => { pedido.splice(i, 1); pintarPedido(); });
      li.append(quitar);
      listaPedido.append(li);
    });
  }

  document.getElementById('r-plato-agregar').addEventListener('click', () => {
    const nombre = selectPlato.value;
    if (!nombre) return selectPlato.focus();
    if (pedido.includes(nombre)) return;
    if (pedido.length >= MAX_PEDIDO) return mostrar(`Puedes anotar hasta ${MAX_PEDIDO} platos.`);
    pedido.push(nombre);
    selectPlato.value = '';
    pintarPedido();
  });

  // viene de la ficha de un plato en la Carta: contacto.html?plato=Bife%20Ancho#reserva
  const platoUrl = new URLSearchParams(location.search).get('plato');
  if (platoUrl && typeof CARTA !== 'undefined' && CARTA.some((p) => p.nombre === platoUrl)) {
    pedido.push(platoUrl);
    pintarPedido();
  }

  // la lista base es la carta; si el admin agregó platos en el Panel, también salen
  // (sin los platos que el admin quitó de la carta)
  llenarPlatos(CARTA);
  if (db) {
    Promise.all([cartaVisible(), db.from('platos').select('nombre, categoria').eq('visible', true)]).then(([, { data }]) => {
      const extra = (data || [])
        .map((p) => ({ nombre: p.nombre, categoria: String(p.categoria).toLowerCase() }))
        .filter((p) => !CARTA.some((c) => c.nombre.toLowerCase() === p.nombre.toLowerCase()));
      llenarPlatos([...CARTA, ...extra]);
    });
  }

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
      `• Ubicación: ${form.elements.ubicacion.value}`
    ];
    if (mesaInput.value) lineas.push(`• Mesa: ${mesaInput.value}`);
    if (paqueteElegido) lineas.push(`• Paquete: ${paqueteElegido.id}`);
    if (pedido.length) lineas.push(`• Pienso pedir: ${pedido.join(', ')}`);
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

    const { data: guardada, error } = await db.from('reservas').insert({
      fecha: d.get('fecha'),
      hora: d.get('hora'),
      personas: Number(d.get('personas')),
      tipo: d.get('tipo'),
      ubicacion: form.elements.ubicacion.value, // FormData omite el campo si está deshabilitado
      paquete: paqueteElegido ? paqueteElegido.id : null,
      mesa: mesaInput.value || null,
      pedido,
      preferencias: d.getAll('preferencia').join(', ') || null,
      mensaje: (d.get('mensaje') || '').trim() || null
    }).select('mesa, ubicacion').single(); // la mesa puede venir elegida por el asistente

    boton.disabled = false;
    if (error) {
      // los mensajes de validación de la base de datos ya vienen en español
      mostrar('No se pudo guardar: ' + error.message);
      if (/mesa|piso/i.test(error.message)) refrescarMesas(true); // alguien la tomó antes: se vuelve a mirar el mapa
      return;
    }
    form.elements.fecha.value = '';
    calendario.value = '';
    soltarMesa();
    Object.keys(ocupacion).forEach((f) => delete ocupacion[f]);
    pintarDias();
    pintarHorarios();
    form.elements.mensaje.value = '';
    pedido.length = 0;
    pintarPedido();
    elegirPaquete('');
    feedback.classList.add('ok');
    feedback.innerHTML = '¡Reserva enviada! Está <strong>pendiente</strong> de confirmación. Puedes verla en <a href="cuenta.html#mis-reservas">Mi cuenta</a>.';
    if (guardada && guardada.mesa) {
      const m = PlanoMesas.mesa(guardada.mesa);
      const nota = document.createElement('span');
      nota.className = 'd-block mt-1';
      nota.textContent = `Tu mesa: ${guardada.mesa}${m ? ` (${m.piso.toLowerCase()}, ${m.zona})` : ''}.`;
      feedback.append(nota);
    }
  });
});
