// Mercado de fin de temporada: ventana de 3 días tras el Mundial.
//
// · Despidos: se aplican al abrir. La escudería con vacante puede fichar a un piloto de otra (pagando o si se lo
//   dan); si no lo consigue, al cerrar se le asigna un rookie del draft.
// · Galácticos: uno por liga. Su escudería puede aceptar una oferta de otra escudería (cobra la oferta y recibe al
//   segundo piloto del comprador) o dejar que decida la liga (solo cobra la compensación de la liga).
//   La liga resuelve al cerrar: primero ofertas, luego solicitudes de traspaso y luego la IA. Muy de vez en cuando
//   se lo da a una escudería al azar, que paga un precio simbólico si no lo había pedido.
// · Fichas de fichaje: las escuderías sin movimientos previstos pueden pedir una ficha y hacer trueques entre ellas.
// · Todo respeta la regla del 55% de pilotos locales.
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { atributosAleatorios, salarioPiloto } from '../engine/juego.js';
import { MERCADO, planDespidos, elegirGalacticos, tacticoDe, cuotaTrasCambios, valorPiloto, generarRookies, estrellasRookie, asignarRoles } from '../engine/mercado.js';
import { nombreAleatorio, EXTRANJEROS } from '../engine/nombres.js';
import { cargarEquipos, cargarPrivs, cargarPilotos, cargarPilotosPriv, noticia, notificar, nombrePiloto, movimiento, duenoReal, volcar } from './comun.js';
import { asegurarPool, elegirRetiros, esLibre } from './pilotos.js';
import { estrellasPiloto, precioLibre } from '../engine/pool.js';
import { descompactar, construirTemporada } from '../engine/stats.js';

