// Ciclo automático: se ejecuta desde GitHub Actions (y desde el panel admin con "Ejecutar ahora")
import {
    SESION_INFO, esCarrera, esQualy, ECO, AREAS, INSTALACIONES, NIVEL_MAX_AREA, NIVEL_MAX_INST, SLOTS_ID,
    costeMejora, horasMejora, probExitoMejora, RECARGO_URGENTE, costeInstalacion, horasInstalacion,
    ESTRATEGIA_DEF, diaMadrid, finDiaMadrid, LIGAS, LIGAS_NACIONALES, SETUP_PARAMS,
} from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { simularSesion } from '../engine/sim.js';
import { compactar, descompactar, construirTemporada, proyeccionMundial } from '../engine/stats.js';
import {
    setupIdeal, calidadSetup, informeSetup, tandasDisponibles, cartaDelDia, rellenarTexto, efectosOpcion,
    ofertasSponsor, pagoSponsor, deltaMoral, decisionIA, setupIA, rangoAprox, CARTAS,
} from '../engine/juego.js';
import {
    crearContexto, cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, cargarEventos, sesionesOrdenadas,
    notificar, noticia, movimiento, nombrePiloto, volcar, idResultado, idEstrategia, idResumen,
} from './comun.js';
import { reconstruirCatalogo } from './catalogo.js';
import { prepararMercado, cerrarMercado } from './temporada.js';
import { MERCADO } from '../engine/mercado.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const M = (v) => `${(v / 1e6).toFixed(2).replace('.', ',')} M€`;

export async function ejecutarTick(store, { ahora = Date.now(), origen = 'worker', log = console.log, forzar = false } = {}) {
    const inicio = Date.now();
    const cfg = await store.get('config/juego');
    if (!cfg) { log('No existe config/juego: inicializa la temporada desde el panel admin.'); return { ok: false }; }
    if (!forzar && cfg.tick?.enCurso && ahora - cfg.tick.enCurso < 8 * 60_000) {
        log('Otro ciclo está en marcha, se omite.'); return { ok: false, omitido: true };
    }
    await store.merge('config/juego', { tick: { ...(cfg.tick || {}), enCurso: ahora } });

    let secreto = (await store.get('secreto/juego'))?.clave;
    if (!secreto) {
        secreto = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
        await store.set('secreto/juego', { clave: secreto });
    }
    const ctx = crearContexto(store, { ahora, log });
    ctx.cfg = cfg; ctx.secreto = secreto; ctx.temporada = cfg.temporada || 1;

    const pasos = [simularPendientes, publicarPendientes, procesarAcciones, completarProyectos, procesarDecisiones, diario, transicionesFase];
    const errores = [];
    for (const paso of pasos) {
        try { await paso(ctx); await volcar(ctx); }
        catch (e) { errores.push(`${paso.name}: ${e.message}`); log(`ERROR en ${paso.name}: ${e.stack || e}`); }
    }
    if (ctx.catalogoSucio) await reconstruirCatalogo(store, ctx.cfg);

    const resumenTick = {
        ultimo: ahora, origen, duracionMs: Date.now() - inicio, enCurso: null,
        notas: ctx.informe.slice(-15), errores, lecturas: store.lecturas, escrituras: store.escrituras,
    };
    await store.merge('config/juego', { tick: resumenTick });
    // solo se guarda registro si el ciclo hizo algo (o falló)
    if (ctx.informe.length || errores.length) await store.set(`logs/${ahora}`, { ...resumenTick, notas: ctx.informe.slice(-80) });
    return { ok: errores.length === 0, ...resumenTick };
}

// ======================================================================
// 1. Simular sesiones cuyo plazo de estrategia ya ha cerrado
// ======================================================================
async function simularPendientes(ctx) {
    const eventos = await cargarEventos(ctx, ctx.temporada);
    const cola = [];
    for (const ev of eventos) for (const s of sesionesOrdenadas(ev)) {
        if (s.estado === 'programada' && s.lockAt <= ctx.ahora) cola.push({ ev, s });
    }
    cola.sort((a, b) => a.s.lockAt - b.s.lockAt || SESION_INFO_ORD(a.s.tipo) - SESION_INFO_ORD(b.s.tipo));
    for (const { ev, s } of cola) {
        await simularUna(ctx, ev, s.tipo);
        ev.sesiones[s.tipo].estado = 'simulada';
        await ctx.store.update(`eventos/${ev.id}`, { [`sesiones.${s.tipo}.estado`]: 'simulada' });
        ctx.nota(`Simulada ${ev.id} ${s.tipo}`);
    }
}
const SESION_INFO_ORD = (t) => Object.keys(SESION_INFO).indexOf(t);

