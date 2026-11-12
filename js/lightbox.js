/**
 * ==========================================================================
 * PUNTO ASADO - LIGHTBOX / VISOR DE FOTOS (LIGHTBOX.JS)
 * Cualquier contenedor con el atributo [data-lightbox] se vuelve galería:
 * al hacer clic en una foto se abre en grande, con flechas, teclado
 * (← → Esc) y deslizando el dedo en el celular.
 * Lo usan: index.html (galería) y nosotros.html (ambientes).
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const galerias = document.querySelectorAll('[data-lightbox]');
  if (!galerias.length) return;

  // ---------- Se crea el visor una sola vez ----------
  const visor = document.createElement('div');
  visor.className = 'lightbox';
  visor.hidden = true;
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-modal', 'true');
  visor.setAttribute('aria-label', 'Visor de fotos');
  visor.innerHTML = `
    <button type="button" class="lightbox-cerrar" aria-label="Cerrar">&times;</button>
    <button type="button" class="lightbox-flecha lightbox-prev" aria-label="Foto anterior">&#8249;</button>
    <figure class="lightbox-figura">
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <button type="button" class="lightbox-flecha lightbox-next" aria-label="Foto siguiente">&#8250;</button>
    <span class="lightbox-contador"></span>`;
  document.body.append(visor);

  const img = visor.querySelector('img');
  const texto = visor.querySelector('figcaption');
  const contador = visor.querySelector('.lightbox-contador');
  let fotos = [];
  let actual = 0;
  let ultimoFoco = null;

  function mostrar(indice) {
    actual = (indice + fotos.length) % fotos.length; // da la vuelta al llegar al final
    const foto = fotos[actual];
    img.classList.remove('entrando');
    void img.offsetWidth; // reinicia la animación
    img.src = foto.currentSrc || foto.src;
    img.alt = foto.alt;
    const caption = foto.closest('figure')?.querySelector('figcaption');
    texto.textContent = caption ? caption.textContent : foto.alt;
    contador.textContent = `${actual + 1} / ${fotos.length}`;
    img.classList.add('entrando');
  }

  function abrir(galeria, foto) {
    // solo las fotos visibles de esa galería (por si hay pestañas ocultas)
    fotos = [...galeria.querySelectorAll('img')].filter((f) => f.offsetParent !== null);
    ultimoFoco = document.activeElement;
    visor.hidden = false;
    document.body.classList.add('sin-scroll');
    mostrar(fotos.indexOf(foto));
    visor.querySelector('.lightbox-cerrar').focus();
  }

  function cerrar() {
    visor.hidden = true;
    document.body.classList.remove('sin-scroll');
    if (ultimoFoco) ultimoFoco.focus();
  }

  // ---------- Eventos ----------
  galerias.forEach((galeria) => {
    galeria.querySelectorAll('img').forEach((foto) => {
      const figura = foto.closest('figure') || foto;
      figura.tabIndex = 0; // se puede abrir también con el teclado
      figura.setAttribute('role', 'button');
      figura.setAttribute('aria-label', 'Ver foto: ' + foto.alt);
      figura.addEventListener('click', () => abrir(galeria, foto));
      figura.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(galeria, foto); }
      });
    });
  });

  visor.querySelector('.lightbox-cerrar').addEventListener('click', cerrar);
  visor.querySelector('.lightbox-prev').addEventListener('click', () => mostrar(actual - 1));
  visor.querySelector('.lightbox-next').addEventListener('click', () => mostrar(actual + 1));
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrar(); }); // clic en el fondo

  document.addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
  });

  // deslizar con el dedo (celular)
  let inicioX = null;
  visor.addEventListener('touchstart', (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener('touchend', (e) => {
    if (inicioX === null) return;
    const diferencia = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(diferencia) > 50) mostrar(actual + (diferencia < 0 ? 1 : -1));
    inicioX = null;
  });
});