const M = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M€`;
export const refMercado = (temporada) => `mercado/T${temporada}`;

// ---------- utilidades ----------
const activos = (pil) => Object.values(pil).filter(p => p.equipoId);
const deEquipo = (pil, eq) => activos(pil).filter(p => p.equipoId === eq);
const vacantesDe = (pil, eq) => Math.max(0, 2 - deEquipo(pil, eq).length);

// Mientras se juega el Mundial los cambios se apuntan (ctx.diferir) y se aplican al terminar,
// para no mover a nadie que esté corriendo. pil es entonces una copia con los cambios ya hechos.
function mover(ctx, pil, pp, pid, eq, { estado } = {}) {
    const p = pil[pid];
    p.equipoId = eq; p.liga = eq ? ctx.equipos[eq]?.liga : null;
    p.estado = estado || (eq ? 'activo' : 'libre'); p.rol = null;
    // al salir de una escudería se recalculan su valoración y su precio como agente libre
    if (!eq) { p.valoracion = null; p.precio = null; } else { p.agente = false; }
    if (ctx.diferir) { ctx.diferir.push({ pid, eq, ...(estado ? { estado } : {}) }); return; }
    ctx.sucios.pilotos.add(pid);
    if (pp[pid]) { pp[pid].equipoId = eq; ctx.sucios.pilotosPriv.add(pid); }
    ctx.catalogoSucio = true;
}

function registrar(m, ctx, texto, extra = {}) {
    m.movimientos = [{ t: ctx.ahora, texto, ...extra }, ...(m.movimientos || [])].slice(0, 120);
}

// Posición final de cada escudería y piloto en su liga (para valorar y para el top 3)
function posiciones(tablas) {
    const eq = {}, pil = {};
    for (const liga of LIGAS_NACIONALES) {
        tablas[liga]?.clasEquipos.forEach((e, i) => { eq[e.eq] = i + 1; });
        tablas[liga]?.clasPilotos.forEach((p, i) => { pil[p.pid] = i + 1; });
    }
    return { eq, pil };
}

// ======================================================================
// Abrir
// ======================================================================
export async function abrirMercado(ctx, { tablas, deadline }) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    const equipos = await cargarEquipos(ctx);
    await asegurarPool(ctx);
    const pil = parrilla(ctx, await cargarPilotos(ctx), {});
    const pendientes = ctx.diferir || [];
    const privs = await cargarPrivs(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pil));
    const rng = crearRng(`${ctx.secreto}|mercado|${temporada}`);
    const inmunes = new Set(ctx.cfg.mundial?.participantes || []);
    const { eq: posEq, pil: posPil } = posiciones(tablas);
    const nombre = (pid) => nombrePiloto(pil[pid]);

    // 1. Despidos (se aplican ya: la escudería tiene 3 días para buscar sustituto)
    const { despidos, salvados } = planDespidos({ tablas, pilotos: activos(pil), inmunes });
    // 1b. Retiradas: los veteranos pueden colgar el casco (dejan vacante igual que un despido)
    const retiros = elegirRetiros(ctx, activos(pil).filter(p => !despidos.some(d => d.pid === p.id)), pp, crearRng(`${ctx.secreto}|retiros|${temporada}`));
    const despedidos = new Set([...despidos.map(d => d.pid), ...retiros.map(r => r.pid)]);

    // 2. Galácticos: uno por liga. Las ofertas hechas durante la temporada cuentan.
    const docOfertas = await store.get(`mercado_ofertas/T${temporada}`);
    // Las ofertas hechas durante la temporada solo cuentan si al final se cumplen las condiciones
    // (estar entre las 3 mejores de tu liga al terminar y tener el dinero); si no, se anulan y se avisa.
    const motivoInvalida = (o) => !o.pid ? 'oferta incompleta'
        : (posEq[o.eq] || 99) > MERCADO.topComprador ? `tu escudería ha terminado ${posEq[o.eq] ? `${posEq[o.eq]}ª` : 'fuera del top'} de su liga y solo pueden fichar Galácticos las ${MERCADO.topComprador} primeras`
        : (privs[o.eq]?.presupuesto || 0) < o.importe ? 'ya no tienes el dinero que ofreciste'
        : equipos[o.eq]?.liga === pil[o.pid]?.liga ? 'el piloto ya es de tu liga' : null;
    const todasPrevias = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o }));
    for (const o of todasPrevias) {
        const mot = motivoInvalida(o);
        if (mot) notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `Tu oferta por ${nombre(o.pid)} no es válida`, texto: `Se anula porque ${mot}. No se te cobra nada.` });
    }
    const previas = todasPrevias.filter(o => !motivoInvalida(o));
    const elegidos = elegirGalacticos({ tablas, pilotos: activos(pil), ofertas: previas, rng, despedidos });
    const galacticos = elegidos.map(g => ({ ...g, nombre: nombre(g.pid), estado: 'pendiente', decision: duenoReal(ctx, g.eq) ? null : 'liga' }));
    const pidsG = new Set(galacticos.map(g => g.pid));
    const ofertas = previas.filter(o => pidsG.has(o.pid)).map((o, i) => ({ id: `o${i}`, pid: o.pid, eq: o.eq, importe: o.importe, estado: 'pendiente', fecha: o.fecha || ctx.ahora }));
    for (const o of previas.filter(o => !pidsG.has(o.pid))) notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${nombre(o.pid)} no sale al mercado`, texto: `No es el Galáctico de ${LIGAS[pil[o.pid]?.liga]?.nombre || 'su liga'}, así que tu oferta queda anulada. Puedes pujar por otro Galáctico en el mercado.` });

    for (const d of despidos) mover(ctx, pil, pp, d.pid, null);
    for (const r of retiros) mover(ctx, pil, pp, r.pid, null, { estado: 'retirado' });

    // 3. La IA pide alguna ficha de fichaje para que haya con quién hacer trueques
    const ocupados = new Set([...despidos.map(d => d.eq), ...retiros.map(r => r.eq), ...galacticos.map(g => g.eq)]);
    const fichas = {};
    for (const [id] of Object.entries(equipos)) if (!duenoReal(ctx, id) && !ocupados.has(id) && deEquipo(pil, id).length === 2 && rng.chance(0.3)) fichas[id] = ctx.ahora;

    const vacantesLiga = {};
    despidos.forEach(d => { vacantesLiga[d.liga] = (vacantesLiga[d.liga] || 0) + 1; });
    const usados = new Set(Object.values(pil).map(p => `${p.nombre} ${p.apellido}`));
    const rookies = generarRookies({ temporada, vacantes: [...despidos, ...retiros].map(d => ({ liga: d.liga })), rng, usados });
    deadline ||= ctx.ahora + MERCADO.diasVentana * 864e5;
    ctx.diferir = null;
    const conNombre = (x) => ({ ...x, nombre: nombre(x.pid) });
    const m = {
        temporada, estado: 'abierto', abierto: ctx.ahora, deadline, pendientes,
        plan: { despidos: despidos.map(conNombre), salvados: salvados.map(conNombre), retiros: retiros.map(conNombre) },
        galacticos, ofertas, solicitudes: {}, fichajes: [], fichas, trueques: [], movimientos: [],
        rookies: rookies.map(r => ({ id: r.id, nombre: r.nombre, apellido: r.apellido, nac: r.nac, liga: r.liga, edad: r.edad, estrellas: estrellasRookie(r.attrs, rng) })),
        preferencias: {}, posiciones: { equipos: posEq, pilotos: posPil }, v: 2,
    };
    registrar(m, ctx, `Se abre el mercado: ${despidos.length} despidos, ${retiros.length} retiradas y ${galacticos.length} candidatos a Galáctico (solo se va uno por liga).`);
    await store.set(refMercado(temporada), m);
    await store.set(`mercado_priv/T${temporada}`, { rookies: Object.fromEntries(rookies.map(r => [r.id, r.attrs])) });

    // 4. Avisos
    const fin = new Date(deadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (const g of galacticos) {
        const deLiga = LIGAS[g.liga].nombre;
        const otros = galacticos.filter(x => x.liga === g.liga && x !== g).map(x => x.nombre);
        notificar(ctx, g.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `${g.nombre}, candidato a Galáctico de ${deLiga}`, texto: `De los candidatos de ${deLiga}${otros.length ? ` (con ${otros.join(' y ')})` : ''} solo se irá uno a otra liga. Si llega una oferta por él puedes aceptarla (cobras la oferta y recibes a su segundo piloto) o dejar que decida la liga al cerrar (cobras ${M(MERCADO.compensacionLiga)}). Si se va otro candidato antes, el tuyo se queda. Tienes hasta el ${fin}.` });
    }
    for (const liga of LIGAS_NACIONALES) {
        const gs = galacticos.filter(g => g.liga === liga);
        if (!gs.length) continue;
        noticia(ctx, { titulo: `${LIGAS[liga].nombre}: ${gs.length > 1 ? `${gs.length} candidatos a Galáctico` : `${gs[0].nombre}, Galáctico`}`, texto: `${gs.map(g => `${g.nombre} (${g.pos}º)`).join(', ')}. Solo uno cambiará de liga: el primero por el que se cierre un acuerdo o el que decida la liga al cerrar, el ${fin}.`, liga, tipo: 'mercado' });
    }
    for (const r of retiros) {
        noticia(ctx, { titulo: `${nombre(r.pid)} anuncia su retirada`, texto: `Con ${r.edad} años, cuelga el casco al final de la temporada. ${equipos[r.eq]?.nombre} tendrá que buscar sustituto.`, liga: r.liga, tipo: 'mercado' });
        notificar(ctx, r.eq, { remitente: 'Dirección deportiva', tipo: 'mercado', titulo: `${nombre(r.pid)} se retira`, texto: `Tienes una vacante. Hasta el ${fin} puedes fichar a un agente libre o a un piloto de otra escudería desde Mercado. Si no, se te asignará un rookie.` });
    }
    for (const d of despidos) {
        noticia(ctx, { titulo: `${nombre(d.pid)} se queda sin asiento`, texto: d.motivo === 'directo' ? `Terminó ${d.pos}º con su compañero ${d.posComp}º: es de los que peor rindieron con el mismo coche.` : `Estaba en la zona de peligro y su compañero acabó ${d.posComp}º.`, liga: d.liga, tipo: 'mercado' });
        notificar(ctx, d.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: 'Tienes una vacante', texto: `${nombre(d.pid)} deja el equipo. Hasta el ${fin} puedes fichar a un piloto de otra escudería desde Mercado. Si no, se te asignará un rookie (ordena tus favoritos del draft).` });
    }
    for (const s of salvados) noticia(ctx, { titulo: `${nombre(s.pid)} salva su asiento`, texto: `Acabó ${s.pos}º, pero su compañero terminó ${s.posComp}º: se asume que el coche no daba para más.`, liga: s.liga, tipo: 'mercado' });
    for (const [id, e] of Object.entries(equipos)) {
        if (!duenoReal(ctx, id)) continue;
        if ((posEq[id] || 99) <= MERCADO.topComprador && !galacticos.some(g => g.eq === id))
            notificar(ctx, id, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Puedes fichar un Galáctico', texto: `Has acabado entre las 3 mejores de ${LIGAS[e.liga].nombre}. Hasta el ${fin} puedes pujar por un Galáctico de otra liga o pedir un traspaso a la liga indicando cuánto pagarías.` });
        else if (!ocupados.has(id))
            notificar(ctx, id, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Mercado abierto', texto: `Tu alineación no tiene movimientos previstos. Si quieres cambiar un piloto, pide una ficha de fichaje en Mercado y haz un trueque con otra escudería que también la tenga (hasta el ${fin}).` });
    }
    noticia(ctx, { titulo: 'Se abre el mercado de fin de temporada', texto: `Se abre con el Mundial y los cambios se aplican cuando termine. En juego: un Galáctico por liga (entre ${galacticos.length} candidatos), ${despidos.length + retiros.length} vacantes, agentes libres y trueques entre escuderías. Cierra el ${fin}.`, tipo: 'fase' });
    ctx.nota(`Mercado abierto: ${galacticos.map(g => g.nombre).join(', ')}`);
    return m;
}

// ======================================================================
// Acciones de los mánagers durante la ventana
// ======================================================================
export const mundialEnJuego = (ctx) => ctx.cfg.fase === 'mundial';
// Parrilla tal y como quedará: la real, o (durante el Mundial) una copia con los cambios pendientes aplicados
function parrilla(ctx, real, m) {
    ctx.diferir = null;
    if (!mundialEnJuego(ctx)) return real;
    const pil = structuredClone(real);
    for (const c of m.pendientes || []) if (pil[c.pid]) { pil[c.pid].equipoId = c.eq; pil[c.pid].liga = c.eq ? ctx.equipos[c.eq]?.liga : null; }
    ctx.diferir = (m.pendientes ||= []);
    return pil;
}
async function cargar(ctx) {
    const m = await ctx.store.get(refMercado(ctx.cfg.temporada));
    if (!['mundial', 'mercado'].includes(ctx.cfg.fase) || !m || m.estado !== 'abierto') throw new Error('El mercado no está abierto.');
    if (m.deadline <= ctx.ahora) throw new Error('El mercado ya ha cerrado.');
    const real = await cargarPilotos(ctx);
    await cargarEquipos(ctx); await cargarPrivs(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(real));
    return { m, pil: parrilla(ctx, real, m), pp };
}

// Al terminar el Mundial: se aplican los cambios que se acordaron mientras se jugaba
export async function aplicarPendientes(ctx) {
    const m = await ctx.store.get(refMercado(ctx.cfg.temporada));
    if (!m?.pendientes?.length) return 0;
    const pil = await cargarPilotos(ctx);
    await cargarEquipos(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pil));
    ctx.diferir = null;
    for (const c of m.pendientes) if (pil[c.pid]) mover(ctx, pil, pp, c.pid, c.eq, { estado: c.estado });
    const n = m.pendientes.length;
    await ctx.store.merge(refMercado(ctx.cfg.temporada), { pendientes: [] });
    ctx.nota(`Mercado: aplicados ${n} cambios acordados durante el Mundial`);
    return n;
}
const guardar = (ctx, m) => ctx.store.set(refMercado(ctx.cfg.temporada), m);
const priv = (ctx, eq) => { const p = ctx.privs[eq]; if (!p) throw new Error('Escudería sin datos'); ctx.sucios.privs.add(eq); return p; };
const esTop = (m, eq) => (m.posiciones?.equipos?.[eq] || 99) <= MERCADO.topComprador;
const recibeGalactico = (m, eq) => m.galacticos.some(g => g.destino?.eq === eq);

