/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT GLOBAL (MAIN.JS)
 * Funcionalidades transversales compartidas en todas las páginas:
 * - Cierre automático del menú móvil en dispositivos táctiles
 * - Año actual en el footer (elementos con [data-year])
 * - Efecto 3D que sigue al cursor en las tarjetas de platos (versión final)
 * - Botón flotante "Reservar" en celulares (versión final)
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

  // Efecto 3D: la tarjeta se inclina hacia donde está el cursor.
  // Solo con mouse (no en celular) y si el usuario no pidió menos movimiento.
  const conMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (conMouse && !sinMovimiento) {
    document.querySelectorAll('.parrilla-card, .plato-tarjeta').forEach((tarjeta) => {
      tarjeta.addEventListener('mousemove', (e) => {
        const caja = tarjeta.getBoundingClientRect();
        const x = (e.clientX - caja.left) / caja.width - 0.5; // -0.5 a 0.5
        const y = (e.clientY - caja.top) / caja.height - 0.5;
        tarjeta.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        tarjeta.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
        tarjeta.style.setProperty('--brillo-x', `${((x + 0.5) * 100).toFixed(0)}%`);
        tarjeta.style.setProperty('--brillo-y', `${((y + 0.5) * 100).toFixed(0)}%`);
        tarjeta.classList.add('inclinando');
      });
      tarjeta.addEventListener('mouseleave', () => tarjeta.classList.remove('inclinando'));
    });
  }

  // Botón flotante "Reservar" (solo se ve en celular, ver components.css).
  // No se pone en las páginas donde ya se reserva o no corresponde.
  const pagina = location.pathname.split('/').pop() || 'index.html';
  if (!['contacto.html', 'login.html', 'cuenta.html', 'admin.html'].includes(pagina)) {
    const flotante = document.createElement('a');
    flotante.href = 'contacto.html#reserva';
    flotante.className = 'reservar-flotante';
    flotante.innerHTML = '<i class="bi bi-calendar-check" aria-hidden="true"></i> Reservar';
    document.body.append(flotante);
    // se esconde cuando ya se ve el pie de página, para no tapar sus enlaces
    const pie = document.querySelector('footer');
    if (pie && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entrada]) => {
        flotante.classList.toggle('oculto', entrada.isIntersecting);
      }).observe(pie);
    }
  }
});
