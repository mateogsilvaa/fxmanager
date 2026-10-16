// Prueba en memoria de las novedades de la temporada 2: ingenieros, negociaciones, planos, blindaje, llamadas y reputación.
// Uso: node worker/prueba-novedades.mjs
import { readFileSync } from 'node:fs';
import { MemStore } from '../js/core/memstore.js';
import { importarParrilla, inicializarJuego } from '../js/jobs/temporada.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { crearContexto, volcar, cargarEquipos, cargarPrivs } from '../js/jobs/comun.js';
import { activarNovedades, ACCIONES_NOVEDADES } from '../js/jobs/novedades.js';
import { REF_PLANTILLA, deEquipo, libres, CATEGORIAS_ING } from '../js/engine/ingenieros.js';
import { diaMadrid, costeMejoraFinal } from '../js/engine/constants.js';

const store = new MemStore();
const fallos = [];
const ok = (c, m) => { if (!c) { fallos.push(m); console.log('❌', m); } else console.log('✓', m); };
const T0 = Date.UTC(2026, 9, 20, 8, 0);
await inicializarJuego(store);
await importarParrilla(store, JSON.parse(readFileSync(new URL('../data/parrilla.json', import.meta.url))));
await store.merge('config/juego', { fase: 'pretemporada' });
await store.set('secreto/juego', { clave: 'prueba' });
// Ana dirige tramontana, Leo dirige rheinwerk
for (const [uid, nombre, eq] of [['u_ana', 'Ana', 'tramontana'], ['u_leo', 'Leo', 'rheinwerk']]) {
    await store.set(`usuarios/${uid}`, { nombre, isAdmin: false, equipoId: eq, estado: 'aprobado', uso: { dias: { [diaMadrid(T0 - 864e5)]: 90 }, horas: { 10: 30 } } });
    await store.merge(`equipos/${eq}`, { ownerId: uid, ownerNombre: nombre });
    await store.merge(`equipos_priv/${eq}`, { presupuesto: 30_000_000 });
}

// Activar
const ctx = crearContexto(store, { ahora: T0 });
ctx.cfg = await store.get('config/juego'); ctx.secreto = 'prueba'; ctx.temporada = ctx.cfg.temporada;
await activarNovedades(ctx); await volcar(ctx);
let pl = (await store.get(REF_PLANTILLA)).lista;
ok(deEquipo(pl, 'tramontana').length === 5, 'Cada escudería empieza con 5 ingenieros');
ok(libres(pl).length === Object.keys(CATEGORIAS_ING).length * 9, 'Hay ingenieros libres');
const privA = await store.get('equipos_priv/tramontana');
ok(privA.bonusIng && Object.values(privA.bonusIng).reduce((a, b) => a + b, 0) > 0, 'bonusIng calculado');
ok((await store.get('equipos/tramontana')).reputacion === 50, 'Reputación inicial 50');

let n = 0, t = T0;
const accion = async (uid, eq, tipo, params) => { const id = `a${n++}`; await store.set(`acciones/${id}`, { uid, equipoId: eq, tipo, params, creado: t, estado: 'pendiente' }); t += 60_000; await ejecutarTick(store, { ahora: t, log: () => { } }); return store.get(`acciones/${id}`); };

// Fichar un ingeniero libre de motor (hay un hueco libre)
const libreMotor = libres(pl).filter(i => i.cat === 'motor').sort((a, b) => b.estrellas - a.estrellas)[0];
let r = await accion('u_ana', 'tramontana', 'ing_fichar', { id: libreMotor.id });
ok(r.estado === 'hecha', `Fichar ingeniero: ${r.estado} ${r.resultado?.error || ''}`);
pl = (await store.get(REF_PLANTILLA)).lista;
ok(pl[libreMotor.id].equipoId === 'tramontana', 'El ingeniero ya es de Ana');
r = await accion('u_ana', 'tramontana', 'ing_fichar', { id: libres(pl).find(i => i.cat === 'motor').id });
ok(r.estado === 'error', `Sin hueco no se puede fichar un tercero: ${r.resultado?.error}`);
const costeCon = costeMejoraFinal('motor', 2, await store.get('equipos_priv/tramontana'));
ok(costeCon < costeMejoraFinal('motor', 2, {}), `Los ingenieros abaratan las mejoras (${costeCon})`);

