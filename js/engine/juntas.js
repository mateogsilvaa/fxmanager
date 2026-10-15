// Juntas de pilotos (desde la temporada 2): dos por temporada, durante la liga nacional. Se votan micro-cambios del
// reglamento. Cada piloto titular tiene un voto (su mánager le da una consigna, pero con la moral baja puede votar
// lo que le dé la gana) y la FIA tiene un bloque de votos propio. Lo que sale se aplica desde la siguiente sesión.
//
// config/juego.normas = { puntos, ultimaCarrera, vr, qualy, parrillaInvertida, premios, sanciones: [{ pid, puestos }] }
import { PUNTOS_CARRERA, PUNTOS_CARRERA_LARGA, PUNTOS_QUALY, PUNTOS_VR } from './constants.js';

export const VOTOS_FIA = 20;
export const HORAS_JUNTA = 48;
export const TEMAS_POR_JUNTA = 3;

const largo = (l) => l.map(p => Math.round(p * 1.3));
export const SISTEMAS_PUNTOS = {
    actual: { nombre: 'El de ahora', corta: PUNTOS_CARRERA, larga: PUNTOS_CARRERA_LARGA },
    top10: { nombre: 'Solo puntúan los 10 primeros (25-18-15…)', corta: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], larga: largo([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]) },
    ganador: { nombre: 'Premiar más la victoria (40-28-22…)', corta: [40, 28, 22, 19, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3], larga: largo([40, 28, 22, 19, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3]) },
    reparto: { nombre: 'Puntúan los 20 (25-22-20… hasta 1)', corta: [25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], larga: largo([25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) },
};
export const NORMAS_BASE = { puntos: 'actual', ultimaCarrera: 1, vr: 3, qualy: 'actual', parrillaInvertida: false, premios: 1, sanciones: [] };
export const normasDe = (cfg) => ({ ...NORMAS_BASE, ...(cfg?.normas || {}) });

// Puntos que reparte cada sesión con las normas vigentes
export function tablaPuntos(tipo, normas) {
    const n = { ...NORMAS_BASE, ...(normas || {}) };
    const s = SISTEMAS_PUNTOS[n.puntos] || SISTEMAS_PUNTOS.actual;
    if (tipo === 'qualy') return n.qualy === 'no' ? [] : n.qualy === 'top3' ? [5, 3, 1] : PUNTOS_QUALY;
    return tipo === 'R3' ? s.larga : s.corta;
}
export const puntosVR = (normas) => (normas?.vr ?? PUNTOS_VR);

