// Crónicas autogeneradas del fin de semana
import { crearRng } from './rng.js';
import { LIGAS } from './constants.js';

// ctx: { evento, sesiones: {FP,Q1,R1,Q2,R2,R3} (resultados con filas y, si hay, eventos),
//        nombre(pid), apellido(pid), equipo(eq), antes (temporada antes del evento), despues (temporada tras el evento) }
export function generarCronica(ctx) {
    const { evento, sesiones: S, apellido, nombre, equipo } = ctx;
    const rng = crearRng(`cronica|${evento.id}`);
    const circuito = evento.circuito?.nombre || 'el circuito';
    const liga = LIGAS[evento.liga]?.nombre || evento.liga;
    const ganador = (s) => s?.filas?.find(f => f.pos === 1 && f.estado === 'FIN');
    const polePid = (s) => s?.filas?.[0]?.mejor ? s.filas[0].pid : null;
    const p = [];

    const g1 = ganador(S.R1), g2 = ganador(S.R2), g3 = ganador(S.R3);
    const ganadores = [g1, g2, g3].filter(Boolean).map(f => f.pid);
    const cuenta = {};
    ganadores.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
    const dominador = Object.entries(cuenta).find(([, n]) => n >= 2)?.[0];

    // Puntos del fin de semana
    const ptsFinde = {};
    for (const t of ['Q1', 'R1', 'Q2', 'R2', 'R3']) S[t]?.filas?.forEach(f => { ptsFinde[f.pid] = (ptsFinde[f.pid] || 0) + f.pts; });
    const topFinde = Object.entries(ptsFinde).sort((a, b) => b[1] - a[1]);
    const mvp = topFinde[0];

    // Titular
    let titulo;
    if (dominador && cuenta[dominador] === 3) titulo = rng.pick([`${apellido(dominador)} arrasa en ${circuito}: tres de tres`, `Pleno histórico de ${apellido(dominador)} en ${circuito}`, `${apellido(dominador)}, intratable: gana las tres carreras`]);
    else if (dominador) titulo = rng.pick([`${apellido(dominador)} manda en ${circuito} con un doblete de victorias`, `Doble triunfo de ${apellido(dominador)} en ${circuito}`, `${apellido(dominador)} se hace fuerte en ${circuito}`]);
    else if (ganadores.length === 3) titulo = rng.pick([`Tres carreras, tres ganadores distintos en ${circuito}`, `Locura en ${circuito}: ${apellido(ganadores[0])}, ${apellido(ganadores[1])} y ${apellido(ganadores[2])} se reparten las victorias`, `${circuito} no tiene dueño`]);
    else titulo = `Crónica del fin de semana en ${circuito}`;

    // Líder del campeonato
    const liderAntes = ctx.antes?.clasPilotos?.[0];
    const liderDespues = ctx.despues?.clasPilotos?.[0];
    const segundo = ctx.despues?.clasPilotos?.[1];
    let entradilla = `Ronda ${evento.ronda} de la liga ${liga}.`;
    if (liderDespues) {
        const ventaja = liderDespues.pts - (segundo?.pts || 0);
        if (liderAntes && liderAntes.pid !== liderDespues.pid) entradilla += ` ${nombre(liderDespues.pid)} es el nuevo líder del campeonato con ${ventaja} punto${ventaja === 1 ? '' : 's'} de ventaja.`;
        else entradilla += ` ${nombre(liderDespues.pid)} sigue al frente del campeonato, ahora con ${ventaja} punto${ventaja === 1 ? '' : 's'} sobre ${apellido(segundo?.pid)}.`;
    }

    // Viernes
    const pole1 = polePid(S.Q1);
    if (pole1) {
        const fp = S.FP?.filas?.[0];
        let t = rng.pick(['El viernes arrancó con', 'El fin de semana empezó con']) + ` la pole de ${nombre(pole1)} (${equipo(S.Q1.filas[0].eq)}) en la Clasificación 1`;
        if (fp && fp.pid !== pole1) t += `, pese a que en los libres el más rápido había sido ${apellido(fp.pid)}`;
        t += '.';
        const sinTiempo = S.Q1.filas.filter(f => f.estado === 'SIN TIEMPO');
        if (sinTiempo.length) t += ` ${sinTiempo.map(f => apellido(f.pid)).join(' y ')} no ${sinTiempo.length > 1 ? 'marcaron' : 'marcó'} tiempo válido y ${sinTiempo.length > 1 ? 'saldrán' : 'saldrá'} desde el fondo.`;
        p.push(t);
    }

    // Carreras
    for (const [t, ord] of [['R1', 'primera'], ['R2', 'segunda'], ['R3', 'tercera']]) {
        const s = S[t];
        if (!s?.filas?.length) continue;
        p.push(parrafoCarrera(s, ord, t, ctx, rng));
    }

    // Figura del fin de semana
    if (mvp) {
        let t = `Con ${mvp[1]} puntos, ${nombre(mvp[0])} fue el piloto que más sumó en ${circuito}.`;
        const remontadas = [S.R1, S.R2, S.R3].filter(Boolean).flatMap(s => s.filas.filter(f => f.estado === 'FIN' && f.parrilla).map(f => ({ ...f, gan: f.parrilla - f.pos, ses: s.tipo })));
        const rem = remontadas.sort((a, b) => b.gan - a.gan)[0];
        if (rem && rem.gan >= 5) t += ` Mención especial para ${apellido(rem.pid)}, que remontó ${rem.gan} posiciones en la ${rem.ses === 'R1' ? 'primera' : rem.ses === 'R2' ? 'segunda' : 'tercera'} carrera.`;
        const dnfs = [S.R1, S.R2, S.R3].filter(Boolean).flatMap(s => s.filas.filter(f => f.estado === 'DNF').map(f => f.pid));
        const conteo = {};
        dnfs.forEach(id => { conteo[id] = (conteo[id] || 0) + 1; });
        const gafado = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
        if (gafado && gafado[1] >= 2) t += ` En el otro extremo, ${apellido(gafado[0])} abandonó ${gafado[1]} veces: fin de semana para olvidar.`;
        p.push(t);
    }

    // Duelos internos llamativos
    if (ctx.despues) {
        const cambios = [];
        for (const pl of ctx.despues.clasPilotos.slice(0, 6)) {
            const antes = ctx.antes?.pilotos?.[pl.pid];
            if (antes && antes.posicion - pl.posicion >= 3) cambios.push(`${apellido(pl.pid)} sube al ${pl.posicion}º puesto`);
        }
        if (cambios.length) p.push(`En la general, ${cambios.slice(0, 3).join(', ')}.`);
    }

    return { titulo, entradilla, parrafos: p, mvp: mvp ? { pid: mvp[0], pts: mvp[1] } : null };
}

