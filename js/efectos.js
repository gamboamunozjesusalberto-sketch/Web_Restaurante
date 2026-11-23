/**
 * ==========================================================================
 * PUNTO ASADO - EFECTOS DE LAS PÁGINAS INTERNAS (EFECTOS.JS)
 * Se usa en Carta, Nosotros y Contacto para que se sientan tan vivas como
 * el Inicio:
 * 1. Barra de progreso de lectura arriba de la página
 * 2. Chispas de brasa que suben en la portada + portada con efecto parallax
 * 3. Los bloques aparecen al bajar (IntersectionObserver), en cascada
 * 4. Números que cuentan hasta su valor (data-contar)
 * 5. Botón "volver arriba"
 * 6. Solo en la Carta: buscador de platos y ficha del plato al hacer clic
 * Todo respeta "reducir movimiento" del sistema operativo.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('con-efectos');

  // ---------- 1. Barra de progreso ----------
  const barra = document.createElement('div');
  barra.className = 'progreso-lectura';
  barra.setAttribute('aria-hidden', 'true');
  document.body.append(barra);

  // ---------- 5. Volver arriba ----------
  const arriba = document.createElement('button');
  arriba.type = 'button';
  arriba.className = 'volver-arriba';
  arriba.setAttribute('aria-label', 'Volver arriba');
  arriba.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
  arriba.addEventListener('click', () => window.scrollTo({ top: 0, behavior: sinMovimiento ? 'auto' : 'smooth' }));
  document.body.append(arriba);

  // ---------- 2. Parallax de la portada ----------
  const fondoPortada = document.querySelector('.page-hero-bg');
  const portada = document.querySelector('.page-hero');

  let pendiente = false;
  function alDesplazar() {
    pendiente = false;
    const y = window.scrollY;
    const alto = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.transform = `scaleX(${alto > 0 ? Math.min(y / alto, 1) : 0})`;
    arriba.classList.toggle('visible', y > 600);
    if (fondoPortada && !sinMovimiento && y < 900) {
      fondoPortada.style.transform = `translateY(${y * 0.35}px) scale(${1.08 + y * 0.0002})`;
    }
  }
  window.addEventListener('scroll', () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(alDesplazar); }
  }, { passive: true });
  alDesplazar();

  // Chispas de brasa en la portada (canvas)
  if (portada && !sinMovimiento) chispas(portada);

  // ---------- 3. Aparecer al bajar ----------
  // Además de los .reveal que ya tiene el HTML, se animan estos bloques:
  const extras = [
    '.pagina-nosotros main section > h2', '.historia-texto p', '.datos-clave li', '.valor',
    '.logro-item', '.aliados .container > *', '.ambientes .container > *',
    '.tabla-horario tr', '.page-contacto .section-head', '.cta-band .container > *'
  ].join(',');
  document.querySelectorAll(extras).forEach((el) => el.classList.add('reveal'));

  const bloques = [...document.querySelectorAll('.inner-page .reveal')];
  if ('IntersectionObserver' in window && !sinMovimiento) {
    const yaVisibles = new Set();
    bloques.forEach((el) => {
      const caja = el.getBoundingClientRect();
      if (caja.top < window.innerHeight * 0.9) yaVisibles.add(el); // lo de arriba no se esconde
      else el.classList.add('revelar');
    });
    const observador = new IntersectionObserver((entradas) => {
      // los que entran juntos aparecen uno tras otro
      entradas.filter((e) => e.isIntersecting).forEach((entrada, i) => {
        const el = entrada.target;
        observador.unobserve(el);
        el.style.transitionDelay = `${Math.min(i, 6) * 0.08}s`;
        el.classList.add('revelado');
        el.classList.remove('revelar');
        // al terminar se quitan las clases para no interferir con el hover 3D
        setTimeout(() => { el.classList.remove('revelado'); el.style.transitionDelay = ''; }, 1400);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    bloques.filter((el) => !yaVisibles.has(el)).forEach((el) => observador.observe(el));

    // un bloque que estaba oculto por el filtro de la carta debe verse al mostrarse
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-btn')) return;
      setTimeout(() => document.querySelectorAll('.menu-block:not([hidden]) .revelar').forEach((el) => {
        const caja = el.getBoundingClientRect();
        if (caja.top < window.innerHeight) { el.classList.remove('revelar'); observador.unobserve(el); }
      }), 50);
    });
  }

  // ---------- 4. Contadores ----------
  // <strong data-contar="2019">2019</strong> cuenta desde 0 (o data-desde) hasta el número
  document.querySelectorAll('.datos-clave strong').forEach((el) => {
    const n = parseInt(el.textContent.replace(/[^\d]/g, ''), 10);
    if (n && /^\s*\d+\s*$/.test(el.textContent)) el.dataset.contar = n;
  });
  const contar = (el) => {
    const fin = Number(el.dataset.contar);
    const desde = Number(el.dataset.desde || (fin > 1900 ? fin - 30 : 0));
    const inicio = performance.now();
    const paso = (t) => {
      const p = Math.min((t - inicio) / 1400, 1);
      const suave = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(desde + (fin - desde) * suave));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const conContador = document.querySelectorAll('[data-contar]');
  if (conContador.length && 'IntersectionObserver' in window && !sinMovimiento) {
    const obs = new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) { obs.unobserve(e.target); contar(e.target); }
    }), { threshold: 0.6 });
    conContador.forEach((el) => obs.observe(el));
  }

  // ---------- 6. Carta: buscador y ficha del plato ----------
  if (document.body.classList.contains('page-menu')) {
    if (typeof cartaVisible === 'function') cartaVisible(); // suma los platos nuevos del Panel
    cartaInteractiva(sinMovimiento);
  }
});

// Chispas que suben desde abajo, como brasas de la parrilla
function chispas(portada) {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'chispas';
  lienzo.setAttribute('aria-hidden', 'true');
  portada.append(lienzo);
  const ctx = lienzo.getContext('2d');
  let ancho = 0, alto = 0, activo = true;
  const lista = [];

  const medir = () => {
    const escala = Math.min(window.devicePixelRatio || 1, 2);
    ancho = portada.clientWidth;
    alto = portada.clientHeight;
    lienzo.width = ancho * escala;
    lienzo.height = alto * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
  };
  medir();
  window.addEventListener('resize', medir);

  const nueva = () => ({
    x: Math.random() * ancho,
    y: alto + 10,
    r: 0.8 + Math.random() * 2.2,
    vy: 0.5 + Math.random() * 1.3,
    vx: (Math.random() - 0.5) * 0.4,
    fase: Math.random() * 6.28,
    vida: 1
  });
  const cantidad = Math.round(Math.min(ancho, 1400) / 22);
  for (let i = 0; i < cantidad; i++) { const c = nueva(); c.y = Math.random() * alto; lista.push(c); }

  // se pausa cuando la portada ya no se ve (ahorra batería)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { activo = e.isIntersecting; if (activo) requestAnimationFrame(dibujar); }).observe(portada);
  }

  function dibujar() {
    if (!activo) return;
    ctx.clearRect(0, 0, ancho, alto);
    lista.forEach((c, i) => {
      c.fase += 0.03;
      c.x += c.vx + Math.sin(c.fase) * 0.35;
      c.y -= c.vy;
      c.vida = Math.max(0, c.y / alto);
      if (c.y < -10) lista[i] = nueva();
      const brillo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 4);
      brillo.addColorStop(0, `rgba(255, 196, 110, ${0.9 * c.vida + 0.1})`);
      brillo.addColorStop(0.4, `rgba(255, 120, 40, ${0.5 * c.vida})`);
      brillo.addColorStop(1, 'rgba(255, 80, 20, 0)');
      ctx.fillStyle = brillo;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 4, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(dibujar);
  }
  requestAnimationFrame(dibujar);
}

// Carta: buscador en la barra de filtros + ficha del plato al hacer clic
function cartaInteractiva(sinMovimiento) {
  const datos = typeof CARTA !== 'undefined' ? CARTA : [];
  const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const buscarDato = (nombre) => datos.find((p) => normalizar(p.nombre) === normalizar(nombre));
  const tarjetas = () => [...document.querySelectorAll('.parrilla-card, .vino-card')];

  // --- buscador ---
  const fila = document.querySelector('.filters-row');
  if (fila) {
    const caja = document.createElement('label');
    caja.className = 'buscador-carta';
    caja.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>';
    const entrada = document.createElement('input');
    entrada.type = 'search';
    entrada.placeholder = 'Buscar plato…';
    entrada.setAttribute('aria-label', 'Buscar un plato en la carta');
    caja.append(entrada);
    fila.after(caja);
    const aviso = document.createElement('p');
    aviso.className = 'buscador-vacio';
    aviso.hidden = true;
    caja.after(aviso);

    entrada.addEventListener('input', () => {
      const q = normalizar(entrada.value);
      if (q) document.querySelector('.filter-btn[data-filter="todo"]')?.click();
      let total = 0;
      tarjetas().forEach((t) => {
        const texto = normalizar(t.textContent);
        const coincide = !q || texto.includes(q);
        t.classList.toggle('no-coincide', !coincide);
        t.classList.remove('revelar');
        if (coincide) total++;
      });
      document.querySelectorAll('.menu-block').forEach((b) => {
        b.classList.toggle('sin-resultados', !!q && !b.querySelector('.parrilla-card:not(.no-coincide), .vino-card:not(.no-coincide)'));
      });
      aviso.hidden = !q || total > 0;
      aviso.textContent = `No encontramos "${entrada.value.trim()}". Prueba con otra palabra o pregúntale a Asadito 🔥`;
    });
  }

  // --- ficha del plato ---
  const ficha = document.createElement('div');
  ficha.className = 'ficha-plato';
  ficha.hidden = true;
  ficha.innerHTML = `
    <div class="ficha-fondo" data-cerrar></div>
    <article class="ficha-caja" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
      <button type="button" class="ficha-cerrar" data-cerrar aria-label="Cerrar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      <div class="ficha-foto"><img alt=""></div>
      <div class="ficha-info">
        <span class="ficha-categoria"></span>
        <h2 id="ficha-titulo"></h2>
        <p class="ficha-desc"></p>
        <p class="ficha-coccion"><i class="bi bi-fire" aria-hidden="true"></i> <span></span></p>
        <p class="ficha-vino"><i class="bi bi-cup-straw" aria-hidden="true"></i> <span></span></p>
        <div class="ficha-pie">
          <strong class="ficha-precio"></strong>
          <a class="btn btn-celeste ficha-reservar" href="contacto.html#reserva"><i class="bi bi-calendar-plus" aria-hidden="true"></i> Lo quiero en mi reserva</a>
        </div>
      </div>
    </article>`;
  document.body.append(ficha);
  const CATEGORIAS = { entradas: 'Para comenzar', parrilla: 'A la parrilla', platos: 'Nuestros platos', postres: 'Postres', vinos: 'Vinos', bebidas: 'Bebidas' };
  const vinos = () => datos.filter((p) => p.categoria === 'vinos');
  let ultimoFoco = null;

  function abrir(tarjeta) {
    const nombre = tarjeta.querySelector('h3').textContent.trim();
    const dato = buscarDato(nombre) || {};
    const img = tarjeta.querySelector('img');
    const categoria = tarjeta.closest('.menu-block')?.dataset.category || dato.categoria || '';
    ficha.querySelector('.ficha-foto img').src = img ? img.src : 'images/asador.jpg';
    ficha.querySelector('.ficha-foto img').alt = nombre;
    ficha.querySelector('.ficha-categoria').textContent = CATEGORIAS[categoria] || '';
    ficha.querySelector('h2').textContent = nombre;
    ficha.querySelector('.ficha-desc').textContent = tarjeta.querySelector('p')?.textContent || '';
    const coccion = ficha.querySelector('.ficha-coccion');
    const descTexto = tarjeta.querySelector('p')?.textContent.trim() || '';
    coccion.hidden = !dato.coccion || categoria === 'vinos' || dato.coccion.trim() === descTexto;
    coccion.querySelector('span').textContent = dato.coccion || '';
    // sugerencia de vino para carnes y platos de fondo
    const vino = ficha.querySelector('.ficha-vino');
    const lista = vinos();
    const sugerir = ['parrilla', 'platos', 'entradas'].includes(categoria) && lista.length;
    vino.hidden = !sugerir;
    if (sugerir) {
      const v = lista[[...nombre].reduce((t, c) => t + c.charCodeAt(0), 0) % lista.length];
      vino.querySelector('span').textContent = `Va muy bien con un ${v.nombre}` + (v.precio != null ? ` (S/. ${Number(v.precio).toFixed(2)})` : '');
    }
    ficha.querySelector('.ficha-precio').textContent = tarjeta.querySelector('.parrilla-price')?.textContent || '';
    ficha.querySelector('.ficha-reservar').href = `contacto.html?plato=${encodeURIComponent(nombre)}#reserva`;

    ultimoFoco = document.activeElement;
    ficha.hidden = false;
    document.body.classList.add('sin-scroll');
    requestAnimationFrame(() => ficha.classList.add('abierta'));
    ficha.querySelector('.ficha-cerrar').focus();
  }

  function cerrar() {
    ficha.classList.remove('abierta');
    document.body.classList.remove('sin-scroll');
    setTimeout(() => { ficha.hidden = true; }, sinMovimiento ? 0 : 250);
    if (ultimoFoco) ultimoFoco.focus();
  }

  ficha.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ficha.hidden) cerrar(); });

  // las tarjetas (también las que agrega menu.js desde la base) se abren con clic o Enter
  const preparar = () => tarjetas().forEach((t) => {
    if (t.dataset.ficha) return;
    t.dataset.ficha = '1';
    t.tabIndex = 0;
    t.setAttribute('role', 'button');
    t.setAttribute('aria-label', 'Ver detalle de ' + (t.querySelector('h3')?.textContent || 'plato'));
  });
  preparar();
  setTimeout(preparar, 2500);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.parrilla-card, .vino-card');
    if (t) { preparar(); abrir(t); }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('.parrilla-card, .vino-card');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(t); }
  });
}
