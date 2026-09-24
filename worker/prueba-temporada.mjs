// Simula una temporada completa en memoria (sin tocar Firebase) y comprueba que todo encaja.
// Uso: node worker/prueba-temporada.mjs [--demo]   (--demo guarda data/demo.json a mitad de temporada)
import { readFileSync, writeFileSync } from 'node:fs';
import { MemStore } from '../js/core/memstore.js';
import { importarParrilla, crearEvento, guardarEventos, inicializarJuego, nuevaTemporada, tablasTemporada } from '../js/jobs/temporada.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { CIRCUITOS_POR_ID } from '../js/engine/circuitos.js';
import { LIGAS_NACIONALES, SESIONES, diaMadrid } from '../js/engine/constants.js';
import { proyeccionMundial } from '../js/engine/stats.js';

const DEMO = process.argv.includes('--demo');
const H = 3600_000, D = 24 * H;
const store = new MemStore();
const fallos = [];
const ok = (cond, msg) => { if (!cond) { fallos.push(msg); console.log('❌', msg); } };

const parrilla = JSON.parse(readFileSync(new URL('../data/parrilla.json', import.meta.url)));
await inicializarJuego(store);
await importarParrilla(store, parrilla);

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
const OFF = { FP: 0, Q1: H, R1: D, Q2: D + H, R2: 2 * D, R3: 2 * D + H };
const eventos = [];
LIGAS_NACIONALES.forEach((liga, li) => CIRC[liga].forEach((c, k) => {
    const base = T0 + k * 7 * D + li * 10 * 60_000;
    eventos.push(crearEvento({ temporada: 1, liga, ronda: k + 1, circuito: CIRCUITOS_POR_ID[c], horarios: Object.fromEntries(SESIONES.map(t => [t, base + OFF[t]])) }));
}));
CIRC.INT.forEach((c, k) => {
    const base = T0 + (5 + k) * 7 * D;
    eventos.push(crearEvento({ temporada: 1, liga: 'INT', ronda: k + 1, circuito: CIRCUITOS_POR_ID[c], horarios: Object.fromEntries(SESIONES.map(t => [t, base + OFF[t]])) }));
});
await guardarEventos(store, eventos);

// Dos mánagers humanos
const humanos = [{ uid: 'u_ana', nombre: 'Ana', eq: 'valcor-es' }, { uid: 'u_leo', nombre: 'Leo', eq: 'kessler-de' }];
for (const h of humanos) {
    await store.set(`usuarios/${h.uid}`, { nombre: h.nombre, email: `${h.uid}@x.com`, isAdmin: false, equipoId: h.eq });
    await store.merge(`equipos/${h.eq}`, { ownerId: h.uid, ownerNombre: h.nombre });
    await store.set(`acciones/a_${h.uid}_rec`, { uid: h.uid, equipoId: h.eq, tipo: 'reclamar', params: {}, creado: T0 - 3 * D, estado: 'pendiente' });
}
await store.set('usuarios/u_admin', { nombre: 'Admin', isAdmin: true, equipoId: null });

let n = 0;
const accion = (h, tipo, params, t) => store.set(`acciones/a${n++}`, { uid: h.uid, equipoId: h.eq, tipo, params, creado: t, estado: 'pendiente' });

