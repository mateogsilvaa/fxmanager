// Operaciones de temporada (panel admin y cambios de fase automáticos)
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL, SESIONES, ECO, INSTALACIONES, esCarrera } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { atributosAleatorios, salarioPiloto } from '../engine/juego.js';
import { descompactar, construirTemporada } from '../engine/stats.js';
import { abrirMercado, cerrarMercado } from './mercado.js';
import { normalizarCircuito } from '../engine/circuitos.js';
import {
    crearContexto, cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, horarioSesion, noticia, notificar,
    nombrePiloto, volcar, idResumen, sinId, movimiento, duenoReal,
} from './comun.js';
import { reconstruirCatalogo } from './catalogo.js';
import { ratingsLiga } from '../engine/rating.js';

export const COLECCIONES_JUEGO = ['equipos', 'equipos_priv', 'pilotos', 'pilotos_priv', 'eventos', 'resultados', 'resumen', 'estrategias', 'acciones', 'notificaciones', 'decisiones', 'pronosticos', 'ranking', 'noticias', 'mercado', 'mercado_priv', 'mercado_ofertas', 'paddock', 'prensa', 'logs', 'catalogo'];
// Colecciones de la temporada pasada (versión anterior de FX Manager)
export const COLECCIONES_ANTIGUAS = ['actividad_equipos', 'carreras', 'comunicados', 'ingenieros_equipos', 'mensajes_aprobacion', 'mercado_agentes', 'ofertas', 'publicaciones', 'respuestas_mensajes', 'solicitudes_admin', 'configuracion'];

export async function inicializarJuego(store, { temporada = 1 } = {}) {
    const cfg = await store.get('config/juego');
    if (cfg) return cfg;
    const nuevo = { temporada, fase: 'pretemporada', inscripcion: true, minutosCierre: 30, horasDraft: 48, mundial: { pais: 'jp', nombre: 'Japón', participantes: [] }, palmares: [], cadenciaMin: 10 };
    await store.set('config/juego', nuevo);
    return nuevo;
}

// Borra todo el juego (y los restos de la temporada pasada). Conserva las cuentas de usuario.
export async function borrarTodo(store, { progreso = () => {} } = {}) {
    for (const c of [...COLECCIONES_ANTIGUAS, ...COLECCIONES_JUEGO]) {
        const docs = await store.list(c);
        if (docs.length) await store.batch(docs.map(d => ({ op: 'del', path: `${c}/${d.id}` })));
        progreso(`${c}: ${docs.length} borrados`);
    }
    const usuarios = await store.list('usuarios');
    await store.batch(usuarios.map(u => ({ op: 'merge', path: `usuarios/${u.id}`, data: { equipoId: null, equipo: null } })));
    progreso(`usuarios: ${usuarios.length} desvinculados de su equipo`);
    const cfg = await store.get('config/juego');
    await store.set('config/juego', { temporada: 1, fase: 'pretemporada', inscripcion: true, minutosCierre: cfg?.minutosCierre || 30, horasDraft: 48, mundial: { pais: 'jp', nombre: 'Japón', participantes: [] }, palmares: [], cadenciaMin: cfg?.cadenciaMin || 10 });
}

