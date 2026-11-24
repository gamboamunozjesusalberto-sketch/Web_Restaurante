/**
 * ==========================================================================
 * PUNTO ASADO - DATOS COMPARTIDOS (CARTA-DATOS.JS)
 * Lista de platos de la carta y paquetes de reserva. La usan:
 * - contacto.js: elegir paquete y "¿qué piensas pedir?"
 * - chatbot.js: recomendar platos, explicar la cocción y los paquetes
 * Si cambian la carta (menu.html), actualicen también esta lista.
 * ==========================================================================
 */

'use strict';

const HORARIO = {
  // 0 = domingo ... 6 = sábado
  apertura: (dia) => (dia === 0 || dia === 6 ? '12:00' : '18:00'),
  cierre: '23:00',
  ultimaReserva: '21:30', // cada reserva ocupa la mesa 2 horas: la última termina a las 11:30 p. m.
  texto: 'Lunes a viernes de 6:00 p. m. a 11:00 p. m.; sábados y domingos de 12:00 m. a 11:00 p. m.'
};

const PAQUETES = [
  {
    id: 'Cumpleañero',
    icono: 'bi-cake2',
    resumen: 'Mesa decorada, postre con vela y la canción del equipo.',
    min: 2, max: 10
  },
  {
    id: 'Parrilla en vivo',
    icono: 'bi-fire',
    resumen: 'Nuestro asador prepara los cortes frente a tu mesa y te explica cada uno.',
    min: 4, max: 10
  },
  {
    id: 'Empresarial',
    icono: 'bi-briefcase',
    resumen: 'Mesa para reuniones de trabajo con menú para el grupo.',
    min: 8, max: 30
  },
  {
    id: 'Segundo piso exclusivo',
    icono: 'bi-building',
    resumen: 'Todo el segundo piso solo para tu evento (uno por día).',
    min: 15, max: 40
  }
];

