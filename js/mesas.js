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

// x / y: centro de la mesa en % del ancho y del alto del plano
const MESAS_LOCAL = [
  { codigo: 'M1', piso: 'Primer piso', capacidad: 2, x: 11, y: 30, zona: 'junto al ventanal' },
  { codigo: 'M2', piso: 'Primer piso', capacidad: 2, x: 11, y: 50, zona: 'junto al ventanal' },
  { codigo: 'M3', piso: 'Primer piso', capacidad: 2, x: 11, y: 70, zona: 'junto al ventanal' },
  { codigo: 'M4', piso: 'Primer piso', capacidad: 4, x: 30, y: 36, zona: 'centro del salón' },
  { codigo: 'M5', piso: 'Primer piso', capacidad: 4, x: 30, y: 60, zona: 'centro del salón' },
  { codigo: 'M6', piso: 'Primer piso', capacidad: 4, x: 30, y: 83, zona: 'cerca de la entrada' },
  { codigo: 'M7', piso: 'Primer piso', capacidad: 6, x: 51, y: 36, zona: 'frente a la parrilla' },
  { codigo: 'M8', piso: 'Primer piso', capacidad: 6, x: 51, y: 60, zona: 'centro del salón' },
  { codigo: 'M9', piso: 'Primer piso', capacidad: 8, x: 71, y: 36, zona: 'junto a la barra' },
  { codigo: 'M10', piso: 'Primer piso', capacidad: 10, x: 66, y: 79, zona: 'mesa larga familiar' },
  { codigo: 'S1', piso: 'Segundo piso', capacidad: 2, x: 12, y: 26, zona: 'balcón' },
  { codigo: 'S2', piso: 'Segundo piso', capacidad: 4, x: 31, y: 26, zona: 'balcón' },
  { codigo: 'S3', piso: 'Segundo piso', capacidad: 4, x: 50, y: 26, zona: 'balcón' },
  { codigo: 'S4', piso: 'Segundo piso', capacidad: 4, x: 69, y: 26, zona: 'balcón' },
  { codigo: 'S5', piso: 'Segundo piso', capacidad: 6, x: 26, y: 56, zona: 'salón privado' },
  { codigo: 'S6', piso: 'Segundo piso', capacidad: 6, x: 50, y: 56, zona: 'salón privado' },
  { codigo: 'S7', piso: 'Segundo piso', capacidad: 8, x: 72, y: 60, zona: 'junto a la cava de vinos' },
  { codigo: 'S8', piso: 'Segundo piso', capacidad: 10, x: 46, y: 84, zona: 'mesa larga para grupos' }
];

// Elementos fijos del local (solo de referencia): x, y, ancho y alto en %
const ELEMENTOS_LOCAL = {
  'Primer piso': [
    { texto: 'Parrilla', icono: 'bi-fire', x: 34, y: 3, w: 36, h: 12, clase: 'parrilla' },
    { texto: 'Ventanal', icono: 'bi-window', x: 0, y: 18, w: 3, h: 66, clase: 'ventana' },
    { texto: 'Barra', icono: 'bi-cup-straw', x: 85, y: 22, w: 13, h: 46, clase: 'barra' },
    { texto: 'Entrada', icono: 'bi-door-open', x: 42, y: 93, w: 18, h: 7, clase: 'entrada' },
    { texto: 'Escalera', icono: 'bi-ladder', x: 85, y: 76, w: 13, h: 20, clase: 'escalera' }
  ],
  'Segundo piso': [
    { texto: 'Balcón', icono: 'bi-brightness-alt-high', x: 3, y: 3, w: 78, h: 8, clase: 'balcon' },
    { texto: 'Cava de vinos', icono: 'bi-cup', x: 86, y: 34, w: 12, h: 38, clase: 'barra' },
    { texto: 'Baños', icono: 'bi-person-standing-dress', x: 86, y: 3, w: 12, h: 22, clase: 'escalera' },
    { texto: 'Escalera', icono: 'bi-ladder', x: 86, y: 78, w: 12, h: 20, clase: 'escalera' }
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
  const PISOS = ['Primer piso', 'Segundo piso'];

  /**
   * opciones.admin: muestra nombres y no revisa capacidad
   * opciones.alElegir(codigo | null): se llama al tocar una mesa elegible
   */
  function crear_(contenedor, opciones = {}) {
    const admin = Boolean(opciones.admin);
    let estado = { reservas: [], hora: null, personas: null, elegida: null, bloqueo: null, apertura: '12:00' };
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
    (admin
      ? [['libre', 'Libre'], ['ocupada', 'Ocupada a esa hora'], ['pendiente', 'Por confirmar'], ['elegida', 'Seleccionada']]
      : [['libre', 'Libre'], ['ocupada', 'Reservada a esa hora'], ['chica', 'Muy chica'], ['elegida', 'Tu mesa']]
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

    function situacion(mesa) {
      const delDia = reservasDe(mesa.codigo);
      const ahora = estado.hora ? delDia.filter((r) => choca(r, estado.hora)) : [];
      if (estado.elegida === mesa.codigo) return { clase: 'elegida', delDia, ahora };
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
        const partes = [`Mesa ${mesa.codigo}, hasta ${mesa.capacidad} personas`];
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
      get elegida() { return estado.elegida; },
      libresPara(hora, personas) {
        return MESAS_LOCAL.filter((m) => m.capacidad >= personas && !reservasDe(m.codigo).some((r) => choca(r, hora)));
      }
    };
  }

  return { crear: crear_, hora12, minutos, masDos, choca, mesa: (c) => MESAS_LOCAL.find((m) => m.codigo === c) };
})();