// Un Galáctico pendiente no puede entrar en ninguna otra operación (ni como segundo piloto de nadie)
const galacticoPendiente = (m, pid) => (m.galacticos || []).some(g => g.pid === pid && g.estado === 'pendiente');
// Si el único piloto que puede entregar es a su vez candidato a Galáctico, se entrega igualmente (deja de ser candidato)
const recienLlegado = (m, pid) => (m.galacticos || []).some(g => g.pid === pid && g.estado === 'vendido');
const tacticoSeguro = (m, pil, eq, liga, excluir = null) => tacticoDe(activos(pil).filter(p => !galacticoPendiente(m, p.id) && !recienLlegado(m, p.id)), eq, liga)
    || tacticoDe(activos(pil).filter(p => p.id !== excluir && !recienLlegado(m, p.id)), eq, liga);
function retirarCandidato(ctx, m, pid, motivo) {
    const c = (m.galacticos || []).find(x => x.pid === pid && x.estado === 'pendiente');
    if (!c) return;
    c.estado = 'se_queda'; c.motivo = motivo;
    for (const o of m.ofertas || []) if (o.estado === 'pendiente' && o.pid === pid) { o.estado = 'anulada'; notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${c.nombre} ya no es candidato`, texto: `${motivo}. Tu oferta queda anulada sin coste.` }); }
}

function comprobarCuota(ctx, pil, cambios) {
    const r = cuotaTrasCambios(activos(pil), ctx.equipos, cambios);
    if (!r.ok) throw new Error(r.motivo);
}

// Intercambio Galáctico ↔ segundo piloto del comprador y dinero
function ejecutarGalactico(ctx, m, pil, pp, g, { eq, importe, via, cobra }) {
    const liga = ctx.equipos[eq].liga;
    const t = tacticoSeguro(m, pil, eq, liga, g.pid);
    // El comprador siempre entrega a su segundo piloto (si no, se quedaría con tres)
    if (!t && deEquipo(pil, eq).length >= 2) return { ok: false, motivo: 'No tiene un segundo piloto que entregar.' };
    const cambios = [{ pid: g.pid, eq }, ...(t ? [{ pid: t.id, eq: g.eq }] : [])];
    const r = cuotaTrasCambios(activos(pil), ctx.equipos, cambios);
    if (!r.ok) return r;
    if (ctx.privs[eq]) movimiento(priv(ctx, eq), `Fichaje del Galáctico ${g.nombre}`, -importe, ctx.ahora);
    if (ctx.privs[g.eq]) movimiento(priv(ctx, g.eq), via === 'aceptada' ? `Venta de ${g.nombre} (Galáctico)` : `Compensación de la liga por ${g.nombre}`, cobra, ctx.ahora);
    if (t) retirarCandidato(ctx, m, t.id, `${nombrePiloto(t)} se va a ${ctx.equipos[g.eq].nombre} como parte del traspaso de ${g.nombre}`);
    mover(ctx, pil, pp, g.pid, eq);
    if (t) mover(ctx, pil, pp, t.id, g.eq);
    g.estado = 'vendido';
    g.destino = { eq, tactico: t?.id || null, nombreTactico: t ? nombrePiloto(t) : null, importe, cobra, via };
    const eqN = ctx.equipos[eq].nombre, venN = ctx.equipos[g.eq].nombre;
    const como = { aceptada: 'acepta la oferta de', oferta: 'la liga lo cierra con', solicitud: 'la liga atiende la solicitud de', ia: 'la liga lo cierra con', suerte: '¡sorpresa! La liga se lo da a' }[via];
    registrar(m, ctx, `${g.nombre} (${LIGAS[g.liga].nombre}) → ${eqN} por ${M(importe)}${t ? ` + ${nombrePiloto(t)}` : ''}.`, { tipo: 'galactico', pid: g.pid, eq, via });
    noticia(ctx, { titulo: `${g.nombre} ficha por ${eqN}`, texto: `${venN} ${como} ${eqN}. El Galáctico de ${LIGAS[g.liga].nombre} se va a ${LIGAS[liga].nombre}${t ? ` y ${nombrePiloto(t)} hace el camino contrario` : ''}. ${via === 'suerte' && importe === MERCADO.precioSimbolico ? `${eqN} no lo había pedido y paga solo ${M(importe)}.` : `Operación de ${M(importe)}.`}`, liga: g.liga, tipo: 'mercado' });
    notificar(ctx, eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `¡${g.nombre} es tuyo!`, texto: `Llega el Galáctico de ${LIGAS[g.liga].nombre}. Pagas ${M(importe)}${t ? ` y ${nombrePiloto(t)} se va a ${venN}` : ''}.` });
    notificar(ctx, g.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${g.nombre} se va a ${eqN}`, texto: `Cobras ${M(cobra)}${t ? ` y llega ${nombrePiloto(t)}` : ''}.` });
    // Las demás ofertas por él o de ese comprador caducan
    for (const o of m.ofertas) if (o.estado === 'pendiente' && (o.pid === g.pid || o.eq === eq)) o.estado = o.pid === g.pid && o.eq === eq && via === 'aceptada' ? 'aceptada' : 'anulada';
    // De cada liga solo se va uno: los demás candidatos se quedan y sus ofertas se anulan
    for (const otro of m.galacticos) {
        if (otro === g || otro.liga !== g.liga || otro.estado !== 'pendiente') continue;
        otro.estado = 'se_queda'; otro.motivo = `ya se fue ${g.nombre}`;
        for (const o of m.ofertas) if (o.estado === 'pendiente' && o.pid === otro.pid) { o.estado = 'anulada'; notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${otro.nombre} ya no sale`, texto: `${g.nombre} es el Galáctico de ${LIGAS[g.liga].nombre} que cambia de liga, así que tu oferta queda anulada sin coste.` }); }
        notificar(ctx, otro.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${otro.nombre} se queda`, texto: `${g.nombre} es el que se va de ${LIGAS[g.liga].nombre}. Tu piloto sigue en tu escudería.` });
    }
    delete m.solicitudes[eq];
    return { ok: true };
}

