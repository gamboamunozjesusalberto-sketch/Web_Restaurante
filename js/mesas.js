/**
 * ==========================================================================
 * PUNTO ASADO - MAPA DE MESAS (MESAS.JS)
 * Plano del local con sus 18 mesas, usado en:
 * - contacto.html: el cliente ve qué mesas están libres a la hora que eligió
 *   y escoge la suya (los datos vienen de la función mesas_ocupadas, sin
 *   nombres de otros clientes)
 * - admin.html (pestaña Mesas): el admin ve quién tiene cada mesa y la asigna
 * Cada reserva ocupa su mesa 2 horas. Las capacidades deben coincidir con la
 * tabla public.mesas de supabase/09-mesas.sql.
 * ==========================================================================
 */

'use strict';

// x / y: centro de la mesa en % del ancho y del alto del plano.
// etiquetas: las usa el asistente para recomendar (igual que mejor_mesa() en 10-asistente-mesas.sql)
const m_ = (codigo, piso, capacidad, x, y, zona, etiquetas = []) => ({ codigo, piso, capacidad, x, y, zona, etiquetas });
const MESAS_LOCAL = [
  // Primer piso: 15 mesas
  m_('M1', 'Primer piso', 2, 10, 25, 'junto al ventanal', ['ventana', 'tranquila']),
  m_('M2', 'Primer piso', 2, 10, 42, 'junto al ventanal', ['ventana']),
  m_('M3', 'Primer piso', 2, 10, 59, 'junto al ventanal', ['ventana']),
  m_('M11', 'Primer piso', 2, 10, 76, 'junto al ventanal', ['ventana', 'tranquila']),
  m_('M4', 'Primer piso', 4, 26, 28, 'centro del salón'),
  m_('M5', 'Primer piso', 4, 26, 51, 'centro del salón'),
  m_('M6', 'Primer piso', 4, 26, 76, 'cerca de la entrada', ['puerta']),
  m_('M7', 'Primer piso', 6, 44, 28, 'frente a la parrilla', ['parrilla']),
  m_('M8', 'Primer piso', 6, 44, 51, 'centro del salón'),
  m_('M13', 'Primer piso', 4, 40, 77, 'cerca de la entrada', ['puerta']),
  m_('M12', 'Primer piso', 4, 61, 28, 'frente a la parrilla', ['parrilla']),
  m_('M14', 'Primer piso', 6, 76, 28, 'frente a la parrilla', ['parrilla', 'grupo']),
  m_('M9', 'Primer piso', 8, 67, 51, 'junto a la barra', ['grupo']),
  m_('M10', 'Primer piso', 10, 58, 77, 'mesa larga familiar', ['grupo']),
  m_('M15', 'Primer piso', 8, 79, 72, 'cerca de la entrada', ['puerta', 'grupo']),
  // Segundo piso: 12 mesas
  m_('S1', 'Segundo piso', 2, 10, 24, 'balcón', ['ventana', 'tranquila']),
  m_('S2', 'Segundo piso', 4, 26, 24, 'balcón', ['ventana']),
  m_('S3', 'Segundo piso', 4, 43, 24, 'balcón', ['ventana']),
  m_('S4', 'Segundo piso', 4, 60, 24, 'balcón', ['ventana']),
  m_('S9', 'Segundo piso', 2, 76, 24, 'rincón tranquilo', ['tranquila']),
  m_('S5', 'Segundo piso', 6, 17, 51, 'salón privado', ['tranquila']),
  m_('S6', 'Segundo piso', 6, 39, 51, 'salón privado', ['tranquila']),
  m_('S7', 'Segundo piso', 8, 63, 51, 'junto a la cava de vinos', ['grupo']),
  m_('S10', 'Segundo piso', 2, 80, 51, 'rincón tranquilo', ['tranquila']),
  m_('S11', 'Segundo piso', 4, 13, 78, 'salón privado', ['tranquila']),
  m_('S8', 'Segundo piso', 10, 43, 78, 'mesa larga para grupos', ['grupo']),
  m_('S12', 'Segundo piso', 6, 72, 78, 'junto a la escalera', ['puerta']),
  // Área libre: 8 mesas
  m_('A1', 'Área libre', 2, 11, 30, 'jardín', ['tranquila']),
  m_('A2', 'Área libre', 2, 11, 62, 'jardín', ['tranquila']),
  m_('A3', 'Área libre', 4, 30, 22, 'terraza'),
  m_('A4', 'Área libre', 4, 30, 70, 'terraza'),
  m_('A5', 'Área libre', 4, 68, 40, 'terraza junto a la fogata', ['parrilla']),
  m_('A8', 'Área libre', 8, 80, 18, 'mesa larga del jardín', ['grupo', 'puerta']),
  m_('A6', 'Área libre', 6, 64, 78, 'bajo la pérgola', ['grupo']),
  m_('A7', 'Área libre', 6, 84, 78, 'bajo la pérgola', ['grupo'])
];

