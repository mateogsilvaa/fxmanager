// Bolsa de agentes libres: pilotos sin equipo que se pueden fichar para cubrir vacantes (despidos, retiradas,
// traspasos) o como sustitutos cuando un piloto se lesiona. Viven en la colección pilotos con equipoId null y
// estado 'libre'; su valoración (estrellas) y su precio son públicos, los atributos siguen siendo privados.
import { LIGAS_NACIONALES, NAC_LOCAL } from './constants.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';
import { atributosAleatorios, salarioPiloto } from './juego.js';

// Cuántos agentes libres tiene que haber como mínimo (por nacionalidad local de cada liga y extranjeros)
export const POOL = { porLiga: 16, extranjeros: 30, edadRetiroLibre: 38 };

// Estrellas públicas (1–5) a partir de los atributos (estimación, como la de los rookies)
export function estrellasPiloto(attrs) {
    if (!attrs) return 1;
    const v = attrs.ritmo * 0.6 + (attrs.consistencia ?? 70) * 0.2 + (attrs.experiencia ?? 50) * 0.1 + (attrs.potencial ?? attrs.ritmo) * 0.1;
    return Math.max(1, Math.min(5, Math.round((v - 60) / 5.5)));
}
// Prima de fichaje de un agente libre (temporada completa) y de un sustituto por lesión (unas carreras)
export const precioLibre = (attrs) => Math.round(Math.max(150_000, 150_000 + (estrellasPiloto(attrs) - 1) * 320_000 + Math.max(0, (attrs?.ritmo ?? 70) - 75) * 30_000) / 10_000) * 10_000;
export const precioSustituto = (attrs) => Math.max(80_000, Math.round(precioLibre(attrs) * 0.25 / 10_000) * 10_000);

// Un agente libre nuevo. perfil: 'joven' (prometedor, poca experiencia), 'veterano' (experiencia, ya en declive) o 'normal'
export function crearAgente(rng, { nac, usados, id }) {
    const perfil = rng.weighted(['joven', 'normal', 'veterano'], p => ({ joven: 3, normal: 5, veterano: 2 })[p]);
    const attrs = atributosAleatorios(rng, { rookie: perfil === 'joven', estrella: rng.chance(0.06) ? 1 : 0 });
    // Los libres suelen estar algo por debajo de los titulares
    attrs.ritmo = Math.max(58, attrs.ritmo - rng.int(0, 5));
    if (perfil === 'veterano') { attrs.experiencia = Math.min(95, attrs.experiencia + 25); attrs.potencial = attrs.ritmo; }
    const edad = perfil === 'joven' ? rng.int(18, 22) : perfil === 'veterano' ? rng.int(31, 36) : rng.int(22, 31);
    const { nombre, apellido } = nombreAleatorio(rng, nac, usados);
    usados.add(`${nombre} ${apellido}`);
    const publico = { nombre, apellido, nac, numero: null, equipoId: null, liga: null, rol: null, edad, rookie: false, estado: 'libre', historia: [], agente: true, valoracion: estrellasPiloto(attrs), precio: precioLibre(attrs) };
    const priv = { pilotoId: id, equipoId: null, attrs, moral: 60, forma: 0, salario: salarioPiloto(attrs) };
    return { id, publico, priv };
}

// Qué nacionalidades faltan en la bolsa: [{ nac, n }]
export function faltanEnPool(libres) {
    const out = [];
    for (const liga of LIGAS_NACIONALES) {
        const nac = NAC_LOCAL[liga];
        const hay = libres.filter(p => p.nac === nac).length;
        if (hay < POOL.porLiga) out.push({ nac, n: POOL.porLiga - hay });
    }
    const locales = new Set(Object.values(NAC_LOCAL));
    const extr = libres.filter(p => !locales.has(p.nac)).length;
    if (extr < POOL.extranjeros) out.push({ nac: null, n: POOL.extranjeros - extr });
    return out;
}
export const nacExtranjera = (rng) => rng.pick([...new Set(LIGAS_NACIONALES.flatMap(l => EXTRANJEROS[l] || []))]);

// Probabilidad de retirarse al acabar la temporada según la edad
export function probRetiro(edad) {
    if (!edad || edad < 33) return 0;
    return Math.min(0.85, [0.07, 0.12, 0.2, 0.3, 0.42, 0.55][edad - 33] ?? 0.7);
}

// Lesiones tras un accidente grave: probabilidad y carreras que se pierde
export const PROB_LESION = 0.3;
export const carrerasLesion = (rng) => rng.weighted([2, 3, 4, 5], n => ({ 2: 3, 3: 5, 4: 2, 5: 1 })[n]);
