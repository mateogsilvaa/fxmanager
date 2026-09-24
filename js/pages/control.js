import { montar } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { store, usuario, esAdmin, ahora, DEMO } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio, fecha, hace, toast, confirmar, modal, pestanas, $, $$, dinero } from '../core/ui.js';
import { LIGAS, LIGAS_NACIONALES, SESIONES, SESION_INFO, PAISES, NAC_LOCAL } from '../engine/constants.js';
import { CIRCUITOS, CIRCUITOS_POR_ID, normalizarCircuito, tiempoReferencia } from '../engine/circuitos.js';
import { formatoTiempo } from '../engine/sim.js';
import { ejecutarTick } from '../jobs/tick.js';
import { reconstruirCatalogo } from '../jobs/catalogo.js';
import { crearContexto, horarioSesion, idResumen, idResultado } from '../jobs/comun.js';
import { compactar } from '../engine/stats.js';
import {
    inicializarJuego, borrarTodo, validarParrilla, importarParrilla, crearEvento, guardarEventos, borrarEvento,
    prepararMercado, cerrarMercado, nuevaTemporada,
} from '../jobs/temporada.js';

await montar({ activo: 'control' });
const main = document.getElementById('main');
if (!esAdmin()) { main.innerHTML = vacio('No tienes acceso a esta página.'); throw new Error('no admin'); }
const PATRON = { FP: [0, '18:00'], Q1: [0, '19:00'], R1: [1, '18:00'], Q2: [1, '19:00'], R2: [2, '18:00'], R3: [2, '19:00'] };
let d = await cargarDatos();
let cfg = (await store().get('config/juego')) || null;

main.innerHTML = `
<div class="cabecera-pagina"><div><h1>Control</h1><p class="sub">Panel de la organización. ${DEMO ? '<b class="aviso">Modo demo: los cambios solo viven en esta pestaña.</b>' : ''}</p></div></div>
<div class="pestanas" id="tabs">
  <button data-tab="estado">Estado y ciclo</button><button data-tab="calendario">Calendario</button><button data-tab="parrilla">Parrilla</button>
  <button data-tab="usuarios">Usuarios</button><button data-tab="noticias">Noticias</button><button data-tab="temporada">Temporada</button>
</div>
${['estado', 'calendario', 'parrilla', 'usuarios', 'noticias', 'temporada'].map(t => `<section data-panel="${t}" id="p-${t}"></section>`).join('')}`;
const PINTAR = { estado: pintarEstado, calendario: pintarCalendario, parrilla: pintarParrilla, usuarios: pintarUsuarios, noticias: pintarNoticias, temporada: pintarTemporada };
pestanas($('#tabs').parentElement, { alCambiar: (id) => PINTAR[id]() });

async function recargar() { limpiarCache(); d = await cargarDatos(); cfg = await store().get('config/juego'); }
const ocupado = async (btn, fn) => {
    const txt = btn.textContent; btn.disabled = true; btn.textContent = 'Trabajando…';
    try { await fn(); } catch (e) { console.error(e); toast(e.message || String(e), 'error'); } finally { btn.disabled = false; btn.textContent = txt; }
};

