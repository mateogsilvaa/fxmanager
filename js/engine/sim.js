// Simulador de sesiones Hyper Race X1 (BAC Mono)
import { SESION_INFO, PUNTOS_QUALY, PUNTOS_CARRERA, PUNTOS_VR, esCarrera, esQualy } from './constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Ritmo base de un piloto en esta sesión (ms por vuelta)
export function ritmoBase(p, circuito, lluvia) {
    const a = p.attrs;
    const base = circuito.tiempoBase * (lluvia ? 1.09 : 1);
    const wSum = circuito.motor + circuito.aero + circuito.chasis;
    const c = p.coche || {};
    const cocheScore = ((circuito.motor * (c.motor || 0)) + (circuito.aero * (c.aero || 0)) + (circuito.chasis * (c.chasis || 0))) / wSum / 10;
    let d = 0;
    d += -cocheScore * 0.010;
    d += (80 - a.ritmo) * 0.00055;
    if (lluvia) d += (75 - (a.lluvia ?? 70)) * 0.0004;
    d += -((a.experiencia ?? 50) - 50) * 0.00005;
    d += (1 - (p.setupQ ?? 0.7)) * 0.008 * (lluvia ? 0.5 : 1);
    d += -(((p.moral ?? 60) - 60) / 40) * 0.0015;
    d += -(p.forma ?? 0) * 0.001;
    return base * (1 + d);
}

function perfil(p, circuito, lluvia) {
    const a = p.attrs;
    const base = circuito.tiempoBase;
    return {
        pace: ritmoBase(p, circuito, lluvia),
        sd: base * (0.0012 + (100 - a.consistencia) * 0.00007) * (lluvia ? 1.7 : 1),
        pErr: (0.012 + (a.agresividad - 60) * 0.0002 + (100 - a.consistencia) * 0.0003) * (lluvia ? 2 : 1),
    };
}

function nuevaFila(p) {
    return {
        pid: p.id, eq: p.equipoId, pos: 0, parrilla: null, tiempo: null, gap: null, mejor: null,
        vueltas: 0, laps: [], posLap: [], estado: 'FIN', motivo: null, adel: 0, errores: 0, pts: 0,
    };
}

// ---------- Libres y clasificación ----------
function simularVueltasSueltas(tipo, circuito, pilotos, lluvia, rng) {
    const fp = tipo === 'FP';
    const nVueltas = fp ? 8 : 4;
    const eventos = [];
    const filas = pilotos.map(p => {
        const f = nuevaFila(p);
        const pr = perfil(p, circuito, lluvia);
        const riesgo = fp ? 1 : clamp(p.estr?.riesgo ?? 2, 1, 3);
        const ganancia = [0, 0, 0.0015, 0.0035][riesgo];
        const multErr = [0, 0.6, 1, 1.9][riesgo] * (fp ? 0.5 : 1.6);
        let fuera = false;
        for (let v = 0; v < nVueltas; v++) {
            if (fuera) break;
            let t = pr.pace * (1 - ganancia) + rng.gauss(0, pr.sd);
            let valida = true;
            if (rng.chance(0.08)) t += rng.range(300, 1200); // tráfico
            if (rng.chance(pr.pErr * multErr)) {
                t += rng.range(1500, 6000); valida = false; f.errores++;
                if (!fp && rng.chance(0.06 * riesgo)) {
                    fuera = true; eventos.push({ v: v + 1, tipo: 'accidente', pid: p.id });
                }
            }
            t = Math.round(t);
            f.laps.push(valida ? t : -t); // negativo = vuelta anulada
            f.vueltas++;
            if (valida && (f.mejor == null || t < f.mejor)) f.mejor = t;
        }
        if (f.mejor == null) f.estado = 'SIN TIEMPO';
        return f;
    });
    filas.sort((a, b) => {
        if (a.mejor == null && b.mejor == null) return 0;
        if (a.mejor == null) return 1;
        if (b.mejor == null) return -1;
        return a.mejor - b.mejor;
    });
    const lider = filas[0]?.mejor;
    filas.forEach((f, i) => { f.pos = i + 1; f.gap = f.mejor != null && lider != null ? f.mejor - lider : null; f.tiempo = f.mejor; });
    return { filas, eventos };
}

