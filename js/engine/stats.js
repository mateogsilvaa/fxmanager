// Estadísticas, clasificaciones, récords, riesgo de despido y proyección del Mundial
import { esCarrera, esQualy, SESIONES, LIGAS_NACIONALES, PLAZAS_MUNDIAL, NAC_LOCAL } from './constants.js';
import { desviacionVueltas } from './sim.js';

const ESTADO = { FIN: 0, DNF: 1, 'SIN TIEMPO': 2 };
const ESTADO_INV = ['FIN', 'DNF', 'SIN TIEMPO'];

// ---------- Formato compacto (para el documento resumen) ----------
export function compactar(res) {
    const filas = res.filas.map(f => {
        const valid = f.laps.filter(t => t > 0);
        const media = valid.length ? Math.round(valid.reduce((s, t) => s + t, 0) / valid.length) : 0;
        const sd = esCarrera(res.tipo) ? desviacionVueltas(f.laps) : null;
        const sdPct = sd != null && media ? Math.round(sd / media * 100000) : -1; // milésimas de %
        const led = f.posLap ? f.posLap.filter(p => p === 1).length : 0;
        return [f.pid, f.eq, f.pos, f.parrilla ?? 0, f.pts, f.mejor ?? 0, sdPct, ESTADO[f.estado] ?? 0, f.adel || 0, f.errores || 0, led, f.vueltas || 0, f.gap ?? -1];
    });
    return {
        sid: res.id, ev: res.eventoId, liga: res.liga, ronda: res.ronda, tipo: res.tipo,
        t: res.publishAt, rv: res.revealAt, ll: res.lluvia ? 1 : 0, vr: res.vr?.pid || null, r: filas,
    };
}

export function descompactar(c) {
    return {
        ...c,
        filas: c.r.map(a => ({
            pid: a[0], eq: a[1], pos: a[2], parrilla: a[3] || null, pts: a[4], mejor: a[5] || null,
            sdPct: a[6] >= 0 ? a[6] / 1000 : null, estado: ESTADO_INV[a[7]] || 'FIN', adel: a[8], errores: a[9],
            led: a[10], vueltas: a[11], gap: a[12] >= 0 ? a[12] : null,
        })),
    };
}

// ---------- Estadísticas de temporada ----------
function basePiloto(pid) {
    return {
        pid, eq: null, pts: 0, ptsCarrera: 0, ptsQualy: 0, carreras: 0, qualys: 0, victorias: 0, podios: 0, top5: 0,
        enPuntos: 0, poles: 0, qualyTop5: 0, vr: 0, dnf: 0, sinTiempo: 0, mejorRes: null, mejorQualy: null,
        sumaPos: 0, sumaParrilla: 0, sumaQualy: 0, posGanadas: 0, posPerdidas: 0, adel: 0, errores: 0, lideradas: 0,
        sdSum: 0, sdN: 0, ultimos: 0, h2hC: { g: 0, p: 0 }, h2hQ: { g: 0, p: 0 }, rachaSinPuntos: 0, maxRachaSinPuntos: 0,
        ptsEvento: {}, mejorRemontada: 0, peorCaida: 0, historial: [], lluviaPts: 0,
    };
}
function baseEquipo(eq) {
    return {
        eq, pts: 0, ptsCarrera: 0, ptsQualy: 0, carreras: 0, victorias: 0, podios: 0, dobletes: 0, poles: 0, vr: 0,
        dnf: 0, adel: 0, errores: 0, sdSum: 0, sdN: 0, ptsEvento: {}, sumaPos: 0, nPos: 0, lideradas: 0, posGanadas: 0,
        ambosEnPuntos: 0, mejorRes: null,
    };
}

export function eficacia(sdPct) {
    if (sdPct == null) return null;
    return Math.max(0, Math.min(100, Math.round(100 - sdPct * 80)));
}