// ======================================================================
// ESTADO
// ======================================================================
async function pintarEstado() {
    const el = $('#p-estado');
    if (!cfg) {
        el.innerHTML = `<div class="tarjeta">${vacio('El juego no está inicializado.')}<div class="fila-botones" style="justify-content:center"><button class="btn" id="ini">Inicializar temporada 1</button></div></div>`;
        $('#ini').addEventListener('click', (e) => ocupado(e.target, async () => { await inicializarJuego(store()); await recargar(); pintarEstado(); }));
        return;
    }
    const logs = await store().list('logs', [], { orden: ['ultimo', 'desc'], limit: 15 }).catch(() => []);
    const tick = cfg.tick || {};
    const retraso = tick.ultimo ? ahora() - tick.ultimo : null;
    const pend = await store().list('acciones', [['estado', '==', 'pendiente']]).catch(() => []);
    const prox = d.proximas(6);
    const solicitudes = (await store().list('usuarios').catch(() => [])).filter(x => !x.isAdmin && x.estado !== 'aprobado' && x.estado !== 'denegado').length;
    el.innerHTML = `
    ${solicitudes ? `<div class="aviso-caja" style="margin-bottom:12px">${solicitudes} cuenta${solicitudes > 1 ? 's' : ''} esperando aprobación · <a href="#" id="ir-usuarios" style="text-decoration:underline">revisar</a></div>` : ''}
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <div class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Ciclo automático</h2><button class="btn" id="tick">▶ Ejecutar ciclo ahora</button></div>
          <div class="datos">
            <div class="dato"><b class="${retraso > (cfg.cadenciaMin || 10) * 2.5 * 60000 ? 'mal' : 'ok'}">${tick.ultimo ? hace(tick.ultimo) : 'nunca'}</b><span>Último ciclo (${esc(tick.origen || '—')})</span></div>
            <div class="dato"><b>${pend.length}</b><span>Acciones en cola</span></div>
            <div class="dato"><b>${tick.lecturas ?? '—'}</b><span>Lecturas último ciclo</span></div>
            <div class="dato"><b>${tick.escrituras ?? '—'}</b><span>Escrituras</span></div>
          </div>
          ${retraso > (cfg.cadenciaMin || 10) * 2.5 * 60000 ? `<div class="aviso-caja" style="margin-top:12px">El worker de GitHub Actions no se ejecuta desde hace ${hace(tick.ultimo)}. Revisa la pestaña Actions del repositorio o pulsa "Ejecutar ciclo ahora".</div>` : ''}
          ${tick.errores?.length ? `<div class="aviso-caja" style="margin-top:12px">Errores: ${tick.errores.map(esc).join('<br>')}</div>` : ''}
          <pre id="salida" class="mono" style="white-space:pre-wrap;font-size:.8rem;max-height:240px;overflow:auto;background:var(--panel-2);padding:10px;border-radius:8px;margin-top:12px">${esc((tick.notas || []).join('\n') || 'Sin notas.')}</pre>
        </div>
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Historial de ciclos</h3></div>
          ${logs.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Cuándo</th><th>Origen</th><th>Duración</th><th>Qué hizo</th></tr></thead><tbody>${logs.map(l => `<tr><td class="muted" style="white-space:nowrap">${fecha(l.ultimo)}</td><td>${esc(l.origen)}</td><td>${(l.duracionMs / 1000).toFixed(1)} s</td><td style="font-size:.82rem">${esc((l.notas || []).slice(-4).join(' · ') || '—')}${l.errores?.length ? `<span class="mal"> ${esc(l.errores.join(' | '))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin registros.')}
        </div>
      </div>
      <aside class="pila">
        <form class="tarjeta" id="f-cfg"><div class="tarjeta-titulo"><h3>Ajustes</h3></div>
          <label><span><input type="checkbox" name="inscripcion" ${cfg.inscripcion !== false ? 'checked' : ''}> Inscripción abierta (se pueden reclamar equipos libres)</span></label>
          <label style="margin-top:10px">Minutos de cierre de estrategias antes de cada sesión<input type="number" name="minutosCierre" min="10" max="600" value="${cfg.minutosCierre || 30}"></label>
          <label style="margin-top:10px">Cadencia del worker (min, informativo)<input type="number" name="cadenciaMin" min="5" max="120" value="${cfg.cadenciaMin || 10}"></label>
          <label style="margin-top:10px">Horas de draft<input type="number" name="horasDraft" min="1" max="240" value="${cfg.horasDraft || 48}"></label>
          <p class="muted" style="font-size:.8rem">El cierre solo afecta a eventos que crees a partir de ahora. Deja al menos 2-3 ciclos de margen (con cadencia 10 → 30 min o más).</p>
          <div class="fila-botones"><button class="btn btn-peq">Guardar</button></div></form>
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Próximas sesiones</h3></div><ul class="lista">${prox.map(s => `<li style="font-size:.88rem">${banderaLiga(s.ev.liga)} ${esc(SESION_INFO[s.tipo].corto)} R${s.ev.ronda} · ${fecha(s.publishAt)}<div class="muted" style="font-size:.78rem">cierre ${fecha(s.lockAt)}</div></li>`).join('') || '<li class="muted">Nada programado</li>'}</ul></div>
        <div class="tarjeta"><div class="etiqueta">Fase</div><div class="cuenta" style="font-size:1.6rem">${esc(cfg.fase)}</div><div class="muted">Temporada ${cfg.temporada}</div></div>
      </aside>
    </div>`;
    $('#ir-usuarios')?.addEventListener('click', (e) => { e.preventDefault(); $('[data-tab="usuarios"]').click(); });
    $('#tick').addEventListener('click', (e) => ocupado(e.target, async () => {
        const lineas = [];
        const r = await ejecutarTick(store(), { ahora: ahora(), origen: 'admin', forzar: true, log: (m) => { lineas.push(m); $('#salida').textContent = lineas.join('\n'); } });
        toast(r.ok ? 'Ciclo completado' : `Ciclo con errores: ${(r.errores || []).join(' | ')}`, r.ok ? 'ok' : 'error');
        await recargar(); pintarEstado();
    }));
    $('#f-cfg').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await store().merge('config/juego', { inscripcion: f.inscripcion.checked, minutosCierre: +f.minutosCierre.value, cadenciaMin: +f.cadenciaMin.value, horasDraft: +f.horasDraft.value });
        await recargar(); toast('Ajustes guardados');
    });
}