// ---------- Carrera ----------
function simularCarrera(tipo, circuito, pilotos, parrilla, lluvia, rng) {
    const n = SESION_INFO[tipo].vueltas;
    const porId = Object.fromEntries(pilotos.map(p => [p.id, p]));
    const orden0 = parrilla.filter(id => porId[id]);
    pilotos.forEach(p => { if (!orden0.includes(p.id)) orden0.push(p.id); });

    const filas = {}, perfiles = {}, cum = {};
    const eventos = [];
    orden0.forEach((id, i) => {
        const p = porId[id];
        filas[id] = nuevaFila(p);
        filas[id].parrilla = i + 1;
        const pr = perfil(p, circuito, lluvia);
        const ritmo = p.estr?.ritmo || 'equilibrado';
        const actitud = p.estr?.actitud || 'normal';
        pr.pace *= ritmo === 'conservador' ? 1.0015 : ritmo === 'ataque' ? 0.998 : 1;
        pr.deg = circuito.desgaste * 0.0007 * (ritmo === 'conservador' ? 0.7 : ritmo === 'ataque' ? 1.45 : 1) * (lluvia ? 0.6 : 1);
        pr.pErr *= ritmo === 'conservador' ? 0.6 : ritmo === 'ataque' ? 1.5 : 1;
        const fiab = p.coche?.fiabilidad || 0;
        pr.pFallo = 0.05 * (1 - fiab / 12) * (ritmo === 'ataque' ? 1.3 : ritmo === 'conservador' ? 0.7 : 1) * (p.riesgoFiab || 1);
        pr.pCrash = 0.0012 * (actitud === 'agresiva' ? 1.8 : actitud === 'defensiva' ? 0.6 : 1) * (lluvia ? 2.5 : 1);
        pr.ataque = p.attrs.agresividad * 0.6 + (p.attrs.adelantamiento ?? p.attrs.agresividad) * 0.4 + (actitud === 'agresiva' ? 10 : actitud === 'defensiva' ? -8 : 0);
        pr.defensa = (p.attrs.defensa ?? 70) + (actitud === 'defensiva' ? 8 : actitud === 'agresiva' ? -3 : 0);
        pr.actitud = actitud;
        perfiles[id] = pr;
        cum[id] = i * 250;
    });

    let orden = orden0.slice();
    const fuera = new Set();

    for (let v = 1; v <= n; v++) {
        const tent = {};
        for (const id of orden) {
            const p = porId[id], pr = perfiles[id], f = filas[id];
            let t = pr.pace * (1 + pr.deg * (v - 1)) + rng.gauss(0, pr.sd);
            if (v === 1) {
                t += 2500 + rng.gauss(0, 300) - ((p.attrs.experiencia ?? 50) - 50) * 4 - (p.attrs.agresividad - 60) * 3 - (pr.actitud === 'agresiva' ? 150 : 0);
                const pos0 = orden.indexOf(id);
                if (pos0 > 2 && rng.chance(0.025 * (pr.actitud === 'agresiva' ? 1.8 : 1) * (lluvia ? 1.5 : 1))) {
                    if (rng.chance(0.2)) { fuera.add(id); f.estado = 'DNF'; f.motivo = 'Accidente en la salida'; eventos.push({ v, tipo: 'abandono', pid: id, motivo: f.motivo }); continue; }
                    t += rng.range(2000, 8000); f.errores++;
                    eventos.push({ v, tipo: 'toque', pid: id });
                }
            }
            if (rng.chance(pr.pErr)) {
                const perd = rng.range(700, 3500);
                t += perd; f.errores++;
                if (perd > 2000) eventos.push({ v, tipo: 'error', pid: id, ms: Math.round(perd) });
            }
            if (rng.chance(pr.pCrash)) {
                fuera.add(id); f.estado = 'DNF'; f.motivo = 'Accidente';
                eventos.push({ v, tipo: 'abandono', pid: id, motivo: f.motivo }); continue;
            }
            if (rng.chance(pr.pFallo / n)) {
                fuera.add(id); f.estado = 'DNF';
                f.motivo = rng.pick(['Avería de motor', 'Fallo de caja de cambios', 'Suspensión rota', 'Problema eléctrico', 'Fallo de frenos']);
                eventos.push({ v, tipo: 'abandono', pid: id, motivo: f.motivo }); continue;
            }
            tent[id] = cum[id] + t;
        }

        // Resolver tráfico y adelantamientos respetando el orden en pista
        const nuevo = [];
        for (const id of orden) {
            if (fuera.has(id)) continue;
            let idx = nuevo.length, pases = 0;
            while (idx > 0) {
                const a = nuevo[idx - 1];
                if (tent[id] < tent[a]) {
                    const venta = Math.min(tent[a] - tent[id], 1500);
                    const pd = perfiles[id], pa = perfiles[a];
                    let prob = 0.08 + circuito.adelantar * 0.35 + (venta / 1500) * 0.35 + (pd.ataque - pa.defensa) / 100 * 0.6 + (lluvia ? 0.05 : 0);
                    prob = clamp(prob, 0.03, 0.9);
                    if (pases < 2 && rng.chance(prob)) {
                        pases++;
                        filas[id].adel++;
                        tent[a] += 150;
                        tent[id] = Math.min(tent[id], tent[a] - 60);
                        eventos.push({ v, tipo: 'adelantamiento', pid: id, pid2: a });
                        const pToque = 0.02 * (pd.actitud === 'agresiva' ? 2 : 1) * (pa.actitud === 'defensiva' ? 1.5 : 1);
                        if (rng.chance(pToque)) {
                            const perdedor = rng.chance(0.5) ? id : a;
                            tent[perdedor] += rng.range(1500, 5000);
                            filas[perdedor].errores++;
                            eventos.push({ v, tipo: 'toque', pid: id, pid2: a, perjudicado: perdedor });
                        }
                        idx--;
                        continue;
                    }
                    tent[id] = tent[a] + 250 + rng.next() * 200;
                    break;
                } else if (tent[id] < tent[a] + 200) {
                    tent[id] = tent[a] + 200 + rng.next() * 100;
                    break;
                }
                break;
            }
            nuevo.splice(idx, 0, id);
        }
        // Coherencia: nadie puede ir "por delante" en tiempo de quien le precede
        for (let k = 1; k < nuevo.length; k++) {
            if (tent[nuevo[k]] < tent[nuevo[k - 1]] + 100) tent[nuevo[k]] = tent[nuevo[k - 1]] + 100;
        }
        nuevo.forEach((id, k) => {
            const f = filas[id];
            const t = Math.round(tent[id] - cum[id]);
            f.laps.push(t);
            f.vueltas = v;
            f.posLap.push(k + 1);
            if (v > 1 && (f.mejor == null || t < f.mejor)) f.mejor = t;
            cum[id] = tent[id];
        });
        orden = nuevo;
    }

    // Clasificación final
    const acabados = orden.map(id => filas[id]);
    const retirados = Object.values(filas).filter(f => f.estado === 'DNF')
        .sort((a, b) => b.vueltas - a.vueltas || (cum[a.pid] - cum[b.pid]));
    const lider = acabados[0] ? cum[acabados[0].pid] : 0;
    acabados.forEach(f => { f.tiempo = Math.round(cum[f.pid]); f.gap = Math.round(cum[f.pid] - lider); });
    retirados.forEach(f => { f.tiempo = null; f.gap = null; if (f.mejor == null && f.laps.length) f.mejor = Math.min(...f.laps); });
    const todas = [...acabados, ...retirados];
    todas.forEach((f, i) => { f.pos = i + 1; });
    return { filas: todas, eventos };
}

