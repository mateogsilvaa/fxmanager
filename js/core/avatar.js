// Avatares pixel art (24×24) generados a partir de una semilla: siempre el mismo para la misma persona.
// Se dibujan por capas sobre fondo transparente: cabeza redondeada con sombreado, ojos con mirada, cejas, nariz,
// boca, peinado, vello facial, gafas y ropa del tipo. Al final se traza un contorno solo alrededor de la silueta
// (sin recuadro) y se juntan los píxeles iguales de cada fila para que el SVG pese poco.
// La ropa de pilotos, ingenieros, mánagers y aficionados es del color de su escudería (gris si no tienen equipo).
// Tipos: piloto (mono y a veces gorra), ingeniero (polo y cascos de radio), patrocinador (traje y corbata),
//        fia (americana azul e insignia), periodista (acreditación y micro), aficionado (bufanda y pintura),
//        manager (chaqueta del equipo y cascos al cuello).
import { crearRng } from '../engine/rng.js';
import { esc } from './ui.js';

const N = 24;
const GRIS = '#8a8f98';
const PIELES = ['#f7dcc4', '#f0c9a4', '#e0ad82', '#c98e60', '#a5683f', '#7d4b2b', '#5a3420'];
const PELOS = ['#1d1714', '#2f2219', '#4b3020', '#6e4425', '#9a6a3a', '#c99a55', '#e2c98f', '#a33f22', '#8d8d8d', '#d9d6cf'];
const RAROS = ['#2f5fb3', '#c2417a', '#3a8f5a'];
const IRIS = ['#2a1c14', '#2a1c14', '#2a1c14', '#24456e', '#3b5a2a', '#4a3524'];
const ACENTOS = ['#c1121f', '#e9c46a', '#2a9d8f', '#7b2cbf', '#f77f00', '#1d4e89'];
const CAMISAS = ['#5b7083', '#7a5c61', '#4f6d5a', '#8a6f3e', '#3f4a6b', '#6b4f7a'];

// Anchura media de la cabeza por fila (desde el centro, entre las columnas 11 y 12). Tres mandíbulas.
const CABEZA = {
    normal: { 4: 4, 5: 5, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 6, 14: 5, 15: 4, 16: 3 },
    cuadrada: { 4: 4, 5: 5, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 6, 14: 6, 15: 5, 16: 4 },
    fina: { 4: 4, 5: 5, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2 },
};
// Silueta de los hombros
const CUERPO = { 19: 7, 20: 9, 21: 10, 22: 10, 23: 10 };

function mezclar(a, b, t) {
    const pa = parseInt(String(a).replace('#', ''), 16), pb = parseInt(String(b).replace('#', ''), 16);
    if (Number.isNaN(pa) || Number.isNaN(pb)) return a;
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}
const oscurecer = (hex, f = 0.65) => mezclar(hex, '#000000', 1 - f);
const aclarar = (hex, t = 0.2) => mezclar(hex, '#ffffff', t);
const luminancia = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };

class Lienzo {
    constructor() { this.g = Array.from({ length: N }, () => Array(N).fill(null)); }
    get(x, y) { return x >= 0 && x < N && y >= 0 && y < N ? this.g[y][x] : null; }
    set(x, y, c) { if (x >= 0 && x < N && y >= 0 && y < N && c) this.g[y][x] = c; }
    fila(y, x0, x1, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    // Pinta una figura en espejo respecto al centro (columnas x y 23-x)
    par(x, y, c) { this.set(x, y, c); this.set(N - 1 - x, y, c); }
    si(fn, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fn(x, y, this.g[y][x])) this.g[y][x] = c; }
}

const enRango = (hw, x) => x >= 12 - hw && x <= 11 + hw;