// Elementos fijos del local (solo de referencia): x, y, ancho y alto en %
const ELEMENTOS_LOCAL = {
  'Primer piso': [
    { texto: 'Parrilla', icono: 'bi-fire', x: 34, y: 3, w: 36, h: 11, clase: 'parrilla' },
    { texto: 'Ventanal', icono: 'bi-window', x: 0, y: 16, w: 3, h: 70, clase: 'ventana' },
    { texto: 'Barra', icono: 'bi-cup-straw', x: 88, y: 18, w: 10, h: 42, clase: 'barra' },
    { texto: 'Entrada', icono: 'bi-door-open', x: 28, y: 93, w: 18, h: 7, clase: 'entrada' },
    { texto: 'Escalera', icono: 'bi-ladder', x: 90, y: 80, w: 8, h: 17, clase: 'escalera' }
  ],
  'Segundo piso': [
    { texto: 'Balcón', icono: 'bi-brightness-alt-high', x: 3, y: 3, w: 80, h: 8, clase: 'balcon' },
    { texto: 'Baños', icono: 'bi-person-standing-dress', x: 88, y: 3, w: 10, h: 20, clase: 'escalera' },
    { texto: 'Cava', icono: 'bi-cup', x: 89, y: 32, w: 9, h: 38, clase: 'barra' },
    { texto: 'Escalera', icono: 'bi-ladder', x: 90, y: 80, w: 8, h: 17, clase: 'escalera' }
  ],
  'Área libre': [
    { texto: 'Jardín', icono: 'bi-tree', x: 0, y: 10, w: 3, h: 80, clase: 'jardin' },
    { texto: 'Fogata', icono: 'bi-fire', x: 43, y: 36, w: 14, h: 20, clase: 'fogata' },
    { texto: 'Pérgola', icono: 'bi-grid-3x3', x: 53, y: 62, w: 45, h: 34, clase: 'pergola' },
    { texto: 'Entrada', icono: 'bi-door-open', x: 22, y: 93, w: 18, h: 7, clase: 'entrada' }
  ]
};

