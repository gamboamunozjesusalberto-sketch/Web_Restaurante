/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE LA CARTA (MENU.JS)
 * Filtros de categoría de menu.html:
 * - "Toda la carta" muestra todo; las demás muestran solo su bloque
 * - Acepta enlaces directos: menu.html#entradas, #parrilla, #platos, #postres, #vinos
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
  if (['entradas', 'parrilla', 'platos', 'postres', 'vinos'].includes(categoria)) {
    mostrar(categoria);
  }
});
