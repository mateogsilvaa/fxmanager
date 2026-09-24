import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { store, usuario, ahora, encolar, escuchar, escucharConsulta, reclamarEquipo, refrescarPerfil, DEMO } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio, fecha, hace, toast, confirmar, pestanas, $, $$, dinero, barra, cuentaAtras, chipEquipo } from '../core/ui.js';
import { celdaPiloto, pos } from '../core/componentes.js';
import {
    LIGAS, LIGAS_NACIONALES, SESIONES, SESION_INFO, esCarrera, esQualy, AREAS, INSTALACIONES, NIVEL_MAX_AREA, NIVEL_MAX_INST,
    SLOTS_ID, costeMejora, horasMejora, probExitoMejora, RECARGO_URGENTE, costeInstalacion, horasInstalacion, ECO,
    SETUP_PARAMS, ESTRATEGIA_DEF, diaMadrid, tandasSimulador, PAISES,
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
document.documentElement.style.setProperty('--acento', eq.color || LIGAS[liga].color);
const misPilotos = Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eqId).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.rol === 'P1' ? -1 : 1));
const E = { priv: null, pp: {}, acciones: [], notifs: [], decision: null, estrategias: [] };
const hoy = () => diaMadrid(ahora());
const cadencia = d.cfg.cadenciaMin || 10;
const proximoCiclo = () => {
    const ult = d.cfg.tick?.ultimo;
    if (!ult) return 'en el próximo ciclo';
    let t = ult + cadencia * 60_000;
    while (t < ahora()) t += cadencia * 60_000;
    return `hacia las ${new Date(t).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}`;
};

// Eventos en los que corre mi equipo (liga propia + Mundial si tengo pilotos clasificados)
const participantesInt = new Set(d.cfg.mundial?.participantes || []);
const misPilotosInt = misPilotos.filter(p => participantesInt.has(p.id));
const misEventos = [...d.eventosLiga(liga), ...(misPilotosInt.length ? d.eventosLiga('INT') : [])];
const eventoAbierto = misEventos
    .map(ev => ({ ev, cierre: Math.max(...SESIONES.filter(t => ev.sesiones[t]).map(t => ev.sesiones[t].lockAt)) }))
    .filter(x => x.cierre > ahora()).sort((a, b) => a.cierre - b.cierre)[0]?.ev || null;
const pilotosEvento = (ev) => ev?.liga === 'INT' ? misPilotosInt : misPilotos;

main.innerHTML = `
<section class="hero" style="padding:24px;border-top:4px solid ${esc(eq.color)}">
  <div class="fila-entre">
    <div><div class="etiqueta">${banderaLiga(liga)} ${esc(LIGAS[liga].nombre)} · Mánager: ${esc(u.perfil.nombre)}</div>
    <h1 style="margin:6px 0 0">${esc(eq.nombre)}</h1></div>
    <div class="datos" style="min-width:min(100%,460px)" id="cab-datos"></div>
  </div>
</section>
<div class="pestanas" id="tabs">
  <button data-tab="hoy">📋 Hoy</button>
  <button data-tab="estrategia">🎛️ Estrategia</button>
  <button data-tab="simulador">🧪 Simulador</button>
  <button data-tab="id">🔧 I+D</button>
  <button data-tab="pilotos">🧑‍✈️ Pilotos</button>
  <button data-tab="espionaje">🕵️ Espionaje</button>
  <button data-tab="finanzas">💼 Finanzas</button>
  <button data-tab="buzon">📬 Buzón <span id="buzon-n"></span></button>
</div>
${['hoy', 'estrategia', 'simulador', 'id', 'pilotos', 'espionaje', 'finanzas', 'buzon'].map(t => `<section data-panel="${t}" id="p-${t}"><div class="cargando"><span class="spinner"></span>Cargando…</div></section>`).join('')}`;

let tabActual = 'hoy';
const PINTAR = { hoy: pintarHoy, estrategia: pintarEstrategia, simulador: pintarSimulador, id: pintarID, pilotos: pintarPilotos, espionaje: pintarEspionaje, finanzas: pintarFinanzas, buzon: pintarBuzon };
const pintados = new Set();
const repintar = (...tabs) => tabs.forEach(t => { if (pintados.has(t) || t === tabActual) { pintados.add(t); try { PINTAR[t](); } catch (e) { console.error(e); } } });
const irA = pestanas($('#tabs').parentElement, { alCambiar: (id) => { tabActual = id; if (!pintados.has(id) && E.priv) { pintados.add(id); PINTAR[id](); } if (id === 'buzon') marcarLeidas(); } });

// Carga inicial + escuchas en tiempo real
const privRaw = { v: null };
const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
E.pp = Object.fromEntries(await Promise.all(misPilotos.map(async p => [p.id, await store().get(`pilotos_priv/${p.id}`).catch(() => null)])));
if (eventoAbierto) E.estrategias = await store().list('estrategias', [['uid', '==', u.uid], ['eventoId', '==', eventoAbierto.id]]).catch(() => []);
escuchar(`equipos_priv/${eqId}`, (p) => {
    if (iguales(p, privRaw.v)) return;
    privRaw.v = p; E.priv = p || {};
    pintarCabecera();
    if (!pintados.size) { pintados.add(tabActual); PINTAR[tabActual](); }
    else repintar('hoy', 'id', 'finanzas', 'simulador');
});
escucharConsulta('acciones', [['uid', '==', u.uid]], (lista) => {
    const orden = lista.filter(a => a.equipoId === eqId).sort((a, b) => (b.creado || 0) - (a.creado || 0));
    if (iguales(orden, E.acciones)) return;
    const antes = new Map(E.acciones.map(a => [a.id, a.estado]));
    E.acciones = orden;
    for (const a of orden) if (antes.get(a.id) === 'pendiente' && a.estado !== 'pendiente') avisarAccion(a);
    if (E.priv) repintar('hoy', 'simulador', 'id', 'espionaje', 'finanzas');
});
escucharConsulta('notificaciones', [['uid', '==', u.uid]], (lista) => {
    const orden = lista.sort((a, b) => b.fecha - a.fecha);
    if (iguales(orden, E.notifs)) return;
    E.notifs = orden;
    const n = orden.filter(x => !x.leida).length;
    $('#buzon-n').innerHTML = n ? `<span class="insignia despido">${n}</span>` : '';
    if (E.priv) repintar('hoy', 'buzon', 'espionaje');
});
escuchar(`decisiones/${hoy()}_${eqId}`, (dec) => {
    if (iguales(dec, E.decision)) return;
    E.decision = dec;
    if (E.priv) repintar('hoy');
});