// Negociación con la IA: Ana ofrece dinero por un ingeniero de aero de una IA (compra), generosa → acepta
const ia = Object.entries((await store.get('catalogo/actual')).equipos).find(([id, e]) => !e.ownerId && e.liga === 'ESP' && id !== 'tramontana')[0];
const ingIA = deEquipo(pl, ia).find(i => i.cat === 'aero');
const ingAnaAero = deEquipo(pl, 'tramontana').find(i => i.cat === 'aero');
r = await accion('u_ana', 'tramontana', 'neg_proponer', { conEq: ia, doy: { dinero: 5_000_000, ingenieros: [ingAnaAero.id] }, pido: { ingenieros: [ingIA.id] } });
ok(r.estado === 'hecha' && r.resultado?.estado === 'aceptada', `Intercambio + compensación con la IA: ${r.resultado?.estado || r.resultado?.error}`);
pl = (await store.get(REF_PLANTILLA)).lista;
ok(pl[ingIA.id].equipoId === 'tramontana' && pl[ingAnaAero.id].equipoId === ia, 'Los ingenieros cambian de escudería');
// Oferta tacaña: la IA dice que no
// Cambio de ingeniero de motor por otro igual o mejor de la IA: sin ganar nada, la IA dice que no
const peorMio = deEquipo(pl, 'tramontana').filter(i => i.cat === 'motor').sort((a, b) => a.estrellas - b.estrellas)[0];
const suyoMotor = deEquipo(pl, ia).filter(i => i.cat === 'motor').sort((a, b) => b.estrellas - a.estrellas)[0];
r = await accion('u_ana', 'tramontana', 'neg_proponer', { conEq: ia, doy: { ingenieros: [peorMio.id] }, pido: { ingenieros: [suyoMotor.id] } });
ok(suyoMotor.estrellas < peorMio.estrellas || r.resultado?.estado === 'rechazada', `Intercambio que no le conviene a la IA: ${r.resultado?.estado} (${r.resultado?.motivo || r.resultado?.error || ''})`);

// Planos: Leo tiene motor alto; Ana compra los planos y su mejora no puede fallar
await store.merge('equipos_priv/rheinwerk', { coche: { motor: 6, aero: 1, chasis: 1, fiabilidad: 1 } });
await store.merge('equipos_priv/tramontana', { coche: { motor: 1, aero: 1, chasis: 1, fiabilidad: 1 } });
r = await accion('u_ana', 'tramontana', 'neg_proponer', { conEq: 'rheinwerk', doy: { dinero: 2_000_000 }, pido: { planos: [{ area: 'motor' }] } });
const neg = (await store.list('negociaciones')).find(x => x.a === 'rheinwerk' && x.estado === 'pendiente');
ok(!!neg && neg.uids.includes('u_leo') && neg.uids.includes('u_ana'), 'Propuesta a un humano queda pendiente y la ven los dos');
r = await accion('u_leo', 'rheinwerk', 'neg_responder', { id: neg.id, acepta: true });
ok(r.estado === 'hecha', `Leo acepta: ${r.resultado?.error || 'ok'}`);
let pA = await store.get('equipos_priv/tramontana');
ok(pA.planos?.motor === 6, `Ana tiene los planos de motor nivel 6 (${pA.planos?.motor})`);
r = await accion('u_ana', 'tramontana', 'id_iniciar', { area: 'motor', urgente: true });
ok(r.estado === 'hecha', `Mejora de motor encargada ${r.resultado?.error || ''}`);
t += 2 * 864e5; await ejecutarTick(store, { ahora: t, log: () => { } });
pA = await store.get('equipos_priv/tramontana');
ok(pA.coche.motor === 2, `Con planos la mejora no falla (motor ${pA.coche.motor})`);

// Despedir ingeniero
r = await accion('u_ana', 'tramontana', 'ing_despedir', { id: libreMotor.id });
ok(r.estado === 'hecha', `Despedir ingeniero (indemnización ${r.resultado?.coste})`);

