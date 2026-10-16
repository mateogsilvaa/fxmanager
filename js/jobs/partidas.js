// Partidas de amigos: creación (parrilla y calendario propios), paso automático de temporada y gestión ligera
// por parte de su administrador. La partida original no pasa por aquí: sigue con el control completo de siempre.
import { LIGAS_TODAS, PAISES, fijarLigas, diaMadrid } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { generarParrilla, planCalendario } from '../engine/generador.js';
import { StorePartida } from '../core/partida-store.js';
import { importarParrilla, crearEvento, guardarEventos, nuevaTemporada } from './temporada.js';
import { activarNovedades } from './novedades.js';
import { crearContexto, volcar, noticia, cargarEquipos } from './comun.js';
import { reconstruirCatalogo } from './catalogo.js';

export const MAX_PARTIDAS_POR_PERSONA = 3;
export const MAX_MIEMBROS = 50;
const azar = (n = 8) => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
export const nuevoCodigo = () => String(Math.floor(1000 + Math.random() * 9000));

// Ajustes que puede elegir quien crea la partida (todo se sanea aquí: el cliente no es de fiar)
export function sanearAjustes(a = {}) {
    const ligas = LIGAS_TODAS.filter(l => (a.ligas || []).includes(l));
    return {
        ligas: ligas.length ? ligas : ['ESP'],
        mundial: ligas.length >= 2 && a.mundial !== false,
        jornadas: Math.max(3, Math.min(8, Math.round(+a.jornadas || 5))),
        diasEntre: Math.max(1, Math.min(7, Math.round(+a.diasEntre || 4))),
        hora: Math.max(10, Math.min(22, Math.round(+a.hora || 19))),
        novedades: a.novedades !== false,
    };
}

async function calendario(store, { temporada, ajustes, secreto, ahora }) {
    const rng = crearRng(`${secreto}|calendario|${temporada}`);
    const inicio = diaMadrid(ahora + 2 * 864e5);
    const { plan, sede } = planCalendario(rng, { ligas: ajustes.ligas, mundial: ajustes.mundial, inicio, jornadas: ajustes.jornadas, diasEntre: ajustes.diasEntre, hora: ajustes.hora });
    const eventos = plan.map(p => crearEvento({ temporada, liga: p.liga, ronda: p.ronda, circuito: p.circuito, horarios: p.horarios, minutosCierre: 30, semilla: secreto }));
    await guardarEventos(store, eventos);
    return { eventos, sede };
}

// Crea de verdad una partida pedida desde la web (partidas/{id} con estado 'solicitada')
export async function crearPartida(base, p, { ahora = Date.now(), log = () => { } } = {}) {
    const mias = (await base.list('partidas', [['creador', '==', p.creador]])).filter(x => x.id !== p.id && ['activa', 'solicitada'].includes(x.estado));
    if (mias.length >= MAX_PARTIDAS_POR_PERSONA) {
        await base.merge(`partidas/${p.id}`, { estado: 'rechazada', motivo: `Como mucho puedes crear ${MAX_PARTIDAS_POR_PERSONA} partidas activas.` });
        return null;
    }
    const ajustes = sanearAjustes(p.ajustes);
    const store = new StorePartida(base, p.id);
    const secreto = azar(24);
    const nombre = String(p.nombre || 'Mi liga').replace(/[<>]/g, '').trim().slice(0, 40) || 'Mi liga';
    fijarLigas(ajustes.ligas, !ajustes.mundial);
    try {
        await store.set('secreto/juego', { clave: secreto });
        await store.set('config/juego', {
            temporada: 1, fase: 'pretemporada', inscripcion: true, minutosCierre: 30, horasDraft: 48, cadenciaMin: 10,
            mundial: { pais: null, nombre: null, participantes: [] }, palmares: [],
            ligas: ajustes.ligas, sinMundial: !ajustes.mundial, auto: ajustes, partida: p.id, nombrePartida: nombre,
        });
        await importarParrilla(store, generarParrilla(crearRng(`${secreto}|parrilla`), ajustes.ligas), { semilla: `${secreto}|attrs` });
        const { sede } = await calendario(store, { temporada: 1, ajustes, secreto, ahora });
        if (sede) await store.merge('config/juego', { mundial: { pais: sede, nombre: PAISES[sede] || sede, participantes: [] } });
        if (ajustes.novedades) {
            const ctx = crearContexto(store, { ahora, log });
            ctx.cfg = await store.get('config/juego'); ctx.secreto = secreto; ctx.temporada = 1;
            await activarNovedades(ctx);
            await volcar(ctx);
        }
        await reconstruirCatalogo(store, await store.get('config/juego'));
    } finally { fijarLigas(); }
    const codigo = nuevoCodigo();
    await base.set(`partidas_priv/${p.id}`, { codigo });
    await base.set(`partidas/${p.id}/miembros/${p.creador}`, { uid: p.creador, nombre: p.creadorNombre || 'Admin', equipoId: null, rol: 'admin', unido: ahora });
    await base.merge(`partidas/${p.id}`, { nombre, estado: 'activa', activada: ahora, ajustes, admins: [p.creador], miembros: 1, temporada: 1, fase: 'pretemporada' });
    log(`Partida ${p.id} creada (${ajustes.ligas.join(', ')}${ajustes.mundial ? ' + Mundial' : ''})`);
    return { id: p.id, ajustes };
}