// ======================================================================
// CALENDARIO
// ======================================================================
function opcionesCircuito(ligaPais, sel) {
    const grupos = {};
    CIRCUITOS.forEach(c => { (grupos[c.pais] ||= []).push(c); });
    const orden = Object.keys(grupos).sort((a, b) => (b === ligaPais) - (a === ligaPais) || (PAISES[a] || a).localeCompare(PAISES[b] || b));
    return orden.map(p => `<optgroup label="${esc(PAISES[p] || p)}">${grupos[p].map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}${c.oficial ? ' · Kunos' : ' · mod'}</option>`).join('')}</optgroup>`).join('') + `<option value="__custom" ${sel === '__custom' ? 'selected' : ''}>Circuito personalizado…</option>`;
}

async function pintarCalendario() {
    const el = $('#p-calendario');
    if (!cfg) { el.innerHTML = vacio('Inicializa el juego primero.'); return; }
    const ligas = [...LIGAS_NACIONALES, 'INT'];
    el.innerHTML = `
    <div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2>Sede del Mundial (temporada ${cfg.temporada})</h2></div>
      <form class="campo-fila" id="f-sede"><label>País<select name="pais">${Object.entries(PAISES).map(([k, v]) => `<option value="${k}" ${cfg.mundial?.pais === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Nombre que se mostrará<input name="nombre" value="${esc(cfg.mundial?.nombre || '')}" placeholder="Japón"></label><label>&nbsp;<button class="btn">Guardar sede</button></label></form>
      <p class="muted" style="font-size:.85rem">Luego crea sus 3 fines de semana en la liga Intercontinental más abajo. Los 20 pilotos se fijan solos al terminar las ligas nacionales.</p></div>

    <div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2>Generar calendario de una liga</h2></div>
      <form id="f-gen">
        <div class="campo-fila"><label>Liga<select name="liga">${ligas.map(l => `<option value="${l}">${esc(LIGAS[l].nombre)}</option>`).join('')}</select></label>
          <label>Primer viernes<input type="date" name="inicio" required></label><label>Días entre fines de semana<input type="number" name="cada" value="7" min="1" max="30"></label>
          <label>Nº de fines de semana<input type="number" name="n" value="5" min="1" max="10"></label></div>
        <div class="etiqueta" style="margin:12px 0 6px">Horario de cada sesión (día relativo al viernes · hora de Madrid)</div>
        <div class="campo-fila">${SESIONES.map(t => `<label>${esc(SESION_INFO[t].corto)}<div class="fila" style="flex-wrap:nowrap"><select name="dia_${t}" style="width:80px">${[0, 1, 2, 3, 4, 5, 6].map(i => `<option value="${i}" ${PATRON[t][0] === i ? 'selected' : ''}>${['Vie', 'Sáb', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue'][i]}</option>`).join('')}</select><input type="time" name="h_${t}" value="${PATRON[t][1]}"></div></label>`).join('')}</div>
        <div class="etiqueta" style="margin:12px 0 6px">Circuitos (en orden)</div>
        <div id="gen-circuitos" class="campo-fila"></div>
        <div class="fila-botones"><button class="btn">Crear fines de semana</button></div>
      </form>
      <p class="muted" style="font-size:.82rem">Consejo: escalona las ligas (por ejemplo, cada liga en un día distinto de la semana) para que haya algo que ver casi todos los días.</p>
    </div>
    <div id="lista-eventos"></div>`;

    const pintarSelectoresGen = () => {
        const f = $('#f-gen');
        const l = f.liga.value, n = +f.n.value;
        const pais = LIGAS[l].pais || cfg.mundial?.pais;
        const propios = CIRCUITOS.filter(c => c.pais === pais);
        $('#gen-circuitos').innerHTML = Array.from({ length: n }, (_, i) => `<label>R${i + 1}<select name="c${i}">${opcionesCircuito(pais, propios[i % Math.max(1, propios.length)]?.id)}</select></label>`).join('');
    };
    $('#f-gen').liga.addEventListener('change', pintarSelectoresGen);
    $('#f-gen').n.addEventListener('change', pintarSelectoresGen);
    pintarSelectoresGen();

    $('#f-sede').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await store().merge('config/juego', { mundial: { ...(cfg.mundial || {}), pais: f.pais.value, nombre: f.nombre.value || PAISES[f.pais.value] } });
        await recargar(); toast('Sede guardada');
    });
    $('#f-gen').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const l = f.liga.value, n = +f.n.value, cada = +f.cada.value;
        const existentes = d.eventosLiga(l);
        const base = new Date(`${f.inicio.value}T00:00:00`);
        const eventos = [];
        for (let i = 0; i < n; i++) {
            let circ = CIRCUITOS_POR_ID[f[`c${i}`].value];
            if (!circ) { circ = await pedirCircuito(); if (!circ) return; }
            const horarios = {};
            for (const t of SESIONES) {
                const [hh, mm] = f[`h_${t}`].value.split(':').map(Number);
                const dt = new Date(base); dt.setDate(dt.getDate() + i * cada + +f[`dia_${t}`].value); dt.setHours(hh, mm, 0, 0);
                horarios[t] = dt.getTime();
            }
            eventos.push(crearEvento({ temporada: cfg.temporada, liga: l, ronda: existentes.length + i + 1, circuito: circ, horarios, minutosCierre: cfg.minutosCierre || 30 }));
        }
        const primera = Math.min(...eventos.map(ev => ev.sesiones.FP.lockAt));
        if (primera < ahora()) return toast('Hay sesiones que ya habrían cerrado. Elige fechas futuras.', 'error');
        if (!await confirmar(`Se crearán ${eventos.length} fines de semana en ${esc(LIGAS[l].nombre)}:<br>${eventos.map(ev => `R${ev.ronda} · ${esc(ev.circuito.nombre)} · ${fecha(ev.sesiones.FP.publishAt)}`).join('<br>')}`)) return;
        await guardarEventos(store(), eventos);
        await recargar(); toast('Calendario creado'); pintarCalendario();
    });
    pintarEventos();
}

function pedirCircuito() {
    return new Promise(res => {
        const m = modal(`<h2>Circuito personalizado</h2><p class="muted">Para usar un circuito de Assetto Corsa que no está en la lista. La carpeta es la de <code>assettocorsa/content/tracks</code>.</p>
        <form id="f-cc" style="display:grid;gap:10px"><div class="campo-fila"><label>Nombre<input name="nombre" required></label><label>Carpeta AC (opcional)<input name="acId" placeholder="mi_circuito/layout"></label></div>
        <div class="campo-fila"><label>País<select name="pais">${Object.entries(PAISES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label><label>Longitud (km)<input name="km" type="number" step="0.001" value="4.0" required></label><label>Velocidad media BAC Mono (km/h)<input name="vel" type="number" value="160"></label></div>
        <div class="campo-fila"><label>Peso motor (0-1)<input name="motor" type="number" step="0.05" value="0.35"></label><label>Peso aero (0-1)<input name="aero" type="number" step="0.05" value="0.35"></label><label>Peso chasis (0-1)<input name="chasis" type="number" step="0.05" value="0.3"></label></div>
        <div class="campo-fila"><label>Facilidad para adelantar (0-1)<input name="adelantar" type="number" step="0.05" value="0.4"></label><label>Desgaste (0-1)<input name="desgaste" type="number" step="0.05" value="0.5"></label><label>Prob. lluvia (0-1)<input name="lluvia" type="number" step="0.05" value="0.15"></label></div>
        <div class="fila-botones"><button class="btn">Usar este circuito</button></div></form>`, { alCerrar: () => res(null) });
        m.el.querySelector('#f-cc').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            const c = normalizarCircuito({ ...f, id: 'custom-' + f.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-') });
            res(c); m.cerrar();
        });
    });
}

