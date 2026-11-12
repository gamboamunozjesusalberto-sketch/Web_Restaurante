/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT GLOBAL (MAIN.JS)
 * Funcionalidades transversales compartidas en todas las páginas:
 * - Cierre automático del menú móvil en dispositivos táctiles
 * - Año actual en el footer (elementos con [data-year])
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Año del footer
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Cierre automático del menú colapsable de Bootstrap al hacer clic en un enlace (móvil).
  // Se usa delegación de eventos para que también funcione con el menú de la cuenta
  // (creado después por sesion.js). El botón que abre ese desplegable NO cierra el menú.
  const navCollapse = document.getElementById('navPuntoAsado');
  if (navCollapse) {
    navCollapse.addEventListener('click', (event) => {
      const enlace = event.target.closest('.nav-link, .btn, .dropdown-item');
      if (!enlace || enlace.classList.contains('dropdown-toggle')) return;
      if (navCollapse.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
        if (bsCollapse) bsCollapse.hide();
      }
    });
  }
});
