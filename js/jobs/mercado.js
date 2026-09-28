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

const M = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M€`;
export const refMercado = (temporada) => `mercado/T${temporada}`;

// ---------- utilidades ----------
const activos = (pil) => Object.values(pil).filter(p => p.equipoId);
const deEquipo = (pil, eq) => activos(pil).filter(p => p.equipoId === eq);
const vacantesDe = (pil, eq) => Math.max(0, 2 - deEquipo(pil, eq).length);

function mover(ctx, pil, pp, pid, eq) {
    const p = pil[pid];
    p.equipoId = eq; p.liga = eq ? ctx.equipos[eq]?.liga : null;
    p.estado = eq ? 'activo' : 'libre'; p.rol = null;
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
export async function abrirMercado(ctx, { tablas }) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
    const pil = await cargarPilotos(ctx);
    const equipos = await cargarEquipos(ctx);
    const privs = await cargarPrivs(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pil));
    const rng = crearRng(`${ctx.secreto}|mercado|${temporada}`);
    const inmunes = new Set(ctx.cfg.mundial?.participantes || []);
    const { eq: posEq, pil: posPil } = posiciones(tablas);
    const nombre = (pid) => nombrePiloto(pil[pid]);

    // 1. Despidos (se aplican ya: la escudería tiene 3 días para buscar sustituto)
    const { despidos, salvados } = planDespidos({ tablas, pilotos: activos(pil), inmunes });
    const despedidos = new Set(despidos.map(d => d.pid));

    // 2. Galácticos: uno por liga. Las ofertas hechas durante la temporada cuentan.
    const docOfertas = await store.get(`mercado_ofertas/T${temporada}`);
    const previas = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o }))
        .filter(o => o.pid && (posEq[o.eq] || 99) <= MERCADO.topComprador && (privs[o.eq]?.presupuesto || 0) >= o.importe && equipos[o.eq]?.liga !== pil[o.pid]?.liga);
    const elegidos = elegirGalacticos({ tablas, pilotos: activos(pil), ofertas: previas, rng, despedidos });
    const galacticos = elegidos.map(g => ({ ...g, nombre: nombre(g.pid), estado: 'pendiente', decision: duenoReal(ctx, g.eq) ? null : 'liga' }));
    const pidsG = new Set(galacticos.map(g => g.pid));
    const ofertas = previas.filter(o => pidsG.has(o.pid)).map((o, i) => ({ id: `o${i}`, pid: o.pid, eq: o.eq, importe: o.importe, estado: 'pendiente', fecha: o.fecha || ctx.ahora }));
    for (const o of previas.filter(o => !pidsG.has(o.pid))) notificar(ctx, o.eq, { remitente: 'Mercado', tipo: 'mercado', titulo: `${nombre(o.pid)} no sale al mercado`, texto: `No es el Galáctico de ${LIGAS[pil[o.pid]?.liga]?.nombre || 'su liga'}, así que tu oferta queda anulada. Puedes pujar por otro Galáctico en el mercado.` });

    for (const d of despidos) mover(ctx, pil, pp, d.pid, null);

    // 3. La IA pide alguna ficha de fichaje para que haya con quién hacer trueques
    const ocupados = new Set([...despidos.map(d => d.eq), ...galacticos.map(g => g.eq)]);
    const fichas = {};
    for (const [id] of Object.entries(equipos)) if (!duenoReal(ctx, id) && !ocupados.has(id) && deEquipo(pil, id).length === 2 && rng.chance(0.3)) fichas[id] = ctx.ahora;

    const vacantesLiga = {};
    despidos.forEach(d => { vacantesLiga[d.liga] = (vacantesLiga[d.liga] || 0) + 1; });
    const usados = new Set(Object.values(pil).map(p => `${p.nombre} ${p.apellido}`));
    const rookies = generarRookies({ temporada, vacantes: despidos.map(d => ({ liga: d.liga })), rng, usados });
    const deadline = ctx.ahora + MERCADO.diasVentana * 864e5;
    const conNombre = (x) => ({ ...x, nombre: nombre(x.pid) });
    const m = {
        temporada, estado: 'abierto', abierto: ctx.ahora, deadline,
        plan: { despidos: despidos.map(conNombre), salvados: salvados.map(conNombre) },
        galacticos, ofertas, solicitudes: {}, fichajes: [], fichas, trueques: [], movimientos: [],
        rookies: rookies.map(r => ({ id: r.id, nombre: r.nombre, apellido: r.apellido, nac: r.nac, liga: r.liga, edad: r.edad, estrellas: estrellasRookie(r.attrs, rng) })),
        preferencias: {}, posiciones: { equipos: posEq, pilotos: posPil },
    };
    registrar(m, ctx, `Se abre el mercado: ${despidos.length} despidos y ${galacticos.length} Galácticos en juego.`);
    await store.set(refMercado(temporada), m);
    await store.set(`mercado_priv/T${temporada}`, { rookies: Object.fromEntries(rookies.map(r => [r.id, r.attrs])) });

    // 4. Avisos
    const fin = new Date(deadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (const g of galacticos) {
        const deLiga = LIGAS[g.liga].nombre;
        notificar(ctx, g.eq, { remitente: 'Dirección de la liga', tipo: 'mercado', titulo: `${g.nombre} es el Galáctico de ${deLiga}`, texto: `Se va a otra liga. Puedes aceptar una oferta de otra escudería (cobras la oferta y recibes a su segundo piloto) o dejar que decida la liga (recibes ${M(MERCADO.compensacionLiga)} y el piloto que te toque). Tienes hasta el ${fin}.` });
        noticia(ctx, { titulo: `${g.nombre}, Galáctico de ${deLiga}`, texto: `El ${g.pos}º de ${deLiga} cambiará de liga. Las tres mejores escuderías de cada liga pueden pujar por él hasta el ${fin}.`, liga: g.liga, tipo: 'mercado' });
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
    noticia(ctx, { titulo: 'Se abre el mercado de fin de temporada', texto: `Tres días de fichajes: ${galacticos.length} Galácticos, ${despidos.length} vacantes y trueques entre escuderías. Cierra el ${fin}.`, tipo: 'fase' });
    ctx.nota(`Mercado abierto: ${galacticos.map(g => g.nombre).join(', ')}`);
    return m;
}

// ======================================================================
// Acciones de los mánagers durante la ventana
// ======================================================================
async function cargar(ctx) {
    const m = await ctx.store.get(refMercado(ctx.cfg.temporada));
    if (ctx.cfg.fase !== 'mercado' || !m || m.estado !== 'abierto') throw new Error('El mercado no está abierto.');
    if (m.deadline <= ctx.ahora) throw new Error('El mercado ya ha cerrado.');
    const pil = await cargarPilotos(ctx);
    await cargarEquipos(ctx); await cargarPrivs(ctx);
    const pp = await cargarPilotosPriv(ctx, Object.keys(pil));
    return { m, pil, pp };
}
const guardar = (ctx, m) => ctx.store.set(refMercado(ctx.cfg.temporada), m);
const priv = (ctx, eq) => { const p = ctx.privs[eq]; if (!p) throw new Error('Escudería sin datos'); ctx.sucios.privs.add(eq); return p; };
const esTop = (m, eq) => (m.posiciones?.equipos?.[eq] || 99) <= MERCADO.topComprador;
const recibeGalactico = (m, eq) => m.galacticos.some(g => g.destino?.eq === eq);

function comprobarCuota(ctx, pil, cambios) {
    const r = cuotaTrasCambios(activos(pil), ctx.equipos, cambios);
    if (!r.ok) throw new Error(r.motivo);
}

// Intercambio Galáctico ↔ segundo piloto del comprador y dinero
function ejecutarGalactico(ctx, m, pil, pp, g, { eq, importe, via, cobra }) {
    const liga = ctx.equipos[eq].liga;
    const t = tacticoDe(activos(pil), eq, liga);
    const cambios = [{ pid: g.pid, eq }, ...(t ? [{ pid: t.id, eq: g.eq }] : [])];
    const r = cuotaTrasCambios(activos(pil), ctx.equipos, cambios);
    if (!r.ok) return r;
    if (ctx.privs[eq]) movimiento(priv(ctx, eq), `Fichaje del Galáctico ${g.nombre}`, -importe, ctx.ahora);
    if (ctx.privs[g.eq]) movimiento(priv(ctx, g.eq), via === 'aceptada' ? `Venta de ${g.nombre} (Galáctico)` : `Compensación de la liga por ${g.nombre}`, cobra, ctx.ahora);
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
        const t = tacticoDe(activos(pil), eq, ctx.equipos[eq].liga);
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

    // Preferencias del draft (rookie que se asigna si no cubres la vacante)
    async draft(ctx, a) {
        if (ctx.cfg.fase !== 'mercado') throw new Error('El draft no está abierto.');
        const lista = (a.params?.lista || []).slice(0, 8).map(String);
        await ctx.store.merge(refMercado(ctx.cfg.temporada), { preferencias: { [a.equipoId]: lista } });
        return { ok: true, lista };
    },
};

// ======================================================================
// Cerrar: la liga resuelve lo pendiente y cubre las vacantes
// ======================================================================
export async function cerrarMercado(ctx) {
    const { store } = ctx;
    const temporada = ctx.cfg.temporada;
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
    for (const g of m.galacticos.filter(x => x.estado === 'pendiente')) {
        const otraLiga = (eq) => ctx.equipos[eq] && ctx.equipos[eq].liga !== g.liga && !recibeGalactico(m, eq) && eq !== g.eq;
        const intentos = [];
        if (rng.chance(MERCADO.probSuerte)) {
            // Suerte: cualquier escudería de otra liga. Si lo había pedido paga lo que ofreció; si no, un precio simbólico.
            const eq = rng.pick(Object.keys(ctx.equipos).filter(otraLiga));
            if (eq) {
                const suya = m.ofertas.find(o => o.eq === eq && o.pid === g.pid && o.estado === 'pendiente')?.importe || m.solicitudes[eq]?.importe;
                intentos.push({ eq, importe: Math.min(dinero(eq), suya || MERCADO.precioSimbolico), via: 'suerte' });
            }
        }
        m.ofertas.filter(o => o.pid === g.pid && o.estado === 'pendiente').sort((a, b) => b.importe - a.importe).forEach(o => intentos.push({ eq: o.eq, importe: o.importe, via: 'oferta' }));
        Object.entries(m.solicitudes).filter(([eq]) => esTop(m, eq)).sort((a, b) => b[1].importe - a[1].importe).forEach(([eq, s]) => intentos.push({ eq, importe: s.importe, via: 'solicitud' }));
        Object.keys(ctx.equipos).filter(eq => esTop(m, eq) && !duenoReal(ctx, eq)).sort(() => rng.next() - 0.5).forEach(eq => intentos.push({ eq, importe: MERCADO.importeIA, via: 'ia' }));
        let hecho = false;
        for (const x of intentos) {
            if (!otraLiga(x.eq) || (ctx.privs[x.eq] && dinero(x.eq) < x.importe)) continue;
            if (ejecutarGalactico(ctx, m, pil, pp, g, { ...x, cobra: MERCADO.compensacionLiga }).ok) { hecho = true; break; }
        }
        if (!hecho) { g.estado = 'se_queda'; registrar(m, ctx, `${g.nombre} se queda: ninguna escudería pudo ficharle cumpliendo la regla del 55%.`); }
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
    registrar(m, ctx, `Mercado cerrado: ${elegidos.length} rookies se estrenan.`);
    await store.set(refMercado(temporada), { ...m, estado: 'cerrado', vacantes, elegidos, cerrado: ctx.ahora });
    await store.merge('config/juego', { fase: 'cerrada' });
    ctx.cfg.fase = 'cerrada';
    noticia(ctx, { titulo: 'Mercado cerrado: así quedan las parrillas', texto: `${m.galacticos.filter(g => g.estado === 'vendido').length} Galácticos cambian de liga y ${elegidos.length} rookies se estrenan la próxima temporada.`, tipo: 'fase' });
    await volcar(ctx);
    ctx.catalogoSucio = true;
}
