/**
 * ==========================================================================
 * PUNTO ASADO - SESIÓN DEL USUARIO (SESION.JS)
 * Se carga en todas las páginas, después de supabase-config.js.
 * - Funciones para saber quién inició sesión y leer su perfil
 * - Cambia el botón "Ingresar" de la barra por el menú de la cuenta
 *   (nombre, campanita de notificaciones y cerrar sesión)
 * ==========================================================================
 */

'use strict';

const Sesion = {
  _perfil: undefined,

  // Usuario con sesión iniciada, o null
  async usuario() {
    if (!db) return null;
    const { data } = await db.auth.getSession();
    return data.session ? data.session.user : null;
  },

  // Fila de la tabla "perfiles" del usuario (nombre, dni, telefono, rol...)
  async perfil() {
    if (this._perfil !== undefined) return this._perfil;
    const usuario = await this.usuario();
    if (!usuario) return (this._perfil = null);
    const { data, error } = await db.from('perfiles').select('*').eq('id', usuario.id).single();
    this._perfil = error ? null : { ...data, email: usuario.email };
    return this._perfil;
  },

  async notificacionesSinLeer() {
    const usuario = await this.usuario();
    if (!usuario) return 0;
    const { count } = await db.from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuario.id)
      .eq('leida', false);
    return count || 0;
  },

  async cerrar() {
    if (db) await db.auth.signOut();
    window.location.href = 'index.html';
  },

  // Manda a login.html si no hay sesión; al volver, regresa a esta página
  async exigir() {
    const usuario = await this.usuario();
    if (!usuario) {
      const volver = encodeURIComponent(location.pathname.split('/').pop() + location.hash);
      window.location.replace('login.html?volver=' + volver);
    }
    return usuario;
  }
};

// ---------- Botón de cuenta en la barra de navegación ----------
document.addEventListener('DOMContentLoaded', async () => {
  const botonIngresar = document.querySelector('.navbar-rustic .btn-login-nav');
  if (!botonIngresar) return;

  const perfil = await Sesion.perfil();
  if (!perfil) return; // sin sesión: se queda "Ingresar"

  const sinLeer = await Sesion.notificacionesSinLeer();
  const primerNombre = perfil.nombre.split(' ')[0];

  const item = botonIngresar.closest('.nav-item');
  item.classList.add('dropdown');
  item.innerHTML = `
    <a class="nav-link btn-login-nav dropdown-toggle" href="#" role="button"
       data-bs-toggle="dropdown" aria-expanded="false">
      <i class="bi bi-person-circle me-1" aria-hidden="true"></i><span class="nav-nombre"></span>
      <span class="nav-badge" hidden></span>
    </a>
    <ul class="dropdown-menu dropdown-menu-end dropdown-cuenta">
      <li><a class="dropdown-item" href="cuenta.html"><i class="bi bi-person me-2"></i>Mi cuenta</a></li>
      <li><a class="dropdown-item" href="cuenta.html#mis-reservas"><i class="bi bi-calendar-check me-2"></i>Mis reservas</a></li>
      <li><a class="dropdown-item" href="cuenta.html#notificaciones"><i class="bi bi-bell me-2"></i>Notificaciones <span class="nav-badge-item"></span></a></li>
      <li><hr class="dropdown-divider"></li>
      <li><button class="dropdown-item" type="button" data-cerrar-sesion><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</button></li>
    </ul>`;

  // El nombre se pone con textContent (nunca con innerHTML) para evitar inyección de código
  item.querySelector('.nav-nombre').textContent = primerNombre;
  if (sinLeer > 0) {
    const badge = item.querySelector('.nav-badge');
    badge.textContent = sinLeer;
    badge.hidden = false;
    item.querySelector('.nav-badge-item').textContent = `(${sinLeer})`;
  }

  item.querySelector('[data-cerrar-sesion]').addEventListener('click', () => Sesion.cerrar());
});