// ---------- Peinados ----------
// Cada uno pinta pelo ('h'), sombra de pelo ('H') y brillo ('L') respecto a la cabeza.
function pelo(L, estilo, cab, rng) {
    const casquete = (hasta = 6) => {
        L.fila(3, 8, 15, 'h');
        for (let y = 4; y <= hasta; y++) L.fila(y, 12 - cab[y], 11 + cab[y], 'h');
        L.fila(4, 7, 16, 'h');
        L.set(9, 4, 'L'); L.set(10, 4, 'L'); L.set(10, 3, 'L');
        L.set(16, 5, 'H'); L.set(17, 6, 'H');
    };
    const patillas = (hasta = 9) => { for (let y = 7; y <= hasta; y++) L.par(6, y, 'h'); };
    switch (estilo) {
        case 'corto': casquete(); patillas(8); break;
        case 'raya': casquete(); L.fila(2, 9, 13, 'h'); L.fila(7, 13, 17, 'h'); L.set(10, 3, 'H'); L.set(10, 4, 'H'); L.set(9, 3, 'L'); patillas(8); break;
        case 'flequillo': casquete(); L.fila(7, 6, 12, 'h'); L.fila(8, 6, 8, 'h'); L.set(12, 7, 'H'); patillas(9); break;
        case 'tupe': casquete(); L.fila(2, 8, 14, 'h'); L.fila(1, 10, 13, 'h'); L.set(11, 1, 'L'); L.set(10, 2, 'L'); L.par(6, 7, 'h'); break;
        case 'largo':
            casquete(); L.fila(2, 9, 14, 'h');
            for (let y = 7; y <= 18; y++) { L.par(5, y, y > 15 ? 'H' : 'h'); L.par(6, y, y > 13 ? 'H' : 'h'); }
            L.fila(7, 7, 9, 'h'); L.fila(7, 14, 16, 'h');
            for (let y = 19; y <= 21; y++) { L.par(5, y, 'H'); L.par(4, y, 'H'); }
            break;
        case 'media':
            casquete(); L.fila(7, 6, 10, 'h');
            for (let y = 7; y <= 14; y++) { L.par(5, y, 'h'); L.par(6, y, y > 11 ? 'H' : 'h'); }
            break;
        case 'rizado':
            for (let y = 0; y < 10; y++) for (let x = 3; x <= 20; x++) {
                const dx = (x + 0.5 - 12) / 8.6, dy = (y + 0.5 - 6.2) / 5.6;
                if (dx * dx + dy * dy > 1) continue;
                if (y >= 7 && x >= 7 && x <= 16) continue;
                L.set(x, y, (x * 3 + y * 5) % 7 === 0 ? 'H' : (x + y) % 9 === 0 ? 'L' : 'h');
            }
            for (let y = 10; y <= 12; y++) L.par(5, y, 'h');
            break;
        case 'rapado':
            for (let y = 4; y <= 6; y++) L.fila(y, 12 - cab[y], 11 + cab[y], 'R');
            L.fila(3, 9, 14, 'R'); L.par(6, 7, 'R'); L.par(6, 8, 'R');
            break;
        case 'coleta':
            casquete(); L.fila(7, 6, 9, 'h'); patillas(8);
            for (let y = 6; y <= 15; y++) L.set(19, y, y > 12 ? 'H' : 'h');
            L.set(18, 6, 'h'); L.set(20, 9, 'h'); L.set(20, 10, 'h'); L.set(20, 11, 'H');
            break;
        case 'mono':
            casquete(); L.fila(7, 6, 8, 'h'); patillas(8);
            L.fila(0, 10, 13, 'h'); L.fila(1, 9, 14, 'h'); L.fila(2, 10, 13, 'H'); L.set(11, 0, 'L');
            break;
        case 'calvo':
            for (let y = 8; y <= 11; y++) L.par(6, y, 'h');
            L.par(7, 7, 'h');
            break;
        case 'entradas':
            L.fila(4, 7, 9, 'h'); L.fila(4, 14, 16, 'h'); L.fila(5, 6, 8, 'h'); L.fila(5, 15, 17, 'h'); L.fila(6, 6, 7, 'h'); L.fila(6, 16, 17, 'h');
            patillas(10);
            break;
    }
    void rng;
}