function pintarEventos() {
    const cont = $('#lista-eventos');
    cont.innerHTML = [...LIGAS_NACIONALES, 'INT'].map(l => {
        const evs = d.eventosLiga(l);
        return `<div class="tarjeta" style="margin-bottom:14px"><div class="tarjeta-titulo"><h3>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</h3><span class="muted">${evs.length} fines de semana</span></div>
        ${evs.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>R</th><th>Circuito</th><th>Carpeta AC</th>${SESIONES.map(t => `<th>${SESION_INFO[t].corto}</th>`).join('')}<th></th></tr></thead><tbody>
        ${evs.map(ev => `<tr><td>${ev.ronda}</td><td>${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)}<div class="muted" style="font-size:.75rem">${ev.circuito?.km} km · ref. ${formatoTiempo(ev.circuito?.tiempoBase)}</div></td>
          <td>${ev.circuito?.acId ? `<code style="font-size:.78rem;cursor:pointer" title="Copiar" data-copiar="${esc(ev.circuito.acId)}">${esc(ev.circuito.acId)}</code>` : '<span class="muted">—</span>'}</td>
          ${SESIONES.map(t => { const s = ev.sesiones[t]; return `<td style="font-size:.78rem;white-space:nowrap">${s ? `${fecha(s.publishAt)}<br><span class="estado ${d.estadoSesion(s)}">${d.estadoSesion(s)}</span>` : '—'}</td>`; }).join('')}
          <td><button class="btn btn-sec btn-peq" data-editar="${esc(ev.id)}">Editar</button> <button class="btn btn-peligro btn-peq" data-borrar="${esc(ev.id)}">✕</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Sin fines de semana.</p>'}</div>`;
    }).join('');
    $$('[data-copiar]', cont).forEach(c => c.addEventListener('click', () => { navigator.clipboard?.writeText(c.dataset.copiar); toast('Carpeta copiada: ' + c.dataset.copiar, 'info'); }));
    $$('[data-borrar]', cont).forEach(b => b.addEventListener('click', async () => {
        const ev = d.evento(b.dataset.borrar);
        const empezado = Object.values(ev.sesiones).some(s => s.lockAt < ahora());
        if (!await confirmar(`¿Borrar ${esc(ev.circuito?.nombre)} (R${ev.ronda})?${empezado ? '<br><b class="mal">Ya tiene sesiones cerradas o disputadas.</b>' : ''}`, { peligro: true, si: 'Borrar' })) return;
        await borrarEvento(store(), b.dataset.borrar);
        await recargar(); pintarEventos(); toast('Evento borrado');
    }));
    $$('[data-editar]', cont).forEach(b => b.addEventListener('click', () => editarEvento(b.dataset.editar)));
}

async function editarEvento(id) {
    const ev = await store().get(`eventos/${id}`);
    const local = (ms) => { const dt = new Date(ms); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset()); return dt.toISOString().slice(0, 16); };
    const m = modal(`<h2>R${ev.ronda} · ${esc(ev.circuito.nombre)}</h2>
      <form id="f-ed" style="display:grid;gap:12px">
        <label>Circuito<select name="circ" ${Object.values(ev.sesiones).some(s => s.estado !== 'programada') ? 'disabled' : ''}>${opcionesCircuito(ev.circuito.pais, ev.circuito.id)}</select></label>
        <div class="campo-fila">${SESIONES.filter(t => ev.sesiones[t]).map(t => `<label>${esc(SESION_INFO[t].nombre)} ${ev.sesiones[t].estado !== 'programada' ? `<span class="muted">(${ev.sesiones[t].estado})</span>` : ''}<input type="datetime-local" name="${t}" value="${local(ev.sesiones[t].publishAt)}" ${ev.sesiones[t].estado !== 'programada' ? 'disabled' : ''}></label>`).join('')}</div>
        <div class="campo-fila">${SESIONES.filter(t => ev.sesiones[t]).map(t => `<label>Lluvia ${esc(SESION_INFO[t].corto)} (%)<input type="number" min="0" max="100" name="ll_${t}" value="${Math.round((ev.meteo?.[t] || 0) * 100)}"></label>`).join('')}</div>
        <div class="fila-botones"><button class="btn">Guardar</button></div></form>`, { ancho: 820 });
    m.el.querySelector('#f-ed').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        if (!f.circ.disabled && f.circ.value !== ev.circuito.id) {
            const c = CIRCUITOS_POR_ID[f.circ.value] || await pedirCircuito();
            if (c) ev.circuito = normalizarCircuito(c);
        }
        for (const t of SESIONES) {
            if (!ev.sesiones[t]) continue;
            ev.meteo = { ...(ev.meteo || {}), [t]: Math.max(0, Math.min(1, +f[`ll_${t}`].value / 100)) };
            if (ev.sesiones[t].estado !== 'programada') continue;
            const nuevo = new Date(f[t].value).getTime();
            if (nuevo !== ev.sesiones[t].publishAt) ev.sesiones[t] = horarioSesion(t, nuevo, cfg.minutosCierre || 30);
        }
        await guardarEventos(store(), [ev]);
        m.cerrar(); await recargar(); pintarEventos(); toast('Evento actualizado');
    });
}

