// Carga de datos públicos de la temporada y utilidades derivadas
import { store, ahora, DEMO } from './app.js';
import { compactar, descompactar, construirTemporada, proyeccionMundial } from '../engine/stats.js';
import { LIGAS_NACIONALES, SESIONES, SESION_INFO } from '../engine/constants.js';

const TTL = 60_000;
function cacheGet(k) {
    if (DEMO) return null;
    try { const v = JSON.parse(sessionStorage.getItem(k)); if (v && Date.now() - v.t < TTL) return v.d; } catch { }
    return null;
}
function cacheSet(k, d) { if (DEMO) return; try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch { } }
export function limpiarCache() { try { Object.keys(sessionStorage).filter(k => k.startsWith('fx:')).forEach(k => sessionStorage.removeItem(k)); } catch { } }

async function getCache(path) {
    const k = `fx:${path}`;
    const c = cacheGet(k);
    if (c) return c;
    const d = await store().get(path);
    cacheSet(k, d);
    return d;
}

// Resultado completo (vueltas, incidentes). Inmutable una vez publicado → se cachea en localStorage.
export async function resultado(sid) {
    const k = `fxres:${sid}`;
    if (!DEMO) { try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch { } }
    const r = await store().get(`resultados/${sid}`);
    if (r && !DEMO) { try { localStorage.setItem(k, JSON.stringify(r)); } catch { try { Object.keys(localStorage).filter(x => x.startsWith('fxres:')).slice(0, 20).forEach(x => localStorage.removeItem(x)); } catch { } } }
    return r;
}

export async function cargarDatos() {
    const [cfg, cat] = await Promise.all([getCache('config/juego'), getCache('catalogo/actual')]);
    const temporada = cfg?.temporada || cat?.temporada || 1;
    const resumen = await getCache(`resumen/T${temporada}`);
    const compactas = resumen?.json ? JSON.parse(resumen.json).sesiones : [];
    const ya = new Set(compactas.map(x => x.sid));
    const t = ahora();
    const vivos = [], pendientes = [];
    for (const [evId, ev] of Object.entries(cat?.eventos || {})) {
        for (const tipo of SESIONES) {
            const s = ev.sesiones?.[tipo];
            if (!s) continue;
            const sid = `${evId}_${tipo}`;
            if (s.publishAt <= t && t < s.revealAt) vivos.push({ sid, evId, tipo, ev, ...s });
            else if (s.revealAt <= t && !ya.has(sid)) pendientes.push(sid);
        }
    }
    const procesando = [];
    await Promise.all(pendientes.slice(0, 18).map(async sid => {
        try {
            const r = await resultado(sid);
            if (r) { r.id = sid; compactas.push(compactar(r)); } else procesando.push(sid);
        } catch { procesando.push(sid); }
    }));
    return new Datos(cfg || {}, cat || { equipos: {}, pilotos: {}, eventos: {} }, compactas.map(descompactar), vivos, procesando);
}

export class Datos {
    constructor(cfg, cat, sesiones, vivos, procesando) {
        this.cfg = cfg; this.cat = cat; this.sesiones = sesiones; this.vivos = vivos; this.procesando = procesando;
        this._tablas = {};
        this.temporada = cfg.temporada || cat.temporada || 1;
    }
    piloto(pid) { return this.cat.pilotos[pid] || null; }
    equipo(eq) { return this.cat.equipos[eq] || null; }
    evento(id) { return this.cat.eventos[id] || null; }
    nombre = (pid) => { const p = this.piloto(pid); return p ? `${p.nombre} ${p.apellido}` : 'Piloto retirado'; };
    apellido = (pid) => this.piloto(pid)?.apellido || '—';
    nombreEquipo = (eq) => this.equipo(eq)?.nombre || '—';