// ---------- Importar parrilla ----------
// json: { equipos: [{id, nombre, corto?, liga, grupo?, color, coche?}], pilotos: [{id?, nombre, apellido, nac, equipo, rol, numero?, edad?, attrs?}] }
export function validarParrilla(json) {
    const errores = [], avisos = [];
    const equipos = json.equipos || [], pilotos = json.pilotos || [];
    const ids = new Set();
    for (const e of equipos) {
        if (!e.id || !e.nombre || !LIGAS_NACIONALES.includes(e.liga)) errores.push(`Equipo inválido: ${JSON.stringify(e).slice(0, 80)}`);
        if (ids.has(e.id)) errores.push(`Id de equipo repetido: ${e.id}`);
        ids.add(e.id);
    }
    for (const liga of LIGAS_NACIONALES) {
        const eqs = equipos.filter(e => e.liga === liga);
        if (eqs.length !== 10) avisos.push(`${LIGAS[liga].nombre}: ${eqs.length} equipos (el reglamento dice 10).`);
        const pl = pilotos.filter(p => eqs.some(e => e.id === p.equipo));
        const locales = pl.filter(p => p.nac === NAC_LOCAL[liga]).length;
        if (locales < 11) errores.push(`${LIGAS[liga].nombre}: solo ${locales} pilotos locales (mínimo 11).`);
        for (const e of eqs) {
            const suyos = pilotos.filter(p => p.equipo === e.id);
            if (suyos.length !== 2) errores.push(`${e.nombre}: tiene ${suyos.length} pilotos (deben ser 2).`);
            const p1 = suyos.find(p => p.rol === 'P1');
            if (!p1) errores.push(`${e.nombre}: falta el Piloto 1.`);
            else if (p1.nac !== NAC_LOCAL[liga]) errores.push(`${e.nombre}: el Piloto 1 (${p1.nombre} ${p1.apellido}) debe ser de nacionalidad ${LIGAS[liga].gentilicio}.`);
        }
    }
    for (const p of pilotos) if (!ids.has(p.equipo)) errores.push(`Piloto ${p.nombre} ${p.apellido}: equipo desconocido "${p.equipo}".`);
    return { errores, avisos };
}

export async function importarParrilla(store, json, { semilla = 'parrilla' } = {}) {
    const { errores } = validarParrilla(json);
    if (errores.length) throw new Error(errores.join('\n'));
    const rng = crearRng(semilla);
    const anteriores = Object.fromEntries((await store.list('equipos')).map(e => [e.id, e]));
    const ops = [];
    for (const e of json.equipos) {
        const prev = anteriores[e.id];
        ops.push({ op: 'set', path: `equipos/${e.id}`, data: { nombre: e.nombre, corto: e.corto || e.nombre, liga: e.liga, grupo: e.grupo || null, color: e.color || '#888888', ownerId: prev?.ownerId || null, ownerNombre: prev?.ownerNombre || null, fans: e.fans ?? rng.int(800, 2500), historia: prev?.historia || [] } });
        const coche = e.coche || { motor: rng.int(0, 2), aero: rng.int(0, 2), chasis: rng.int(0, 2), fiabilidad: rng.int(0, 2) };
        ops.push({ op: 'set', path: `equipos_priv/${e.id}`, data: { equipoId: e.id, presupuesto: ECO.presupuestoInicial, coche, inst: { fabrica: 0, simulador: 0, marketing: 0 }, proyectos: [], sponsor: null, ofertasSponsor: [], racha: { n: 0, ultimoDia: null }, finanzas: [], riesgoFiab: 1 } });
    }
    const numeros = {};
    json.pilotos.forEach((p, i) => {
        const eq = json.equipos.find(e => e.id === p.equipo);
        const id = p.id || `p_${eq.liga}_${(p.apellido || 'x').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}_${i}`;
        const usados = (numeros[eq.liga] ||= new Set());
        let numero = p.numero;
        if (!numero || usados.has(numero)) { do numero = rng.int(2, 99); while (usados.has(numero)); }
        usados.add(numero);
        const estrella = p.estrella ?? (rng.chance(0.15) ? 1 : 0);
        const attrs = { ...atributosAleatorios(rng, { estrella }), ...(p.attrs || {}) };
        ops.push({ op: 'set', path: `pilotos/${id}`, data: { nombre: p.nombre, apellido: p.apellido, nac: p.nac, numero, equipoId: eq.id, liga: eq.liga, rol: p.rol === 'P1' ? 'P1' : 'P2', edad: p.edad || rng.int(19, 34), rookie: false, estado: 'activo', historia: [] } });
        ops.push({ op: 'set', path: `pilotos_priv/${id}`, data: { pilotoId: id, equipoId: eq.id, attrs, moral: 60, forma: 0, salario: salarioPiloto(attrs) } });
    });
    await store.batch(ops);
    const cfg = await inicializarJuego(store);
    await reconstruirCatalogo(store, cfg);
    return { equipos: json.equipos.length, pilotos: json.pilotos.length };
}

