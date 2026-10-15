// Novedades desde la temporada 2 (o antes si el admin las activa): ingenieros, negociaciones entre escuderías,
// blindaje de Galácticos, llamadas/cartas y reputación.
import { AREAS, ECO, LIGAS, ENTRENO, costeMejora, identidadAbierta, finDiaMadrid, diaMadrid } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import {
    CATEGORIAS_ING, REF_PLANTILLA, plantillaInicial, deEquipo, huecoLibre, bonusDe, sueldoDiario, primaIngeniero,
    valorIngeniero, indemnizacion, crearIngeniero, libres,
} from '../engine/ingenieros.js';
import { GUIONES, rellenar, probLlamada, horaHabitual } from '../engine/llamadas.js';
import { REP_INICIAL, ajustarRep, margenIA, descuentoPrimaIngeniero, factorSponsor } from '../engine/reputacion.js';
import { cuotaTrasCambios, asignarRoles, MERCADO } from '../engine/mercado.js';
import { cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, noticia, notificar, movimiento, duenoReal, nombrePiloto } from './comun.js';

export const novedadesActivas = (cfg) => (cfg?.temporada || 1) >= 2 || cfg?.novedades === true;
const M = (v) => `${(v / 1e6).toFixed(2).replace('.', ',')} M€`;
const exigir = (ctx) => { if (!novedadesActivas(ctx.cfg)) throw new Error('Esto llega la próxima temporada.'); };
const priv = (ctx, eq) => { const p = ctx.privs?.[eq]; if (!p) throw new Error('Escudería sin datos'); ctx.sucios.privs.add(eq); return p; };
const nombreIng = (i) => `${i.nombre} ${i.apellido}`;

// ---------- Plantilla de ingenieros ----------
export async function cargarPlantilla(ctx) {
    if (ctx.plantilla === undefined) ctx.plantilla = (await ctx.store.get(REF_PLANTILLA))?.lista || null;
    return ctx.plantilla;
}
async function guardarPlantilla(ctx) { await ctx.store.set(REF_PLANTILLA, { lista: ctx.plantilla, actualizado: ctx.ahora }); }
function recalcularBonus(ctx, eqs) {
    for (const eq of eqs) {
        if (!ctx.privs?.[eq]) continue;
        ctx.privs[eq].bonusIng = bonusDe(ctx.plantilla, eq);
        ctx.sucios.privs.add(eq);
    }
}

// Crea la plantilla de ingenieros y pone la reputación inicial. Se llama al empezar la temporada 2 o desde Control.
export async function activarNovedades(ctx) {
    const equipos = await cargarEquipos(ctx);
    await cargarPrivs(ctx);
    if (!(await cargarPlantilla(ctx))) {
        ctx.plantilla = plantillaInicial(crearRng(`${ctx.secreto}|ingenieros|${ctx.cfg.temporada}`), equipos);
        await guardarPlantilla(ctx);
        recalcularBonus(ctx, Object.keys(equipos));
        noticia(ctx, { titulo: 'Llegan los ingenieros', texto: 'Cada escudería tiene ya su equipo técnico: dos ingenieros por área y un ingeniero de pista. Hay ingenieros libres esperando ofertas.', tipo: 'fase' });
    }
    for (const [id, e] of Object.entries(equipos)) if (e.reputacion == null) { e.reputacion = REP_INICIAL; ctx.ops.push({ op: 'merge', path: `equipos/${id}`, data: { reputacion: REP_INICIAL } }); }
    if (!ctx.cfg.novedades) { ctx.cfg.novedades = true; await ctx.store.merge('config/juego', { novedades: true }); }
    ctx.catalogoSucio = true;
}