export async function simularUna(ctx, ev, tipo) {
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pilotos = await cargarPilotos(ctx);
    let lista;
    if (ev.liga === 'INT') lista = (ctx.cfg.mundial?.participantes || []).map(id => pilotos[id]).filter(p => p?.equipoId);
    else lista = Object.values(pilotos).filter(p => p.liga === ev.liga && p.equipoId && p.estado !== 'libre');
    if (!lista.length) { ctx.nota(`Sin pilotos para ${ev.id}`); return; }
    const privP = await cargarPilotosPriv(ctx, lista.map(p => p.id));
    const estrategias = await ctx.store.list('estrategias', [['eventoId', '==', ev.id]]);
    const circuito = ev.circuito;
    const rngAI = crearRng(`${ctx.secreto}|ia|${ev.id}`);
    const ordenTipos = Object.keys(SESION_INFO);

    // estrategia efectiva de un equipo para esta sesión (con herencia de sesiones anteriores)
    const estrategiaDe = (eqId) => {
        const propias = estrategias.filter(e => e.equipoId === eqId && ordenTipos.indexOf(e.tipo) <= ordenTipos.indexOf(tipo))
            .sort((a, b) => ordenTipos.indexOf(b.tipo) - ordenTipos.indexOf(a.tipo));
        return propias[0] || null;
    };
    const datos = lista.map(p => {
        const pp = privP[p.id] || {};
        const eq = equipos[p.equipoId] || {};
        const priv = privs[p.equipoId] || {};
        const ideal = setupIdeal(ctx.secreto, ev.id, p.equipoId, circuito);
        let setup, estr;
        const e = estrategiaDe(p.equipoId);
        if (!eq.ownerId) {
            setup = setupIA(ideal, crearRng(`${ctx.secreto}|iasetup|${ev.id}|${p.equipoId}`), 1);
            estr = { riesgo: rngAI.pick([1, 2, 2, 3]), ritmo: rngAI.pick(['conservador', 'equilibrado', 'equilibrado', 'ataque']), actitud: rngAI.pick(['defensiva', 'normal', 'normal', 'agresiva']) };
        } else {
            setup = e?.setup || priv.ultimoSetup || { ala: 5, susp: 5, marchas: 5 };
            const mismaCategoria = estrategias.filter(x => x.equipoId === p.equipoId && x.pilotos?.[p.id])
                .filter(x => esQualy(x.tipo) === esQualy(tipo) && ordenTipos.indexOf(x.tipo) <= ordenTipos.indexOf(tipo))
                .sort((a, b) => ordenTipos.indexOf(b.tipo) - ordenTipos.indexOf(a.tipo))[0];
            estr = { ...ESTRATEGIA_DEF, ...(mismaCategoria?.pilotos?.[p.id] || {}) };
        }
        return {
            id: p.id, equipoId: p.equipoId, attrs: pp.attrs || { ritmo: 70, consistencia: 70, agresividad: 65, defensa: 70 },
            moral: pp.moral ?? 60, forma: pp.forma ?? 0, coche: priv.coche || {}, setupQ: calidadSetup(setup, ideal),
            estr, riesgoFiab: priv.riesgoFiab || 1, _setup: setup,
        };
    });

    // Parrilla
    let parrilla = null;
    const fuente = SESION_INFO[tipo].parrilla;
    if (fuente) {
        const prev = await ctx.store.get(`resultados/${idResultado(ev.id, fuente)}`);
        parrilla = prev ? prev.filas.map(f => f.pid) : null;
        if (!parrilla) {
            const r = crearRng(`${ctx.secreto}|parrilla|${ev.id}|${tipo}`);
            parrilla = r.shuffle(lista.map(p => p.id));
        }
    }
    const rng = crearRng(`${ctx.secreto}|sim|${ev.id}|${tipo}`);
    const lluvia = crearRng(`${ctx.secreto}|meteo|${ev.id}|${tipo}`).next() < (ev.meteo?.[tipo] ?? 0);
    const res = simularSesion({ tipo, circuito, pilotos: datos, parrilla, lluvia, rng });
    const ses = ev.sesiones[tipo];
    const doc = {
        eventoId: ev.id, liga: ev.liga, temporada: ev.temporada, ronda: ev.ronda, tipo,
        publishAt: ses.publishAt, revealAt: ses.revealAt, lluvia: res.lluvia, filas: res.filas, eventos: res.eventos, vr: res.vr,
        circuito: { id: circuito.id, nombre: circuito.nombre, pais: circuito.pais, tiempoBase: circuito.tiempoBase },
        // datos internos (solo admin/worker) para informes de FP
        setups: Object.fromEntries(datos.map(d => [d.equipoId, d._setup])),
        simuladoEn: ctx.ahora,
    };
    await ctx.store.set(`resultados/${idResultado(ev.id, tipo)}`, doc);
}

// ======================================================================
// 2. Publicar (tras el directo): clasificaciones, economía, moral, pronósticos
// ======================================================================
async function publicarPendientes(ctx) {
    const eventos = await cargarEventos(ctx, ctx.temporada);
    const cola = [];
    for (const ev of eventos) for (const s of sesionesOrdenadas(ev)) {
        if (s.estado === 'simulada' && s.revealAt <= ctx.ahora) cola.push({ ev, s });
    }
    if (!cola.length) return;
    cola.sort((a, b) => a.s.revealAt - b.s.revealAt);
    const resumenRef = `resumen/${idResumen(ctx.temporada)}`;
    const resumenDoc = await ctx.store.get(resumenRef);
    const resumen = resumenDoc?.json ? JSON.parse(resumenDoc.json) : { sesiones: [] };

    for (const { ev, s } of cola) {
        const res = await ctx.store.get(`resultados/${idResultado(ev.id, s.tipo)}`);
        if (!res) { ctx.nota(`Falta resultado ${ev.id} ${s.tipo}`); continue; }
        res.id = idResultado(ev.id, s.tipo);
        resumen.sesiones = resumen.sesiones.filter(x => x.sid !== res.id);
        resumen.sesiones.push(compactar(res));
        await efectosPublicacion(ctx, ev, res);
        ev.sesiones[s.tipo].estado = 'publicada';
        await ctx.store.update(`eventos/${ev.id}`, { [`sesiones.${s.tipo}.estado`]: 'publicada' });
        const ultima = sesionesOrdenadas(ev).slice(-1)[0]?.tipo;
        if (s.tipo === ultima) await cerrarEvento(ctx, ev);
        ctx.nota(`Publicada ${ev.id} ${s.tipo}`);
    }
    resumen.sesiones.sort((a, b) => a.t - b.t);
    await ctx.store.set(resumenRef, { json: JSON.stringify(resumen), actualizado: ctx.ahora, temporada: ctx.temporada, n: resumen.sesiones.length });
}