// sesiones: lista descompactada, ordenada cronológicamente. companeros: {pid: pidCompañero}
export function construirTemporada(sesiones, { companeros = {} } = {}) {
    const P = {}, E = {};
    const gp = (pid) => (P[pid] ||= basePiloto(pid));
    const ge = (eq) => (E[eq] ||= baseEquipo(eq));
    const ordenadas = sesiones.slice().sort((a, b) => a.t - b.t || SESIONES.indexOf(a.tipo) - SESIONES.indexOf(b.tipo));

    for (const s of ordenadas) {
        if (s.tipo === 'FP') {
            s.filas.forEach(f => gp(f.pid).historial.push({ sid: s.sid, ev: s.ev, ronda: s.ronda, tipo: s.tipo, pos: f.pos, pts: 0, estado: f.estado }));
            continue;
        }
        const carrera = esCarrera(s.tipo);
        const n = s.filas.length;
        const porEq = {};
        for (const f of s.filas) {
            const p = gp(f.pid), e = ge(f.eq);
            p.eq = f.eq;
            p.pts += f.pts; e.pts += f.pts;
            p.ptsEvento[s.ev] = (p.ptsEvento[s.ev] || 0) + f.pts;
            e.ptsEvento[s.ev] = (e.ptsEvento[s.ev] || 0) + f.pts;
            (porEq[f.eq] ||= []).push(f);
            p.historial.push({ sid: s.sid, ev: s.ev, ronda: s.ronda, tipo: s.tipo, pos: f.pos, pts: f.pts, parrilla: f.parrilla, estado: f.estado, vr: s.vr === f.pid });
            if (carrera) {
                p.ptsCarrera += f.pts; e.ptsCarrera += f.pts;
                p.carreras++; e.carreras++;
                p.adel += f.adel; e.adel += f.adel;
                p.errores += f.errores; e.errores += f.errores;
                p.lideradas += f.led; e.lideradas += f.led;
                if (s.ll) p.lluviaPts += f.pts;
                if (f.estado === 'DNF') { p.dnf++; e.dnf++; }
                else {
                    if (f.pos === 1) { p.victorias++; e.victorias++; }
                    if (f.pos <= 3) { p.podios++; e.podios++; }
                    if (f.pos <= 5) p.top5++;
                    if (f.pts > 0) p.enPuntos++;
                    if (f.pos === s.filas.filter(x => x.estado === 'FIN').length && n > 1) p.ultimos++;
                    p.sumaPos += f.pos; e.sumaPos += f.pos; e.nPos++;
                    if (f.parrilla) {
                        const d = f.parrilla - f.pos;
                        if (d > 0) { p.posGanadas += d; e.posGanadas += d; } else p.posPerdidas += -d;
                        p.mejorRemontada = Math.max(p.mejorRemontada, d);
                        p.peorCaida = Math.max(p.peorCaida, -d);
                    }
                    if (p.mejorRes == null || f.pos < p.mejorRes) p.mejorRes = f.pos;
                    if (e.mejorRes == null || f.pos < e.mejorRes) e.mejorRes = f.pos;
                }
                if (f.parrilla) p.sumaParrilla += f.parrilla;
                if (f.sdPct != null && f.estado === 'FIN') { p.sdSum += f.sdPct; p.sdN++; e.sdSum += f.sdPct; e.sdN++; }
                if (s.vr === f.pid) { p.vr++; e.vr++; }
                if (f.pts > 0) p.rachaSinPuntos = 0; else { p.rachaSinPuntos++; p.maxRachaSinPuntos = Math.max(p.maxRachaSinPuntos, p.rachaSinPuntos); }
            } else if (esQualy(s.tipo)) {
                p.ptsQualy += f.pts; e.ptsQualy += f.pts;
                p.qualys++;
                if (f.estado === 'SIN TIEMPO') p.sinTiempo++;
                else {
                    p.sumaQualy += f.pos;
                    if (f.pos === 1) { p.poles++; e.poles++; }
                    if (f.pos <= 5) p.qualyTop5++;
                    if (p.mejorQualy == null || f.pos < p.mejorQualy) p.mejorQualy = f.pos;
                }
            }
        }
        // Dobletes y duelos internos
        for (const [eq, fs] of Object.entries(porEq)) {
            if (fs.length !== 2) continue;
            const [a, b] = fs;
            if (carrera) {
                const posFin = fs.filter(f => f.estado === 'FIN').map(f => f.pos).sort((x, y) => x - y);
                if (posFin.length === 2 && posFin[0] === 1 && posFin[1] === 2) E[eq].dobletes++;
                if (a.pts > 0 && b.pts > 0) E[eq].ambosEnPuntos++;
            }
            const ganador = a.pos < b.pos ? a : b, perdedor = ganador === a ? b : a;
            const campo = carrera ? 'h2hC' : 'h2hQ';
            gp(ganador.pid)[campo].g++; gp(perdedor.pid)[campo].p++;
        }
    }

    const pilotos = Object.values(P).map(p => finalizarPiloto(p));
    const equipos = Object.values(E).map(e => ({
        ...e,
        sdMedio: e.sdN ? e.sdSum / e.sdN : null,
        eficacia: e.sdN ? eficacia(e.sdSum / e.sdN) : null,
        mediaPos: e.nPos ? e.sumaPos / e.nPos : null,
        mejorFinde: Math.max(0, ...Object.values(e.ptsEvento)),
    }));
    const clasPilotos = pilotos.slice().sort(ordenClasificacion);
    clasPilotos.forEach((p, i) => { p.posicion = i + 1; });
    const clasEquipos = equipos.slice().sort(ordenClasificacion);
    clasEquipos.forEach((e, i) => { e.posicion = i + 1; });
    const porPid = Object.fromEntries(clasPilotos.map(p => [p.pid, p]));
    const porEq = Object.fromEntries(clasEquipos.map(e => [e.eq, e]));
    return { pilotos: porPid, equipos: porEq, clasPilotos, clasEquipos, sesiones: ordenadas, companeros };
}