function avisarAccion(a) {
    const nombres = { checkin: 'Recompensa diaria', id_iniciar: 'Proyecto de I+D', inst_mejorar: 'Obras', simulador: 'Tanda de simulador', espiar: 'Espionaje', sponsor_firmar: 'Patrocinio', draft: 'Draft' };
    if (a.estado === 'error') toast(`${nombres[a.tipo] || a.tipo}: ${a.resultado?.error}`, 'error');
    else toast(`${nombres[a.tipo] || a.tipo}: ¡hecho!`);
}
const pendientes = (tipo) => E.acciones.filter(a => a.tipo === tipo && a.estado === 'pendiente');
async function lanzar(tipo, params, msgOk = 'Enviado. Se procesará ' ) {
    try { await encolar(tipo, params); toast(`${msgOk}${proximoCiclo()}.`, 'info'); }
    catch (e) { toast(e.message, 'error'); }
}

// ======================================================================
// Cabecera
// ======================================================================
function pintarCabecera() {
    const posLiga = d.clasificacionEquipos(liga).find(x => x.eq === eqId);
    const racha = E.priv.racha?.ultimoDia === hoy() || E.priv.racha?.ultimoDia === diaMadrid(ahora() - 864e5) ? E.priv.racha.n : 0;
    $('#cab-datos').innerHTML = `
      <div class="dato"><b>${dinero(E.priv.presupuesto)}</b><span>Presupuesto</span></div>
      <div class="dato"><b>${posLiga ? posLiga.posicion + 'º' : '—'}</b><span>${posLiga?.pts ?? 0} pts</span></div>
      <div class="dato"><b>🔥 ${racha}</b><span>Racha</span></div>
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
    const tandas = tandasDisponibles(priv, dia);
    const tandasPend = pendientes('simulador').length;
    const dec = E.decision;
    const proxSes = eventoAbierto ? SESIONES.filter(t => eventoAbierto.sesiones[t]).map(t => ({ tipo: t, ...eventoAbierto.sesiones[t] })).find(s => s.lockAt > ahora()) : null;
    const tieneEstrategia = E.estrategias.length > 0;
    const idActivos = (priv.proyectos || []).filter(p => p.tipo === 'area').length + pendientes('id_iniciar').length;
    const sponsorOk = priv.sponsor && priv.sponsor.temporada === d.temporada;
    const tareas = [
        { ok: checkinHecho || checkinPend, txt: 'Recoger la recompensa diaria', ir: null },
        { ok: !!(dec?.eleccion || dec?.aplicada), txt: dec ? 'Responder la decisión del día' : 'Decisión del día (llega con el primer ciclo del día)', ir: null },
        { ok: tandas.quedan - tandasPend <= 0, txt: `Usar las tandas de simulador (${Math.max(0, tandas.quedan - tandasPend)} de ${tandas.max} libres)`, ir: 'simulador', oculta: !eventoAbierto },
        { ok: tieneEstrategia, txt: `Preparar la estrategia de ${eventoAbierto?.circuito?.nombre || 'la próxima carrera'}`, ir: 'estrategia', oculta: !eventoAbierto },
        { ok: idActivos >= SLOTS_ID, txt: `Tener el I+D trabajando (${idActivos}/${SLOTS_ID} proyectos)`, ir: 'id' },
        { ok: sponsorOk, txt: 'Firmar un patrocinador', ir: 'finanzas', oculta: sponsorOk },
    ].filter(t => !t.oculta);
    const hechas = tareas.filter(t => t.ok).length;
    const rachaN = priv.racha?.n || 0;
    const rachaViva = priv.racha?.ultimoDia === dia || priv.racha?.ultimoDia === diaMadrid(ahora() - 864e5);
    const siguienteRacha = rachaViva ? (checkinHecho ? rachaN : rachaN + 1) : 1;
    const premio = ECO.checkinBase + Math.min(siguienteRacha, 7) * ECO.checkinPorRacha + (priv.inst?.marketing || 0) * ECO.checkinPorMarketing;

    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <div class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Tareas de hoy</h2><span class="muted">${hechas}/${tareas.length}</span></div>
          ${barra(hechas, tareas.length)}
          <ul class="lista" style="margin-top:8px">${tareas.map(t => `<li class="fila-entre"><span>${t.ok ? '✅' : '⬜'} ${esc(t.txt)}</span>${!t.ok && t.ir ? `<button class="btn btn-sec btn-peq" data-ir="${t.ir}">Ir</button>` : ''}</li>`).join('')}</ul>
          ${hechas === tareas.length ? '<p class="ok" style="margin:8px 0 0">¡Todo listo por hoy! Vuelve mañana para no perder la racha.</p>' : ''}
        </div>

        <div class="tarjeta"><div class="tarjeta-titulo"><h2>🗓️ Decisión del día</h2>${dec && !dec.aplicada ? `<span class="muted">Caduca en <b data-cuenta="${dec.expira}">${cuentaAtras(dec.expira)}</b></span>` : ''}</div>
          ${decisionHtml(dec)}</div>

        ${proxSes ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Próxima sesión: ${banderaLiga(eventoAbierto.liga)} ${esc(SESION_INFO[proxSes.tipo].nombre)}</h3><button class="btn btn-peq" data-ir="estrategia">Estrategia</button></div>
          <p class="muted">${esc(eventoAbierto.circuito?.nombre)} · ${fecha(proxSes.publishAt)} · estrategias cierran en <b data-cuenta="${proxSes.lockAt}">${cuentaAtras(proxSes.lockAt)}</b> · lluvia ${Math.round((eventoAbierto.meteo?.[proxSes.tipo] || 0) * 100)}%</p></div>` : ''}
      </div>
      <aside class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>🔥 Racha diaria</h3></div>
          <div class="racha">${Array.from({ length: 7 }, (_, i) => `<i class="${i < Math.min(rachaViva ? rachaN : 0, 7) ? 'on' : ''}">${i + 1}</i>`).join('')}</div>
          <p class="muted" style="font-size:.88rem;margin:10px 0">${checkinHecho ? `Recogida. Mañana: ${dinero(ECO.checkinBase + Math.min(rachaN + 1, 7) * ECO.checkinPorRacha + (priv.inst?.marketing || 0) * ECO.checkinPorMarketing)}.` : `Hoy te toca <b style="color:var(--texto)">${dinero(premio)}</b>. Si fallas un día, la racha vuelve a 1.`} Récord: ${priv.racha?.max || 0} días.</p>
          <button class="btn" id="btn-checkin" ${checkinHecho || checkinPend ? 'disabled' : ''}>${checkinHecho ? 'Recogida ✓' : checkinPend ? `En cola ⏳` : 'Recoger recompensa'}</button>
          ${checkinPend ? `<p class="muted" style="font-size:.8rem;margin-top:6px">Se abonará ${proximoCiclo()}.</p>` : ''}
        </div>
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>📬 Últimos avisos</h3><button class="btn btn-sec btn-peq" data-ir="buzon">Todo</button></div>
          ${E.notifs.length ? E.notifs.slice(0, 5).map(notifHtml).join('<div style="height:6px"></div>') : vacio('Sin avisos todavía.', '📭')}
        </div>
      </aside>
    </div>`;
    $$('[data-ir]', el).forEach(b => b.addEventListener('click', () => irA(b.dataset.ir)));
    $('#btn-checkin', el)?.addEventListener('click', () => lanzar('checkin', {}, 'Recompensa en cola: se abonará '));
    $$('[data-op]', el).forEach(b => b.addEventListener('click', async () => {
        try {
            await store().update(`decisiones/${dec.id}`, { eleccion: b.dataset.op });
            E.decision = { ...dec, eleccion: b.dataset.op };
            toast('Decisión tomada. Sus efectos se aplicarán ' + proximoCiclo() + '.', 'info');
            pintarHoy();
        } catch (e) { toast('No se pudo guardar (¿ha caducado?)', 'error'); }
    }));
}

function decisionHtml(dec) {
    if (!dec) return `<p class="muted">Todavía no ha llegado la decisión de hoy. Aparece con el primer ciclo después de medianoche.</p>`;
    if (dec.aplicada) return `<p>${esc(dec.texto)}</p><div class="info-caja">${esc(dec.resultado || 'Aplicada.')}</div>`;
    return `<p style="font-size:1.05rem">${esc(dec.texto)}</p><div class="dec-opciones">${dec.opciones.map(o => `<button data-op="${esc(o.id)}" class="${dec.eleccion === o.id ? 'elegida' : ''}">${dec.eleccion === o.id ? '✓ ' : ''}${esc(o.texto)}</button>`).join('')}</div>
      <p class="muted" style="font-size:.8rem;margin-top:8px">Puedes cambiar de opinión hasta que se aplique. Si no eliges, se aplicará la opción por defecto (normalmente la peor).</p>`;
}

function notifHtml(n) {
    return `<div class="notif ${n.leida ? '' : 'nueva'}"><div class="fila-entre"><h4>${esc(n.titulo)}</h4><span class="meta">${hace(n.fecha)}</span></div><p>${esc(n.texto)}</p><div class="meta">${esc(n.remitente)}</div></div>`;
}

// ======================================================================
// ESTRATEGIA
// ======================================================================
function pintarEstrategia() {
    const el = $('#p-estrategia');
    if (!eventoAbierto) { el.innerHTML = `<div class="tarjeta">${vacio('No hay ningún fin de semana abierto para tu equipo ahora mismo.', '🎛️')}</div>`; return; }
    const ev = eventoAbierto;
    const tipos = SESIONES.filter(t => ev.sesiones[t]);
    const pilotos = pilotosEvento(ev);
    const guardada = (t) => E.estrategias.find(x => x.tipo === t);
    const heredada = (t) => { for (let i = tipos.indexOf(t); i >= 0; i--) { const g = guardada(tipos[i]); if (g) return g; } return null; };
    el.innerHTML = `
    <div class="info-caja" style="margin-bottom:14px">${banderaLiga(ev.liga)} <b>${esc(ev.circuito?.nombre)}</b> · Ronda ${ev.ronda}. Cada sesión se cierra ${d.cfg.minutosCierre || 30} min antes de empezar. Si no guardas una sesión, se usa la última estrategia guardada de ese fin de semana (o la de por defecto).</div>
    ${tipos.map(t => {
        const s = ev.sesiones[t];
        const abierta = s.lockAt > ahora();
        const g = guardada(t), h = heredada(t);
        const setup = h?.setup || E.priv.ultimoSetup || { ala: 5, susp: 5, marchas: 5 };
        const lluvia = Math.round((ev.meteo?.[t] || 0) * 100);
        return `<form class="tarjeta" data-tipo="${t}" style="margin-bottom:12px;${abierta ? '' : 'opacity:.55'}">
          <div class="tarjeta-titulo"><div><h3 style="margin:0">${esc(SESION_INFO[t].nombre)}</h3><span class="muted" style="font-size:.85rem">${fecha(s.publishAt)} · ${lluvia >= 50 ? '🌧️' : lluvia >= 25 ? '🌦️' : '☀️'} ${lluvia}% lluvia</span></div>
            <span class="estado ${abierta ? 'abierta' : 'cerrada'}">${abierta ? `Cierra en <span data-cuenta="${s.lockAt}">${cuentaAtras(s.lockAt)}</span>` : 'Cerrada'}</span></div>
          ${g ? '<p class="ok" style="font-size:.85rem;margin:0 0 8px">✓ Guardada para esta sesión</p>' : h ? `<p class="muted" style="font-size:.85rem;margin:0 0 8px">Heredará la de ${esc(SESION_INFO[h.tipo].corto)} si no la cambias</p>` : '<p class="aviso" style="font-size:.85rem;margin:0 0 8px">Sin estrategia: se usará la de por defecto</p>'}
          <div class="rejilla rejilla-2">
            <div><div class="etiqueta" style="margin-bottom:6px">Reglaje</div>${Object.entries(SETUP_PARAMS).map(([k, p]) => `<div class="setup-param" style="margin:6px 0"><span>${esc(p.nombre)}</span><input type="range" min="1" max="10" name="${k}" value="${setup[k]}" ${abierta ? '' : 'disabled'} oninput="this.nextElementSibling.value=this.value"><output>${setup[k]}</output></div>`).join('')}
              <p class="muted" style="font-size:.78rem">1 = ${esc(SETUP_PARAMS.ala.bajo)} / 10 = ${esc(SETUP_PARAMS.ala.alto)}. Afínalo en el simulador.</p></div>
            <div>${t === 'FP' ? '<p class="muted">En libres solo cuenta el reglaje. Al terminar recibirás el informe del ingeniero con una lectura gratis.</p>' : pilotos.map(p => {
                const e = { ...ESTRATEGIA_DEF, ...(h?.pilotos?.[p.id] || {}) };
                return `<div style="margin-bottom:12px"><div class="fila">${bandera(p.nac)} <b>${esc(p.apellido)}</b></div>
                ${esQualy(t) ? `<div class="etiqueta" style="margin:6px 0 4px">Riesgo en la vuelta</div>${seg(`riesgo_${p.id}`, [[1, 'Seguro'], [2, 'Normal'], [3, 'Al límite']], e.riesgo, abierta)}`
                    : `<div class="etiqueta" style="margin:6px 0 4px">Ritmo</div>${seg(`ritmo_${p.id}`, [['conservador', 'Conservador'], ['equilibrado', 'Equilibrado'], ['ataque', 'Ataque']], e.ritmo, abierta)}
                       <div class="etiqueta" style="margin:8px 0 4px">Actitud</div>${seg(`actitud_${p.id}`, [['defensiva', 'Defensiva'], ['normal', 'Normal'], ['agresiva', 'Agresiva']], e.actitud, abierta)}`}</div>`;
            }).join('')}</div>
          </div>
          ${abierta ? `<div class="fila-botones"><button type="button" class="btn btn-sec btn-peq" data-copiar="${t}">Aplicar a todas las sesiones siguientes</button><button class="btn btn-peq">Guardar ${esc(SESION_INFO[t].corto)}</button></div>` : ''}
        </form>`;
    }).join('')}
    <div class="tarjeta"><h3>¿Qué hace cada cosa?</h3><ul class="lista muted" style="font-size:.88rem">
      <li><b>Riesgo en qualy:</b> "Al límite" gana unas décimas pero multiplica los errores (vuelta anulada o accidente).</li>
      <li><b>Ritmo:</b> "Ataque" es más rápido al principio pero gasta más neumático, comete más errores y fuerza la mecánica. En la Carrera 3 (15 vueltas) el desgaste pesa más.</li>
      <li><b>Actitud:</b> "Agresiva" adelanta más, pero hay más toques; "Defensiva" aguanta mejor la posición.</li>
      <li><b>Lluvia:</b> el reglaje cuenta la mitad y la habilidad del piloto en mojado mucho más.</li></ul></div>`;
    $$('.seg button', el).forEach(b => b.addEventListener('click', () => { if (b.disabled) return; $$('button', b.parentElement).forEach(x => x.classList.toggle('activa', x === b)); }));
    $$('form[data-tipo]', el).forEach(f => f.addEventListener('submit', async (e) => { e.preventDefault(); await guardarEstrategia([f.dataset.tipo], f); }));
    $$('[data-copiar]', el).forEach(b => b.addEventListener('click', async () => {
        const f = b.closest('form');
        const restantes = tipos.slice(tipos.indexOf(f.dataset.tipo)).filter(t => ev.sesiones[t].lockAt > ahora());
        await guardarEstrategia(restantes, f);
    }));
}

function seg(nombre, opciones, valor, activo) {
    return `<div class="seg" data-nombre="${esc(nombre)}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(valor) ? 'activa' : ''}" ${activo ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;
}

