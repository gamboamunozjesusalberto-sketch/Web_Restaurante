/**
 * ==========================================================================
 * PUNTO ASADO - JAVASCRIPT DEL LOGIN (LOGIN.JS)
 * - Alterna entre "Iniciar sesión" y "Crear cuenta"
 * - Inicia sesión y crea cuentas reales con Supabase Auth
 * - Recuperar contraseña por correo (panel propio)
 * - Ver/ocultar contraseña, aviso de mayúsculas, fuerza de la contraseña,
 *   revisión de cada campo en vivo, recordar correo y pausa tras 5 intentos
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
  function paginaDeRegreso(perfil) {
    const volver = new URLSearchParams(location.search).get('volver') || '';
    if (/^[a-z0-9_-]+\.html(#[a-z0-9_-]+)?$/i.test(volver)) return volver;
    return perfil && perfil.rol === 'admin' ? 'admin.html' : 'cuenta.html';
  }

  function mostrar(texto, tipo = '') {
    feedback.textContent = texto;
    feedback.className = 'form-feedback ' + tipo;
  }

  function cargando(si) {
    submitButton.disabled = si || bloqueadoHasta > Date.now();
    submitButton.classList.toggle('cargando', si);
    if (bloqueadoHasta > Date.now()) return;
    submitLabel.textContent = si
      ? (registering ? 'Creando tu cuenta…' : 'Verificando…')
      : (registering ? 'Crear mi cuenta' : 'Ingresar a mi cuenta');
  }

  // ---------- Muchos intentos fallidos: pausa de 30 segundos ----------
  // (Supabase también limita los intentos; esto avisa antes y evita adivinar claves)
  let fallidos = 0;
  let bloqueadoHasta = 0;
  function bloquear() {
    bloqueadoHasta = Date.now() + 30000;
    submitButton.disabled = true;
    const tic = () => {
      const faltan = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      if (faltan <= 0) {
        fallidos = 0;
        bloqueadoHasta = 0;
        cargando(false);
        mostrar('Ya puedes intentarlo de nuevo.', '');
        return;
      }
      submitLabel.textContent = `Espera ${faltan} s`;
      setTimeout(tic, 1000);
    };
    tic();
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
  const TEXTOS = {
    login: {
      kicker: 'UNA EXPERIENCIA CON SABOR',
      titulo: 'El sabor de<br>volver a <em>encontrarnos.</em>',
      texto: 'Ingresa a tu cuenta para disfrutar de una experiencia más cercana con Punto Asado.'
    },
    registro: {
      kicker: 'SÉ PARTE DE NUESTRA MESA',
      titulo: 'Tu lugar en<br>la parrilla <em>te espera.</em>',
      texto: 'Crear tu cuenta es gratis y toma menos de un minuto. Esto es lo que ganas:'
    }
  };

  function setMode(createAccount) {
    registering = createAccount;
    registerFields.forEach((field) => {
      field.hidden = !registering;
      // los campos ocultos se desactivan para que no bloqueen el envío (ej. un DNI a medias)
      field.querySelectorAll('input').forEach((input) => { input.disabled = !registering; });
    });
    document.querySelectorAll('.login-only').forEach((el) => { el.hidden = registering; });
    document.getElementById('form-tabs').classList.toggle('en-registro', registering);
    // el panel de fotos cambia su mensaje según el modo
    const t = registering ? TEXTOS.registro : TEXTOS.login;
    const contenido = document.querySelector('.showcase-content');
    contenido.classList.remove('cambio');
    void contenido.offsetWidth; // reinicia la animación
    contenido.classList.add('cambio');
    document.getElementById('showcase-kicker').textContent = t.kicker;
    document.getElementById('showcase-title').innerHTML = t.titulo; // texto fijo de este archivo
    document.getElementById('showcase-text').textContent = t.texto;
    document.getElementById('beneficios').hidden = !registering;
    form.classList.remove('cambio');
    void form.offsetWidth;
    form.classList.add('cambio');
    mostrarRecuperar(false);
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

  // Solo números en el DNI
  dniField.addEventListener('input', () => { dniField.value = dniField.value.replace(/\D/g, '').slice(0, 8); });

  // ---------- Ver / ocultar contraseña ----------
  document.querySelectorAll('.ver-clave').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = document.getElementById(boton.getAttribute('aria-controls'));
      const ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      boton.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
      boton.querySelector('i').className = 'bi ' + (ver ? 'bi-eye-slash' : 'bi-eye');
      campo.focus();
    });
  });

  // ---------- Aviso de mayúsculas activadas ----------
  const avisoMayus = document.getElementById('aviso-mayus');
  [passwordField, confirmField].forEach((campo) => {
    campo.addEventListener('keyup', (e) => {
      if (e.getModifierState) avisoMayus.hidden = !e.getModifierState('CapsLock');
    });
    campo.addEventListener('blur', () => { avisoMayus.hidden = true; });
  });

  // ---------- Fuerza de la contraseña (al crear cuenta) ----------
  const REGLAS = {
    largo: (v) => v.length >= 8,
    numero: (v) => /\d/.test(v),
    mayus: (v) => /[A-ZÁÉÍÓÚÑ]/.test(v),
    simbolo: (v) => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(v)
  };
  const relleno = document.getElementById('fuerza-relleno');
  const NIVELES = [
    ['', '#d8cdc1'], ['Muy débil', '#c2453d'], ['Débil', '#d9822b'], ['Buena', '#c9a227'], ['Muy segura', '#2f7a3f']
  ];
  function medirFuerza() {
    const v = passwordField.value;
    let puntos = 0;
    document.querySelectorAll('#fuerza-reglas li').forEach((li) => {
      const ok = REGLAS[li.dataset.regla](v);
      li.classList.toggle('ok', ok);
      if (ok) puntos++;
    });
    const [texto, color] = NIVELES[v ? puntos : 0];
    relleno.style.width = `${(v ? puntos : 0) * 25}%`;
    relleno.style.background = color;
    relleno.dataset.texto = texto;
  }
  passwordField.addEventListener('input', () => { if (registering) medirFuerza(); validarConfirmacion(); });

  // ---------- Revisión en vivo de cada campo ----------
  function ayuda(id, texto, ok) {
    const el = document.getElementById(id);
    el.textContent = texto;
    el.className = 'campo-ayuda' + (texto ? (ok ? ' ok' : ' error') : '');
  }
  function validarConfirmacion() {
    if (!registering || !confirmField.value) return ayuda('ayuda-confirmar', '');
    const igual = confirmField.value === passwordField.value;
    ayuda('ayuda-confirmar', igual ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden', igual);
  }
  confirmField.addEventListener('input', validarConfirmacion);
  dniField.addEventListener('input', () => {
    const n = dniField.value.length;
    ayuda('ayuda-dni', !n ? '' : n === 8 ? '✓ DNI completo' : `Faltan ${8 - n} dígitos`, n === 8);
  });
  phoneField.addEventListener('input', () => {
    const digitos = phoneField.value.replace(/\D/g, '').length;
    ayuda('ayuda-celular', !digitos ? '' : digitos >= 9 ? '✓ Celular válido' : 'El celular tiene 9 dígitos', digitos >= 9);
  });
  emailField.addEventListener('blur', () => {
    const v = emailField.value.trim();
    if (!v) return ayuda('ayuda-email', '');
    // sugerencia para errores comunes al escribir el correo
    const dominio = v.split('@')[1] || '';
    const sugerencias = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com' };
    if (sugerencias[dominio.toLowerCase()]) {
      return ayuda('ayuda-email', `¿Quisiste decir ${v.split('@')[0]}@${sugerencias[dominio.toLowerCase()]}?`, false);
    }
    ayuda('ayuda-email', emailField.checkValidity() ? '' : 'Revisa el correo: falta algo (ej. nombre@correo.com)', false);
  });
  emailField.addEventListener('input', () => ayuda('ayuda-email', ''));

  // ---------- Recordar el correo en este equipo ----------
  const recordar = document.getElementById('recordar-correo');
  try {
    const guardado = localStorage.getItem('pa-correo');
    if (guardado) { emailField.value = guardado; recordar.checked = true; }
  } catch (e) { /* sin almacenamiento: no pasa nada */ }
  function guardarCorreo(email) {
    try {
      if (recordar.checked) localStorage.setItem('pa-correo', email);
      else localStorage.removeItem('pa-correo');
    } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Recuperar contraseña (panel propio) ----------
  const formRecuperar = document.getElementById('form-recuperar');
  const recuperarEmail = document.getElementById('recuperar-email');
  const recuperarFeedback = document.getElementById('recuperar-feedback');
  function mostrarRecuperar(si) {
    formRecuperar.hidden = !si;
    form.hidden = si;
    document.getElementById('form-tabs').hidden = si;
    document.querySelector('.switch-copy').hidden = si;
    document.getElementById('form-title').textContent = si ? 'Recupera tu acceso' : (registering ? 'Crea tu cuenta' : 'Qué gusto verte');
    document.getElementById('form-subtitle').textContent = si
      ? 'Te ayudamos a crear una contraseña nueva.'
      : (registering ? 'Completa tus datos y sé parte de nuestra mesa.' : 'Ingresa tus datos para acceder a tu cuenta.');
    if (si) {
      recuperarEmail.value = emailField.value;
      recuperarFeedback.textContent = '';
      recuperarFeedback.className = 'form-feedback';
      formRecuperar.classList.remove('cambio');
      void formRecuperar.offsetWidth;
      formRecuperar.classList.add('cambio');
      recuperarEmail.focus();
    }
  }
  document.getElementById('volver-login').addEventListener('click', () => mostrarRecuperar(false));

  // login.html#registro abre directo en "Crear cuenta"
  setMode(location.hash === '#registro');

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
  document.getElementById('forgot-password').addEventListener('click', (event) => {
    event.preventDefault();
    mostrarRecuperar(true);
  });
  formRecuperar.addEventListener('submit', async (event) => {
    event.preventDefault();
    const correo = recuperarEmail.value.trim();
    if (!correo || !recuperarEmail.checkValidity()) {
      recuperarEmail.focus();
      recuperarFeedback.textContent = 'Escribe un correo válido.';
      recuperarFeedback.className = 'form-feedback error';
      return;
    }
    const boton = formRecuperar.querySelector('.submit-button');
    boton.disabled = true;
    boton.classList.add('cargando');
    const destino = new URL('cuenta.html', location.href).href;
    const { error } = await db.auth.resetPasswordForEmail(correo, { redirectTo: destino });
    boton.disabled = false;
    boton.classList.remove('cargando');
    recuperarFeedback.textContent = error
      ? traducirError(error)
      : `Listo. Si ${correo} tiene una cuenta, te llegará un correo en unos minutos (revisa también spam).`;
    recuperarFeedback.className = 'form-feedback ' + (error ? 'error' : 'ok');
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
    if (registering && Object.values(REGLAS).filter((r) => r(passwordField.value)).length < 2) {
      passwordField.setCustomValidity('Tu contraseña es muy débil: agrégale un número o una mayúscula.');
      passwordField.reportValidity();
      passwordField.addEventListener('input', () => passwordField.setCustomValidity(''), { once: true });
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
      fallidos++;
      const panel = document.querySelector('.login-panel');
      panel.classList.remove('sacudir');
      void panel.offsetWidth;
      panel.classList.add('sacudir');
      if (fallidos >= 5) {
        bloquear();
        return mostrar('Demasiados intentos fallidos. Espera 30 segundos o usa "¿La olvidaste?".', 'error');
      }
      return mostrar(traducirError(error) + (fallidos >= 3 ? ` Te quedan ${5 - fallidos} intentos.` : ''), 'error');
    }
    guardarCorreo(email);
    Sesion._perfil = undefined;
    submitButton.classList.add('exito');
    submitLabel.textContent = '¡Bienvenido de vuelta!';
    mostrar('');
    window.location.href = paginaDeRegreso(await Sesion.perfil());
  });
})();