function finalizarPiloto(p) {
    const fin = p.carreras - p.dnf;
    return {
        ...p,
        mediaPos: fin ? p.sumaPos / fin : null,
        mediaParrilla: p.carreras ? p.sumaParrilla / p.carreras : null,
        mediaQualy: p.qualys - p.sinTiempo ? p.sumaQualy / (p.qualys - p.sinTiempo) : null,
        sdMedio: p.sdN ? p.sdSum / p.sdN : null,
        eficacia: p.sdN ? eficacia(p.sdSum / p.sdN) : null,
        mejorFinde: Math.max(0, ...Object.values(p.ptsEvento)),
        h2hTotal: { g: p.h2hC.g + p.h2hQ.g, p: p.h2hC.p + p.h2hQ.p },
    };
}

function ordenClasificacion(a, b) {
    return b.pts - a.pts || b.victorias - a.victorias || b.podios - a.podios || (a.mejorRes ?? 99) - (b.mejorRes ?? 99) || b.poles - a.poles;
}

// ---------- Récords (cada categoría devuelve el ranking completo) ----------
const r1 = (v, d = 1) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d;

export const CATEGORIAS_PILOTO = [
    { id: 'pts', nombre: 'Puntos', v: p => p.pts, bueno: true },
    { id: 'victorias', nombre: 'Victorias', v: p => p.victorias, bueno: true },
    { id: 'podios', nombre: 'Podios', v: p => p.podios, bueno: true },
    { id: 'poles', nombre: 'Poles', v: p => p.poles, bueno: true },
    { id: 'vr', nombre: 'Vueltas rápidas (bonus)', v: p => p.vr, bueno: true },
    { id: 'ptsQualy', nombre: 'Puntos en clasificación', v: p => p.ptsQualy, bueno: true },
    { id: 'enPuntos', nombre: 'Carreras en puntos', v: p => p.enPuntos, bueno: true },
    { id: 'mejorFinde', nombre: 'Mejor jornada (pts)', v: p => p.mejorFinde, bueno: true },
    { id: 'adel', nombre: 'Adelantamientos', v: p => p.adel, bueno: true },
    { id: 'posGanadas', nombre: 'Posiciones ganadas', v: p => p.posGanadas, bueno: true },
    { id: 'mejorRemontada', nombre: 'Mayor remontada en una carrera', v: p => p.mejorRemontada, bueno: true },
    { id: 'lideradas', nombre: 'Vueltas lideradas', v: p => p.lideradas, bueno: true },
    { id: 'eficacia', nombre: 'Eficacia en carrera', v: p => p.eficacia, bueno: true, sufijo: '/100', desc: 'Regularidad vuelta a vuelta: 100 = todas las vueltas casi idénticas.' },
    { id: 'mediaPos', nombre: 'Mejor media de llegada', v: p => r1(p.mediaPos), bueno: true, asc: true },
    { id: 'mediaQualy', nombre: 'Mejor media en clasificación', v: p => r1(p.mediaQualy), bueno: true, asc: true },
    { id: 'lluviaPts', nombre: 'Puntos bajo la lluvia', v: p => p.lluviaPts, bueno: true },
    // Lado oscuro
    { id: 'dnf', nombre: 'Abandonos', v: p => p.dnf, bueno: false },
    { id: 'errores', nombre: 'Errores de pilotaje', v: p => p.errores, bueno: false },
    { id: 'posPerdidas', nombre: 'Posiciones perdidas', v: p => p.posPerdidas, bueno: false },
    { id: 'peorCaida', nombre: 'Mayor caída en una carrera', v: p => p.peorCaida, bueno: false },
    { id: 'ultimos', nombre: 'Veces último', v: p => p.ultimos, bueno: false },
    { id: 'maxRachaSinPuntos', nombre: 'Racha más larga sin puntuar', v: p => p.maxRachaSinPuntos, bueno: false },
    { id: 'h2hPerdidos', nombre: 'Duelos perdidos contra su compañero', v: p => p.h2hTotal.p, bueno: false },
    { id: 'sinTiempo', nombre: 'Clasificaciones sin tiempo', v: p => p.sinTiempo, bueno: false },
    { id: 'eficaciaPeor', nombre: 'Menor eficacia en carrera', v: p => p.eficacia, bueno: false, asc: true, sufijo: '/100' },
    { id: 'mediaPosPeor', nombre: 'Peor media de llegada', v: p => r1(p.mediaPos), bueno: false },
];

