/**
 * ==========================================================================
 * PUNTO ASADO - OPINIONES DEL CLIENTE (OPINIONES.JS) · usado en cuenta.html
 * - El cliente califica (1 a 5), comenta y puede subir una foto de su plato
 * - La foto va a Supabase Storage, a la carpeta del propio cliente
 *   (fotos-opiniones/<id del usuario>/...), y solo él puede escribir ahí
 * - "Mis opiniones": ver y eliminar las propias
 * La opinión se publica en el Inicio; el admin puede ocultarla.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('form-opinion');
  if (!form || !db) return;
  const usuario = await Sesion.usuario();
  if (!usuario) return; // cuenta.js ya redirige al login

  const feedback = form.querySelector('.form-feedback');
  const avisar = (texto, ok = false) => { feedback.textContent = texto; feedback.classList.toggle('ok', ok); };
  const crear = (etiqueta, clase, texto) => {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  };

  // platos de la carta para elegir
  const selectPlato = form.elements.plato;
  selectPlato.append(new Option('No quiero indicar un plato', ''));
  if (typeof CARTA !== 'undefined') {
    CARTA.filter((p) => p.categoria !== 'vinos').forEach((p) => selectPlato.append(new Option(p.nombre, p.nombre)));
  }

  // ---------- foto ----------
  const archivo = document.getElementById('op-foto');
  const archivoTexto = document.getElementById('op-foto-texto');
  const textoInicial = archivoTexto.textContent;
  const preview = document.getElementById('op-preview');
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX = 5 * 1024 * 1024;

  function limpiarFoto() {
    archivo.value = '';
    archivoTexto.textContent = textoInicial;
    preview.hidden = true;
  }

  archivo.addEventListener('change', () => {
    const f = archivo.files[0];
    if (!f) return limpiarFoto();
    if (!TIPOS.includes(f.type)) { limpiarFoto(); return avisar('La foto debe ser JPG, PNG o WEBP.'); }
    if (f.size > MAX) { limpiarFoto(); return avisar('La foto pesa más de 5 MB. Elige una más liviana.'); }
    archivoTexto.textContent = f.name;
    preview.src = URL.createObjectURL(f);
    preview.hidden = false;
    avisar('');
  });

  async function subirFoto(f) {
    const extension = f.type.split('/')[1].replace('jpeg', 'jpg');
    const ruta = `${usuario.id}/${Date.now()}.${extension}`; // carpeta propia del cliente
    const { error } = await db.storage.from('fotos-opiniones').upload(ruta, f, { contentType: f.type });
    if (error) throw error;
    return db.storage.from('fotos-opiniones').getPublicUrl(ruta).data.publicUrl;
  }

  // ---------- publicar ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comentario = form.elements.comentario.value.trim();
    if (comentario.length < 10) {
      form.elements.comentario.focus();
      return avisar('Escribe un comentario de al menos 10 letras.');
    }
    const boton = form.querySelector('[type="submit"]');
    boton.disabled = true;
    avisar('Publicando…', true);

    let foto = null;
    try {
      if (archivo.files[0]) foto = await subirFoto(archivo.files[0]);
    } catch (err) {
      boton.disabled = false;
      return avisar('No se pudo subir la foto: ' + err.message);
    }

    const { error } = await db.from('opiniones').insert({
      calificacion: Number(form.elements.calificacion.value),
      plato: selectPlato.value || null,
      comentario,
      foto
    });
    boton.disabled = false;
    if (error) return avisar('No se pudo publicar: ' + error.message);

    form.reset();
    limpiarFoto();
    avisar('¡Gracias! Tu opinión ya aparece en el Inicio.', true);
    cargarMias();
  });

  // ---------- mis opiniones ----------
  const lista = document.getElementById('mis-opiniones');

  async function cargarMias() {
    const { data, error } = await db.from('opiniones').select('*').eq('usuario_id', usuario.id).order('creado_en', { ascending: false });
    const mias = error || !data ? [] : data;
    lista.innerHTML = '';
    if (!mias.length) {
      lista.append(crear('li', 'vacio', 'Todavía no compartiste ninguna opinión.'));
      return;
    }
    mias.forEach((o) => {
      const li = crear('li', 'opinion-admin' + (o.visible ? '' : ' oculta'));
      if (o.foto) {
        const img = crear('img');
        img.src = o.foto;
        img.alt = 'Tu foto';
        li.append(img);
      }
      const info = crear('div', 'opinion-admin-info');
      info.append(
        crear('strong', '', `${'★'.repeat(o.calificacion)}${'☆'.repeat(5 - o.calificacion)}${o.plato ? ' · ' + o.plato : ''}`),
        crear('p', '', o.comentario),
        crear('small', '', o.visible ? 'Publicada en el Inicio' : 'Oculta por el restaurante')
      );
      const borrar = crear('button', 'btn-cancelar', 'Eliminar');
      borrar.type = 'button';
      borrar.addEventListener('click', async () => {
        if (!confirm('¿Eliminar tu opinión?')) return;
        await db.from('opiniones').delete().eq('id', o.id);
        cargarMias();
      });
      li.append(info, borrar);
      lista.append(li);
    });
  }

  cargarMias();
});
