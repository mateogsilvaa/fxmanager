// Avatares pixel art (16×16) generados a partir de una semilla: siempre el mismo para la misma persona.
// Se componen por capas: cara (con contorno, sombras, cejas y nariz) + peinado + barba/gafas + ropa del tipo.
// La ropa de pilotos, ingenieros y aficionados es del color de su escudería (gris si no tienen equipo).
// Tipos: piloto (gorra y mono), ingeniero (polo y cascos de radio), patrocinador (traje y corbata),
//        fia (americana azul y gorra con escudo), periodista (micro), aficionado (bufanda).
import { crearRng } from '../engine/rng.js';
import { esc } from './ui.js';

const GRIS = '#8a8f98';
const PIELES = ['#f6d7bd', '#eec29b', '#d9a172', '#b97c4f', '#8d5733', '#5e3a22'];
const PELOS = ['#1c1714', '#3a271b', '#5e3b22', '#8a5a2b', '#c8a05a', '#e3cf96', '#9a9a9a', '#a3412a'];

// Cara base. o contorno · s piel · S sombra de piel · w blanco del ojo · e pupila · b ceja · m boca
const CARA = [
    '................',
    '................',
    '....oooooooo....',
    '...osssssssso...',
    '...osssssssso...',
    '...osbbssbbso...',
    '...sswessewss...',
    '...sssssSssss...',
    '...osssSSssso...',
    '...osssmmssso...',
    '....oSSSSSSo....',
    '......SSSS......',
];

// Peinados (solo se pinta lo que no es '.')
const PELO = {
    corto: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hHhhhhhhHh...', '...h........h...'],
    flequillo: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhssh...', '...hh.......h...'],
    largo: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hh........hh..', '..hh........hh..', '..h..........h..', '..h..........h..', '..h..........h..'],
    rizado: ['.....h.hh.h.....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhHhhhhhhHhh..', '..hh........hh..', '..h..........h..'],
    rapado: ['................', '................', '....HHHHHHHH....', '...H........H...'],
    coleta: ['................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhhh..', '...h........hhh.', '............hhh.', '.............hh.'],
};
const BARBA = ['', '', '', '', '', '', '', '...h........h...', '...hh......hh...', '...hhhmmmmhhh...', '....hhhhhhhh....'];
const BIGOTE = ['', '', '', '', '', '', '', '', '.....hhhhhh.....'];

// Las gafas se dibujan aparte (montura alrededor de los ojos sin taparlos)

// Gorros y accesorios de cabeza
const GORRA = ['....cccccccc....', '...cccccccccc...', '...cccciiccccc..', '..aaaaaaaaaaaa..'];
const GORRA_FIA = ['....FFFFFFFF....', '...FFFFwwFFFFF..', '...FFFFwwFFFFF..', '..ffffffffffff..'];
const CASCOS = ['....kkkkkkkk....', '...k........k...', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '.kk..........kk.', '.kk..........kk.', '..k.............', '..kk............', '...kk...........'];
const MICRO = ['', '', '', '', '', '', '', '', '', '', '.............kk.', '............kkkk', '............kkkk', '.............kk.', '.............kk.', '.............kk.'];

// Cuerpo (filas 12–15). c ropa · d ropa oscura · a acento · w blanco · t corbata · D traje · F azul FIA
const CUERPO = {
    // mono con cuello, cremallera central, paneles laterales oscuros y parche del patrocinador
    piloto: ['..odccaaaaccdo..', '.oddcwwaaccccddo', '.oddcwwaaccccddo', '.oddccccaaccccdo'],
    // polo con cuello blanco y tapeta
    ingeniero: ['..occcwwwwccco..', '.occccwwwwcccco.', '.occcccwwccccco.', '.occcccccccccco.'],
    // traje, camisa blanca y corbata
    patrocinador: ['..oDDDwttwDDDo..', '.oDDDDwttwDDDDo.', '.oDDDDDttDDDDDo.', '.oDDDDDttDDDDDo.'],
    // americana azul con escudo blanco
    fia: ['..oFFFwttwFFFo..', '.oFFFFwttwFFFFo.', '.oFFwFFttFFFFFo.', '.oFFFFFttFFFFFo.'],
    // camisa con acreditación colgada
    periodista: ['..occcwwwwccco..', '.occcaawwaaccco.', '.occccawwacccco.', '.occccawwwcccco.'],
    // camiseta del equipo y bufanda a rayas
    aficionado: ['..owawawawawao..', '.occcwawaccccco.', '.occcccwaccccco.', '.occcccccccccco.'],
};

