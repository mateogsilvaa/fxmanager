import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { store, ahora, encolar, escuchar, escucharConsulta, reclamarEquipo, refrescarPerfil } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio, fecha, hace, toast, confirmar, modal, pestanas, $, $$, dinero, barra, cuentaAtras } from '../core/ui.js';
import {
    LIGAS, LIGAS_NACIONALES, SESIONES, SESION_INFO, esCarrera, esQualy, AREAS, INSTALACIONES, NIVEL_MAX_AREA, NIVEL_MAX_INST,
    SLOTS_ID, costeMejora, horasMejora, probExitoMejora, RECARGO_URGENTE, costeInstalacion, horasInstalacion, ECO,
    SETUP_PARAMS, ESTRATEGIA_DEF, diaMadrid, tandasSimulador,
} from '../engine/constants.js';
import { tandasDisponibles } from '../engine/juego.js';

const u = await montar({ activo: 'escuderia' });
const main = document.getElementById('main');
if (!u) { location.href = 'entrar.html'; throw new Error('sin sesión'); }
await refrescarPerfil();
const d = await cargarDatos();
barraDirecto(d);
if (!u.perfil?.equipoId) { elegirEquipo(); throw new Error('sin equipo'); }

// ======================================================================
// Estado
// ======================================================================
const eqId = u.perfil.equipoId;
const eq = d.equipo(eqId) || (await store().get(`equipos/${eqId}`));
const liga = eq.liga;
const misPilotos = Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eqId).map(([id, p]) => ({ id, ...p })).sort((a) => (a.rol === 'P1' ? -1 : 1));
const E = { priv: null, pp: {}, acciones: [], notifs: [], decision: null, estrategias: [] };
const hoy = () => diaMadrid(ahora());
const cadencia = d.cfg.cadenciaMin || 10;
const proximoCiclo = () => {
    const ult = d.cfg.tick?.ultimo;
    if (!ult) return 'en unos minutos';
    let t = ult + cadencia * 60_000;
    while (t < ahora()) t += cadencia * 60_000;
    return `hacia las ${new Date(t).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}`;
};

// Fin de semana abierto para mi equipo (liga propia o Mundial si tengo pilotos clasificados)
const participantesInt = new Set(d.cfg.mundial?.participantes || []);
const misPilotosInt = misPilotos.filter(p => participantesInt.has(p.id));
const misEventos = [...d.eventosLiga(liga), ...(misPilotosInt.length ? d.eventosLiga('INT') : [])];
const ev = misEventos
    .map(e => ({ e, cierre: Math.max(...SESIONES.filter(t => e.sesiones[t]).map(t => e.sesiones[t].lockAt)) }))
    .filter(x => x.cierre > ahora()).sort((a, b) => a.cierre - b.cierre)[0]?.e || null;
const pilotosEv = ev?.liga === 'INT' ? misPilotosInt : misPilotos;

main.innerHTML = `
<div class="cabecera-pagina">
  <div><div class="etiqueta">${banderaLiga(liga, { ancho: 16 })} ${esc(LIGAS[liga].nombre)} · ${esc(u.perfil.nombre)}</div><h1 style="margin-top:2px">${esc(eq.nombre)}</h1></div>
</div>
<div class="tarjeta" style="margin-bottom:14px"><div class="datos datos-4" id="cab-datos"></div></div>
<div class="pestanas" id="tabs">
  <button data-tab="hoy">Hoy</button>
  <button data-tab="carrera">Carrera</button>
  <button data-tab="coche">Coche</button>
  <button data-tab="equipo">Equipo</button>
  <button data-tab="rivales">Rivales</button>
</div>
${['hoy', 'carrera', 'coche', 'equipo', 'rivales'].map(t => `<section data-panel="${t}" id="p-${t}"><div class="cargando"><span class="spinner"></span>Cargando…</div></section>`).join('')}`;

let tabActual = 'hoy';
const PINTAR = { hoy: pintarHoy, carrera: pintarCarrera, coche: pintarCoche, equipo: pintarEquipo, rivales: pintarRivales };
const pintados = new Set();
const repintar = (...tabs) => tabs.forEach(t => { if (pintados.has(t) || t === tabActual) { pintados.add(t); try { PINTAR[t](); } catch (e) { console.error(e); } } });
const irA = pestanas($('#tabs').parentElement, { alCambiar: (id) => { tabActual = id; if (!pintados.has(id) && E.priv) { pintados.add(id); PINTAR[id](); } } });

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
E.pp = Object.fromEntries(await Promise.all(misPilotos.map(async p => [p.id, await store().get(`pilotos_priv/${p.id}`).catch(() => null)])));
if (ev) E.estrategias = await store().list('estrategias', [['uid', '==', u.uid], ['eventoId', '==', ev.id]]).catch(() => []);
let privRaw = null;
escuchar(`equipos_priv/${eqId}`, (p) => {
    if (iguales(p, privRaw)) return;
    privRaw = p; E.priv = p || {};
    pintarCabecera();
    if (!pintados.size) { pintados.add(tabActual); PINTAR[tabActual](); }
    else repintar('hoy', 'coche', 'equipo');
});
escucharConsulta('acciones', [['uid', '==', u.uid]], (lista) => {
    const orden = lista.filter(a => a.equipoId === eqId).sort((a, b) => (b.creado || 0) - (a.creado || 0));
    if (iguales(orden, E.acciones)) return;
    const antes = new Map(E.acciones.map(a => [a.id, a.estado]));
    E.acciones = orden;
    for (const a of orden) if (antes.get(a.id) === 'pendiente' && a.estado !== 'pendiente') avisarAccion(a);
    if (E.priv) repintar('hoy', 'coche', 'equipo', 'rivales', 'carrera');
});
escucharConsulta('notificaciones', [['uid', '==', u.uid]], (lista) => {
    const orden = lista.sort((a, b) => b.fecha - a.fecha);
    if (iguales(orden, E.notifs)) return;
    E.notifs = orden;
    if (E.priv) repintar('hoy', 'rivales');
});
escuchar(`decisiones/${hoy()}_${eqId}`, (dec) => {
    if (iguales(dec, E.decision)) return;
    E.decision = dec;
    if (E.priv) repintar('hoy');
});

