// Simula una temporada completa en memoria (sin tocar Firebase) y comprueba que todo encaja.
// Uso: node worker/prueba-temporada.mjs [--demo]   (--demo guarda data/demo.json a mitad de temporada)
import { readFileSync, writeFileSync } from 'node:fs';
import { MemStore } from '../js/core/memstore.js';
import { importarParrilla, crearEvento, guardarEventos, inicializarJuego, nuevaTemporada, tablasTemporada } from '../js/jobs/temporada.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { CIRCUITOS_POR_ID } from '../js/engine/circuitos.js';
import { LIGAS_NACIONALES, SESIONES, diaMadrid } from '../js/engine/constants.js';
import { proyeccionMundial, calcularRiesgo } from '../js/engine/stats.js';

const DEMO = process.argv.includes('--demo');
// --demo-mercado: guarda la demo con el mercado abierto (para probar la página de Mercado)
const DEMO_MERCADO = process.argv.includes('--demo-mercado');
const RUTA_DEMO = process.argv.find(a => a.startsWith('--salida='))?.slice(9) || '../data/demo.json';
const H = 3600_000, D = 24 * H;
const store = new MemStore();
const fallos = [];
const ok = (cond, msg) => { if (!cond) { fallos.push(msg); console.log('❌', msg); } };

const parrilla = JSON.parse(readFileSync(new URL('../data/parrilla.json', import.meta.url)));
await inicializarJuego(store);
await importarParrilla(store, parrilla);
if (process.argv.includes('--novedades')) await store.merge('config/juego', { novedades: true });

// Viernes 2 oct 2026, 18:00 Madrid = 16:00 UTC
const T0 = Date.UTC(2026, 9, 2, 16, 0);
const CIRC = {
    ESP: ['barcelona-gp', 'jarama', 'valencia', 'jerez', 'aragon'],
    ITA: ['monza', 'imola', 'mugello', 'vallelunga', 'misano'],
    GBR: ['silverstone-gp', 'brands-gp', 'donington', 'snetterton', 'oulton'],
    GER: ['nurburgring-gp', 'hockenheim', 'sachsenring', 'lausitzring', 'oschersleben'],
    AUS: ['bathurst', 'phillip-island', 'sandown', 'the-bend', 'albert-park'],
    INT: ['suzuka', 'fuji', 'suzuka'],
};
// Jornada de 2 días: día 1 libres, Q1 y C1; día 2 Q2, C2 y C3. Una jornada cada 4 días.
const OFF = { FP: 0, Q1: H, R1: 2 * H, Q2: D, R2: D + H, R3: D + 2 * H };
const eventos = [];
LIGAS_NACIONALES.forEach((liga, li) => CIRC[liga].forEach((c, k) => {
    const base = T0 + k * 4 * D + li * 10 * 60_000;
    eventos.push(crearEvento({ temporada: 1, liga, ronda: k + 1, circuito: CIRCUITOS_POR_ID[c], horarios: Object.fromEntries(SESIONES.map(t => [t, base + OFF[t]])) }));
}));
CIRC.INT.forEach((c, k) => {
    const base = T0 + (5 + k) * 4 * D;
    eventos.push(crearEvento({ temporada: 1, liga: 'INT', ronda: k + 1, circuito: CIRCUITOS_POR_ID[c], horarios: Object.fromEntries(SESIONES.map(t => [t, base + OFF[t]])) }));
});
await guardarEventos(store, eventos);

// Dos mánagers humanos
const humanos = [{ uid: 'u_ana', nombre: 'Ana', eq: 'tramontana' }, { uid: 'u_leo', nombre: 'Leo', eq: 'rheinwerk' }];
for (const h of humanos) {
    await store.set(`usuarios/${h.uid}`, { nombre: h.nombre, email: `${h.uid}@x.com`, isAdmin: false, equipoId: h.eq });
    await store.merge(`equipos/${h.eq}`, { ownerId: h.uid, ownerNombre: h.nombre });
    await store.set(`acciones/a_${h.uid}_rec`, { uid: h.uid, equipoId: h.eq, tipo: 'reclamar', params: {}, creado: T0 - 3 * D, estado: 'pendiente' });
}
await store.set('usuarios/u_admin', { nombre: 'Admin', isAdmin: true, equipoId: null });

