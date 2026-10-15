// Vida de los pilotos fuera de la pista: bolsa de agentes libres, retiradas y lesiones con sustituto.
//  · La bolsa se rellena sola (cada día) para que siempre haya pilotos libres de cada nacionalidad.
//  · Las retiradas se anuncian al abrir el mercado (sobre todo a partir de los 33 años) y dejan una vacante.
//  · Desde la temporada 2, un accidente grave en la liga nacional puede lesionar al piloto unas carreras: su
//    escudería elige un sustituto de la bolsa (la IA lo hace sola; si el mánager no elige a tiempo, el equipo
//    técnico coge al mejor que se pueda pagar).
import { LIGAS, NAC_LOCAL, esCarrera } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { POOL, crearAgente, faltanEnPool, nacExtranjera, estrellasPiloto, precioLibre, probRetiro, PROB_LESION, carrerasLesion } from '../engine/pool.js';
import { cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, noticia, notificar, nombrePiloto, movimiento, duenoReal } from './comun.js';

const M = (v) => `${(v / 1e6).toFixed(2).replace('.', ',')} M€`;
export const esLibre = (p) => p && !p.equipoId && (p.estado === 'libre' || !p.estado);
const novedades = (cfg) => (cfg?.temporada || 1) >= 2 || cfg?.novedades === true;

// ---------- Bolsa de agentes libres ----------
export async function asegurarPool(ctx) {
    const pil = await cargarPilotos(ctx);
    let libres = Object.values(pil).filter(esLibre);
    // Los libres muy mayores cuelgan el casco sin hacer ruido
    for (const p of libres) if ((p.edad || 0) >= POOL.edadRetiroLibre) { p.estado = 'retirado'; ctx.sucios.pilotos.add(p.id); ctx.catalogoSucio = true; }
    libres = libres.filter(esLibre);
    // Despedidos y sustitutos que vuelven a la bolsa: se les pone valoración y precio públicos
    const sinVal = libres.filter(p => p.valoracion == null || p.precio == null);
    if (sinVal.length) {
        const pp = await cargarPilotosPriv(ctx, sinVal.map(p => p.id));
        for (const p of sinVal) {
            const a = pp[p.id]?.attrs;
            p.valoracion = estrellasPiloto(a); p.precio = precioLibre(a); p.agente = true;
            ctx.sucios.pilotos.add(p.id); ctx.catalogoSucio = true;
        }
    }
    const faltan = faltanEnPool(libres);
    if (!faltan.length) return 0;
    const rng = crearRng(`${ctx.secreto}|pool|${ctx.cfg?.temporada || 1}|${Object.keys(pil).length}`);
    const usados = new Set(Object.values(pil).flatMap(p => [`${p.nombre} ${p.apellido}`, `@${p.apellido}`]));
    let n = 0, k = Object.keys(pil).length;
    for (const f of faltan) for (let i = 0; i < f.n; i++) {
        const nac = f.nac || nacExtranjera(rng);
        let id; do id = `ag${ctx.cfg?.temporada || 1}_${nac}_${k++}`; while (pil[id]);
        const a = crearAgente(rng, { nac, usados, id });
        pil[id] = { id, ...a.publico };
        ctx.pilotosPriv[id] = { id, ...a.priv };
        ctx.sucios.pilotos.add(id); ctx.sucios.pilotosPriv.add(id);
        n++;
    }
    ctx.catalogoSucio = true;
    ctx.nota(`Bolsa de agentes libres: ${n} pilotos nuevos`);
    return n;
}

// ---------- Retiradas (al abrir el mercado) ----------
// Devuelve [{ pid, eq, liga, edad }]. Como mucho 2 por liga para no vaciar ninguna parrilla.
export function elegirRetiros(ctx, activos, pp, rng) {
    const porLiga = {};
    const out = [];
    for (const p of activos.slice().sort((a, b) => (b.edad || 0) - (a.edad || 0))) {
        if (!p.equipoId || pp[p.id]?.noRetiro === ctx.cfg.temporada) continue;
        if (!rng.chance(probRetiro(p.edad))) continue;
        if ((porLiga[p.liga] || 0) >= 2) continue;
        porLiga[p.liga] = (porLiga[p.liga] || 0) + 1;
        out.push({ pid: p.id, eq: p.equipoId, liga: p.liga, edad: p.edad });
    }
    return out;
}

// ---------- Lesiones ----------
const lesionesDe = (priv) => (priv?.lesiones || []).filter(l => l.restantes > 0 || l.sustituto);

