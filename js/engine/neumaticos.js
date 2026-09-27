// Neumáticos: vida de cada compuesto, estimación que da el ingeniero tras los libres y estrategias de carrera.
// Solo la carrera larga (R3) tiene estrategia de neumáticos y paradas.
import { crearRng } from './rng.js';

export const COMPUESTOS = {
    blando: { nombre: 'Blando', corto: 'B', ritmo: 0.9945, vidaBase: 6 },
    medio: { nombre: 'Medio', corto: 'M', ritmo: 1, vidaBase: 11 },
    duro: { nombre: 'Duro', corto: 'D', ritmo: 1.003, vidaBase: 17 },
};
export const MAX_PARADAS = 2;

// Vida real (vueltas) de cada compuesto en un evento: depende del circuito y de un factor secreto del día
export function vidaNeumaticos(secreto, eventoId, circuito) {
    const rng = crearRng(`${secreto}|neumaticos|${eventoId}`);
    const circ = 1.25 - 0.5 * (circuito.desgaste ?? 0.5);
    const out = {};
    for (const [k, c] of Object.entries(COMPUESTOS)) out[k] = Math.max(3, Math.round(c.vidaBase * circ * (0.85 + rng.next() * 0.3)));
    return out;
}
// El ritmo de carrera cambia cuánto aguantan
export const factorVida = (ritmo) => ritmo === 'conservador' ? 1.15 : ritmo === 'ataque' ? 0.85 : 1;
// Pérdida por parar en boxes (ms)
export const perdidaBoxes = (circuito) => Math.round((circuito.tiempoBase || 100000) * 0.16);

// Degradación (fracción del tiempo por vuelta) con una edad de neumático dada
export function degradacion(edad, vida) {
    return 0.0003 * edad + (edad > vida ? 0.0045 * (edad - vida) * (1 + 0.15 * (edad - vida)) : 0);
}

// Coste estimado (ms sobre una vuelta de referencia) de una estrategia completa
export function costeEstrategia({ neumatico = 'medio', paradas = [] }, vidas, n, circuito, ritmo = 'equilibrado') {
    const base = circuito.tiempoBase || 100000;
    const plan = [...paradas].sort((a, b) => a.vuelta - b.vuelta);
    let coste = 0, comp = neumatico, edad = 0, k = 0;
    for (let v = 1; v <= n; v++) {
        const vida = (vidas[comp] || 10) * factorVida(ritmo);
        coste += base * ((COMPUESTOS[comp].ritmo - 1) + degradacion(edad, vida));
        edad++;
        if (plan[k] && plan[k].vuelta === v && v < n) { coste += perdidaBoxes(circuito); comp = plan[k].neumatico; edad = 0; k++; }
    }
    return coste;
}

// La mejor estrategia (0, 1 o 2 paradas) para unas vidas dadas
export function mejorEstrategia(vidas, n, circuito, ritmo = 'equilibrado') {
    const comps = Object.keys(COMPUESTOS);
    let mejor = null;
    const probar = (e) => { const c = costeEstrategia(e, vidas, n, circuito, ritmo); if (!mejor || c < mejor.coste) mejor = { ...e, coste: c }; };
    for (const a of comps) {
        probar({ neumatico: a, paradas: [] });
        for (let v1 = 3; v1 <= n - 3; v1++) for (const b of comps) {
            probar({ neumatico: a, paradas: [{ vuelta: v1, neumatico: b }] });
            for (let v2 = v1 + 3; v2 <= n - 3; v2++) for (const c of comps) probar({ neumatico: a, paradas: [{ vuelta: v1, neumatico: b }, { vuelta: v2, neumatico: c }] });
        }
    }
    return mejor;
}

// Precisión de la lectura de los libres (0..1): reglaje, simulador, experiencia del piloto y vueltas completadas
export function precisionLibres({ setupQ = 0.6, simulador = 0, experiencia = 50, vueltas = 1 }) {
    const p = 0.45 * setupQ + 0.3 * Math.min(1, simulador / 5) + 0.25 * Math.min(1, experiencia / 100);
    return Math.max(0, Math.min(1, p * (0.4 + 0.6 * Math.min(1, vueltas))));
}
// Rango estimado de vida para cada compuesto (cuanto más precisión, más estrecho)
export function estimarVidas(vidas, precision, rng) {
    const margen = Math.max(0, Math.round((1 - precision) * 9));
    const out = {};
    for (const [k, v] of Object.entries(vidas)) {
        const centro = v + (margen ? rng.int(-Math.ceil(margen / 2), Math.ceil(margen / 2)) : 0);
        out[k] = [Math.max(2, centro - margen), Math.max(2, centro + margen)];
    }
    return { rangos: out, precision: Math.round(precision * 100) / 100 };
}
export const textoPrecision = (p) => p >= 0.8 ? 'muy fiable' : p >= 0.6 ? 'bastante fiable' : p >= 0.4 ? 'aproximada' : 'poco fiable';

// Normaliza la estrategia de neumáticos que manda un mánager
export function limpiarEstrategia(e, n) {
    const neumatico = COMPUESTOS[e?.neumatico] ? e.neumatico : 'medio';
    const paradas = (Array.isArray(e?.paradas) ? e.paradas : [])
        .map(p => ({ vuelta: Math.round(+p.vuelta), neumatico: COMPUESTOS[p.neumatico] ? p.neumatico : 'medio' }))
        .filter(p => p.vuelta >= 1 && p.vuelta < n)
        .sort((a, b) => a.vuelta - b.vuelta)
        .filter((p, i, arr) => !i || p.vuelta !== arr[i - 1].vuelta)
        .slice(0, MAX_PARADAS);
    return { neumatico, paradas };
}