// ======================================================================
// PARRILLA
// ======================================================================
async function pintarParrilla() {
    const el = $('#p-parrilla');
    const [equipos, pilotos] = await Promise.all([store().list('equipos'), store().list('pilotos')]);
    el.innerHTML = `
    <div class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2>Importar parrilla</h2><button class="btn btn-sec btn-peq" id="ejemplo">Cargar la parrilla ficticia incluida</button></div>
      <p class="muted" style="font-size:.88rem">JSON con <code>equipos</code> (id, nombre, liga, grupo, color) y <code>pilotos</code> (nombre, apellido, nac, equipo, rol P1/P2). Los atributos ocultos se generan solos si no los pones. Se conservan los mánagers de los equipos con el mismo id.</p>
      <textarea id="json" rows="6" class="mono" placeholder='{"equipos":[...],"pilotos":[...]}'></textarea>
      <div class="fila-botones"><input type="file" id="archivo" accept=".json" style="max-width:260px"><button class="btn btn-sec" id="validar">Validar</button><button class="btn" id="importar">Importar</button></div>
      <div id="val" style="margin-top:10px"></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h2>Equipos y pilotos</h2><span class="muted">${equipos.length} equipos · ${pilotos.filter(p => p.equipoId).length} pilotos activos</span></div>
      ${LIGAS_NACIONALES.map(l => {
          const eqs = equipos.filter(e => e.liga === l);
          const locales = pilotos.filter(p => p.liga === l && p.equipoId && p.nac === NAC_LOCAL[l]).length;
          return `<h3 style="margin-top:14px">${banderaLiga(l)} ${esc(LIGAS[l].nombre)} <span class="muted" style="font-size:.9rem">· ${locales} locales ${locales < 11 ? '<span class="mal">(mínimo 11)</span>' : ''}</span></h3>
          <div class="tabla-scroll"><table class="tabla"><tbody>${eqs.map(e => `<tr><td style="border-left:4px solid ${esc(e.color)}"><b>${esc(e.nombre)}</b>${e.grupo ? ` <span class="muted">· ${esc(e.grupo)}</span>` : ''}<div class="muted" style="font-size:.78rem">${e.ownerNombre ? `Mánager: ${esc(e.ownerNombre)}` : 'IA'}</div></td>
            <td>${pilotos.filter(p => p.equipoId === e.id).sort((a, b) => (a.rol === 'P1' ? -1 : 1)).map(p => `<div class="fila" style="margin:2px 0">${bandera(p.nac)} <a href="#" data-piloto="${esc(p.id)}">#${p.numero} ${esc(p.nombre)} ${esc(p.apellido)}</a> ${p.rol === 'P1' ? '<span class="insignia p1">P1</span>' : ''}</div>`).join('')}</td>
            <td><button class="btn btn-sec btn-peq" data-equipo="${esc(e.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
      }).join('')}
    </div>`;
    const leer = () => { try { return JSON.parse($('#json').value); } catch { toast('JSON no válido', 'error'); return null; } };
    $('#archivo').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) $('#json').value = await f.text(); });
    $('#ejemplo').addEventListener('click', async () => { $('#json').value = await (await fetch('data/parrilla.json')).text(); toast('Parrilla de ejemplo cargada en el cuadro. Pulsa Validar e Importar.', 'info'); });
    $('#validar').addEventListener('click', () => {
        const j = leer(); if (!j) return;
        const { errores, avisos } = validarParrilla(j);
        $('#val').innerHTML = errores.length ? `<div class="aviso-caja">${errores.map(esc).join('<br>')}</div>` : `<div class="info-caja">✓ Válida: ${j.equipos.length} equipos, ${j.pilotos.length} pilotos.${avisos.length ? '<br>' + avisos.map(esc).join('<br>') : ''}</div>`;
    });
    $('#importar').addEventListener('click', (e) => ocupado(e.target, async () => {
        const j = leer(); if (!j) return;
        const { errores } = validarParrilla(j);
        if (errores.length) { $('#val').innerHTML = `<div class="aviso-caja">${errores.map(esc).join('<br>')}</div>`; return; }
        if (!await confirmar(`Se importarán ${j.equipos.length} equipos y ${j.pilotos.length} pilotos. Los presupuestos y coches se reinician.`)) return;
        await importarParrilla(store(), j, { semilla: `parrilla-${Date.now()}` });
        await recargar(); toast('Parrilla importada'); pintarParrilla();
    }));
    $$('[data-equipo]', el).forEach(b => b.addEventListener('click', () => editarEquipo(equipos.find(e => e.id === b.dataset.equipo))));
    $$('[data-piloto]', el).forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); editarPiloto(pilotos.find(p => p.id === a.dataset.piloto), equipos); }));
}

async function editarEquipo(e) {
    const priv = await store().get(`equipos_priv/${e.id}`);
    const m = modal(`<h2>${esc(e.nombre)}</h2><form id="f-eq" style="display:grid;gap:10px">
      <div class="campo-fila"><label>Nombre<input name="nombre" value="${esc(e.nombre)}"></label><label>Nombre corto<input name="corto" value="${esc(e.corto || '')}"></label><label>Grupo<input name="grupo" value="${esc(e.grupo || '')}"></label><label>Color<input type="color" name="color" value="${esc(e.color || '#888888')}"></label></div>
      <div class="campo-fila"><label>Presupuesto (€)<input type="number" name="presupuesto" value="${priv?.presupuesto || 0}"></label>${['motor', 'aero', 'chasis', 'fiabilidad'].map(k => `<label>${k}<input type="number" min="0" max="10" name="c_${k}" value="${priv?.coche?.[k] || 0}"></label>`).join('')}</div>
      <p class="muted">Mánager: ${e.ownerNombre ? esc(e.ownerNombre) : 'ninguno (IA)'}</p>
      <div class="fila-botones">${e.ownerId ? '<button type="button" class="btn btn-peligro" id="quitar">Quitar mánager</button>' : ''}<button class="btn">Guardar</button></div></form>`, { ancho: 760 });
    m.el.querySelector('#f-eq').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        await store().merge(`equipos/${e.id}`, { nombre: f.nombre.value, corto: f.corto.value || f.nombre.value, grupo: f.grupo.value || null, color: f.color.value });
        await store().merge(`equipos_priv/${e.id}`, { presupuesto: +f.presupuesto.value, coche: Object.fromEntries(['motor', 'aero', 'chasis', 'fiabilidad'].map(k => [k, +f[`c_${k}`].value])) });
        await reconstruirCatalogo(store(), cfg);
        m.cerrar(); await recargar(); pintarParrilla(); toast('Equipo guardado');
    });
    m.el.querySelector('#quitar')?.addEventListener('click', async () => {
        if (!await confirmar(`¿Quitar a ${esc(e.ownerNombre)} de ${esc(e.nombre)}?`, { peligro: true })) return;
        await store().batch([{ op: 'merge', path: `equipos/${e.id}`, data: { ownerId: null, ownerNombre: null } }, { op: 'merge', path: `usuarios/${e.ownerId}`, data: { equipoId: null } }]);
        await reconstruirCatalogo(store(), cfg);
        m.cerrar(); await recargar(); pintarParrilla(); toast('Mánager retirado');
    });
}

async function editarPiloto(p, equipos) {
    const priv = await store().get(`pilotos_priv/${p.id}`);
    const a = priv?.attrs || {};
    const campos = ['ritmo', 'consistencia', 'agresividad', 'adelantamiento', 'defensa', 'lluvia', 'experiencia', 'potencial'];
    const m = modal(`<h2>${esc(p.nombre)} ${esc(p.apellido)}</h2><form id="f-p" style="display:grid;gap:10px">
      <div class="campo-fila"><label>Nombre<input name="nombre" value="${esc(p.nombre)}"></label><label>Apellido<input name="apellido" value="${esc(p.apellido)}"></label><label>Nacionalidad<select name="nac">${Object.entries(PAISES).map(([k, v]) => `<option value="${k}" ${p.nac === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>Dorsal<input type="number" name="numero" value="${p.numero ?? ''}"></label><label>Edad<input type="number" name="edad" value="${p.edad ?? ''}"></label></div>
      <div class="campo-fila"><label>Equipo<select name="equipo"><option value="">— Sin equipo —</option>${equipos.map(e => `<option value="${esc(e.id)}" ${p.equipoId === e.id ? 'selected' : ''}>${esc(LIGAS[e.liga].nombre)} · ${esc(e.nombre)}</option>`).join('')}</select></label><label>Rol<select name="rol"><option value="P1" ${p.rol === 'P1' ? 'selected' : ''}>Piloto 1</option><option value="P2" ${p.rol !== 'P1' ? 'selected' : ''}>Piloto 2</option></select></label></div>
      <div class="etiqueta">Atributos ocultos</div><div class="campo-fila">${campos.map(k => `<label>${k}<input type="number" min="1" max="99" name="a_${k}" value="${a[k] ?? ''}"></label>`).join('')}</div>
      <div class="campo-fila"><label>Moral (0-100)<input type="number" name="moral" value="${priv?.moral ?? 60}"></label><label>Salario (€/finde)<input type="number" name="salario" value="${priv?.salario ?? 300000}"></label></div>
      <div class="fila-botones"><button class="btn">Guardar</button></div></form>`, { ancho: 860 });
    m.el.querySelector('#f-p').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const eqSel = equipos.find(e => e.id === f.equipo.value);
        await store().merge(`pilotos/${p.id}`, { nombre: f.nombre.value, apellido: f.apellido.value, nac: f.nac.value, numero: +f.numero.value || null, edad: +f.edad.value || null, equipoId: eqSel?.id || null, liga: eqSel?.liga || null, rol: f.rol.value, estado: eqSel ? 'activo' : 'libre' });
        await store().merge(`pilotos_priv/${p.id}`, { equipoId: eqSel?.id || null, attrs: Object.fromEntries(campos.map(k => [k, +f[`a_${k}`].value || a[k] || 60])), moral: +f.moral.value, salario: +f.salario.value });
        await reconstruirCatalogo(store(), cfg);
        m.cerrar(); await recargar(); pintarParrilla(); toast('Piloto guardado');
    });
}

