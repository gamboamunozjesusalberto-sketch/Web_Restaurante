/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DEL LOGIN (LOGIN.JS)
 * Alterna entre "Iniciar sesión" y "Crear cuenta".
 * Es una demostración visual: no valida ni guarda cuentas reales.
 * (Antes estaba escrito dentro de login.html.)
 * ==========================================================================
 */

(() => {
  const form = document.getElementById('client-form');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const switchMode = document.getElementById('switch-mode');
  const registerFields = document.querySelectorAll('.register-only');
  const nameField = document.getElementById('client-name');
  const confirmField = document.getElementById('client-confirm');
  const passwordField = document.getElementById('client-password');
  const feedback = document.getElementById('form-feedback');
  let registering = false;

  function setMode(createAccount) {
    registering = createAccount;
    registerFields.forEach((field) => { field.hidden = !registering; });
    nameField.required = registering;
    confirmField.required = registering;
    passwordField.autocomplete = registering ? 'new-password' : 'current-password';
    loginTab.classList.toggle('is-active', !registering);
    registerTab.classList.toggle('is-active', registering);
    loginTab.setAttribute('aria-selected', String(!registering));
    registerTab.setAttribute('aria-selected', String(registering));
    document.getElementById('form-title').textContent = registering ? 'Crea tu cuenta' : 'Qué gusto verte';
    document.getElementById('form-subtitle').textContent = registering ? 'Completa tus datos y sé parte de nuestra mesa.' : 'Ingresa tus datos para acceder a tu cuenta.';
    document.getElementById('submit-label').textContent = registering ? 'Crear mi cuenta' : 'Ingresar a mi cuenta';
    document.getElementById('switch-question').textContent = registering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes una cuenta?';
    switchMode.textContent = registering ? 'Inicia sesión' : 'Regístrate aquí';
    document.getElementById('remember-text').textContent = registering ? 'Acepto recibir novedades de Punto Asado' : 'Recordar mi sesión en este dispositivo';
    document.getElementById('forgot-password').hidden = registering;
    feedback.textContent = '';
  }
  loginTab.addEventListener('click', () => setMode(false));
  registerTab.addEventListener('click', () => setMode(true));
  switchMode.addEventListener('click', () => setMode(!registering));
  document.getElementById('forgot-password').addEventListener('click', (event) => {
    event.preventDefault();
    feedback.textContent = 'La recuperación de contraseña estará disponible cuando se conecte el sistema de cuentas.';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (registering && passwordField.value !== confirmField.value) {
      confirmField.setCustomValidity('Las contraseñas no coinciden.');
      confirmField.reportValidity();
      confirmField.addEventListener('input', () => confirmField.setCustomValidity(''), { once: true });
      return;
    }
    feedback.textContent = registering ? 'Diseño de registro listo. Para crear cuentas reales, se necesita conectar un sistema de autenticación.' : 'Diseño de inicio de sesión listo. La validación real se implementará al conectar el sistema de cuentas.';
  });
})();
