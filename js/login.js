/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DEL LOGIN (LOGIN.JS)
 * - Alterna entre "Iniciar sesión" y "Crear cuenta"
 * - Inicia sesión y crea cuentas reales con Supabase Auth
 * - Recuperar contraseña por correo
 * Las contraseñas las cifra Supabase: nunca se guardan en texto plano.
 * ==========================================================================
 */

'use strict';

(() => {
  const form = document.getElementById('client-form');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const switchMode = document.getElementById('switch-mode');
  const registerFields = document.querySelectorAll('.register-only');
  const nameField = document.getElementById('client-name');
  const dniField = document.getElementById('client-dni');
  const phoneField = document.getElementById('client-phone');
  const emailField = document.getElementById('client-email');
  const passwordField = document.getElementById('client-password');
  const confirmField = document.getElementById('client-confirm');
  const submitButton = document.getElementById('submit-button');
  const submitLabel = document.getElementById('submit-label');
  const feedback = document.getElementById('form-feedback');
  let registering = false;

  // ---------- A dónde ir después de entrar ----------
  // Solo se aceptan páginas propias (ej. "contacto.html#reserva"), nunca otra web.
  function paginaDeRegreso() {
    const volver = new URLSearchParams(location.search).get('volver') || '';
    if (/^[a-z0-9_-]+\.html(#[a-z0-9_-]+)?$/i.test(volver)) return volver;
    return 'cuenta.html'; // (el panel de admin llega en la siguiente fase)
  }

  function mostrar(texto, tipo = '') {
    feedback.textContent = texto;
    feedback.className = 'form-feedback ' + tipo;
  }

  function cargando(si) {
    submitButton.disabled = si;
    submitLabel.textContent = si
      ? 'Un momento…'
      : (registering ? 'Crear mi cuenta' : 'Ingresar a mi cuenta');
  }

  // Mensajes de Supabase traducidos al español
  function traducirError(error) {
    const m = (error && error.message || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (m.includes('email not confirmed')) return 'Primero confirma tu correo: revisa tu bandeja de entrada (y la de spam).';
    if (m.includes('already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    if (m.includes('password should be')) return 'La contraseña es muy débil: usa al menos 8 caracteres.';
    if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (m.includes('fetch')) return 'No hay conexión con el servidor. Revisa tu internet.';
    return 'Ocurrió un error: ' + (error && error.message || 'inténtalo de nuevo.');
  }

  // ---------- Cambiar entre iniciar sesión y crear cuenta ----------
  function setMode(createAccount) {
    registering = createAccount;
    registerFields.forEach((field) => { field.hidden = !registering; });
    nameField.required = registering;
    dniField.required = registering;
    phoneField.required = registering;
    confirmField.required = registering;
    passwordField.autocomplete = registering ? 'new-password' : 'current-password';
    loginTab.classList.toggle('is-active', !registering);
    registerTab.classList.toggle('is-active', registering);
    loginTab.setAttribute('aria-selected', String(!registering));
    registerTab.setAttribute('aria-selected', String(registering));
    document.getElementById('form-title').textContent = registering ? 'Crea tu cuenta' : 'Qué gusto verte';
    document.getElementById('form-subtitle').textContent = registering ? 'Completa tus datos y sé parte de nuestra mesa.' : 'Ingresa tus datos para acceder a tu cuenta.';
    document.getElementById('switch-question').textContent = registering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes una cuenta?';
    switchMode.textContent = registering ? 'Inicia sesión' : 'Regístrate aquí';
    document.getElementById('forgot-password').hidden = registering;
    cargando(false);
    mostrar('');
  }
  loginTab.addEventListener('click', () => setMode(false));
  registerTab.addEventListener('click', () => setMode(true));
  switchMode.addEventListener('click', () => setMode(!registering));
  if (location.hash === '#registro') setMode(true);

  // Solo números en el DNI
  dniField.addEventListener('input', () => { dniField.value = dniField.value.replace(/\D/g, '').slice(0, 8); });

  // Si el sitio aún no está conectado a Supabase, se avisa y no se envía nada
  if (!db) {
    mostrar('Las cuentas todavía no están conectadas (falta configurar js/supabase-config.js).', 'error');
    form.addEventListener('submit', (event) => event.preventDefault());
    return;
  }

  // Si ya tiene sesión, no tiene sentido mostrar el login
  Sesion.perfil().then((perfil) => {
    if (perfil) window.location.replace(paginaDeRegreso(perfil));
  });

  // ---------- Recuperar contraseña ----------
  document.getElementById('forgot-password').addEventListener('click', async (event) => {
    event.preventDefault();
    if (!emailField.value || !emailField.checkValidity()) {
      emailField.focus();
      mostrar('Escribe tu correo arriba y vuelve a presionar "¿La olvidaste?".', 'error');
      return;
    }
    const destino = new URL('cuenta.html', location.href).href;
    const { error } = await db.auth.resetPasswordForEmail(emailField.value.trim(), { redirectTo: destino });
    mostrar(error ? traducirError(error) : 'Te enviamos un correo con un enlace para crear una nueva contraseña.', error ? 'error' : 'ok');
  });

  // ---------- Enviar el formulario ----------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (registering && passwordField.value !== confirmField.value) {
      confirmField.setCustomValidity('Las contraseñas no coinciden.');
      confirmField.reportValidity();
      confirmField.addEventListener('input', () => confirmField.setCustomValidity(''), { once: true });
      return;
    }
    if (!form.reportValidity()) return;

    const email = emailField.value.trim().toLowerCase();
    const password = passwordField.value;
    cargando(true);

    if (registering) {
      // Los datos extra viajan como "metadata" y la base de datos crea el perfil (trigger crear_perfil)
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL('cuenta.html', location.href).href,
          data: {
            nombre: nameField.value.trim(),
            dni: dniField.value.trim(),
            telefono: phoneField.value.trim(),
            acepta_promos: form.elements.acepta_promos.checked
          }
        }
      });
      cargando(false);
      if (error) return mostrar(traducirError(error), 'error');

      // Si Supabase pide confirmar el correo, todavía no hay sesión
      if (!data.session) {
        form.reset();
        return mostrar('¡Cuenta creada! Te enviamos un correo: confirma tu cuenta y luego inicia sesión.', 'ok');
      }
      Sesion._perfil = undefined;
      window.location.href = paginaDeRegreso(await Sesion.perfil());
      return;
    }

    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      cargando(false);
      return mostrar(traducirError(error), 'error');
    }
    Sesion._perfil = undefined;
    mostrar('¡Bienvenido de vuelta!', 'ok');
    window.location.href = paginaDeRegreso(await Sesion.perfil());
  });
})();