// ======================================================================
// USUARIOS
// ======================================================================
async function pintarUsuarios() {
    const el = $('#p-usuarios');
    const us = await store().list('usuarios');
    const aprobado = (x) => x.isAdmin || x.estado === 'aprobado';
    const pendientes = us.filter(x => !aprobado(x) && x.estado !== 'denegado').sort((a, b) => (b.creado || 0) - (a.creado || 0));
    const resto = us.filter(x => !pendientes.includes(x)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const estadoTxt = (x) => x.isAdmin ? 'admin' : x.estado === 'aprobado' ? 'aprobado' : x.estado === 'denegado' ? '<span class="mal">denegado</span>' : 'pendiente';
    el.innerHTML = `
    <div class="tarjeta" style="margin-bottom:12px"><div class="tarjeta-titulo"><h2>Solicitudes pendientes</h2><span class="muted">${pendientes.length}</span></div>
      ${pendientes.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${pendientes.map(x => `<tr><td><b>${esc(x.nombre || '—')}</b><div class="muted peq">${esc(x.email || '')}${x.creado ? ` · ${hace(x.creado)}` : ''}</div></td>
        <td class="der"><button class="btn btn-peq btn-sec" data-estado="denegado" data-uid="${esc(x.id)}">Denegar</button> <button class="btn btn-peq" data-estado="aprobado" data-uid="${esc(x.id)}">Aprobar</button></td></tr>`).join('')}</tbody></table></div>`
        : vacio('No hay cuentas esperando aprobación.')}
      <p class="muted peq" style="margin:8px 0 0">Una cuenta aprobada puede elegir cualquier escudería libre. La cuenta del bot (BOT_EMAIL) solo necesita la casilla Admin.</p>
    </div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h2>Todas las cuentas</h2><span class="muted">${resto.length}</span></div>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Nombre</th><th>Estado</th><th>Escudería</th><th class="cen">Admin</th><th></th></tr></thead><tbody>
      ${resto.map(x => `<tr><td>${esc(x.nombre || '—')}<div class="muted peq">${esc(x.email || '')}</div></td><td class="peq">${estadoTxt(x)}</td>
        <td>${x.equipoId ? esc(d.nombreEquipo(x.equipoId)) : '<span class="tenue">—</span>'}</td>
        <td class="cen"><input type="checkbox" data-admin="${esc(x.id)}" ${x.isAdmin ? 'checked' : ''} ${x.id === usuario().uid ? 'disabled' : ''}></td>
        <td class="der">${x.estado === 'denegado' ? `<button class="btn btn-peq btn-sec" data-estado="aprobado" data-uid="${esc(x.id)}">Aprobar</button>` : !x.isAdmin && x.id !== usuario().uid ? `<button class="btn btn-peq btn-sec" data-estado="denegado" data-uid="${esc(x.id)}">Bloquear</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    $$('[data-estado]', el).forEach(b => b.addEventListener('click', async () => {
        const x = us.find(y => y.id === b.dataset.uid);
        const ops = [{ op: 'merge', path: `usuarios/${x.id}`, data: { estado: b.dataset.estado } }];
        if (b.dataset.estado === 'denegado' && x.equipoId) {
            if (!await confirmar(`${esc(x.nombre)} dirige ${esc(d.nombreEquipo(x.equipoId))}. Si le bloqueas, el equipo vuelve a la IA. ¿Seguir?`, { peligro: true })) return;
            ops.push({ op: 'merge', path: `usuarios/${x.id}`, data: { equipoId: null } }, { op: 'merge', path: `equipos/${x.equipoId}`, data: { ownerId: null, ownerNombre: null } });
        }
        await store().batch(ops);
        if (ops.length > 1) await reconstruirCatalogo(store(), cfg);
        toast(b.dataset.estado === 'aprobado' ? `${x.nombre} aprobado` : `${x.nombre} denegado`);
        pintarUsuarios();
    }));
    $$('[data-admin]', el).forEach(c => c.addEventListener('change', async () => {
        await store().merge(`usuarios/${c.dataset.admin}`, { isAdmin: c.checked });
        toast(c.checked ? 'Ahora es administrador' : 'Ya no es administrador');
    }));
}

// ======================================================================
// NOTICIAS
// ======================================================================
async function pintarNoticias() {
    const el = $('#p-noticias');
    const lista = await store().list('noticias', [], { orden: ['publishAt', 'desc'], limit: 40 });
    el.innerHTML = `<div class="rejilla rejilla-lado"><div class="tarjeta"><div class="tarjeta-titulo"><h2>Noticias publicadas</h2></div>
      ${lista.map(n => `<div class="noticia fila-entre"><div><h4>${esc(n.titulo)}</h4><p>${esc(n.texto)}</p><div class="meta">${n.liga ? banderaLiga(n.liga, { ancho: 14 }) : ''} ${fecha(n.publishAt)} · ${esc(n.tipo)}${n.publishAt > ahora() ? ' · <span class="aviso">programada</span>' : ''}</div></div><button class="btn btn-peligro btn-peq" data-del="${esc(n.id)}">✕</button></div>`).join('') || vacio('Sin noticias.')}</div>
      <form class="tarjeta" id="f-not"><div class="tarjeta-titulo"><h3>Nueva noticia</h3></div>
        <label>Título<input name="titulo" required></label><label style="margin-top:8px">Texto<textarea name="texto" rows="4"></textarea></label>
        <label style="margin-top:8px">Liga<select name="liga"><option value="">Todas</option>${[...LIGAS_NACIONALES, 'INT'].map(l => `<option value="${l}">${esc(LIGAS[l].nombre)}</option>`).join('')}</select></label>
        <label style="margin-top:8px">Tipo<select name="tipo"><option value="noticia">Noticia</option><option value="rumor">Rumor</option><option value="mercado">Mercado</option></select></label>
        <label style="margin-top:8px">Publicar (vacío = ya)<input type="datetime-local" name="cuando"></label>
        <div class="fila-botones"><button class="btn">Publicar</button></div></form></div>`;
    $('#f-not').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const cuando = f.cuando.value ? new Date(f.cuando.value).getTime() : ahora();
        await store().set(`noticias/${store().nuevoId('noticias')}`, { titulo: f.titulo.value, texto: f.texto.value, liga: f.liga.value || null, tipo: f.tipo.value, publishAt: cuando, fecha: ahora() });
        toast('Noticia publicada'); pintarNoticias();
    });
    $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => { await store().del(`noticias/${b.dataset.del}`); pintarNoticias(); }));
}

