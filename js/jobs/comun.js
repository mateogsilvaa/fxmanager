// Utilidades compartidas por los trabajos del servidor (worker y panel admin)
import { SESIONES, SESION_INFO, duracionDirecto } from '../engine/constants.js';

export const idResultado = (eventoId, tipo) => `${eventoId}_${tipo}`;
export const idEstrategia = (eventoId, tipo, equipoId) => `${eventoId}_${tipo}_${equipoId}`;
export const idResumen = (temporada) => `T${temporada}`;

// Contexto de un ciclo: cachea documentos y acumula escrituras
export function crearContexto(store, { ahora = Date.now(), log = () => {} } = {}) {
    const ctx = {
        store, ahora, log,
        privs: null, equipos: null, pilotos: null, pilotosPriv: {}, eventos: null,
        sucios: { privs: new Set(), equipos: new Set(), pilotosPriv: new Set(), pilotos: new Set() },
        ops: [], catalogoSucio: false, informe: [],
    };
    ctx.nota = (m) => { ctx.informe.push(m); log(m); };
    return ctx;
}

export async function cargarEquipos(ctx) {
    if (!ctx.equipos) ctx.equipos = Object.fromEntries((await ctx.store.list('equipos')).map(e => [e.id, e]));
    return ctx.equipos;
}
export async function cargarPrivs(ctx) {
    if (!ctx.privs) ctx.privs = Object.fromEntries((await ctx.store.list('equipos_priv')).map(e => [e.id, e]));
    return ctx.privs;
}
export async function cargarPilotos(ctx) {
    if (!ctx.pilotos) ctx.pilotos = Object.fromEntries((await ctx.store.list('pilotos')).map(p => [p.id, p]));
    return ctx.pilotos;
}
export async function cargarPilotosPriv(ctx, ids) {
    const faltan = ids.filter(id => !(id in ctx.pilotosPriv));
    if (faltan.length > 25) {
        const todos = await ctx.store.list('pilotos_priv');
        todos.forEach(p => { ctx.pilotosPriv[p.id] = p; });
    } else {
        for (const id of faltan) ctx.pilotosPriv[id] = await ctx.store.get(`pilotos_priv/${id}`);
    }
    return Object.fromEntries(ids.map(id => [id, ctx.pilotosPriv[id]]));
}
export async function cargarEventos(ctx, temporada) {
    if (!ctx.eventos) ctx.eventos = (await ctx.store.list('eventos', [['temporada', '==', temporada]]));
    return ctx.eventos;
}

export function sesionesOrdenadas(evento) {
    return SESIONES.filter(t => evento.sesiones?.[t]).map(t => ({ tipo: t, ...evento.sesiones[t] }));
}

// Normaliza horarios de una sesión: publishAt obligatorio, lockAt y revealAt derivados
export function horarioSesion(tipo, publishAt, minutosCierre = 60) {
    return { publishAt, lockAt: publishAt - minutosCierre * 60_000, revealAt: publishAt + duracionDirecto(tipo), estado: 'programada' };
}

export function notificar(ctx, equipoId, { remitente = 'FIA', titulo, texto, tipo = 'info' }) {
    const eq = ctx.equipos?.[equipoId];
    if (!eq?.ownerId) return;
    ctx.ops.push({ op: 'set', path: `notificaciones/${ctx.store.nuevoId('notificaciones')}`, data: { uid: eq.ownerId, equipoId, remitente, titulo, texto: texto || '', tipo, fecha: ctx.ahora, leida: false } });
}

export function noticia(ctx, { titulo, texto, liga = null, tipo = 'noticia', publishAt = null }) {
    ctx.ops.push({ op: 'set', path: `noticias/${ctx.store.nuevoId('noticias')}`, data: { titulo, texto: texto || '', liga, tipo, publishAt: publishAt ?? ctx.ahora, fecha: ctx.ahora } });
}

export function movimiento(priv, concepto, importe, t) {
    priv.presupuesto = Math.round((priv.presupuesto || 0) + importe);
    priv.finanzas = [{ t, c: concepto, v: Math.round(importe) }, ...(priv.finanzas || [])].slice(0, 60);
}

export function nombrePiloto(p) { return p ? `${p.nombre} ${p.apellido}` : '—'; }

export async function volcar(ctx) {
    const ops = ctx.ops.splice(0);
    for (const id of ctx.sucios.privs) ops.push({ op: 'set', path: `equipos_priv/${id}`, data: sinId(ctx.privs[id]) });
    // de los equipos públicos el servidor solo toca los fans (ownerId lo escribe el cliente al reclamar)
    for (const id of ctx.sucios.equipos) ops.push({ op: 'merge', path: `equipos/${id}`, data: { fans: ctx.equipos[id].fans || 0 } });
    for (const id of ctx.sucios.pilotosPriv) ops.push({ op: 'set', path: `pilotos_priv/${id}`, data: sinId(ctx.pilotosPriv[id]) });
    for (const id of ctx.sucios.pilotos) ops.push({ op: 'set', path: `pilotos/${id}`, data: sinId(ctx.pilotos[id]) });
    Object.values(ctx.sucios).forEach(s => s.clear());
    if (ops.length) await ctx.store.batch(ops);
    return ops.length;
}

export function sinId(o) { const { id, ...r } = o; return r; }

export { SESION_INFO };