async function efectosPublicacion(ctx, ev, res) {
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pilotos = await cargarPilotos(ctx);
    const pp = await cargarPilotosPriv(ctx, res.filas.map(f => f.pid));
    const nombre = (pid) => nombrePiloto(pilotos[pid]);
    const tipoNombre = SESION_INFO[res.tipo].nombre;

    // Informe de reglaje de libres
    if (res.tipo === 'FP') {
        const porEq = {};
        res.filas.forEach(f => { (porEq[f.eq] ||= []).push(f); });
        for (const [eq, fs] of Object.entries(porEq)) {
            if (!equipos[eq]?.ownerId) continue;
            const setup = res.setups?.[eq] || { ala: 5, susp: 5, marchas: 5 };
            const ideal = setupIdeal(ctx.secreto, ev.id, eq, ev.circuito);
            const inf = informeSetup(setup, ideal, privs[eq]?.inst?.simulador || 0, crearRng(`${ctx.secreto}|fpinf|${ev.id}|${eq}`));
            notificar(ctx, eq, {
                remitente: 'Ingeniero de pista', tipo: 'setup', titulo: `Informe de libres · ${ev.circuito.nombre}`,
                texto: `Reglaje usado: ala ${setup.ala}, suspensión ${setup.susp}, marchas ${setup.marchas}.\n` +
                    Object.keys(SETUP_PARAMS).map(k => `${SETUP_PARAMS[k].nombre}: ${inf[k]}`).join(' · ') + `\n${inf.sensacion}\n` +
                    fs.map(f => `${nombre(f.pid)}: P${f.pos}`).join(' · '),
            });
        }
        return;
    }

    // Premios por puntos
    const ptsEq = {};
    res.filas.forEach(f => { ptsEq[f.eq] = (ptsEq[f.eq] || 0) + f.pts; });
    for (const [eq, pts] of Object.entries(ptsEq)) {
        const priv = privs[eq];
        if (!priv) continue;
        const premio = pts * ECO.premioPorPunto * (ev.liga === 'INT' ? ECO.multPremioMundial : 1);
        if (premio > 0) { movimiento(priv, `Premio ${tipoNombre} (${ev.circuito.nombre})`, premio, ctx.ahora); ctx.sucios.privs.add(eq); }
        const fs = res.filas.filter(f => f.eq === eq);
        notificar(ctx, eq, {
            remitente: 'FIA', tipo: 'resultado', titulo: `${tipoNombre} · ${ev.circuito.nombre}`,
            texto: fs.map(f => `${nombre(f.pid)}: ${f.estado === 'FIN' ? 'P' + f.pos : f.estado}${f.pts ? ` (+${f.pts} pts)` : ''}`).join(' · ') + (premio ? ` · Premio: ${M(premio)}` : ''),
        });
    }

    // Moral, forma y evolución de pilotos tras carreras
    if (esCarrera(res.tipo)) {
        const esperado = {};
        const porRitmo = res.filas.slice().sort((a, b) => (pp[b.pid]?.attrs?.ritmo || 0) - (pp[a.pid]?.attrs?.ritmo || 0));
        porRitmo.forEach((f, i) => { esperado[f.pid] = i + 1; });
        for (const f of res.filas) {
            const p = pp[f.pid];
            if (!p) continue;
            const comp = res.filas.find(x => x.eq === f.eq && x.pid !== f.pid);
            p.moral = clamp((p.moral ?? 60) + deltaMoral(f, comp, esperado[f.pid]), 5, 100);
            p.forma = clamp((p.forma ?? 0) * 0.6 + (f.pos <= 5 && f.estado === 'FIN' ? 0.15 : 0), -1, 1);
            if (p.attrs) {
                p.attrs.experiencia = Math.min(99, (p.attrs.experiencia || 30) + 1);
                const rng = crearRng(`${ctx.secreto}|evo|${res.eventoId}|${res.tipo}|${f.pid}`);
                if ((p.attrs.potencial || 0) > p.attrs.ritmo && rng.chance(0.3)) p.attrs.ritmo++;
                if (rng.chance(0.15)) p.attrs.consistencia = Math.min(97, p.attrs.consistencia + 1);
            }
            ctx.sucios.pilotosPriv.add(f.pid);
        }
    }
}

async function cerrarEvento(ctx, ev) {
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pilotos = await cargarPilotos(ctx);
    const tipos = sesionesOrdenadas(ev).map(s => s.tipo).filter(t => t !== 'FP');
    const resultados = [];
    for (const t of tipos) {
        const r = await ctx.store.get(`resultados/${idResultado(ev.id, t)}`);
        if (r) resultados.push(r);
    }
    const eqs = new Set(resultados.flatMap(r => r.filas.map(f => f.eq)));
    for (const eq of eqs) {
        const priv = privs[eq];
        if (!priv) continue;
        const filas = resultados.flatMap(r => r.filas.filter(f => f.eq === eq).map(f => ({ ...f, tipo: r.tipo })));
        const puntos = filas.reduce((s, f) => s + f.pts, 0);
        const carreras = filas.filter(f => esCarrera(f.tipo) && f.estado === 'FIN');
        const mejorPos = carreras.length ? Math.min(...carreras.map(f => f.pos)) : null;
        const pago = pagoSponsor(priv.sponsor, { puntos, mejorPos });
        if (pago.total) movimiento(priv, `Patrocinio ${priv.sponsor.marca}${pago.cumplido ? ' (objetivo cumplido)' : ''}`, pago.total, ctx.ahora);
        const misPilotos = Object.values(pilotos).filter(p => p.equipoId === eq);
        const pp = await cargarPilotosPriv(ctx, misPilotos.map(p => p.id));
        const sueldos = misPilotos.reduce((s, p) => s + (pp[p.id]?.salario || 300_000), 0);
        if (ev.liga !== 'INT') movimiento(priv, 'Salarios de pilotos', -sueldos, ctx.ahora);
        priv.riesgoFiab = 1;
        ctx.sucios.privs.add(eq);
        notificar(ctx, eq, {
            remitente: 'Dirección financiera', tipo: 'finanzas', titulo: `Balance de la jornada · ${ev.circuito.nombre}`,
            texto: `Puntos: ${puntos}. Patrocinio: ${M(pago.total)}${priv.sponsor?.objetivo ? (pago.cumplido ? ' (objetivo cumplido )' : ' (objetivo no cumplido)') : ''}. ` +
                (ev.liga !== 'INT' ? `Salarios: −${M(sueldos)}. ` : '') + `Presupuesto actual: ${M(priv.presupuesto)}.`,
        });
    }
    await ctx.store.update(`eventos/${ev.id}`, { estado: 'completado' });
    const r3 = resultados.find(r => r.tipo === 'R3') || resultados[resultados.length - 1];
    const ganador = r3?.filas?.[0];
    noticia(ctx, {
        titulo: `Crónica: ${LIGAS[ev.liga]?.nombre} · Ronda ${ev.ronda} (${ev.circuito.nombre})`,
        texto: ganador ? `${nombrePiloto(pilotos[ganador.pid])} gana la última carrera de la jornada. Ya está disponible la crónica completa.` : '',
        liga: ev.liga, tipo: 'cronica',
    });
    void equipos;
}

// ======================================================================
// 3. Acciones de los mánagers
// ======================================================================
async function procesarAcciones(ctx) {
    const acciones = await ctx.store.list('acciones', [['estado', '==', 'pendiente']]);
    if (!acciones.length) return;
    const equipos = await cargarEquipos(ctx);
    await cargarPrivs(ctx);
    acciones.sort((a, b) => a.creado - b.creado);
    const porEquipo = {};
    for (const a of acciones) {
        porEquipo[a.equipoId] = (porEquipo[a.equipoId] || 0) + 1;
        let resultado;
        try {
            if (porEquipo[a.equipoId] > 25) throw new Error('Demasiadas acciones seguidas. Inténtalo en el próximo ciclo.');
            if (!equipos[a.equipoId] || equipos[a.equipoId].ownerId !== a.uid) throw new Error('No diriges este equipo.');
            const fn = ACCIONES[a.tipo];
            if (!fn) throw new Error(`Acción desconocida: ${a.tipo}`);
            resultado = await fn(ctx, a);
            ctx.ops.push({ op: 'update', path: `acciones/${a.id}`, data: { estado: 'hecha', resultado: resultado || { ok: true }, procesado: ctx.ahora } });
        } catch (e) {
            ctx.ops.push({ op: 'update', path: `acciones/${a.id}`, data: { estado: 'error', resultado: { error: e.message }, procesado: ctx.ahora } });
        }
    }
    ctx.nota(`Procesadas ${acciones.length} acciones`);
}

