// Ingenieros (desde la temporada 2)
// Cada escudería tiene 2 huecos por área técnica (motor, aero, chasis, fiabilidad) y 1 ingeniero de pista.
// La plantilla entera vive en un solo documento público: ingenieros/plantilla = { lista: { id: ingeniero } }.
import { AREAS, LIGAS_NACIONALES, NAC_LOCAL } from './constants.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';

export const CATEGORIAS_ING = {
    motor: { nombre: 'Motor', huecos: 2 },
    aero: { nombre: 'Aerodinámica', huecos: 2 },
    chasis: { nombre: 'Chasis', huecos: 2 },
    fiabilidad: { nombre: 'Fiabilidad', huecos: 2 },
    pista: { nombre: 'Ingeniero de pista', huecos: 1 },
};
export const REF_PLANTILLA = 'ingenieros/plantilla';
export const LIBRES_POR_CATEGORIA = 9;

// Precio de fichar a un ingeniero libre (prima) y su sueldo diario, según sus estrellas
export const primaIngeniero = (e) => Math.round(e * e * 120_000 / 10_000) * 10_000;
export const salarioIngeniero = (e) => 8_000 + e * 7_000;
// Valor de mercado (lo usa la IA para negociar)
export const valorIngeniero = (e) => primaIngeniero(e) * 1.6;
export const indemnizacion = (ing) => salarioIngeniero(ing.estrellas) * 10;

export function crearIngeniero(rng, { cat, estrellas, equipoId = null, liga = null, usados, n }) {
    const nac = liga && rng.chance(0.6) ? NAC_LOCAL[liga] : rng.pick([...Object.values(NAC_LOCAL), ...EXTRANJEROS.ESP, ...EXTRANJEROS.GBR]);
    const { nombre, apellido } = nombreAleatorio(rng, nac, usados);
    return { id: `ing_${cat}_${n}`, nombre, apellido, nac, cat, estrellas, edad: rng.int(26, 62), equipoId };
}

// Plantilla inicial: cada escudería empieza con 1 ingeniero por área y el de pista (1–3 estrellas); el resto libres
export function plantillaInicial(rng, equipos, { usados = new Set() } = {}) {
    const lista = {};
    let n = 0;
    const add = (ing) => { lista[ing.id] = ing; usados.add(`${ing.nombre} ${ing.apellido}`); };
    for (const [eqId, eq] of Object.entries(equipos)) {
        if (!LIGAS_NACIONALES.includes(eq.liga)) continue;
        for (const cat of Object.keys(CATEGORIAS_ING)) add(crearIngeniero(rng, { cat, estrellas: rng.weighted([1, 2, 3], x => [5, 4, 1][x - 1]), equipoId: eqId, liga: eq.liga, usados, n: n++ }));
    }
    for (const cat of Object.keys(CATEGORIAS_ING)) for (let i = 0; i < LIBRES_POR_CATEGORIA; i++) add(crearIngeniero(rng, { cat, estrellas: rng.weighted([1, 2, 3, 4, 5], x => [3, 4, 3, 2, 1][x - 1]), usados, n: n++ }));
    return lista;
}

export const deEquipo = (lista, eqId) => Object.values(lista || {}).filter(i => i.equipoId === eqId);
export const libres = (lista) => Object.values(lista || {}).filter(i => !i.equipoId);
export const huecoLibre = (lista, eqId, cat) => deEquipo(lista, eqId).filter(i => i.cat === cat).length < CATEGORIAS_ING[cat].huecos;

// Resumen de efectos para equipos_priv.bonusIng (suma de estrellas por categoría)
export function bonusDe(lista, eqId) {
    const b = Object.fromEntries(Object.keys(CATEGORIAS_ING).map(c => [c, 0]));
    for (const i of deEquipo(lista, eqId)) b[i.cat] += i.estrellas;
    return b;
}
export const sueldoDiario = (lista, eqId) => deEquipo(lista, eqId).reduce((s, i) => s + salarioIngeniero(i.estrellas), 0);

export const estrellasTxt = (e) => '★'.repeat(e) + '☆'.repeat(5 - e);
void AREAS;