// ---------- Reputación ----------
export function repEquipo(ctx, eq, d, motivo) {
    const e = ctx.equipos?.[eq];
    if (!e || !d) return;
    e.reputacion = ajustarRep(e.reputacion, d);
    ctx.ops.push({ op: 'merge', path: `equipos/${eq}`, data: { reputacion: e.reputacion } });
    ctx.catalogoSucio = true;
    if (motivo && Math.abs(d) >= 3) ctx.nota(`Reputación ${e.nombre} ${d > 0 ? '+' : ''}${d}: ${motivo}`);
}
export async function repManager(ctx, uid, d, nombre) {
    if (!uid || !d) return;
    // Se guarda en el ciclo para que varios cambios seguidos se sumen en vez de pisarse
    ctx._repM ||= {};
    if (!(uid in ctx._repM)) { const doc = await ctx.store.get(`managers/${uid}`).catch(() => null); ctx._repM[uid] = { v: doc?.reputacion, nombre: doc?.nombre }; }
    const c = ctx._repM[uid];
    c.v = ajustarRep(c.v, d);
    ctx.ops.push({ op: 'merge', path: `managers/${uid}`, data: { reputacion: c.v, ...(c.nombre ? {} : { nombre: nombre || 'Mánager' }) } });
    return c.v;
}
async function repManagerDe(ctx, eq) {
    const uid = ctx.equipos?.[eq]?.ownerId;
    if (!uid) return REP_INICIAL;
    return (await ctx.store.get(`managers/${uid}`).catch(() => null))?.reputacion ?? REP_INICIAL;
}

// ---------- Valor de las cosas (la IA negocia con esto) ----------
async function valorPilotoAttrs(ctx, pid) {
    const pp = (await cargarPilotosPriv(ctx, [pid]))[pid];
    const r = pp?.attrs?.ritmo ?? 70;
    return 300_000 + Math.max(0, r - 55) * 90_000;
}
async function valorLado(ctx, lado, eqRecibe) {
    let v = lado.dinero || 0;
    for (const id of lado.ingenieros || []) v += valorIngeniero(ctx.plantilla?.[id]?.estrellas || 1);
    for (const pid of lado.pilotos || []) v += await valorPilotoAttrs(ctx, pid);
    for (const p of lado.planos || []) {
        const suyo = ctx.privs?.[eqRecibe]?.coche?.[p.area] || 0;
        if (p.nivel > suyo) v += costeMejora(suyo) * 0.6 * (p.nivel - suyo);
    }
    return v;
}

// ---------- Negociaciones ----------
// lado: { dinero, ingenieros: [id], pilotos: [pid], planos: [{ area, nivel }] }
function normalizarLado(l) {
    return { dinero: Math.max(0, Math.round(+l?.dinero || 0)), ingenieros: [...new Set((l?.ingenieros || []).map(String))].slice(0, 3), pilotos: [...new Set((l?.pilotos || []).map(String))].slice(0, 2), planos: (l?.planos || []).slice(0, 2).map(p => ({ area: String(p.area) })) };
}
const vacio = (l) => !l.dinero && !l.ingenieros.length && !l.pilotos.length && !l.planos.length;
function describirLado(ctx, l, pil) {
    const partes = [];
    if (l.dinero) partes.push(M(l.dinero));
    for (const id of l.ingenieros) { const i = ctx.plantilla?.[id]; if (i) partes.push(`${nombreIng(i)} (${CATEGORIAS_ING[i.cat].nombre}, ${i.estrellas}★)`); }
    for (const pid of l.pilotos) partes.push(nombrePiloto(pil[pid]));
    for (const p of l.planos) partes.push(`planos de ${AREAS[p.area]?.nombre.toLowerCase()} nivel ${p.nivel}`);
    return partes.join(' + ') || 'nada';
}