function privDe(ctx, eq) {
    const p = ctx.privs[eq];
    if (!p) throw new Error('Equipo sin datos privados');
    ctx.sucios.privs.add(eq);
    return p;
}

function proximoEvento(ctx, liga) {
    return (ctx.eventos || []).filter(ev => ev.liga === liga || (liga === '*' && true))
        .map(ev => ({ ev, fin: Math.max(...sesionesOrdenadas(ev).map(s => s.lockAt)) }))
        .filter(x => x.fin > ctx.ahora)
        .sort((a, b) => a.fin - b.fin)[0]?.ev || null;
}

const ACCIONES = {
    async checkin(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        const dia = diaMadrid(a.creado || ctx.ahora);
        const racha = priv.racha || { n: 0, ultimoDia: null };
        if (racha.ultimoDia === dia) throw new Error('Ya has recogido la recompensa de hoy.');
        const ayer = diaMadrid((a.creado || ctx.ahora) - 86_400_000);
        const n = racha.ultimoDia === ayer ? racha.n + 1 : 1;
        const importe = ECO.checkinBase + Math.min(n, 7) * ECO.checkinPorRacha + (priv.inst?.marketing || 0) * ECO.checkinPorMarketing;
        priv.racha = { n, ultimoDia: dia, max: Math.max(racha.max || 0, n) };
        movimiento(priv, `Recompensa diaria (racha ${n})`, importe, ctx.ahora);
        const eq = ctx.equipos[a.equipoId];
        eq.fans = (eq.fans || 0) + 20 + (priv.inst?.marketing || 0) * 15;
        ctx.sucios.equipos.add(a.equipoId);
        return { ok: true, importe, racha: n };
    },

    async id_iniciar(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        const area = a.params?.area;
        if (!AREAS[area]) throw new Error('Área no válida');
        const nivel = priv.coche?.[area] || 0;
        if (nivel >= NIVEL_MAX_AREA) throw new Error('Esa área ya está al máximo.');
        const activos = (priv.proyectos || []).filter(p => p.tipo === 'area');
        if (activos.length >= SLOTS_ID) throw new Error(`Solo puedes tener ${SLOTS_ID} proyectos de I+D a la vez.`);
        if (activos.some(p => p.clave === area)) throw new Error('Ya hay un proyecto en marcha en esa área.');
        const urgente = !!a.params?.urgente;
        const descuento = priv.descuentos?.[area] || 0;
        const coste = Math.round(costeMejora(nivel) * (urgente ? RECARGO_URGENTE : 1) * (1 - descuento));
        if ((priv.presupuesto || 0) < coste) throw new Error(`Presupuesto insuficiente (necesitas ${M(coste)}).`);
        const horas = horasMejora(nivel, priv.inst?.fabrica || 0, urgente);
        const inicio = Math.min(a.creado || ctx.ahora, ctx.ahora);
        movimiento(priv, `I+D ${AREAS[area].nombre} → nivel ${nivel + 1}${urgente ? ' (urgente)' : ''}${descuento ? ' (transferencia de grupo)' : ''}`, -coste, ctx.ahora);
        if (descuento) priv.descuentos = { ...priv.descuentos, [area]: 0 };
        priv.proyectos = [...(priv.proyectos || []), { id: a.id, tipo: 'area', clave: area, nivel: nivel + 1, inicio, fin: inicio + horas * 3600_000, coste, urgente }];
        return { ok: true, coste, horas };
    },

    async inst_mejorar(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        const inst = a.params?.inst;
        if (!INSTALACIONES[inst]) throw new Error('Instalación no válida');
        const nivel = priv.inst?.[inst] || 0;
        if (nivel >= NIVEL_MAX_INST) throw new Error('Ya está al máximo.');
        if ((priv.proyectos || []).some(p => p.tipo === 'inst')) throw new Error('Ya hay una obra en marcha en las instalaciones.');
        const coste = costeInstalacion(nivel);
        if ((priv.presupuesto || 0) < coste) throw new Error(`Presupuesto insuficiente (necesitas ${M(coste)}).`);
        const inicio = Math.min(a.creado || ctx.ahora, ctx.ahora);
        movimiento(priv, `Obras: ${INSTALACIONES[inst].nombre} → nivel ${nivel + 1}`, -coste, ctx.ahora);
        priv.proyectos = [...(priv.proyectos || []), { id: a.id, tipo: 'inst', clave: inst, nivel: nivel + 1, inicio, fin: inicio + horasInstalacion(nivel) * 3600_000, coste }];
        return { ok: true, coste };
    },

    async simulador(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        const eventos = await cargarEventos(ctx, ctx.temporada);
        const ev = eventos.find(e => e.id === a.params?.eventoId);
        if (!ev) throw new Error('Evento no encontrado.');
        const participa = ev.liga === ctx.equipos[a.equipoId].liga || (ev.liga === 'INT' && (await participaEnMundial(ctx, a.equipoId)));
        if (!participa) throw new Error('Tu equipo no corre ese evento.');
        const ultimoCierre = Math.max(...sesionesOrdenadas(ev).map(s => s.lockAt));
        if (ultimoCierre <= ctx.ahora) throw new Error('Esa jornada ya ha terminado.');
        const dia = diaMadrid(a.creado || ctx.ahora);
        const t = tandasDisponibles(priv, dia);
        if (t.quedan <= 0) throw new Error('No te quedan tandas de simulador hoy. Vuelve mañana.');
        const setup = {};
        for (const k of Object.keys(SETUP_PARAMS)) setup[k] = clamp(Math.round(+a.params?.setup?.[k] || 5), 1, 10);
        const ideal = setupIdeal(ctx.secreto, ev.id, a.equipoId, ev.circuito);
        const inf = informeSetup(setup, ideal, priv.inst?.simulador || 0, crearRng(`${ctx.secreto}|simu|${a.id}`));
        priv.simuladorUso = { dia, n: t.usadas + 1 };
        return { ok: true, eventoId: ev.id, setup, informe: inf, quedan: t.quedan - 1 };
    },

    async espiar(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        const tipo = a.params?.tipo;
        if (!ECO.costeInvestigacion[tipo]) throw new Error('Tipo de espionaje no válido.');
        const objetivo = a.params?.objetivo;
        if (!objetivo) throw new Error('Elige un objetivo.');
        if (tipo === 'piloto') { const pil = await cargarPilotos(ctx); if (!pil[objetivo]) throw new Error('Piloto no encontrado.'); }
        else if (!ctx.equipos[objetivo] || objetivo === a.equipoId) throw new Error('Equipo no válido.');
        const coste = ECO.costeInvestigacion[tipo];
        if ((priv.presupuesto || 0) < coste) throw new Error(`Presupuesto insuficiente (necesitas ${M(coste)}).`);
        const inicio = Math.min(a.creado || ctx.ahora, ctx.ahora);
        movimiento(priv, `Espionaje (${tipo})`, -coste, ctx.ahora);
        priv.proyectos = [...(priv.proyectos || []), { id: a.id, tipo: 'espia', clave: tipo, objetivo, inicio, fin: inicio + ECO.horasInvestigacion[tipo] * 3600_000, coste }];
        return { ok: true, coste };
    },

    async sponsor_firmar(ctx, a) {
        const priv = privDe(ctx, a.equipoId);
        if (priv.sponsor && priv.sponsor.temporada === ctx.temporada) throw new Error('Ya tienes patrocinador esta temporada.');
        const oferta = (priv.ofertasSponsor || []).find(o => o.id === a.params?.ofertaId);
        if (!oferta) throw new Error('Oferta no encontrada.');
        priv.sponsor = { ...oferta, temporada: ctx.temporada, firmado: ctx.ahora };
        notificar(ctx, a.equipoId, { remitente: oferta.marca, tipo: 'sponsor', titulo: `Contrato firmado con ${oferta.marca}`, texto: oferta.desc });
        return { ok: true };
    },

    async reclamar(ctx, a) {
        // el cliente ya asignó ownerId; aquí damos la bienvenida y regeneramos el catálogo
        const priv = privDe(ctx, a.equipoId);
        if (!priv.ofertasSponsor?.length || priv.sponsor?.temporada !== ctx.temporada) {
            priv.ofertasSponsor = ofertasSponsor(ctx.secreto, ctx.temporada, a.equipoId, 5);
            if (priv.sponsor?.temporada !== ctx.temporada) priv.sponsor = null;
        }
        ctx.catalogoSucio = true;
        notificar(ctx, a.equipoId, {
            remitente: 'Dirección de la liga', tipo: 'bienvenida', titulo: `Bienvenido a ${ctx.equipos[a.equipoId].nombre}`,
            texto: 'Firma un patrocinador, recoge tu recompensa diaria cada día y usa el simulador antes de cada jornada. ¡Suerte!',
        });
        return { ok: true };
    },

    // Oferta por un Galáctico de otra liga: {pid, tactico, importe} o {cancelar: true}
    async galactico_oferta(ctx, a) {
        if (!['pretemporada', 'nacional', 'mundial'].includes(ctx.cfg.fase)) throw new Error('El plazo de ofertas está cerrado.');
        const ref = `mercado_ofertas/T${ctx.temporada}`;
        const doc = (await ctx.store.get(ref)) || { ofertas: {} };
        const ofertas = { ...(doc.ofertas || {}) };
        if (a.params?.cancelar) {
            delete ofertas[a.equipoId];
            await ctx.store.set(ref, { ofertas });
            return { ok: true, cancelada: true };
        }
        const pil = await cargarPilotos(ctx);
        const g = pil[a.params?.pid], t = pil[a.params?.tactico];
        const eq = ctx.equipos[a.equipoId];
        const importe = Math.round(+a.params?.importe || 0);
        if (!g || !g.equipoId) throw new Error('Piloto no encontrado.');
        if (g.liga === eq.liga) throw new Error('El Galáctico tiene que ser de otra liga.');
        if (!t || t.equipoId !== a.equipoId) throw new Error('El Táctico tiene que ser uno de tus pilotos.');
        if (importe < MERCADO.importeMinimo) throw new Error(`La oferta mínima es de ${M(MERCADO.importeMinimo)}.`);
        const priv = privDe(ctx, a.equipoId);
        if ((priv.presupuesto || 0) < importe) throw new Error('No tienes ese dinero.');
        ofertas[a.equipoId] = { pid: g.id, tactico: t.id, importe, fecha: ctx.ahora };
        await ctx.store.set(ref, { ofertas });
        notificar(ctx, g.equipoId, { remitente: 'Mercado', tipo: 'mercado', titulo: `${eq.nombre} pregunta por ${nombrePiloto(g)}`, texto: `Ha ofrecido ${M(importe)} y a ${nombrePiloto(t)}. Si ${g.apellido} acaba en el top 5 y es el Galáctico de tu liga, recibirías eso a cambio.` });
        noticia(ctx, { titulo: `${eq.nombre} quiere a ${nombrePiloto(g)}`, texto: `Oferta de ${M(importe)} más ${nombrePiloto(t)} para el mercado de fin de temporada.`, liga: g.liga, tipo: 'rumor' });
        return { ok: true };
    },

    async draft(ctx, a) {
        if (ctx.cfg.fase !== 'mercado') throw new Error('El draft no está abierto.');
        const lista = (a.params?.lista || []).slice(0, 8).map(String);
        await ctx.store.merge(`mercado/T${ctx.temporada}`, { preferencias: { [a.equipoId]: lista } });
        return { ok: true, lista };
    },
};

