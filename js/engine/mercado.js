// Mercado de final de temporada
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL } from './constants.js';
import { calcularRiesgo } from './stats.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';
import { atributosAleatorios } from './juego.js';

export const MERCADO = {
    topGalactico: 5,            // el Galáctico sale del top 5 de su liga (uno por liga)
    topComprador: 3,            // solo las 3 mejores escuderías de cada liga pueden pedir un Galáctico
    importeMinimo: 1_000_000,   // oferta mínima por un Galáctico
    importeIA: 2_000_000,       // lo que paga una escudería de la IA que se lleva un Galáctico
    compensacionLiga: 2_000_000,// lo que cobra la escudería que pierde al Galáctico si deja decidir a la liga
    precioSimbolico: 300_000,   // lo que paga quien recibe un Galáctico sin haberlo pedido
    probSuerte: 0.04,           // probabilidad de que la liga se lo dé a una escudería al azar
    diasVentana: 3,             // días de mercado tras el Mundial
    minLocales: 11,             // 55% de los 20 pilotos de cada liga deben ser locales
    fichajeMinimo: 250_000,     // oferta mínima por un piloto para cubrir una vacante
};

// Valor de mercado orientativo de un piloto según su posición final (lo usa la IA para vender o aceptar trueques)
export function valorPiloto(pos, n = 20) {
    const p = Math.max(1, Math.min(n, pos || n));
    return Math.round((500_000 + (n - p) * 150_000) / 50_000) * 50_000;
}

// ---------- Regla del 55% de pilotos locales ----------
// pilotos: [{id, nac, equipoId, liga}] · equipos: {id: {liga}}
// Una vacante cuenta como posible local (el draft la cubre con un rookie local si hace falta).
export function estadoCuota(pilotos, equipos) {
    const out = {};
    for (const liga of LIGAS_NACIONALES) {
        const eqs = Object.entries(equipos).filter(([, e]) => e.liga === liga).map(([id]) => id);
        let locales = 0, vacantes = 0, sinLocal = [];
        for (const eq of eqs) {
            const suyos = pilotos.filter(p => p.equipoId === eq);
            const loc = suyos.filter(p => p.nac === NAC_LOCAL[liga]).length;
            locales += loc; vacantes += Math.max(0, 2 - suyos.length);
            if (suyos.length >= 2 && !loc) sinLocal.push(eq);
        }
        out[liga] = { locales, vacantes, sinLocal, ok: locales + vacantes >= MERCADO.minLocales && !sinLocal.length };
    }
    return out;
}

// ¿Se puede hacer este cambio sin romper la regla? cambios: [{pid, eq}] (eq null = sale de la parrilla)
// Solo falla si una liga que cumplía deja de cumplir (o una que no cumplía empeora).
export function cuotaTrasCambios(pilotos, equipos, cambios) {
    const antes = estadoCuota(pilotos, equipos);
    const mov = Object.fromEntries(cambios.map(c => [c.pid, c.eq]));
    const despues = estadoCuota(pilotos.map(p => p.id in mov ? { ...p, equipoId: mov[p.id], liga: mov[p.id] ? equipos[mov[p.id]]?.liga : null } : p), equipos);
    for (const liga of LIGAS_NACIONALES) {
        const a = antes[liga], d = despues[liga];
        if (d.ok) continue;
        if (!a.ok && d.locales + d.vacantes >= a.locales + a.vacantes && d.sinLocal.length <= a.sinLocal.length) continue;
        const motivo = d.sinLocal.length > a.sinLocal.length ? 'una escudería se quedaría sin piloto local' : `${LIGAS[liga]?.nombre || liga} bajaría del 55% de pilotos locales`;
        return { ok: false, motivo: `No cumple la regla del 55%: ${motivo}.` };
    }
    return { ok: true };
}

// Despidos: los dos que peor rinden contra su compañero en cada liga (y los de la zona de peligro que caen)
export function planDespidos({ tablas, pilotos, inmunes }) {
    const despidos = [], salvados = [];
    for (const liga of LIGAS_NACIONALES) {
        const pl = pilotos.filter(p => p.liga === liga && p.equipoId);
        if (!tablas[liga]) continue;
        for (const r of calcularRiesgo(tablas[liga], pl, { inmunes })) {
            if (r.zona === 'despido') despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'directo', riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
            else if (r.zona === 'peligro') {
                if (r.caeria) despidos.push({ pid: r.pid, eq: r.eq, liga, motivo: 'peligro', riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
                else salvados.push({ pid: r.pid, eq: r.eq, liga, riesgo: r.riesgo, pos: r.pos, posComp: r.posComp });
            }
        }
    }
    return { despidos, salvados };
}

// Un Galáctico por liga, del top 5. Tiene prioridad el que más dinero ha atraído en ofertas;
// si nadie ha pujado por ninguno, la liga elige (más probable cuanto mejor clasificado).
// Solo puede salir un piloto cuyo compañero sea local y siga en el equipo.
export function elegirGalacticos({ tablas, pilotos, ofertas = [], rng, despedidos = new Set() }) {
    const porId = Object.fromEntries(pilotos.map(p => [p.id, p]));
    const out = [];
    for (const liga of LIGAS_NACIONALES) {
        const clas = tablas[liga]?.clasPilotos || [];
        const elegible = ({ p }) => {
            if (!p?.equipoId || despedidos.has(p.id)) return false;
            const comp = pilotos.find(o => o.equipoId === p.equipoId && o.id !== p.id);
            return !!comp && !despedidos.has(comp.id) && comp.nac === NAC_LOCAL[liga];
        };
        // Top 5; si ninguno puede salir (su compañero no es local), se amplía al top 8 y luego al top 10
        let cands = [];
        for (const corte of [MERCADO.topGalactico, 8, 10]) {
            cands = clas.slice(0, corte).map((s, i) => ({ p: porId[s.pid], pos: i + 1 })).filter(elegible);
            if (cands.length) break;
        }
        if (!cands.length) continue;
        const puja = (pid) => ofertas.filter(o => o.pid === pid).reduce((s, o) => s + o.importe, 0);
        const conPuja = cands.filter(c => puja(c.p.id) > 0).sort((a, b) => puja(b.p.id) - puja(a.p.id));
        const g = conPuja[0] || rng.weighted(cands, c => 11 - Math.min(10, c.pos));
        out.push({ liga, pid: g.p.id, eq: g.p.equipoId, pos: g.pos });
    }
    return out;
}

// El piloto que entrega una escudería a cambio de un Galáctico: su segundo piloto (nunca el único local)
export function tacticoDe(pilotos, eq, liga) {
    const suyos = pilotos.filter(p => p.equipoId === eq);
    const locales = suyos.filter(p => p.nac === NAC_LOCAL[liga]);
    const orden = suyos.slice().sort((a, b) => (a.rol === 'P2' ? -1 : 1) - (b.rol === 'P2' ? -1 : 1));
    return orden.find(p => !(locales.length === 1 && locales[0].id === p.id)) || null;
}

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