function oscurecer(hex, f = 0.65) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    if (Number.isNaN(n)) return '#444444';
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const claro = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 150; };

function pintar(grid, capa, desde = 0) {
    capa.forEach((fila, i) => {
        const y = desde + i;
        if (!fila || !grid[y]) return;
        for (let x = 0; x < 16; x++) if (fila[x] && fila[x] !== '.') grid[y][x] = fila[x];
    });
}

/**
 * avatar({ tipo, semilla, color, tam, titulo })
 * color: color de la escudería (ropa). null/undefined = sin equipo (gris). Patrocinadores y FIA tienen su propia ropa.
 */
export function avatar({ tipo = 'piloto', semilla = 'x', color = null, tam = 40, titulo = '' } = {}) {
    const rng = crearRng(`avatar|${tipo}|${semilla}`);
    const piel = rng.pick(PIELES), pelo = rng.pick(PELOS);
    const ropa = color || GRIS;
    const grid = Array.from({ length: 16 }, () => Array(16).fill('.'));
    pintar(grid, CARA);
    // Peinado (los de traje suelen ir más formales)
    const estilos = tipo === 'patrocinador' || tipo === 'fia' ? ['corto', 'flequillo', 'rapado', 'corto'] : Object.keys(PELO);
    pintar(grid, PELO[rng.pick(estilos)]);
    const r = rng.next();
    if (r < 0.18) pintar(grid, BARBA); else if (r < 0.28) pintar(grid, BIGOTE);
    const gafas = rng.chance(tipo === 'patrocinador' || tipo === 'periodista' ? 0.45 : 0.15);
    // Ropa y accesorios del tipo
    pintar(grid, CUERPO[tipo] || CUERPO.piloto, 12);
    if (tipo === 'piloto') pintar(grid, GORRA);
    if (tipo === 'fia') pintar(grid, GORRA_FIA);
    if (tipo === 'ingeniero') pintar(grid, CASCOS);
    if (tipo === 'periodista') pintar(grid, MICRO);
    if (gafas) for (const x of [4, 5, 6, 9, 10, 11]) if (grid[6][x] === 's') grid[6][x] = 'k';


    const traje = rng.pick(['#2b2f3a', '#3b2f2b', '#22352f', '#35304a', '#4a4a4a']);
    const pal = {
        o: '#1b1918', s: piel, S: oscurecer(piel, 0.86), w: '#f4f4f2', e: '#16181d', b: oscurecer(pelo, 0.8), m: oscurecer(piel, 0.72),
        h: pelo, H: oscurecer(pelo, 0.75), k: '#1f2228',
        c: ropa, d: oscurecer(ropa, 0.72), a: claro(ropa) ? oscurecer(ropa, 0.55) : '#f4f4f2', i: claro(ropa) ? '#1f2228' : '#f4f4f2',
        D: traje, t: rng.pick(['#c1121f', '#e9c46a', '#2a9d8f', '#7b2cbf', '#f77f00']), F: '#1e3a8a', f: '#152a63',
    };
    let rects = '';
    grid.forEach((fila, y) => fila.forEach((ch, x) => { if (pal[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`; }));
    return `<svg class="avatar-pixel" width="${tam}" height="${tam}" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="${esc(titulo || tipo)}"><rect width="16" height="16" fill="var(--avatar-fondo)"/>${rects}</svg>`;
}

// Atajos
export const avatarPiloto = (pid, colorEquipo, tam) => avatar({ tipo: 'piloto', semilla: pid, color: colorEquipo || null, tam });
export const avatarIngeniero = (id, colorEquipo, tam) => avatar({ tipo: 'ingeniero', semilla: id, color: colorEquipo || null, tam });
export const avatarPatrocinador = (marca, tam) => avatar({ tipo: 'patrocinador', semilla: marca, tam });