// ---------- Ropa ----------
function ropa(L, tipo, rng) {
    // silueta base
    for (const [y, hw] of Object.entries(CUERPO)) L.fila(+y, 12 - hw, 11 + hw, 'c');
    L.fila(17, 10, 13, 'N'); L.fila(18, 10, 13, 's'); L.set(13, 18, 'S');
    switch (tipo) {
        case 'piloto':
            for (let y = 20; y <= 23; y++) { L.fila(y, 2, 4, 'd'); L.fila(y, 19, 21, 'd'); }
            L.fila(18, 9, 14, 'a'); L.par(9, 19, 'a'); L.par(10, 19, 'a');
            for (let y = 19; y <= 23; y++) L.set(12, y, 'z');
            L.fila(20, 4, 7, 'a'); L.fila(20, 16, 19, 'a');
            L.fila(22, 5, 7, 'p'); L.fila(22, 15, 17, 'w');
            break;
        case 'ingeniero':
            L.fila(18, 9, 14, 'w'); L.par(8, 19, 'w'); L.par(9, 19, 'w');
            for (let y = 19; y <= 22; y++) L.fila(y, 11, 12, 'd');
            L.set(11, 20, 'w'); L.set(11, 22, 'w');
            L.fila(21, 15, 16, 'a');
            break;
        case 'manager':
            L.fila(18, 10, 13, 'w'); L.fila(19, 10, 13, 'w'); L.fila(20, 11, 12, 'w');
            for (let y = 19; y <= 23; y++) { L.par(9, y, 'd'); L.par(10, y, y >= 21 ? 'c' : 'd'); }
            L.fila(21, 2, 3, 'a'); L.fila(21, 20, 21, 'a');
            L.par(7, 18, 'k'); L.par(8, 18, 'K'); L.par(8, 17, 'k');
            break;
        case 'patrocinador':
        case 'fia': {
            const [tr, osc] = tipo === 'fia' ? ['F', 'f'] : ['D', 'E'];
            L.si((x, y, c) => c === 'c', tr);
            L.fila(18, 10, 13, 'w'); L.fila(19, 10, 13, 'w'); L.fila(20, 10, 13, 'w');
            for (let y = 19; y <= 23; y++) L.fila(y, 11, 12, 't');
            L.set(11, 19, 'T'); L.set(12, 19, 'T');
            for (let y = 20; y <= 22; y++) { L.par(9, y, osc); }
            L.set(10, 21, osc); L.set(13, 21, osc);
            if (tipo === 'fia') { L.fila(21, 15, 16, 'y'); L.set(15, 22, 'y'); }
            else L.fila(21, 15, 16, 'a');
            break;
        }
        case 'periodista':
            L.fila(18, 9, 14, 'w'); L.par(9, 19, 'w');
            L.set(9, 20, 'y'); L.set(10, 21, 'y'); L.set(14, 20, 'y'); L.set(13, 21, 'y');
            L.fila(22, 10, 13, 'w'); L.fila(23, 10, 13, 'w'); L.fila(22, 11, 12, 'k');
            // micro en la mano
            L.set(19, 13, 'k'); L.set(20, 13, 'k'); L.set(19, 14, 'K'); L.set(20, 14, 'k'); L.set(19, 12, 'K');
            for (let y = 15; y <= 18; y++) L.set(19, y, 'k');
            L.set(18, 18, 's'); L.set(20, 18, 's'); L.set(18, 19, 's'); L.set(19, 19, 's'); L.set(20, 19, 'S');
            break;
        case 'aficionado':
            for (let x = 8; x <= 15; x++) { L.set(x, 18, x % 2 ? 'c' : 'w'); L.set(x, 19, x % 2 ? 'w' : 'c'); }
            for (let y = 20; y <= 23; y++) { L.set(8, y, y % 2 ? 'c' : 'w'); L.set(9, y, y % 2 ? 'w' : 'c'); }
            break;
    }
    // sombra del lado derecho del cuerpo
    const SOMBRA = { c: 'd', D: 'E', F: 'f' };
    for (let y = 19; y < N; y++) for (let x = 19; x < N; x++) { const c = L.get(x, y); if (SOMBRA[c]) L.set(x, y, SOMBRA[c]); }
    void rng;
}

