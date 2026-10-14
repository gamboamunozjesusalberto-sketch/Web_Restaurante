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

  // Cierre automático del menú colapsable de Bootstrap al hacer clic en un enlace (móvil)
  const navCollapse = document.getElementById('navPuntoAsado');
  if (navCollapse) {
    const navLinks = navCollapse.querySelectorAll('.nav-link, .btn');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (navCollapse.classList.contains('show')) {
          const bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
          if (bsCollapse) {
            bsCollapse.hide();
          }
        }
      });
    });
  }
});
