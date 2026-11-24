/**
 * ==========================================================================
 * PUNTO ASADO - DASHBOARD Y OPINIONES DEL PANEL (ADMIN-DASHBOARD.JS)
 * - Dashboard: días pico, horas pico, platos más pedidos, paquetes y
 *   fechas con más reservas. Se calcula con las reservas que el admin ve
 *   (RLS solo deja leerlas todas al rol admin).
 * - Opiniones: ocultar / mostrar o eliminar comentarios de clientes.
 * - Clientes: cuántos hay, registros por mes y lista (la tarjeta del resumen la abre).
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

  // ==========================================================
  // CLIENTES REGISTRADOS
  // Para saber cuántos clientes tiene la web y si crecen mes a mes.
  // ==========================================================
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const tbodyClientes = document.getElementById('lista-clientes');
  const buscarCliente = document.getElementById('buscar-cliente');
  let clientes = [];

  async function cargarClientes() {
    const [{ data: perfiles }, { data: res }] = await Promise.all([
      db.from('perfiles').select('id, nombre, telefono, acepta_promos, creado_en').eq('rol', 'cliente').order('creado_en', { ascending: false }),
      db.from('reservas').select('usuario_id, estado')
    ]);
    const porCliente = contar((res || []).filter((r) => r.estado !== 'cancelada' && r.estado !== 'rechazada'), (r) => r.usuario_id);
    clientes = (perfiles || []).map((p) => ({ ...p, reservas: porCliente.get(p.id) || 0 }));
    pintarClientes();
  }

  function pintarClientes() {
    const ahora = new Date();
    const claveMes = (f) => `${f.getFullYear()}-${f.getMonth()}`;
    const esteMes = claveMes(ahora);
    const anterior = claveMes(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1));
    const porMes = contar(clientes, (c) => claveMes(new Date(c.creado_en)));
    const nuevos = porMes.get(esteMes) || 0;
    const pasados = porMes.get(anterior) || 0;

    // KPIs
    const kpis = [
      ['bi-people-fill', clientes.length, 'Clientes en total'],
      ['bi-person-plus', nuevos, 'Nuevos este mes'],
      ['bi-calendar-check', clientes.filter((c) => c.reservas > 0).length, 'Ya reservaron'],
      ['bi-megaphone', clientes.filter((c) => c.acepta_promos).length, 'Reciben promociones']
    ];
    const ul = document.getElementById('cli-kpis');
    ul.innerHTML = '';
    kpis.forEach(([icono, valor, texto]) => {
      const li = crear('li', 'dash-kpi');
      const i = crear('i', 'bi ' + icono);
      i.setAttribute('aria-hidden', 'true');
      li.append(i, crear('strong', '', String(valor)), crear('span', '', texto));
      ul.append(li);
    });

    // registros de los últimos 6 meses
    const meses = [];
    for (let k = 5; k >= 0; k--) meses.push(new Date(ahora.getFullYear(), ahora.getMonth() - k, 1));
    barras(document.getElementById('cli-meses'), meses.map((f) => ({
      etiqueta: `${MESES[f.getMonth()]} ${f.getFullYear()}`,
      valor: porMes.get(claveMes(f)) || 0
    })), 'Todavía no hay clientes registrados.');

    let crecimiento = `Este mes se registraron ${nuevos} ${nuevos === 1 ? 'cliente' : 'clientes'}`;
    if (pasados) {
      const cambio = Math.round(((nuevos - pasados) / pasados) * 100);
      crecimiento += ` (${cambio >= 0 ? '+' : ''}${cambio}% frente al mes pasado).`;
    } else {
      crecimiento += nuevos ? ' (el mes pasado no hubo registros).' : '.';
    }
    document.getElementById('cli-crecimiento').textContent = crecimiento;

    pintarTablaClientes();
  }

  function pintarTablaClientes() {
    const q = buscarCliente.value.trim().toLowerCase();
    const lista = clientes.filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.telefono || '').includes(q));
    tbodyClientes.innerHTML = '';
    if (!lista.length) {
      const tr = crear('tr');
      const td = crear('td', 'vacio', clientes.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay clientes registrados.');
      td.colSpan = 5;
      tr.append(td);
      tbodyClientes.append(tr);
      return;
    }
    lista.forEach((c) => {
      const tr = crear('tr');
      const promo = crear('td');
      const i = crear('i', 'bi ' + (c.acepta_promos ? 'bi-check-circle-fill si' : 'bi-dash-circle no'));
      i.title = c.acepta_promos ? 'Acepta promociones' : 'No acepta promociones';
      promo.append(i);
      tr.append(
        crear('td', 'cli-nombre', c.nombre),
        crear('td', '', c.telefono || '—'),
        crear('td', '', new Date(c.creado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })),
        crear('td', 'cli-num', String(c.reservas)),
        promo
      );
      tbodyClientes.append(tr);
    });
  }

  buscarCliente.addEventListener('input', pintarTablaClientes);
  document.getElementById('tab-clientes').addEventListener('click', cargarClientes);

  // ---------- Personal: nombrar o quitar mozos (supabase/11-personal.sql) ----------
  const formPersonal = document.getElementById('form-personal');
  const listaPersonal = document.getElementById('personal-lista');
  async function cargarPersonal() {
    const { data, error } = await db.rpc('lista_personal');
    listaPersonal.innerHTML = '';
    if (error) { listaPersonal.append(crear('li', 'dash-nota', 'Ejecuta supabase/11-personal.sql para activar las cuentas de mozo.')); return; }
    data.forEach((p) => {
      const li = crear('li', 'personal-item');
      const info = crear('div', '');
      info.append(crear('strong', '', p.nombre), crear('small', '', p.correo));
      const rol = crear('span', 'estado', p.rol === 'admin' ? 'admin' : 'mozo');
      rol.dataset.estado = p.rol === 'admin' ? 'confirmada' : 'pendiente';
      li.append(info, rol);
      if (p.rol === 'mozo') {
        const quitar = crear('button', 'btn-accion btn-rechazar', 'Quitar');
        quitar.type = 'button';
        quitar.addEventListener('click', async () => {
          if (!confirm(`¿Quitar a ${p.nombre} del personal? Vuelve a ser cliente.`)) return;
          const { error: err } = await db.rpc('cambiar_rol', { p_correo: p.correo, p_rol: 'cliente' });
          if (err) alert(err.message);
          cargarPersonal();
        });
        li.append(quitar);
      }
      listaPersonal.append(li);
    });
  }
  formPersonal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = formPersonal.querySelector('.form-feedback');
    const correo = document.getElementById('personal-correo');
    const { data, error } = await db.rpc('cambiar_rol', { p_correo: correo.value.trim(), p_rol: 'mozo' });
    fb.textContent = error ? error.message : `Listo: ${data} ya es mozo.`;
    fb.classList.toggle('ok', !error);
    if (!error) { correo.value = ''; cargarPersonal(); }
  });
  document.getElementById('tab-clientes').addEventListener('click', cargarPersonal);

  // la tarjeta "Clientes registrados" del resumen abre esta pestaña
  const tarjetaClientes = document.getElementById('r-clientes-card');
  const abrirClientes = () => {
    document.getElementById('tab-clientes').click();
    document.querySelector('.admin-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  tarjetaClientes.addEventListener('click', abrirClientes);
  tarjetaClientes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirClientes(); }
  });
});
