// Prueba en memoria de las partidas de amigos: creación con ajustes, parrilla y calendario propios, temporada completa
// con menos ligas (y sin Mundial), gestión ligera del admin, paso automático de temporada y aislamiento total
// respecto a la partida original. Uso: node worker/prueba-partidas.mjs
import { MemStore } from '../js/core/memstore.js';
import { StorePartida } from '../js/core/partida-store.js';
import { crearPartida, sanearAjustes } from '../js/jobs/partidas.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { fijarLigas, fijarLigasDe, LIGAS_NACIONALES } from '../js/engine/constants.js';

const store = new MemStore();
const fallos = [];
const ok = (c, m) => { if (!c) { fallos.push(m); console.log('❌', m); } else console.log('✓', m); };
const H = 3600_000, D = 24 * H;
const T0 = Date.UTC(2026, 10, 2, 9, 0);

// La partida original: algo en la raíz que no debe cambiar
await store.set('config/juego', { temporada: 1, fase: 'nacional', marca: 'original' });
await store.set('equipos/tramontana', { nombre: 'Tramontana Racing', liga: 'ESP' });
const raizAntes = JSON.stringify({ c: await store.get('config/juego'), e: await store.list('equipos') });

ok(sanearAjustes({ ligas: ['GER'], mundial: true }).mundial === false, 'Con una sola liga no hay Mundial');
ok(sanearAjustes({ ligas: ['XXX'] }).ligas.join() === 'ESP', 'Ligas no válidas → España');
ok(sanearAjustes({ jornadas: 99, hora: 3 }).jornadas === 8 && sanearAjustes({ hora: 3 }).hora === 10, 'Los ajustes se acotan');

const crear = async (id, ajustes, creador = 'u_ana') => {
    await store.set(`partidas/${id}`, { nombre: `Liga ${id}`, creador, creadorNombre: 'Ana', ajustes, estado: 'solicitada', creada: T0 });
    return crearPartida(store, { id, ...(await store.get(`partidas/${id}`)) }, { ahora: T0 });
};
await crear('solo', { ligas: ['GER'], mundial: false, jornadas: 3, diasEntre: 2, hora: 18, novedades: true });
await crear('dos', { ligas: ['ESP', 'ITA'], mundial: true, jornadas: 3, diasEntre: 2, hora: 19, novedades: false });
const pSolo = await store.get('partidas/solo');
ok(pSolo.estado === 'activa' && pSolo.admins.includes('u_ana'), 'La partida queda activa y quien la crea es admin');
ok(!!(await store.get('partidas_priv/solo'))?.codigo, 'Tiene código de invitación');
const sSolo = new StorePartida(store, 'solo'), sDos = new StorePartida(store, 'dos');
const eqSolo = await sSolo.list('equipos'), eqDos = await sDos.list('equipos');
ok(eqSolo.length === 10 && eqSolo.every(e => e.liga === 'GER'), `Partida de una liga: 10 escuderías alemanas (${eqSolo.length})`);
ok(eqDos.length === 20, `Partida de dos ligas: 20 escuderías (${eqDos.length})`);
const pilSolo = await sSolo.list('pilotos'), pilDos = await sDos.list('pilotos');
ok(pilSolo.filter(p => p.equipoId).length === 20 && pilDos.filter(p => p.equipoId).length === 40, 'Pilotos propios en cada partida');
const otraAlemana = new StorePartida(store, 'otra');
await crear('otra', { ligas: ['GER'], mundial: false });
const pilOtra = (await otraAlemana.list('pilotos')).filter(p => p.equipoId);
const repetidos = pilOtra.filter(p => pilSolo.some(q => q.equipoId && q.nombre === p.nombre && q.apellido === p.apellido)).length;
const eqRepetidos = (await otraAlemana.list('equipos')).filter(e => eqSolo.some(x => x.nombre === e.nombre)).length;
ok(repetidos <= 3 && eqRepetidos <= 4, `Dos partidas con la misma liga tienen pilotos y escuderías distintos (${repetidos} pilotos y ${eqRepetidos} escuderías coinciden)`);
const evSolo = await sSolo.list('eventos'), evDos = await sDos.list('eventos');
ok(evSolo.length === 3 && !evSolo.some(e => e.liga === 'INT'), `Calendario de la partida sin Mundial (${evSolo.length} jornadas)`);
ok(evDos.filter(e => e.liga === 'INT').length === 3 && evDos.length === 9, `Calendario con Mundial (${evDos.length} eventos)`);
ok(!!(await sSolo.get('ingenieros/plantilla')) && !(await sDos.get('ingenieros/plantilla')), 'Las novedades solo se activan si se eligen');
ok(JSON.stringify({ c: await store.get('config/juego'), e: await store.list('equipos') }) === raizAntes, 'Crear partidas no toca la partida original');