// Comprueba que cada parte puede dar lo que ofrece y que tras el cambio todo encaja (huecos, regla del 55%…)
async function validar(ctx, n) {
    const pil = await cargarPilotos(ctx);
    const lados = [[n.de, n.doy, n.a], [n.a, n.pido, n.de]];
    for (const [eq, l, otro] of lados) {
        if ((ctx.privs[eq]?.presupuesto || 0) < l.dinero) throw new Error(`${ctx.equipos[eq].nombre} no tiene ese dinero.`);
        for (const id of l.ingenieros) if (ctx.plantilla?.[id]?.equipoId !== eq) throw new Error('Ese ingeniero ya no está en el equipo.');
        for (const pid of l.pilotos) if (pil[pid]?.equipoId !== eq) throw new Error('Ese piloto ya no está en el equipo.');
        for (const p of l.planos) {
            if (!AREAS[p.area]) throw new Error('Plano no válido.');
            p.nivel = ctx.privs[eq]?.coche?.[p.area] || 0;
            if (p.nivel <= (ctx.privs[otro]?.coche?.[p.area] || 0)) throw new Error(`Los planos de ${AREAS[p.area].nombre.toLowerCase()} no le sirven: ya tiene ese nivel o más.`);
        }
    }
    // Huecos de ingenieros tras el cambio
    for (const [eq, sale, entra] of [[n.de, n.doy, n.pido], [n.a, n.pido, n.doy]]) {
        for (const cat of Object.keys(CATEGORIAS_ING)) {
            const quedan = deEquipo(ctx.plantilla, eq).filter(i => i.cat === cat && !sale.ingenieros.includes(i.id)).length;
            const llegan = entra.ingenieros.filter(id => ctx.plantilla[id]?.cat === cat).length;
            if (quedan + llegan > CATEGORIAS_ING[cat].huecos) throw new Error(`${ctx.equipos[eq].nombre} no tiene hueco para otro ingeniero de ${CATEGORIAS_ING[cat].nombre.toLowerCase()}.`);
        }
    }
    // Pilotos: solo fuera del periodo de carreras, mismo número de pilotos y regla del 55%
    if (n.doy.pilotos.length || n.pido.pilotos.length) {
        if (!identidadAbierta(ctx.cfg.fase)) throw new Error('Los pilotos solo se pueden negociar en pretemporada o al acabar la temporada.');
        if (n.doy.pilotos.length !== n.pido.pilotos.length) throw new Error('Los pilotos se cambian uno por uno (cada escudería necesita dos).');
        const cambios = [...n.doy.pilotos.map(pid => ({ pid, eq: n.a })), ...n.pido.pilotos.map(pid => ({ pid, eq: n.de }))];
        const r = cuotaTrasCambios(Object.values(pil).filter(p => p.equipoId), ctx.equipos, cambios);
        if (!r.ok) throw new Error(r.motivo);
    }
}

async function ejecutar(ctx, n) {
    const pil = await cargarPilotos(ctx);
    const pp = await cargarPilotosPriv(ctx, [...n.doy.pilotos, ...n.pido.pilotos]);
    for (const [de, a, l] of [[n.de, n.a, n.doy], [n.a, n.de, n.pido]]) {
        if (l.dinero) { movimiento(priv(ctx, de), `Negociación con ${ctx.equipos[a].nombre}`, -l.dinero, ctx.ahora); movimiento(priv(ctx, a), `Negociación con ${ctx.equipos[de].nombre}`, l.dinero, ctx.ahora); }
        for (const id of l.ingenieros) ctx.plantilla[id].equipoId = a;
        for (const pid of l.pilotos) {
            pil[pid].equipoId = a; pil[pid].liga = ctx.equipos[a].liga; ctx.sucios.pilotos.add(pid);
            if (pp[pid]) { pp[pid].equipoId = a; ctx.sucios.pilotosPriv.add(pid); }
        }
        for (const p of l.planos) { const pr = priv(ctx, a); pr.planos = { ...(pr.planos || {}), [p.area]: Math.max(pr.planos?.[p.area] || 0, p.nivel) }; }
    }
    if (n.doy.pilotos.length) for (const eq of [n.de, n.a]) {
        const lista = Object.values(pil).filter(p => p.equipoId === eq).map(p => ({ ...p, attrs: ctx.pilotosPriv[p.id]?.attrs }));
        for (const r of asignarRoles(lista, ctx.equipos[eq].liga)) if (pil[r.id].rol !== r.rol) { pil[r.id].rol = r.rol; ctx.sucios.pilotos.add(r.id); }
    }
    if (n.doy.ingenieros.length || n.pido.ingenieros.length) { recalcularBonus(ctx, [n.de, n.a]); await guardarPlantilla(ctx); }
    ctx.catalogoSucio = true;
    n.estado = 'aceptada'; n.resuelta = ctx.ahora;
    const txt = `${ctx.equipos[n.de].nombre} da ${describirLado(ctx, n.doy, pil)} a ${ctx.equipos[n.a].nombre} a cambio de ${describirLado(ctx, n.pido, pil)}.`;
    for (const eq of [n.de, n.a]) notificar(ctx, eq, { remitente: 'Negociaciones', tipo: 'negociacion', titulo: 'Acuerdo cerrado', texto: txt });
    if (n.doy.pilotos.length || n.doy.ingenieros.length || n.pido.ingenieros.length) noticia(ctx, { titulo: `Acuerdo entre ${ctx.equipos[n.de].nombre} y ${ctx.equipos[n.a].nombre}`, texto: txt.replace(/\d+,\d+ M€/g, 'una cantidad no revelada'), liga: ctx.equipos[n.a].liga, tipo: 'mercado' });
    // Cerrar acuerdos justos da reputación a los dos mánagers
    for (const eq of [n.de, n.a]) if (ctx.equipos[eq].ownerId) await repManager(ctx, ctx.equipos[eq].ownerId, 1, ctx.equipos[eq].ownerNombre);
}