// Paso automático de temporada en las partidas de amigos: un día después de cerrar el mercado
export async function autoTemporada(ctx) {
    const a = ctx.cfg?.auto;
    if (!a || ctx.cfg.fase !== 'cerrada') return;
    const m = await ctx.store.get(`mercado/T${ctx.cfg.temporada}`);
    const cerrado = m?.cerrado || 0;
    if (!cerrado || ctx.ahora - cerrado < 864e5) return;
    const pal = await nuevaTemporada(ctx.store, { ahora: ctx.ahora, reglamento: 'azar' });
    const cfg = await ctx.store.get('config/juego');
    const secreto = (await ctx.store.get('secreto/juego'))?.clave || 'sin-secreto';
    const { sede } = await calendario(ctx.store, { temporada: cfg.temporada, ajustes: a, secreto, ahora: ctx.ahora });
    if (sede) await ctx.store.merge('config/juego', { mundial: { pais: sede, nombre: PAISES[sede] || sede, participantes: [] } });
    await reconstruirCatalogo(ctx.store, await ctx.store.get('config/juego'));
    ctx.cfg = await ctx.store.get('config/juego');
    noticia(ctx, { titulo: `¡Arranca la temporada ${cfg.temporada}!`, texto: `Calendario nuevo: la primera jornada es en dos días.${pal.cambioReglamento ? ' Y con cambio de reglamento: los coches empiezan casi de cero.' : ''}`, tipo: 'fase' });
    ctx.nota(`Temporada ${cfg.temporada} creada automáticamente`);
}

// ---------- Gestión ligera (administrador de la partida) ----------
// partidas/{id}/gestion/{doc}: { uid, tipo, params, creado, estado: 'pendiente' } → el worker lo valida y lo aplica
export async function procesarGestion(ctx) {
    const pid = ctx.cfg?.partida;
    if (!pid) return;
    if (ctx.pre && !ctx.pre.gestion?.length) return;
    const lista = await ctx.store.list('gestion', [['estado', '==', 'pendiente']]);
    if (!lista.length) return;
    const doc = await ctx.store.get(`partidas/${pid}`);
    for (const g of lista) {
        let resultado = { ok: true };
        try {
            if (!(doc?.admins || []).includes(g.uid)) throw new Error('No eres administrador de esta partida.');
            const fn = GESTION[g.tipo];
            if (!fn) throw new Error('Acción desconocida.');
            resultado = (await fn(ctx, g.params || {}, doc)) || { ok: true };
            ctx.ops.push({ op: 'update', path: `gestion/${g.id}`, data: { estado: 'hecha', resultado, procesado: ctx.ahora } });
        } catch (e) { ctx.ops.push({ op: 'update', path: `gestion/${g.id}`, data: { estado: 'error', resultado: { error: e.message }, procesado: ctx.ahora } }); }
    }
}
const GESTION = {
    async inscripcion(ctx, { abierta }) {
        await ctx.store.merge('config/juego', { inscripcion: !!abierta, inscripcionCerrada: abierta ? ctx.cfg.temporada : null });
        ctx.cfg.inscripcion = !!abierta;
    },
    async publica(ctx, { publica }, doc) { await ctx.store.merge(`partidas/${doc.id}`, { publica: !!publica }); },
    async renombrar(ctx, { nombre }, doc) {
        const n = String(nombre || '').replace(/[<>]/g, '').trim().slice(0, 40);
        if (n.length < 3) throw new Error('El nombre es demasiado corto.');
        await ctx.store.merge(`partidas/${doc.id}`, { nombre: n });
    },
    async codigo(ctx, _p, doc) { await ctx.store.set(`partidas_priv/${doc.id}`, { codigo: nuevoCodigo() }); },
    async admin(ctx, { uid, si }, doc) {
        const admins = new Set(doc.admins || []);
        if (si) admins.add(uid); else if (admins.size > 1) admins.delete(uid);
        await ctx.store.merge(`partidas/${doc.id}`, { admins: [...admins] });
    },
    // Echar a alguien: su escudería vuelve a la IA
    async expulsar(ctx, { uid }, doc) {
        if ((doc.admins || []).includes(uid) && (doc.admins || []).length <= 1) throw new Error('No puedes echar al único administrador.');
        const m = await ctx.store.get(`miembros/${uid}`);
        if (!m) throw new Error('No es miembro de la partida.');
        await cargarEquipos(ctx);
        if (m.equipoId && ctx.equipos[m.equipoId]?.ownerId === uid) {
            ctx.ops.push({ op: 'merge', path: `equipos/${m.equipoId}`, data: { ownerId: null, ownerNombre: null } });
            ctx.catalogoSucio = true;
        }
        ctx.ops.push({ op: 'del', path: `miembros/${uid}` });
        await ctx.store.merge(`partidas/${doc.id}`, { admins: (doc.admins || []).filter(x => x !== uid), miembros: Math.max(0, (doc.miembros || 1) - 1) });
        noticia(ctx, { titulo: `${m.nombre || 'Un mánager'} deja la partida`, texto: m.equipoId ? 'Su escudería vuelve a manos de la IA.' : '', tipo: 'fase' });
    },
    async archivar(ctx, _p, doc) { await ctx.store.merge(`partidas/${doc.id}`, { estado: 'archivada', archivada: ctx.ahora }); },
};