async function participaEnMundial(ctx, eq) {
    const pil = await cargarPilotos(ctx);
    return (ctx.cfg.mundial?.participantes || []).some(id => pil[id]?.equipoId === eq);
}

// ======================================================================
// 4. Proyectos que terminan (I+D, obras, espionaje)
// ======================================================================
async function completarProyectos(ctx) {
    const privs = await cargarPrivs(ctx);
    const equipos = await cargarEquipos(ctx);
    for (const [eq, priv] of Object.entries(privs)) {
        const listos = (priv.proyectos || []).filter(p => p.fin <= ctx.ahora);
        if (!listos.length) continue;
        priv.proyectos = priv.proyectos.filter(p => p.fin > ctx.ahora);
        ctx.sucios.privs.add(eq);
        for (const p of listos) {
            const rng = crearRng(`${ctx.secreto}|proy|${p.id}`);
            if (p.tipo === 'area') {
                const exito = rng.chance(probExitoMejora(p.nivel - 1, priv.inst?.fabrica || 0));
                if (exito) {
                    priv.coche = { ...(priv.coche || {}), [p.clave]: Math.max(priv.coche?.[p.clave] || 0, p.nivel) };
                    notificar(ctx, eq, { remitente: 'Departamento técnico', tipo: 'id', titulo: `${AREAS[p.clave].nombre} mejorada a nivel ${p.nivel}`, texto: 'La pieza ha superado las pruebas y ya está montada en los coches.' });
                    // Cooperación de grupo: los equipos hermanos desarrollan esa área un 25% más barata
                    const grupo = equipos[eq]?.grupo;
                    if (grupo) for (const [hid, h] of Object.entries(equipos)) {
                        if (hid === eq || h.grupo !== grupo || !privs[hid]) continue;
                        privs[hid].descuentos = { ...(privs[hid].descuentos || {}), [p.clave]: 0.25 };
                        ctx.sucios.privs.add(hid);
                        notificar(ctx, hid, { remitente: `Grupo ${grupo}`, tipo: 'id', titulo: `Transferencia técnica de ${equipos[eq].nombre}`, texto: `Tu próxima mejora de ${AREAS[p.clave].nombre.toLowerCase()} costará un 25% menos.` });
                    }
                    if (p.nivel >= 4 && rng.chance(0.5)) noticia(ctx, { titulo: `${equipos[eq].nombre} estrena evolución`, texto: `Se rumorea en el paddock que ${equipos[eq].nombre} ha dado un paso adelante en ${AREAS[p.clave].nombre.toLowerCase()}.`, liga: equipos[eq].liga, tipo: 'rumor' });
                } else {
                    const devolucion = Math.round(p.coste * 0.5);
                    movimiento(priv, `Reembolso parcial I+D fallido (${AREAS[p.clave].nombre})`, devolucion, ctx.ahora);
                    notificar(ctx, eq, { remitente: 'Departamento técnico', tipo: 'id', titulo: `Falló la mejora de ${AREAS[p.clave].nombre}`, texto: `La pieza no pasó las pruebas de homologación. Recuperamos ${M(devolucion)}.` });
                }
            } else if (p.tipo === 'inst') {
                priv.inst = { ...(priv.inst || {}), [p.clave]: p.nivel };
                notificar(ctx, eq, { remitente: 'Obras', tipo: 'inst', titulo: `${INSTALACIONES[p.clave].nombre} ampliada a nivel ${p.nivel}`, texto: INSTALACIONES[p.clave].desc });
            } else if (p.tipo === 'espia') {
                await informeEspionaje(ctx, eq, p, rng);
            }
        }
    }
}