// ---------- Calendario ----------
// fechaHoraMs(fechaISO, 'HH:MM') => ms. Se inyecta para usar la zona horaria del navegador del admin.
export function crearEvento({ temporada, liga, ronda, circuito, horarios, minutosCierre = 60, semilla = '' }) {
    const c = normalizarCircuito(circuito);
    const rng = crearRng(`meteo|${temporada}|${liga}|${ronda}|${semilla}`);
    const sesiones = {}, meteo = {};
    for (const t of SESIONES) {
        if (!horarios[t]) continue;
        sesiones[t] = horarioSesion(t, horarios[t], minutosCierre);
        meteo[t] = Math.round(Math.max(0, Math.min(0.95, c.lluvia + rng.gauss(0, 0.12))) * 100) / 100;
    }
    return { id: `${temporada}_${liga}_${ronda}`, temporada, liga, ronda, fase: liga === 'INT' ? 'mundial' : 'nacional', circuito: c, sesiones, meteo, estado: 'programado' };
}

export async function guardarEventos(store, eventos) {
    await store.batch(eventos.map(ev => ({ op: 'set', path: `eventos/${ev.id}`, data: sinId(ev) })));
    await reconstruirCatalogo(store, await store.get('config/juego'));
}

export async function borrarEvento(store, id) {
    await store.del(`eventos/${id}`);
    await reconstruirCatalogo(store, await store.get('config/juego'));
}

// ---------- Tablas de la temporada ----------
export async function tablasTemporada(store, temporada) {
    const doc = await store.get(`resumen/${idResumen(temporada)}`);
    const sesiones = doc?.json ? JSON.parse(doc.json).sesiones.map(descompactar) : [];
    const tablas = {};
    for (const liga of [...LIGAS_NACIONALES, 'INT']) tablas[liga] = construirTemporada(sesiones.filter(s => s.liga === liga));
    return tablas;
}

// ---------- Mercado ----------
// Al terminar el Mundial: premios, ofertas de plaza, resúmenes, historial de mánagers y se abre el mercado (3 días)
export async function prepararMercado(ctx) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    const tablas = await tablasTemporada(store, temporada);
    const pilotosMap = await cargarPilotos(ctx);
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const nombre = (pid) => nombrePiloto(pilotosMap[pid]);

    // Premios de fin de temporada por posición en cada liga
    for (const liga of LIGAS_NACIONALES) {
        tablas[liga].clasEquipos.forEach((e, i) => {
            const premio = ECO.premiosLiga[i] || 0;
            if (!premio || !privs[e.eq]) return;
            movimiento(privs[e.eq], `Premio de liga: ${i + 1}º de ${LIGAS[liga].nombre}`, premio, ctx.ahora);
            ctx.sucios.privs.add(e.eq);
        });
    }
    // Premios del Mundial
    const int = tablas.INT;
    int.clasEquipos.slice(0, ECO.premiosMundialEscuderias.length).forEach((e, i) => {
        if (!privs[e.eq]) return;
        movimiento(privs[e.eq], `Mundial de escuderías: ${i + 1}º`, ECO.premiosMundialEscuderias[i], ctx.ahora);
        ctx.sucios.privs.add(e.eq);
    });
    const campeon = int.clasPilotos[0];
    if (campeon && privs[campeon.eq]) {
        movimiento(privs[campeon.eq], `Campeón del mundo: ${nombre(campeon.pid)}`, ECO.bonusCampeonMundial, ctx.ahora);
        ctx.sucios.privs.add(campeon.eq);
    }
    ofertasDePlaza(ctx, { tablas, equipos, privs, rng: crearRng(`${ctx.secreto}|plaza|${temporada}`) });
    resumenesTemporada(ctx, { tablas, equipos, privs, pilotos: pilotosMap });
    await historialManagers(ctx, { tablas, equipos });
    await abrirMercado(ctx, { tablas });
    await store.merge('config/juego', { fase: 'mercado' });
    ctx.cfg.fase = 'mercado';
    await volcar(ctx);
}
export { cerrarMercado };