function parrafoCarrera(s, ordinal, tipo, ctx, rng) {
    const { apellido, nombre, equipo } = ctx;
    const fin = s.filas.filter(f => f.estado === 'FIN');
    const g = fin[0];
    if (!g) return `La ${ordinal} carrera terminó sin clasificados.`;
    const podio = fin.slice(1, 3).map(f => apellido(f.pid));
    const salida = g.parrilla;
    let t = `En la ${ordinal} carrera${s.lluvia ? ', disputada bajo la lluvia,' : ''} `;
    if (salida === 1) t += rng.pick([`${nombre(g.pid)} convirtió la pole en victoria`, `${nombre(g.pid)} ganó desde la pole`, `${nombre(g.pid)} no falló desde la primera posición`]);
    else if (salida >= 6) t += rng.pick([`${nombre(g.pid)} firmó una gran remontada desde la ${salida}ª posición hasta la victoria`, `${nombre(g.pid)} ganó saliendo ${salida}º`]);
    else t += `${nombre(g.pid)} (${equipo(g.eq)}) se llevó la victoria saliendo ${salida}º`;
    const segundo = fin[1];
    if (segundo && segundo.gap != null) {
        const gs = (segundo.gap / 1000).toFixed(1);
        t += segundo.gap < 1000 ? `, por apenas ${gs} s sobre ${apellido(segundo.pid)}` : `, con ${gs} s de margen`;
    }
    t += '.';
    if (podio.length) t += ` Completaron el podio ${podio.join(' y ')}.`;
    const ev = s.eventos || [];
    const adel = {};
    ev.filter(e => e.tipo === 'adelantamiento').forEach(e => { adel[e.pid] = (adel[e.pid] || 0) + 1; });
    const maxAdel = Object.entries(adel).sort((a, b) => b[1] - a[1])[0];
    if (maxAdel && maxAdel[1] >= 4) t += ` ${apellido(maxAdel[0])} fue el más combativo, con ${maxAdel[1]} adelantamientos.`;
    const dnf = s.filas.filter(f => f.estado === 'DNF');
    if (dnf.length === 1) t += ` El único abandono fue el de ${apellido(dnf[0].pid)}${motivo(ev, dnf[0].pid)}.`;
    else if (dnf.length > 1) t += ` Hubo ${dnf.length} abandonos, entre ellos ${dnf.slice(0, 3).map(f => apellido(f.pid)).join(', ')}.`;
    if (s.vr?.pid || s.vr) {
        const vrPid = s.vr?.pid || s.vr;
        if (vrPid !== g.pid) t += ` La vuelta rápida (+3) fue para ${apellido(vrPid)}.`;
    }
    if (tipo === 'R3' && fin.length) {
        const ultimo = fin[fin.length - 1];
        if (ultimo.parrilla && ultimo.parrilla <= 5) t += ` Mal domingo para ${apellido(ultimo.pid)}, que salió ${ultimo.parrilla}º y terminó último.`;
    }
    return t;
}

function motivo(eventos, pid) {
    const e = eventos.find(x => x.tipo === 'abandono' && x.pid === pid);
    return e?.motivo ? ` (${e.motivo.toLowerCase()})` : '';
}

// Resumen breve de una sola sesión (para notificaciones y portada)
export function titularSesion(s, apellido) {
    const p1 = s.filas?.[0];
    if (!p1) return '';
    if (s.tipo === 'FP') return `${apellido(p1.pid)} lidera los libres`;
    if (s.tipo.startsWith('Q')) return `Pole para ${apellido(p1.pid)}`;
    return `Victoria de ${apellido(p1.pid)}`;
}