const FIN = T0 + 8 * 7 * D + 4 * D;
let t = T0 - 3 * D;
let demoGuardado = false;
while (t < FIN) {
    const hora = new Date(t).getUTCHours(), min = new Date(t).getUTCMinutes();
    // Rutina diaria de Ana (muy activa); Leo solo hace check-in
    if (hora === 8 && min === 0) {
        for (const h of humanos) await accion(h, 'checkin', {}, t);
        const priv = await store.get('equipos_priv/valcor-es');
        if (!priv.sponsor) await accion(humanos[0], 'sponsor_firmar', { ofertaId: 'rendimiento' }, t);
        await accion(humanos[0], 'id_iniciar', { area: ['aero', 'motor', 'chasis'][n % 3], urgente: false }, t);
        const prox = eventos.filter(e => e.liga === 'ESP' && e.sesiones.FP.lockAt > t)[0];
        if (prox) for (let i = 0; i < 3; i++) await accion(humanos[0], 'simulador', { eventoId: prox.id, setup: { ala: 3 + i * 2, susp: 5, marchas: 6 } }, t);
        await accion(humanos[0], 'espiar', { tipo: 'coche', objetivo: 'stellari-es' }, t);
        const dec = await store.get(`decisiones/${diaMadrid(t)}_valcor-es`);
        if (dec && !dec.aplicada) await store.update(`decisiones/${dec.id}`, { eleccion: dec.opciones[0].id });
        // estrategia + pronóstico para la próxima carrera
        if (prox) {
            for (const tipo of ['FP', 'Q1', 'R1']) {
                await store.set(`estrategias/${prox.id}_${tipo}_valcor-es`, { eventoId: prox.id, tipo, equipoId: 'valcor-es', uid: 'u_ana', setup: { ala: 6, susp: 5, marchas: 5 }, pilotos: {}, actualizado: t });
            }
        }
    }
    const r = await ejecutarTick(store, { ahora: t, log: () => {} });
    if (r.errores?.length) ok(false, `Errores en tick ${new Date(t).toISOString()}: ${r.errores.join(' | ')}`);
    if (DEMO && !demoGuardado && t >= T0 + 2 * 7 * D + 2 * D + H + 30 * 60_000) {
        const dia = diaMadrid(t);
        await store.set(`paddock/${dia}_u_ana`, { uid: 'u_ana', nombre: 'Ana', equipoId: 'valcor-es', liga: 'ESP', texto: 'Tres carreras sin podio no son casualidad. El coche va, nos falta afinar el reglaje del domingo.', fecha: t - 2 * H, dia });
        await store.set(`paddock/${dia}_u_leo`, { uid: 'u_leo', nombre: 'Leo', equipoId: 'kessler-de', liga: 'GER', texto: 'A los que nos espían: el motor nuevo llega en Hockenheim. Id preparando excusas.', fecha: t - 5 * H, dia });
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
console.log('Mercado:', m.estado, '| despidos', m.plan.despidos.length, '| traspasos', m.plan.traspasos.length, '| rookies elegidos', m.elegidos?.length);
ok(m.estado === 'cerrado', 'El mercado debería estar cerrado');
ok(m.plan.despidos.length >= 10 && m.plan.despidos.length <= 20, `Despidos fuera de rango: ${m.plan.despidos.length}`);
const pilotos = await store.list('pilotos');
for (const liga of LIGAS_NACIONALES) {
    const pl = pilotos.filter(p => p.liga === liga && p.equipoId);
    ok(pl.length === 20, `${liga}: ${pl.length} pilotos tras el mercado`);
    const equipos = [...new Set(pl.map(p => p.equipoId))];
    equipos.forEach(eq => ok(pl.filter(p => p.equipoId === eq).length === 2, `${eq} no tiene 2 pilotos`));
}
const privAna = await store.get('equipos_priv/valcor-es');
const privLeo = await store.get('equipos_priv/kessler-de');
console.log('Ana:', Math.round(privAna.presupuesto / 1e5) / 10, 'M€ coche', privAna.coche, 'inst', privAna.inst, 'racha', privAna.racha, 'sponsor', privAna.sponsor?.marca);
console.log('Leo:', Math.round(privLeo.presupuesto / 1e5) / 10, 'M€ coche', privLeo.coche);
const acciones = await store.list('acciones');
const errs = acciones.filter(a => a.estado === 'error');
console.log('Acciones:', acciones.length, 'errores:', errs.length, [...new Set(errs.map(a => a.tipo + ': ' + a.resultado.error))].slice(0, 6));
ok(acciones.every(a => a.estado !== 'pendiente'), 'Quedan acciones pendientes');
const notifs = await store.list('notificaciones', [['uid', '==', 'u_ana']]);
console.log('Notificaciones Ana:', notifs.length, '| tipos:', [...new Set(notifs.map(x => x.tipo))].join(','));
const decis = await store.list('decisiones');
ok(decis.every(d => d.aplicada), 'Hay decisiones sin aplicar');
console.log('Noticias:', (await store.list('noticias')).length, '| lecturas', store.lecturas, 'escrituras', store.escrituras);

const palm = await nuevaTemporada(store, { ahora: FIN + D });
const cfg2 = await store.get('config/juego');
ok(cfg2.temporada === 2 && cfg2.fase === 'pretemporada', 'Nueva temporada mal iniciada');
console.log('Palmarés T1:', Object.entries(palm.ligas).map(([l, v]) => `${l}: ${nom(v.piloto)}`).join(' · '), '| Mundial:', nom(palm.mundial));

console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\n✅ Temporada completa sin fallos');
process.exit(fallos.length ? 1 : 0);