// Tras un accidente grave en la liga nacional
export async function lesionTrasAccidente(ctx, ev, f) {
    if (!novedades(ctx.cfg) || ev.liga === 'INT' || ctx.cfg.fase !== 'nacional') return null;
    const rng = crearRng(`${ctx.secreto}|lesion|${ev.id}|${f.pid}|${f.tipo || ''}`);
    if (!rng.chance(PROB_LESION)) return null;
    const priv = ctx.privs[f.eq], pil = await cargarPilotos(ctx), p = pil[f.pid];
    if (!priv || !p || p.estado === 'lesionado' || p.estado === 'sustituto') return null;
    const n = carrerasLesion(rng);
    const l = { pid: f.pid, carreras: n, restantes: n, sustituto: null, desde: ctx.ahora, evId: ev.id };
    priv.lesiones = [...lesionesDe(priv), l];
    ctx.sucios.privs.add(f.eq);
    p.estado = 'lesionado'; ctx.sucios.pilotos.add(p.id); ctx.catalogoSucio = true;
    const eqN = ctx.equipos[f.eq]?.nombre;
    noticia(ctx, { titulo: `${nombrePiloto(p)}, lesionado`, texto: `El accidente le obliga a perderse ${n} carreras. ${eqN} buscará un sustituto entre los pilotos libres.`, liga: ev.liga, tipo: 'noticia' });
    if (duenoReal(ctx, f.eq)) {
        notificar(ctx, f.eq, { remitente: 'Servicio médico', tipo: 'lesion', titulo: `${nombrePiloto(p)} se pierde ${n} carreras`, texto: `El golpe ha sido fuerte. Elige un sustituto entre los pilotos libres en Mi escudería → Hoy antes de la próxima sesión. Si no eliges, el equipo técnico ficha al mejor que podamos pagar.` });
        if (ctx.push) {
            const doc = await ctx.store.get(`suscripciones/${duenoReal(ctx, f.eq)}`).catch(() => null);
            for (const sub of doc?.subs || []) await ctx.push(sub, { title: `${nombrePiloto(p)} está lesionado`, body: `Se pierde ${n} carreras. Elige a su sustituto.`, url: ctx.sombra?.equipoId === f.eq ? 'sombra.html' : 'escuderia.html', tag: `lesion_${p.id}` });
        }
    } else await sustitutoAutomatico(ctx, f.eq, l);
    ctx.nota(`Lesión: ${nombrePiloto(p)} (${n} carreras)`);
    return l;
}

// Candidatos para sustituir a un lesionado: libres (locales si hace falta para el asiento de Piloto 1)
export function candidatosSustituto(pil, equipo, lesionado) {
    const liga = equipo?.liga;
    const comp = Object.values(pil).find(p => p.equipoId === lesionado.equipoId && p.id !== lesionado.id && p.estado !== 'sustituto');
    const debeLocal = lesionado.nac === NAC_LOCAL[liga] && comp?.nac !== NAC_LOCAL[liga];
    return Object.values(pil).filter(p => esLibre(p) && (!debeLocal || p.nac === NAC_LOCAL[liga]))
        .sort((a, b) => (b.valoracion || 0) - (a.valoracion || 0) || (a.precio || 0) - (b.precio || 0));
}

async function sustitutoAutomatico(ctx, eq, l) {
    const pil = await cargarPilotos(ctx), priv = ctx.privs[eq];
    const cands = candidatosSustituto(pil, ctx.equipos[eq], pil[l.pid]);
    const elegido = cands.find(p => costeSustituto(p) <= (priv.presupuesto || 0) * 0.3) || cands.slice().sort((a, b) => (a.precio || 0) - (b.precio || 0))[0];
    if (elegido) await asignarSustituto(ctx, eq, l, elegido.id);
}

const costeSustituto = (p) => Math.max(80_000, Math.round((p?.precio || 300_000) * 0.25 / 10_000) * 10_000);
export { costeSustituto };

export async function asignarSustituto(ctx, eq, l, subId) {
    const pil = await cargarPilotos(ctx), pp = await cargarPilotosPriv(ctx, [subId, l.pid]);
    const s = pil[subId], les = pil[l.pid], priv = ctx.privs[eq], e = ctx.equipos[eq];
    const coste = costeSustituto(s);
    if (priv) movimiento(priv, `Sustituto: ${nombrePiloto(s)} (${l.restantes} carreras)`, -coste, ctx.ahora);
    const numeros = new Set(Object.values(pil).filter(p => p.liga === e.liga && p.equipoId).map(p => p.numero));
    let numero = s.numero; let i = 0;
    while (!numero || numeros.has(numero)) numero = 2 + ((Object.keys(pil).length * 7 + i++ * 13) % 97);
    Object.assign(s, { equipoId: eq, liga: e.liga, estado: 'sustituto', rol: les?.rol || 'P2', sustitutoDe: l.pid, numero });
    if (pp[subId]) { pp[subId].equipoId = eq; ctx.sucios.pilotosPriv.add(subId); }
    ctx.sucios.pilotos.add(subId); ctx.catalogoSucio = true;
    l.sustituto = subId;
    ctx.sucios.privs.add(eq);
    noticia(ctx, { titulo: `${e.nombre} ficha a ${nombrePiloto(s)} como sustituto`, texto: `Correrá en lugar de ${nombrePiloto(les)} mientras se recupera (${l.restantes} carreras).`, liga: e.liga, tipo: 'mercado' });
    notificar(ctx, eq, { remitente: 'Dirección deportiva', tipo: 'lesion', titulo: `${nombrePiloto(s)} sustituye a ${nombrePiloto(les)}`, texto: `Contrato por ${l.restantes} carreras: ${M(coste)}.` });
}