const PlanoMesas = (() => {
  const minutos = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
  const hora12 = (hhmm) => {
    const total = minutos(hhmm) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  const masDos = (hhmm) => { const t = minutos(hhmm) + 120; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const rango = (r) => r.motivo === 'exclusivo' ? 'todo el día (Segundo piso exclusivo)' : `de ${hora12(r.desde)} a ${hora12(r.hasta)}`;
  // dos reservas chocan si empiezan a menos de 2 horas una de otra
  const choca = (r, hora) => r.motivo === 'exclusivo' || Math.abs(minutos(r.desde) - minutos(hora)) < 120;
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };
  const icono = (clase) => { const i = crear('i', 'bi ' + clase); i.setAttribute('aria-hidden', 'true'); return i; };
  const PISOS = ['Primer piso', 'Segundo piso', 'Área libre'];

  /**
   * opciones.admin: muestra nombres y no revisa capacidad
   * opciones.alElegir(codigo | null): se llama al tocar una mesa elegible
   */
  function crear_(contenedor, opciones = {}) {
    const admin = Boolean(opciones.admin);
    // perfil: lo que pidió el cliente (piso, preferencias, tipo, paquete) para recomendarle mesa
    let estado = { reservas: [], hora: null, personas: null, elegida: null, bloqueo: null, apertura: '12:00', perfil: {} };
    let pisoActual = 'Primer piso';

    contenedor.classList.add('pm');
    contenedor.classList.toggle('pm-admin', admin);
    contenedor.innerHTML = '';
    const cabecera = crear('div', 'pm-cabecera');
    const pisos = crear('div', 'pm-pisos');
    pisos.setAttribute('role', 'tablist');
    pisos.setAttribute('aria-label', 'Piso');
    const botonesPiso = PISOS.map((p) => {
      const b = crear('button', 'pm-piso');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.piso = p;
      b.append(crear('span', '', p), crear('small', 'pm-piso-libres'));
      b.addEventListener('click', () => mostrarPiso(p));
      pisos.append(b);
      return b;
    });
    const leyenda = crear('ul', 'pm-leyenda');
    (opciones.leyenda || (admin
      ? [['libre', 'Libre'], ['ocupada', 'Ocupada a esa hora'], ['pendiente', 'Por confirmar'], ['elegida', 'Seleccionada']]
      : [['libre', 'Libre'], ['ocupada', 'Reservada a esa hora'], ['chica', 'Muy chica'], ['elegida', 'Tu mesa'], ['recomendada', 'Recomendada']])
    ).forEach(([clase, texto]) => {
      const li = crear('li', '', texto);
      li.prepend(crear('span', 'pm-muestra pm-' + clase));
      leyenda.append(li);
    });
    cabecera.append(pisos, leyenda);

    const plano = crear('div', 'pm-plano');
    const aviso = crear('div', 'pm-bloqueo');
    aviso.hidden = true;
    const info = crear('div', 'pm-info');
    info.setAttribute('aria-live', 'polite');

    const linea = crear('div', 'pm-linea');
    const lineaTitulo = crear('h4', 'pm-linea-titulo');
    lineaTitulo.append(icono('bi-clock-history'), document.createTextNode(' Horario de cada mesa'));
    const lineaCuerpo = crear('div', 'pm-linea-cuerpo');
    linea.append(lineaTitulo, lineaCuerpo);

    contenedor.append(cabecera, plano, aviso, info, linea);

    const reservasDe = (codigo) => estado.reservas.filter((r) => r.mesa === codigo)
      .sort((a, b) => minutos(a.desde) - minutos(b.desde));

    // Asistente: puntúa las mesas libres igual que mejor_mesa() de la base de datos
    function puntaje(mesa) {
      const p = estado.perfil || {};
      const pref = String(p.preferencias || '').toLowerCase();
      const tiene = (e) => mesa.etiquetas.includes(e);
      let puntos = -(mesa.capacidad - estado.personas) * 10;
      if (mesa.piso === p.ubicacion) puntos += 30;
      if (pref.includes('ventana') && tiene('ventana')) puntos += 15;
      if (pref.includes('puerta') && tiene('puerta')) puntos += 15;
      if (p.paquete === 'Parrilla en vivo' && tiene('parrilla')) puntos += 20;
      if (p.tipo === 'Aniversario' && tiene('tranquila')) puntos += 10;
      if (estado.personas >= 7 && tiene('grupo')) puntos += 5;
      // encaja justo antes o después de otra reserva: el horario se aprovecha mejor
      puntos += 4 * reservasDe(mesa.codigo).filter((r) => {
        const dif = Math.abs(minutos(r.desde) - minutos(estado.hora));
        return r.motivo !== 'exclusivo' && dif >= 120 && dif <= 150;
      }).length;
      return puntos;
    }

    function recomendada() {
      if (admin || !estado.hora || !estado.personas || estado.bloqueo) return null;
      const libres = MESAS_LOCAL.filter((m) => m.capacidad >= estado.personas &&
        !reservasDe(m.codigo).some((r) => choca(r, estado.hora)));
      libres.sort((a, b) => puntaje(b) - puntaje(a) || a.capacidad - b.capacidad);
      return libres[0] ? libres[0].codigo : null;
    }
    let recomendadaActual = null;

    function situacion(mesa) {
      const delDia = reservasDe(mesa.codigo);
      const ahora = estado.hora ? delDia.filter((r) => choca(r, estado.hora)) : [];
      if (estado.elegida === mesa.codigo) return { clase: 'elegida', delDia, ahora };
      if (ahora.length && admin && ahora.some((r) => r.enMesa)) return { clase: 'enmesa', delDia, ahora };
      if (ahora.length) return { clase: admin && ahora.every((r) => r.estado === 'pendiente') ? 'pendiente' : 'ocupada', delDia, ahora };
      if (!admin && estado.personas && mesa.capacidad < estado.personas) return { clase: 'chica', delDia, ahora };
      return { clase: estado.hora ? 'libre' : 'sin-hora', delDia, ahora };
    }

    function mostrarPiso(p) {
      pisoActual = p;
      pintar();
    }

    function pintar() {
      botonesPiso.forEach((b) => {
        const activo = b.dataset.piso === pisoActual;
        b.classList.toggle('activo', activo);
        b.setAttribute('aria-selected', String(activo));
        const libres = MESAS_LOCAL.filter((m) => m.piso === b.dataset.piso && ['libre', 'elegida'].includes(situacion(m).clase)).length;
        b.querySelector('.pm-piso-libres').textContent = estado.hora ? `${libres} libre${libres === 1 ? '' : 's'}` : '';
      });

      recomendadaActual = recomendada();
      plano.innerHTML = '';
      plano.dataset.piso = pisoActual;
      (ELEMENTOS_LOCAL[pisoActual] || []).forEach((el) => {
        const div = crear('div', 'pm-elemento pm-el-' + el.clase);
        Object.assign(div.style, { left: el.x + '%', top: el.y + '%', width: el.w + '%', height: el.h + '%' });
        div.append(icono(el.icono), crear('span', '', el.texto));
        div.setAttribute('aria-hidden', 'true');
        plano.append(div);
      });

      MESAS_LOCAL.filter((m) => m.piso === pisoActual).forEach((mesa) => {
        const s = situacion(mesa);
        const b = crear('button', `pm-mesa pm-${s.clase} pm-cap-${mesa.capacidad}`);
        b.type = 'button';
        b.dataset.mesa = mesa.codigo;
        b.style.left = mesa.x + '%';
        b.style.top = mesa.y + '%';
        b.append(crear('span', 'pm-cod', mesa.codigo));
        const cap = crear('span', 'pm-cap');
        cap.append(icono('bi-person-fill'), document.createTextNode(' ' + mesa.capacidad));
        b.append(cap);
        if (admin && s.ahora.length && s.ahora[0].nombre) b.append(crear('span', 'pm-nombre', s.ahora[0].nombre.split(' ')[0]));
        if (s.delDia.length && !s.ahora.length) b.append(crear('span', 'pm-dia', String(s.delDia.length)));
        if (mesa.codigo === recomendadaActual) {
          b.classList.add('pm-recomendada');
          const estrella = crear('span', 'pm-rec');
          estrella.append(icono('bi-stars'));
          b.append(estrella);
        }
        const partes = [`Mesa ${mesa.codigo}, hasta ${mesa.capacidad} personas`];
        if (mesa.codigo === recomendadaActual) partes.push('recomendada por el asistente');
        if (s.ahora.length) partes.push('reservada ' + rango(s.ahora[0]));
        else if (s.clase === 'chica') partes.push('muy chica para tu grupo');
        else if (s.clase === 'libre' || s.clase === 'elegida') partes.push('libre a esa hora');
        if (s.delDia.length) partes.push('reservas del día: ' + s.delDia.map(rango).join(', '));
        b.title = partes.join(' · ');
        b.setAttribute('aria-label', partes.join('. '));
        b.setAttribute('aria-pressed', String(s.clase === 'elegida'));
        plano.append(b);
      });

      aviso.hidden = !estado.bloqueo;
      aviso.textContent = estado.bloqueo || '';
      plano.classList.toggle('pm-bloqueado', Boolean(estado.bloqueo));
      pintarLinea();
    }

    function pintarLinea() {
      lineaCuerpo.innerHTML = '';
      const inicio = minutos(estado.apertura || '12:00');
      const fin = 24 * 60 + 30; // 22:30 + 2 horas
      const total = fin - inicio;
      const pos = (min) => Math.max(0, Math.min(100, ((min - inicio) / total) * 100));

      const eje = crear('div', 'pm-eje');
      eje.append(crear('span', 'pm-eje-mesa', 'Mesa'));
      const marcas = crear('div', 'pm-eje-horas');
      for (let h = Math.ceil(inicio / 60); h * 60 <= fin - 45; h++) {
        const t = crear('span', '', String(h % 12 || 12) + (h % 24 < 12 ? 'am' : 'pm'));
        t.style.left = pos(h * 60) + '%';
        marcas.append(t);
      }
      eje.append(marcas);
      lineaCuerpo.append(eje);

      MESAS_LOCAL.filter((m) => m.piso === pisoActual).forEach((mesa) => {
        const s = situacion(mesa);
        const fila = crear('div', 'pm-fila pm-fila-' + s.clase);
        const nombre = crear('button', 'pm-fila-mesa');
        nombre.type = 'button';
        nombre.append(crear('strong', '', mesa.codigo), crear('small', '', mesa.capacidad + 'p'));
        nombre.addEventListener('click', () => tocar(mesa.codigo));
        const pista = crear('div', 'pm-pista');
        if (estado.hora) {
          const marca = crear('span', 'pm-ahora');
          marca.style.left = pos(minutos(estado.hora)) + '%';
          marca.style.width = (pos(minutos(estado.hora) + 120) - pos(minutos(estado.hora))) + '%';
          pista.append(marca);
        }
        s.delDia.forEach((r) => {
          const barra = crear('span', 'pm-barra' + (r.estado === 'pendiente' ? ' pm-barra-pendiente' : '') + (r.motivo === 'exclusivo' ? ' pm-barra-exclusivo' : ''));
          const desde = r.motivo === 'exclusivo' ? inicio : minutos(r.desde);
          const hasta = r.motivo === 'exclusivo' ? fin : minutos(r.desde) + 120;
          barra.style.left = pos(desde) + '%';
          barra.style.width = (pos(hasta) - pos(desde)) + '%';
          const texto = r.motivo === 'exclusivo' ? 'Piso exclusivo' : `${hora12(r.desde).replace(/ [ap]\. m\./, '')}–${hora12(r.hasta)}`;
          barra.textContent = admin && r.nombre ? `${r.nombre.split(' ')[0]} · ${texto}` : texto;
          barra.title = (r.nombre ? r.nombre + ' · ' : '') + rango(r) + (r.personas ? ` · ${r.personas} personas` : '');
          pista.append(barra);
        });
        fila.append(nombre, pista);
        lineaCuerpo.append(fila);
      });
      if (!estado.reservas.some((r) => MESAS_LOCAL.find((m) => m.codigo === r.mesa)?.piso === pisoActual)) {
        lineaCuerpo.append(crear('p', 'pm-linea-vacia', 'Ninguna mesa de este piso tiene reservas ese día.'));
      }
    }

    function explicar(codigo) {
      const mesa = MESAS_LOCAL.find((m) => m.codigo === codigo);
      if (!mesa) { info.innerHTML = ''; return; }
      const s = situacion(mesa);
      info.innerHTML = '';
      const titulo = crear('strong', '', `Mesa ${mesa.codigo} · ${mesa.piso}, ${mesa.zona} · hasta ${mesa.capacidad} personas`);
      info.append(titulo);
      let texto;
      if (s.clase === 'elegida') texto = `Es tu mesa: la tienes de ${hora12(estado.hora)} a ${hora12(masDos(estado.hora))} (tócala otra vez para quitarla).`;
      else if (s.ahora.length) texto = `Está reservada ${rango(s.ahora[0])}: elige otra mesa o cambia la hora.`;
      else if (s.clase === 'chica') texto = `Es para ${mesa.capacidad} personas y ustedes son ${estado.personas}. Elige una más grande.`;
      else if (!estado.hora) texto = 'Primero elige la hora para saber si está libre.';
      else texto = 'Libre a esa hora.';
      info.append(crear('p', '', texto));
      if (codigo === recomendadaActual && s.clase !== 'elegida') info.append(crear('small', 'pm-info-rec', '✨ Es la que te recomienda nuestro asistente para tu grupo.'));
      const otras = s.delDia.filter((r) => !s.ahora.includes(r));
      if (otras.length) info.append(crear('small', '', 'Otras reservas de esta mesa ese día: ' + otras.map(rango).join(', ')));
    }

    function tocar(codigo) {
      if (estado.bloqueo) return;
      const mesa = MESAS_LOCAL.find((m) => m.codigo === codigo);
      if (!mesa) return;
      if (mesa.piso !== pisoActual) pisoActual = mesa.piso;
      if (admin) {
        estado.elegida = estado.elegida === codigo ? null : codigo;
        pintar();
        if (opciones.alElegir) opciones.alElegir(estado.elegida);
        return;
      }
      const s = situacion(mesa);
      if (s.clase === 'elegida') {
        estado.elegida = null;
        if (opciones.alElegir) opciones.alElegir(null);
      } else if (s.clase === 'libre') {
        estado.elegida = codigo;
        if (opciones.alElegir) opciones.alElegir(codigo);
      }
      pintar();
      explicar(codigo);
    }

    plano.addEventListener('click', (e) => {
      const b = e.target.closest('.pm-mesa');
      if (b) tocar(b.dataset.mesa);
    });

    pintar();

    return {
      // reservas: [{ mesa, desde: 'HH:MM', hasta: 'HH:MM', motivo, nombre?, personas?, estado?, id? }]
      actualizar(cambios) {
        estado = { ...estado, ...cambios };
        // si la mesa elegida ya no sirve (otra hora, más personas), se suelta
        if (!admin && estado.elegida) {
          const mesa = MESAS_LOCAL.find((m) => m.codigo === estado.elegida);
          const ocupada = estado.hora && reservasDe(estado.elegida).some((r) => choca(r, estado.hora));
          const chica = estado.personas && mesa && mesa.capacidad < estado.personas;
          if (!mesa || !estado.hora || ocupada || chica || estado.bloqueo) {
            const antes = estado.elegida;
            estado.elegida = null;
            if (opciones.alElegir) opciones.alElegir(null, antes);
          }
        }
        if (estado.elegida) pisoActual = MESAS_LOCAL.find((m) => m.codigo === estado.elegida).piso;
        pintar();
        if (!admin) {
          if (estado.elegida) explicar(estado.elegida);
          else info.innerHTML = '';
        }
      },
      piso(p) { if (PISOS.includes(p)) mostrarPiso(p); },
      get recomendada() { return recomendadaActual; },
      elegirRecomendada() { if (recomendadaActual) tocar(recomendadaActual); },
      get elegida() { return estado.elegida; },
      libresPara(hora, personas) {
        return MESAS_LOCAL.filter((m) => m.capacidad >= personas && !reservasDe(m.codigo).some((r) => choca(r, hora)));
      }
    };
  }

  return { crear: crear_, hora12, minutos, masDos, choca, mesa: (c) => MESAS_LOCAL.find((m) => m.codigo === c) };
})();
