/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE LANDING PAGE (LANDING.JS)
 * Funcionalidades exclusivas de index.html:
 * - Control, sincronización de indicadores y eventos del Hero Carousel
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. Control y Sincronización de Indicadores del Hero Carousel
  // ------------------------------------------------------------------------
  const heroCarouselElement = document.getElementById('heroBgCarousel');
  const indicatorButtons = document.querySelectorAll('.hero-indicadores button');
  const prevArrow = document.querySelector('.hero-flecha-izq');
  const nextArrow = document.querySelector('.hero-flecha-der');

  if (heroCarouselElement && typeof bootstrap !== 'undefined') {
    // Inicializar carrusel explícitamente con Bootstrap para asegurar consistencia
    const heroCarousel = bootstrap.Carousel.getOrCreateInstance(heroCarouselElement, {
      interval: 4500,
      ride: 'carousel',
      pause: false // Continúa rotando suavemente
    });

    // Función para actualizar visualmente el punto indicador activo
    const updateIndicators = (activeIndex) => {
      indicatorButtons.forEach((btn, index) => {
        if (index === activeIndex) {
          btn.classList.add('active');
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.classList.remove('active');
          btn.removeAttribute('aria-current');
        }
      });
    };

    // Escuchar el evento de Bootstrap cuando cambia de foto (automático o por controles)
    heroCarouselElement.addEventListener('slide.bs.carousel', (event) => {
      // event.to es el índice de la foto hacia la que se está cambiando (0 a 4)
      if (typeof event.to === 'number') {
        updateIndicators(event.to);
      }
    });

    // Permitir hacer clic en cada uno de los 5 puntos para ir a esa foto directamente
    indicatorButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        heroCarousel.to(index);
        updateIndicators(index);
      });
    });

    // Controles de flechas manuales
    if (prevArrow) {
      prevArrow.addEventListener('click', (e) => {
        e.preventDefault();
        heroCarousel.prev();
      });
    }

    if (nextArrow) {
      nextArrow.addEventListener('click', (e) => {
        e.preventDefault();
        heroCarousel.next();
      });
    }

    // Soporte para flechas del teclado (izquierda / derecha)
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        heroCarousel.prev();
      } else if (event.key === 'ArrowRight') {
        heroCarousel.next();
      }
    });
  }
});
