/**
 * ==========================================================================
 * PUNTO ASADO - CONEXIÓN CON SUPABASE (SUPABASE-CONFIG.JS)
 * Aquí van la dirección del proyecto y la clave pública (anon key).
 * Se encuentran en Supabase → Project Settings → API.
 *
 * La anon key es PÚBLICA: está pensada para ir en el navegador. La seguridad
 * la ponen las reglas RLS de la base de datos (ver supabase/esquema.sql).
 * NUNCA pongas aquí la clave "service_role".
 * ==========================================================================
 */

'use strict';

const SUPABASE_URL = 'https://nxqwohvkiemvtnfmbumi.supabase.co';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_LA_ANON_KEY';

// Si todavía no se pegaron los datos, el sitio funciona igual pero sin cuentas.
const db = (SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('PEGA') && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