// Chispas de brasa en el panel de fotos (solo decoración; se apaga con "reducir movimiento")
(() => {
  const lienzo = document.querySelector('.showcase-chispas');
  if (!lienzo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = lienzo.getContext('2d');
  const caja = lienzo.parentElement;
  let w = 0, h = 0;
  const medir = () => {
    const e = Math.min(window.devicePixelRatio || 1, 2);
    w = caja.clientWidth; h = caja.clientHeight;
    lienzo.width = w * e; lienzo.height = h * e;
    ctx.setTransform(e, 0, 0, e, 0, 0);
  };
  medir();
  window.addEventListener('resize', medir);
  const nueva = (y) => ({ x: Math.random() * w, y: y ?? h + 10, r: 0.8 + Math.random() * 2, vy: 0.4 + Math.random() * 1.1, f: Math.random() * 6.3 });
  const chispas = Array.from({ length: 34 }, () => nueva(Math.random() * h));
  (function dibujar() {
    ctx.clearRect(0, 0, w, h);
    chispas.forEach((c, i) => {
      c.f += 0.03; c.y -= c.vy; c.x += Math.sin(c.f) * 0.4;
      if (c.y < -10) chispas[i] = nueva();
      const vida = Math.max(0, c.y / h);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 4);
      g.addColorStop(0, `rgba(255, 200, 120, ${0.85 * vida + 0.1})`);
      g.addColorStop(1, 'rgba(255, 90, 20, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 4, 0, Math.PI * 2); ctx.fill();
    });
    requestAnimationFrame(dibujar);
  })();
})();