// Llamadas: con 90 min al día casi seguro que llega una al cambiar de día
let llamadas = [];
for (let i = 0; i < 6 && !llamadas.length; i++) { t += 864e5; await ejecutarTick(store, { ahora: t, log: () => { } }); llamadas = await store.list('llamadas', [['uid', '==', 'u_ana']]); }
ok(llamadas.length > 0, `Llega una llamada o carta (${llamadas[0]?.formato}: ${llamadas[0]?.titulo})`);
if (llamadas[0]) {
    const l = llamadas[0];
    ok(l.personaje?.tipo && l.opciones?.length >= 2, `Tiene personaje (${l.personaje.tipo}) y opciones`);
    await store.update(`llamadas/${l.id}`, { eleccion: l.opciones[0].id });
    t = Math.max(t, l.disponible) + 60_000; await ejecutarTick(store, { ahora: t, log: () => { } });
    const l2 = await store.get(`llamadas/${l.id}`);
    ok(l2.aplicada && l2.resultado, `La respuesta se aplica: «${l2.resultado}»`);
}
pA = await store.get('equipos_priv/tramontana');
ok(pA.finanzas.some(f => f.c === 'Sueldos de ingenieros'), 'Se pagan los sueldos de los ingenieros');
ok(pA.ofertasSponsor?.[0]?.rep != null, 'Las ofertas de patrocinio tienen en cuenta la reputación');

// Blindaje de un Galáctico (mercado de prueba)
await store.merge('config/juego', { fase: 'mercado' });
const pidAna = (await store.list('pilotos')).find(p => p.equipoId === 'tramontana').id;
await store.set('mercado/T1', { estado: 'abierto', deadline: t + 864e5, galacticos: [{ liga: 'ESP', pid: pidAna, eq: 'tramontana', nombre: 'X', estado: 'pendiente' }], ofertas: [{ id: 'o1', pid: pidAna, eq: 'rheinwerk', importe: 3_000_000, estado: 'pendiente' }], movimientos: [] });
r = await accion('u_ana', 'tramontana', 'galactico_blindar', { importe: 4_000_000 });
ok(r.estado === 'error', `Blindaje por debajo de 1,5× la puja: ${r.resultado?.error}`);
r = await accion('u_ana', 'tramontana', 'galactico_blindar', { importe: 4_500_000 });
const m = await store.get('mercado/T1');
ok(r.estado === 'hecha' && m.galacticos[0].estado === 'blindado' && m.ofertas[0].estado === 'anulada', 'Blindaje a 1,5× la puja: se queda y la oferta se anula');
ok((await store.get('equipos/tramontana')).reputacion > 50, `La reputación del equipo se mueve (${(await store.get('equipos/tramontana')).reputacion})`);

// ---------- Ramas de desarrollo ----------
await store.merge('config/juego', { fase: 'pretemporada' });
await store.merge('equipos_priv/tramontana', { coche: { motor: 3, aero: 1, chasis: 1, fiabilidad: 1 }, presupuesto: 30_000_000 });
r = await accion('u_ana', 'tramontana', 'rama_elegir', { area: 'motor', tier: 3, opcion: 'potencia' });
ok(r.estado === 'hecha' && r.resultado.coste === 0, `Elegir rama es gratis (${r.resultado?.error || r.resultado?.coste})`);
r = await accion('u_ana', 'tramontana', 'rama_elegir', { area: 'aero', tier: 3, opcion: 'carga' });
ok(r.estado === 'error', `Sin el nivel no se puede elegir rama: ${r.resultado?.error}`);
r = await accion('u_ana', 'tramontana', 'rama_elegir', { area: 'motor', tier: 3, opcion: 'par' });
ok(r.estado === 'hecha' && r.resultado.coste === 800_000, `Cambiar de rama cuesta un rediseño (${r.resultado?.coste})`);
const { efectosRamas, perfilCoche } = await import('../js/engine/ramas.js');
const { ritmoBase } = await import('../js/engine/sim.js');
const { CIRCUITOS } = await import('../js/engine/circuitos.js');
const { normalizarCircuito } = await import('../js/engine/circuitos.js');
pA = await store.get('equipos_priv/tramontana');
ok(efectosRamas(pA).ataque === 3 && perfilCoche(pA).find(x => x.id === 'ataque').valor > 0, 'Las ramas cambian el carácter del coche');
const monza = normalizarCircuito(CIRCUITOS.find(c => c.id === 'monza'));
const base = { attrs: { ritmo: 80, consistencia: 80, agresividad: 70 }, coche: { motor: 3, aero: 3, chasis: 3, fiabilidad: 3 } };
const rRecta = ritmoBase({ ...base, mods: { rectas: 0.0012 } }, monza, false), rCurva = ritmoBase({ ...base, mods: { curvas: 0.0014, rectas: -0.0004 } }, monza, false);
ok(rRecta < rCurva, `Mismo nivel, distinto coche: en Monza el de rectas es más rápido (${Math.round(rRecta)} vs ${Math.round(rCurva)} ms)`);