// ---------- Llamadas ----------
function contextoLlamada(ctx, eq, pil, rng) {
    const e = ctx.equipos[eq], pr = ctx.privs[eq];
    const suyos = Object.values(pil).filter(p => p.equipoId === eq).sort((a, b) => (a.rol === 'P1' ? -1 : 1));
    const ings = deEquipo(ctx.plantilla, eq);
    const ing = ings.length ? rng.pick(ings) : null;
    const rivales = Object.entries(ctx.equipos).filter(([id, x]) => x.liga === e.liga && id !== eq);
    const rival = rivales.length ? rng.pick(rivales) : null;
    const persona = (() => { const n = crearIngeniero(rng, { cat: 'pista', estrellas: 1, liga: e.liga, usados: new Set(), n: 0 }); return `${n.nombre} ${n.apellido}`; })();
    return {
        equipo: e.nombre, color: e.color, sponsor: pr?.sponsor?.marca || 'una marca', persona,
        p1: nombrePiloto(suyos[0]) || 'tu piloto', p2: nombrePiloto(suyos[1] || suyos[0]) || 'tu piloto', p1id: suyos[0]?.id, p2id: (suyos[1] || suyos[0])?.id,
        ingeniero: ing ? nombreIng(ing) : persona, ingId: ing?.id || null, rival: rival?.[1].nombre || 'un rival', rivalId: rival?.[0] || null,
    };
}

// Una vez al día: a cada mánager, con una probabilidad según lo que juega, le llega una llamada o carta
export async function generarLlamadas(ctx, dia) {
    if (!novedadesActivas(ctx.cfg)) return;
    await cargarPlantilla(ctx);
    const pil = await cargarPilotos(ctx);
    const usuarios = Object.fromEntries((await ctx.store.list('usuarios')).map(u => [u.id, u]));
    const inicioDia = finDiaMadrid(ctx.ahora) - 864e5;
    for (const [eq] of Object.entries(ctx.equipos)) {
        const uid = duenoReal(ctx, eq);
        if (!uid || !ctx.privs[eq]) continue;
        const u = usuarios[uid];
        const dias = Object.entries(u?.uso?.dias || {}).filter(([d]) => d >= diaMadrid(ctx.ahora - 7 * 864e5));
        const media = dias.reduce((s, [, m]) => s + m, 0) / 7;
        const rng = crearRng(`${ctx.secreto}|llamada|${dia}|${eq}`);
        if (!rng.chance(probLlamada(media))) continue;
        const recientes = ctx.privs[eq].llamadasRecientes || [];
        const g = rng.weighted(GUIONES.filter(x => !recientes.includes(x.id)), x => x.peso);
        if (!g) continue;
        const v = contextoLlamada(ctx, eq, pil, rng);
        const hora = horaHabitual(rng, u?.uso?.horas);
        const disponible = Math.max(ctx.ahora, inicioDia + hora * 3600_000 - 30 * 60_000);
        const personaje = g.quien === 'piloto' ? { tipo: 'piloto', semilla: g.texto.includes('{p2}') ? v.p2id : v.p1id, color: v.color, nombre: g.texto.includes('{p2}') ? v.p2 : v.p1 }
            : g.quien === 'ingeniero' ? { tipo: 'ingeniero', semilla: v.ingId || v.persona, color: v.color, nombre: v.ingeniero }
            : g.quien === 'patrocinador' ? { tipo: 'patrocinador', semilla: v.sponsor, nombre: v.sponsor }
            : g.quien === 'rival' ? { tipo: 'patrocinador', semilla: `rival|${v.rivalId}`, nombre: `Mánager de ${v.rival}` }
            : { tipo: g.quien, semilla: v.persona, nombre: g.quien === 'fia' ? 'FIA' : v.persona };
        ctx.ops.push({ op: 'set', path: `llamadas/${dia}_${eq}`, data: {
            uid, equipoId: eq, dia, guion: g.id, quien: g.quien, formato: g.formato, personaje,
            titulo: rellenar(g.titulo, v), texto: rellenar(g.texto, v), opciones: g.opciones.map(o => ({ id: o.id, texto: rellenar(o.texto, v) })),
            vars: v, disponible, expira: finDiaMadrid(ctx.ahora), eleccion: null, aplicada: false, creado: ctx.ahora,
        } });
        ctx.privs[eq].llamadasRecientes = [g.id, ...recientes].slice(0, 6);
        ctx.sucios.privs.add(eq);
    }
}