export function simularSesion({ tipo, circuito, pilotos, parrilla, lluvia, rng }) {
    let r;
    if (esCarrera(tipo)) r = simularCarrera(tipo, circuito, pilotos, parrilla || [], lluvia, rng);
    else r = simularVueltasSueltas(tipo, circuito, pilotos, lluvia, rng);
    const res = { tipo, lluvia: !!lluvia, filas: r.filas, eventos: r.eventos, vr: null };
    puntuar(res);
    return res;
}

export function puntuar(res) {
    const { tipo, filas } = res;
    filas.forEach(f => { f.pts = 0; });
    if (esQualy(tipo)) {
        filas.forEach((f, i) => { if (f.mejor != null && i < PUNTOS_QUALY.length) f.pts = PUNTOS_QUALY[i]; });
        const pole = filas[0];
        if (pole && pole.mejor != null) res.vr = { pid: pole.pid, t: pole.mejor };
    } else if (esCarrera(tipo)) {
        const fin = filas.filter(f => f.estado === 'FIN');
        fin.forEach((f, i) => { if (i < PUNTOS_CARRERA.length) f.pts = PUNTOS_CARRERA[i]; });
        let best = null;
        fin.forEach(f => {
            const vueltaMin = f.laps.slice(1).reduce((m, t) => Math.min(m, t), Infinity);
            if (vueltaMin < Infinity && (!best || vueltaMin < best.t)) best = { pid: f.pid, t: vueltaMin, v: f.laps.indexOf(vueltaMin) + 1 };
        });
        if (best) {
            res.vr = best;
            filas.find(f => f.pid === best.pid).pts += PUNTOS_VR;
        }
    }
    return res;
}

// Desviación típica de las vueltas de carrera (sin la 1ª) => "eficacia"
export function desviacionVueltas(laps) {
    const v = laps.slice(1).filter(t => t > 0);
    if (v.length < 3) return null;
    const m = v.reduce((s, t) => s + t, 0) / v.length;
    return Math.sqrt(v.reduce((s, t) => s + (t - m) ** 2, 0) / v.length);
}

export function formatoTiempo(ms, conSigno = false) {
    if (ms == null) return '—';
    const neg = ms < 0; ms = Math.abs(ms);
    const min = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(3);
    const txt = min > 0 ? `${min}:${s.padStart(6, '0')}` : s;
    return (neg ? '-' : conSigno ? '+' : '') + txt;
}