// Catálogo de temas. Cada opción tiene el valor que se guarda en las normas. fia = lo que vota la FIA.
// ia(ctx) = preferencia de una escudería de la IA: { pos (en su liga), n, presupuesto, rng, propio (sanción) }
export const TEMAS = {
    ultimaCarrera: {
        titulo: 'La última carrera de la liga', texto: '¿Cuánto debería valer la Carrera 3 de la última jornada de cada liga nacional?',
        opciones: [{ id: '1', texto: 'Como cualquier otra', valor: 1 }, { id: '1.5', texto: 'Puntos ×1,5', valor: 1.5 }, { id: '2', texto: 'Puntos dobles', valor: 2 }],
        fia: '1', campo: 'ultimaCarrera',
        ia: ({ pos, n }) => pos <= 2 ? '1' : pos >= n * 0.6 ? '2' : '1.5',
    },
    puntos: {
        titulo: 'Sistema de puntuación', texto: '¿Cómo se reparten los puntos en las carreras?',
        opciones: Object.entries(SISTEMAS_PUNTOS).map(([id, s]) => ({ id, texto: s.nombre, valor: id })),
        fia: 'actual', campo: 'puntos',
        ia: ({ pos, n, rng }) => pos <= 3 ? rng.pick(['actual', 'ganador']) : pos >= n * 0.7 ? 'reparto' : rng.pick(['actual', 'top10', 'reparto']),
    },
    vr: {
        titulo: 'Puntos por vuelta rápida', texto: '¿Cuántos puntos debería dar la vuelta rápida de cada carrera?',
        opciones: [{ id: '0', texto: 'Ninguno', valor: 0 }, { id: '1', texto: '1 punto', valor: 1 }, { id: '3', texto: '3 puntos (como ahora)', valor: 3 }, { id: '5', texto: '5 puntos', valor: 5 }],
        fia: '3', campo: 'vr',
        ia: ({ rng }) => rng.weighted(['0', '1', '3', '5'], x => ({ 0: 1, 1: 2, 3: 4, 5: 2 })[x]),
    },
    qualy: {
        titulo: 'Puntos en clasificación', texto: '¿Deben dar puntos las clasificaciones?',
        opciones: [{ id: 'actual', texto: 'Sí, a los 5 primeros (como ahora)', valor: 'actual' }, { id: 'top3', texto: 'Solo al podio (5-3-1)', valor: 'top3' }, { id: 'no', texto: 'No, solo cuentan las carreras', valor: 'no' }],
        fia: 'actual', campo: 'qualy',
        ia: ({ pos, rng }) => pos <= 3 ? 'actual' : rng.pick(['actual', 'top3', 'no']),
    },
    parrillaInvertida: {
        titulo: 'Parrilla invertida en la Carrera 2', texto: '¿Salen los 8 primeros de la Clasificación 2 en orden inverso en la Carrera 2?',
        opciones: [{ id: 'no', texto: 'No, como ahora', valor: false }, { id: 'si', texto: 'Sí, top 8 invertido', valor: true }],
        fia: 'no', campo: 'parrillaInvertida',
        ia: ({ pos, n }) => pos <= Math.ceil(n * 0.3) ? 'no' : 'si',
    },
    premios: {
        titulo: 'Premios por punto', texto: '¿Cuánto paga la liga por cada punto conseguido?',
        opciones: [{ id: '0.8', texto: 'Menos (×0,8) para igualar presupuestos', valor: 0.8 }, { id: '1', texto: 'Igual que ahora', valor: 1 }, { id: '1.25', texto: 'Más (×1,25)', valor: 1.25 }],
        fia: '1', campo: 'premios',
        ia: ({ pos, n, presupuesto }) => presupuesto < 5_000_000 ? '1.25' : pos >= n * 0.6 ? '0.8' : '1.25',
    },
    // Tema con protagonista: el piloto que más incidentes ha provocado
    sancion: {
        titulo: 'Sanción a {nombre}', texto: '{nombre} ({equipo}) acumula {errores} errores e incidentes esta temporada. ¿Debe sancionarle la junta?',
        opciones: [{ id: 'nada', texto: 'No, son cosas de las carreras', valor: null }, { id: 'multa', texto: 'Multa de 500.000 € a su escudería', valor: 'multa' }, { id: 'parrilla', texto: '5 puestos de penalización en su próxima carrera', valor: 'parrilla' }],
        fia: 'parrilla', campo: null,
        ia: ({ propio, rng }) => propio ? 'nada' : rng.weighted(['nada', 'multa', 'parrilla'], x => ({ nada: 2, multa: 3, parrilla: 3 })[x]),
    },
};
export const MULTA_SANCION = 500_000;

export const rellenarTema = (t, v = {}) => String(t).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Recuento: votos = [{ opcion }], devuelve { cuenta: {op: n}, ganador }
export function recuento(tema, votos, fiaOpcion) {
    const cuenta = Object.fromEntries(tema.opciones.map(o => [o.id, 0]));
    for (const v of votos) if (v in cuenta) cuenta[v]++;
    if (fiaOpcion in cuenta) cuenta[fiaOpcion] += VOTOS_FIA;
    const max = Math.max(...Object.values(cuenta));
    const empatados = Object.keys(cuenta).filter(k => cuenta[k] === max);
    const ganador = empatados.includes(fiaOpcion) ? fiaOpcion : empatados[0];
    return { cuenta, ganador };
}

// ¿Obedece el piloto la consigna de su mánager? Depende de la moral
export const probObedecer = (moral) => (moral ?? 60) >= 60 ? 0.92 : (moral ?? 60) >= 40 ? 0.75 : 0.5;