async function guardarEstrategia(tipos, form) {
    const ev = eventoAbierto;
    const setup = {};
    Object.keys(SETUP_PARAMS).forEach(k => { setup[k] = +form.querySelector(`[name=${k}]`).value; });
    const leer = (n) => form.querySelector(`.seg[data-nombre="${n}"] .activa`)?.dataset.v;
    const pilotosForm = {};
    for (const p of pilotosEvento(ev)) {
        const r = leer(`riesgo_${p.id}`), ri = leer(`ritmo_${p.id}`), ac = leer(`actitud_${p.id}`);
        pilotosForm[p.id] = { riesgo: r ? +r : undefined, ritmo: ri, actitud: ac };
    }
    try {
        for (const t of tipos) {
            const previa = E.estrategias.find(x => x.tipo === t);
            const pil = {};
            for (const p of pilotosEvento(ev)) {
                const base = { ...ESTRATEGIA_DEF, ...(previa?.pilotos?.[p.id] || {}) };
                const f = pilotosForm[p.id];
                if (esQualy(t) && f.riesgo) base.riesgo = f.riesgo;
                if (esCarrera(t) && f.ritmo) { base.ritmo = f.ritmo; base.actitud = f.actitud; }
                if (esQualy(form.dataset.tipo) === esQualy(t) || esCarrera(form.dataset.tipo) === esCarrera(t) || !previa) pil[p.id] = base;
                else pil[p.id] = { ...ESTRATEGIA_DEF, ...(previa?.pilotos?.[p.id] || {}) };
            }
            const doc = { eventoId: ev.id, tipo: t, equipoId: eqId, uid: u.uid, setup, pilotos: pil, actualizado: ahora() };
            await store().set(`estrategias/${ev.id}_${t}_${eqId}`, doc);
            E.estrategias = [...E.estrategias.filter(x => x.tipo !== t), { id: `${ev.id}_${t}_${eqId}`, ...doc }];
        }
        toast(`Estrategia guardada (${tipos.map(t => SESION_INFO[t].corto).join(', ')})`);
        pintarEstrategia();
        repintar('hoy');
    } catch (e) { console.error(e); toast('No se pudo guardar: la sesión puede estar ya cerrada.', 'error'); }
}