export const CATEGORIAS_EQUIPO = [
    { id: 'pts', nombre: 'Puntos', v: e => e.pts, bueno: true },
    { id: 'victorias', nombre: 'Victorias', v: e => e.victorias, bueno: true },
    { id: 'podios', nombre: 'Podios', v: e => e.podios, bueno: true },
    { id: 'dobletes', nombre: 'Dobletes', v: e => e.dobletes, bueno: true },
    { id: 'poles', nombre: 'Poles', v: e => e.poles, bueno: true },
    { id: 'ambosEnPuntos', nombre: 'Carreras con ambos en puntos', v: e => e.ambosEnPuntos, bueno: true },
    { id: 'mejorFinde', nombre: 'Mejor jornada (pts)', v: e => e.mejorFinde, bueno: true },
    { id: 'ptsQualy', nombre: 'Puntos en clasificación', v: e => e.ptsQualy, bueno: true },
    { id: 'adel', nombre: 'Adelantamientos', v: e => e.adel, bueno: true },
    { id: 'lideradas', nombre: 'Vueltas lideradas', v: e => e.lideradas, bueno: true },
    { id: 'eficacia', nombre: 'Eficacia media en carrera', v: e => e.eficacia, bueno: true, sufijo: '/100' },
    { id: 'mediaPos', nombre: 'Mejor media de llegada', v: e => r1(e.mediaPos), bueno: true, asc: true },
    { id: 'dnf', nombre: 'Abandonos', v: e => e.dnf, bueno: false },
    { id: 'errores', nombre: 'Errores de pilotaje', v: e => e.errores, bueno: false },
    { id: 'eficaciaPeor', nombre: 'Menor eficacia media', v: e => e.eficacia, bueno: false, asc: true, sufijo: '/100' },
    { id: 'mediaPosPeor', nombre: 'Peor media de llegada', v: e => r1(e.mediaPos), bueno: false },
];