// ---------- Nueva temporada ----------
// reglamento: 'no' | 'si' | 'azar' (20% de probabilidad). Con cambio de reglamento el reinicio del coche es mucho
// más duro y algunas instalaciones pierden nivel (sus datos dejan de servir con las normas nuevas).
export const PROB_CAMBIO_REGLAMENTO = 0.2;
export async function nuevaTemporada(store, { ahora = Date.now(), reglamento = 'no' } = {}) {
    const cfg = await store.get('config/juego');
    const temporada = cfg.temporada || 1;
    const secreto = (await store.get('secreto/juego').catch(() => null))?.clave || 'sin-secreto';
    const rngReg = crearRng(`${secreto}|reglamento|${temporada}`);
    const cambio = reglamento === 'si' || (reglamento === 'azar' && rngReg.chance(PROB_CAMBIO_REGLAMENTO));
    // Instalaciones afectadas: el túnel siempre (la aerodinámica cambia), el simulador casi siempre y una más al azar
    const afectadas = cambio ? [['tunel', 2], ['simulador', 1], [rngReg.pick(['fabrica', 'boxes', 'academia']), 1]] : [];
    const tablas = await tablasTemporada(store, temporada);
    const ctx = crearContexto(store, { ahora });
    ctx.cfg = cfg;
    ctx.sombra = await store.get('secreto/sombra').catch(() => null);
    const pilotos = await cargarPilotos(ctx);
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);

    const palmares = { temporada, ligas: {}, mundial: null, mundialEquipos: null };
    for (const liga of LIGAS_NACIONALES) {
        const t = tablas[liga];
        palmares.ligas[liga] = { piloto: t.clasPilotos[0]?.pid || null, equipo: t.clasEquipos[0]?.eq || null, pts: t.clasPilotos[0]?.pts || 0 };
        t.clasPilotos.forEach(s => {
            const p = pilotos[s.pid]; if (!p) return;
            p.historia = [...(p.historia || []), { temporada, liga, equipoId: s.eq, pos: s.posicion, pts: s.pts, victorias: s.victorias, podios: s.podios, poles: s.poles }];
            ctx.sucios.pilotos.add(s.pid);
        });
        t.clasEquipos.forEach(s => {
            const e = equipos[s.eq]; if (!e) return;
            ctx.ops.push({ op: 'merge', path: `equipos/${s.eq}`, data: { historia: [...(e.historia || []), { temporada, liga, pos: s.posicion, pts: s.pts, victorias: s.victorias }] } });
        });
    }
    if (tablas.INT.clasPilotos.length) {
        palmares.mundial = tablas.INT.clasPilotos[0].pid;
        palmares.mundialEquipos = tablas.INT.clasEquipos[0]?.eq || null;
        tablas.INT.clasPilotos.forEach(s => {
            const p = pilotos[s.pid]; if (!p) return;
            p.historia = [...(p.historia || []), { temporada, liga: 'INT', equipoId: s.eq, pos: s.posicion, pts: s.pts, victorias: s.victorias, podios: s.podios, poles: s.poles }];
            ctx.sucios.pilotos.add(s.pid);
        });
    }
    for (const p of Object.values(pilotos)) {
        if (p.equipoId) { p.edad = (p.edad || 20) + 1; p.rookie = p.temporadaDebut === temporada + 1; ctx.sucios.pilotos.add(p.id); }
    }
    ctx.equipos = equipos;
    for (const [id, priv] of Object.entries(privs)) {
        priv.presupuesto = Math.round((priv.presupuesto || 0) * 0.5 + 8_000_000 + (cambio ? AYUDA_REGLAMENTO : 0));
        const coche = priv.coche || {};
        // Normal: cada área baja 2 niveles. Cambio de reglamento: se conserva solo una cuarta parte.
        priv.coche = Object.fromEntries(Object.entries(coche).map(([k, v]) => [k, cambio ? Math.floor(v * 0.25) : Math.max(0, v - 2)]));
        const perdidas = [];
        if (cambio) {
            priv.inst = { ...(priv.inst || {}) };
            for (const [inst, n] of afectadas) {
                const antes = priv.inst[inst] || 0;
                if (antes > 0) { priv.inst[inst] = Math.max(0, antes - n); perdidas.push(`${INSTALACIONES[inst].nombre} ${antes}→${priv.inst[inst]}`); }
            }
            priv.descuentos = {};
        }
        priv.proyectos = [];
        priv.sponsor = null; priv.ofertasSponsor = [];
        priv.finanzas = [{ t: ahora, c: `Inicio de la temporada ${temporada + 1}`, v: 0 }, ...(cambio ? [{ t: ahora, c: 'Ayuda de la liga por el cambio de reglamento', v: AYUDA_REGLAMENTO }] : []), ...(priv.finanzas || [])].slice(0, 60);
        ctx.sucios.privs.add(id);
        if (cambio) notificar(ctx, id, {
            remitente: 'Dirección de la liga', tipo: 'reglamento', titulo: `Cambio de reglamento para la temporada ${temporada + 1}`,
            texto: `Las normas técnicas cambian: tu coche conserva solo una cuarta parte de su desarrollo.${perdidas.length ? ` Instalaciones afectadas: ${perdidas.join(', ')}.` : ''} La liga te ingresa ${(AYUDA_REGLAMENTO / 1e6).toFixed(0)} M€ de ayuda. Todos empiezan casi de cero: es el momento de dar el golpe.`,
        });
    }
    if (cambio) noticia(ctx, {
        titulo: `Revolución técnica: nuevo reglamento para la temporada ${temporada + 1}`,
        texto: `La liga cambia las normas técnicas. Los coches pierden casi todo su desarrollo, el túnel de viento pierde dos niveles y ${afectadas.slice(1).map(([i]) => INSTALACIONES[i].nombre.toLowerCase()).join(' y ')} uno. Cada escudería recibe ${(AYUDA_REGLAMENTO / 1e6).toFixed(0)} M€ de ayuda. La parrilla se aprieta: cualquiera puede ganar.`,
        tipo: 'fase',
    });
    await volcar(ctx);
    await store.merge('config/juego', { temporada: temporada + 1, fase: 'pretemporada', mundial: { pais: cfg.mundial?.pais || null, nombre: cfg.mundial?.nombre || null, participantes: [] }, palmares: [...(cfg.palmares || []), palmares], ultimoDiario: null, reglamento: { temporada: temporada + 1, cambio, afectadas: afectadas.map(([i, n]) => ({ inst: i, niveles: n })) } });
    await reconstruirCatalogo(store, await store.get('config/juego'));
    palmares.cambioReglamento = cambio;
    return palmares;
}
export const AYUDA_REGLAMENTO = 2_000_000;