const NOMBRES_ACCION = { checkin: 'Recompensa diaria', id_iniciar: 'Mejora', inst_mejorar: 'Obras', simulador: 'Simulador', espiar: 'Espionaje', sponsor_firmar: 'Patrocinio', draft: 'Draft', tactico_ofrecer: 'Escaparate' };
function avisarAccion(a) {
    if (a.estado === 'error') toast(`${NOMBRES_ACCION[a.tipo] || a.tipo}: ${a.resultado?.error}`, 'error');
    else toast(`${NOMBRES_ACCION[a.tipo] || a.tipo}: hecho`);
}
const pendientes = (tipo) => E.acciones.filter(a => a.tipo === tipo && a.estado === 'pendiente');
async function lanzar(tipo, params, msg = 'Enviado') {
    try { await encolar(tipo, params); toast(`${msg}. Se procesa ${proximoCiclo()}.`); }
    catch (e) { toast(e.message, 'error'); }
}

function pintarCabecera() {
    const posLiga = d.clasificacionEquipos(liga).find(x => x.eq === eqId);
    const viva = E.priv.racha?.ultimoDia === hoy() || E.priv.racha?.ultimoDia === diaMadrid(ahora() - 864e5);
    $('#cab-datos').innerHTML = `
      <div class="dato"><b>${dinero(E.priv.presupuesto)}</b><span>Presupuesto</span></div>
      <div class="dato"><b>${posLiga ? posLiga.posicion + 'º' : '—'}</b><span>${posLiga?.pts ?? 0} puntos</span></div>
      <div class="dato"><b>${viva ? E.priv.racha.n : 0} días</b><span>Racha</span></div>
      <div class="dato"><b>${eq.fans ?? 0}</b><span>Fans</span></div>`;
}

