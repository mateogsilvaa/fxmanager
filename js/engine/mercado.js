// Mercado de final de temporada
import { LIGAS_NACIONALES, NAC_LOCAL } from './constants.js';
import { calcularRiesgo } from './stats.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';
import { atributosAleatorios } from './juego.js';

export const MERCADO = {
    topGalactico: 5,          // el Galáctico sale del top 5 de su liga
    topComprador: 5,          // solo las 5 mejores escuderías de cada liga pueden pedir un Galáctico
    importeMinimo: 1_000_000, // oferta mínima
    importeIA: 2_000_000,     // lo que paga la liga cuando no hay oferta de un mánager
};

// Todas las permutaciones sin puntos fijos de las 5 ligas (quién compra a quién)
function desarreglos(lista) {
    const out = [];
    const perm = (resto, acc) => {
        if (!resto.length) { out.push(acc); return; }
        const i = acc.length;
        for (const x of resto) if (x !== lista[i]) perm(resto.filter(y => y !== x), [...acc, x]);
    };
    perm(lista, []);
    return out;
}

/**
 * tablas: {liga: temporada}, pilotos: [{id, nac, equipoId, liga, rol}], inmunes: Set de pids clasificados al Mundial,
 * ofertas: [{eq, pid, tactico, importe}] (eq = escudería compradora), posEquipo: {eq: posición en su liga}
 *
 * Cada liga cede un Galáctico (top 5) a otra liga. La escudería que lo recibe entrega a cambio a su Táctico
 * (un piloto suyo fuera del top 5) y un importe. Así cada liga pierde exactamente 2 pilotos y recibe 2.
 */