async function informeEspionaje(ctx, eq, p, rng) {
    const equipos = ctx.equipos;
    let titulo, texto, objetivoEq;
    if (p.clave === 'coche') {
        objetivoEq = p.objetivo;
        const c = ctx.privs[p.objetivo]?.coche || {};
        titulo = `Informe: coche de ${equipos[p.objetivo]?.nombre}`;
        texto = Object.keys(AREAS).map(k => `${AREAS[k].nombre}: nivel ${c[k] || 0}`).join(' · ');
    } else if (p.clave === 'piloto') {
        const pil = await cargarPilotos(ctx);
        const piloto = pil[p.objetivo];
        objetivoEq = piloto?.equipoId;
        const pp = (await cargarPilotosPriv(ctx, [p.objetivo]))[p.objetivo];
        const at = pp?.attrs || {};
        const r = (v) => { const [a, b] = rangoAprox(v || 0, rng); return `${a}-${b}`; };
        titulo = `Informe: ${nombrePiloto(piloto)}`;
        texto = `Ritmo ${r(at.ritmo)} · Consistencia ${r(at.consistencia)} · Agresividad ${r(at.agresividad)} · Adelantamiento ${r(at.adelantamiento)} · Defensa ${r(at.defensa)} · Lluvia ${r(at.lluvia)} · Moral ${pp?.moral >= 70 ? 'alta' : pp?.moral >= 45 ? 'normal' : 'baja'}`;
    } else {
        objetivoEq = p.objetivo;
        const ev = proximoEvento(ctx, equipos[p.objetivo]?.liga);
        titulo = `Informe: estrategia de ${equipos[p.objetivo]?.nombre}`;
        if (!ev) texto = 'No hay ningún evento próximo.';
        else {
            const est = (await ctx.store.list('estrategias', [['eventoId', '==', ev.id]])).filter(e => e.equipoId === p.objetivo);
            if (!est.length) texto = `Todavía no han enviado su estrategia para ${ev.circuito.nombre}.`;
            else {
                const ult = est.sort((a, b) => (b.actualizado || 0) - (a.actualizado || 0))[0];
                const pil = await cargarPilotos(ctx);
                texto = `Sesión ${ult.tipo}: reglaje ala ${ult.setup?.ala ?? '?'}, suspensión ${ult.setup?.susp ?? '?'}, marchas ${ult.setup?.marchas ?? '?'}. ` +
                    Object.entries(ult.pilotos || {}).map(([pid, e]) => `${pil[pid]?.apellido}: riesgo ${e.riesgo}, ritmo ${e.ritmo}, actitud ${e.actitud}`).join(' · ');
            }
        }
    }
    notificar(ctx, eq, { remitente: 'Espionaje', tipo: 'espia', titulo, texto });
    if (objetivoEq && objetivoEq !== eq && rng.chance(ECO.probDeteccionEspia)) {
        notificar(ctx, objetivoEq, { remitente: 'Seguridad', tipo: 'espia', titulo: 'Hemos detectado espías', texto: `Hemos pillado a gente de ${equipos[eq]?.nombre} husmeando en nuestras instalaciones.` });
        noticia(ctx, { titulo: `Escándalo: ${equipos[eq]?.nombre} pillado espiando`, texto: `Fuentes del paddock aseguran que ${equipos[eq]?.nombre} fue sorprendido espiando a ${equipos[objetivoEq]?.nombre}.`, liga: equipos[eq]?.liga, tipo: 'rumor' });
        const eqPub = equipos[eq];
        eqPub.fans = Math.max(0, (eqPub.fans || 0) - 150);
        ctx.sucios.equipos.add(eq);
    }
}