// ======================================================================
// HOY
// ======================================================================
function pintarHoy() {
    const el = $('#p-hoy');
    const dia = hoy();
    const priv = E.priv;
    const checkinHecho = priv.racha?.ultimoDia === dia;
    const checkinPend = pendientes('checkin').length > 0;
    const t = tandasDisponibles(priv, dia);
    const tandasLibres = Math.max(0, t.quedan - pendientes('simulador').length);
    const dec = E.decision;
    const idActivos = (priv.proyectos || []).filter(p => p.tipo === 'area').length + pendientes('id_iniciar').length;
    const sponsorOk = priv.sponsor && priv.sponsor.temporada === d.temporada;
    const tareas = [
        { ok: checkinHecho || checkinPend, txt: 'Recoger la recompensa diaria' },
        { ok: !!(dec?.eleccion || dec?.aplicada), txt: 'Responder la decisión del día' },
        ev && { ok: tandasLibres === 0, txt: `Probar reglajes en el simulador (${tandasLibres} libres)`, ir: 'carrera' },
        ev && { ok: E.estrategias.length > 0, txt: 'Preparar la estrategia del fin de semana', ir: 'carrera' },
        { ok: idActivos >= SLOTS_ID, txt: `Tener el coche en desarrollo (${idActivos}/${SLOTS_ID})`, ir: 'coche' },
        !sponsorOk && { ok: false, txt: 'Firmar un patrocinador', ir: 'equipo' },
    ].filter(Boolean);
    const hechas = tareas.filter(x => x.ok).length;
    const viva = priv.racha?.ultimoDia === dia || priv.racha?.ultimoDia === diaMadrid(ahora() - 864e5);
    const rachaN = viva ? priv.racha.n : 0;
    const premio = ECO.checkinBase + Math.min(checkinHecho ? rachaN : rachaN + 1, 7) * ECO.checkinPorRacha + (priv.inst?.marketing || 0) * ECO.checkinPorMarketing;
    const avisos = E.notifs.slice(0, 4);

    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Tareas de hoy</h2><span class="muted peq">${hechas} de ${tareas.length}</span></div>
          ${barra(hechas, tareas.length)}
          <ul class="lista tareas" style="margin-top:6px">${tareas.map(x => `<li><span><i class="check ${x.ok ? 'on' : ''}"></i>${esc(x.txt)}</span>${!x.ok && x.ir ? `<button class="btn btn-sec btn-peq" data-ir="${x.ir}">Ir</button>` : ''}</li>`).join('')}</ul>
        </div>
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Decisión del día</h2>${dec && !dec.aplicada ? `<span class="muted peq">Caduca en <span data-cuenta="${dec.expira}" data-corta>${cuentaAtras(dec.expira, true)}</span></span>` : ''}</div>
          ${decisionHtml(dec)}
        </div>
      </div>
      <aside class="pila">
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Recompensa diaria</h2><span class="muted peq">${rachaN} ${rachaN === 1 ? 'día' : 'días'} seguidos</span></div>
          <div class="racha">${Array.from({ length: 7 }, (_, i) => `<i class="${i < Math.min(rachaN, 7) ? 'on' : ''}">${i + 1}</i>`).join('')}</div>
          <div class="fila-entre" style="margin-top:12px"><span class="muted peq">${checkinHecho ? 'Recogida. Vuelve mañana.' : `Hoy: <b style="color:var(--texto)">${dinero(premio)}</b>`}</span>
          <button class="btn btn-peq" id="btn-checkin" ${checkinHecho || checkinPend ? 'disabled' : ''}>${checkinHecho ? 'Recogida' : checkinPend ? 'En cola…' : 'Recoger'}</button></div>
        </div>
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Avisos</h2>${E.notifs.length > 4 ? '<button class="btn btn-sec btn-peq" id="ver-avisos">Ver todos</button>' : ''}</div>
          ${avisos.length ? avisos.map(notifHtml).join('') : vacio('Sin avisos.')}
        </div>
      </aside>
    </div>`;
    $$('[data-ir]', el).forEach(b => b.addEventListener('click', () => irA(b.dataset.ir)));
    $('#btn-checkin', el)?.addEventListener('click', () => lanzar('checkin', {}, 'Recompensa en cola'));
    $('#ver-avisos', el)?.addEventListener('click', () => { modal(`<h2>Avisos</h2>${E.notifs.slice(0, 80).map(notifHtml).join('')}`, { ancho: 620 }); marcarLeidas(); });
    if (avisos.some(n => !n.leida)) setTimeout(marcarLeidas, 4000);
    $$('[data-op]', el).forEach(b => b.addEventListener('click', async () => {
        try {
            await store().update(`decisiones/${dec.id}`, { eleccion: b.dataset.op });
            E.decision = { ...dec, eleccion: b.dataset.op };
            toast('Decisión tomada');
            pintarHoy();
        } catch { toast('No se pudo guardar (¿ha caducado?)', 'error'); }
    }));
}

function decisionHtml(dec) {
    if (!dec) return `<p class="muted" style="margin:0">Llega cada día poco después de medianoche.</p>`;
    if (dec.aplicada) return `<p>${esc(dec.texto)}</p><div class="info-caja">${esc(dec.resultado || 'Aplicada.')}</div>`;
    return `<p>${esc(dec.texto)}</p><div class="dec-opciones">${dec.opciones.map(o => `<button data-op="${esc(o.id)}" class="${dec.eleccion === o.id ? 'elegida' : ''}">${esc(o.texto)}</button>`).join('')}</div>
      <p class="muted peq" style="margin:8px 0 0">Si no eliges, se aplica la opción por defecto.</p>`;
}

function notifHtml(n) {
    return `<div class="notif ${n.leida ? '' : 'nueva'}"><div class="fila-entre"><h4>${esc(n.titulo)}</h4><span class="meta">${hace(n.fecha)}</span></div><p>${esc(n.texto)}</p></div>`;
}
async function marcarLeidas() {
    const sin = E.notifs.filter(n => !n.leida).slice(0, 50);
    if (!sin.length) return;
    try { await Promise.all(sin.map(n => store().update(`notificaciones/${n.id}`, { leida: true }))); } catch { }
}

// ======================================================================
// CARRERA: reglaje (con simulador) + estrategia por sesión
// ======================================================================
function pintarCarrera() {
    const el = $('#p-carrera');
    if (!ev) { el.innerHTML = `<div class="tarjeta">${vacio('No hay ningún fin de semana abierto para tu equipo.')}</div>`; return; }
    const tipos = SESIONES.filter(t => ev.sesiones[t]);
    const guardada = (t) => E.estrategias.find(x => x.tipo === t);
    const heredada = (t) => { for (let i = tipos.indexOf(t); i >= 0; i--) { const g = guardada(tipos[i]); if (g) return g; } return null; };
    const abiertas = tipos.filter(t => ev.sesiones[t].lockAt > ahora());
    const primeraAbierta = abiertas[0];
    const tandas = E.acciones.filter(a => a.tipo === 'simulador' && a.params?.eventoId === ev.id);
    const ultimaTanda = tandas.find(a => a.estado === 'hecha')?.resultado?.setup;
    const setup = heredada(primeraAbierta || tipos[tipos.length - 1])?.setup || ultimaTanda || E.priv.ultimoSetup || { ala: 5, susp: 5, marchas: 5 };
    const t = tandasDisponibles(E.priv, hoy());
    const libres = Math.max(0, t.quedan - pendientes('simulador').length);
    const nivelSim = E.priv.inst?.simulador || 0;

    el.innerHTML = `
    <div class="tarjeta" style="margin-bottom:12px">
      <div class="fila-entre"><div><div class="etiqueta">Ronda ${ev.ronda}${ev.liga === 'INT' ? ' · Mundial' : ''}</div><h2 style="margin:2px 0 0">${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)}</h2></div>
      ${primeraAbierta ? `<span class="estado abierta">Próximo cierre en <span data-cuenta="${ev.sesiones[primeraAbierta].lockAt}" data-corta>${cuentaAtras(ev.sesiones[primeraAbierta].lockAt, true)}</span></span>` : ''}</div>
    </div>
    <div class="rejilla rejilla-2">
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h2>Reglaje</h2><span class="muted peq">${libres} de ${t.max} pruebas hoy</span></div>
        <p class="muted peq">Cada coche tiene un reglaje ideal secreto para este circuito. Pruébalo en el simulador y el ingeniero te dirá si te pasas o te quedas corto.</p>
        ${Object.entries(SETUP_PARAMS).map(([k, p]) => `<div class="setup-param" style="margin:10px 0"><span>${esc(p.nombre)}</span><input type="range" min="1" max="10" name="${k}" value="${setup[k]}" oninput="this.nextElementSibling.value=this.value"><output>${setup[k]}</output></div>`).join('')}
        <div class="fila-botones"><button class="btn btn-sec" id="probar" ${libres ? '' : 'disabled'}>${libres ? 'Probar en el simulador' : 'Sin pruebas hasta mañana'}</button></div>
        ${tandas.length ? `<div style="margin-top:12px">${tandas.slice(0, 3).map(a => {
            if (a.estado === 'pendiente') return `<div class="fila-entre peq" style="padding:6px 0;border-top:1px solid var(--hair2)"><span>${a.params.setup.ala} · ${a.params.setup.susp} · ${a.params.setup.marchas}</span><span class="muted">en pista…</span></div>`;
            if (a.estado === 'error') return `<div class="peq mal" style="padding:6px 0;border-top:1px solid var(--hair2)">${esc(a.resultado?.error)}</div>`;
            const r = a.resultado;
            return `<div class="fila-entre peq" style="padding:6px 0;border-top:1px solid var(--hair2)"><span>${[['ala', 'Ala'], ['susp', 'Susp.'], ['marchas', 'Marchas']].map(([k, n]) => `<span class="muted">${n}</span> ${r.setup[k]} ${lectura(r.informe[k])}`).join(' &nbsp;')}</span><button class="btn btn-sec btn-peq" data-usar='${esc(JSON.stringify(r.setup))}'>Usar</button></div>`;
        }).join('')}</div>` : ''}
        <p class="muted peq" style="margin:10px 0 0">Simulador nivel ${nivelSim}: ${nivelSim >= 2 ? 'te dice cuánto te pasas' : 'solo dice si vas alto o bajo'}. El informe llega ${proximoCiclo()}.</p>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h2>Estrategia</h2></div>
        ${tipos.map(tp => {
            const s = ev.sesiones[tp];
            const abierta = s.lockAt > ahora();
            const e = { ...ESTRATEGIA_DEF, ...(Object.values(heredada(tp)?.pilotos || {})[0] || {}) };
            const lluvia = Math.round((ev.meteo?.[tp] || 0) * 100);
            let controles = '<span class="muted peq">Solo cuenta el reglaje</span>';
            if (esQualy(tp)) controles = seg(`riesgo_${tp}`, [[1, 'Seguro'], [2, 'Normal'], [3, 'Al límite']], e.riesgo, abierta);
            if (esCarrera(tp)) controles = `<div class="fila">${seg(`ritmo_${tp}`, [['conservador', 'Suave'], ['equilibrado', 'Normal'], ['ataque', 'Ataque']], e.ritmo, abierta)}${seg(`actitud_${tp}`, [['defensiva', 'Defensiva'], ['normal', 'Normal'], ['agresiva', 'Agresiva']], e.actitud, abierta)}</div>`;
            return `<div class="sesion-estr" style="${abierta ? '' : 'opacity:.45'}">
              <div><b>${esc(SESION_INFO[tp].corto)}</b> ${guardada(tp) ? '<span class="ok peq">✓</span>' : ''}<div class="muted peq">${fecha(s.publishAt)}${lluvia >= 20 ? ` · lluvia ${lluvia}%` : ''}</div></div>
              <div>${controles}</div></div>`;
        }).join('')}
        ${abiertas.length ? `<div class="fila-botones"><button class="btn" id="guardar-estr">Guardar reglaje y estrategia</button></div>` : '<p class="muted peq">Todas las sesiones de este fin de semana están cerradas.</p>'}
        <p class="muted peq" style="margin:10px 0 0">Ataque: más rápido pero más errores y desgaste. Agresiva: adelanta más, con más toques. Al límite: gana décimas en qualy, pero puede anular la vuelta.</p>
      </div>
    </div>`;
    $$('.seg button', el).forEach(b => b.addEventListener('click', () => { if (b.disabled) return; $$('button', b.parentElement).forEach(x => x.classList.toggle('activa', x === b)); }));
    const leerSetup = () => Object.fromEntries(Object.keys(SETUP_PARAMS).map(k => [k, +$(`[name=${k}]`, el).value]));
    $('#probar', el)?.addEventListener('click', () => lanzar('simulador', { eventoId: ev.id, setup: leerSetup() }, 'Coche en pista'));
    $$('[data-usar]', el).forEach(b => b.addEventListener('click', () => {
        const s = JSON.parse(b.dataset.usar);
        for (const k of Object.keys(SETUP_PARAMS)) { const i = $(`[name=${k}]`, el); i.value = s[k]; i.nextElementSibling.value = s[k]; }
        toast('Reglaje copiado. Pulsa Guardar para usarlo.');
    }));
    $('#guardar-estr', el)?.addEventListener('click', async (e) => {
        const btn = e.target; btn.disabled = true;
        const setupNuevo = leerSetup();
        const leer = (n) => $(`.seg[data-nombre="${n}"] .activa`, el)?.dataset.v;
        try {
            for (const tp of abiertas) {
                const base = { ...ESTRATEGIA_DEF, ...(Object.values(heredada(tp)?.pilotos || {})[0] || {}) };
                if (esQualy(tp)) base.riesgo = +(leer(`riesgo_${tp}`) || base.riesgo);
                if (esCarrera(tp)) { base.ritmo = leer(`ritmo_${tp}`) || base.ritmo; base.actitud = leer(`actitud_${tp}`) || base.actitud; }
                const docu = { eventoId: ev.id, tipo: tp, equipoId: eqId, uid: u.uid, setup: setupNuevo, pilotos: Object.fromEntries(pilotosEv.map(p => [p.id, { ...base }])), actualizado: ahora() };
                await store().set(`estrategias/${ev.id}_${tp}_${eqId}`, docu);
                E.estrategias = [...E.estrategias.filter(x => x.tipo !== tp), { id: `${ev.id}_${tp}_${eqId}`, ...docu }];
            }
            toast('Guardado');
            pintarCarrera(); repintar('hoy');
        } catch (err) { console.error(err); toast('No se pudo guardar: alguna sesión ya ha cerrado.', 'error'); btn.disabled = false; }
    });
}
function seg(nombre, opciones, valor, activo) {
    return `<div class="seg" data-nombre="${esc(nombre)}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(valor) ? 'activa' : ''}" ${activo ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;
}
function lectura(txt) {
    const c = /perfecto|bien/.test(txt) ? 'perfecto' : /pelín/.test(txt) ? 'pelin' : /muy/.test(txt) ? 'muy' : 'lejos';
    return `<span class="lectura ${c}">${esc(txt)}</span>`;
}

