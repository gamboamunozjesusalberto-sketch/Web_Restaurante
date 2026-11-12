/**
 * ==========================================================================
 * PUNTO ASADO - PANEL DE ADMINISTRADOR (ADMIN.JS)
 * - Solo entra quien tiene rol "admin" en la tabla perfiles
 *   (y aunque alguien salte esta comprobación, RLS en la base de datos
 *    le impide ver o cambiar datos de otros)
 * - Reservas: filtrar por estado y día, confirmar o rechazar
 * - Carta: agregar platos, cambiar precio, ocultar/mostrar y eliminar
 * - Promociones: publicar (avisa a los clientes), activar/desactivar y eliminar
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!db) return;

  // ---------- Acceso: solo administradores ----------
  const usuario = await Sesion.exigir();
  if (!usuario) return;
  const perfil = await Sesion.perfil();
  if (!perfil || perfil.rol !== 'admin') {
    window.location.replace('cuenta.html');
    return;
  }

  // ---------- utilidades ----------
  const hoyISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };
  const fechaCorta = (iso) => iso.split('-').reverse().join('/');
  const hora12 = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  const avisar = (form, texto, ok) => {
    const p = form.querySelector('.form-feedback');
    p.textContent = texto;
    p.classList.toggle('ok', ok);
  };

  // ---------- Pestañas ----------
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const activa = t === tab;
        t.classList.toggle('active', activa);
        t.setAttribute('aria-selected', String(activa));
        document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
      });
    });
  });

  // ==========================================================
  // RESERVAS
  // ==========================================================
  const tablaReservas = document.getElementById('tabla-reservas');
  const filtroDia = document.getElementById('filtro-dia');
  let reservas = [];
  let filtroEstado = 'pendiente';

  async function cargarReservas() {
    // perfiles(...) trae el nombre y celular del cliente (relación usuario_id → perfiles)
    const { data, error } = await db.from('reservas')
      .select('*, perfiles(nombre, telefono, dni)')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
    if (error) {
      tablaReservas.innerHTML = '<tr><td colspan="6" class="vacio">No se pudieron cargar las reservas.</td></tr>';
      return;
    }
    reservas = data;
    pintarReservas();
    pintarResumen();
  }

  function pintarReservas() {
    const lista = reservas.filter((r) =>
      (filtroEstado === 'todas' || r.estado === filtroEstado) &&
      (!filtroDia.value || r.fecha === filtroDia.value) &&
      // las pendientes de días que ya pasaron no se muestran como pendientes
      !(filtroEstado === 'pendiente' && r.fecha < hoyISO)
    );

    tablaReservas.innerHTML = '';
    if (!lista.length) {
      tablaReservas.innerHTML = '<tr><td colspan="6" class="vacio">No hay reservas con este filtro.</td></tr>';
      return;
    }

    lista.forEach((r) => {
      const tr = document.createElement('tr');
      const celda = (etiqueta) => {
        const td = document.createElement('td');
        td.dataset.label = etiqueta; // lo usa el CSS en celular: content: attr(data-label)
        const contenido = document.createElement('div');
        td.append(contenido);
        tr.append(td);
        return contenido;
      };

      const tdFecha = celda('Fecha');
      tdFecha.append(crear('strong', '', fechaCorta(r.fecha)), crear('small', '', hora12(r.hora)));

      const tdCliente = celda('Cliente');
      const cliente = r.perfiles || {};
      tdCliente.append(crear('strong', '', cliente.nombre || '—'), crear('small', '', cliente.telefono || ''));

      celda('Personas').append(crear('strong', '', r.personas));

      const tdDetalle = celda('Detalle');
      tdDetalle.append(crear('span', '', `${r.tipo} · ${r.ubicacion}`));
      if (r.preferencias) tdDetalle.append(crear('small', '', r.preferencias));
      if (r.mensaje) tdDetalle.append(crear('small', '', '“' + r.mensaje + '”'));

      const estado = crear('span', 'estado', r.estado);
      estado.dataset.estado = r.estado;
      celda('Estado').append(estado);

      const tdAcciones = celda('Acciones');
      if (r.estado === 'pendiente') {
        const acciones = crear('div', 'acciones-reserva');
        const confirmar = crear('button', 'btn-accion btn-confirmar', 'Confirmar');
        const rechazar = crear('button', 'btn-accion btn-rechazar', 'Rechazar');
        confirmar.type = rechazar.type = 'button';
        confirmar.addEventListener('click', () => cambiarEstado(r, 'confirmada', [confirmar, rechazar]));
        rechazar.addEventListener('click', () => cambiarEstado(r, 'rechazada', [confirmar, rechazar]));
        acciones.append(confirmar, rechazar);
        tdAcciones.append(acciones);
      } else {
        tdAcciones.append(crear('small', '', '—'));
      }

      tablaReservas.append(tr);
    });
  }

  async function cambiarEstado(r, nuevo, botones) {
    if (nuevo === 'rechazada' && !confirm('¿Rechazar esta reserva? El cliente recibirá un aviso.')) return;
    botones.forEach((b) => { b.disabled = true; });
    const { error } = await db.from('reservas').update({ estado: nuevo }).eq('id', r.id);
    if (error) {
      botones.forEach((b) => { b.disabled = false; });
      alert('No se pudo actualizar: ' + error.message);
      return;
    }
    r.estado = nuevo;
    pintarReservas();
    pintarResumen();
  }

  document.querySelectorAll('#panel-reservas .filtro-btn').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.querySelectorAll('#panel-reservas .filtro-btn').forEach((b) => b.classList.remove('active'));
      boton.classList.add('active');
      filtroEstado = boton.dataset.estado;
      pintarReservas();
    });
  });
  filtroDia.addEventListener('change', pintarReservas);

  // ---------- Resumen ----------
  async function pintarResumen() {
    const pendientes = reservas.filter((r) => r.estado === 'pendiente' && r.fecha >= hoyISO).length;
    const deHoy = reservas.filter((r) => r.fecha === hoyISO && (r.estado === 'pendiente' || r.estado === 'confirmada'));
    document.getElementById('r-pendientes').textContent = pendientes;
    document.getElementById('r-hoy').textContent = deHoy.length;
    document.getElementById('r-personas').textContent = deHoy.reduce((total, r) => total + r.personas, 0);
    const badge = document.getElementById('tab-badge-reservas');
    badge.textContent = pendientes;
    badge.hidden = pendientes === 0;
  }

  async function contarClientes() {
    const { count } = await db.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'cliente');
    document.getElementById('r-clientes').textContent = count || 0;
  }

  // ==========================================================
  // CARTA
  // ==========================================================
  const listaPlatos = document.getElementById('lista-platos');
  const formPlato = document.getElementById('form-plato');
  const buscarPlato = document.getElementById('buscar-plato');
  const preview = document.getElementById('preview-foto');
  let platos = [];

  async function cargarPlatos() {
    const { data, error } = await db.from('platos').select('*').order('categoria').order('nombre');
    platos = error ? [] : data;
    pintarPlatos();
  }

  function pintarPlatos() {
    const texto = buscarPlato.value.trim().toLowerCase();
    const lista = platos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.categoria.includes(texto));
    listaPlatos.innerHTML = '';
    if (!lista.length) {
      listaPlatos.append(crear('li', 'vacio', platos.length ? 'Ningún plato coincide.' : 'Aún no hay platos. Agrega el primero con el formulario.'));
      return;
    }
    lista.forEach((p) => {
      const li = crear('li', 'plato-item' + (p.visible ? '' : ' oculto'));

      if (p.imagen) {
        const img = crear('img');
        img.src = p.imagen;
        img.alt = '';
        img.loading = 'lazy';
        li.append(img);
      } else {
        const sinFoto = crear('span', 'plato-sin-foto');
        sinFoto.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i>';
        li.append(sinFoto);
      }

      const info = crear('div');
      info.append(crear('h3', '', p.nombre), crear('p', '', p.categoria + (p.visible ? '' : ' · oculto')));

      const controles = crear('div', 'plato-controles');
      const precio = crear('input');
      precio.type = 'number';
      precio.min = '0';
      precio.step = '0.5';
      precio.value = p.precio ?? '';
      precio.placeholder = 'S/';
      precio.setAttribute('aria-label', 'Precio de ' + p.nombre);
      precio.addEventListener('change', async () => {
        const valor = precio.value === '' ? null : Number(precio.value);
        const { error } = await db.from('platos').update({ precio: valor }).eq('id', p.id);
        if (!error) {
          p.precio = valor;
          precio.classList.add('guardado');
          setTimeout(() => precio.classList.remove('guardado'), 800);
        }
      });

      const interruptor = crear('label', 'switch');
      interruptor.title = 'Mostrar en la carta';
      const check = crear('input');
      check.type = 'checkbox';
      check.checked = p.visible;
      check.setAttribute('aria-label', 'Mostrar ' + p.nombre + ' en la carta');
      check.addEventListener('change', async () => {
        const { error } = await db.from('platos').update({ visible: check.checked }).eq('id', p.id);
        if (error) { check.checked = !check.checked; return; }
        p.visible = check.checked;
        pintarPlatos();
      });
      interruptor.append(check, crear('span'));

      const eliminar = crear('button', 'btn-accion btn-eliminar');
      eliminar.type = 'button';
      eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
      eliminar.setAttribute('aria-label', 'Eliminar ' + p.nombre);
      eliminar.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${p.nombre}" de la carta?`)) return;
        const { error } = await db.from('platos').delete().eq('id', p.id);
        if (error) return alert('No se pudo eliminar: ' + error.message);
        platos = platos.filter((x) => x.id !== p.id);
        pintarPlatos();
      });

      controles.append(precio, interruptor, eliminar);
      li.append(info, controles);
      listaPlatos.append(li);
    });
  }

  buscarPlato.addEventListener('input', pintarPlatos);

  // vista previa de la foto elegida
  formPlato.elements.imagen.addEventListener('input', () => {
    const ruta = formPlato.elements.imagen.value.trim();
    preview.hidden = !ruta;
    if (ruta) preview.src = ruta;
  });
  preview.addEventListener('error', () => { preview.hidden = true; });

  formPlato.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formPlato.reportValidity()) return;
    const d = new FormData(formPlato);
    const nuevo = {
      nombre: d.get('nombre').trim(),
      categoria: d.get('categoria'),
      precio: d.get('precio') === '' ? null : Number(d.get('precio')),
      descripcion: d.get('descripcion').trim() || null,
      imagen: d.get('imagen').trim() || null
    };
    const { error } = await db.from('platos').insert(nuevo);
    if (error) return avisar(formPlato, 'No se pudo agregar: ' + error.message, false);
    formPlato.reset();
    preview.hidden = true;
    avisar(formPlato, `"${nuevo.nombre}" se agregó a la carta.`, true);
    cargarPlatos();
  });

  // ==========================================================
  // PROMOCIONES
  // ==========================================================
  const listaPromos = document.getElementById('lista-promos');
  const formPromo = document.getElementById('form-promo');
  formPromo.elements.hasta.min = hoyISO;

  async function cargarPromos() {
    const { data, error } = await db.from('promociones').select('*').order('creado_en', { ascending: false });
    const promos = error ? [] : data;
    listaPromos.innerHTML = '';
    if (!promos.length) {
      listaPromos.append(crear('li', 'vacio', 'Todavía no publicaste promociones.'));
      return;
    }
    promos.forEach((pr) => {
      const li = crear('li', 'promo-item' + (pr.activa ? '' : ' inactiva'));
      const texto = crear('div');
      const fecha = new Date(pr.creado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
      texto.append(
        crear('h3', '', pr.titulo),
        crear('p', '', pr.descripcion),
        crear('small', '', `Publicada el ${fecha}` + (pr.hasta ? ` · válida hasta el ${fechaCorta(pr.hasta)}` : ''))
      );

      const interruptor = crear('label', 'switch');
      interruptor.title = 'Activa';
      const check = crear('input');
      check.type = 'checkbox';
      check.checked = pr.activa;
      check.setAttribute('aria-label', 'Promoción activa');
      check.addEventListener('change', async () => {
        const { error } = await db.from('promociones').update({ activa: check.checked }).eq('id', pr.id);
        if (error) { check.checked = !check.checked; return; }
        li.classList.toggle('inactiva', !check.checked);
      });
      interruptor.append(check, crear('span'));

      const eliminar = crear('button', 'btn-accion btn-eliminar');
      eliminar.type = 'button';
      eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
      eliminar.setAttribute('aria-label', 'Eliminar promoción');
      eliminar.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta promoción? También se borra de las notificaciones de los clientes.')) return;
        const { error } = await db.from('promociones').delete().eq('id', pr.id);
        if (error) return alert('No se pudo eliminar: ' + error.message);
        cargarPromos();
      });

      li.append(texto, interruptor, eliminar);
      listaPromos.append(li);
    });
  }

  formPromo.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formPromo.reportValidity()) return;
    const d = new FormData(formPromo);
    const { error } = await db.from('promociones').insert({
      titulo: d.get('titulo').trim(),
      descripcion: d.get('descripcion').trim(),
      hasta: d.get('hasta') || null
    });
    if (error) return avisar(formPromo, 'No se pudo publicar: ' + error.message, false);
    formPromo.reset();
    avisar(formPromo, '¡Promoción publicada! Los clientes ya la ven en su campanita.', true);
    cargarPromos();
  });

  // ---------- Carga inicial ----------
  await Promise.all([cargarReservas(), contarClientes(), cargarPlatos(), cargarPromos()]);
});
