/**
 * ==========================================================================
 * PUNTO ASADO - NOSOTROS (NOSOTROS.JS)
 * Pestañas de "Nuestros ambientes": muestra el panel elegido y oculta
 * los demás. Se maneja con clic y con las flechas del teclado.
 * El visor de fotos lo pone lightbox.js (atributo data-lightbox).
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const tabs = [...document.querySelectorAll('.ambiente-tab')];
  if (!tabs.length) return;

  function activar(tab, enfocar) {
    tabs.forEach((t) => {
      const activo = t === tab;
      t.classList.toggle('activo', activo);
      t.setAttribute('aria-selected', activo);
      t.tabIndex = activo ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !activo;
    });
    if (enfocar) tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activar(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') activar(tabs[(i + 1) % tabs.length], true);
      if (e.key === 'ArrowLeft') activar(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
  });
});