// ======================================================================
// COCHE: I+D e instalaciones
// ======================================================================
function pintarCoche() {
    const el = $('#p-coche');
    const priv = E.priv;
    const fab = priv.inst?.fabrica || 0;
    const proyectos = (priv.proyectos || []).filter(p => p.tipo === 'area' || p.tipo === 'inst');
    const pendID = pendientes('id_iniciar'), pendInst = pendientes('inst_mejorar');
    const slots = proyectos.filter(p => p.tipo === 'area').length + pendID.length;
    const obra = proyectos.some(p => p.tipo === 'inst') || pendInst.length;
    el.innerHTML = `<div class="rejilla rejilla-2" style="align-items:start">
    <div class="tarjeta">
      <div class="tarjeta-titulo"><h2>Desarrollo</h2><span class="muted peq">${slots} de ${SLOTS_ID} proyectos en marcha</span></div>
      ${Object.entries(AREAS).map(([k, a]) => {
          const n = priv.coche?.[k] || 0;
          const activo = proyectos.find(p => p.tipo === 'area' && p.clave === k) || pendID.find(p => p.params?.area === k);
          const desc = priv.descuentos?.[k] || 0;
          const coste = Math.round(costeMejora(n) * (1 - desc));
          return `<div style="padding:12px 0;border-top:1px solid var(--hair2)">
            <div class="fila-entre"><b>${esc(a.nombre)}</b><span class="muted peq">nivel ${n}/10</span></div>
            <div class="area-nivel" style="margin:8px 0">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>
            ${activo ? proyectoHtml(activo) : n >= NIVEL_MAX_AREA ? '<span class="ok peq">Al máximo</span>' : `
            <div class="fila-entre"><span class="muted peq">${desc ? '<span class="ok">−25% por tu grupo</span> · ' : ''}${dinero(coste)} · ${horasMejora(n, fab, false)} h · ${Math.round(probExitoMejora(n, fab) * 100)}% de éxito</span>
            <span class="fila"><button class="btn btn-sec btn-peq" data-id="${k}" data-urgente="1" ${slots >= SLOTS_ID || priv.presupuesto < coste * RECARGO_URGENTE ? 'disabled' : ''} title="${dinero(coste * RECARGO_URGENTE)} · ${horasMejora(n, fab, true)} h">Urgente</button><button class="btn btn-peq" data-id="${k}" ${slots >= SLOTS_ID || priv.presupuesto < coste ? 'disabled' : ''}>Mejorar</button></span></div>`}
          </div>`;
      }).join('')}
      <p class="muted peq" style="margin:8px 0 0">Cada circuito premia más el motor, la aero o el chasis. La fiabilidad evita averías. Si una mejora falla, recuperas la mitad.</p>
    </div>
    <div class="tarjeta">
      <div class="tarjeta-titulo"><h2>Instalaciones</h2></div>
      ${Object.entries(INSTALACIONES).map(([k, a]) => {
          const n = priv.inst?.[k] || 0;
          const activo = proyectos.find(p => p.tipo === 'inst' && p.clave === k) || pendInst.find(p => p.params?.inst === k);
          return `<div style="padding:12px 0;border-top:1px solid var(--hair2)">
            <div class="fila-entre"><div><b>${esc(a.nombre)}</b> <span class="muted peq">nivel ${n}/${NIVEL_MAX_INST}</span><div class="muted peq">${esc(a.desc)}${k === 'simulador' ? ` Ahora: ${tandasSimulador(n)} pruebas al día.` : ''}</div></div>
            ${activo ? '' : n >= NIVEL_MAX_INST ? '<span class="ok peq">Al máximo</span>' : `<button class="btn btn-sec btn-peq" data-inst="${k}" ${obra || priv.presupuesto < costeInstalacion(n) ? 'disabled' : ''}>Ampliar · ${dinero(costeInstalacion(n))}</button>`}</div>
            ${activo ? `<div style="margin-top:8px">${proyectoHtml(activo)}</div>` : ''}
          </div>`;
      }).join('')}
    </div></div>`;
    $$('[data-id]', el).forEach(b => b.addEventListener('click', async () => {
        const area = b.dataset.id, urgente = !!b.dataset.urgente;
        const n = priv.coche?.[area] || 0;
        const coste = Math.round(costeMejora(n) * (urgente ? RECARGO_URGENTE : 1) * (1 - (priv.descuentos?.[area] || 0)));
        if (!await confirmar(`¿Invertir <b>${dinero(coste)}</b> en ${esc(AREAS[area].nombre.toLowerCase())}${urgente ? ' (urgente)' : ''}?`)) return;
        await lanzar('id_iniciar', { area, urgente }, 'Mejora encargada');
    }));
    $$('[data-inst]', el).forEach(b => b.addEventListener('click', async () => {
        const k = b.dataset.inst, n = priv.inst?.[k] || 0;
        if (!await confirmar(`¿Ampliar ${esc(INSTALACIONES[k].nombre.toLowerCase())} por <b>${dinero(costeInstalacion(n))}</b>? Tarda ${horasInstalacion(n)} h.`)) return;
        await lanzar('inst_mejorar', { inst: k }, 'Obra encargada');
    }));
}
function proyectoHtml(p) {
    if (p.estado === 'pendiente') return `<span class="muted peq">En cola, arranca ${proximoCiclo()}</span>`;
    const frac = Math.max(0, Math.min(1, (ahora() - p.inicio) / (p.fin - p.inicio)));
    return `<div class="fila-entre peq" style="margin-bottom:5px"><span>${p.nivel ? `Trabajando en el nivel ${p.nivel}` : 'En curso'}</span><span class="muted" data-cuenta="${p.fin}" data-corta>${cuentaAtras(p.fin, true)}</span></div>${barra(frac, 1)}`;
}