// ======================================================================
// SIMULADOR
// ======================================================================
function pintarSimulador() {
    const el = $('#p-simulador');
    if (!eventoAbierto) { el.innerHTML = `<div class="tarjeta">${vacio('El simulador se abre cuando hay un fin de semana por delante.', '🧪')}</div>`; return; }
    const ev = eventoAbierto;
    const dia = hoy();
    const t = tandasDisponibles(E.priv, dia);
    const pend = pendientes('simulador').filter(a => a.params?.eventoId === ev.id);
    const libres = Math.max(0, t.quedan - pend.length);
    const tandas = E.acciones.filter(a => a.tipo === 'simulador' && a.params?.eventoId === ev.id);
    const ultima = tandas.find(a => a.estado === 'hecha')?.resultado?.setup || E.estrategias[0]?.setup || { ala: 5, susp: 5, marchas: 5 };
    const nivel = E.priv.inst?.simulador || 0;
    const fpInforme = E.notifs.find(n => n.tipo === 'setup' && n.titulo.includes(ev.circuito?.nombre || '@@'));
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <form class="tarjeta tarjeta-acento" id="f-sim">
          <div class="tarjeta-titulo"><h2>Tanda en el simulador</h2><span class="estado ${libres ? 'abierta' : 'cerrada'}">${libres} de ${t.max} tandas libres hoy</span></div>
          <p class="muted">${banderaLiga(ev.liga)} ${esc(ev.circuito?.nombre)}. El reglaje ideal es secreto y distinto para cada coche. Prueba combinaciones y lee el informe del ingeniero.</p>
          ${Object.entries(SETUP_PARAMS).map(([k, p]) => `<div class="setup-param" style="margin:10px 0"><span>${esc(p.nombre)} <small class="muted">(${esc(p.bajo)} → ${esc(p.alto)})</small></span><input type="range" min="1" max="10" name="${k}" value="${ultima[k]}" oninput="this.nextElementSibling.value=this.value"><output>${ultima[k]}</output></div>`).join('')}
          <div class="fila-botones"><button class="btn" ${libres ? '' : 'disabled'}>${libres ? 'Enviar el coche a pista' : 'Sin tandas: vuelve mañana'}</button></div>
          <p class="muted" style="font-size:.8rem">El informe llega ${proximoCiclo()} (el servidor procesa cada ~${cadencia} min). Nivel de simulador ${nivel}: ${nivel >= 2 ? 'lecturas precisas (cuánto te pasas)' : 'solo te dice si vas alto o bajo, y a veces se equivoca'}.</p>
        </form>
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Tandas de este fin de semana</h3></div>
          ${tandas.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Cuándo</th><th class="cen">Ala</th><th class="cen">Susp.</th><th class="cen">Marchas</th><th>Sensación</th></tr></thead><tbody>
          ${tandas.map(a => {
              const r = a.resultado;
              if (a.estado === 'pendiente') return `<tr><td class="muted">${hace(a.creado)}</td><td class="cen">${a.params.setup.ala}</td><td class="cen">${a.params.setup.susp}</td><td class="cen">${a.params.setup.marchas}</td><td class="muted">⏳ En pista…</td></tr>`;
              if (a.estado === 'error') return `<tr><td class="muted">${hace(a.creado)}</td><td colspan="4" class="mal">${esc(r?.error)}</td></tr>`;
              return `<tr><td class="muted">${hace(a.creado)}</td>${['ala', 'susp', 'marchas'].map(k => `<td class="cen">${r.setup[k]} ${lectura(r.informe[k])}</td>`).join('')}<td style="font-size:.85rem">${esc(r.informe.sensacion)}</td></tr>`;
          }).join('')}</tbody></table></div>` : vacio('Aún no has probado ningún reglaje para este circuito.', '🧪')}
        </div>
      </div>
      <aside class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Cómo leer el informe</h3></div><ul class="lista" style="font-size:.88rem">
          <li>${lectura('perfecto')} Clavado.</li><li>${lectura('un pelín alto')} A 1 punto.</li><li>${lectura('alto')} A 2-3 puntos.</li><li>${lectura('muy alto')} A 4 o más.</li></ul>
          <p class="muted" style="font-size:.85rem">Cuando lo tengas, cópialo en la pestaña Estrategia. Con el reglaje perfecto ganas hasta ~0,8% por vuelta.</p></div>
        ${fpInforme ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Informe de libres</h3></div>${notifHtml(fpInforme)}</div>` : ''}
      </aside>
    </div>`;
    $('#f-sim', el).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const setup = Object.fromEntries(Object.keys(SETUP_PARAMS).map(k => [k, +f.querySelector(`[name=${k}]`).value]));
        await lanzar('simulador', { eventoId: ev.id, setup }, 'Coche en pista. El informe llegará ');
    });
}
function lectura(txt) {
    const c = /perfecto|bien/.test(txt) ? 'perfecto' : /pelín/.test(txt) ? 'pelin' : /muy/.test(txt) ? 'muy' : 'lejos';
    return `<span class="lectura ${c}">${esc(txt)}</span>`;
}

// ======================================================================
// I+D E INSTALACIONES
// ======================================================================
function pintarID() {
    const el = $('#p-id');
    const priv = E.priv;
    const fab = priv.inst?.fabrica || 0;
    const proyectos = (priv.proyectos || []).filter(p => p.tipo === 'area' || p.tipo === 'inst');
    const pendID = pendientes('id_iniciar'), pendInst = pendientes('inst_mejorar');
    const slotsUsados = proyectos.filter(p => p.tipo === 'area').length + pendID.length;
    const obraActiva = proyectos.some(p => p.tipo === 'inst') || pendInst.length;
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Desarrollo del coche</h2><span class="muted">${slotsUsados}/${SLOTS_ID} proyectos en marcha</span></div>
          <div class="rejilla rejilla-2">${Object.entries(AREAS).map(([k, a]) => {
              const n = priv.coche?.[k] || 0;
              const activo = proyectos.find(p => p.tipo === 'area' && p.clave === k) || pendID.find(p => p.params?.area === k);
              const max = n >= NIVEL_MAX_AREA;
              const coste = costeMejora(n);
              return `<div class="tarjeta" style="background:var(--panel-2)">
                <div class="fila-entre"><b>${a.icono} ${esc(a.nombre)}</b><span class="cuenta" style="font-size:1.5rem">${n}</span></div>
                <div class="area-nivel" style="margin:8px 0">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>
                ${activo ? proyectoHtml(activo) : max ? '<p class="ok">Al máximo</p>' : `
                <p class="muted" style="font-size:.82rem;margin:0 0 8px">Nivel ${n + 1}: ${dinero(coste)} · ${horasMejora(n, fab, false)} h · ${Math.round(probExitoMejora(n, fab) * 100)}% éxito</p>
                <div class="fila"><button class="btn btn-peq" data-id="${k}" ${slotsUsados >= SLOTS_ID || priv.presupuesto < coste ? 'disabled' : ''}>Desarrollar</button>
                <button class="btn btn-sec btn-peq" data-id="${k}" data-urgente="1" ${slotsUsados >= SLOTS_ID || priv.presupuesto < coste * RECARGO_URGENTE ? 'disabled' : ''} title="${dinero(coste * RECARGO_URGENTE)} · ${horasMejora(n, fab, true)} h">⚡ Urgente</button></div>`}
              </div>`;
          }).join('')}</div>
          <p class="muted" style="font-size:.82rem;margin-top:10px">Motor, aero y chasis pesan distinto en cada circuito. La fiabilidad reduce las averías. Si un proyecto falla recuperas la mitad del dinero. La temporada siguiente cada área pierde 2 niveles por el cambio de reglamento técnico.</p>
        </div>
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Instalaciones</h2>${obraActiva ? '<span class="estado cerrada">Obra en curso</span>' : ''}</div>
          <div class="rejilla rejilla-3">${Object.entries(INSTALACIONES).map(([k, a]) => {
              const n = priv.inst?.[k] || 0;
              const activo = proyectos.find(p => p.tipo === 'inst' && p.clave === k) || pendInst.find(p => p.params?.inst === k);
              return `<div class="tarjeta" style="background:var(--panel-2)"><div class="fila-entre"><b>${esc(a.nombre)}</b><span class="cuenta" style="font-size:1.4rem">${n}/${NIVEL_MAX_INST}</span></div>
                <p class="muted" style="font-size:.82rem">${esc(a.desc)}${k === 'simulador' ? ` Ahora: ${tandasSimulador(n)} tandas/día.` : ''}</p>
                ${activo ? proyectoHtml(activo) : n >= NIVEL_MAX_INST ? '<p class="ok">Al máximo</p>' : `<button class="btn btn-sec btn-peq" data-inst="${k}" ${obraActiva || priv.presupuesto < costeInstalacion(n) ? 'disabled' : ''}>Ampliar · ${dinero(costeInstalacion(n))} · ${horasInstalacion(n)} h</button>`}</div>`;
          }).join('')}</div>
        </div>
      </div>
      <aside class="pila"><div class="tarjeta"><div class="tarjeta-titulo"><h3>Tu coche</h3></div>
        ${Object.entries(AREAS).map(([k, a]) => `<div style="margin:8px 0"><div class="fila-entre" style="font-size:.9rem"><span>${a.icono} ${esc(a.nombre)}</span><b>${priv.coche?.[k] || 0}/10</b></div>${barra(priv.coche?.[k] || 0, 10)}</div>`).join('')}
        <p class="muted" style="font-size:.82rem">Los rivales no ven estos niveles… salvo que te espíen.</p></div></aside>
    </div>`;
    $$('[data-id]', el).forEach(b => b.addEventListener('click', async () => {
        const area = b.dataset.id, urgente = !!b.dataset.urgente;
        const n = priv.coche?.[area] || 0;
        const coste = Math.round(costeMejora(n) * (urgente ? RECARGO_URGENTE : 1));
        if (!await confirmar(`¿Invertir <b>${dinero(coste)}</b> en ${esc(AREAS[area].nombre)} (nivel ${n + 1})${urgente ? ' en modo urgente' : ''}?`)) return;
        await lanzar('id_iniciar', { area, urgente }, 'Proyecto enviado. Arrancará ');
    }));
    $$('[data-inst]', el).forEach(b => b.addEventListener('click', async () => {
        const k = b.dataset.inst, n = priv.inst?.[k] || 0;
        if (!await confirmar(`¿Ampliar ${esc(INSTALACIONES[k].nombre)} a nivel ${n + 1} por <b>${dinero(costeInstalacion(n))}</b>?`)) return;
        await lanzar('inst_mejorar', { inst: k }, 'Obra encargada. Empezará ');
    }));
}
function proyectoHtml(p) {
    if (p.estado === 'pendiente') return `<p class="muted" style="font-size:.85rem">⏳ En cola: arrancará ${proximoCiclo()}.</p>`;
    const frac = Math.max(0, Math.min(1, (ahora() - p.inicio) / (p.fin - p.inicio)));
    return `<div style="font-size:.85rem"><div class="fila-entre"><span>Trabajando en nivel ${p.nivel}${p.urgente ? ' ⚡' : ''}</span><span class="muted" data-cuenta="${p.fin}">${cuentaAtras(p.fin)}</span></div>${barra(frac, 1)}<p class="muted" style="font-size:.78rem;margin-top:4px">Termina ${fecha(p.fin)}</p></div>`;
}

