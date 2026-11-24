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
    // las pendientes que ya pasaron sin confirmarse quedan vencidas (no se muestran como por confirmar)
    await db.rpc('vencer_reservas');
    // perfiles(...) trae el nombre y celular del cliente (relación usuario_id → perfiles)
    const { data, error } = await db.from('reservas')
      .select('*, perfiles!usuario_id(nombre, telefono, dni)')
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
      tdDetalle.append(crear('span', '', `${r.tipo} · ${r.ubicacion}${r.mesa ? ((r.mesas_extra || []).length ? ' · Mesas juntas ' : ' · Mesa ') + [r.mesa, ...(r.mesas_extra || [])].join(' + ') : ''}`));
      if (r.paquete) tdDetalle.append(crear('span', 'etiqueta-paquete', 'Paquete ' + r.paquete));
      if (r.descuento) tdDetalle.append(crear('span', 'etiqueta-paquete', `${r.descuento}% de descuento`));
      if (r.motivo) tdDetalle.append(crear('small', 'detalle-motivo', 'Motivo enviado: ' + r.motivo));
      if (r.oferta_mesa) tdDetalle.append(crear('small', '', `Se le ofreció la mesa ${r.oferta_mesa} el ${fechaCorta(r.oferta_fecha)} a las ${hora12(r.oferta_hora)}${r.oferta_aceptada ? ' (la aceptó)' : ''}`));
      if (r.pedido && r.pedido.length) tdDetalle.append(crear('small', '', 'Piensa pedir: ' + r.pedido.join(', ')));
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
        confirmar.addEventListener('click', () => confirmarReserva(r, [confirmar, rechazar]));
        rechazar.addEventListener('click', () => abrirAviso(r));
        acciones.append(confirmar, rechazar);
        tdAcciones.append(acciones);
      } else if (r.estado === 'confirmada' && r.fecha >= hoyISO) {
        const cancelar = crear('button', 'btn-accion btn-rechazar', 'Cancelar');
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => abrirAviso(r));
        tdAcciones.append(cancelar);
      } else {
        tdAcciones.append(crear('small', '', '—'));
      }

      tablaReservas.append(tr);
    });
  }

  // Confirmar: la base de datos (12 y 13-juntar-mesas.sql) revisa que haya mesa.
  // Si no tiene, el asistente le da la mejor libre (o junta mesas para un grupo
  // grande); si no hay lugar, no deja confirmar.
  async function confirmarReserva(r, botones) {
    if (r.paquete === 'Segundo piso exclusivo') {
      const afectadas = reservas.filter((x) => x.id !== r.id && x.fecha === r.fecha && x.ubicacion === 'Segundo piso' &&
        ['pendiente', 'confirmada'].includes(x.estado)).length;
      if (afectadas && !confirm(`Al confirmar el evento se cerrará el segundo piso: ${afectadas} reserva${afectadas === 1 ? '' : 's'} de ese día se cancelará${afectadas === 1 ? '' : 'n'} y cada cliente recibirá una disculpa con otra mesa y 15% de descuento. ¿Confirmar?`)) return;
    }
    botones.forEach((b) => { b.disabled = true; });
    const mesaAntes = r.mesa;
    const { data, error } = await db.from('reservas').update({ estado: 'confirmada' }).eq('id', r.id).select('mesa, mesas_extra').single();
    botones.forEach((b) => { b.disabled = false; });
    if (error) {
      if (/mesa libre/i.test(error.message)) {
        if (confirm(error.message + '\n\n¿Quieres rechazarla ahora y ofrecerle otro horario? El asistente te sugerirá mesas libres.')) abrirAviso(r, 'No tenemos mesas libres a esa hora.');
      } else {
        alert('No se pudo confirmar: ' + error.message);
      }
      return;
    }
    const mesa = data && data.mesa;
    const juntas = data && (data.mesas_extra || []).length ? [data.mesa, ...data.mesas_extra].join(' + ') : null;
    if (juntas) aviso(`Confirmada. ✨ Para ${r.personas} personas el asistente juntó las mesas ${juntas}.`);
    else aviso(mesa && mesa !== mesaAntes
      ? `Confirmada. ✨ El asistente le asignó la mesa ${mesa}.`
      : `Confirmada${mesa ? ' en la mesa ' + mesa : ''}.`);
    await cargarReservas();
  }

  // aviso flotante del panel
  const toast = crear('div', 'admin-toast');
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  document.body.append(toast);
  let toastTimer;
  function aviso(texto) {
    toast.textContent = texto;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
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

  // ---------- Rechazar o cancelar con aviso al cliente ----------
  // El admin explica el motivo y, si quiere, ofrece otra mesa (el asistente
  // sugiere las mejores libres) con un descuento. El cliente la acepta en Mi cuenta.
  const MOTIVOS = ['No tenemos mesas libres a esa hora', 'Ese día hay un evento privado', 'Mantenimiento del local', 'Problema con la parrilla'];
  const dialogo = crear('dialog', 'aviso-dialogo');
  document.body.append(dialogo);

  async function abrirAviso(r, motivoInicial = '') {
    const rechazo = r.estado === 'pendiente';
    const cliente = r.perfiles || {};
    dialogo.innerHTML = '';
    const formAviso = crear('form', 'aviso-form');
    formAviso.method = 'dialog';
    formAviso.append(crear('h3', '', rechazo ? 'Rechazar reserva' : 'Cancelar reserva'));
    formAviso.append(crear('p', 'aviso-sub', `${cliente.nombre || 'Cliente'} · ${fechaCorta(r.fecha)} a las ${hora12(r.hora)} · ${r.personas} personas${r.mesa ? ' · mesa ' + r.mesa : ''}`));

    const lblMotivo = crear('label', 'aviso-label', 'Motivo para el cliente');
    const motivo = crear('textarea', '');
    motivo.rows = 2;
    motivo.maxLength = 300;
    motivo.required = true;
    motivo.id = 'aviso-motivo';
    motivo.value = motivoInicial;
    lblMotivo.htmlFor = 'aviso-motivo';
    const chips = crear('div', 'aviso-chips');
    MOTIVOS.forEach((t) => {
      const c = crear('button', 'aviso-chip', t);
      c.type = 'button';
      c.addEventListener('click', () => { motivo.value = t + '.'; vista(); });
      chips.append(c);
    });
    formAviso.append(lblMotivo, chips, motivo);

    const cajaOferta = crear('fieldset', 'aviso-ofertas');
    cajaOferta.append(crear('legend', '', '✨ El asistente sugiere ofrecerle'));
    const cargando = crear('p', 'aviso-cargando', 'Buscando mesas libres…');
    cajaOferta.append(cargando);
    formAviso.append(cajaOferta);

    const lblDesc = crear('label', 'aviso-label', 'Descuento de compensación');
    const descuento = crear('select', '');
    [0, 10, 15, 20, 25].forEach((n) => descuento.append(new Option(n ? n + '%' : 'Sin descuento', n)));
    descuento.value = '15';
    lblDesc.append(descuento);
    formAviso.append(lblDesc);

    formAviso.append(crear('p', 'aviso-label', 'Así le llega la notificación'));
    const previa = crear('p', 'aviso-previa');
    formAviso.append(previa);
    const error = crear('p', 'form-feedback');
    formAviso.append(error);

    const botones = crear('div', 'aviso-botones');
    const whatsapp = crear('a', 'btn-accion aviso-wsp');
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener';
    whatsapp.innerHTML = '<i class="bi bi-whatsapp" aria-hidden="true"></i> Escribirle';
    const volver = crear('button', 'btn-accion', 'Volver');
    volver.type = 'button';
    volver.addEventListener('click', () => dialogo.close());
    const enviar = crear('button', 'btn-accion btn-rechazar', rechazo ? 'Rechazar y avisar' : 'Cancelar y avisar');
    enviar.type = 'submit';
    botones.append(whatsapp, volver, enviar);
    formAviso.append(botones);
    dialogo.append(formAviso);
    dialogo.showModal();

    let ofertas = [];
    const elegida = () => ofertas[Number((formAviso.querySelector('[name="oferta"]:checked') || {}).value)] || null;
    function texto() {
      const o = elegida();
      let t = `Reserva del ${fechaCorta(r.fecha)} (${hora12(r.hora)}). Motivo: ${motivo.value.trim() || '…'}`;
      if (!/[.!?…]$/.test(t)) t += '.';
      if (o) {
        t += ` Te ofrecemos la mesa ${o.mesa} (${o.piso.toLowerCase()}, ${o.zona}) el ${fechaCorta(o.fecha)} a las ${hora12(o.hora)}`;
        t += Number(descuento.value) ? `, con ${descuento.value}% de descuento en tu consumo.` : '.';
        t += ' Acéptala con un toque desde Mi cuenta.';
      }
      return t;
    }
    function vista() {
      previa.textContent = texto();
      descuento.disabled = !elegida();
      const tel = String(cliente.telefono || '').replace(/\D/g, '');
      whatsapp.hidden = !tel;
      whatsapp.href = `https://wa.me/51${tel.slice(-9)}?text=${encodeURIComponent(`Hola ${cliente.nombre || ''}, te escribimos de Punto Asado. ${texto()}`)}`;
    }
    motivo.addEventListener('input', vista);
    descuento.addEventListener('change', vista);
    vista();

    const { data } = await db.rpc('sugerir_mesas', { p_id: r.id });
    ofertas = (data || []).map((o) => ({ ...o, hora: String(o.hora).slice(0, 5) }));
    cargando.remove();
    const opcion = (valor, etiqueta, marcada) => {
      const l = crear('label', 'aviso-opcion');
      const i = crear('input', '');
      i.type = 'radio';
      i.name = 'oferta';
      i.value = valor;
      i.checked = marcada;
      i.addEventListener('change', vista);
      l.append(i, crear('span', '', etiqueta));
      cajaOferta.append(l);
    };
    ofertas.forEach((o, i) => opcion(i, `Mesa ${o.mesa} · ${o.piso}, ${o.zona} · ${hora12(o.hora)}${o.hora === String(r.hora).slice(0, 5) ? ' (misma hora)' : ''}`, i === 0));
    if (!ofertas.length) cajaOferta.append(crear('p', 'aviso-cargando', 'No hay mesas libres ese día para este grupo.'));
    opcion('', 'No ofrecer otra mesa', !ofertas.length);
    vista();

    formAviso.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!motivo.value.trim()) { motivo.focus(); return; }
      const o = elegida();
      enviar.disabled = true;
      const { error: err } = await db.rpc('cancelar_con_aviso', {
        p_id: r.id, p_motivo: motivo.value.trim(),
        p_oferta_mesa: o ? o.mesa : null, p_oferta_fecha: o ? o.fecha : null,
        p_oferta_hora: o ? o.hora : null, p_descuento: o ? Number(descuento.value) : null
      });
      enviar.disabled = false;
      if (err) { error.textContent = 'No se pudo: ' + err.message; return; }
      dialogo.close();
      await cargarReservas();
    });
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

  // Platos que ya están publicados en menu.html (carta-datos.js) pero todavía no
  // tienen fila en la tabla platos. Se muestran para poder cambiarles la foto.
  const normalizar = (t) => String(t).trim().toLowerCase();
  const esDeLaCarta = (nombre) => typeof CARTA !== 'undefined' && CARTA.some((c) => normalizar(c.nombre) === normalizar(nombre));
  function platosDeLaCarta() {
    if (typeof CARTA === 'undefined') return [];
    const enBase = new Set(platos.map((p) => normalizar(p.nombre)));
    return CARTA.filter((c) => !enBase.has(normalizar(c.nombre)))
      .map((c) => ({ id: null, nombre: c.nombre, categoria: c.categoria, precio: c.precio, imagen: c.imagen, visible: true, deLaCarta: true }));
  }

  function pintarPlatos() {
    const texto = buscarPlato.value.trim().toLowerCase();
    const todos = [...platos, ...platosDeLaCarta()];
    const lista = todos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.categoria.toLowerCase().includes(texto));
    listaPlatos.innerHTML = '';
    if (!lista.length) {
      listaPlatos.append(crear('li', 'vacio', todos.length ? 'Ningún plato coincide.' : 'Aún no hay platos. Agrega el primero con el formulario.'));
      return;
    }
    lista.forEach((p) => {
      const li = crear('li', 'plato-item' + (p.visible ? '' : ' oculto'));
      const cambiarFoto = botonCambiarFoto(p);

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
      const enMenu = !p.deLaCarta && esDeLaCarta(p.nombre);
      const estadoTexto = p.visible ? '' : (enMenu ? ' · eliminado de la carta' : ' · oculto');
      info.append(crear('h3', '', p.nombre), crear('p', '', p.categoria + estadoTexto + (p.deLaCarta ? ' · publicado en la carta' : '')));

      // los platos de la carta solo tienen el botón de foto (sus datos están en menu.html)
      if (p.deLaCarta) {
        const controles = crear('div', 'plato-controles');
        const quitar = crear('button', 'btn-accion btn-eliminar');
        quitar.type = 'button';
        quitar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
        quitar.setAttribute('aria-label', 'Eliminar ' + p.nombre + ' de la carta');
        quitar.title = 'Eliminar de la carta';
        // el plato está escrito en menu.html: se guarda como oculto para que la carta lo esconda
        quitar.addEventListener('click', async () => {
          if (!confirm(`¿Eliminar "${p.nombre}" de la carta?\nDejará de verse en la carta, en la reserva y en el chatbot.`)) return;
          const { error } = await db.from('platos').insert({ nombre: p.nombre, categoria: p.categoria, precio: p.precio, imagen: p.imagen, visible: false });
          if (error) return alert('No se pudo eliminar: ' + error.message);
          cargarPlatos();
        });
        controles.append(cambiarFoto, quitar);
        li.append(info, controles);
        listaPlatos.append(li);
        return;
      }

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
        // si el plato también está escrito en menu.html, borrar la fila lo haría
        // volver a aparecer: por eso se deja guardado como oculto
        if (enMenu) {
          const { error } = await db.from('platos').update({ visible: false }).eq('id', p.id);
          if (error) return alert('No se pudo eliminar: ' + error.message);
          p.visible = false;
          return pintarPlatos();
        }
        const { error } = await db.from('platos').delete().eq('id', p.id);
        if (error) return alert('No se pudo eliminar: ' + error.message);
        platos = platos.filter((x) => x.id !== p.id);
        pintarPlatos();
      });

      controles.append(cambiarFoto, precio, interruptor, eliminar);
      li.append(info, controles);
      listaPlatos.append(li);
    });
  }

  buscarPlato.addEventListener('input', pintarPlatos);

  // ---------- Cambiar la foto de un plato ya publicado ----------
  // Sube la foto nueva a Storage. Si el plato ya está en la tabla, se actualiza
  // su imagen; si solo estaba en menu.html, se crea su fila con la foto y
  // menu.js la pone en la tarjeta de la carta (reemplaza la anterior).
  function botonCambiarFoto(p) {
    const etiqueta = crear('label', 'btn-accion btn-foto');
    etiqueta.title = p.imagen ? 'Cambiar foto' : 'Subir foto';
    etiqueta.innerHTML = '<i class="bi bi-camera" aria-hidden="true"></i>';
    const entrada = crear('input');
    entrada.type = 'file';
    entrada.accept = TIPOS_FOTO.join(',');
    entrada.className = 'visually-hidden';
    entrada.setAttribute('aria-label', (p.imagen ? 'Cambiar foto de ' : 'Subir foto de ') + p.nombre);
    etiqueta.append(entrada);

    entrada.addEventListener('change', async () => {
      const archivo = entrada.files[0];
      if (!archivo) return;
      if (!TIPOS_FOTO.includes(archivo.type)) return alert('La foto debe ser JPG, PNG o WEBP.');
      if (archivo.size > MAX_FOTO) return alert('La foto pesa más de 5 MB. Elige una más liviana.');
      etiqueta.classList.add('subiendo');
      try {
        const imagen = await subirFoto(archivo);
        const { error } = p.deLaCarta
          ? await db.from('platos').insert({ nombre: p.nombre, categoria: p.categoria, precio: p.precio, imagen, visible: true })
          : await db.from('platos').update({ imagen }).eq('id', p.id);
        if (error) throw error;
        await cargarPlatos();
      } catch (err) {
        alert('No se pudo cambiar la foto: ' + err.message);
      } finally {
        etiqueta.classList.remove('subiendo');
      }
    });
    return etiqueta;
  }

  // vista previa de la foto elegida (ruta escrita o archivo subido)
  const archivoFoto = document.getElementById('p-archivo');
  const archivoTexto = document.getElementById('p-archivo-texto');
  const textoArchivoInicial = archivoTexto.textContent;
  const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FOTO = 5 * 1024 * 1024; // 5 MB

  function limpiarArchivo() {
    archivoFoto.value = '';
    archivoTexto.textContent = textoArchivoInicial;
  }

  formPlato.elements.imagen.addEventListener('input', () => {
    const ruta = formPlato.elements.imagen.value.trim();
    if (ruta) limpiarArchivo(); // se usa la ruta escrita, no el archivo
    preview.hidden = !ruta;
    if (ruta) preview.src = ruta;
  });

  archivoFoto.addEventListener('change', () => {
    const archivo = archivoFoto.files[0];
    if (!archivo) return limpiarArchivo();
    if (!TIPOS_FOTO.includes(archivo.type)) {
      limpiarArchivo();
      return avisar(formPlato, 'La foto debe ser JPG, PNG o WEBP.', false);
    }
    if (archivo.size > MAX_FOTO) {
      limpiarArchivo();
      return avisar(formPlato, 'La foto pesa más de 5 MB. Elige una más liviana.', false);
    }
    formPlato.elements.imagen.value = ''; // se usa el archivo, no la ruta
    archivoTexto.textContent = archivo.name;
    preview.src = URL.createObjectURL(archivo);
    preview.hidden = false;
  });
  preview.addEventListener('error', () => { preview.hidden = true; });

  // Sube la foto a Supabase Storage y devuelve su dirección pública
  async function subirFoto(archivo) {
    const extension = archivo.type.split('/')[1].replace('jpeg', 'jpg');
    const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error } = await db.storage.from('fotos-platos').upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;
    return db.storage.from('fotos-platos').getPublicUrl(ruta).data.publicUrl;
  }

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
    const boton = formPlato.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      if (archivoFoto.files[0]) nuevo.imagen = await subirFoto(archivoFoto.files[0]);
    } catch (err) {
      boton.disabled = false;
      return avisar(formPlato, 'No se pudo subir la foto: ' + err.message, false);
    }
    const { error } = await db.from('platos').insert(nuevo);
    boton.disabled = false;
    if (error) return avisar(formPlato, 'No se pudo agregar: ' + error.message, false);
    formPlato.reset();
    limpiarArchivo();
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