// ======================================================================
// EQUIPO: pilotos, escaparate, patrocinio y finanzas
// ======================================================================
function pintarEquipo() {
    const el = $('#p-equipo');
    const priv = E.priv;
    const st = d.tabla(liga).pilotos;
    const sp = priv.sponsor && priv.sponsor.temporada === d.temporada ? priv.sponsor : null;
    const attr = (n, v) => `<div style="margin:6px 0"><div class="fila-entre peq"><span class="muted">${n}</span><b>${v ?? '?'}</b></div>${barra(v || 0)}</div>`;
    const escaparate = d.equipo(eqId)?.escaparate || '';
    el.innerHTML = `
    <div class="rejilla rejilla-2" style="margin-bottom:12px">${misPilotos.map(p => {
        const pp = E.pp[p.id] || {};
        const a = pp.attrs || {};
        const moral = pp.moral ?? 60;
        return `<div class="tarjeta">
          <div class="fila-entre"><a class="fila" href="piloto.html?id=${esc(p.id)}">${bandera(p.nac, { ancho: 22 })}<b>${esc(p.nombre)} ${esc(p.apellido)}</b></a><span class="muted peq">#${p.numero ?? ''} · ${p.rol === 'P1' ? 'Piloto 1' : 'Piloto 2'}</span></div>
          <div class="datos" style="margin:12px 0"><div class="dato"><b>${st[p.id]?.pts ?? 0}</b><span>Puntos</span></div><div class="dato"><b>${moral >= 70 ? 'Alta' : moral >= 45 ? 'Normal' : 'Baja'}</b><span>Moral</span></div><div class="dato"><b>${pp.forma > 0.2 ? 'En racha' : pp.forma < -0.2 ? 'Bajón' : 'Normal'}</b><span>Forma</span></div></div>
          ${attr('Ritmo', a.ritmo)}${attr('Consistencia', a.consistencia)}${attr('Agresividad', a.agresividad)}${attr('Lluvia', a.lluvia)}
        </div>`;
    }).join('')}</div>
    <div class="rejilla rejilla-2">
      <div class="pila">
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Patrocinador</h2></div>
          ${sp ? `<div class="fila-entre"><div><b>${esc(sp.marca)}</b><div class="muted peq">${esc(sp.desc)}</div></div><div class="dato" style="text-align:right"><b>${dinero(sp.base)}</b><span>por fin de semana</span></div></div>`
            : pendientes('sponsor_firmar').length ? '<p class="muted">Firmando…</p>'
            : priv.ofertasSponsor?.length ? `<p class="muted peq">Elige uno para toda la temporada.</p><div class="opciones-grid">${priv.ofertasSponsor.map(o => `<button class="opcion" data-sp="${esc(o.id)}"><b>${esc(o.marca)}</b><small>${esc(o.tipo)} · ${dinero(o.base)}${o.bonus ? ` + ${dinero(o.bonus)}` : ''}</small><div class="muted peq" style="margin-top:4px">${esc(o.desc)}</div></button>`).join('')}</div>`
            : '<p class="muted">Las ofertas llegan con el próximo ciclo.</p>'}
        </div>
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h2>Escaparate</h2></div>
          <p class="muted peq">Los pilotos los contrata la liga. Si ofreces a uno, tendrá prioridad para ser el Táctico que cambia de país a final de temporada.</p>
          <div class="seg" id="escaparate">${[{ id: '', t: 'Nadie' }, ...misPilotos.map(p => ({ id: p.id, t: p.apellido }))].map(o => `<button type="button" data-v="${esc(o.id)}" class="${escaparate === o.id ? 'activa' : ''}">${esc(o.t)}</button>`).join('')}</div>
        </div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h2>Movimientos</h2><span class="muted peq">${dinero(priv.presupuesto)}</span></div>
        ${priv.finanzas?.length ? priv.finanzas.slice(0, 12).map(f => `<div class="fila-entre peq" style="padding:7px 0;border-top:1px solid var(--hair2)"><span>${esc(f.c)}<div class="tenue">${hace(f.t)}</div></span><b class="${f.v >= 0 ? 'ok' : 'mal'}">${dinero(f.v, { signo: true })}</b></div>`).join('') : vacio('Sin movimientos todavía.')}
      </div>
    </div>`;
    $$('[data-sp]', el).forEach(b => b.addEventListener('click', async () => {
        const o = priv.ofertasSponsor.find(x => x.id === b.dataset.sp);
        if (!await confirmar(`¿Firmar con <b>${esc(o.marca)}</b> para toda la temporada?`)) return;
        await lanzar('sponsor_firmar', { ofertaId: o.id }, 'Contrato enviado');
    }));
    $$('#escaparate button', el).forEach(b => b.addEventListener('click', async () => {
        $$('#escaparate button', el).forEach(x => x.classList.toggle('activa', x === b));
        await lanzar('tactico_ofrecer', { pilotoId: b.dataset.v || null }, 'Escaparate actualizado');
    }));
}

