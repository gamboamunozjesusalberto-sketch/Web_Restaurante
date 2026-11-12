/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE LANDING PAGE (LANDING.JS)
 * Funcionalidades exclusivas de index.html:
 * - Control, sincronización de indicadores y eventos del Hero Carousel
 * - Promociones activas leídas de Supabase (versión final)
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
      if (document.body.classList.contains('sin-scroll')) return; // el visor de fotos está abierto
      if (event.key === 'ArrowLeft') {
        heroCarousel.prev();
      } else if (event.key === 'ArrowRight') {
        heroCarousel.next();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 2. Promociones activas (Supabase). Solo lectura: la política RLS deja
  //    ver al público únicamente las promociones con activa = true.
  // ------------------------------------------------------------------------
  cargarPromociones();
});

async function cargarPromociones() {
  const seccion = document.getElementById('promociones');
  const lista = document.getElementById('promos-lista');
  if (!seccion || !lista || typeof db === 'undefined' || !db) return;

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // AAAA-MM-DD
  const { data, error } = await db
    .from('promociones')
    .select('titulo, descripcion, hasta')
    .eq('activa', true)
    .or(`hasta.is.null,hasta.gte.${hoy}`)
    .order('creado_en', { ascending: false })
    .limit(3);
  if (error || !data || !data.length) return;

  lista.replaceChildren(...data.map((promo, i) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'promo-tarjeta';
    tarjeta.style.setProperty('--delay', `${i * 0.12}s`);

    const titulo = document.createElement('h3');
    titulo.textContent = promo.titulo; // textContent: nunca se interpreta como HTML
    const texto = document.createElement('p');
    texto.textContent = promo.descripcion;
    tarjeta.append(titulo, texto);

    if (promo.hasta) {
      const fecha = new Date(promo.hasta + 'T12:00:00');
      const vence = document.createElement('span');
      vence.className = 'promo-vence';
      vence.textContent = 'Válido hasta el ' + fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
      tarjeta.append(vence);
    }
    return tarjeta;
  }));
  seccion.hidden = false;
}