// ---------- Bolsa de agentes libres ----------
const { asegurarPool } = await import('../js/jobs/pilotos.js');
const cP = crearContexto(store, { ahora: t }); cP.cfg = await store.get('config/juego'); cP.secreto = 'prueba';
await asegurarPool(cP); await volcar(cP);
let libresP = (await store.list('pilotos')).filter(p => !p.equipoId && p.estado === 'libre');
ok(libresP.length >= 100 && libresP.every(p => p.valoracion >= 1 && p.precio > 0), `Bolsa de agentes libres: ${libresP.length} con valoración y precio`);
ok(['es', 'it', 'gb', 'de', 'au'].every(n => libresP.filter(p => p.nac === n).length >= 16), 'Hay libres locales de cada liga');

// ---------- Lesiones ----------
await store.merge('config/juego', { fase: 'nacional' });
await store.set('eventos/1_ESP_1', { temporada: 1, liga: 'ESP', ronda: 1, fase: 'nacional', circuito: monza, sesiones: { R1: { estado: 'publicada', lockAt: T0, publishAt: T0, revealAt: T0 } } });
await store.set('eventos/1_ESP_2', { temporada: 1, liga: 'ESP', ronda: 2, fase: 'nacional', circuito: monza, sesiones: { R1: { estado: 'programada', lockAt: t + 90 * 864e5, publishAt: t + 90 * 864e5, revealAt: t + 90 * 864e5 } } });
const { lesionTrasAccidente, lesionesAntesDeSesion } = await import('../js/jobs/pilotos.js');
const cL = crearContexto(store, { ahora: t }); cL.cfg = await store.get('config/juego'); cL.secreto = 'prueba';
await cargarEquipos(cL); await cargarPrivs(cL);
const lesionado = (await store.list('pilotos')).find(p => p.equipoId === 'tramontana' && p.rol === 'P2') || (await store.list('pilotos')).find(p => p.equipoId === 'tramontana');
let les = null;
for (let i = 0; i < 40 && !les; i++) les = await lesionTrasAccidente(cL, { id: `x${i}`, liga: 'ESP' }, { pid: lesionado.id, eq: 'tramontana', tipo: 'R1' });
await volcar(cL);
ok(!!les && (await store.get(`pilotos/${lesionado.id}`)).estado === 'lesionado', `Un accidente grave puede lesionar (${les?.carreras} carreras)`);
libresP = (await store.list('pilotos')).filter(p => !p.equipoId && p.estado === 'libre' && p.nac === 'es').sort((a, b) => b.valoracion - a.valoracion);
r = await accion('u_ana', 'tramontana', 'lesion_sustituto', { pid: lesionado.id, sustituto: libresP[0].id });
const sub = await store.get(`pilotos/${libresP[0].id}`);
ok(r.estado === 'hecha' && sub.equipoId === 'tramontana' && sub.estado === 'sustituto', `Ana elige sustituto de la bolsa (${r.resultado?.error || sub.nombre + ' ' + sub.apellido})`);
await store.merge('equipos_priv/tramontana', { lesiones: [{ ...(await store.get('equipos_priv/tramontana')).lesiones[0], restantes: 0 }] });
const cR = crearContexto(store, { ahora: t }); cR.cfg = await store.get('config/juego'); cR.secreto = 'prueba';
await lesionesAntesDeSesion(cR, { liga: 'ESP' }); await volcar(cR);
ok((await store.get(`pilotos/${lesionado.id}`)).estado === 'activo' && !(await store.get(`pilotos/${sub.id}`)).equipoId, 'Al recuperarse vuelve a su asiento y el sustituto a la bolsa');