// ======================================================================
// RIVALES: espionaje
// ======================================================================
function pintarRivales() {
    const el = $('#p-rivales');
    const rivales = Object.entries(d.cat.equipos).filter(([id, x]) => x.liga === liga && id !== eqId);
    const pilotosRivales = Object.entries(d.cat.pilotos).filter(([, p]) => p.liga === liga && p.equipoId && p.equipoId !== eqId);
    const activos = (E.priv.proyectos || []).filter(p => p.tipo === 'espia');
    const informes = E.notifs.filter(n => n.tipo === 'espia').slice(0, 10);
    const tipos = { coche: ['Coche', 'Niveles de su coche'], piloto: ['Piloto', 'Atributos aproximados'], estrategia: ['Estrategia', 'Su reglaje y estrategia guardados'] };
    el.innerHTML = `
    <div class="rejilla rejilla-2">
      <form class="tarjeta" id="f-espia">
        <div class="tarjeta-titulo"><h2>Espiar a un rival</h2></div>
        <div class="opciones-grid">${Object.entries(tipos).map(([k, [n, dsc]], i) => `<button type="button" class="opcion ${i === 0 ? 'activa' : ''}" data-tipo="${k}"><b>${n}</b><small>${dsc} · ${dinero(ECO.costeInvestigacion[k])}</small></button>`).join('')}</div>
        <label style="margin-top:12px">Objetivo<select name="obj-equipo">${rivales.map(([id, x]) => `<option value="${esc(id)}">${esc(x.nombre)}${x.ownerNombre ? ` (${esc(x.ownerNombre)})` : ''}</option>`).join('')}</select><select name="obj-piloto" hidden>${pilotosRivales.map(([id, p]) => `<option value="${esc(id)}">${esc(p.nombre)} ${esc(p.apellido)}</option>`).join('')}</select></label>
        <p class="muted peq" style="margin:8px 0 0">Tarda 1-2 h. Hay un ${Math.round(ECO.probDeteccionEspia * 100)}% de que te pillen y salga en la prensa.</p>
        <div class="fila-botones"><button class="btn">Enviar espías</button></div>
        ${activos.length || pendientes('espiar').length ? `<div style="margin-top:12px">${[...pendientes('espiar').map(() => '<p class="muted peq">Misión en cola…</p>'), ...activos.map(p => `<div style="margin-top:8px"><div class="peq">${esc(tipos[p.clave]?.[0])}: ${esc(p.clave === 'piloto' ? d.nombre(p.objetivo) : d.nombreEquipo(p.objetivo))}</div>${proyectoHtml({ ...p, nivel: 0 })}</div>`)].join('')}</div>` : ''}
      </form>
      <div class="tarjeta"><div class="tarjeta-titulo"><h2>Informes</h2></div>${informes.length ? informes.map(notifHtml).join('') : vacio('Todavía no has espiado a nadie.')}</div>
    </div>`;
    let tipo = 'coche';
    $$('#f-espia .opcion', el).forEach(b => b.addEventListener('click', () => {
        tipo = b.dataset.tipo;
        $$('#f-espia .opcion', el).forEach(x => x.classList.toggle('activa', x === b));
        $('[name=obj-equipo]', el).hidden = tipo === 'piloto';
        $('[name=obj-piloto]', el).hidden = tipo !== 'piloto';
    }));
    $('#f-espia', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const objetivo = tipo === 'piloto' ? $('[name=obj-piloto]', el).value : $('[name=obj-equipo]', el).value;
        if (!await confirmar(`¿Gastar ${dinero(ECO.costeInvestigacion[tipo])} en espiar?`)) return;
        await lanzar('espiar', { tipo, objetivo }, 'Espías en camino');
    });
}