void esCarrera; void sinId;

// ---------- Ofertas para dirigir otra escudería ----------
// Temporada excepcional: top 3 de escuderías de su liga, o top 3 del Mundial (pilotos o escuderías).
// Tirada independiente: 5% de que llame una escudería con hermanas y 9% de que llame una normal.
export function esTemporadaExcepcional(eqId, tablas) {
    if (LIGAS_NACIONALES.some(l => tablas[l]?.clasEquipos?.slice(0, 3).some(e => e.eq === eqId))) return true;
    const int = tablas.INT;
    if (int?.clasEquipos?.slice(0, 3).some(e => e.eq === eqId)) return true;
    if (int?.clasPilotos?.slice(0, 3).some(p => p.eq === eqId)) return true;
    return false;
}

export function ofertasDePlaza(ctx, { tablas, equipos, privs, rng }) {
    const libres = Object.entries(equipos).filter(([, e]) => !e.ownerId && !e.filialDe);
    const conHermanas = libres.filter(([, e]) => e.grupo);
    const normales = libres.filter(([, e]) => !e.grupo);
    const cogidas = new Set();
    const expira = ctx.ahora + ECO.diasOfertaPlaza * 864e5;
    for (const [eqId, eq] of Object.entries(equipos)) {
        if (!eq.ownerId || !privs[eqId] || !esTemporadaExcepcional(eqId, tablas)) continue;
        const nuevas = [];
        for (const [tipo, prob, lista] of [['hermanas', ECO.probOfertaHermanas, conHermanas], ['normal', ECO.probOfertaNormal, normales]]) {
            if (!rng.chance(prob)) continue;
            const cands = lista.filter(([id]) => id !== eqId && !cogidas.has(id));
            if (!cands.length) continue;
            const [id, e] = rng.pick(cands);
            cogidas.add(id);
            nuevas.push({ id: `${ctx.cfg.temporada}_${tipo}_${id}`, equipoId: id, nombre: e.nombre, liga: e.liga, grupo: e.grupo || null, tipo, expira });
            notificar(ctx, eqId, {
                remitente: e.nombre, tipo: 'plaza', titulo: `${e.nombre} te quiere como mánager`,
                texto: `Tu temporada no ha pasado desapercibida. ${e.nombre}${e.grupo ? ` (grupo ${e.grupo})` : ''} te ofrece dirigir su escudería. Tienes ${ECO.diasOfertaPlaza} días para decidir en Mi escudería.`,
            });
        }
        if (!nuevas.length) continue;
        privs[eqId].ofertasPlaza = nuevas;
        ctx.sucios.privs.add(eqId);
        for (const o of nuevas) noticia(ctx, { titulo: `${o.nombre} tienta al mánager de ${eq.nombre}`, texto: `Tras su gran temporada, ${eq.ownerNombre || 'el mánager'} de ${eq.nombre} tiene sobre la mesa una oferta para dirigir ${o.nombre}. Tiene ${ECO.diasOfertaPlaza} días para responder.`, liga: o.liga, tipo: 'rumor' });
        ctx.nota(`Oferta de plaza para ${eq.nombre}: ${nuevas.map(o => o.nombre).join(', ')}`);
    }
}