async function aplicarEfectos(ctx, eq, ef, v, rng) {
    const out = { ...ef };
    if (ef.exito != null) { const r = rng.chance(ef.exito) ? ef.si : ef.no; return { ...(await aplicarEfectos(ctx, eq, r, v, rng)), texto: r.texto }; }
    const pr = priv(ctx, eq), e = ctx.equipos[eq];
    if (ef.dinero) movimiento(pr, ef.dinero > 0 ? 'Llamada: ingreso' : 'Llamada: gasto', ef.dinero, ctx.ahora);
    if (ef.fans) { e.fans = Math.max(0, (e.fans || 0) + ef.fans); ctx.ops.push({ op: 'merge', path: `equipos/${eq}`, data: { fans: e.fans } }); ctx.catalogoSucio = true; }
    if (ef.rep) repEquipo(ctx, eq, ef.rep, 'llamada');
    if (ef.repM && e.ownerId) await repManager(ctx, e.ownerId, ef.repM, e.ownerNombre);
    const pids = (a) => a === 'ambos' ? [v.p1id, v.p2id] : [a === 'p2' ? v.p2id : v.p1id];
    if (ef.moral) {
        const ids = pids(ef.moral.a).filter(Boolean);
        const pp = await cargarPilotosPriv(ctx, ids);
        for (const id of ids) if (pp[id]) { pp[id].moral = Math.max(0, Math.min(100, (pp[id].moral ?? 60) + ef.moral.v)); ctx.sucios.pilotosPriv.add(id); }
    }
    if (ef.attr) {
        const id = pids(ef.attr.a)[0];
        const pp = id ? (await cargarPilotosPriv(ctx, [id]))[id] : null;
        if (pp?.attrs) { pp.attrs[ef.attr.attr] = Math.min(ENTRENO.maxAtributo, (pp.attrs[ef.attr.attr] || 60) + ef.attr.v); ctx.sucios.pilotosPriv.add(id); }
    }
    if (ef.proyecto) {
        const p = (pr.proyectos || []).filter(x => x.fin > ctx.ahora).sort((a, b) => a.fin - b.fin)[0];
        if (p) p.fin = Math.max(ctx.ahora, p.fin - ef.proyecto * 3600_000);
        else out.texto = 'No había ninguna mejora en marcha, así que no cambia nada.';
    }
    if (ef.simulador) { const dia = diaMadrid(ctx.ahora); pr.tandasExtra = { dia, n: (pr.tandasExtra?.dia === dia ? pr.tandasExtra.n : 0) + ef.simulador }; }
    if (ef.info && v.rivalId) {
        const rp = ctx.privs[v.rivalId];
        const [area, nivel] = Object.entries(rp?.coche || {}).sort((a, b) => b[1] - a[1])[0] || [];
        out.info = area ? `${v.rival} tiene su punto fuerte en ${AREAS[area].nombre.toLowerCase()} (nivel ${nivel}).` : `${v.rival} todavía no ha desarrollado el coche.`;
    }
    return out;
}

export async function procesarLlamadas(ctx) {
    if (!novedadesActivas(ctx.cfg)) return;
    const lista = await ctx.store.list('llamadas', [['aplicada', '==', false]]);
    if (!lista.length) return;
    await cargarEquipos(ctx); await cargarPrivs(ctx); await cargarPlantilla(ctx);
    for (const l of lista) {
        const caducada = l.expira <= ctx.ahora;
        if (!l.eleccion && !caducada) continue;
        const g = GUIONES.find(x => x.id === l.guion);
        const op = l.eleccion && l.eleccion !== 'colgar' ? g?.opciones.find(o => o.id === l.eleccion) : null;
        let resultado;
        if (op && ctx.privs[l.equipoId]) {
            const r = await aplicarEfectos(ctx, l.equipoId, op.efectos || {}, l.vars || {}, crearRng(`${ctx.secreto}|llamadaRes|${l.id}`));
            resultado = [rellenar(op.resultado || r.texto || '', l.vars || {}), r.texto && op.resultado ? rellenar(r.texto, l.vars || {}) : '', r.info || ''].filter(Boolean).join(' ');
        } else resultado = l.eleccion === 'colgar' ? 'Colgaste sin contestar.' : 'Llamada perdida.';
        ctx.ops.push({ op: 'update', path: `llamadas/${l.id}`, data: { aplicada: true, resultado, procesada: ctx.ahora } });
        if (op) notificar(ctx, l.equipoId, { remitente: l.personaje?.nombre || 'Llamada', tipo: 'llamada', titulo: l.titulo, texto: resultado });
    }
}