// Ana entra en su partida, coge escudería y juega; Leo se une con el código
await sSolo.set('miembros/u_leo', { uid: 'u_leo', nombre: 'Leo', equipoId: null, codigo: (await store.get('partidas_priv/solo')).codigo });
const eqAna = eqSolo[0].id;
await sSolo.merge(`equipos/${eqAna}`, { ownerId: 'u_ana', ownerNombre: 'Ana' });
await sSolo.merge('miembros/u_ana', { equipoId: eqAna });
await sSolo.set('acciones/a1', { uid: 'u_ana', equipoId: eqAna, tipo: 'reclamar', params: {}, creado: T0, estado: 'pendiente' });

// Se juega la temporada entera de las dos partidas, ciclo a ciclo
const ciclo = async (s, t) => { fijarLigasDe(await s.get('config/juego')); try { return await ejecutarTick(s, { ahora: t, log: () => { } }); } finally { fijarLigas(); } };
let t = T0, errores = [], gestionHecha = false;
const FIN = T0 + 28 * D;
while (t < FIN) {
    for (const s of [sSolo, sDos]) { const r = await ciclo(s, t); if (r.errores?.length) errores.push(`${s.pid}: ${r.errores.join(' | ')}`); }
    // A media temporada el admin cierra la inscripción y echa a Leo
    if (!gestionHecha && t > T0 + 4 * D) {
        await sSolo.set('gestion/g1', { uid: 'u_ana', tipo: 'inscripcion', params: { abierta: false }, creado: t, estado: 'pendiente' });
        await sSolo.set('gestion/g2', { uid: 'u_ana', tipo: 'expulsar', params: { uid: 'u_leo' }, creado: t, estado: 'pendiente' });
        await sSolo.set('gestion/g3', { uid: 'u_leo', tipo: 'renombrar', params: { nombre: 'Hackeada' }, creado: t, estado: 'pendiente' });
        gestionHecha = true;
    }
    t += 30 * 60_000;
}
ok(!errores.length, `Ciclos sin errores${errores.length ? ': ' + errores.slice(0, 3).join(' // ') : ''}`);
const cSolo = await sSolo.get('config/juego'), cDos = await sDos.get('config/juego');
console.log('Partida solo →', cSolo.temporada, cSolo.fase, '| partida dos →', cDos.temporada, cDos.fase);
ok(cSolo.temporada >= 2, `La partida de una liga pasa sola a la temporada siguiente (está en T${cSolo.temporada}, ${cSolo.fase})`);
ok(cDos.temporada === 2 || ['mercado', 'cerrada', 'pretemporada', 'nacional'].includes(cDos.fase), `La partida con Mundial avanza (T${cDos.temporada}, ${cDos.fase})`);
ok((await sSolo.list('eventos', [['temporada', '==', 2]])).length === 3, 'Calendario nuevo para la temporada 2');
const g = Object.fromEntries((await sSolo.list('gestion')).map(x => [x.id, x]));
ok(g.g1.estado === 'hecha' && g.g2.estado === 'hecha', 'El admin de la partida puede cerrar la inscripción y echar a alguien');
ok(g.g3.estado === 'error', `Quien no es admin no puede gestionar (${g.g3.resultado?.error})`);
ok(!(await sSolo.get('miembros/u_leo')), 'Leo ya no es miembro');
ok((await store.get('partidas/solo')).nombre !== 'Hackeada', 'Nadie más puede renombrarla');
const resumen = JSON.parse((await sSolo.get('resumen/T1')).json);
ok(resumen.sesiones.length === 3 * 6 && resumen.sesiones.every(x => x.liga === 'GER'), `Clasificaciones de la partida de una liga (${resumen.sesiones.length} sesiones)`);
ok(JSON.stringify({ c: await store.get('config/juego'), e: await store.list('equipos') }) === raizAntes, 'Jugar en otras partidas no toca la partida original');
ok(LIGAS_NACIONALES.length === 5, 'Tras cada ciclo se restauran las cinco ligas');

console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\n✅ Partidas sin fallos');
process.exit(fallos.length ? 1 : 0);