// ---------- Resumen de la temporada de cada mánager ----------
export function resumenesTemporada(ctx, { tablas, equipos, privs, pilotos }) {
    const temporada = ctx.cfg.temporada;
    const nombre = (pid) => nombrePiloto(pilotos[pid]);
    const int = tablas.INT;
    for (const [eqId, eq] of Object.entries(equipos)) {
        const priv = privs[eqId];
        if (!priv || !duenoReal(ctx, eqId)) continue;
        const t = tablas[eq.liga];
        if (!t) continue;
        const fila = t.clasEquipos.find(e => e.eq === eqId);
        const pos = fila?.posicion ?? null;
        const suyos = t.clasPilotos.filter(p => p.eq === eqId);
        const mundial = int?.clasPilotos?.filter(p => p.eq === eqId) || [];
        const mundialEq = int?.clasEquipos?.find(e => e.eq === eqId);
        const premioLiga = pos ? ECO.premiosLiga[pos - 1] || 0 : 0;
        const r = {
            temporada, liga: eq.liga, equipo: eq.nombre, pos, n: t.clasEquipos.length, pts: fila?.pts || 0,
            victorias: fila?.victorias || 0, podios: fila?.podios || 0, dobletes: fila?.dobletes || 0,
            pilotos: suyos.map(p => ({ pid: p.pid, nombre: nombre(p.pid), pos: p.posicion, pts: p.pts, victorias: p.victorias, podios: p.podios, dnf: p.dnf })),
            mundial: mundial.map(p => ({ pid: p.pid, nombre: nombre(p.pid), pos: p.posicion, pts: p.pts })),
            posMundial: mundialEq?.posicion ?? null, premioLiga, fans: eq.fans || 0, presupuesto: priv.presupuesto || 0,
            coche: { ...(priv.coche || {}) }, inst: { ...(priv.inst || {}) },
        };
        const mejor = suyos.slice().sort((a, b) => a.posicion - b.posicion)[0];
        r.titular = pos === 1 ? `¡Campeones de ${LIGAS[eq.liga].nombre}!` : pos <= 3 ? `Podio en ${LIGAS[eq.liga].nombre}: ${pos}º` : pos <= 5 ? `Temporada sólida: ${pos}º` : pos >= r.n - 1 ? `Temporada para olvidar: ${pos}º` : `Temporada de transición: ${pos}º`;
        priv.resumenes = [...(priv.resumenes || []).filter(x => x.temporada !== temporada), r].slice(-10);
        ctx.sucios.privs.add(eqId);
        notificar(ctx, eqId, {
            remitente: 'Dirección de la liga', tipo: 'resumen', titulo: `Tu temporada ${temporada}: ${r.titular}`,
            texto: `${eq.nombre} termina ${pos}º de ${r.n} con ${r.pts} puntos, ${r.victorias} victorias y ${r.podios} podios.${mejor ? ` Tu mejor piloto: ${nombre(mejor.pid)} (${mejor.posicion}º).` : ''}${mundial.length ? ` En el Mundial: ${mundial.map(p => `${nombre(p.pid)} ${p.posicion}º`).join(', ')}.` : ''} Premio de liga: ${(premioLiga / 1e6).toFixed(1).replace('.', ',')} M€. Tienes el resumen completo en Mi escudería.`,
        });
        // Balance público (solo mánagers visibles; la sombra no sale como tal)
        if (eq.ownerId) noticia(ctx, {
            titulo: `Balance de ${eq.ownerNombre}: ${eq.nombre} acaba ${pos}º en ${LIGAS[eq.liga].nombre}`,
            texto: `${r.pts} puntos, ${r.victorias} victorias y ${r.podios} podios.${mejor ? ` ${nombre(mejor.pid)} fue su mejor piloto (${mejor.posicion}º).` : ''}`,
            liga: eq.liga, tipo: 'cronica',
        });
    }
}

