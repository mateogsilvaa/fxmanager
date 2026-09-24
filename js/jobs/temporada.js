// Operaciones de temporada (panel admin y cambios de fase automáticos)
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL, SESIONES, ECO, esCarrera } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { atributosAleatorios, salarioPiloto } from '../engine/juego.js';
import { descompactar, construirTemporada } from '../engine/stats.js';
import { planMercado, generarRookies, estrellasRookie, asignarRoles } from '../engine/mercado.js';
import { normalizarCircuito } from '../engine/circuitos.js';
import {
    crearContexto, cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, horarioSesion, noticia, notificar,
    nombrePiloto, volcar, idResumen, sinId, movimiento,
} from './comun.js';
import { reconstruirCatalogo } from './catalogo.js';

export const COLECCIONES_JUEGO = ['equipos', 'equipos_priv', 'pilotos', 'pilotos_priv', 'eventos', 'resultados', 'resumen', 'estrategias', 'acciones', 'notificaciones', 'decisiones', 'pronosticos', 'ranking', 'noticias', 'mercado', 'mercado_priv', 'mercado_ofertas', 'paddock', 'logs', 'catalogo'];
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
export async function prepararMercado(ctx) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    const tablas = await tablasTemporada(store, temporada);
    const pilotosMap = await cargarPilotos(ctx);
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pilotos = Object.values(pilotosMap).filter(p => p.equipoId);
    const inmunes = new Set(ctx.cfg.mundial?.participantes || []);
    const rng = crearRng(`${ctx.secreto}|mercado|${temporada}`);
    const posEquipo = {};
    for (const liga of LIGAS_NACIONALES) tablas[liga].clasEquipos.forEach(e => { posEquipo[e.eq] = e.posicion; });
    // Escuderías que no han corrido aún (sin puntos) al final
    Object.entries(equipos).forEach(([id]) => { if (!posEquipo[id]) posEquipo[id] = 10; });
    const docOfertas = await store.get(`mercado_ofertas/T${temporada}`);
    const ofertas = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o }))
        .filter(o => o.pid && o.tactico && (privs[o.eq]?.presupuesto || 0) >= o.importe);
    const plan = planMercado({ tablas, pilotos, inmunes, rng, ofertas, posEquipo });
    const usados = new Set(Object.values(pilotosMap).map(p => `${p.nombre} ${p.apellido}`));
    const rookies = generarRookies({ temporada, vacantes: plan.vacantes, rng, usados });
    const draftOrden = plan.vacantes.slice().sort((a, b) => (posEquipo[b.eq] || 99) - (posEquipo[a.eq] || 99));
    const deadline = ctx.ahora + (ctx.cfg.horasDraft || 48) * 3600_000;
    const nombre = (pid) => nombrePiloto(pilotosMap[pid]);
    const M = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M€`;

    // Dinero de los traspasos: la compradora paga a la vendedora
    for (const op of plan.operaciones) {
        if (privs[op.eq]) { movimiento(privs[op.eq], `Traspaso: llega ${nombre(op.pid)} (Galáctico)`, -op.importe, ctx.ahora); ctx.sucios.privs.add(op.eq); }
        if (privs[op.eqVendedor]) { movimiento(privs[op.eqVendedor], `Traspaso: sale ${nombre(op.pid)} (Galáctico)`, op.importe, ctx.ahora); ctx.sucios.privs.add(op.eqVendedor); }
        notificar(ctx, op.eqVendedor, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `${nombre(op.pid)} se va a ${equipos[op.eq]?.nombre}`, texto: `Es el Galáctico de tu liga. A cambio recibes a ${nombre(op.tactico)} y ${M(op.importe)}.` });
        notificar(ctx, op.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `Fichas a ${nombre(op.pid)}`, texto: `Llega como Galáctico desde ${LIGAS[op.de].nombre}. A cambio sale ${nombre(op.tactico)} y pagas ${M(op.importe)}.` });
    }
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

    const conNombre = (x) => ({ ...x, nombre: nombre(x.pid) });
    await store.set(`mercado/T${temporada}`, {
        temporada, estado: 'draft', deadline, creado: ctx.ahora,
        plan: {
            despidos: plan.despidos.map(conNombre), salvados: plan.salvados.map(conNombre), traspasos: plan.traspasos.map(conNombre),
            operaciones: plan.operaciones.map(o => ({ ...o, nombre: nombre(o.pid), nombreTactico: nombre(o.tactico) })),
        },
        vacantes: draftOrden,
        rookies: rookies.map(r => ({ id: r.id, nombre: r.nombre, apellido: r.apellido, nac: r.nac, liga: r.liga, edad: r.edad, estrellas: estrellasRookie(r.attrs, rng) })),
        preferencias: {},
    });
    await store.set(`mercado_priv/T${temporada}`, { rookies: Object.fromEntries(rookies.map(r => [r.id, r.attrs])) });
    await store.merge('config/juego', { fase: 'mercado' });
    ctx.cfg.fase = 'mercado';

    for (const o of plan.operaciones) {
        noticia(ctx, {
            titulo: `${nombre(o.pid)} ficha por ${equipos[o.eq]?.nombre}`,
            texto: `El Galáctico de ${LIGAS[o.de].nombre} (${o.pos || '?'}º) se va a ${LIGAS[o.a].nombre}. ${equipos[o.eqVendedor]?.nombre} recibe a cambio a ${nombre(o.tactico)} y ${M(o.importe)}.${o.humano ? '' : ' Operación decidida por la liga.'}`,
            liga: o.de, tipo: 'mercado',
        });
    }
    for (const d of plan.despidos) {
        noticia(ctx, { titulo: `${nombre(d.pid)} se queda sin asiento`, texto: d.motivo === 'directo' ? `Terminó ${d.pos}º con su compañero ${d.posComp}º: es de los que peor rindieron con el mismo coche.` : `Estaba en la zona de peligro y su compañero acabó ${d.posComp}º.`, liga: d.liga, tipo: 'mercado' });
        notificar(ctx, d.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: 'Vacante en tu equipo', texto: `${nombre(d.pid)} deja el equipo. Elige tus rookies favoritos en el draft antes de que cierre.` });
    }
    for (const s of plan.salvados) noticia(ctx, { titulo: `${nombre(s.pid)} salva su asiento`, texto: `Acabó ${s.pos}º, pero su compañero terminó ${s.posComp}º: se asume que el coche no daba para más.`, liga: s.liga, tipo: 'mercado' });
    noticia(ctx, { titulo: 'Se abre el mercado de fin de temporada', texto: `Traspasos, despidos y draft de rookies. El draft cierra el ${new Date(deadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}.`, tipo: 'fase' });
    await volcar(ctx);
}

export async function cerrarMercado(ctx) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    const m = await store.get(`mercado/T${temporada}`);
    const mp = await store.get(`mercado_priv/T${temporada}`);
    if (!m || m.estado !== 'draft') return;
    const pilotos = await cargarPilotos(ctx);
    const equipos = await cargarEquipos(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pilotos));

    // 1. Traspasos (todos a la vez: son ciclos de asientos)
    for (const t of m.plan.traspasos) {
        const p = pilotos[t.pid];
        p.equipoId = t.eqDestino; p.liga = t.a;
        if (pp[t.pid]) { pp[t.pid].equipoId = t.eqDestino; ctx.sucios.pilotosPriv.add(t.pid); }
        ctx.sucios.pilotos.add(t.pid);
    }
    // 2. Despidos
    for (const d of m.plan.despidos) {
        const p = pilotos[d.pid];
        p.equipoId = null; p.liga = null; p.estado = 'libre'; p.rol = null;
        if (pp[d.pid]) { pp[d.pid].equipoId = null; ctx.sucios.pilotosPriv.add(d.pid); }
        ctx.sucios.pilotos.add(d.pid);
    }
    // 3. Draft
    const disponibles = new Map(m.rookies.map(r => [r.id, r]));
    const rng = crearRng(`${ctx.secreto}|draft|${temporada}`);
    const elegidos = [];
    const locales = (liga) => Object.values(pilotos).filter(p => p.liga === liga && p.equipoId && p.nac === NAC_LOCAL[liga]).length;
    for (const v of m.vacantes) {
        const liga = v.liga;
        const companero = Object.values(pilotos).find(p => p.equipoId === v.eq);
        const debeSerLocal = !companero || companero.nac !== NAC_LOCAL[liga] || locales(liga) < 11;
        const valido = (r) => r && r.liga === liga && (!debeSerLocal || r.nac === NAC_LOCAL[liga]);
        const prefs = (m.preferencias?.[v.eq] || []).map(id => disponibles.get(id)).filter(valido);
        let r = prefs[0];
        if (!r) {
            const cands = [...disponibles.values()].filter(valido);
            r = cands.sort((a, b) => (b.estrellas - a.estrellas) || (rng.next() - 0.5))[0];
        }
        if (!r) { ctx.nota(`Sin rookie válido para ${v.eq}`); continue; }
        disponibles.delete(r.id);
        const attrs = mp?.rookies?.[r.id] || atributosAleatorios(rng, { rookie: true });
        const usados = new Set(Object.values(pilotos).filter(p => p.liga === liga).map(p => p.numero));
        let numero; do numero = rng.int(2, 99); while (usados.has(numero));
        pilotos[r.id] = { id: r.id, nombre: r.nombre, apellido: r.apellido, nac: r.nac, numero, equipoId: v.eq, liga, rol: 'P2', edad: r.edad, rookie: true, estado: 'activo', historia: [], temporadaDebut: temporada + 1 };
        pp[r.id] = ctx.pilotosPriv[r.id] = { id: r.id, pilotoId: r.id, equipoId: v.eq, attrs, moral: 65, forma: 0, salario: salarioPiloto(attrs) };
        ctx.sucios.pilotos.add(r.id); ctx.sucios.pilotosPriv.add(r.id);
        elegidos.push({ eq: v.eq, rookie: r.id, nombre: `${r.nombre} ${r.apellido}` });
        notificar(ctx, v.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `Nuevo piloto: ${r.nombre} ${r.apellido}`, texto: `Rookie de ${r.edad} años. ¡Bienvenido al equipo!` });
    }
    // 4. Roles (Piloto 1 local)
    const porEquipo = {};
    Object.values(pilotos).filter(p => p.equipoId).forEach(p => { (porEquipo[p.equipoId] ||= []).push({ ...p, attrs: pp[p.id]?.attrs }); });
    for (const [eq, lista] of Object.entries(porEquipo)) {
        for (const r of asignarRoles(lista, equipos[eq]?.liga)) {
            if (pilotos[r.id].rol !== r.rol) { pilotos[r.id].rol = r.rol; ctx.sucios.pilotos.add(r.id); }
            if (!r.cumpleCuota) ctx.nota(`${equipos[eq]?.nombre} no tiene piloto local para el asiento de Piloto 1`);
        }
    }
    await store.merge(`mercado/T${temporada}`, { estado: 'cerrado', elegidos, cerrado: ctx.ahora });
    await store.merge('config/juego', { fase: 'cerrada' });
    ctx.cfg.fase = 'cerrada';
    noticia(ctx, { titulo: 'Mercado cerrado: así quedan las parrillas', texto: `${elegidos.length} rookies se estrenan la próxima temporada.`, tipo: 'fase' });
    await volcar(ctx);
    ctx.catalogoSucio = true;
}

// ---------- Nueva temporada ----------
export async function nuevaTemporada(store, { ahora = Date.now() } = {}) {
    const cfg = await store.get('config/juego');
    const temporada = cfg.temporada || 1;
    const tablas = await tablasTemporada(store, temporada);
    const ctx = crearContexto(store, { ahora });
    ctx.cfg = cfg;
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
    for (const [id, priv] of Object.entries(privs)) {
        priv.presupuesto = Math.round((priv.presupuesto || 0) * 0.5 + 8_000_000);
        const coche = priv.coche || {};
        priv.coche = Object.fromEntries(Object.entries(coche).map(([k, v]) => [k, Math.max(0, v - 2)]));
        priv.proyectos = [];
        priv.sponsor = null; priv.ofertasSponsor = [];
        priv.finanzas = [{ t: ahora, c: `Inicio de la temporada ${temporada + 1}`, v: 0 }, ...(priv.finanzas || [])].slice(0, 60);
        ctx.sucios.privs.add(id);
    }
    await volcar(ctx);
    await store.merge('config/juego', { temporada: temporada + 1, fase: 'pretemporada', mundial: { pais: cfg.mundial?.pais || null, nombre: cfg.mundial?.nombre || null, participantes: [] }, palmares: [...(cfg.palmares || []), palmares], ultimoDiario: null });
    await reconstruirCatalogo(store, await store.get('config/juego'));
    return palmares;
}

void esCarrera; void sinId;