// ---------- Tareas diarias ----------
export async function diarioNovedades(ctx, dia) {
    if (!novedadesActivas(ctx.cfg)) return;
    if (!(await cargarPlantilla(ctx))) await activarNovedades(ctx);
    // Sueldos de los ingenieros
    for (const eq of Object.keys(ctx.equipos)) {
        const pr = ctx.privs[eq];
        const s = sueldoDiario(ctx.plantilla, eq);
        if (pr && s) { movimiento(pr, 'Sueldos de ingenieros', -s, ctx.ahora); ctx.sucios.privs.add(eq); }
    }
    // La IA ficha ingenieros libres de vez en cuando si tiene hueco y dinero
    let cambios = false;
    for (const [eq] of Object.entries(ctx.equipos)) {
        if (duenoReal(ctx, eq) || !ctx.privs[eq]) continue;
        const rng = crearRng(`${ctx.secreto}|iaIng|${dia}|${eq}`);
        if (!rng.chance(0.04)) continue;
        const cand = libres(ctx.plantilla).filter(i => huecoLibre(ctx.plantilla, eq, i.cat)).sort((a, b) => b.estrellas - a.estrellas)[0];
        if (!cand || (ctx.privs[eq].presupuesto || 0) < primaIngeniero(cand.estrellas) * 3) continue;
        movimiento(ctx.privs[eq], `Fichaje de ${nombreIng(cand)}`, -primaIngeniero(cand.estrellas), ctx.ahora);
        cand.equipoId = eq; cambios = true;
        recalcularBonus(ctx, [eq]);
        if (cand.estrellas >= 4) noticia(ctx, { titulo: `${ctx.equipos[eq].nombre} ficha a ${nombreIng(cand)}`, texto: `Ingeniero de ${CATEGORIAS_ING[cand.cat].nombre.toLowerCase()} de ${cand.estrellas} estrellas.`, liga: ctx.equipos[eq].liga, tipo: 'mercado' });
    }
    // Si quedan pocos libres, aparecen caras nuevas
    const rngN = crearRng(`${ctx.secreto}|nuevosIng|${dia}`);
    for (const cat of Object.keys(CATEGORIAS_ING)) {
        if (libres(ctx.plantilla).filter(i => i.cat === cat).length >= 4) continue;
        const n = Object.keys(ctx.plantilla).length + rngN.int(1000, 9999);
        const ing = crearIngeniero(rngN, { cat, estrellas: rngN.weighted([1, 2, 3, 4, 5], x => [3, 4, 3, 2, 1][x - 1]), usados: new Set(), n });
        ctx.plantilla[ing.id] = ing; cambios = true;
    }
    if (cambios) await guardarPlantilla(ctx);
    // Los patrocinadores pagan más (o menos) según la reputación del equipo
    for (const [eq, e] of Object.entries(ctx.equipos)) {
        const pr = ctx.privs[eq];
        if (!pr?.ofertasSponsor?.length || pr.ofertasSponsor[0].rep != null) continue;
        const f = factorSponsor(e.reputacion);
        pr.ofertasSponsor = pr.ofertasSponsor.map(o => ({ ...o, base: Math.round(o.base * f / 10_000) * 10_000, bonus: Math.round(o.bonus * f / 10_000) * 10_000, rep: e.reputacion ?? REP_INICIAL }));
        ctx.sucios.privs.add(eq);
    }
}