async function liberarSustituto(ctx, eq, l) {
    const pil = await cargarPilotos(ctx);
    const s = l.sustituto && pil[l.sustituto], les = pil[l.pid];
    if (s) {
        const pp = await cargarPilotosPriv(ctx, [s.id]);
        Object.assign(s, { equipoId: null, liga: null, estado: 'libre', rol: null, sustitutoDe: null });
        if (pp[s.id]) { pp[s.id].equipoId = null; ctx.sucios.pilotosPriv.add(s.id); }
        ctx.sucios.pilotos.add(s.id);
    }
    if (les && les.estado === 'lesionado') { les.estado = 'activo'; ctx.sucios.pilotos.add(les.id); }
    ctx.catalogoSucio = true;
    const priv = ctx.privs[eq];
    if (priv) { priv.lesiones = (priv.lesiones || []).filter(x => x !== l); ctx.sucios.privs.add(eq); }
    if (les) notificar(ctx, eq, { remitente: 'Servicio médico', tipo: 'lesion', titulo: `${nombrePiloto(les)} recibe el alta`, texto: s ? `Vuelve a su asiento. ${nombrePiloto(s)} regresa a la bolsa de pilotos libres.` : 'Vuelve a su asiento.' });
}

// Antes de simular una sesión nacional: altas de los recuperados y sustituto para quien todavía no lo tenga
export async function lesionesAntesDeSesion(ctx, ev) {
    if (ev.liga === 'INT') return;
    await cargarPrivs(ctx); await cargarEquipos(ctx);
    for (const [eq, e] of Object.entries(ctx.equipos)) {
        if (e.liga !== ev.liga) continue;
        for (const l of lesionesDe(ctx.privs[eq])) {
            if (l.restantes <= 0) await liberarSustituto(ctx, eq, l);
            else if (!l.sustituto) await sustitutoAutomatico(ctx, eq, l);
        }
    }
}
// Después de cada carrera: una carrera menos para volver
export async function lesionesTrasCarrera(ctx, ev, tipo) {
    if (ev.liga === 'INT' || !esCarrera(tipo)) return;
    for (const [eq, e] of Object.entries(ctx.equipos || {})) {
        if (e.liga !== ev.liga) continue;
        for (const l of lesionesDe(ctx.privs[eq])) if (l.sustituto && l.restantes > 0) { l.restantes--; ctx.sucios.privs.add(eq); }
    }
}
// Al terminar las ligas nacionales todos se recuperan (los sustitutos vuelven a la bolsa)
export async function curarLesiones(ctx) {
    await cargarPrivs(ctx); await cargarEquipos(ctx);
    for (const [eq, priv] of Object.entries(ctx.privs)) for (const l of lesionesDe(priv)) await liberarSustituto(ctx, eq, l);
}

export const ACCIONES_PILOTOS = {
    // Elegir sustituto para un lesionado: { pid, sustituto }
    async lesion_sustituto(ctx, a) {
        const priv = ctx.privs[a.equipoId];
        const l = lesionesDe(priv).find(x => x.pid === a.params?.pid && x.restantes > 0);
        if (!l) throw new Error('Ese piloto no está lesionado.');
        if (l.sustituto) throw new Error('Ya tiene sustituto.');
        const pil = await cargarPilotos(ctx);
        const s = pil[a.params?.sustituto];
        if (!esLibre(s)) throw new Error('Ese piloto ya no está libre.');
        if (!candidatosSustituto(pil, ctx.equipos[a.equipoId], pil[l.pid]).some(p => p.id === s.id)) throw new Error(`Necesitas un piloto ${LIGAS[ctx.equipos[a.equipoId].liga].gentilicio} para el asiento de Piloto 1.`);
        const coste = costeSustituto(s);
        if ((priv.presupuesto || 0) < coste) throw new Error(`Necesitas ${M(coste)}.`);
        await asignarSustituto(ctx, a.equipoId, l, s.id);
        return { ok: true, coste };
    },
};