// Venta de un piloto a una escudería con vacante
function ejecutarFichaje(ctx, m, pil, pp, f) {
    const p = pil[f.pid];
    const vendedor = p.equipoId;
    if (ctx.privs[f.eq]) movimiento(priv(ctx, f.eq), `Fichaje de ${nombrePiloto(p)}`, -f.importe, ctx.ahora);
    if (ctx.privs[vendedor]) movimiento(priv(ctx, vendedor), `Venta de ${nombrePiloto(p)}`, f.importe, ctx.ahora);
    mover(ctx, pil, pp, f.pid, f.eq);
    f.estado = 'aceptada';
    const compN = ctx.equipos[f.eq].nombre, venN = ctx.equipos[vendedor].nombre;
    registrar(m, ctx, `${nombrePiloto(p)}: ${venN} → ${compN} por ${M(f.importe)}.`, { tipo: 'fichaje', pid: f.pid, eq: f.eq });
    noticia(ctx, { titulo: `${compN} ficha a ${nombrePiloto(p)}`, texto: `${venN} lo vende por ${M(f.importe)} y ahora tendrá que buscar sustituto.`, liga: ctx.equipos[f.eq].liga, tipo: 'mercado' });
    notificar(ctx, f.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${nombrePiloto(p)} ficha por tu escudería`, texto: `Pagas ${M(f.importe)}. Vacante cubierta.` });
    notificar(ctx, vendedor, { remitente: 'Mercado', tipo: 'mercado', titulo: `Vendes a ${nombrePiloto(p)}`, texto: `Cobras ${M(f.importe)}. Ahora tienes una vacante: ficha a otro piloto o se te asignará un rookie al cerrar el mercado.` });
    for (const o of m.fichajes) if (o !== f && o.estado === 'pendiente' && (o.pid === f.pid || (o.eq === f.eq && vacantesDe(pil, f.eq) === 0))) o.estado = 'anulada';
}

function ejecutarTrueque(ctx, m, pil, pp, tr) {
    const a = pil[tr.da], b = pil[tr.recibe];
    mover(ctx, pil, pp, tr.da, tr.conEq);
    mover(ctx, pil, pp, tr.recibe, tr.eq);
    tr.estado = 'aceptada';
    delete m.fichas[tr.eq]; delete m.fichas[tr.conEq];
    for (const o of m.trueques) if (o !== tr && o.estado === 'pendiente' && [o.eq, o.conEq].some(x => x === tr.eq || x === tr.conEq)) o.estado = 'anulada';
    const n1 = ctx.equipos[tr.eq].nombre, n2 = ctx.equipos[tr.conEq].nombre;
    registrar(m, ctx, `Trueque: ${nombrePiloto(a)} (${n1}) ↔ ${nombrePiloto(b)} (${n2}).`, { tipo: 'trueque' });
    noticia(ctx, { titulo: `Trueque entre ${n1} y ${n2}`, texto: `${nombrePiloto(a)} se va a ${n2} y ${nombrePiloto(b)} a ${n1}.`, liga: ctx.equipos[tr.eq].liga, tipo: 'mercado' });
    notificar(ctx, tr.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Trueque cerrado', texto: `${nombrePiloto(b)} llega a cambio de ${nombrePiloto(a)}.` });
    notificar(ctx, tr.conEq, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Trueque cerrado', texto: `${nombrePiloto(a)} llega a cambio de ${nombrePiloto(b)}.` });
}

export const ACCIONES_MERCADO = {
    // Oferta por el Galáctico de otra liga (en la ventana): {pid, importe} o {cancelar: ofertaId}
    async mercado_galactico(ctx, a) {
        const { m, pil } = await cargar(ctx);
        const eq = a.equipoId;
        if (a.params?.cancelar) {
            const o = m.ofertas.find(x => x.id === a.params.cancelar && x.eq === eq && x.estado === 'pendiente');
            if (!o) throw new Error('Oferta no encontrada.');
            o.estado = 'anulada'; await guardar(ctx, m); return { ok: true };
        }
        const g = m.galacticos.find(x => x.pid === a.params?.pid && x.estado === 'pendiente');
        if (!g) throw new Error('Ese piloto no es un Galáctico disponible.');
        if (!esTop(m, eq)) throw new Error('Solo las 3 mejores escuderías de cada liga pueden fichar un Galáctico.');
        if (ctx.equipos[eq].liga === g.liga) throw new Error('El Galáctico tiene que ser de otra liga.');
        if (recibeGalactico(m, eq)) throw new Error('Ya has fichado un Galáctico.');
        const importe = Math.round(+a.params?.importe || 0);
        if (importe < MERCADO.importeMinimo) throw new Error(`La oferta mínima es de ${M(MERCADO.importeMinimo)}.`);
        if ((priv(ctx, eq).presupuesto || 0) < importe) throw new Error('No tienes ese dinero.');
        const t = tacticoSeguro(m, pil, eq, ctx.equipos[eq].liga, g.pid);
        if (!t) throw new Error('No tienes un segundo piloto que dar a cambio.');
        comprobarCuota(ctx, pil, [{ pid: g.pid, eq }, ...(t ? [{ pid: t.id, eq: g.eq }] : [])]);
        m.ofertas.forEach(o => { if (o.eq === eq && o.pid === g.pid && o.estado === 'pendiente') o.estado = 'anulada'; });
        m.ofertas.push({ id: `o${m.ofertas.length}_${ctx.ahora % 1e6}`, pid: g.pid, eq, importe, estado: 'pendiente', fecha: ctx.ahora });
        await guardar(ctx, m);
        notificar(ctx, g.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `Oferta por ${g.nombre}`, texto: `${ctx.equipos[eq].nombre} ofrece ${M(importe)}${t ? ` y a ${nombrePiloto(t)}` : ''}. Acéptala en Mercado o deja que decida la liga.` });
        if (ctx.equipos[eq].ownerId) noticia(ctx, { titulo: `${ctx.equipos[eq].nombre} puja por ${g.nombre}`, texto: `Ofrece ${M(importe)} por el Galáctico de ${LIGAS[g.liga].nombre}.`, liga: g.liga, tipo: 'rumor' });
        return { ok: true };
    },

    // Solicitud de traspaso a la liga: {importe} o {cancelar: true}
    async mercado_solicitud(ctx, a) {
        const { m } = await cargar(ctx);
        const eq = a.equipoId;
        if (a.params?.cancelar) { delete m.solicitudes[eq]; await guardar(ctx, m); return { ok: true }; }
        if (!esTop(m, eq)) throw new Error('Solo las 3 mejores escuderías de cada liga pueden pedir un Galáctico.');
        if (recibeGalactico(m, eq)) throw new Error('Ya has fichado un Galáctico.');
        const importe = Math.round(+a.params?.importe || 0);
        if (importe < MERCADO.importeMinimo) throw new Error(`Lo mínimo son ${M(MERCADO.importeMinimo)}.`);
        if ((priv(ctx, eq).presupuesto || 0) < importe) throw new Error('No tienes ese dinero.');
        m.solicitudes[eq] = { importe, fecha: ctx.ahora };
        await guardar(ctx, m);
        return { ok: true };
    },

    // La escudería del Galáctico acepta una oferta: {ofertaId}
    async mercado_aceptar(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const o = m.ofertas.find(x => x.id === a.params?.ofertaId && x.estado === 'pendiente');
        const g = o && m.galacticos.find(x => x.pid === o.pid && x.estado === 'pendiente');
        if (!g || g.eq !== a.equipoId) throw new Error('Oferta no disponible.');
        if (recibeGalactico(m, o.eq)) throw new Error('Esa escudería ya ha fichado otro Galáctico.');
        if ((ctx.privs[o.eq]?.presupuesto || 0) < o.importe) throw new Error('Esa escudería ya no tiene el dinero.');
        const r = ejecutarGalactico(ctx, m, pil, pp, g, { eq: o.eq, importe: o.importe, cobra: o.importe, via: 'aceptada' });
        if (!r.ok) throw new Error(r.motivo);
        o.estado = 'aceptada';
        await guardar(ctx, m);
        return { ok: true };
    },

    // La escudería del Galáctico deja que decida la liga (o se lo vuelve a pensar): {liga: true|false}
    async mercado_liga(ctx, a) {
        const { m } = await cargar(ctx);
        const g = m.galacticos.find(x => x.eq === a.equipoId && x.estado === 'pendiente');
        if (!g) throw new Error('No tienes ningún Galáctico en venta.');
        g.decision = a.params?.liga === false ? null : 'liga';
        await guardar(ctx, m);
        return { ok: true };
    },

    // Oferta por un piloto de otra escudería para cubrir una vacante: {pid, importe} o {cancelar: id}
    async mercado_fichaje(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const eq = a.equipoId;
        if (a.params?.cancelar) {
            const f = m.fichajes.find(x => x.id === a.params.cancelar && x.eq === eq && x.estado === 'pendiente');
            if (!f) throw new Error('Oferta no encontrada.');
            f.estado = 'anulada'; await guardar(ctx, m); return { ok: true };
        }
        if (!vacantesDe(pil, eq)) throw new Error('No tienes ninguna vacante.');
        const p = pil[a.params?.pid];
        if (!p?.equipoId || p.equipoId === eq) throw new Error('Piloto no disponible.');
        if (m.galacticos.some(g => g.pid === p.id && g.estado === 'pendiente')) throw new Error('Es un Galáctico: solo se puede fichar con una oferta de Galáctico.');
        const importe = Math.round(+a.params?.importe || 0);
        if (importe < MERCADO.fichajeMinimo) throw new Error(`La oferta mínima es de ${M(MERCADO.fichajeMinimo)}.`);
        if ((priv(ctx, eq).presupuesto || 0) < importe) throw new Error('No tienes ese dinero.');
        comprobarCuota(ctx, pil, [{ pid: p.id, eq }]);
        const f = { id: `f${m.fichajes.length}_${ctx.ahora % 1e6}`, eq, pid: p.id, nombre: nombrePiloto(p), eqVendedor: p.equipoId, importe, estado: 'pendiente', fecha: ctx.ahora };
        m.fichajes.push(f);
        if (!duenoReal(ctx, p.equipoId)) {
            // La IA vende si le pagan lo que vale (y no se queda sin piloto local)
            const valor = valorPiloto(m.posiciones?.pilotos?.[p.id]);
            if (importe >= valor) ejecutarFichaje(ctx, m, pil, pp, f);
            else { f.estado = 'rechazada'; f.motivo = `La IA pide al menos ${M(valor)}.`; }
        } else notificar(ctx, p.equipoId, { remitente: 'Mercado', tipo: 'mercado', titulo: `Oferta por ${nombrePiloto(p)}`, texto: `${ctx.equipos[eq].nombre} ofrece ${M(importe)}. Si aceptas, tendrás una vacante que cubrir. Respóndela en Mercado.` });
        await guardar(ctx, m);
        return { ok: true, estado: f.estado, motivo: f.motivo || null };
    },

    // Responder a una oferta por uno de tus pilotos: {id, acepta}
    async mercado_fichaje_responder(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const f = m.fichajes.find(x => x.id === a.params?.id && x.estado === 'pendiente');
        if (!f || pil[f.pid]?.equipoId !== a.equipoId) throw new Error('Oferta no disponible.');
        if (!a.params?.acepta) { f.estado = 'rechazada'; notificar(ctx, f.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `Rechazan tu oferta por ${f.nombre}`, texto: 'Busca otra opción o se te asignará un rookie al cerrar el mercado.' }); await guardar(ctx, m); return { ok: true }; }
        if (!vacantesDe(pil, f.eq)) throw new Error('Esa escudería ya ha cubierto su vacante.');
        if ((ctx.privs[f.eq]?.presupuesto || 0) < f.importe) throw new Error('Esa escudería ya no tiene el dinero.');
        comprobarCuota(ctx, pil, [{ pid: f.pid, eq: f.eq }]);
        ejecutarFichaje(ctx, m, pil, pp, f);
        await guardar(ctx, m);
        return { ok: true };
    },

    // Pedir una ficha de fichaje (solo si tu alineación no tiene movimientos previstos)
    async mercado_ficha(ctx, a) {
        const { m, pil } = await cargar(ctx);
        const eq = a.equipoId;
        if (m.fichas[eq]) throw new Error('Ya tienes ficha.');
        if (m.galacticos.some(g => g.eq === eq && g.estado === 'pendiente')) throw new Error('Tu Galáctico está en el mercado: resuelve eso primero.');
        if (vacantesDe(pil, eq)) throw new Error('Tienes una vacante: ficha a un piloto para cubrirla.');
        m.fichas[eq] = ctx.ahora;
        await guardar(ctx, m);
        return { ok: true };
    },

    // Proponer un trueque a otra escudería con ficha: {conEq, da, recibe}
    async mercado_trueque(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const eq = a.equipoId, conEq = a.params?.conEq;
        if (!m.fichas[eq]) throw new Error('Necesitas una ficha de fichaje.');
        if (!m.fichas[conEq] || conEq === eq) throw new Error('Esa escudería no tiene ficha de fichaje.');
        const da = pil[a.params?.da], recibe = pil[a.params?.recibe];
        if (da?.equipoId !== eq || recibe?.equipoId !== conEq) throw new Error('Pilotos no válidos.');
        if (galacticoPendiente(m, da.id) || galacticoPendiente(m, recibe.id)) throw new Error('Un Galáctico en venta no puede entrar en un trueque.');
        comprobarCuota(ctx, pil, [{ pid: da.id, eq: conEq }, { pid: recibe.id, eq }]);
        const tr = { id: `t${m.trueques.length}_${ctx.ahora % 1e6}`, eq, conEq, da: da.id, recibe: recibe.id, nombreDa: nombrePiloto(da), nombreRecibe: nombrePiloto(recibe), estado: 'pendiente', fecha: ctx.ahora };
        m.trueques.push(tr);
        if (!duenoReal(ctx, conEq)) {
            // La IA acepta si no sale perdiendo
            const pos = m.posiciones?.pilotos || {};
            if (valorPiloto(pos[da.id]) >= valorPiloto(pos[recibe.id]) * 0.95) ejecutarTrueque(ctx, m, pil, pp, tr);
            else { tr.estado = 'rechazada'; tr.motivo = 'La IA cree que sale perdiendo.'; }
        } else notificar(ctx, conEq, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Propuesta de trueque', texto: `${ctx.equipos[eq].nombre} te ofrece a ${tr.nombreDa} a cambio de ${tr.nombreRecibe}. Respóndela en Mercado.` });
        await guardar(ctx, m);
        return { ok: true, estado: tr.estado, motivo: tr.motivo || null };
    },

    async mercado_trueque_responder(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const tr = m.trueques.find(x => x.id === a.params?.id && x.estado === 'pendiente' && x.conEq === a.equipoId);
        if (!tr) throw new Error('Propuesta no disponible.');
        if (!a.params?.acepta) { tr.estado = 'rechazada'; notificar(ctx, tr.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: 'Trueque rechazado', texto: `${ctx.equipos[tr.conEq].nombre} no quiere cambiar a ${tr.nombreRecibe}.` }); await guardar(ctx, m); return { ok: true }; }
        if (pil[tr.da]?.equipoId !== tr.eq || pil[tr.recibe]?.equipoId !== tr.conEq) throw new Error('Los pilotos ya no están en sus equipos.');
        comprobarCuota(ctx, pil, [{ pid: tr.da, eq: tr.conEq }, { pid: tr.recibe, eq: tr.eq }]);
        ejecutarTrueque(ctx, m, pil, pp, tr);
        await guardar(ctx, m);
        return { ok: true };
    },

    // Fichar a un agente libre para cubrir una vacante: {pid}
    async mercado_libre(ctx, a) {
        const { m, pil, pp } = await cargar(ctx);
        const eq = a.equipoId;
        if (!vacantesDe(pil, eq)) throw new Error('No tienes ninguna vacante.');
        const p = pil[a.params?.pid];
        if (!esLibre(p)) throw new Error('Ese piloto ya no está libre.');
        const precio = p.precio ?? precioLibre(pp[p.id]?.attrs);
        if ((priv(ctx, eq).presupuesto || 0) < precio) throw new Error(`Necesitas ${M(precio)}.`);
        comprobarCuota(ctx, pil, [{ pid: p.id, eq }]);
        movimiento(priv(ctx, eq), `Fichaje de ${nombrePiloto(p)} (agente libre)`, -precio, ctx.ahora);
        mover(ctx, pil, pp, p.id, eq);
        registrar(m, ctx, `${ctx.equipos[eq].nombre} ficha al agente libre ${nombrePiloto(p)} por ${M(precio)}.`, { tipo: 'libre', pid: p.id, eq });
        noticia(ctx, { titulo: `${ctx.equipos[eq].nombre} ficha a ${nombrePiloto(p)}`, texto: `Llega como agente libre (${M(precio)}).`, liga: ctx.equipos[eq].liga, tipo: 'mercado' });
        for (const o of m.fichajes) if (o.eq === eq && o.estado === 'pendiente' && !vacantesDe(pil, eq)) o.estado = 'anulada';
        await guardar(ctx, m);
        return { ok: true, precio };
    },

    // Preferencias del draft (rookie que se asigna si no cubres la vacante)
    async draft(ctx, a) {
        if (ctx.cfg.fase !== 'mercado') throw new Error('El draft no está abierto.');
        const lista = (a.params?.lista || []).slice(0, 8).map(String);
        await ctx.store.merge(refMercado(ctx.cfg.temporada), { preferencias: { [a.equipoId]: lista } });
        return { ok: true, lista };
    },
};

// ======================================================================
// Mercados abiertos con la versión anterior (un solo Galáctico por liga): se completan con más candidatos
// (hasta 3 por liga, solo se irá uno) y se rellena la bolsa de agentes libres. Se hace una sola vez.
// ======================================================================
export async function actualizarMercadoAbierto(ctx) {
    if (!['mundial', 'mercado'].includes(ctx.cfg.fase)) return;
    const T = ctx.cfg.temporada;
    const m0 = await ctx.store.get(refMercado(T));
    if (!m0 || m0.estado !== 'abierto' || (m0.v || 1) >= 2) return;
    await asegurarPool(ctx);
    const { m, pil } = await cargar(ctx);
    const doc = await ctx.store.get(`resumen/T${T}`);
    const sesiones = doc?.json ? JSON.parse(doc.json).sesiones.map(descompactar) : [];
    const tablas = Object.fromEntries(LIGAS_NACIONALES.map(l => [l, construirTemporada(sesiones.filter(s => s.liga === l))]));
    const fuera = new Set([...(m.plan?.despidos || []), ...(m.plan?.retiros || [])].map(d => d.pid));
    const elegidos = elegirGalacticos({ tablas, pilotos: activos(pil), ofertas: (m.ofertas || []).filter(o => o.estado === 'pendiente'), rng: crearRng(`${ctx.secreto}|candidatos|${T}`), despedidos: fuera });
    const nuevos = [];
    for (const e of elegidos) {
        const deLiga = m.galacticos.filter(g => g.liga === e.liga);
        if (deLiga.some(g => g.pid === e.pid || g.eq === e.eq) || deLiga.length >= MERCADO.candidatos || deLiga.some(g => g.estado === 'vendido')) continue;
        const g = { ...e, nombre: nombrePiloto(pil[e.pid]), estado: 'pendiente', decision: duenoReal(ctx, e.eq) ? null : 'liga' };
        m.galacticos.push(g); nuevos.push(g);
    }
    m.galacticos.sort((a, b) => a.liga.localeCompare(b.liga) || a.pos - b.pos);
    m.v = 2;
    const fin = new Date(m.deadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (const g of nuevos) notificar(ctx, g.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `${g.nombre}, candidato a Galáctico de ${LIGAS[g.liga].nombre}`, texto: `La liga amplía los candidatos a Galáctico: hasta ${MERCADO.candidatos} por liga, pero solo se irá uno. Si llega una oferta por él puedes aceptarla o dejar que decida la liga al cerrar (${fin}).` });
    registrar(m, ctx, `Se amplían los candidatos a Galáctico: ${nuevos.length} nuevos. De cada liga solo se irá uno.`);
    noticia(ctx, { titulo: 'Más candidatos a Galáctico', texto: `La liga amplía la lista: ${LIGAS_NACIONALES.map(l => `${LIGAS[l].nombre}: ${m.galacticos.filter(g => g.liga === l).map(g => g.nombre).join(', ')}`).join(' · ')}. De cada liga solo cambiará uno. Además, ya se pueden fichar agentes libres para cubrir vacantes.`, tipo: 'mercado' });
    await guardar(ctx, m);
    ctx.diferir = null;
    ctx.nota(`Mercado actualizado: ${nuevos.length} candidatos nuevos`);
}

// ======================================================================
// La IA durante la ventana: puja por candidatos de otras ligas y vende los suyos si le pagan bien
// ======================================================================
export async function iaMercadoDiario(ctx, dia) {
    if (!['mundial', 'mercado'].includes(ctx.cfg.fase)) return;
    let c;
    try { c = await cargar(ctx); } catch { return; }
    const { m, pil, pp } = c;
    let cambios = false;
    const pendientesG = (m.galacticos || []).filter(g => g.estado === 'pendiente');
    // Pujas de las escuderías de la IA que pueden fichar un Galáctico
    for (const eq of Object.keys(ctx.equipos)) {
        if (duenoReal(ctx, eq) || !esTop(m, eq) || recibeGalactico(m, eq) || !ctx.privs[eq]) continue;
        const rng = crearRng(`${ctx.secreto}|iaPuja|${dia}|${eq}`);
        if (!rng.chance(0.4)) continue;
        const cands = pendientesG.filter(g => g.liga !== ctx.equipos[eq].liga && g.estado === 'pendiente');
        if (!cands.length) continue;
        const g = rng.weighted(cands, x => 6 - Math.min(5, x.pos));
        const suya = m.ofertas.find(o => o.eq === eq && o.pid === g.pid && o.estado === 'pendiente');
        const mejor = Math.max(0, ...m.ofertas.filter(o => o.pid === g.pid && o.estado === 'pendiente').map(o => o.importe));
        const tope = Math.min(5_000_000, (ctx.privs[eq].presupuesto || 0) * 0.25);
        const importe = Math.round(Math.max(MERCADO.importeMinimo, mejor * 1.1, rng.range(1_200_000, 3_000_000)) / 50_000) * 50_000;
        if (importe > tope || (suya && suya.importe >= importe)) continue;
        const t = tacticoSeguro(m, pil, eq, ctx.equipos[eq].liga, g.pid);
        if (!t) continue;
        if (!cuotaTrasCambios(activos(pil), ctx.equipos, [{ pid: g.pid, eq }, ...(t ? [{ pid: t.id, eq: g.eq }] : [])]).ok) continue;
        if (suya) suya.estado = 'anulada';
        m.ofertas.push({ id: `o${m.ofertas.length}_${ctx.ahora % 1e6}_ia`, pid: g.pid, eq, importe, estado: 'pendiente', fecha: ctx.ahora, ia: true });
        registrar(m, ctx, `${ctx.equipos[eq].nombre} (IA) puja ${M(importe)} por ${g.nombre}.`, { tipo: 'puja', pid: g.pid, eq });
        notificar(ctx, g.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `Oferta por ${g.nombre}`, texto: `${ctx.equipos[eq].nombre} ofrece ${M(importe)}${t ? ` y a ${nombrePiloto(t)}` : ''}. Acéptala en Mercado o deja que decida la liga.` });
        if (rng.chance(0.5)) noticia(ctx, { titulo: `${ctx.equipos[eq].nombre} va a por ${g.nombre}`, texto: `Ofrece ${M(importe)} por el candidato a Galáctico de ${LIGAS[g.liga].nombre}.`, liga: g.liga, tipo: 'rumor' });
        cambios = true;
    }
    // La IA vende a su candidato si la mejor oferta es buena
    for (const g of pendientesG) {
        if (g.estado !== 'pendiente' || duenoReal(ctx, g.eq)) continue;
        const o = m.ofertas.filter(x => x.pid === g.pid && x.estado === 'pendiente' && !recibeGalactico(m, x.eq) && (ctx.privs[x.eq]?.presupuesto || 0) >= x.importe).sort((a, b) => b.importe - a.importe)[0];
        const rng = crearRng(`${ctx.secreto}|iaVende|${dia}|${g.pid}`);
        if (!o || o.importe < 2_500_000 || !rng.chance(0.5)) continue;
        if (ejecutarGalactico(ctx, m, pil, pp, g, { eq: o.eq, importe: o.importe, cobra: o.importe, via: 'aceptada' }).ok) { o.estado = 'aceptada'; cambios = true; }
    }
    if (cambios) await guardar(ctx, m);
    ctx.diferir = null;
}

// ======================================================================
// Cerrar: la liga resuelve lo pendiente y cubre las vacantes
// ======================================================================
export async function cerrarMercado(ctx) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    ctx.diferir = null;
    await aplicarPendientes(ctx);
    const m = await store.get(refMercado(temporada));
    if (!m || m.estado === 'cerrado') return;
    const mp = await store.get(`mercado_priv/T${temporada}`);
    const pil = await cargarPilotos(ctx);
    await cargarEquipos(ctx); await cargarPrivs(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pil));
    const rng = crearRng(`${ctx.secreto}|cierre|${temporada}`);
    m.solicitudes ||= {}; m.ofertas ||= []; m.fichajes ||= []; m.trueques ||= []; m.fichas ||= {};

    // 1. Galácticos pendientes
    const dinero = (eq) => ctx.privs[eq]?.presupuesto || 0;
    // De cada liga sale uno de sus candidatos (si no se cerró ya un acuerdo durante la ventana)
    for (const liga of [...new Set(m.galacticos.filter(x => x.estado === 'pendiente').map(x => x.liga))]) {
        const cands = m.galacticos.filter(x => x.liga === liga && x.estado === 'pendiente');
        for (const g of cands) if (pil[g.pid]?.equipoId !== g.eq) g.estado = 'se_queda';
        const vivos = cands.filter(g => g.estado === 'pendiente');
        if (!vivos.length) continue;
        if (m.galacticos.some(x => x.liga === liga && x.estado === 'vendido')) { vivos.forEach(g => { g.estado = 'se_queda'; }); continue; }
        const otraLiga = (eq, g) => ctx.equipos[eq] && ctx.equipos[eq].liga !== liga && !recibeGalactico(m, eq) && eq !== g.eq;
        const mejor = vivos.slice().sort((a, b) => a.pos - b.pos)[0];
        const intentos = [];
        if (rng.chance(MERCADO.probSuerte)) {
            // Suerte: cualquier escudería de otra liga. Si lo había pedido paga lo que ofreció; si no, un precio simbólico.
            const g = rng.pick(vivos);
            const eq = rng.pick(Object.keys(ctx.equipos).filter(e => otraLiga(e, g)));
            if (eq) {
                const suya = m.ofertas.find(o => o.eq === eq && o.pid === g.pid && o.estado === 'pendiente')?.importe || m.solicitudes[eq]?.importe;
                intentos.push({ g, eq, importe: Math.min(dinero(eq), suya || MERCADO.precioSimbolico), via: 'suerte' });
            }
        }
        m.ofertas.filter(o => o.estado === 'pendiente' && vivos.some(g => g.pid === o.pid)).sort((a, b) => b.importe - a.importe)
            .forEach(o => intentos.push({ g: vivos.find(g => g.pid === o.pid), eq: o.eq, importe: o.importe, via: 'oferta' }));
        Object.entries(m.solicitudes).filter(([eq]) => esTop(m, eq)).sort((a, b) => b[1].importe - a[1].importe).forEach(([eq, s]) => intentos.push({ g: mejor, eq, importe: s.importe, via: 'solicitud' }));
        Object.keys(ctx.equipos).filter(eq => esTop(m, eq) && !duenoReal(ctx, eq)).sort(() => rng.next() - 0.5).forEach(eq => intentos.push({ g: mejor, eq, importe: MERCADO.importeIA, via: 'ia' }));
        let hecho = false;
        for (const x of intentos) {
            if (x.g.estado !== 'pendiente' || !otraLiga(x.eq, x.g) || (ctx.privs[x.eq] && dinero(x.eq) < x.importe)) continue;
            if (ejecutarGalactico(ctx, m, pil, pp, x.g, { eq: x.eq, importe: x.importe, via: x.via, cobra: MERCADO.compensacionLiga }).ok) { hecho = true; break; }
        }
        if (!hecho) { vivos.forEach(g => { if (g.estado === 'pendiente') g.estado = 'se_queda'; }); registrar(m, ctx, `${LIGAS[liga].nombre}: ningún candidato a Galáctico cambia de liga (nadie pudo ficharlos cumpliendo la regla del 55%).`); }
    }
    m.ofertas.forEach(o => { if (o.estado === 'pendiente') o.estado = 'anulada'; });
    m.fichajes.forEach(o => { if (o.estado === 'pendiente') o.estado = 'caducada'; });
    m.trueques.forEach(o => { if (o.estado === 'pendiente') o.estado = 'caducada'; });

    // 2. Vacantes → rookies (peor escudería primero; preferencias del draft si las hay)
    const posEq = m.posiciones?.equipos || {};
    const vacantes = [];
    for (const eq of Object.keys(ctx.equipos)) for (let i = 0; i < vacantesDe(pil, eq); i++) vacantes.push({ eq, liga: ctx.equipos[eq].liga });
    vacantes.sort((a, b) => (posEq[b.eq] || 99) - (posEq[a.eq] || 99));
    const disponibles = new Map((m.rookies || []).map(r => [r.id, r]));
    const usados = new Set(Object.values(pil).map(p => `${p.nombre} ${p.apellido}`));
    const elegidos = [];
    let extra = 0;
    for (const v of vacantes) {
        const liga = v.liga;
        const suyos = deEquipo(pil, v.eq);
        const locales = activos(pil).filter(p => p.liga === liga && p.nac === NAC_LOCAL[liga]).length;
        const huecos = Object.keys(ctx.equipos).filter(e => ctx.equipos[e].liga === liga).reduce((s, e) => s + vacantesDe(pil, e), 0);
        const debeSerLocal = !suyos.some(p => p.nac === NAC_LOCAL[liga]) || locales + huecos <= MERCADO.minLocales;
        const valido = (r) => r && r.liga === liga && (!debeSerLocal || r.nac === NAC_LOCAL[liga]);
        let r = (m.preferencias?.[v.eq] || []).map(id => disponibles.get(id)).find(valido);
        if (!r) r = [...disponibles.values()].filter(valido).sort((a, b) => (b.estrellas - a.estrellas) || (rng.next() - 0.5))[0];
        // La IA prefiere un agente libre con más nivel que el rookie, si se lo puede permitir
        if (!duenoReal(ctx, v.eq) && !(m.preferencias?.[v.eq] || []).length) {
            const libre = Object.values(pil).filter(p => esLibre(p) && p.precio != null && (!debeSerLocal || p.nac === NAC_LOCAL[liga]))
                .filter(p => (p.valoracion || 0) > (r?.estrellas || 0) && (ctx.privs[v.eq]?.presupuesto || 0) > p.precio * 2)
                .sort((a, b) => (b.valoracion || 0) - (a.valoracion || 0))[0];
            if (libre) {
                movimiento(priv(ctx, v.eq), `Fichaje de ${nombrePiloto(libre)} (agente libre)`, -libre.precio, ctx.ahora);
                mover(ctx, pil, pp, libre.id, v.eq);
                elegidos.push({ eq: v.eq, libre: libre.id, nombre: nombrePiloto(libre) });
                registrar(m, ctx, `${ctx.equipos[v.eq].nombre} ficha al agente libre ${nombrePiloto(libre)} por ${M(libre.precio)}.`, { tipo: 'libre', pid: libre.id, eq: v.eq });
                noticia(ctx, { titulo: `${ctx.equipos[v.eq].nombre} ficha a ${nombrePiloto(libre)}`, texto: 'Llega libre para cubrir la vacante.', liga, tipo: 'mercado' });
                continue;
            }
        }
        let attrs = r ? mp?.rookies?.[r.id] : null;
        if (!r) {
            // Bolsa agotada: la liga trae un rookie nuevo
            const nac = debeSerLocal ? NAC_LOCAL[liga] : rng.pick(EXTRANJEROS[liga]);
            const { nombre, apellido } = nombreAleatorio(rng, nac, usados);
            r = { id: `rk${temporada + 1}_${liga}_x${extra++}`, nombre, apellido, nac, liga, edad: rng.int(17, 21) };
        }
        attrs ||= atributosAleatorios(rng, { rookie: true });
        disponibles.delete(r.id);
        const numeros = new Set(activos(pil).filter(p => p.liga === liga).map(p => p.numero));
        let numero; do numero = rng.int(2, 99); while (numeros.has(numero));
        pil[r.id] = { id: r.id, nombre: r.nombre, apellido: r.apellido, nac: r.nac, numero, equipoId: v.eq, liga, rol: 'P2', edad: r.edad, rookie: true, estado: 'activo', historia: [], temporadaDebut: temporada + 1 };
        pp[r.id] = ctx.pilotosPriv[r.id] = { id: r.id, pilotoId: r.id, equipoId: v.eq, attrs, moral: 65, forma: 0, salario: salarioPiloto(attrs) };
        ctx.sucios.pilotos.add(r.id); ctx.sucios.pilotosPriv.add(r.id);
        elegidos.push({ eq: v.eq, rookie: r.id, nombre: `${r.nombre} ${r.apellido}` });
        notificar(ctx, v.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `Nuevo piloto: ${r.nombre} ${r.apellido}`, texto: `La liga te asigna un rookie de ${r.edad} años para cubrir la vacante. ¡Bienvenido al equipo!` });
    }

    // 3. Roles (Piloto 1 local)
    const porEquipo = {};
    activos(pil).forEach(p => { (porEquipo[p.equipoId] ||= []).push({ ...p, attrs: pp[p.id]?.attrs }); });
    for (const [eq, lista] of Object.entries(porEquipo)) {
        for (const r of asignarRoles(lista, ctx.equipos[eq]?.liga)) {
            if (pil[r.id].rol !== r.rol) { pil[r.id].rol = r.rol; ctx.sucios.pilotos.add(r.id); }
            if (!r.cumpleCuota) ctx.nota(`${ctx.equipos[eq]?.nombre} no tiene piloto local para el asiento de Piloto 1`);
        }
    }
    registrar(m, ctx, `Mercado cerrado: ${elegidos.filter(x => x.rookie).length} rookies se estrenan.`);
    await store.set(refMercado(temporada), { ...m, estado: 'cerrado', vacantes, elegidos, cerrado: ctx.ahora });
    await store.merge('config/juego', { fase: 'cerrada' });
    ctx.cfg.fase = 'cerrada';
    noticia(ctx, { titulo: 'Mercado cerrado: así quedan las parrillas', texto: `${m.galacticos.filter(g => g.estado === 'vendido').length} Galácticos cambian de liga y ${elegidos.filter(x => x.rookie).length} rookies se estrenan la próxima temporada.`, tipo: 'fase' });
    await volcar(ctx);
    ctx.catalogoSucio = true;
}