// ======================================================================
// TEMPORADA
// ======================================================================
async function pintarTemporada() {
    const el = $('#p-temporada');
    const m = cfg ? await store().get(`mercado/T${cfg.temporada}`).catch(() => null) : null;
    el.innerHTML = `<div class="rejilla rejilla-2">
      <div class="tarjeta"><h3>Fase</h3><p class="muted">Normalmente cambia sola: pretemporada → nacional → mundial → mercado → cerrada.</p>
        <div class="fila"><select id="fase">${['pretemporada', 'nacional', 'mundial', 'mercado', 'cerrada'].map(f => `<option ${cfg?.fase === f ? 'selected' : ''}>${f}</option>`).join('')}</select><button class="btn btn-sec" id="b-fase">Forzar fase</button></div></div>
      <div class="tarjeta"><h3>Mercado</h3><p class="muted">${m ? `Estado: <b>${esc(m.estado)}</b>${m.deadline ? ` · cierre ${fecha(m.deadline)}` : ''}` : 'Se abre solo al terminar el Mundial.'}</p>
        <div class="fila"><button class="btn btn-sec" id="b-mercado" ${m ? 'disabled' : ''}>Abrir mercado ahora</button><button class="btn btn-sec" id="b-cerrar" ${m?.estado === 'draft' ? '' : 'disabled'}>Cerrar draft ahora</button><a class="btn btn-sec" href="mercado.html">Ver</a></div></div>
      <div class="tarjeta"><h3>Nueva temporada</h3><p class="muted">Guarda el palmarés y la historia, reinicia presupuestos (50% + 8 M€), baja 2 niveles cada área del coche y pasa a pretemporada. Haz esto con el mercado cerrado.</p>
        <button class="btn" id="b-nueva">Empezar temporada ${(cfg?.temporada || 1) + 1}</button></div>
      <div class="tarjeta"><h3>Mantenimiento</h3><p class="muted">Útil si algo se ve desactualizado.</p>
        <div class="fila"><button class="btn btn-sec" id="b-cat">Regenerar catálogo</button><button class="btn btn-sec" id="b-res">Reconstruir clasificaciones</button></div></div>
      <div class="tarjeta" style="border-color:var(--mal)"><h3 class="mal">Borrar todo</h3><p class="muted">Elimina equipos, pilotos, calendario, resultados, noticias y los restos de la temporada pasada de FX Manager. Las cuentas de usuario se conservan (sin equipo). No se puede deshacer.</p>
        <button class="btn btn-peligro" id="b-borrar">Borrar todo y empezar de cero</button><pre id="borrado" class="mono muted" style="font-size:.8rem;white-space:pre-wrap"></pre></div>
    </div>`;
    const ctxAdmin = async () => {
        const c = crearContexto(store(), { ahora: ahora(), log: (x) => console.log(x) });
        c.cfg = await store().get('config/juego');
        c.secreto = (await store().get('secreto/juego'))?.clave || 'sin-secreto';
        c.temporada = c.cfg.temporada;
        return c;
    };
    $('#b-fase').addEventListener('click', async () => { await store().merge('config/juego', { fase: $('#fase').value }); await recargar(); toast('Fase cambiada'); });
    $('#b-mercado').addEventListener('click', (e) => ocupado(e.target, async () => {
        if (!await confirmar('¿Abrir el mercado con la clasificación actual?')) return;
        const c = await ctxAdmin(); await prepararMercado(c); await reconstruirCatalogo(store(), c.cfg); await recargar(); pintarTemporada(); toast('Mercado abierto');
    }));
    $('#b-cerrar').addEventListener('click', (e) => ocupado(e.target, async () => {
        if (!await confirmar('¿Cerrar el draft ya y aplicar todos los movimientos?')) return;
        const c = await ctxAdmin(); await cerrarMercado(c); await reconstruirCatalogo(store(), c.cfg); await recargar(); pintarTemporada(); toast('Mercado cerrado');
    }));
    $('#b-nueva').addEventListener('click', (e) => ocupado(e.target, async () => {
        if (!await confirmar(`¿Cerrar la temporada ${cfg.temporada} y empezar la ${cfg.temporada + 1}?`, { peligro: true })) return;
        await nuevaTemporada(store(), { ahora: ahora() }); await recargar(); pintarTemporada(); toast('¡Nueva temporada!');
    }));
    $('#b-cat').addEventListener('click', (e) => ocupado(e.target, async () => { await reconstruirCatalogo(store(), cfg); await recargar(); toast('Catálogo regenerado'); }));
    $('#b-res').addEventListener('click', (e) => ocupado(e.target, async () => {
        const res = await store().list('resultados', [['temporada', '==', cfg.temporada]]);
        const sesiones = res.filter(r => r.revealAt <= ahora()).map(r => compactar({ ...r, id: idResultado(r.eventoId, r.tipo) })).sort((a, b) => a.t - b.t);
        await store().set(`resumen/${idResumen(cfg.temporada)}`, { json: JSON.stringify({ sesiones }), actualizado: ahora(), temporada: cfg.temporada, n: sesiones.length });
        await recargar(); toast(`Clasificaciones reconstruidas (${sesiones.length} sesiones)`);
    }));
    $('#b-borrar').addEventListener('click', (e) => ocupado(e.target, async () => {
        let resolver;
        const pulsado = new Promise(res => { resolver = res; });
        const m2 = modal(`<h2 class="mal">¿Seguro?</h2><p>Escribe <b>BORRAR</b> para confirmar.</p><input id="conf"><div class="fila-botones"><button class="btn btn-peligro" id="ok">Borrar todo</button></div>`, { ancho: 420, alCerrar: () => resolver(null) });
        m2.el.querySelector('#ok').addEventListener('click', () => { const v = m2.el.querySelector('#conf').value; resolver(v); m2.cerrar(); });
        if (await pulsado !== 'BORRAR') return toast('Cancelado', 'info');
        const salida = $('#borrado');
        await borrarTodo(store(), { progreso: (t) => { salida.textContent += t + '\n'; } });
        await recargar(); toast('Todo borrado. Importa la parrilla y crea el calendario.');
    }));
}
void dinero; void tiempoReferencia; void idResultado;