export function ranking(categoria, lista) {
    const filas = lista.map(x => ({ x, v: categoria.v(x) })).filter(r => r.v != null && !(typeof r.v === 'number' && isNaN(r.v)));
    filas.sort((a, b) => categoria.asc ? a.v - b.v : b.v - a.v);
    let pos = 0, prev = null;
    filas.forEach((r, i) => { if (r.v !== prev) pos = i + 1; r.pos = pos; prev = r.v; });
    return filas;
}

// ---------- Riesgo de despido (rendimiento contra el compañero) ----------
// Se evalúa según la distancia al compañero en la clasificación y el cara a cara,
// no por ser los últimos: un 18º con un compañero 4º está peor que un 16º con un compañero 19º.
export function calcularRiesgo(temp, pilotosLiga, { inmunes = new Set() } = {}) {
    const pos = {};
    temp.clasPilotos.forEach(p => { pos[p.pid] = p.posicion; });
    const n = pilotosLiga.length || 20;
    const lista = pilotosLiga.map(pl => {
        const comp = pilotosLiga.find(o => o.equipoId === pl.equipoId && o.id !== pl.id);
        const st = temp.pilotos[pl.id];
        const miPos = pos[pl.id] ?? n;
        const posComp = comp ? (pos[comp.id] ?? n) : null;
        const h2h = st?.h2hTotal || { g: 0, p: 0 };
        const duelos = h2h.g + h2h.p;
        const ratioDerrotas = duelos ? h2h.p / duelos : 0.5;
        const deficit = posComp != null ? miPos - posComp : 0;
        const riesgo = deficit + 0.2 * miPos + 6 * (ratioDerrotas - 0.5);
        return { pid: pl.id, eq: pl.equipoId, comp: comp?.id || null, pos: miPos, posComp, deficit, h2h, riesgo: Math.round(riesgo * 10) / 10, inmune: inmunes.has(pl.id) };
    });
    lista.sort((a, b) => b.riesgo - a.riesgo);
    let despidos = 0, peligro = 0;
    for (const r of lista) {
        if (r.inmune) { r.zona = 'inmune'; continue; }
        if (despidos < 2) { r.zona = 'despido'; despidos++; continue; }
        if (peligro < 2) {
            r.zona = 'peligro'; peligro++;
            r.caeria = r.posComp != null && ((r.posComp <= 8 && r.deficit >= 5) || r.deficit >= 10);
            continue;
        }
        r.zona = 'seguro';
    }
    return lista;
}

// ---------- Proyección del Mundial ----------
// tablas: {ESP: temp, ITA: temp, ...}
export function proyeccionMundial(tablas) {
    const clasificados = [], resto = [];
    for (const liga of LIGAS_NACIONALES) {
        const t = tablas[liga];
        if (!t) continue;
        t.clasPilotos.forEach((p, i) => {
            const fila = { pid: p.pid, liga, posLiga: i + 1, pts: p.pts, victorias: p.victorias, podios: p.podios };
            if (i < PLAZAS_MUNDIAL.porLiga) clasificados.push({ ...fila, via: 'top3' });
            else resto.push(fila);
        });
    }
    resto.sort((a, b) => b.pts - a.pts || b.victorias - a.victorias || b.podios - a.podios || a.posLiga - b.posLiga);
    resto.slice(0, PLAZAS_MUNDIAL.mejoresRestantes).forEach(f => clasificados.push({ ...f, via: 'repesca' }));
    const corte = resto[PLAZAS_MUNDIAL.mejoresRestantes - 1]?.pts ?? 0;
    const aspirantes = resto.slice(PLAZAS_MUNDIAL.mejoresRestantes, PLAZAS_MUNDIAL.mejoresRestantes + 8).map(f => ({ ...f, aCorte: corte - f.pts }));
    return { clasificados, corte, aspirantes };
}

export function locales(pilotos, liga) {
    return pilotos.filter(p => p.nac === NAC_LOCAL[liga]).length;
}