// ---------- Junta de pilotos ----------
const { abrirJuntaSiToca } = await import('../js/jobs/juntas.js');
const cJ = crearContexto(store, { ahora: t }); cJ.cfg = await store.get('config/juego'); cJ.secreto = 'prueba';
// (puede haberla abierto ya el ciclo diario)
const junta = (await abrirJuntaSiToca(cJ)) || (await store.list('juntas', [['estado', '==', 'abierta']]))[0]; await volcar(cJ);
ok(junta && junta.temas.length === 3, `Se abre una junta de pilotos (${junta?.temas.map(x => x.id).join(', ')})`);
const tema = junta.temas.find(x => x.id !== 'sancion') || junta.temas[0];
r = await accion('u_ana', 'tramontana', 'junta_votar', { juntaId: 'T1_1', votos: { [tema.id]: tema.opciones[tema.opciones.length - 1].id } });
ok(r.estado === 'hecha', `Ana da su consigna ${r.resultado?.error || ''}`);
t = junta.cierra + 60_000; await ejecutarTick(store, { ahora: t, log: () => { } });
const jC = await store.get('juntas/T1_1');
const cfgJ = await store.get('config/juego');
ok(jC.estado === 'cerrada' && jC.resultados.length === 3 && jC.votantes >= 90, `La junta se cierra con ${jC.votantes} pilotos votando: ${jC.resultados.map(x => x.texto).join(' | ')}`);
ok(cfgJ.normas && Object.keys(cfgJ.normas).length > 0, `Se aplican las normas: ${JSON.stringify(cfgJ.normas)}`);
const { tablaPuntos } = await import('../js/engine/juntas.js');
const { puntuar } = await import('../js/engine/sim.js');
const resP = puntuar({ tipo: 'R3', filas: [{ pid: 'a', estado: 'FIN', laps: [1, 2, 3] }, { pid: 'b', estado: 'FIN', laps: [1, 3, 4] }] }, { puntos: 'top10', vr: 0 }, 2);
ok(resP.filas[0].pts === tablaPuntos('R3', { puntos: 'top10' })[0] * 2 && resP.pf, `Puntos dobles en la última carrera (${resP.filas[0].pts})`);

// ---------- Vía rápida del worker: solo el paso necesario, sin bloquear el ciclo ----------
{
    const base = (await store.list('llamadas'))[0];
    const { id, ...resto } = base;
    await store.set('llamadas/rapida', { ...resto, eleccion: base.opciones[0].id, aplicada: false, resultado: null, disponible: t - 1000, expira: t + 864e5 });
    const cfgR = await store.get('config/juego');
    const antes = JSON.stringify(cfgR.tick || null);
    const lecturas0 = store.lecturas;
    const rap = await ejecutarTick(store, { ahora: t, log: () => { }, solo: ['procesarLlamadas'], precarga: { cfg: cfgR, secreto: 'prueba', sombra: null, llamadas: [{ id: 'rapida', eleccion: 1 }] } });
    const lr = await store.get('llamadas/rapida');
    ok(rap.rapido && lr.aplicada === true && Array.isArray(lr.chips), `Vía rápida: la llamada se aplica con solo su paso (${store.lecturas - lecturas0} lecturas, ${lr.chips?.length} efectos)`);
    ok(JSON.stringify((await store.get('config/juego')).tick || null) === antes, 'La vía rápida no bloquea ni toca el estado del ciclo');
    const lecturas1 = store.lecturas;
    await ejecutarTick(store, { ahora: t, log: () => { }, solo: ['procesarLlamadas', 'procesarAcciones'], precarga: { cfg: cfgR, secreto: 'prueba', llamadas: [], acciones: [] } });
    ok(store.lecturas - lecturas1 === 0, `Sin nada pendiente no se consulta nada (${store.lecturas - lecturas1} lecturas)`);
}
void cargarEquipos; void cargarPrivs;
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\n✅ Novedades sin fallos');
process.exit(fallos.length ? 1 : 0);