let n = 0;
const accion = (h, tipo, params, t) => store.set(`acciones/a${n++}`, { uid: h.uid, equipoId: h.eq, tipo, params, creado: t, estado: 'pendiente' });

const FIN = T0 + 8 * 4 * D + 4 * D;
let t = T0 - 3 * D;
let demoGuardado = false;
// Avisos en el móvil simulados: Ana tiene una suscripción
const avisos = [];
const pushFalso = async (sub, msg) => { avisos.push({ t: 0, ...msg }); return 'ok'; };
await store.set('suscripciones/u_ana', { uid: 'u_ana', subs: [{ endpoint: 'https://push.ejemplo/ana', keys: {} }] });
let ofertaValida = null;
let mercadoAna = null;
while (t < FIN) {
    const hora = new Date(t).getUTCHours(), min = new Date(t).getUTCMinutes();
    // Rutina diaria de Ana (muy activa); Leo solo hace check-in
    if (hora === 8 && min === 0) {
        for (const h of humanos) await accion(h, 'checkin', {}, t);
        const priv = await store.get('equipos_priv/tramontana');
        if (!priv.sponsor) await accion(humanos[0], 'sponsor_firmar', { ofertaId: 'rendimiento' }, t);
        await accion(humanos[0], 'id_iniciar', { area: ['aero', 'motor', 'chasis'][n % 3], urgente: false }, t);
        const prox = eventos.filter(e => e.liga === 'ESP' && e.sesiones.FP.lockAt > t)[0];
        if (prox) for (let i = 0; i < 3; i++) await accion(humanos[0], 'simulador', { eventoId: prox.id, setup: { ala: 3 + i * 2, susp: 5, marchas: 6 } }, t);
        await accion(humanos[0], 'espiar', { tipo: 'coche', objetivo: 'stellari-es' }, t);
        const dec = await store.get(`decisiones/${diaMadrid(t)}_tramontana`);
        if (dec && !dec.aplicada) await store.update(`decisiones/${dec.id}`, { eleccion: dec.opciones[0].id });
        // Ana contesta a la prensa (la segunda opción, para variar)
        for (const pr of await store.list('prensa', [['uid', '==', 'u_ana'], ['aplicada', '==', false]])) if (pr.disponible <= t && !pr.eleccion) await store.update(`prensa/${pr.id}`, { eleccion: pr.opciones[1 % pr.opciones.length].id });
        if (n % 4 === 1) await accion(humanos[0], 'entrenar', { pid: (await store.list('pilotos')).find(p => p.equipoId === 'tramontana')?.id, attr: 'ritmo' }, t);
        // estrategia + pronóstico para la próxima carrera
        if (prox) {
            for (const tipo of ['FP', 'Q1', 'R1']) {
                await store.set(`estrategias/${prox.id}_${tipo}_tramontana`, { eventoId: prox.id, tipo, equipoId: 'tramontana', uid: 'u_ana', setup: { ala: 6, susp: 5, marchas: 5 }, pilotos: {}, actualizado: t });
            }
        }
    }
    // A mitad de liga, Leo (Kessler Werks, Alemania) hace una oferta por el líder de España
    if (t === T0 + 10 * D + 6 * H) {
        const tb = await tablasTemporada(store, 1);
        const objetivo = tb.ESP.clasPilotos[0].pid;
        const mios = (await store.list('pilotos')).filter(p => p.equipoId === 'rheinwerk');
        const tactico = mios.find(p => p.rol === 'P2') || mios[1];
        await accion(humanos[1], 'galactico_oferta', { pid: objetivo, tactico: tactico.id, importe: 3_500_000 }, t);
        console.log('Oferta de Leo por', objetivo, 'dando a', tactico.id);
    }
    // El mercado abre con el Mundial: la mejor escudería alemana (gestionada por Leo) puja por el Galáctico de España
    if (!ofertaValida && (await store.get('config/juego')).fase === 'mundial') {
        const mm = await store.get('mercado/T1');
        const tb = await tablasTemporada(store, 1);
        const g = mm?.galacticos?.find(x => x.liga === 'ESP');
        const eqTop = tb.GER.clasEquipos[0].eq;
        await store.merge('equipos/rheinwerk', { ownerId: null, ownerNombre: null });
        await store.merge(`equipos/${eqTop}`, { ownerId: 'u_leo', ownerNombre: 'Leo' });
        await store.merge('usuarios/u_leo', { equipoId: eqTop });
        humanos[1].eq = eqTop;
        await store.merge(`equipos_priv/${eqTop}`, { presupuesto: 30_000_000 });
        if (g) { await accion(humanos[1], 'mercado_galactico', { pid: g.pid, importe: 9_000_000 }, t); ofertaValida = g.pid; console.log('Oferta de', eqTop, 'por el Galáctico', g.pid, 'durante el Mundial'); }
        else { ofertaValida = 'ninguna'; console.log('Sin Galáctico de España'); }
    }
    // Mercado abierto: Ana cubre su vacante o hace un trueque con una escudería de la IA
    if (!mercadoAna && (await store.get('config/juego')).fase === 'mercado') {
        const mm = await store.get('mercado/T1');
        const pil = (await store.list('pilotos')).filter(p => p.equipoId);
        const suyos = pil.filter(p => p.equipoId === 'tramontana');
        const pos = mm.posiciones.pilotos;
        if (suyos.length < 2) {
            const obj = pil.filter(p => p.liga === 'ESP' && p.equipoId !== 'tramontana' && !mm.galacticos.some(g => g.pid === p.id) && p.nac !== 'es').sort((a, b) => (pos[b.id] || 20) - (pos[a.id] || 20))[0];
            await accion(humanos[0], 'mercado_fichaje', { pid: obj.id, importe: 1_500_000 }, t);
            mercadoAna = { tipo: 'fichaje', pid: obj.id };
        } else {
            await accion(humanos[0], 'mercado_ficha', {}, t);
            const socio = Object.keys(mm.fichas).find(eq => pil.some(p => p.equipoId === eq && p.liga === 'ESP'));
            const da = suyos.find(p => p.nac !== 'es') || suyos[1];
            const recibe = socio && pil.filter(p => p.equipoId === socio && p.nac === da.nac).concat(pil.filter(p => p.equipoId === socio && p.nac !== 'es')).sort((a, b) => (pos[b.id] || 20) - (pos[a.id] || 20))[0];
            if (socio && recibe) await accion(humanos[0], 'mercado_trueque', { conEq: socio, da: da.id, recibe: recibe.id }, t + 1);
            mercadoAna = { tipo: 'trueque', socio, da: da?.id, recibe: recibe?.id };
        }
        console.log('Ana en el mercado:', JSON.stringify(mercadoAna));
    }
    const r = await ejecutarTick(store, { ahora: t, log: () => {}, push: pushFalso });
    if (DEMO_MERCADO && mercadoAna && !demoGuardado && (await store.get('config/juego')).fase === 'mercado') {
        writeFileSync(new URL(RUTA_DEMO, import.meta.url), JSON.stringify({ ahora: t + 60_000, datos: store.volcar() }));
        demoGuardado = true;
        console.log('💾 demo con el mercado abierto guardada');
    }
    if (r.errores?.length) ok(false, `Errores en tick ${new Date(t).toISOString()}: ${r.errores.join(' | ')}`);
    if (DEMO && !demoGuardado && t >= T0 + 2 * 4 * D + D + 2 * H + 30 * 60_000) {
        const dia = diaMadrid(t);
        await store.set(`paddock/${dia}_u_ana`, { uid: 'u_ana', nombre: 'Ana', equipoId: 'tramontana', liga: 'ESP', texto: 'Tres carreras sin podio no son casualidad. El coche va, nos falta afinar el reglaje del domingo.', fecha: t - 2 * H, dia });
        await store.set(`paddock/${dia}_u_leo`, { uid: 'u_leo', nombre: 'Leo', equipoId: 'rheinwerk', liga: 'GER', texto: 'A los que nos espían: el motor nuevo llega en Hockenheim. Id preparando excusas.', fecha: t - 5 * H, dia });
        await store.set('usuarios/u_nuevo', { nombre: 'Carla', email: 'carla@correo.com', isAdmin: false, equipoId: null, estado: 'pendiente', creado: t - H });
        writeFileSync(new URL('../data/demo.json', import.meta.url), JSON.stringify({ ahora: t, datos: store.volcar() }));
        demoGuardado = true;
        console.log('💾 data/demo.json guardado en', new Date(t).toISOString());
    }
    t += 30 * 60_000;
}