// ======================================================================
// PILOTOS
// ======================================================================
function pintarPilotos() {
    const el = $('#p-pilotos');
    const st = d.tabla(liga).pilotos;
    const attr = (n, v) => `<div style="margin:6px 0"><div class="fila-entre" style="font-size:.88rem"><span>${n}</span><b>${v ?? '?'}</b></div>${barra(v || 0)}</div>`;
    el.innerHTML = `<div class="rejilla rejilla-2">${misPilotos.map(p => {
        const pp = E.pp[p.id] || {};
        const a = pp.attrs || {};
        const s = st[p.id];
        const moral = pp.moral ?? 60;
        return `<div class="tarjeta"><div class="fila-entre"><div class="fila">${bandera(p.nac, { ancho: 28 })}<div><div>${esc(p.nombre)}</div><a href="piloto.html?id=${esc(p.id)}"><b style="font-family:var(--f-titulo);font-size:1.6rem;text-transform:uppercase">${esc(p.apellido)}</b></a></div></div><span class="dorsal" style="font-size:2.4rem;color:${esc(eq.color)}">${p.numero ?? ''}</span></div>
          <div class="fila" style="margin:6px 0">${p.rol === 'P1' ? '<span class="insignia p1">Piloto 1</span>' : '<span class="insignia">Piloto 2</span>'}${p.rookie ? '<span class="insignia rookie">Rookie</span>' : ''}<span class="muted">${esc(PAISES[p.nac] || '')} · ${p.edad ?? '?'} años · ${dinero(pp.salario)} por fin de semana</span></div>
          <div class="datos" style="margin:10px 0"><div class="dato"><b>${s?.pts ?? 0}</b><span>Puntos</span></div><div class="dato"><b>${s?.victorias ?? 0}</b><span>Victorias</span></div><div class="dato"><b>${s?.eficacia ?? '—'}</b><span>Eficacia</span></div></div>
          <div class="fila-entre" style="margin:6px 0"><span>Moral</span><b>${moral >= 75 ? '😄' : moral >= 60 ? '🙂' : moral >= 45 ? '😐' : moral >= 30 ? '😟' : '😠'} ${moral}</b></div>${barra(moral, 100, moral < 40 ? 'var(--mal)' : moral > 70 ? 'var(--ok)' : undefined)}
          <div class="fila-entre" style="margin:8px 0 4px"><span>Forma</span><b>${pp.forma > 0.2 ? '🔥 En racha' : pp.forma < -0.2 ? '🧊 Bajón' : 'Normal'}</b></div>
          <div class="etiqueta" style="margin-top:12px">Atributos</div>
          ${attr('Ritmo', a.ritmo)}${attr('Consistencia', a.consistencia)}${attr('Agresividad', a.agresividad)}${attr('Adelantamiento', a.adelantamiento)}${attr('Defensa', a.defensa)}${attr('Lluvia', a.lluvia)}${attr('Experiencia', a.experiencia)}
        </div>`;
    }).join('')}</div>
    <p class="muted" style="margin-top:12px;font-size:.85rem">La moral sube con buenos resultados y ganando al compañero, y se mueve con tus decisiones diarias. Afecta al ritmo. Los rookies mejoran carrera a carrera.</p>`;
}

