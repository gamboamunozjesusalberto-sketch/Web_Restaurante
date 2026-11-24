/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE LA CARTA (MENU.JS)
 * Filtros de categoría de menu.html:
 * - "Toda la carta" muestra todo; las demás muestran solo su bloque
 * - Acepta enlaces directos: menu.html#entradas, #parrilla, #platos, #postres, #vinos
 * - Platos del Panel de administrador (tabla platos de Supabase): si el plato ya está
 *   en la carta, actualiza su precio y descripción; si es nuevo, agrega su tarjeta
 *
 * NOTA: este archivo no venía en el código recibido; se escribió a partir
 * del HTML de menu.html (botones .filter-btn con data-filter y bloques
 * .menu-block con data-category). Si ya tienen el original, reemplazarlo.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const botones = document.querySelectorAll('.filter-btn');
  const bloques = document.querySelectorAll('.menu-block');
  if (!botones.length || !bloques.length) return;

  const mostrar = (filtro) => {
    bloques.forEach((bloque) => {
      const visible = filtro === 'todo' || bloque.dataset.category === filtro;
      bloque.hidden = !visible;
      bloque.classList.remove('fade-in');
      if (visible) {
        void bloque.offsetWidth; // reinicia la animación
        bloque.classList.add('fade-in');
      }
    });

    botones.forEach((boton) => {
      const activo = boton.dataset.filter === filtro;
      boton.classList.toggle('active', activo);
      boton.setAttribute('aria-pressed', String(activo));
    });
  };

  botones.forEach((boton) => {
    boton.setAttribute('aria-pressed', String(boton.classList.contains('active')));
    boton.addEventListener('click', () => mostrar(boton.dataset.filter));
  });

  const categoria = window.location.hash.replace('#', '');
  if (['entradas', 'parrilla', 'platos', 'postres', 'vinos', 'bebidas'].includes(categoria)) {
    mostrar(categoria);
  }

  // los platos del Panel entran solos a su sección; al final se quitan las secciones vacías
  cargarPlatosDeLaBase().finally(quitarSeccionesVacias);
});

// Una sección sin platos (por ejemplo Bebidas, si el admin aún no agregó ninguna,
// o una categoría cuyos platos se eliminaron) se quita junto con su botón de filtro.
function quitarSeccionesVacias() {
  document.querySelectorAll('.menu-block').forEach((bloque) => {
    if (!bloque.querySelector('.parrilla-card, .vino-card')) bloque.remove();
  });
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    if (btn.dataset.filter !== 'todo' && !document.getElementById(btn.dataset.filter)) btn.remove();
  });
}

// Lee los platos visibles de Supabase y los pone en la carta.
// Solo lectura: la política RLS deja ver al público únicamente los platos visibles.
async function cargarPlatosDeLaBase() {
  if (typeof db === 'undefined' || !db) return;
  const { data, error } = await db
    .from('platos')
    .select('nombre, descripcion, categoria, precio, imagen')
    .eq('visible', true) // también para el admin, que puede ver los ocultos
    .order('creado_en');
  if (error || !data) return;

  const normalizar = (t) => t.trim().toLowerCase();

  // Platos que el admin eliminó desde el Panel: se quita su tarjeta
  if (typeof nombresOcultos === 'function') {
    const ocultos = await nombresOcultos();
    document.querySelectorAll('.parrilla-card, .vino-card').forEach((tarjeta) => {
      const h3 = tarjeta.querySelector('h3');
      if (h3 && ocultos.has(normalizar(h3.textContent))) tarjeta.remove();
    });
  }
  const precioTexto = (n) => 'S/ ' + Number(n).toFixed(2);

  data.forEach((plato) => {
    const seccion = document.getElementById(String(plato.categoria).toLowerCase());
    const grilla = seccion && seccion.querySelector('.parrilla-grid, .vino-grid');
    if (!grilla) return; // categoría sin sección en la carta (por ejemplo, bebidas)

    // ¿Ya existe una tarjeta con el mismo nombre? Entonces solo se actualiza.
    const existente = [...grilla.querySelectorAll('h3')]
      .find((h3) => normalizar(h3.textContent) === normalizar(plato.nombre));
    if (existente) {
      const info = existente.parentElement;
      const precio = info.querySelector('.parrilla-price');
      if (precio && plato.precio != null) precio.textContent = precioTexto(plato.precio);
      const texto = info.querySelector('p');
      if (texto && plato.descripcion) texto.textContent = plato.descripcion;
      // si el admin subió una foto, reemplaza la ilustración (o la foto anterior)
      const mediaExistente = info.parentElement.querySelector('.parrilla-media, .vino-media');
      if (plato.imagen && mediaExistente) {
        let img = mediaExistente.querySelector('img');
        if (!img) {
          mediaExistente.classList.remove('sin-foto');
          mediaExistente.removeAttribute('aria-hidden');
          mediaExistente.querySelectorAll('i, span:not(.parrilla-badge)').forEach((el) => el.remove());
          img = document.createElement('img');
          img.loading = 'lazy';
          mediaExistente.prepend(img);
        }
        img.src = plato.imagen;
        img.alt = plato.nombre;
      }
      return;
    }

    // Plato nuevo: se arma la tarjeta igual que las del HTML (textContent: nunca HTML)
    const esVino = grilla.classList.contains('vino-grid');
    const tarjeta = document.createElement('article');
    tarjeta.className = esVino ? 'vino-card' : 'parrilla-card';

    const media = document.createElement('div');
    media.className = esVino ? 'vino-media' : 'parrilla-media';
    const img = document.createElement('img');
    img.src = plato.imagen || 'images/asador.jpg';
    img.alt = plato.nombre;
    img.loading = 'lazy';
    media.append(img);
    if (!esVino) {
      const badge = document.createElement('span');
      badge.className = 'parrilla-badge';
      badge.textContent = 'Nuevo';
      media.append(badge);
    }

    const info = document.createElement('div');
    info.className = esVino ? 'vino-info' : 'parrilla-info';
    const titulo = document.createElement('h3');
    titulo.textContent = plato.nombre;
    const texto = document.createElement('p');
    texto.textContent = plato.descripcion || '';
    info.append(titulo, texto);
    if (plato.precio != null) {
      const precio = document.createElement('div');
      precio.className = 'parrilla-price';
      precio.textContent = precioTexto(plato.precio);
      info.append(precio);
    }

    tarjeta.append(media, info);
    grilla.append(tarjeta);
  });
}