// ---- Comprobaciones ----
const cfg = await store.get('config/juego');
console.log('Fase final:', cfg.fase, '| tick:', cfg.tick?.notas?.slice(-3));
ok(cfg.fase === 'cerrada', `La fase final debería ser "cerrada" y es "${cfg.fase}"`);
const resumen = JSON.parse((await store.get('resumen/T1')).json);
ok(resumen.sesiones.length === 25 * 6 + 3 * 6, `Sesiones en resumen: ${resumen.sesiones.length}`);
ok(cfg.mundial.participantes.length === 20, `Participantes Mundial: ${cfg.mundial.participantes.length}`);
const tablas = await tablasTemporada(store, 1);
const cat = await store.get('catalogo/actual');
const nom = (pid) => `${cat.pilotos[pid]?.nombre ?? '?'} ${cat.pilotos[pid]?.apellido ?? pid}`;
for (const liga of [...LIGAS_NACIONALES, 'INT']) {
    const top = tablas[liga].clasPilotos.slice(0, 3).map(p => `${nom(p.pid)} ${p.pts}`).join(' · ');
    console.log(`${liga}: ${top} | equipos: ${tablas[liga].clasEquipos[0]?.eq} ${tablas[liga].clasEquipos[0]?.pts}`);
}
const proy = proyeccionMundial(tablas);
console.log('Corte repesca:', proy.corte);
const m = await store.get('mercado/T1');
console.log('Mercado:', m.estado, '| despidos', m.plan.despidos.length, '| galácticos', m.galacticos.map(g => `${g.liga}:${g.estado}${g.destino ? `→${g.destino.eq}(${g.destino.via})` : ''}`).join(' '), '| rookies', m.elegidos?.length);
m.movimientos.slice().reverse().forEach(x => console.log('  ·', x.texto));
ok(m.estado === 'cerrado', 'El mercado debería estar cerrado');
const porLiga = (f) => ['ESP', 'ITA', 'GBR', 'GER', 'AUS'].map(l => m.galacticos.filter(g => g.liga === l && f(g)).length);
ok(porLiga(() => true).every(n => n >= 1 && n <= 3), `Candidatos a Galáctico por liga: ${porLiga(() => true)} (entre 1 y 3)`);
ok(porLiga(g => g.estado === 'vendido').every(n => n <= 1), `Solo se va un Galáctico por liga: ${porLiga(g => g.estado === 'vendido')}`);
const libresPool = (await store.list('pilotos')).filter(p => !p.equipoId && p.estado === 'libre');
ok(libresPool.length >= 100, `Bolsa de agentes libres: ${libresPool.length}`);
ok(m.movimientos.some(x => x.tipo === 'puja'), 'La IA puja por candidatos a Galáctico');
ok(m.galacticos.filter(g => g.estado === 'vendido').length >= 3, 'Casi ningún Galáctico ha cambiado de liga');
const sinDinero = ((await store.get(`equipos_priv/${humanos[1].eq}`))?.presupuesto || 0) < 9_000_000;
// (si la oferta no llegó a registrarse es que no cumplía las reglas: p. ej. el 55% de locales)
if (ofertaValida && ofertaValida !== 'ninguna' && m.galacticos.some(g => g.pid === ofertaValida) && m.ofertas.some(o => o.eq === humanos[1].eq && o.pid === ofertaValida)) ok(m.galacticos.some(g => g.pid === ofertaValida && (g.destino?.eq === humanos[1].eq || g.estado === 'se_queda' || (sinDinero && g.destino))), `La oferta de Leo por el Galáctico no se ejecutó: ${JSON.stringify(m.galacticos.find(g => g.pid === ofertaValida))} · Leo=${humanos[1].eq} sinDinero=${sinDinero} ofertas=${JSON.stringify(m.ofertas.filter(o => o.pid === ofertaValida))} mov=${JSON.stringify(m.movimientos.filter(x => x.eq === humanos[1].eq))}`);
ok(m.plan.despidos.length >= 10 && m.plan.despidos.length <= 20, `Despidos fuera de rango: ${m.plan.despidos.length}`);
if (mercadoAna?.tipo === 'fichaje') ok(m.fichajes.some(f => f.eq === 'tramontana' && f.estado === 'aceptada'), `El fichaje de Ana no se hizo: ${JSON.stringify(m.fichajes.filter(f => f.eq === 'tramontana'))}`);
if (mercadoAna?.tipo === 'trueque' && mercadoAna.recibe) console.log('Trueque de Ana:', JSON.stringify(m.trueques.filter(x => x.eq === 'tramontana')));
const pilotos = await store.list('pilotos');
const NAC = { ESP: 'es', ITA: 'it', GBR: 'gb', GER: 'de', AUS: 'au' };
for (const liga of LIGAS_NACIONALES) {
    const pl = pilotos.filter(p => p.liga === liga && p.equipoId);
    ok(pl.length === 20, `${liga}: ${pl.length} pilotos tras el mercado`);
    const locales = pl.filter(p => p.nac === NAC[liga]).length;
    ok(locales >= 11, `${liga}: solo ${locales} pilotos locales (55% = 11)`);
    const equipos = [...new Set(pl.map(p => p.equipoId))];
    equipos.forEach(eq => {
        ok(pl.filter(p => p.equipoId === eq).length === 2, `${eq} no tiene 2 pilotos`);
        ok(pl.some(p => p.equipoId === eq && p.nac === NAC[liga] && p.rol === 'P1'), `${eq} no tiene Piloto 1 local`);
    });
}
const privAna = await store.get('equipos_priv/tramontana');
const privLeo = await store.get('equipos_priv/rheinwerk');
console.log('Ana:', Math.round(privAna.presupuesto / 1e5) / 10, 'M€ coche', privAna.coche, 'inst', privAna.inst, 'racha', privAna.racha, 'sponsor', privAna.sponsor?.marca);
console.log('Leo:', Math.round(privLeo.presupuesto / 1e5) / 10, 'M€ coche', privLeo.coche);
const acciones = await store.list('acciones');
const errs = acciones.filter(a => a.estado === 'error');
if (process.env.DEPURAR) console.log('Ofertas de Leo:', JSON.stringify(acciones.filter(a => a.tipo === 'mercado_galactico').map(a => [a.equipoId, a.estado, a.resultado, a.procesado, a.creado])));
console.log('Acciones:', acciones.length, 'errores:', errs.length, [...new Set(errs.map(a => a.tipo + ': ' + a.resultado.error))].slice(0, 12));
ok(acciones.every(a => a.estado !== 'pendiente'), 'Quedan acciones pendientes');
const notifs = await store.list('notificaciones', [['uid', '==', 'u_ana']]);
console.log('Notificaciones Ana:', notifs.length, '| tipos:', [...new Set(notifs.map(x => x.tipo))].join(','));
console.log('Avisos al móvil de Ana:', avisos.length, '· ejemplos:'); [...new Map(avisos.map(a => [a.title.split(' ')[0], a])).values()].slice(0, 4).forEach(a => console.log('   🔔', a.title, '—', a.body));
ok(avisos.length > 10, 'Casi no se han enviado avisos');
const prensa = await store.list('prensa');
const noticiasPrensa = (await store.list('noticias')).filter(x => x.tipo === 'prensa');
console.log('Prensa:', prensa.length, 'preguntas ·', noticiasPrensa.length, 'declaraciones/plantones · ej:', noticiasPrensa.slice(0, 2).map(x => x.titulo).join(' | '));
ok(prensa.every(p => p.aplicada || p.expira > FIN), 'Hay preguntas de prensa sin procesar');
ok((await store.get('equipos_priv/tramontana')).resumenes?.length === 1, 'Falta el resumen de temporada de Ana');
console.log('Resumen Ana:', (await store.get('equipos_priv/tramontana')).resumenes?.[0]?.titular);
const decis = await store.list('decisiones');
ok(decis.every(d => d.aplicada), 'Hay decisiones sin aplicar');
const juntasT = await store.list('juntas');
const notT = await store.list('noticias');
console.log('Juntas:', juntasT.map(j => `${j.id} ${j.estado}: ${(j.resultados || []).map(x => x.texto).join(' | ')}`).join(' // ') || 'ninguna', '| lesiones:', notT.filter(x => /, lesionado$/.test(x.titulo)).length, '| sustitutos:', notT.filter(x => /como sustituto$/.test(x.titulo)).length);
console.log('Noticias:', (await store.list('noticias')).length, '| lecturas', store.lecturas, 'escrituras', store.escrituras);