// ======================================================================
// ESPIONAJE
// ======================================================================
function pintarEspionaje() {
    const el = $('#p-espionaje');
    const rivales = Object.entries(d.cat.equipos).filter(([id, x]) => x.liga === liga && id !== eqId);
    const pilotosRivales = Object.entries(d.cat.pilotos).filter(([, p]) => p.liga === liga && p.equipoId && p.equipoId !== eqId);
    const activos = (E.priv.proyectos || []).filter(p => p.tipo === 'espia');
    const informes = E.notifs.filter(n => n.tipo === 'espia');
    const tipos = { coche: ['Coche', 'Niveles de motor, aero, chasis y fiabilidad de un rival.'], piloto: ['Piloto', 'Atributos aproximados y moral de un piloto rival.'], estrategia: ['Estrategia', 'Reglaje y estrategia que tiene guardados un rival para el próximo fin de semana.'] };
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <form class="tarjeta" id="f-espia"><div class="tarjeta-titulo"><h2>Nueva misión</h2></div>
          <div class="opciones-grid">${Object.entries(tipos).map(([k, [n, dsc]], i) => `<button type="button" class="opcion ${i === 0 ? 'activa' : ''}" data-tipo="${k}"><b>${n}</b><small>${dsc}</small><div class="muted" style="font-size:.8rem;margin-top:6px">${dinero(ECO.costeInvestigacion[k])} · ${ECO.horasInvestigacion[k]} h</div></button>`).join('')}</div>
          <label style="margin-top:12px">Objetivo<select name="obj-equipo">${rivales.map(([id, x]) => `<option value="${esc(id)}">${esc(x.nombre)}</option>`).join('')}</select><select name="obj-piloto" hidden>${pilotosRivales.map(([id, p]) => `<option value="${esc(id)}">${esc(p.nombre)} ${esc(p.apellido)} (${esc(d.equipo(p.equipoId)?.corto || '')})</option>`).join('')}</select></label>
          <p class="aviso" style="font-size:.82rem;margin-top:8px">Hay un ${Math.round(ECO.probDeteccionEspia * 100)}% de que te pillen: el rival se entera y sale en la prensa.</p>
          <div class="fila-botones"><button class="btn">Enviar espías</button></div>
        </form>
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Informes recibidos</h3></div>${informes.length ? informes.slice(0, 15).map(notifHtml).join('<div style="height:6px"></div>') : vacio('Sin informes todavía.', '🕵️')}</div>
      </div>
      <aside class="tarjeta"><div class="tarjeta-titulo"><h3>Misiones en curso</h3></div>
        ${activos.length || pendientes('espiar').length ? [...pendientes('espiar').map(p => `<p class="muted">⏳ ${esc(p.params.tipo)} · en cola</p>`), ...activos.map(p => `<div style="margin-bottom:10px"><b>${esc(tipos[p.clave]?.[0])}</b> · <span class="muted">${esc(p.clave === 'piloto' ? d.nombre(p.objetivo) : d.nombreEquipo(p.objetivo))}</span>${proyectoHtml({ ...p, nivel: '' }).replace('Trabajando en nivel ', 'Investigando')}</div>`)].join('') : vacio('Nadie espiando ahora mismo.', '🕶️')}
      </aside>
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
        await lanzar('espiar', { tipo, objetivo }, 'Espías en camino. Salen ');
    });
}

