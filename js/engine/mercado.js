// Mercado de final de temporada
import { LIGAS_NACIONALES, NAC_LOCAL } from './constants.js';
import { calcularRiesgo } from './stats.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';
import { atributosAleatorios } from './juego.js';

// tablas: {liga: temporada}, pilotos: catálogo [{id, nac, equipoId, liga, rol}], inmunes: Set de pids clasificados al Mundial
export function planMercado({ tablas, pilotos, inmunes, rng }) {
    const despidos = [], salvados = [], riesgoPorLiga = {};
    for (const liga of LIGAS_NACIONALES) {
        const pl = pilotos.filter(p => p.liga === liga && p.equipoId);
        if (!tablas[liga]) continue;
        const riesgo = calcularRiesgo(tablas[liga], pl, { inmunes });
        riesgoPorLiga[liga] = riesgo;
        for (const r of riesgo) {
            if (r.zona === 'despido') despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'directo', riesgo: r.riesgo });
            else if (r.zona === 'peligro') {
                if (r.caeria) despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'peligro', riesgo: r.riesgo });
                else salvados.push({ pid: r.pid, eq: r.eq, liga, riesgo: r.riesgo });
            }
        }
    }
    const despedidos = new Set(despidos.map(d => d.pid));

    const elegible = (p, usados) => {
        if (despedidos.has(p.id) || usados.has(p.id)) return false;
        const comp = pilotos.find(o => o.equipoId === p.equipoId && o.id !== p.id);
        if (!comp || despedidos.has(comp.id) || usados.has(comp.id)) return false;
        return comp.nac === NAC_LOCAL[p.liga]; // el equipo debe conservar un piloto local para el asiento de Piloto 1
    };

    const usados = new Set();
    const traspasos = [];
    for (const tipo of ['galactico', 'tactico']) {
        const elegidos = [];
        for (const liga of LIGAS_NACIONALES) {
            const t = tablas[liga];
            if (!t) continue;
            const clas = t.clasPilotos.map(s => pilotos.find(p => p.id === s.pid)).filter(p => p && p.liga === liga && p.equipoId);
            const rango = tipo === 'galactico' ? clas.slice(0, 5) : clas.slice(6, 14);
            let cands = rango.filter(p => elegible(p, usados));
            if (!cands.length && tipo === 'galactico') cands = clas.slice(5, 8).filter(p => elegible(p, usados));
            if (!cands.length) continue;
            const p = tipo === 'galactico'
                ? rng.weighted(cands, x => 6 - Math.min(5, clas.indexOf(x)))
                : rng.pick(cands);
            usados.add(p.id);
            elegidos.push(p);
        }
        // Ciclo: cada piloto ocupa el asiento del elegido de la siguiente liga
        const orden = rng.shuffle(elegidos);
        if (orden.length >= 2) {
            orden.forEach((p, i) => {
                const destino = orden[(i + 1) % orden.length];
                traspasos.push({ pid: p.id, tipo, de: p.liga, a: destino.liga, eqOrigen: p.equipoId, eqDestino: destino.equipoId });
            });
        }
    }

    const vacantes = despidos.map(d => ({ eq: d.eq, liga: d.liga, deja: d.pid }));
    return { despidos, salvados, traspasos, vacantes, riesgo: riesgoPorLiga };
}

// Bolsa de rookies para el draft
export function generarRookies({ temporada, vacantes, rng, usados = new Set() }) {
    const porLiga = {};
    vacantes.forEach(v => { porLiga[v.liga] = (porLiga[v.liga] || 0) + 1; });
    const rookies = [];
    for (const liga of LIGAS_NACIONALES) {
        const n = (porLiga[liga] || 0) + 3;
        for (let i = 0; i < n; i++) {
            const nac = i < Math.ceil(n * 0.7) ? NAC_LOCAL[liga] : rng.pick(EXTRANJEROS[liga]);
            const { nombre, apellido } = nombreAleatorio(rng, nac, usados);
            rookies.push({
                id: `rk${temporada + 1}_${liga}_${i}`, nombre, apellido, nac, liga, edad: rng.int(17, 21),
                attrs: atributosAleatorios(rng, { rookie: true }),
            });
        }
    }
    return rookies;
}

// Estrellas visibles para el draft (estimación ruidosa del potencial)
export function estrellasRookie(attrs, rng) {
    const v = (attrs.ritmo + attrs.potencial) / 2 + rng.int(-3, 3);
    return Math.max(1, Math.min(5, Math.round((v - 62) / 6)));
}

// Asigna Piloto 1 / Piloto 2 para cumplir la cuota: el Piloto 1 debe ser local
export function asignarRoles(pilotosEquipo, liga) {
    const local = NAC_LOCAL[liga];
    const locales = pilotosEquipo.filter(p => p.nac === local);
    const p1Local = pilotosEquipo.find(p => p.rol === 'P1' && p.nac === local) || locales.sort((a, b) => (b.attrs?.ritmo || 0) - (a.attrs?.ritmo || 0))[0] || null;
    const p1 = p1Local || pilotosEquipo[0];
    return pilotosEquipo.map(p => ({ id: p.id, rol: p1 && p.id === p1.id ? 'P1' : 'P2', cumpleCuota: !!p1Local }));
}