export function planMercado({ tablas, pilotos, inmunes, rng, ofertas = [], posEquipo = {} }) {
    // 1. Despidos (rendimiento contra el compañero)
    const despidos = [], salvados = [], riesgoPorLiga = {};
    for (const liga of LIGAS_NACIONALES) {
        const pl = pilotos.filter(p => p.liga === liga && p.equipoId);
        if (!tablas[liga]) continue;
        const riesgo = calcularRiesgo(tablas[liga], pl, { inmunes });
        riesgoPorLiga[liga] = riesgo;
        for (const r of riesgo) {
            if (r.zona === 'despido') despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'directo', riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
            else if (r.zona === 'peligro') {
                if (r.caeria) despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'peligro', riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
                else salvados.push({ pid: r.pid, eq: r.eq, liga, riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
            }
        }
    }
    const despedidos = new Set(despidos.map(d => d.pid));
    const porId = Object.fromEntries(pilotos.map(p => [p.id, p]));
    const companero = (p) => pilotos.find(o => o.equipoId === p.equipoId && o.id !== p.id);
    const posLiga = {};
    for (const liga of LIGAS_NACIONALES) tablas[liga]?.clasPilotos.forEach((s, i) => { posLiga[s.pid] = i + 1; });

    // Un piloto puede irse si su equipo conserva a un piloto local para el asiento de Piloto 1
    const puedeSalir = (p) => {
        if (!p?.equipoId || despedidos.has(p.id)) return false;
        const c = companero(p);
        return !!c && !despedidos.has(c.id) && c.nac === NAC_LOCAL[p.liga];
    };
    const esGalactico = (p) => puedeSalir(p) && (posLiga[p.id] || 99) <= 10;
    const esTactico = (p) => puedeSalir(p) && (posLiga[p.id] || 99) > MERCADO.topGalactico;
    const puedeComprar = (eq) => (posEquipo[eq] || 99) <= MERCADO.topComprador;

    // Ofertas válidas de los mánagers, de mayor a menor importe
    const validas = ofertas.map(o => {
        const g = porId[o.pid], t = porId[o.tactico];
        const comprador = pilotos.find(p => p.equipoId === o.eq);
        if (!g || !t || !comprador) return null;
        if (t.equipoId !== o.eq || g.liga === t.liga || !esGalactico(g) || !esTactico(t) || !puedeComprar(o.eq)) return null;
        return { ...o, de: g.liga, a: t.liga, eqVendedor: g.equipoId, humano: true };
    }).filter(Boolean).sort((a, b) => b.importe - a.importe);

    // 2 y 3. Para cada reparto posible (qué liga compra a cuál) se montan las 5 operaciones:
    // primero las ofertas de los mánagers y, donde no las haya, una operación decidida por la liga.
    // Se elige el reparto que cierra más operaciones y, a igualdad, el que más dinero de mánagers mueve.
    const construir = (destino, rngLocal) => {
        const usados = new Set(), equiposUsados = new Set();
        const ops = [];
        let valor = 0;
        for (const o of validas) {
            if (destino[o.de] !== o.a || ops.some(x => x.de === o.de)) continue;
            if (usados.has(o.pid) || usados.has(o.tactico) || equiposUsados.has(o.eq) || equiposUsados.has(o.eqVendedor)) continue;
            ops.push({ ...o, pos: posLiga[o.pid] }); valor += o.importe;
            usados.add(o.pid); usados.add(o.tactico); equiposUsados.add(o.eq); equiposUsados.add(o.eqVendedor);
        }
        for (const de of LIGAS_NACIONALES) {
            if (ops.some(x => x.de === de)) continue;
            const a = destino[de];
            const clasDe = (tablas[de]?.clasPilotos || []).map(s => porId[s.pid]).filter(p => p && p.liga === de);
            const equiposA = Object.entries(posEquipo).filter(([eq]) => pilotos.some(p => p.equipoId === eq && p.liga === a)).sort((x, y) => x[1] - y[1]).map(([eq]) => eq);
            let hecho = false;
            for (const corte of [MERCADO.topGalactico, 8, 10]) {
                const galacticos = clasDe.slice(0, corte).filter(p => puedeSalir(p) && !usados.has(p.id) && !equiposUsados.has(p.equipoId));
                if (!galacticos.length) continue;
                const g = rngLocal.weighted(galacticos, x => 11 - Math.min(10, (posLiga[x.id] || 10)));
                for (const eq of equiposA) {
                    if (equiposUsados.has(eq)) continue;
                    const t = pilotos.filter(p => p.equipoId === eq && puedeSalir(p) && (posLiga[p.id] || 99) > MERCADO.topGalactico && !usados.has(p.id))
                        .sort((x, y) => (posLiga[x.id] || 99) - (posLiga[y.id] || 99))[0];
                    if (!t) continue;
                    ops.push({ eq, pid: g.id, tactico: t.id, importe: MERCADO.importeIA, de, a, eqVendedor: g.equipoId, humano: false, pos: posLiga[g.id] });
                    usados.add(g.id); usados.add(t.id); equiposUsados.add(eq); equiposUsados.add(g.equipoId);
                    hecho = true; break;
                }
                if (hecho) break;
            }
        }
        return { ops, valor };
    };
    let mejor = null;
    for (const perm of rng.shuffle(desarreglos(LIGAS_NACIONALES))) {
        const destino = Object.fromEntries(LIGAS_NACIONALES.map((l, i) => [l, perm[i]]));
        const r = construir(destino, rng);
        const puntuacion = r.ops.length * 1e12 + r.valor;
        if (!mejor || puntuacion > mejor.puntuacion) mejor = { ...r, puntuacion };
        if (r.ops.length === LIGAS_NACIONALES.length && !validas.length) break;
    }
    // Si alguna liga no puede cerrar su operación se anula el ciclo entero (nunca queda una liga descompensada)
    const operaciones = mejor && mejor.ops.length === LIGAS_NACIONALES.length ? mejor.ops : [];

    // Formato de traspasos individuales (lo que se aplica al cerrar el mercado)
    const traspasos = operaciones.flatMap(o => [
        { pid: o.pid, tipo: 'galactico', de: o.de, a: o.a, eqOrigen: o.eqVendedor, eqDestino: o.eq, importe: o.importe, humano: o.humano, pos: o.pos },
        { pid: o.tactico, tipo: 'tactico', de: o.a, a: o.de, eqOrigen: o.eq, eqDestino: o.eqVendedor, importe: 0, humano: o.humano, pos: posLiga[o.tactico] },
    ]);
    const vacantes = despidos.map(d => ({ eq: d.eq, liga: d.liga, deja: d.pid }));
    return { despidos, salvados, traspasos, operaciones, vacantes, riesgo: riesgoPorLiga };
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