// ======================================================================
// 5. Decisiones del día
// ======================================================================
async function procesarDecisiones(ctx) {
    const pendientes = await ctx.store.list('decisiones', [['aplicada', '==', false]]);
    const aplicar = pendientes.filter(d => d.eleccion || d.expira <= ctx.ahora);
    if (!aplicar.length) return;
    await cargarEquipos(ctx); await cargarPrivs(ctx);
    const pilotos = await cargarPilotos(ctx);
    for (const d of aplicar) {
        const carta = CARTAS.find(c => c.id === d.cartaId);
        const priv = ctx.privs[d.equipoId];
        if (!carta || !priv) { ctx.ops.push({ op: 'update', path: `decisiones/${d.id}`, data: { aplicada: true } }); continue; }
        const opcion = carta.opciones.find(o => o.id === d.eleccion) || carta.opciones.find(o => o.defecto) || carta.opciones[carta.opciones.length - 1];
        const rng = crearRng(`${ctx.secreto}|dec|${d.id}`);
        const ef = efectosOpcion(opcion, d.ctx || {}, rng);
        const partes = [];
        if (ef.presupuesto) { movimiento(priv, `Decisión: ${opcion.texto.replace(/\{\w+\}/g, '').slice(0, 40)}`, ef.presupuesto, ctx.ahora); partes.push(`${ef.presupuesto > 0 ? '+' : '−'}${M(Math.abs(ef.presupuesto))}`); }
        if (ef.fans) { const eq = ctx.equipos[d.equipoId]; eq.fans = Math.max(0, (eq.fans || 0) + ef.fans); ctx.sucios.equipos.add(d.equipoId); partes.push(`${ef.fans > 0 ? '+' : ''}${ef.fans} fans`); }
        if (ef.horasID) {
            const proy = (priv.proyectos || []).filter(p => p.tipo === 'area').sort((a, b) => a.fin - b.fin)[0];
            if (proy) { proy.fin -= ef.horasID * 3600_000; partes.push(`I+D −${ef.horasID} h`); } else partes.push('(sin I+D activo que acelerar)');
        }
        if (ef.riesgoFiab) { priv.riesgoFiab = (priv.riesgoFiab || 1) * ef.riesgoFiab; partes.push(ef.riesgoFiab > 1 ? 'más riesgo de avería' : 'menos riesgo de avería'); }
        if (ef.tandas) { const dia = diaMadrid(ctx.ahora); priv.tandasExtra = { dia, n: (priv.tandasExtra?.dia === dia ? priv.tandasExtra.n : 0) + ef.tandas }; partes.push(`+${ef.tandas} tanda(s) de simulador hoy`); }
        const ids = [...new Set([...Object.keys(ef.moral), ...Object.keys(ef.forma)])];
        if (ids.length) {
            const pp = await cargarPilotosPriv(ctx, ids);
            for (const id of ids) {
                if (!pp[id]) continue;
                if (ef.moral[id]) { pp[id].moral = clamp((pp[id].moral ?? 60) + ef.moral[id], 5, 100); partes.push(`moral ${pilotos[id]?.apellido} ${ef.moral[id] > 0 ? '+' : ''}${ef.moral[id]}`); }
                if (ef.forma[id]) { pp[id].forma = clamp((pp[id].forma ?? 0) + ef.forma[id], -1, 1); partes.push(`forma ${pilotos[id]?.apellido} ${ef.forma[id] > 0 ? '' : ''}`); }
                ctx.sucios.pilotosPriv.add(id);
            }
        }
        ctx.sucios.privs.add(d.equipoId);
        const texto = `${d.eleccion ? '' : 'No respondiste a tiempo. '}${rellenarTexto(opcion.texto, d.nombres || {})}${!ef.exito ? ' — Salió mal.' : ''} ${partes.length ? '(' + partes.join(', ') + ')' : ''}`;
        ctx.ops.push({ op: 'update', path: `decisiones/${d.id}`, data: { aplicada: true, eleccionFinal: opcion.id, resultado: texto } });
    }
    ctx.nota(`Aplicadas ${aplicar.length} decisiones`);
}

// ======================================================================
// 6. Tareas diarias (una vez por día, hora de Madrid)
// ======================================================================
async function diario(ctx) {
    const dia = diaMadrid(ctx.ahora);
    if (ctx.cfg.ultimoDiario === dia) return;
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pilotos = await cargarPilotos(ctx);
    const eventos = await cargarEventos(ctx, ctx.temporada);
    const expira = finDiaMadrid(ctx.ahora);
    const activos = ['nacional', 'mundial', 'pretemporada'].includes(ctx.cfg.fase);

    for (const [eqId, eq] of Object.entries(equipos)) {
        const priv = privs[eqId];
        if (!priv) continue;
        if (!priv.ofertasSponsor?.length || (priv.sponsor && priv.sponsor.temporada !== ctx.temporada)) {
            priv.ofertasSponsor = ofertasSponsor(ctx.secreto, ctx.temporada, eqId, 5);
            if (priv.sponsor?.temporada !== ctx.temporada) priv.sponsor = null;
            ctx.sucios.privs.add(eqId);
        }
        const misPilotos = Object.values(pilotos).filter(p => p.equipoId === eqId).sort((a, b) => (a.rol === 'P1' ? -1 : 1) - (b.rol === 'P1' ? -1 : 1));
        if (eq.ownerId && activos) {
            const carta = cartaDelDia(ctx.secreto, dia, eqId);
            const rivales = Object.values(equipos).filter(e => e.liga === eq.liga && e.id !== eqId);
            const rival = crearRng(`${ctx.secreto}|rival|${dia}|${eqId}`).pick(rivales)?.nombre || 'un rival';
            const nombres = { p1: nombrePiloto(misPilotos[0]), p2: nombrePiloto(misPilotos[1] || misPilotos[0]), rival, equipo: eq.nombre };
            ctx.ops.push({
                op: 'set', path: `decisiones/${dia}_${eqId}`, data: {
                    uid: eq.ownerId, equipoId: eqId, dia, cartaId: carta.id, texto: rellenarTexto(carta.texto, nombres),
                    opciones: carta.opciones.map(o => ({ id: o.id, texto: rellenarTexto(o.texto, nombres) })),
                    eleccion: null, expira, aplicada: false, nombres, ctx: { p1Id: misPilotos[0]?.id || null, p2Id: misPilotos[1]?.id || misPilotos[0]?.id || null },
                },
            });
        } else if (!eq.ownerId) {
            // IA: ingreso diario equivalente a una racha media y gestión automática
            movimiento(priv, 'Ingresos diarios', ECO.checkinBase + 3 * ECO.checkinPorRacha, ctx.ahora);
            if (!priv.sponsor || priv.sponsor.temporada !== ctx.temporada) priv.sponsor = { ...(priv.ofertasSponsor?.[0] || ofertasSponsor(ctx.secreto, ctx.temporada, eqId)[0]), temporada: ctx.temporada };
            const rng = crearRng(`${ctx.secreto}|iadia|${dia}|${eqId}`);
            const prox = eventos.filter(e => e.liga === eq.liga).map(e => ({ e, t: Math.min(...sesionesOrdenadas(e).map(s => s.lockAt)) })).filter(x => x.t > ctx.ahora).sort((a, b) => a.t - b.t)[0]?.e;
            const activosID = (priv.proyectos || []).filter(p => p.tipo === 'area');
            if (activosID.length < 1) {
                const area = decisionIA(priv, prox?.circuito, rng);
                if (area) {
                    const nivel = priv.coche?.[area] || 0;
                    const coste = costeMejora(nivel);
                    if ((priv.presupuesto || 0) > coste * 1.6) {
                        movimiento(priv, `I+D ${AREAS[area].nombre} → nivel ${nivel + 1}`, -coste, ctx.ahora);
                        const horas = horasMejora(nivel, priv.inst?.fabrica || 0, false);
                        priv.proyectos = [...(priv.proyectos || []), { id: `ia_${dia}_${eqId}`, tipo: 'area', clave: area, nivel: nivel + 1, inicio: ctx.ahora, fin: ctx.ahora + horas * 3600_000, coste }];
                    }
                }
            }
            ctx.sucios.privs.add(eqId);
        }
    }
    // Moral y forma vuelven poco a poco a la normalidad
    const pp = await cargarPilotosPriv(ctx, Object.values(pilotos).filter(p => p.equipoId).map(p => p.id));
    for (const [id, p] of Object.entries(pp)) {
        if (!p) continue;
        const m = p.moral ?? 60;
        p.moral = m > 62 ? m - 1 : m < 58 ? m + 1 : m;
        p.forma = Math.round((p.forma || 0) * 0.8 * 100) / 100;
        ctx.sucios.pilotosPriv.add(id);
    }
    // Limpieza: registros de más de 7 días y acciones ya procesadas de más de 14
    const viejos = await ctx.store.list('logs', [['ultimo', '<', ctx.ahora - 7 * 864e5]], { limit: 300 });
    viejos.forEach(l => ctx.ops.push({ op: 'del', path: `logs/${l.id}` }));
    const accViejas = (await ctx.store.list('acciones', [['creado', '<', ctx.ahora - 14 * 864e5]], { limit: 400 })).filter(a => a.estado !== 'pendiente');
    accViejas.forEach(a => ctx.ops.push({ op: 'del', path: `acciones/${a.id}` }));
    ctx.cfg.ultimoDiario = dia;
    await ctx.store.merge('config/juego', { ultimoDiario: dia });
    ctx.catalogoSucio = true;
    ctx.nota(`Tareas diarias ${dia}`);
}