// categoria: entradas | parrilla | platos | postres | vinos
// imagen: foto que usa menu.html (null = todavía sin foto; el admin la sube desde el Panel)
// coccion: cómo se prepara (sale de la descripción de la carta)
const CARTA = [
  { nombre: 'Empanadas Argentinas', categoria: 'entradas', precio: 19, coccion: 'Fritas, rellenas de carne molida clásica.', imagen: 'images/empanadasArgentinas.jpeg' },
  { nombre: 'Empanadas Angus', categoria: 'entradas', precio: 26, coccion: 'Carne Angus picada a cuchillo con cebolla y especias.', imagen: 'images/empanadasAngus.jpeg' },
  { nombre: 'Provoleta Perfecta', categoria: 'entradas', precio: 35, coccion: 'Queso provoleta a la parrilla con orégano, servido con pan de la casa.', imagen: 'images/provoleta.jpg' },
  { nombre: 'Papas Patagonia', categoria: 'entradas', precio: 32, coccion: 'Papas fritas con queso cheddar, tocino y cebolla china.', imagen: 'images/papasPatagonia.jpeg' },
  { nombre: 'Mollejas de Res', categoria: 'entradas', precio: 42, coccion: 'Asadas a fuego vivo en la parrilla y terminadas al limón.', imagen: 'images/mollejas_de_Res.jpeg' },
  { nombre: 'Trilogía de Chorizos', categoria: 'entradas', precio: 39, coccion: 'Chorizo clásico, de ají limo y de ají charapita, a la parrilla.', imagen: 'images/trilogia_chorizo.jpeg' },
  { nombre: 'Bife de Chorizo', categoria: 'parrilla', precio: 68, coccion: 'Madurado 21 días y asado a la parrilla con sal marina. Recomendado a punto.', imagen: 'images/bife_chorizo_angus_1788925448379.jpg' },
  { nombre: 'Entraña Fina', categoria: 'parrilla', precio: 75, coccion: 'Asada con leña de quebracho blanco; queda muy jugosa. Recomendada a punto.', imagen: 'images/entrana_a_la_parrilla_1788925735942.jpg' },
  { nombre: 'Tomahawk Angus', categoria: 'parrilla', precio: 115, coccion: 'Corte con hueso largo, asado a fuego vivo. Ideal para compartir.', imagen: 'images/tomahawk_angus.jpg' },
  { nombre: 'Gran Parrillada', categoria: 'parrilla', precio: 125, coccion: 'Bife Angus, entraña, chorizos y morcilla a la parrilla, con papas rústicas y chimichurri.', imagen: 'images/gran_parrillada_mesa_1788925458012.jpg' },
  { nombre: 'Picaña Angus', categoria: 'parrilla', precio: 72, coccion: 'Asado lento sobre las brasas para que la capa de grasa le dé sabor.', imagen: 'images/picana_Angus.jpeg' },
  { nombre: 'Colita de Cuadril', categoria: 'parrilla', precio: 69, coccion: 'Cortada en lonjas y asada al punto con sal marina.', imagen: 'images/colita_angus.jpeg' },
  { nombre: 'Bife Ancho', categoria: 'parrilla', precio: 78, coccion: 'Corte con hueso y marmoleado intenso a la parrilla, con papas rústicas.', imagen: 'images/bife_ancho_angus.jpeg' },
  { nombre: 'Matambrito a la Parrilla', categoria: 'parrilla', precio: 48, coccion: 'Glaseado a fuego lento, con limón y chimichurri de la casa.', imagen: 'images/matambrito.jpeg' },
  { nombre: 'Costillar a la Leña', categoria: 'parrilla', precio: 65, coccion: 'Cocido lentamente a la leña con hierbas aromáticas hasta quedar tierno.', imagen: 'images/inicio_cortes.jpg' },
  { nombre: 'Cordero a las Brasas', categoria: 'parrilla', precio: 72, coccion: 'Dorado a las brasas con romero y servido con limón.', imagen: 'images/inicio_lamb.jpg' },
  { nombre: 'Parrilla para Dos', categoria: 'parrilla', precio: 110, coccion: 'Selección de carnes, chorizo y morcilla a la parrilla para dos personas.', imagen: 'images/parrilla_para_dos.jpg' },
  { nombre: 'Parrilla para Cuatro', categoria: 'parrilla', precio: 189, coccion: 'Bifes, achuras y embutidos a la parrilla en bandeja para cuatro.', imagen: 'images/parrilla_para_cuatro.jpeg' },
  { nombre: 'Milanesa Argentina', categoria: 'platos', precio: 52, coccion: 'Carne de res empanizada y frita, crocante al estilo argentino.', imagen: 'images/milanesa_argentina.webp' },
  { nombre: 'Milanesa Napolitana', categoria: 'platos', precio: 62, coccion: 'Milanesa con salsa de tomate casera y queso fundido al horno.', imagen: 'images/milanesa_napolitana.jpeg' },
  { nombre: 'Suprema de Pollo Napolitana', categoria: 'platos', precio: 58, coccion: 'Pechuga empanizada con salsa de tomate y queso gratinado.', imagen: 'images/suprema_napolitana.webp' },
  { nombre: 'Pastel de Papa', categoria: 'platos', precio: 45, coccion: 'Al horno, relleno de carne Angus y queso.', imagen: 'images/pastel_de_papa.jpg' },
  { nombre: 'Pollo Punto Asado', categoria: 'platos', precio: 42, coccion: 'Pechuga a la parrilla con chimichurri, ensalada y papas doradas.', imagen: 'images/pollo_punto_Asado.jpg' },
  { nombre: 'Pollo al Limón', categoria: 'platos', precio: 40, coccion: 'Pechuga jugosa en salsa cítrica de limón.', imagen: 'images/pollo_limon.jpg' },
  { nombre: 'Panceta Braseada', categoria: 'platos', precio: 38, coccion: 'Braseada: cocida lentamente y servida en su jugo.', imagen: 'images/panceta.jpeg' },
  { nombre: 'Panqueque de Dulce de Leche', categoria: 'postres', precio: 22, coccion: 'Panqueque casero relleno de dulce de leche, con una bola de helado.', imagen: 'images/panqueque_dulce_leche_1788925769110.jpg' },
  { nombre: 'Volcán de Chocolate', categoria: 'postres', precio: 26, coccion: 'Bizcocho tibio de chocolate con centro fundido, servido con helado de vainilla.', imagen: 'images/postre_volcan.jpg' },
  { nombre: 'Flan con Dulce de Leche', categoria: 'postres', precio: 18, coccion: 'Flan casero de huevo bañado en caramelo, con una cucharada de dulce de leche.', imagen: 'images/postre_flan.jpg' },
  { nombre: 'Suspiro a la Limeña', categoria: 'postres', precio: 18, coccion: 'Manjar blanco cremoso cubierto con merengue al oporto y canela.', imagen: 'images/postre_suspiro.jpg' },
  { nombre: 'Tres Leches', categoria: 'postres', precio: 20, coccion: 'Bizcochuelo empapado en tres leches con crema chantilly y canela.', imagen: 'images/postre_tresleches.jpg' },
  { nombre: 'Brownie con Helado', categoria: 'postres', precio: 22, coccion: 'Brownie de chocolate con nueces, tibio, con helado y salsa de chocolate.', imagen: 'images/postre_brownie.jpg' },
  { nombre: 'Vaca Sagrada', categoria: 'vinos', precio: 95, coccion: 'Tinto argentino de cuerpo medio, ideal con cortes a la parrilla.', imagen: 'images/vacaSagrada.jpeg' },
  { nombre: 'Zapa', categoria: 'vinos', precio: 85, coccion: 'Tinto con taninos suaves, para carnes rojas.', imagen: 'images/zapa.jpeg' },
  { nombre: 'Minimalista Malbec', categoria: 'vinos', precio: 120, coccion: 'Malbec fresco y frutado, fácil de maridar.', imagen: 'images/minimalista.webp' },
  { nombre: 'Durigutti', categoria: 'vinos', precio: 110, coccion: 'Malbec argentino intenso y de final largo.', imagen: 'images/durigutti.jpeg' },
  { nombre: 'Malbec Pampas', categoria: 'vinos', precio: 65, coccion: 'Malbec sabroso y redondo de Bodega Pampas.', imagen: 'images/malbec_pampas.webp' },
  { nombre: 'Nostrum Tacama', categoria: 'vinos', precio: 75, coccion: 'Tinto ícono de Tacama, de los valles de Ica.', imagen: 'images/nostrum_tacama.jpeg' },
  { nombre: 'Tonuz Tacama', categoria: 'vinos', precio: 70, coccion: 'Tinto de Tacama para acompañar parrilladas.', imagen: 'images/tonuz_tacama.png' }
];