const resultados = await store.list('resultados');
const r3 = resultados.filter(r => r.tipo === 'R3');
// Nadie cambia de escudería a mitad del Mundial (el mercado está abierto pero los cambios se aplican al final)
const eqInt = {};
for (const r of resultados.filter(r => r.liga === 'INT')) for (const f of r.filas) (eqInt[f.pid] ||= new Set()).add(f.eq);
ok(Object.values(eqInt).every(s => s.size === 1), 'Algún piloto cambió de escudería durante el Mundial');
const despidosMan = (await store.list('noticias')).filter(x => / despid/.test(x.titulo) && x.tipo === 'mercado');
console.log('Mánagers despedidos:', despidosMan.length, despidosMan.slice(0, 3).map(x => x.titulo).join(' | '));
ok(despidosMan.length >= 1, 'Ningún mánager despedido al acabar la temporada');
const paradas = r3.flatMap(r => r.eventos.filter(e => e.tipo === 'parada'));
const dnfs = resultados.filter(r => r.tipo.startsWith('R')).map(r => r.filas.filter(f => f.estado === 'DNF').length);
console.log('Carreras:', dnfs.length, '· abandonos por carrera', (dnfs.reduce((a, b) => a + b, 0) / dnfs.length).toFixed(2), '· máx', Math.max(...dnfs),
  '| SC', resultados.filter(r => r.eventos?.some(e => e.tipo === 'sc')).length, 'VSC', resultados.filter(r => r.eventos?.some(e => e.tipo === 'vsc')).length,
  '| paradas en C3', paradas.length, '| sin coche (taller)', resultados.reduce((s, r) => s + (r.dns?.length || 0), 0));
