/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DE LANDING PAGE (LANDING.JS)
 * Funcionalidades exclusivas de index.html:
 * - Control, sincronización de indicadores y eventos del Hero Carousel
 * - Promociones activas leídas de Supabase (versión final)
 * - Paquetes (datos de js/carta-datos.js) y opiniones de clientes con foto
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
  pintarPaquetesInicio();
  cargarOpiniones();
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

// Tarjetas de paquetes: cada una lleva a la reserva con el paquete ya elegido
function pintarPaquetesInicio() {
  const grilla = document.getElementById('paquetes-inicio');
  if (!grilla || typeof PAQUETES === 'undefined') return;
  PAQUETES.forEach((paq, i) => {
    const tarjeta = document.createElement('a');
    tarjeta.className = 'paquete-tarjeta';
    tarjeta.href = `contacto.html?paquete=${encodeURIComponent(paq.id)}#reserva`;
    tarjeta.style.setProperty('--delay', `${i * 0.1}s`);
    const icono = document.createElement('i');
    icono.className = 'bi ' + paq.icono;
    icono.setAttribute('aria-hidden', 'true');
    const titulo = document.createElement('h3');
    titulo.textContent = paq.id;
    const texto = document.createElement('p');
    texto.textContent = paq.resumen;
    const rango = document.createElement('span');
    rango.className = 'paquete-rango';
    rango.textContent = `${paq.min} a ${paq.max} personas · Reservar →`;
    tarjeta.append(icono, titulo, texto, rango);
    grilla.append(tarjeta);
  });
}

// Opiniones de clientes (solo las visibles, por RLS). Muestra las 6 más recientes.
async function cargarOpiniones() {
  const seccion = document.getElementById('opiniones');
  const lista = document.getElementById('opiniones-lista');
  if (!seccion || !lista || typeof db === 'undefined' || !db) return;

  const { data, error } = await db
    .from('opiniones')
    .select('autor, plato, calificacion, comentario, foto, creado_en')
    .eq('visible', true)
    .order('creado_en', { ascending: false })
    .limit(6);
  if (error || !data || !data.length) return;

  const promedio = data.reduce((t, o) => t + o.calificacion, 0) / data.length;
  document.getElementById('opiniones-promedio').textContent =
    `${'★'.repeat(Math.round(promedio))} ${promedio.toFixed(1)} de 5 en las últimas ${data.length} opiniones`;

  lista.replaceChildren(...data.map((o) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'opinion-tarjeta';
    if (o.foto) {
      const figura = document.createElement('figure');
      const img = document.createElement('img');
      img.src = o.foto;
      img.alt = o.plato ? `${o.plato}, foto de ${o.autor}` : `Foto de ${o.autor}`;
      img.loading = 'lazy';
      const pie = document.createElement('figcaption');
      pie.textContent = `${o.autor}${o.plato ? ' · ' + o.plato : ''}`;
      figura.append(img, pie);
      tarjeta.append(figura);
    }
    const estrellas = document.createElement('div');
    estrellas.className = 'opinion-estrellas';
    estrellas.textContent = '★'.repeat(o.calificacion) + '☆'.repeat(5 - o.calificacion);
    estrellas.setAttribute('aria-label', `${o.calificacion} de 5 estrellas`);
    const texto = document.createElement('p');
    texto.textContent = '“' + o.comentario + '”'; // textContent: nunca HTML
    const autor = document.createElement('span');
    autor.className = 'opinion-autor';
    autor.textContent = `${o.autor}${o.plato ? ' · ' + o.plato : ''}`;
    tarjeta.append(estrellas, texto, autor);
    return tarjeta;
  }));
  seccion.hidden = false;
  document.dispatchEvent(new Event('fotos-agregadas')); // el visor de fotos las toma
}

// Recomendaciones del chef: usan el precio que el admin puso en el Panel y
// se quitan los platos que el admin sacó de la carta (cartaVisible, carta-datos.js)
document.addEventListener('DOMContentLoaded', async () => {
  const tarjetas = document.querySelectorAll('.plato-tarjeta');
  if (!tarjetas.length || typeof cartaVisible !== 'function') return;
  const carta = await cartaVisible();
  tarjetas.forEach((tarjeta) => {
    const nombre = tarjeta.querySelector('.plato-nombre')?.textContent.trim().toLowerCase();
    const plato = carta.find((p) => p.nombre.toLowerCase() === nombre);
    const columna = tarjeta.closest('[class*="col-"]') || tarjeta;
    if (!plato) { columna.remove(); return; }
    const precio = tarjeta.querySelector('.plato-precio');
    if (precio && plato.precio != null) precio.textContent = 'S/ ' + Number(plato.precio).toFixed(2);
  });
});
