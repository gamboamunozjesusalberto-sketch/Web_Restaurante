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

// categoria: entradas | parrilla | platos | postres | vinos | bebidas
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
  { nombre: 'Tonuz Tacama', categoria: 'vinos', precio: 70, coccion: 'Tinto de Tacama para acompañar parrilladas.', imagen: 'images/tonuz_tacama.png' },
  // Bebidas: precios provisionales hasta tener los reales. Sin foto todavía:
  // el admin la sube desde el Panel → Carta (mismo nombre) y reemplaza el ícono.
  { nombre: 'Chicha Morada', categoria: 'bebidas', precio: 22, coccion: 'Hecha en casa con maíz morado, piña, canela y clavo. Jarra de 1 litro (también por vaso).', imagen: 'images/bebida_chicha_morada.jpg' },
  { nombre: 'Limonada Clásica', categoria: 'bebidas', precio: 20, coccion: 'Limón recién exprimido, bien helada. Jarra de 1 litro.', imagen: 'images/bebida_limonada.jpg' },
  { nombre: 'Limonada Frozen de Hierbabuena', categoria: 'bebidas', precio: 12, coccion: 'Limón y hierbabuena licuados con hielo.', imagen: 'images/bebida_frozen_hierbabuena.jpg' },
  { nombre: 'Jugo de Maracuyá', categoria: 'bebidas', precio: 10, coccion: 'Maracuyá natural, refrescante y ácido; va muy bien con la parrilla.', imagen: 'images/bebida_maracuya.jpg' },
  { nombre: 'Gaseosa Personal', categoria: 'bebidas', precio: 6, coccion: 'Botella personal de 500 ml, bien fría.', imagen: 'images/bebida_gaseosas.jpg' },
  { nombre: 'Agua Mineral', categoria: 'bebidas', precio: 5, coccion: 'Con o sin gas, 625 ml.', imagen: 'images/bebida_agua.jpg' },
  { nombre: 'Pisco Sour', categoria: 'bebidas', precio: 22, coccion: 'Pisco quebranta de Ica, limón, jarabe de goma, clara de huevo y amargo de angostura.', imagen: 'images/bebida_pisco_sour.jpg' },
  { nombre: 'Chilcano de Pisco', categoria: 'bebidas', precio: 20, coccion: 'Pisco, ginger ale, limón y amargo de angostura, con mucho hielo.', imagen: 'images/bebida_chilcano.jpg' },
  { nombre: 'Machu Picchu', categoria: 'bebidas', precio: 24, coccion: 'Cóctel en tres capas: granadina, jugo de naranja y licor de menta con pisco.', imagen: 'images/bebida_machu_picchu.jpg' },
  { nombre: 'Fernet con Cola', categoria: 'bebidas', precio: 22, coccion: 'El clásico argentino para la sobremesa: fernet con cola y mucho hielo.', imagen: 'images/bebida_fernet.jpg' },
  { nombre: 'Clericó', categoria: 'bebidas', precio: 45, coccion: 'La sangría argentina: vino tinto con frutas de estación picadas. Jarra de 1 litro.', imagen: 'images/bebida_clerico.jpg' },
  { nombre: 'Cerveza Quilmes', categoria: 'bebidas', precio: 12, coccion: 'La cerveza argentina de siempre, rubia y bien helada. Botella de 660 ml.', imagen: 'images/bebida_quilmes.jpg' }
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


// ---------- Maridaje: qué vino sugerir con cada plato ----------
// Reglas de sommelier (no es al azar):
//   1. El tipo de plato define el estilo de vino:
//      - carnes rojas de res (bife, entraña, picaña, parrilladas…) → tinto intenso
//      - cerdo, cordero, achuras y embutidos → tinto frutado
//      - pollo, milanesas, entradas y platos de fondo suaves → tinto ligero
//   2. El precio del plato define el nivel del vino dentro de ese estilo:
//      platos para compartir (S/ 100 o más) → el mejor; de S/ 60 a 99 → el del medio;
//      menos de S/ 60 → el más accesible
//   3. Un plato nuevo del Panel se clasifica por las palabras de su nombre y
//      descripción; si no coincide con ninguna, por su categoría.
//   Los vinos nuevos del Panel se clasifican por su descripción (intenso,
//   cuerpo, taninos → intenso; fresco, frutado, suave → frutado).
const ESTILO_VINO = {
  'Vaca Sagrada': 'intenso', Zapa: 'intenso', Durigutti: 'intenso',
  'Minimalista Malbec': 'frutado', 'Malbec Pampas': 'frutado', 'Nostrum Tacama': 'frutado',
  'Tonuz Tacama': 'ligero'
};
const RAZON_VINO = {
  intenso: 'un tinto con cuerpo acompaña la grasa y el sabor a brasa de la carne de res',
  frutado: 'su fruta equilibra la grasa del cerdo, el cordero y los embutidos',
  ligero: 'un tinto ligero no tapa el sabor de platos más suaves'
};

function estiloDePlato(plato) {
  const t = `${plato.nombre} ${plato.coccion || ''}`.toLowerCase();
  if (/(parrillada|parrilla para|tomahawk|bife|entra[ñn]a|pica[ñn]a|cuadril)/.test(t)) return 'intenso';
  if (/(cerdo|panceta|costillar|cordero|chorizo|morcilla|molleja|achura|bondiola)/.test(t)) return 'frutado';
  if (/(pollo|suprema|milanesa|pastel|empanada|provoleta|papas|queso)/.test(t)) return 'ligero';
  if (/(matambr|lomo|asado de tira|angus|\bres\b)/.test(t)) return 'intenso';
  return plato.categoria === 'parrilla' ? 'intenso' : 'ligero';
}

