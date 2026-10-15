// Juntas de pilotos (desde la temporada 2): se abren solas dos veces por temporada durante la liga nacional
// (tras la primera jornada y a mitad de liga), duran 48 horas y lo que se aprueba entra en vigor al momento.
// Los votos de los mánagers son consignas secretas (juntas_votos, solo servidor); el recuento se publica al cerrar.
import { LIGAS_NACIONALES } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { TEMAS, HORAS_JUNTA, TEMAS_POR_JUNTA, VOTOS_FIA, MULTA_SANCION, normasDe, recuento, probObedecer, rellenarTema } from '../engine/juntas.js';
import { cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, cargarEventos, sesionesOrdenadas, noticia, notificar, nombrePiloto, movimiento, duenoReal } from './comun.js';
import { tablasTemporada } from './temporada.js';

const activas = (cfg) => (cfg?.temporada || 1) >= 2 || cfg?.novedades === true;
export const idJunta = (t, n) => `T${t}_${n}`;
const titulares = (pil, eq) => Object.values(pil).filter(p => p.equipoId === eq && !['lesionado', 'retirado', 'libre'].includes(p.estado));

// El piloto más conflictivo de la temporada (para el tema de la sanción)
async function objetivoSancion(ctx, tablas, pil) {
    let mejor = null;
    for (const liga of LIGAS_NACIONALES) for (const p of tablas[liga]?.clasPilotos || []) {
        const e = (p.errores || 0) + (p.dnf || 0);
        if (pil[p.pid]?.equipoId && e >= 4 && (!mejor || e > mejor.errores)) mejor = { pid: p.pid, eq: pil[p.pid].equipoId, errores: e };
    }
    if (!mejor) return null;
    return { ...mejor, nombre: nombrePiloto(pil[mejor.pid]), equipo: ctx.equipos[mejor.eq]?.nombre || '' };
}

// Una vez al día: ¿toca abrir junta?
export async function abrirJuntaSiToca(ctx) {
    ctx.juntaAbierta = false;
    if (!activas(ctx.cfg) || ctx.cfg.fase !== 'nacional') return null;
    const T = ctx.cfg.temporada;
    const juntas = await ctx.store.list('juntas', [['temporada', '==', T]]);
    if (juntas.some(j => j.estado === 'abierta')) { ctx.juntaAbierta = true; return null; }
    const n = juntas.length;
    if (n >= 2) return null;
    const nac = (await cargarEventos(ctx, T)).filter(e => e.liga !== 'INT');
    const hechos = nac.filter(e => sesionesOrdenadas(e).length && sesionesOrdenadas(e).every(s => s.estado === 'publicada')).length;
    if (!hechos || (n === 1 && hechos < nac.length * 0.5)) return null;
    await cargarEquipos(ctx);
    const pil = await cargarPilotos(ctx);
    const rng = crearRng(`${ctx.secreto}|junta|${T}|${n + 1}`);
    const usados = new Set(juntas.flatMap(j => (j.temas || []).map(t => t.id)));
    const temas = [];
    const obj = await objetivoSancion(ctx, await tablasTemporada(ctx.store, T), pil);
    if (obj && rng.chance(0.85)) temas.push({ id: 'sancion', objetivo: obj });
    for (const id of rng.shuffle(Object.keys(TEMAS).filter(k => k !== 'sancion' && !usados.has(k)))) if (temas.length < TEMAS_POR_JUNTA) temas.push({ id });
    const doc = {
        temporada: T, n: n + 1, abre: ctx.ahora, cierra: ctx.ahora + HORAS_JUNTA * 3600_000, estado: 'abierta',
        temas: temas.map(({ id, objetivo }) => {
            const t = TEMAS[id], v = objetivo || {};
            return { id, titulo: rellenarTema(t.titulo, v), texto: rellenarTema(t.texto, v), opciones: t.opciones.map(o => ({ id: o.id, texto: o.texto })), fia: t.fia, ...(objetivo ? { objetivo } : {}) };
        }),
    };
    ctx.ops.push({ op: 'set', path: `juntas/${idJunta(T, n + 1)}`, data: doc });
    noticia(ctx, { titulo: `Junta de pilotos ${n + 1} de la temporada`, texto: `Se vota: ${doc.temas.map(t => t.titulo.toLowerCase()).join(', ')}. Cada piloto tiene un voto y la FIA ${VOTOS_FIA}. Hay 48 horas.`, tipo: 'fase' });
    for (const eq of Object.keys(ctx.equipos)) if (duenoReal(ctx, eq)) notificar(ctx, eq, { remitente: 'Asociación de pilotos', tipo: 'junta', titulo: 'Junta de pilotos: dales tu consigna', texto: `Se vota ${doc.temas.map(t => t.titulo.toLowerCase()).join(', ')}. Dile a tus pilotos qué votar en Mi escudería → Hoy (48 horas). Ojo: con la moral baja pueden ir por libre.` });
    ctx.juntaAbierta = true;
    ctx.nota(`Junta de pilotos ${n + 1} abierta`);
    return doc;
}