// ======================================================================
// 7. Cambios de fase automáticos
// ======================================================================
async function transicionesFase(ctx) {
    const eventos = await cargarEventos(ctx, ctx.temporada);
    const nac = eventos.filter(e => e.liga !== 'INT');
    const int = eventos.filter(e => e.liga === 'INT');
    const publicado = (e) => sesionesOrdenadas(e).every(s => s.estado === 'publicada');
    const fase = ctx.cfg.fase;

    if (fase === 'pretemporada' && nac.some(e => sesionesOrdenadas(e).some(s => s.estado !== 'programada'))) {
        await ctx.store.merge('config/juego', { fase: 'nacional' });
        ctx.cfg.fase = 'nacional';
        noticia(ctx, { titulo: '¡Arrancan las ligas nacionales!', texto: 'Cinco ligas, cien pilotos y veinte plazas para el Mundial. Que empiece el espectáculo.', tipo: 'fase' });
        ctx.nota('Fase → nacional');
    }
    if (ctx.cfg.fase === 'nacional' && nac.length && nac.every(publicado)) {
        const resumenDoc = await ctx.store.get(`resumen/${idResumen(ctx.temporada)}`);
        const sesiones = resumenDoc ? JSON.parse(resumenDoc.json).sesiones.map(descompactar) : [];
        const tablas = {};
        for (const liga of LIGAS_NACIONALES) tablas[liga] = construirTemporada(sesiones.filter(s => s.liga === liga));
        const proy = proyeccionMundial(tablas);
        const participantes = proy.clasificados.map(c => c.pid);
        const pilotos = await cargarPilotos(ctx);
        const mundial = { ...(ctx.cfg.mundial || {}), participantes, clasificados: proy.clasificados, fijado: ctx.ahora };
        const privs = await cargarPrivs(ctx);
        await cargarEquipos(ctx);
        for (const pid of participantes) {
            const eq = pilotos[pid]?.equipoId;
            if (!eq || !privs[eq]) continue;
            movimiento(privs[eq], `Bonus Mundial: ${nombrePiloto(pilotos[pid])} clasificado`, ECO.bonusClasificadoMundial, ctx.ahora);
            ctx.sucios.privs.add(eq);
            notificar(ctx, eq, { remitente: 'Dirección de la liga', tipo: 'mundial', titulo: `${nombrePiloto(pilotos[pid])} va al Mundial`, texto: `Cobras ${M(ECO.bonusClasificadoMundial)} y su asiento queda asegurado para la próxima temporada. En el Mundial cada punto vale el triple en premios.` });
        }
        await ctx.store.merge('config/juego', { fase: 'mundial', mundial });
        ctx.cfg.fase = 'mundial';
        ctx.cfg.mundial = mundial;
        const campeones = LIGAS_NACIONALES.map(l => tablas[l].clasPilotos[0]).filter(Boolean);
        noticia(ctx, {
            titulo: 'Terminan las ligas nacionales: estos son los 20 del Mundial',
            texto: `Campeones: ${campeones.map(c => `${nombrePiloto(pilotos[c.pid])}`).join(', ')}. ${participantes.length} pilotos viajan a ${ctx.cfg.mundial?.nombre || 'la sede del Mundial'} y tienen el asiento asegurado para la próxima temporada.`,
            tipo: 'fase',
        });
        ctx.nota('Fase → mundial');
    }
    if (ctx.cfg.fase === 'mundial' && int.length && int.every(publicado)) {
        await prepararMercado(ctx);
        ctx.nota('Fase → mercado');
    }
    if (ctx.cfg.fase === 'mercado') {
        const m = await ctx.store.get(`mercado/T${ctx.temporada}`);
        if (m && m.estado === 'draft' && m.deadline <= ctx.ahora) {
            await cerrarMercado(ctx);
            ctx.nota('Mercado cerrado');
        }
    }
}