function estiloDeVino(vino) {
  if (ESTILO_VINO[vino.nombre]) return ESTILO_VINO[vino.nombre];
  const t = (vino.coccion || '').toLowerCase();
  if (/intens|cuerpo|tanin/.test(t)) return 'intenso';
  if (/fresc|frutad|suave|redond/.test(t)) return 'frutado';
  return 'ligero';
}

// Devuelve { vino, razon } o null (postres, bebidas, vinos, o carta sin vinos)
function maridaje(plato, carta = CARTA) {
  if (!plato || ['postres', 'vinos', 'bebidas'].includes(plato.categoria)) return null;
  const vinos = carta.filter((p) => p.categoria === 'vinos' && p.precio != null);
  if (!vinos.length) return null;
  const estilo = estiloDePlato(plato);
  let opciones = vinos.filter((v) => estiloDeVino(v) === estilo);
  if (!opciones.length) opciones = vinos;
  opciones.sort((a, b) => a.precio - b.precio);
  const precio = Number(plato.precio) || 0;
  const nivel = precio >= 100 ? opciones.length - 1 : precio >= 60 ? Math.floor((opciones.length - 1) / 2) : 0;
  return { vino: opciones[nivel], razon: RAZON_VINO[estilo] };
}

// ---------- Recomendación del chef: plato + bebida ----------
// Mismas reglas que el vino: se mira el tipo de plato (palabras del nombre y la
// preparación) y a cada tipo le corresponde un trago y una opción sin alcohol.
const COMBOS_CHEF = [
  { tipo: 'parrillada', regla: /(parrillada|parrilla para)/,
    trago: 'Clericó', sinAlcohol: 'Limonada Clásica',
    razon: 'vienen en jarra de 1 litro, para compartir en la mesa igual que la parrillada' },
  { tipo: 'res', regla: /(tomahawk|bife|entra[ñn]a|pica[ñn]a|cuadril|matambr|lomo|asado de tira)/,
    trago: 'Cerveza Quilmes', sinAlcohol: 'Limonada Clásica',
    razon: 'una cerveza argentina bien helada refresca entre bocado y bocado de carne a la brasa' },
  { tipo: 'achura', regla: /(chorizo|morcilla|molleja|achura|chinchul)/,
    trago: 'Fernet con Cola', sinAlcohol: 'Limonada Frozen de Hierbabuena',
    razon: 'lo amargo del fernet y la hierbabuena limpian el paladar después de las achuras' },
  { tipo: 'cerdo', regla: /(cerdo|panceta|costillar|bondiola|cordero)/,
    trago: 'Chilcano de Pisco', sinAlcohol: 'Jugo de Maracuyá',
    razon: 'el limón del chilcano y lo ácido del maracuyá cortan la grasa del cerdo y el cordero' },
  { tipo: 'pollo', regla: /(pollo|suprema|milanesa)/,
    trago: 'Machu Picchu', sinAlcohol: 'Chicha Morada',
    razon: 'son dulces y frutales, y van bien con carnes suaves como el pollo y la milanesa' },
  { tipo: 'entrada', regla: /(empanada|provoleta|papas|pastel|queso)/,
    trago: 'Pisco Sour', sinAlcohol: 'Chicha Morada',
    razon: 'el pisco sour es el aperitivo clásico: su limón abre el apetito antes de la parrilla' }
];

// Primero mira el nombre del plato; si no dice nada, su preparación
function comboDelPlato(plato) {
  const nombre = (plato.nombre || '').toLowerCase();
  const prep = (plato.coccion || '').toLowerCase();
  return COMBOS_CHEF.find((c) => c.regla.test(nombre))
    || COMBOS_CHEF.find((c) => c.regla.test(prep))
    || (plato.categoria === 'parrilla' ? COMBOS_CHEF.find((c) => c.tipo === 'res') : null);
}

// Devuelve { trago, sinAlcohol, razon } con las bebidas de la carta, o null
function recomendacionChef(plato, carta = CARTA) {
  if (!plato || ['postres', 'vinos', 'bebidas'].includes(plato.categoria)) return null;
  const combo = comboDelPlato(plato);
  if (!combo) return null;
  const buscar = (n) => carta.find((p) => p.nombre === n && p.categoria === 'bebidas');
  const trago = buscar(combo.trago);
  const sinAlcohol = buscar(combo.sinAlcohol);
  if (!trago && !sinAlcohol) return null;
  return { trago, sinAlcohol, razon: combo.razon };
}

// Para la ficha de una bebida: con qué plato de la carta la recomienda el chef
function platoParaBebida(bebida, carta = CARTA) {
  const combo = COMBOS_CHEF.find((c) => c.trago === bebida.nombre || c.sinAlcohol === bebida.nombre);
  if (!combo) return null;
  const plato = carta.find((p) => !['postres', 'vinos', 'bebidas'].includes(p.categoria)
    && p.precio != null && comboDelPlato(p) === combo);
  return plato ? { plato, razon: combo.razon } : null;
}