// ---------- Historial público de mánagers (rating por temporada) ----------
// Se guarda al acabar el Mundial, antes de que nadie cambie de escudería en el mercado.
export async function historialManagers(ctx, { tablas, equipos }) {
    const temporada = ctx.cfg.temporada;
    const mundial = {};
    for (const s of tablas.INT?.clasPilotos || []) if (s.eq) mundial[s.eq] = (mundial[s.eq] || 0) + 1;
    const titulos = {};
    for (const liga of LIGAS_NACIONALES) {
        const t = tablas[liga];
        if (!t) continue;
        const ids = Object.entries(equipos).filter(([, e]) => e.liga === liga).map(([id]) => id);
        const clas = t.clasEquipos.slice();
        for (const id of ids) if (!clas.some(e => e.eq === id)) clas.push({ eq: id, pts: 0, victorias: 0, podios: 0 });
        clas.forEach((e, i) => { e.posicion = i + 1; });
        const fans = Object.fromEntries(clas.map(e => [e.eq, equipos[e.eq]?.fans || 0]));
        const r = ratingsLiga(clas, { fans, mundial });
        for (const e of clas) {
            const eq = equipos[e.eq];
            if (!eq?.ownerId) continue;
            const posMundial = tablas.INT?.clasEquipos?.find(x => x.eq === e.eq)?.posicion ?? null;
            const entrada = {
                temporada, equipoId: e.eq, equipo: eq.nombre, color: eq.color || null, liga, pos: e.posicion, n: clas.length,
                pts: e.pts || 0, victorias: e.victorias || 0, podios: e.podios || 0, mundial: mundial[e.eq] || 0, posMundial,
                campeonMundial: tablas.INT?.clasPilotos?.[0]?.eq === e.eq, fans: fans[e.eq], rating: r[e.eq]?.rating ?? null,
            };
            const prev = titulos[eq.ownerId] || (titulos[eq.ownerId] = { nombre: eq.ownerNombre || 'Mánager', entradas: [] });
            prev.entradas.push(entrada);
        }
    }
    for (const [uid, { nombre, entradas }] of Object.entries(titulos)) {
        const doc = await ctx.store.get(`managers/${uid}`).catch(() => null);
        const historial = [...(doc?.historial || []).filter(x => x.temporada !== temporada), ...entradas].sort((a, b) => a.temporada - b.temporada);
        ctx.ops.push({ op: 'set', path: `managers/${uid}`, data: { nombre, historial, actualizado: ctx.ahora } });
    }
}