/**
 * avatar({ tipo, semilla, color, tam, titulo })
 * color: color de la escudería (ropa). null/undefined = sin equipo (gris). Patrocinadores y FIA tienen su propia ropa.
 */
export function avatar({ tipo = 'piloto', semilla = 'x', color = null, tam = 40, titulo = '' } = {}) {
    const rng = crearRng(`avatar|${tipo}|${semilla}`);
    const formal = tipo === 'patrocinador' || tipo === 'fia';
    const piel = rng.weighted(PIELES, (_, i) => [5, 5, 4, 3, 2, 1.5, 1][i] ?? 1);
    const canoso = rng.chance(formal ? 0.3 : 0.06);
    const pelColor = canoso ? rng.pick(['#8d8d8d', '#bdbab3']) : rng.chance(tipo === 'aficionado' || tipo === 'piloto' ? 0.04 : 0.01) ? rng.pick(RAROS) : rng.pick(PELOS.slice(0, 8));
    const ropaColor = tipo === 'periodista' ? rng.pick(CAMISAS) : (color || GRIS);
    const cab = CABEZA[rng.pick(['normal', 'normal', 'cuadrada', 'fina'])];
    const L = new Lienzo();

    // Cuerpo y cuello primero (el pelo largo cae por encima)
    ropa(L, tipo, rng);
    // Orejas
    for (let y = 10; y <= 12; y++) L.par(5, y, 's');
    L.par(5, 11, 'S');
    // Cabeza
    for (const [y, hw] of Object.entries(cab)) L.fila(+y, 12 - hw, 11 + hw, 's');
    // Sombra: lado derecho y barbilla
    for (const [y, hw] of Object.entries(cab)) { if (+y >= 6) L.set(11 + hw, +y, 'S'); }
    const ultima = Math.max(...Object.keys(cab).map(Number));
    L.fila(ultima, 12 - cab[ultima], 11 + cab[ultima], 'S');
    // Ojos (con mirada) y cejas
    const mirada = rng.pick(['centro', 'centro', 'izq', 'der']);
    const ojo = { centro: [['w', 'e'], ['e', 'w']], izq: [['e', 'w'], ['e', 'w']], der: [['w', 'e'], ['w', 'e']] }[mirada];
    L.set(8, 10, ojo[0][0]); L.set(9, 10, ojo[0][1]); L.set(14, 10, ojo[1][0]); L.set(15, 10, ojo[1][1]);
    const cejas = rng.pick(['normal', 'normal', 'larga', 'alta', 'fruncida']);
    if (cejas === 'larga') { L.fila(8, 7, 9, 'b'); L.fila(8, 14, 16, 'b'); }
    else if (cejas === 'alta') { L.fila(7, 8, 9, 'b'); L.fila(7, 14, 15, 'b'); }
    else if (cejas === 'fruncida') { L.set(8, 8, 'b'); L.set(9, 9, 'b'); L.set(15, 8, 'b'); L.set(14, 9, 'b'); }
    else { L.fila(8, 8, 9, 'b'); L.fila(8, 14, 15, 'b'); }
    // Nariz
    L.set(12, 11, 'S'); L.set(12, 12, 'S'); L.set(11, 13, 'N'); L.set(12, 13, 'N');
    // Boca
    const boca = rng.pick(['sonrisa', 'sonrisa', 'neutra', 'abierta', 'seria']);
    if (boca === 'sonrisa') { L.fila(15, 10, 13, 'm'); L.set(9, 14, 'm'); L.set(14, 14, 'm'); }
    else if (boca === 'abierta') { L.fila(15, 10, 13, 'M'); L.set(11, 15, 'w'); L.set(12, 15, 'w'); L.set(9, 14, 'm'); L.set(14, 14, 'm'); }
    else if (boca === 'seria') L.fila(15, 11, 12, 'N');
    else L.fila(15, 10, 13, 'm');
    if (rng.chance(0.35)) { L.set(7, 13, 'r'); L.set(16, 13, 'r'); }
    if (tipo === 'aficionado') { L.set(7, 12, 'c'); L.set(7, 13, 'a'); L.set(16, 12, 'c'); L.set(16, 13, 'a'); }

    // Peinado
    const estilos = formal ? ['corto', 'raya', 'raya', 'entradas', 'calvo', 'media', 'mono']
        : ['corto', 'raya', 'flequillo', 'tupe', 'largo', 'media', 'rizado', 'rapado', 'coleta', 'mono', 'calvo', 'entradas'];
    const estilo = canoso && rng.chance(0.5) ? rng.pick(['entradas', 'calvo', 'raya']) : rng.pick(estilos);
    const gorra = (tipo === 'piloto' && rng.chance(0.6)) || (tipo === 'aficionado' && rng.chance(0.35));
    if (gorra) {
        // Gorra del equipo con visera y logo; se ven las patillas
        L.fila(2, 9, 14, 'c'); L.fila(3, 7, 16, 'c');
        for (let y = 4; y <= 6; y++) L.fila(y, 12 - cab[y], 11 + cab[y], 'c');
        L.fila(4, 11, 12, 'a'); L.set(8, 3, 'C'); L.set(9, 3, 'C'); L.set(8, 4, 'C');
        L.fila(7, 5, 18, 'd'); L.fila(6, 16, 17, 'd');
        for (let y = 8; y <= 9; y++) L.par(6, y, 'h');
    } else pelo(L, estilo, cab, rng);

    // Vello facial
    const vello = formal || tipo === 'periodista' || tipo === 'manager' || tipo === 'ingeniero' ? 0.32 : 0.2;
    if (rng.chance(vello)) {
        const v = rng.pick(['barba', 'corta', 'bigote', 'perilla', 'corta']);
        if (v === 'barba' || v === 'corta') {
            const b = v === 'barba' ? 'h' : 'Q';
            for (let y = 13; y <= ultima; y++) {
                const x0 = 12 - cab[y], x1 = 11 + cab[y];
                if (y === 13) { L.set(x0, y, b); L.set(x1, y, b); continue; }
                L.fila(y, x0, x1, b);
            }
            L.fila(15, 10, 13, boca === 'abierta' ? 'M' : 'm');
            if (boca === 'abierta') { L.set(11, 15, 'w'); L.set(12, 15, 'w'); }
            if (v === 'barba') L.set(11 + cab[15], 15, 'H');
        } else if (v === 'bigote') L.fila(14, 10, 13, 'h');
        else { L.fila(ultima, 11, 12, 'h'); L.fila(16, 10, 13, 'h'); }
    }

    // Accesorios de cabeza y gafas
    if (tipo === 'ingeniero') {
        L.fila(2, 9, 14, 'k'); L.set(8, 3, 'k'); L.set(15, 3, 'k');
        for (let y = 4; y <= 8; y++) L.par(6, y, 'k');
        for (let y = 9; y <= 12; y++) { L.par(4, y, 'k'); L.par(5, y, y === 10 ? 'K' : 'k'); }
        L.set(6, 13, 'k'); L.set(7, 14, 'k'); L.set(8, 15, 'k'); L.set(9, 15, 'K');
    }
    const gafas = rng.chance(tipo === 'patrocinador' || tipo === 'periodista' ? 0.45 : tipo === 'fia' ? 0.3 : 0.14);
    if (gafas) {
        const sol = (tipo === 'patrocinador' || tipo === 'manager') && rng.chance(0.4);
        for (const x0 of [7, 13]) {
            L.fila(9, x0, x0 + 3, 'k'); L.fila(11, x0 + 1, x0 + 2, 'k'); L.set(x0, 10, 'k'); L.set(x0 + 3, 10, 'k');
            if (sol) { L.set(x0 + 1, 10, 'k'); L.set(x0 + 2, 10, 'k'); L.set(x0 + 1, 10, 'g'); }
        }
        L.fila(9, 11, 12, 'k');
    }
    // El pelo y la gorra proyectan una sombra sobre la frente
    const PELO = new Set(['h', 'H', 'L', 'c', 'C', 'd', 'R']);
    for (let y = 5; y <= 9; y++) for (let x = 6; x <= 17; x++) if (L.get(x, y) === 's' && PELO.has(L.get(x, y - 1))) L.set(x, y, 'S');

    // Contorno: solo alrededor de la silueta
    const lleno = (x, y) => !!L.get(x, y) && L.get(x, y) !== 'o';
    const contorno = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (L.get(x, y)) continue;
        if (lleno(x - 1, y) || lleno(x + 1, y) || lleno(x, y - 1) || lleno(x, y + 1)) contorno.push([x, y]);
    }
    for (const [x, y] of contorno) L.set(x, y, 'o');

    const traje = rng.pick(['#2b2f3a', '#3b2f2b', '#22352f', '#35304a', '#4a4a4a', '#1f2a44']);
    const claro = luminancia(ropaColor) > 150;
    const pal = {
        o: '#2a211d', s: piel, S: oscurecer(piel, 0.86), N: oscurecer(piel, 0.7), r: mezclar(piel, '#e0604f', 0.28),
        w: '#f5f2ea', e: rng.pick(IRIS), b: oscurecer(pelColor, 0.75), m: mezclar(oscurecer(piel, 0.72), '#b04a3c', 0.35), M: '#4a1f1a',
        h: pelColor, H: oscurecer(pelColor, 0.72), L: aclarar(pelColor, 0.28), R: mezclar(pelColor, piel, 0.55), Q: mezclar(pelColor, piel, 0.45),
        k: '#23262d', K: '#6b717c', g: '#9fb7d8',
        c: ropaColor, C: aclarar(ropaColor, 0.25), d: oscurecer(ropaColor, 0.72), a: claro ? oscurecer(ropaColor, 0.5) : '#f4f4f2',
        z: '#b8bcc4', p: rng.pick(ACENTOS), y: '#d8b24a',
        D: traje, E: oscurecer(traje, 0.7), t: rng.pick(ACENTOS), T: oscurecer('#c1121f', 0.8), F: '#1e3a8a', f: '#142a63',
    };
    pal.T = oscurecer(pal.t, 0.75);
    // Píxeles iguales seguidos de una fila = un solo rectángulo
    let rects = '';
    for (let y = 0; y < N; y++) {
        let x = 0;
        while (x < N) {
            const ch = L.get(x, y);
            if (!ch || !pal[ch]) { x++; continue; }
            let x2 = x + 1;
            while (x2 < N && L.get(x2, y) === ch) x2++;
            rects += `<rect x="${x}" y="${y}" width="${x2 - x + 0.03}" height="1.03" fill="${pal[ch]}"/>`;
            x = x2;
        }
    }
    return `<svg class="avatar-pixel" width="${tam}" height="${tam}" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" role="img" aria-label="${esc(titulo || tipo)}">${rects}</svg>`;
}

// Atajos
export const avatarPiloto = (pid, colorEquipo, tam) => avatar({ tipo: 'piloto', semilla: pid, color: colorEquipo || null, tam });
export const avatarIngeniero = (id, colorEquipo, tam) => avatar({ tipo: 'ingeniero', semilla: id, color: colorEquipo || null, tam });
export const avatarPatrocinador = (marca, tam) => avatar({ tipo: 'patrocinador', semilla: marca, tam });
export const avatarManager = (id, colorEquipo, tam) => avatar({ tipo: 'manager', semilla: id, color: colorEquipo || null, tam });
