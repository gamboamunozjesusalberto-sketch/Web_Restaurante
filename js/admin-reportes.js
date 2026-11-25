/**
 * ==========================================================================
 * PUNTO ASADO - DESCARGAR REPORTES DEL PANEL (ADMIN-REPORTES.JS)
 * - Reservas, clientes y platos más pedidos en Excel (.csv con ";" y tildes,
 *   como lo abre Excel en español).
 * - Resumen del periodo en PDF: arma una hoja simple y abre la ventana de
 *   impresión del navegador ("Guardar como PDF").
 * Todo sale de Supabase con la sesión del admin (RLS solo deja leer todo
 * al rol admin). No se usan librerías externas.
 * ==========================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const caja = document.getElementById('reportes');
  if (!caja || !db) return;
  const perfil = await Sesion.perfil();
  if (!perfil || perfil.rol !== 'admin') return;

  const desde = document.getElementById('rep-desde');
  const hasta = document.getElementById('rep-hasta');
  const aviso = document.getElementById('rep-aviso');
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  const hoy = new Date();
  desde.value = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); // desde el 1 del mes
  hasta.value = aISO(hoy);

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', atendida: 'Atendida', no_vino: 'No vino', rechazada: 'Rechazada', cancelada: 'Cancelada', vencida: 'Vencida' };
  const fechaBonita = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const lista = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

  function mostrar(texto, error) {
    aviso.textContent = texto;
    aviso.classList.toggle('error', !!error);
  }

  function rango() {
    if (!desde.value || !hasta.value) throw new Error('Elige las dos fechas.');
    if (desde.value > hasta.value) throw new Error('"Desde" no puede ser después de "Hasta".');
    return { d: desde.value, h: hasta.value, nombre: `${desde.value}_a_${hasta.value}` };
  }

  // ---------- Excel (.csv) ----------
  // Una celda que empieza con = + - @ se toma como fórmula en Excel: se le pone ' delante
  const celda = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function descargarCSV(nombre, columnas, filas) {
    const texto = [columnas, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }); // BOM: Excel lee bien las tildes
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 2000);
  }

  async function traerReservas(r) {
    const { data, error } = await db.from('reservas')
      .select('*, perfiles!usuario_id(nombre, telefono)')
      .gte('fecha', r.d).lte('fecha', r.h)
      .order('fecha').order('hora');
    if (error) throw new Error('No se pudieron leer las reservas.');
    return data || [];
  }

  const reportes = {
    async reservas() {
      const r = rango();
      const datos = await traerReservas(r);
      if (!datos.length) return mostrar('No hay reservas entre esas fechas.');
      descargarCSV(`reservas_${r.nombre}.csv`,
        ['Fecha', 'Día', 'Hora', 'Cliente', 'Celular', 'Personas', 'Ocasión', 'Paquete', 'Ubicación', 'Mesa', 'Mesas juntadas', 'Estado', 'Piensa pedir', 'Preferencias', 'Mensaje', 'Origen', 'Creada el'],
        datos.map((x) => [
          fechaBonita(x.fecha), DIAS[new Date(x.fecha + 'T12:00').getDay()], (x.hora || '').slice(0, 5),
          x.perfiles?.nombre || '', x.perfiles?.telefono || '', x.personas, x.tipo, x.paquete || '', x.ubicacion,
          x.mesa || '', lista(x.mesas_extra), ESTADOS[x.estado] || x.estado, lista(x.pedido), lista(x.preferencias),
          x.mensaje || '', x.origen || 'web', x.creado_en ? new Date(x.creado_en).toLocaleString('es-PE') : ''
        ]));
      mostrar(`Listo: ${datos.length} reservas descargadas.`);
    },

    async clientes() {
      const [cli, res] = await Promise.all([
        db.from('perfiles').select('id, nombre, telefono, acepta_promos, creado_en').eq('rol', 'cliente').order('creado_en', { ascending: false }),
        db.from('reservas').select('usuario_id, estado, fecha')
      ]);
      if (cli.error) throw new Error('No se pudieron leer los clientes.');
      const porCliente = new Map();
      (res.data || []).forEach((x) => {
        const c = porCliente.get(x.usuario_id) || { total: 0, vino: 0, falto: 0, ultima: '' };
        if (!['cancelada', 'rechazada'].includes(x.estado)) c.total++;
        if (x.estado === 'atendida') c.vino++;
        if (x.estado === 'no_vino') c.falto++;
        if (x.fecha > c.ultima) c.ultima = x.fecha;
        porCliente.set(x.usuario_id, c);
      });
      const datos = cli.data || [];
      if (!datos.length) return mostrar('Todavía no hay clientes registrados.');
      descargarCSV(`clientes_${aISO(hoy)}.csv`,
        ['Cliente', 'Celular', 'Acepta promociones', 'Registrado el', 'Reservas', 'Vino', 'No vino', 'Última reserva'],
        datos.map((c) => {
          const e = porCliente.get(c.id) || { total: 0, vino: 0, falto: 0, ultima: '' };
          return [c.nombre, c.telefono || '', c.acepta_promos ? 'Sí' : 'No', c.creado_en ? fechaBonita(c.creado_en.slice(0, 10)) : '', e.total, e.vino, e.falto, fechaBonita(e.ultima)];
        }));
      mostrar(`Listo: ${datos.length} clientes descargados (todos, sin importar las fechas).`);
    },

    async platos() {
      const r = rango();
      const datos = (await traerReservas(r)).filter((x) => !['cancelada', 'rechazada'].includes(x.estado));
      const cuenta = new Map();
      datos.forEach((x) => (x.pedido || []).forEach((p) => cuenta.set(p, (cuenta.get(p) || 0) + 1)));
      if (!cuenta.size) return mostrar('Nadie anotó platos en sus reservas entre esas fechas.');
      const carta = typeof CARTA !== 'undefined' ? CARTA : [];
      const filas = [...cuenta].sort((a, b) => b[1] - a[1]).map(([nombre, n], i) => {
        const p = carta.find((c) => c.nombre === nombre);
        return [i + 1, nombre, p ? p.categoria : '', n];
      });
      descargarCSV(`platos_mas_pedidos_${r.nombre}.csv`, ['Puesto', 'Plato', 'Categoría', 'Veces pedido'], filas);
      mostrar(`Listo: ${filas.length} platos en el reporte.`);
    },

    async pdf() {
      const r = rango();
      const todas = await traerReservas(r);
      const validas = todas.filter((x) => !['cancelada', 'rechazada'].includes(x.estado));
      const contar = (arr, clave) => {
        const m = new Map();
        arr.forEach((x) => { const k = clave(x); if (k) m.set(k, (m.get(k) || 0) + 1); });
        return [...m].sort((a, b) => b[1] - a[1]);
      };
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const tabla = (titulo, cols, filas) => `<h2>${esc(titulo)}</h2>` + (filas.length
        ? `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : '<p class="vacio">Sin datos en este periodo.</p>');
      const personas = validas.reduce((s, x) => s + (x.personas || 0), 0);
      const cerradas = todas.filter((x) => ['atendida', 'no_vino'].includes(x.estado));
      const faltas = cerradas.filter((x) => x.estado === 'no_vino').length;
      const kpis = [
        ['Reservas', validas.length], ['Personas', personas],
        ['Promedio por mesa', validas.length ? (personas / validas.length).toFixed(1) : '0'],
        ['No se presentaron', cerradas.length ? `${Math.round((faltas / cerradas.length) * 100)}%` : '—']
      ];
      const ordenDias = [1, 2, 3, 4, 5, 6, 0];
      const porDia = contar(validas, (x) => DIAS[new Date(x.fecha + 'T12:00').getDay()])
        .sort((a, b) => ordenDias.indexOf(DIAS.indexOf(a[0])) - ordenDias.indexOf(DIAS.indexOf(b[0])));
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte Punto Asado ${esc(r.nombre)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #2a1c13; font-size: 11pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #75c5f0; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 20pt; } header p { margin: 0; color: #6b5d52; font-size: 9.5pt; text-align: right; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; color: #8a3b12; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid #e6dccf; border-radius: 8px; padding: 8px 10px; } .kpi b { display: block; font-size: 16pt; } .kpi span { color: #6b5d52; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; page-break-inside: auto; } tr { page-break-inside: avoid; }
  th { background: #2a1c13; color: #fff; text-align: left; padding: 5px 6px; } td { border-bottom: 1px solid #e6dccf; padding: 4px 6px; }
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .vacio { color: #6b5d52; }
  footer { margin-top: 18px; color: #6b5d52; font-size: 8.5pt; }
</style></head><body>
<header><h1>Punto Asado · Reporte</h1><p>Del ${fechaBonita(r.d)} al ${fechaBonita(r.h)}<br>Generado el ${new Date().toLocaleString('es-PE')} por ${esc(perfil.nombre || 'admin')}</p></header>
<div class="kpis">${kpis.map(([t, v]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(t)}</span></div>`).join('')}</div>
<div class="dos"><div>${tabla('Reservas por estado', ['Estado', 'Cantidad'], contar(todas, (x) => ESTADOS[x.estado] || x.estado))}</div>
<div>${tabla('Reservas por día', ['Día', 'Cantidad'], porDia)}</div></div>
<div class="dos"><div>${tabla('Horas con más reservas', ['Hora', 'Cantidad'], contar(validas, (x) => (x.hora || '').slice(0, 5)).slice(0, 8))}</div>
<div>${tabla('Platos más pedidos', ['Plato', 'Veces'], contar(validas.flatMap((x) => x.pedido || []), (p) => p).slice(0, 10))}</div></div>
${tabla('Paquetes', ['Paquete', 'Reservas'], contar(validas, (x) => x.paquete))}
${tabla('Detalle de reservas', ['Fecha', 'Hora', 'Cliente', 'Pers.', 'Mesa', 'Estado'], todas.map((x) => [fechaBonita(x.fecha), (x.hora || '').slice(0, 5), x.perfiles?.nombre || '', x.personas, [x.mesa, ...(x.mesas_extra || [])].filter(Boolean).join('+'), ESTADOS[x.estado] || x.estado]))}
<footer>Cuenta como reservas las pendientes, confirmadas, atendidas, no vino y vencidas; no las canceladas ni rechazadas. "No se presentaron" compara las que no vinieron con las ya cerradas (atendidas + no vino).</footer>
</body></html>`;
      // se imprime desde un marco oculto: no lo bloquea el bloqueador de ventanas
      const marco = document.createElement('iframe');
      marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.append(marco);
      marco.srcdoc = html;
      marco.onload = () => {
        marco.contentWindow.focus();
        marco.contentWindow.print();
        setTimeout(() => marco.remove(), 60000);
      };
      mostrar('Se abrió la ventana de impresión: en "Destino" elige "Guardar como PDF".');
    }
  };

  caja.querySelectorAll('.reporte-btn').forEach((boton) => {
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      mostrar('Preparando el reporte…');
      try {
        await reportes[boton.dataset.reporte]();
      } catch (e) {
        mostrar(e.message || 'No se pudo generar el reporte.', true);
      } finally {
        boton.disabled = false;
      }
    });
  });
});