// ======================================================================
// FINANZAS Y PATROCINIO
// ======================================================================
function pintarFinanzas() {
    const el = $('#p-finanzas');
    const priv = E.priv;
    const sp = priv.sponsor && priv.sponsor.temporada === d.temporada ? priv.sponsor : null;
    const pend = pendientes('sponsor_firmar').length;
    const sueldos = misPilotos.reduce((s, p) => s + (E.pp[p.id]?.salario || 0), 0);
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Patrocinador</h2></div>
          ${sp ? `<div class="fila-entre"><div><h3 style="margin:0">${esc(sp.marca)}</h3><p class="muted">${esc(sp.tipo)} · ${esc(sp.desc)}</p></div><div class="dato"><b>${dinero(sp.base)}</b><span>por fin de semana</span></div></div>${sp.bonus ? `<p>Bonus: <b>${dinero(sp.bonus)}</b> si se cumple el objetivo.</p>` : ''}`
            : pend ? '<p class="muted">⏳ Firmando contrato…</p>'
            : priv.ofertasSponsor?.length ? `<p class="muted">Elige uno para toda la temporada. Se paga al terminar cada fin de semana.</p><div class="opciones-grid">${priv.ofertasSponsor.map(o => `<button class="opcion" data-sp="${esc(o.id)}"><b>${esc(o.marca)}</b><small>${esc(o.tipo)}</small><div style="margin:6px 0">${dinero(o.base)} fijo${o.bonus ? ` + ${dinero(o.bonus)} bonus` : ''}</div><small>${esc(o.desc)}</small></button>`).join('')}</div>`
            : '<p class="muted">Las ofertas de patrocinio llegarán con el próximo ciclo diario.</p>'}
        </div>
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Movimientos</h2></div>
          ${priv.finanzas?.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${priv.finanzas.map(f => `<tr><td class="muted" style="white-space:nowrap">${fecha(f.t)}</td><td>${esc(f.c)}</td><td class="der num ${f.v >= 0 ? 'ok' : 'mal'}">${dinero(f.v, { signo: true })}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin movimientos todavía.', '💶')}
        </div>
      </div>
      <aside class="pila"><div class="tarjeta"><div class="tarjeta-titulo"><h3>Resumen</h3></div><ul class="lista">
        <li class="fila-entre"><span class="muted">Presupuesto</span><b>${dinero(priv.presupuesto)}</b></li>
        <li class="fila-entre"><span class="muted">Salarios por fin de semana</span><b class="mal">−${dinero(sueldos)}</b></li>
        <li class="fila-entre"><span class="muted">Premio por punto</span><b>${dinero(ECO.premioPorPunto)}</b></li>
        <li class="fila-entre"><span class="muted">Recompensa diaria máx.</span><b>${dinero(ECO.checkinBase + 7 * ECO.checkinPorRacha + (priv.inst?.marketing || 0) * ECO.checkinPorMarketing)}</b></li>
      </ul></div></aside>
    </div>`;
    $$('[data-sp]', el).forEach(b => b.addEventListener('click', async () => {
        const o = priv.ofertasSponsor.find(x => x.id === b.dataset.sp);
        if (!await confirmar(`¿Firmar con <b>${esc(o.marca)}</b> para toda la temporada? No se puede cambiar.`)) return;
        await lanzar('sponsor_firmar', { ofertaId: o.id }, 'Contrato enviado. Se firmará ');
    }));
}

// ======================================================================
// BUZÓN
// ======================================================================
function pintarBuzon() {
    const el = $('#p-buzon');
    el.innerHTML = `<div class="tarjeta"><div class="tarjeta-titulo"><h2>Buzón</h2><span class="muted">${E.notifs.length} mensajes</span></div>
      ${E.notifs.length ? `<div style="display:grid;gap:8px">${E.notifs.slice(0, 80).map(notifHtml).join('')}</div>` : vacio('No tienes mensajes.', '📭')}</div>`;
}
async function marcarLeidas() {
    const sin = E.notifs.filter(n => !n.leida).slice(0, 50);
    if (!sin.length) return;
    try { await Promise.all(sin.map(n => store().update(`notificaciones/${n.id}`, { leida: true }))); } catch { }
}

// ======================================================================
// Elegir escudería (usuarios sin equipo)
// ======================================================================
function elegirEquipo() {
    const abierta = d.cfg.inscripcion !== false;
    const libres = Object.entries(d.cat.equipos).filter(([, e]) => !e.ownerId);
    main.innerHTML = `<div class="cabecera-pagina"><div><h1>Elige tu escudería</h1><p class="sub">Hola, ${esc(u.perfil?.nombre)}. Cada mánager dirige una escudería. Las que no tienen mánager las lleva la IA.</p></div></div>
    ${!abierta ? '<div class="aviso-caja">La inscripción está cerrada ahora mismo. Pide a la organización que la abra.</div>' : ''}
    ${LIGAS_NACIONALES.map(l => {
        const eqs = libres.filter(([, e]) => e.liga === l);
        return `<div class="tarjeta" style="margin-bottom:14px"><div class="tarjeta-titulo"><h2>${banderaLiga(l, { ancho: 28 })} ${esc(LIGAS[l].nombre)}</h2><span class="muted">${eqs.length} libres</span></div>
        ${eqs.length ? `<div class="rejilla rejilla-auto">${eqs.map(([id, e]) => {
            const ps = Object.values(d.cat.pilotos).filter(p => p.equipoId === id);
            const st = d.clasificacionEquipos(l).find(x => x.eq === id);
            return `<div class="tarjeta" style="background:var(--panel-2);border-left:4px solid ${esc(e.color)}"><b>${esc(e.nombre)}</b>${e.grupo ? ` <span class="muted">· ${esc(e.grupo)}</span>` : ''}
            <div class="muted" style="font-size:.85rem;margin:6px 0">${ps.map(p => `${bandera(p.nac)} ${esc(p.apellido)}`).join(' · ')}</div>
            <div class="muted" style="font-size:.8rem">${st?.posicion ? `${st.posicion}º · ${st.pts} pts` : ''}</div>
            <button class="btn btn-peq" data-reclamar="${esc(id)}" style="margin-top:8px" ${abierta ? '' : 'disabled'}>Dirigir</button></div>`;
        }).join('')}</div>` : '<p class="muted">Todas ocupadas.</p>'}</div>`;
    }).join('')}`;
    $$('[data-reclamar]').forEach(b => b.addEventListener('click', async () => {
        const e = d.equipo(b.dataset.reclamar);
        if (!await confirmar(`¿Quieres dirigir <b>${esc(e.nombre)}</b>? Es para toda la temporada.`)) return;
        try {
            await reclamarEquipo(b.dataset.reclamar, u.perfil.nombre);
            limpiarCache();
            toast('¡Bienvenido a la parrilla!');
            setTimeout(() => location.reload(), 800);
        } catch (err) { console.error(err); toast('No se pudo: quizá otro mánager se te adelantó.', 'error'); }
    }));
}
void chipEquipo; void celdaPiloto; void pos; void DEMO;