    pilotosLiga(liga) {
        if (liga === 'INT') return (this.cfg.mundial?.participantes || []).map(id => ({ id, ...this.piloto(id) })).filter(p => p.nombre);
        return Object.entries(this.cat.pilotos).filter(([, p]) => p.liga === liga && p.equipoId).map(([id, p]) => ({ id, ...p }));
    }
    equiposLiga(liga) {
        if (liga === 'INT') {
            const ids = new Set(this.pilotosLiga('INT').map(p => p.equipoId));
            return [...ids].map(id => ({ id, ...this.equipo(id) }));
        }
        return Object.entries(this.cat.equipos).filter(([, e]) => e.liga === liga).map(([id, e]) => ({ id, ...e }));
    }
    companeros(liga) {
        const out = {};
        const pl = this.pilotosLiga(liga);
        pl.forEach(p => { const c = pl.find(o => o.equipoId === p.equipoId && o.id !== p.id); if (c) out[p.id] = c.id; });
        return out;
    }
    sesionesLiga(liga) { return this.sesiones.filter(s => s.liga === liga); }
    tabla(liga) {
        return (this._tablas[liga] ||= construirTemporada(this.sesionesLiga(liga), { companeros: this.companeros(liga) }));
    }
    tablaTodas() {
        return (this._tablas.__todas ||= construirTemporada(this.sesiones.filter(s => s.liga !== 'INT')));
    }
    // Clasificación con todos los pilotos de la liga (también los que aún no han puntuado)
    clasificacionPilotos(liga) {
        const t = this.tabla(liga);
        const lista = t.clasPilotos.slice();
        const ya = new Set(lista.map(p => p.pid));
        for (const p of this.pilotosLiga(liga)) if (!ya.has(p.id)) lista.push({ pid: p.id, eq: p.equipoId, pts: 0, victorias: 0, podios: 0, poles: 0, h2hTotal: { g: 0, p: 0 }, ptsEvento: {}, historial: [] });
        lista.forEach((p, i) => { p.posicion = i + 1; if (!p.eq) p.eq = this.piloto(p.pid)?.equipoId; });
        return lista;
    }
    clasificacionEquipos(liga) {
        const t = this.tabla(liga);
        const lista = t.clasEquipos.slice();
        const ya = new Set(lista.map(e => e.eq));
        for (const e of this.equiposLiga(liga)) if (!ya.has(e.id)) lista.push({ eq: e.id, pts: 0, victorias: 0, podios: 0, poles: 0, dobletes: 0, ptsEvento: {} });
        lista.forEach((e, i) => { e.posicion = i + 1; });
        return lista;
    }
    eventosLiga(liga) {
        return Object.entries(this.cat.eventos).filter(([, e]) => e.liga === liga).map(([id, e]) => ({ id, ...e })).sort((a, b) => a.ronda - b.ronda);
    }
    todasLasSesiones() {
        const out = [];
        for (const [id, ev] of Object.entries(this.cat.eventos)) for (const t of SESIONES) if (ev.sesiones?.[t]) out.push({ sid: `${id}_${t}`, evId: id, ev: { id, ...ev }, tipo: t, ...ev.sesiones[t] });
        return out.sort((a, b) => a.publishAt - b.publishAt);
    }
    proximas(n = 5, liga = null) {
        const t = ahora();
        return this.todasLasSesiones().filter(s => s.publishAt > t && (!liga || s.ev.liga === liga)).slice(0, n);
    }
    estadoSesion(s) {
        const t = ahora();
        if (t < s.lockAt) return 'abierta';
        if (t < s.publishAt) return 'cerrada';
        if (t < s.revealAt) return 'directo';
        return 'final';
    }
    sesionPublicada(sid) { return this.sesiones.find(s => s.sid === sid) || null; }
    proyeccionMundial() {
        const tablas = {};
        LIGAS_NACIONALES.forEach(l => { tablas[l] = this.tabla(l); });
        return proyeccionMundial(tablas);
    }
    // Mundial real (si ya está fijado) o proyección
    clasificadosMundial() {
        if (this.cfg.mundial?.clasificados?.length) return { fijado: true, clasificados: this.cfg.mundial.clasificados };
        return { fijado: false, ...this.proyeccionMundial() };
    }
    nombreSesion(tipo) { return SESION_INFO[tipo]?.nombre || tipo; }
}

export async function cargarNoticias(limite = 30) {
    try {
        // margen de 2 min por si el reloj del navegador va adelantado respecto al servidor
        return await store().list('noticias', [['publishAt', '<=', ahora() - 120_000]], { orden: ['publishAt', 'desc'], limit: limite });
    } catch (e) { console.warn('noticias', e); return []; }
}

// Ranking global de mánagers: puntos de su escudería respecto a la media de su liga (100 = media)
Datos.prototype.rankingManagers = function () {
    const out = [];
    for (const liga of LIGAS_NACIONALES) {
        const clas = this.clasificacionEquipos(liga);
        const media = clas.reduce((s, e) => s + e.pts, 0) / Math.max(1, clas.length);
        clas.forEach(e => {
            const eq = this.equipo(e.eq);
            if (!eq?.ownerId) return;
            out.push({ uid: eq.ownerId, nombre: eq.ownerNombre || 'Mánager', eq: e.eq, liga, pos: e.posicion, pts: e.pts, indice: media ? Math.round(e.pts / media * 100) : 100 });
        });
    }
    return out.sort((a, b) => b.indice - a.indice || a.pos - b.pos);
};

export async function cargarPaddock(limite = 40) {
    try { return await store().list('paddock', [], { orden: ['fecha', 'desc'], limit: limite }); }
    catch (e) { console.warn('paddock', e); return []; }
}

// Todas las sesiones de todas las temporadas (las pasadas no cambian: se cachean en localStorage)
export async function cargarHistorico(d) {
    const todas = d.sesiones.slice();
    for (let t = 1; t < d.temporada; t++) {
        const k = `fxhist:T${t}`;
        let json = null;
        if (!DEMO) { try { json = localStorage.getItem(k); } catch { } }
        if (!json) {
            const doc = await store().get(`resumen/T${t}`).catch(() => null);
            json = doc?.json || null;
            if (json && !DEMO) { try { localStorage.setItem(k, json); } catch { } }
        }
        if (json) todas.push(...JSON.parse(json).sesiones.map(descompactar));
    }
    return todas;
}