// ---------- Acciones de los mánagers ----------
export const ACCIONES_NOVEDADES = {
    async ing_fichar(ctx, a) {
        exigir(ctx);
        await cargarPlantilla(ctx);
        const ing = ctx.plantilla?.[a.params?.id];
        if (!ing || ing.equipoId) throw new Error('Ese ingeniero no está libre.');
        if (!huecoLibre(ctx.plantilla, a.equipoId, ing.cat)) throw new Error(`No tienes hueco: como mucho ${CATEGORIAS_ING[ing.cat].huecos} de ${CATEGORIAS_ING[ing.cat].nombre.toLowerCase()}. Despide a uno antes.`);
        const prima = Math.round(primaIngeniero(ing.estrellas) * (1 - descuentoPrimaIngeniero(ctx.equipos[a.equipoId]?.reputacion)));
        const pr = priv(ctx, a.equipoId);
        if ((pr.presupuesto || 0) < prima) throw new Error(`Necesitas ${M(prima)}.`);
        movimiento(pr, `Fichaje de ${nombreIng(ing)}`, -prima, ctx.ahora);
        ing.equipoId = a.equipoId;
        recalcularBonus(ctx, [a.equipoId]);
        await guardarPlantilla(ctx);
        ctx.catalogoSucio = true;
        if (ing.estrellas >= 4) noticia(ctx, { titulo: `${ctx.equipos[a.equipoId].nombre} ficha a ${nombreIng(ing)}`, texto: `Ingeniero de ${CATEGORIAS_ING[ing.cat].nombre.toLowerCase()} de ${ing.estrellas} estrellas.`, liga: ctx.equipos[a.equipoId].liga, tipo: 'mercado' });
        return { ok: true, prima };
    },

    async ing_despedir(ctx, a) {
        exigir(ctx);
        await cargarPlantilla(ctx);
        const ing = ctx.plantilla?.[a.params?.id];
        if (!ing || ing.equipoId !== a.equipoId) throw new Error('Ese ingeniero no es tuyo.');
        const pr = priv(ctx, a.equipoId);
        const coste = indemnizacion(ing);
        if ((pr.presupuesto || 0) < coste) throw new Error(`La indemnización es de ${M(coste)}.`);
        movimiento(pr, `Indemnización de ${nombreIng(ing)}`, -coste, ctx.ahora);
        ing.equipoId = null;
        recalcularBonus(ctx, [a.equipoId]);
        await guardarPlantilla(ctx);
        return { ok: true, coste };
    },

    // Propuesta a otra escudería: { conEq, doy: lado, pido: lado }. Compra (pido algo y doy dinero), intercambio
    // (cosa por cosa) o intercambio + compensación (cosa por cosa y dinero).
    async neg_proponer(ctx, a) {
        exigir(ctx);
        await cargarPlantilla(ctx); await cargarEquipos(ctx); await cargarPrivs(ctx);
        const conEq = a.params?.conEq;
        if (!ctx.equipos[conEq] || conEq === a.equipoId) throw new Error('Escudería no válida.');
        const n = { de: a.equipoId, a: conEq, doy: normalizarLado(a.params?.doy), pido: normalizarLado(a.params?.pido), estado: 'pendiente', creado: ctx.ahora };
        if (vacio(n.pido) || vacio(n.doy)) throw new Error('Cada parte tiene que dar algo.');
        await validar(ctx, n);
        const pil = await cargarPilotos(ctx);
        n.texto = `${ctx.equipos[n.de].nombre} ofrece ${describirLado(ctx, n.doy, pil)} a cambio de ${describirLado(ctx, n.pido, pil)}.`;
        const uidA = duenoReal(ctx, conEq), uidDe = duenoReal(ctx, a.equipoId);
        n.uids = [uidDe, uidA].filter(Boolean);
        const id = ctx.store.nuevoId('negociaciones');
        if (!uidA) {
            // La IA acepta si sale ganando lo suficiente (menos margen cuanto más reputación tiene el mánager)
            const recibe = await valorLado(ctx, n.doy, conEq), da = await valorLado(ctx, n.pido, a.equipoId);
            const margen = margenIA(await repManagerDe(ctx, a.equipoId));
            if (recibe >= da * (1 + margen)) await ejecutar(ctx, n);
            else { n.estado = 'rechazada'; n.motivo = `${ctx.equipos[conEq].nombre} (IA) quiere algo más: valora lo que pide en unos ${M(da * (1 + margen))}.`; }
        } else notificar(ctx, conEq, { remitente: 'Negociaciones', tipo: 'negociacion', titulo: `Propuesta de ${ctx.equipos[a.equipoId].nombre}`, texto: `${n.texto} Respóndela en Mi escudería → Equipo.` });
        ctx.ops.push({ op: 'set', path: `negociaciones/${id}`, data: n });
        return { ok: true, estado: n.estado, motivo: n.motivo || null };
    },

    async neg_responder(ctx, a) {
        exigir(ctx);
        await cargarPlantilla(ctx); await cargarEquipos(ctx); await cargarPrivs(ctx);
        const n = await ctx.store.get(`negociaciones/${a.params?.id}`);
        if (!n || n.a !== a.equipoId || n.estado !== 'pendiente') throw new Error('Propuesta no disponible.');
        if (!a.params?.acepta) {
            ctx.ops.push({ op: 'merge', path: `negociaciones/${n.id}`, data: { estado: 'rechazada', resuelta: ctx.ahora } });
            notificar(ctx, n.de, { remitente: 'Negociaciones', tipo: 'negociacion', titulo: `${ctx.equipos[n.a].nombre} dice que no`, texto: n.texto });
            return { ok: true };
        }
        await validar(ctx, n);
        await ejecutar(ctx, n);
        const { id, ...datos } = n;
        ctx.ops.push({ op: 'set', path: `negociaciones/${id}`, data: datos });
        return { ok: true };
    },

    async neg_cancelar(ctx, a) {
        const n = await ctx.store.get(`negociaciones/${a.params?.id}`);
        if (!n || n.de !== a.equipoId || n.estado !== 'pendiente') throw new Error('Propuesta no disponible.');
        ctx.ops.push({ op: 'merge', path: `negociaciones/${n.id}`, data: { estado: 'cancelada', resuelta: ctx.ahora } });
        // Echarse atrás resta un poco de reputación como mánager
        if (ctx.equipos[a.equipoId]?.ownerId) await repManager(ctx, ctx.equipos[a.equipoId].ownerId, -1, ctx.equipos[a.equipoId].ownerNombre);
        return { ok: true };
    },

    // Blindar a tu Galáctico: pagas en secreto 1,5 veces la puja más alta (o 2 M€ si no hay pujas) y se queda
    async galactico_blindar(ctx, a) {
        exigir(ctx);
        const ref = `mercado/T${ctx.cfg.temporada}`;
        const m = await ctx.store.get(ref);
        if (!m || m.estado !== 'abierto') throw new Error('El mercado no está abierto.');
        const g = (m.galacticos || []).find(x => x.eq === a.equipoId && x.estado === 'pendiente');
        if (!g) throw new Error('No tienes ningún Galáctico en venta.');
        const pujas = (m.ofertas || []).filter(o => o.pid === g.pid && o.estado === 'pendiente');
        const minimo = minimoBlindaje(pujas);
        const importe = Math.round(+a.params?.importe || 0);
        if (importe < minimo) throw new Error(`Para blindarlo necesitas al menos ${M(minimo)}.`);
        const pr = priv(ctx, a.equipoId);
        if ((pr.presupuesto || 0) < importe) throw new Error('No tienes ese dinero.');
        movimiento(pr, `Blindaje de ${g.nombre}`, -importe, ctx.ahora);
        pr.blindajes = [...(pr.blindajes || []), { temporada: ctx.cfg.temporada, pid: g.pid, importe }];
        g.estado = 'blindado';
        for (const o of pujas) { o.estado = 'anulada'; notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${g.nombre} ya no está en venta`, texto: 'Su escudería lo ha blindado. Tu oferta queda anulada sin coste.' }); }
        m.movimientos = [{ t: ctx.ahora, texto: `${g.nombre} se queda en ${ctx.equipos[a.equipoId]?.nombre}: su escudería lo blinda.`, tipo: 'blindaje' }, ...(m.movimientos || [])];
        await ctx.store.set(ref, m);
        noticia(ctx, { titulo: `${g.nombre} no se mueve`, texto: `${ctx.equipos[a.equipoId]?.nombre} blinda a su Galáctico. No ha trascendido la cifra.`, liga: g.liga, tipo: 'mercado' });
        repEquipo(ctx, a.equipoId, 2, 'blindaje');
        return { ok: true, importe };
    },
};
export const minimoBlindaje = (pujas) => { const max = Math.max(0, ...pujas.map(o => o.importe)); return max ? Math.ceil(max * 1.5 / 10_000) * 10_000 : 2_000_000; };
void LIGAS; void ECO; void MERCADO;
