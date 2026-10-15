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
void cargarEquipos; void cargarPrivs;
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\n✅ Novedades sin fallos');
process.exit(fallos.length ? 1 : 0);
