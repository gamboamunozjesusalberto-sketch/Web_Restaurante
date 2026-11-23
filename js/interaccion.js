/**
 * ==========================================================================
 * PUNTO ASADO - INTERACCIÓN EN TODO EL SITIO (INTERACCION.JS)
 * 1. Pantalla de carga "Encendiendo las brasas" (solo la primera vez por visita)
 * 2. Transición entre páginas (una cortina oscura con el logo)
 * 3. Cursor propio: un punto y un aro que lo sigue (solo con mouse)
 * 4. Chispas al hacer clic
 * 5. Botones "magnéticos" que se acercan al cursor
 * 6. Carta: ruleta "¿No sabes qué pedir?" que elige un plato al azar
 * Todo se apaga si el sistema pide "reducir movimiento".
 * ==========================================================================
 */

'use strict';

(() => {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (sinMovimiento) return;

  // ---------- 1. Pantalla de carga (antes de que se pinte la página) ----------
  let primeraVez = true;
  try { primeraVez = !sessionStorage.getItem('pa-cargado'); sessionStorage.setItem('pa-cargado', '1'); } catch (e) { /* sin almacenamiento */ }
  const vieneDeTransicion = (() => { try { return sessionStorage.getItem('pa-transicion') === '1'; } catch (e) { return false; } })();

  const cortina = document.createElement('div');
  cortina.className = 'pa-cortina' + (primeraVez ? ' carga' : '') + (primeraVez || vieneDeTransicion ? ' activa' : '');
  cortina.setAttribute('aria-hidden', 'true');
  cortina.innerHTML = `
    <div class="pa-cortina-centro">
      <div class="pa-llama"><span></span><span></span><span></span></div>
      <img src="images/logo_blanco.png" alt="" class="pa-cortina-logo">
      <p class="pa-cortina-texto">Encendiendo las brasas…</p>
    </div>`;
  document.documentElement.append(cortina);

  const abrirCortina = () => {
    try { sessionStorage.removeItem('pa-transicion'); } catch (e) { /* nada */ }
    setTimeout(() => cortina.classList.remove('activa'), primeraVez ? 900 : 150);
  };
  if (document.readyState === 'complete') abrirCortina();
  else window.addEventListener('load', abrirCortina);
  setTimeout(() => cortina.classList.remove('activa'), 3000); // por si alguna imagen tarda
  // al volver con el botón "atrás" del navegador la página viene de memoria: se abre la cortina
  window.addEventListener('pageshow', (e) => { if (e.persisted) cortina.classList.remove('activa', 'saliendo'); });

  document.addEventListener('DOMContentLoaded', () => {
    // ---------- 2. Transición al ir a otra página del sitio ----------
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      const mismaPagina = url.pathname === location.pathname && url.search === location.search;
      if (url.origin !== location.origin || mismaPagina || !/\.html$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      try { sessionStorage.setItem('pa-transicion', '1'); } catch (err) { /* nada */ }
      cortina.classList.remove('carga');
      cortina.classList.add('activa', 'saliendo');
      setTimeout(() => { location.href = url.href; }, 380);
    });

    // ---------- 4. Chispas al hacer clic ----------
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('input, textarea, select, .chat-ventana')) return;
      for (let i = 0; i < 9; i++) {
        const c = document.createElement('span');
        c.className = 'pa-chispa';
        const angulo = (Math.PI * 2 * i) / 9 + Math.random() * 0.5;
        const distancia = 24 + Math.random() * 34;
        c.style.left = `${e.clientX}px`;
        c.style.top = `${e.clientY}px`;
        c.style.setProperty('--x', `${Math.cos(angulo) * distancia}px`);
        c.style.setProperty('--y', `${Math.sin(angulo) * distancia - 14}px`);
        document.body.append(c);
        c.addEventListener('animationend', () => c.remove());
      }
    });

    if (conMouse) {
      // ---------- 3. Cursor propio ----------
      const punto = document.createElement('div');
      const aro = document.createElement('div');
      punto.className = 'pa-cursor-punto';
      aro.className = 'pa-cursor-aro';
      document.body.append(aro, punto);
      document.documentElement.classList.add('con-cursor');
      let mx = -100, my = -100, ax = -100, ay = -100;
      document.addEventListener('mousemove', (e) => {
        mx = e.clientX; my = e.clientY;
        punto.style.transform = `translate(${mx}px, ${my}px)`;
        const sobre = e.target.closest('a, button, [role="button"], label, .parrilla-card, .vino-card, select, [data-lightbox]');
        aro.classList.toggle('grande', !!sobre);
        aro.classList.toggle('texto', !!e.target.closest('input, textarea'));
      });
      document.addEventListener('mouseleave', () => { mx = my = -100; });
      document.addEventListener('mousedown', () => aro.classList.add('presionado'));
      document.addEventListener('mouseup', () => aro.classList.remove('presionado'));
      (function seguir() {
        ax += (mx - ax) * 0.18;
        ay += (my - ay) * 0.18;
        aro.style.transform = `translate(${ax}px, ${ay}px)`;
        requestAnimationFrame(seguir);
      })();

      // ---------- 5. Botones magnéticos ----------
      document.querySelectorAll('.btn-celeste, .submit-button, .chat-lanzador, .social-chip').forEach((boton) => {
        boton.classList.add('pa-magnetico');
        boton.addEventListener('mousemove', (e) => {
          const caja = boton.getBoundingClientRect();
          const x = e.clientX - caja.left - caja.width / 2;
          const y = e.clientY - caja.top - caja.height / 2;
          boton.style.translate = `${x * 0.18}px ${y * 0.28}px`;
        });
        boton.addEventListener('mouseleave', () => { boton.style.translate = ''; });
      });
    }

    // ---------- 6. Carta: ruleta del antojo ----------
    if (document.body.classList.contains('page-menu')) ruleta();
  });

  function ruleta() {
    const fila = document.querySelector('.filters-row');
    if (!fila) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pa-ruleta-btn';
    boton.innerHTML = '<i class="bi bi-dice-5" aria-hidden="true"></i> ¿No sabes qué pedir?';
    fila.append(boton);

    const caja = document.createElement('div');
    caja.className = 'pa-ruleta';
    caja.hidden = true;
    caja.innerHTML = `
      <div class="pa-ruleta-fondo" data-cerrar></div>
      <div class="pa-ruleta-caja" role="dialog" aria-modal="true" aria-labelledby="ruleta-titulo">
        <button type="button" class="pa-ruleta-cerrar" data-cerrar aria-label="Cerrar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        <p class="pa-ruleta-kicker">RULETA DEL ANTOJO</p>
        <h2 id="ruleta-titulo">¿Qué se te antoja hoy?</h2>
        <div class="pa-ruleta-tipos" role="group" aria-label="Tipo de plato">
          <button type="button" class="activo" data-tipo="todo">Sorpréndeme</button>
          <button type="button" data-tipo="parrilla">Parrilla</button>
          <button type="button" data-tipo="platos">Platos</button>
          <button type="button" data-tipo="postres">Postre</button>
          <button type="button" data-tipo="vinos">Vino</button>
        </div>
        <div class="pa-ruleta-ventana" aria-live="polite">
          <img alt="" class="pa-ruleta-foto">
          <div class="pa-ruleta-nombre">Toca girar</div>
          <div class="pa-ruleta-precio"></div>
        </div>
        <div class="pa-ruleta-botones">
          <button type="button" class="btn btn-celeste pa-ruleta-girar"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Girar</button>
          <button type="button" class="pa-ruleta-ver" hidden>Ver este plato →</button>
        </div>
      </div>`;
    document.body.append(caja);
    const foto = caja.querySelector('.pa-ruleta-foto');
    const nombre = caja.querySelector('.pa-ruleta-nombre');
    const precio = caja.querySelector('.pa-ruleta-precio');
    const girar = caja.querySelector('.pa-ruleta-girar');
    const ver = caja.querySelector('.pa-ruleta-ver');
    let tipo = 'todo';
    let elegida = null;

    const tarjetas = () => [...document.querySelectorAll('.parrilla-card, .vino-card')].filter((t) => {
      const cat = t.closest('.menu-block')?.dataset.category;
      return tipo === 'todo' ? cat !== 'vinos' : cat === tipo;
    });
    const mostrarTarjeta = (t) => {
      const img = t.querySelector('img');
      foto.src = img ? img.src : 'images/asador.jpg';
      foto.hidden = false;
      nombre.textContent = t.querySelector('h3').textContent;
      precio.textContent = t.querySelector('.parrilla-price')?.textContent || '';
    };

    caja.querySelectorAll('.pa-ruleta-tipos button').forEach((b) => b.addEventListener('click', () => {
      caja.querySelectorAll('.pa-ruleta-tipos button').forEach((x) => x.classList.toggle('activo', x === b));
      tipo = b.dataset.tipo;
    }));

    girar.addEventListener('click', () => {
      const lista = tarjetas();
      if (!lista.length) return;
      girar.disabled = true;
      ver.hidden = true;
      caja.querySelector('.pa-ruleta-ventana').classList.add('girando');
      let paso = 0;
      const total = 16 + Math.floor(Math.random() * 6);
      const vuelta = () => {
        elegida = lista[Math.floor(Math.random() * lista.length)];
        mostrarTarjeta(elegida);
        paso++;
        if (paso < total) {
          setTimeout(vuelta, 40 + paso * paso * 0.45); // cada vez más lento, como una ruleta
        } else {
          caja.querySelector('.pa-ruleta-ventana').classList.remove('girando');
          caja.querySelector('.pa-ruleta-ventana').classList.add('ganador');
          setTimeout(() => caja.querySelector('.pa-ruleta-ventana').classList.remove('ganador'), 900);
          girar.disabled = false;
          girar.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Otra vez';
          ver.hidden = false;
        }
      };
      vuelta();
    });

    const cerrar = () => { caja.classList.remove('abierta'); setTimeout(() => { caja.hidden = true; }, 220); document.body.classList.remove('sin-scroll'); };
    ver.addEventListener('click', () => {
      cerrar();
      if (elegida) setTimeout(() => { elegida.scrollIntoView({ block: 'center' }); elegida.click(); }, 250);
    });
    caja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !caja.hidden) cerrar(); });
    boton.addEventListener('click', (e) => {
      e.stopPropagation();
      caja.hidden = false;
      document.body.classList.add('sin-scroll');
      requestAnimationFrame(() => caja.classList.add('abierta'));
      girar.focus();
    });
  }
})();