const privAnaN = await store.get('equipos_priv/tramontana');
console.log('Lectura neumáticos Ana (última):', JSON.stringify(Object.values(privAnaN.neumaticos || {}).at(-1)));
ok(paradas.length > 0, 'Nadie ha parado en boxes en la Carrera 3');
const cfgAntes = await store.get('config/juego');
ok(cfgAntes.inscripcion === false && cfgAntes.inscripcionCerrada === 1, `La inscripción se cierra sola tras la primera jornada (${cfgAntes.inscripcion})`);
const privsAntes = await store.list('equipos_priv');
ok(privsAntes.filter(p => (p.finanzas || []).some(f => f.c.startsWith('Bonus clasificación global'))).length >= 25, 'Bonus por la clasificación global al acabar la temporada');
const palm = await nuevaTemporada(store, { ahora: FIN + D, reglamento: 'si' });
const cfgDespues = await store.get('config/juego');
ok(cfgDespues.inscripcion === true, 'La inscripción se reabre con la nueva temporada');
const privsDespues = await store.list('equipos_priv');
ok(privsDespues.every(p => p.presupuesto >= 7_000_000), `Nadie empieza con menos de 7 M€ (mínimo ${Math.min(...privsDespues.map(p => p.presupuesto))})`);
console.log('Presupuestos T2 (mín/máx):', Math.min(...privsDespues.map(p => p.presupuesto)), Math.max(...privsDespues.map(p => p.presupuesto)), '·', privsDespues[0].finanzas.slice(0, 3).map(f => f.c).join(' | '));
const privAna2 = await store.get('equipos_priv/tramontana');
console.log('Cambio de reglamento → Ana coche', privAna2.coche, 'inst', privAna2.inst, '| managers', (await store.list('managers')).map(x => `${x.nombre}: ${x.historial.map(h => h.rating).join(',')}`).join(' · '));
ok(palm.cambioReglamento, 'No se aplicó el cambio de reglamento');
ok((await store.list('managers')).length === 2, 'Falta el historial de los mánagers');
const cfg2 = await store.get('config/juego');
ok(cfg2.temporada === 2 && cfg2.fase === 'pretemporada', 'Nueva temporada mal iniciada');
console.log('Palmarés T1:', Object.entries(palm.ligas).map(([l, v]) => `${l}: ${nom(v.piloto)}`).join(' · '), '| Mundial:', nom(palm.mundial));

console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\n✅ Temporada completa sin fallos');
process.exit(fallos.length ? 1 : 0);