// En cada ciclo: cerrar las juntas cuyo plazo ha terminado
export async function procesarJuntas(ctx) {
    if (!activas(ctx.cfg)) return;
    const abiertas = (await ctx.store.list('juntas', [['estado', '==', 'abierta']])).filter(j => j.cierra <= ctx.ahora);
    for (const j of abiertas) await cerrarJunta(ctx, j);
}

export async function cerrarJunta(ctx, j) {
    await cargarEquipos(ctx); await cargarPrivs(ctx);
    const pil = await cargarPilotos(ctx);
    const consignasHumanas = (await ctx.store.get(`juntas_votos/${j.id}`))?.votos || {};
    const tablas = await tablasTemporada(ctx.store, j.temporada);
    const normas = normasDe(ctx.cfg);
    // Lo que hay ahora en cada tema (la IA a veces prefiere no tocar nada)
    const actual = (t) => TEMAS[t.id].campo ? TEMAS[t.id].opciones.find(o => o.valor === normas[TEMAS[t.id].campo])?.id : 'nada';
    const rng = crearRng(`${ctx.secreto}|juntaVoto|${j.id}`);
    const votos = Object.fromEntries(j.temas.map(t => [t.id, []]));
    const rebeldes = [];
    const ids = [];
    const equipos = Object.entries(ctx.equipos).filter(([, e]) => LIGAS_NACIONALES.includes(e.liga));
    for (const [eq] of equipos) ids.push(...titulares(pil, eq).map(p => p.id));
    const pp = await cargarPilotosPriv(ctx, ids);
    for (const [eq, e] of equipos) {
        const clas = tablas[e.liga]?.clasEquipos || [];
        const pos = (clas.findIndex(x => x.eq === eq) + 1) || clas.length || 10;
        const humano = !!duenoReal(ctx, eq);
        const consigna = {};
        for (const t of j.temas) {
            const propio = t.objetivo?.eq === eq;
            consigna[t.id] = humano ? consignasHumanas[eq]?.[t.id] || null : rng.chance(0.35) && actual(t) ? actual(t) : TEMAS[t.id].ia({ pos, n: Math.max(clas.length, 10), presupuesto: ctx.privs[eq]?.presupuesto || 0, rng, propio });
        }
        for (const p of titulares(pil, eq)) for (const t of j.temas) {
            const ops = t.opciones.map(o => o.id);
            const suyo = t.id === 'sancion' && (t.objetivo?.pid === p.id || t.objetivo?.eq === eq) ? 'nada' : rng.pick(ops);
            const c = consigna[t.id];
            const voto = c && rng.chance(probObedecer(pp[p.id]?.moral)) ? c : suyo;
            if (c && voto !== c) rebeldes.push({ pid: p.id, eq, tema: t.id, voto, consigna: c });
            votos[t.id].push(voto);
        }
    }
    const resultados = [];
    for (const t of j.temas) {
        const def = TEMAS[t.id];
        const r = recuento(def, votos[t.id], t.fia);
        const op = def.opciones.find(o => o.id === r.ganador);
        resultados.push({ tema: t.id, cuenta: r.cuenta, ganador: r.ganador, texto: op.texto });
        if (def.campo) normas[def.campo] = op.valor;
        else if (t.id === 'sancion' && op.valor) {
            const o = t.objetivo;
            if (op.valor === 'multa' && ctx.privs[o.eq]) { movimiento(ctx.privs[o.eq], `Multa de la junta de pilotos (${o.nombre})`, -MULTA_SANCION, ctx.ahora); ctx.sucios.privs.add(o.eq); }
            if (op.valor === 'parrilla') normas.sanciones = [...(normas.sanciones || []).filter(s => s.pid !== o.pid), { pid: o.pid, puestos: 5, junta: j.id }];
            notificar(ctx, o.eq, { remitente: 'Asociación de pilotos', tipo: 'junta', titulo: `Sanción a ${o.nombre}`, texto: op.valor === 'multa' ? `La junta multa a tu escudería con ${(MULTA_SANCION / 1000).toFixed(0)}.000 €.` : `${o.nombre} saldrá 5 puestos más atrás en su próxima carrera.` });
        }
    }
    await ctx.store.merge('config/juego', { normas });
    ctx.cfg.normas = normas;
    ctx.ops.push({ op: 'merge', path: `juntas/${j.id}`, data: { estado: 'cerrada', cerrada: ctx.ahora, resultados, rebeldes: rebeldes.length, votantes: ids.length } });
    const resumen = resultados.map(r => `${j.temas.find(t => t.id === r.tema).titulo}: ${r.texto.toLowerCase()}`).join(' · ');
    noticia(ctx, { titulo: `La junta de pilotos decide`, texto: `${resumen}. Votaron ${ids.length} pilotos y la FIA (${VOTOS_FIA} votos). ${rebeldes.length ? `${rebeldes.length} votos fueron contra la consigna de su mánager.` : ''} Entra en vigor desde la próxima sesión.`, tipo: 'fase' });
    for (const [eq] of equipos) {
        if (!duenoReal(ctx, eq)) continue;
        const mios = rebeldes.filter(r => r.eq === eq);
        notificar(ctx, eq, { remitente: 'Asociación de pilotos', tipo: 'junta', titulo: 'Resultado de la junta de pilotos', texto: `${resumen}.${mios.length ? ` Ojo: ${[...new Set(mios.map(r => nombrePiloto(pil[r.pid])))].join(' y ')} no siguió tu consigna en ${mios.length} votación${mios.length > 1 ? 'es' : ''}.` : ' Tus pilotos votaron lo que les pediste.'}` });
    }
    ctx.nota(`Junta ${j.id} cerrada: ${resumen}`);
}

export const ACCIONES_JUNTAS = {
    // Consigna para los pilotos: { juntaId, votos: { tema: opcion } }
    async junta_votar(ctx, a) {
        if (!activas(ctx.cfg)) throw new Error('Las juntas de pilotos llegan la próxima temporada.');
        const j = await ctx.store.get(`juntas/${a.params?.juntaId}`);
        if (!j || j.estado !== 'abierta' || j.cierra <= ctx.ahora) throw new Error('La junta ya está cerrada.');
        const votos = {};
        for (const t of j.temas) {
            const v = a.params?.votos?.[t.id];
            if (v == null || v === '') continue;
            if (!t.opciones.some(o => o.id === v)) throw new Error('Opción no válida.');
            votos[t.id] = v;
        }
        if (!Object.keys(votos).length) throw new Error('Elige al menos una opción.');
        await ctx.store.merge(`juntas_votos/${j.id}`, { votos: { [a.equipoId]: votos } });
        const priv = ctx.privs[a.equipoId];
        if (priv) { priv.votoJunta = { id: j.id, votos, fecha: ctx.ahora }; ctx.sucios.privs.add(a.equipoId); }
        return { ok: true };
    },
};