// ======================================================================
// Elegir escudería (usuarios sin equipo)
// ======================================================================
function elegirEquipo() {
    const estado = u.perfil?.estado;
    if (!u.perfil?.isAdmin && estado !== 'aprobado') {
        main.innerHTML = `<div class="caja-auth tarjeta"><h1>${estado === 'denegado' ? 'Solicitud denegada' : 'Pendiente de aprobación'}</h1>
          <p class="muted">${estado === 'denegado' ? 'La organización no ha aprobado esta cuenta.' : 'La organización tiene que aprobar tu cuenta antes de que elijas escudería. Mientras, puedes seguir las ligas.'}</p>
          <div class="fila"><a class="btn btn-sec" href="index.html">Ir al inicio</a><button class="btn" onclick="location.reload()">Comprobar</button></div></div>`;
        return;
    }
    const abierta = d.cfg.inscripcion !== false;
    const libres = Object.entries(d.cat.equipos).filter(([, e]) => !e.ownerId);
    let ligaSel = LIGAS_NACIONALES.find(l => libres.some(([, e]) => e.liga === l)) || 'ESP';
    const pintar = () => {
        const eqs = libres.filter(([, e]) => e.liga === ligaSel);
        main.innerHTML = `<div class="cabecera-pagina"><div><div class="etiqueta">Inscripción</div><h1>Elige tu escudería</h1><p class="sub">Las escuderías sin mánager las lleva la IA.</p></div></div>
        ${!abierta ? '<div class="aviso-caja" style="margin-bottom:12px">La inscripción está cerrada ahora mismo.</div>' : ''}
        <div class="selector-ligas">${LIGAS_NACIONALES.map(l => `<a href="#" data-liga="${l}" class="${l === ligaSel ? 'activo' : ''}">${banderaLiga(l, { ancho: 18, titulo: false })}${esc(LIGAS[l].nombre)} <span class="tenue">${libres.filter(([, e]) => e.liga === l).length}</span></a>`).join('')}</div>
        <div class="tarjeta">${eqs.length ? eqs.map(([id, e]) => {
            const ps = Object.values(d.cat.pilotos).filter(p => p.equipoId === id);
            return `<div class="fila-entre" style="padding:12px 0;border-top:1px solid var(--hair2)">
              <div><div class="chip-equipo" style="color:var(--texto)"><i style="background:${esc(e.color)}"></i><b>${esc(e.nombre)}</b></div><div class="muted peq" style="margin-top:3px">${ps.map(p => `${bandera(p.nac, { ancho: 14 })} ${esc(p.apellido)}`).join(' · ')}</div></div>
              <button class="btn btn-peq" data-reclamar="${esc(id)}" ${abierta ? '' : 'disabled'}>Elegir</button></div>`;
        }).join('') : vacio('No quedan escuderías libres en esta liga.')}</div>`;
        $$('[data-liga]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); ligaSel = a.dataset.liga; pintar(); }));
        $$('[data-reclamar]').forEach(b => b.addEventListener('click', async () => {
            const e = d.equipo(b.dataset.reclamar);
            if (!await confirmar(`¿Dirigir <b>${esc(e.nombre)}</b> toda la temporada?`)) return;
            try {
                await reclamarEquipo(b.dataset.reclamar, u.perfil.nombre);
                limpiarCache();
                toast('¡Bienvenido a la parrilla!');
                setTimeout(() => location.reload(), 800);
            } catch (err) { console.error(err); toast('No se pudo: quizá otro mánager se te adelantó.', 'error'); }
        }));
    };
    pintar();
}
