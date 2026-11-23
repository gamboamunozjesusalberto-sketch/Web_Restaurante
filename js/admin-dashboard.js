/**
 * ==========================================================================
 * PUNTO ASADO - DASHBOARD Y OPINIONES DEL PANEL (ADMIN-DASHBOARD.JS)
 * - Dashboard: días pico, horas pico, platos más pedidos, paquetes y
 *   fechas con más reservas. Se calcula con las reservas que el admin ve
 *   (RLS solo deja leerlas todas al rol admin).
 * - Opiniones: ocultar / mostrar o eliminar comentarios de clientes.
 * Los gráficos son barras hechas con HTML y CSS (sin librerías).
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!db || !document.getElementById('panel-dashboard')) return;
  const perfil = await Sesion.perfil();
  if (!perfil || perfil.rol !== 'admin') return;

  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // ==========================================================
  // DASHBOARD
  // ==========================================================
  let reservas = [];
  let periodo = '90';

  // Dibuja una lista de barras: [{ etiqueta, valor, detalle }]
  function barras(contenedor, datos, vacio) {
    contenedor.innerHTML = '';
    const max = Math.max(...datos.map((d) => d.valor), 0);
    if (!max) {
      contenedor.append(crear('p', 'dash-vacio', vacio || 'Todavía no hay datos en este periodo.'));
      return;
    }
    datos.forEach((d, i) => {
      const fila = crear('div', 'dash-fila' + (d.valor === max ? ' pico' : ''));
      const nombre = crear('span', 'dash-etiqueta', d.etiqueta);
      const pista = crear('span', 'dash-pista');
      const barra = crear('span', 'dash-barra');
      barra.style.setProperty('--ancho', `${(d.valor / max) * 100}%`);
      barra.style.setProperty('--delay', `${i * 0.04}s`);
      pista.append(barra);
      const valor = crear('span', 'dash-valor', d.detalle || String(d.valor));
      fila.append(nombre, pista, valor);
      contenedor.append(fila);
    });
  }

  function contar(lista, clave) {
    const c = new Map();
    lista.forEach((x) => {
      const k = clave(x);
      if (k !== null && k !== undefined && k !== '') c.set(k, (c.get(k) || 0) + 1);
    });
    return c;
  }

  function pintarDashboard() {
    let lista = reservas.filter((r) => r.estado === 'pendiente' || r.estado === 'confirmada');
    if (periodo !== 'todo') {
      const desde = new Date();
      desde.setDate(desde.getDate() - Number(periodo));
      lista = lista.filter((r) => r.fecha >= aISO(desde));
    }

    // KPIs
    const personas = lista.reduce((t, r) => t + r.personas, 0);
    const conPaquete = lista.filter((r) => r.paquete).length;
    const kpis = [
      ['bi-calendar-check', lista.length, 'Reservas'],
      ['bi-people', personas, 'Personas'],
      ['bi-person-lines-fill', lista.length ? (personas / lista.length).toFixed(1) : '0', 'Personas por mesa'],
      ['bi-gift', lista.length ? Math.round((conPaquete / lista.length) * 100) + '%' : '0%', 'Con paquete']
    ];
    const ulKpis = document.getElementById('dash-kpis');
    ulKpis.innerHTML = '';
    kpis.forEach(([icono, valor, texto]) => {
      const li = crear('li', 'dash-kpi');
      const i = crear('i', 'bi ' + icono);
      i.setAttribute('aria-hidden', 'true');
      li.append(i, crear('strong', '', String(valor)), crear('span', '', texto));
      ulKpis.append(li);
    });

    // Días pico (lunes primero)
    const porDia = contar(lista, (r) => new Date(r.fecha + 'T12:00').getDay());
    const personasDia = new Map();
    lista.forEach((r) => {
      const d = new Date(r.fecha + 'T12:00').getDay();
      personasDia.set(d, (personasDia.get(d) || 0) + r.personas);
    });
    barras(document.getElementById('dash-dias'), [1, 2, 3, 4, 5, 6, 0].map((d) => ({
      etiqueta: DIAS[d],
      valor: porDia.get(d) || 0,
      detalle: `${porDia.get(d) || 0} · ${personasDia.get(d) || 0} pers.`
    })));

    // Horas pico (por hora redonda)
    const porHora = contar(lista, (r) => Number(r.hora.slice(0, 2)));
    const horas = [...porHora.keys()].sort((a, b) => a - b);
    barras(document.getElementById('dash-horas'), horas.map((h) => ({
      etiqueta: `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`,
      valor: porHora.get(h)
    })));

    // Platos más pedidos (top 8)
    const platos = new Map();
    lista.forEach((r) => (r.pedido || []).forEach((p) => platos.set(p, (platos.get(p) || 0) + 1)));
    barras(document.getElementById('dash-platos'),
      [...platos].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => ({ etiqueta: p, valor: n, detalle: `${n} ${n === 1 ? 'vez' : 'veces'}` })),
      'Aún ningún cliente anotó platos en su reserva.');

    // Paquetes
    const paquetes = contar(lista, (r) => r.paquete);
    barras(document.getElementById('dash-paquetes'),
      ['Cumpleañero', 'Parrilla en vivo', 'Empresarial', 'Segundo piso exclusivo'].map((p) => ({ etiqueta: p, valor: paquetes.get(p) || 0 })),
      'Todavía nadie eligió un paquete en este periodo.');

    // Fechas con más reservas
    const porFecha = contar(lista, (r) => r.fecha);
    const olFechas = document.getElementById('dash-fechas');
    olFechas.innerHTML = '';
    [...porFecha].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).forEach(([f, n]) => {
      const fecha = new Date(f + 'T12:00');
      const li = crear('li');
      li.append(
        crear('span', '', `${DIAS[fecha.getDay()]} ${fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}`),
        crear('strong', '', `${n} ${n === 1 ? 'reserva' : 'reservas'}`)
      );
      olFechas.append(li);
    });
    if (!olFechas.children.length) olFechas.append(crear('li', 'dash-vacio', 'Sin reservas en este periodo.'));
  }

  async function cargarDashboard() {
    const { data, error } = await db.from('reservas').select('fecha, hora, personas, estado, paquete, pedido');
    reservas = error || !data ? [] : data;
    pintarDashboard();
  }

  document.querySelectorAll('#panel-dashboard .filtro-btn').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.querySelectorAll('#panel-dashboard .filtro-btn').forEach((b) => b.classList.toggle('active', b === boton));
      periodo = boton.dataset.periodo;
      pintarDashboard();
    });
  });

  // se actualiza cada vez que se abre la pestaña (por si se confirmaron reservas)
  document.getElementById('tab-dashboard').addEventListener('click', cargarDashboard);
  cargarDashboard();

  // ==========================================================
  // OPINIONES
  // ==========================================================
  const listaOpiniones = document.getElementById('lista-opiniones-admin');

  async function cargarOpiniones() {
    const { data, error } = await db.from('opiniones').select('*').order('creado_en', { ascending: false });
    const opiniones = error || !data ? [] : data;
    listaOpiniones.innerHTML = '';
    if (!opiniones.length) {
      listaOpiniones.append(crear('li', 'vacio', 'Todavía no hay opiniones de clientes.'));
      return;
    }
    opiniones.forEach((o) => {
      const li = crear('li', 'opinion-admin' + (o.visible ? '' : ' oculta'));
      if (o.foto) {
        const img = crear('img');
        img.src = o.foto;
        img.alt = 'Foto de ' + (o.autor || 'un cliente');
        img.loading = 'lazy';
        li.append(img);
      }
      const info = crear('div', 'opinion-admin-info');
      info.append(
        crear('strong', '', `${'★'.repeat(o.calificacion)}${'☆'.repeat(5 - o.calificacion)} · ${o.autor || 'Cliente'}${o.plato ? ' · ' + o.plato : ''}`),
        crear('p', '', o.comentario),
        crear('small', '', new Date(o.creado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) + (o.visible ? '' : ' · oculta'))
      );
      const controles = crear('div', 'opinion-admin-controles');
      const ver = crear('button', 'btn-accion btn-rechazar', o.visible ? 'Ocultar' : 'Mostrar');
      ver.type = 'button';
      ver.addEventListener('click', async () => {
        await db.from('opiniones').update({ visible: !o.visible }).eq('id', o.id);
        cargarOpiniones();
      });
      const borrar = crear('button', 'btn-accion btn-eliminar', 'Eliminar');
      borrar.type = 'button';
      borrar.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta opinión? No se puede deshacer.')) return;
        await db.from('opiniones').delete().eq('id', o.id);
        cargarOpiniones();
      });
      controles.append(ver, borrar);
      li.append(info, controles);
      listaOpiniones.append(li);
    });
  }

  document.getElementById('tab-opiniones').addEventListener('click', cargarOpiniones);
  cargarOpiniones();
});