// ---------- Platos quitados desde el Panel ----------
// El admin puede eliminar un plato de la carta aunque esté escrito en menu.html:
// queda guardado como oculto en la tabla platos. Estas funciones preguntan a
// Supabase (función platos_ocultos) cuáles son y los sacan de CARTA, para que
// no salgan en la carta, en la reserva ni en el chatbot.
let _platosOcultos = null;
function nombresOcultos() {
  if (!_platosOcultos) {
    _platosOcultos = (async () => {
      if (typeof db === 'undefined' || !db) return new Set();
      const { data, error } = await db.rpc('platos_ocultos');
      if (error || !Array.isArray(data)) return new Set();
      return new Set(data.map((n) => String(typeof n === 'object' && n ? Object.values(n)[0] : n).trim().toLowerCase()));
    })();
  }
  return _platosOcultos;
}

// También suma a CARTA los platos nuevos que el admin agregó en el Panel,
// así el chatbot, la reserva y la ficha de la carta los conocen sin tocar código.
let _cartaLista = null;
function cartaVisible() {
  if (!_cartaLista) {
    _cartaLista = (async () => {
      const ocultos = await nombresOcultos();
      for (let i = CARTA.length - 1; i >= 0; i--) {
        if (ocultos.has(CARTA[i].nombre.toLowerCase())) CARTA.splice(i, 1);
      }
      if (typeof db !== 'undefined' && db) {
        const { data } = await db.from('platos').select('nombre, descripcion, categoria, precio, imagen').eq('visible', true);
        (data || []).forEach((p) => {
          const actual = CARTA.find((c) => c.nombre.toLowerCase() === p.nombre.trim().toLowerCase());
          if (actual) {
            if (p.precio != null) actual.precio = Number(p.precio);
            if (p.imagen) actual.imagen = p.imagen;
            return;
          }
          CARTA.push({
            nombre: p.nombre.trim(),
            categoria: String(p.categoria).toLowerCase(),
            precio: p.precio == null ? null : Number(p.precio),
            coccion: p.descripcion || '',
            imagen: p.imagen || null
          });
        });
      }
      return CARTA;
    })();
  }
  return _cartaLista;
}

