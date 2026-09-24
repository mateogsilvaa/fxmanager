import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store, usuario, ahora } from '../core/app.js';
import { esc, banderaLiga, vacio, fecha, toast, $$, bandera } from '../core/ui.js';
import { pos } from '../core/componentes.js';
import { LIGAS, SESION_INFO } from '../engine/constants.js';

const u = await montar({ activo: 'pronosticos' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const ranking = await store().get(`ranking/pronosticos_T${d.temporada}`).catch(() => null);
const mios = u ? await store().list('pronosticos', [['uid', '==', u.uid]]).catch(() => []) : [];
const porSid = Object.fromEntries(mios.map(p => [p.sesionId, p]));
const abiertas = d.todasLasSesiones().filter(s => s.tipo !== 'FP' && s.lockAt > ahora() && (s.ev.liga !== 'INT' || d.cfg.mundial?.participantes?.length)).slice(0, 12);

main.innerHTML = `
<div class="cabecera-pagina"><div><h1>🎯 Pronósticos</h1><p class="sub">Acierta el podio de cada clasificación y carrera. Juega cualquiera con cuenta, tengas equipo o no.</p></div></div>
<div class="rejilla rejilla-lado">
  <div class="pila">
    ${!u ? `<div class="aviso-caja">Necesitas <a href="entrar.html" style="text-decoration:underline">una cuenta</a> para pronosticar.</div>` : ''}
    ${abiertas.length ? abiertas.map(tarjeta).join('') : `<div class="tarjeta">${vacio('No hay sesiones abiertas para pronosticar ahora mismo.', '🎯')}</div>`}
    ${u && mios.some(p => p.puntuado) ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Mis últimos pronósticos</h3></div><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Sesión</th><th>Tu podio</th><th class="der">Pts</th></tr></thead><tbody>
      ${mios.filter(p => p.puntuado).sort((a, b) => (b.creado || 0) - (a.creado || 0)).slice(0, 15).map(p => `<tr><td>${banderaLiga(p.liga)} ${esc(SESION_INFO[p.tipo]?.corto)} <span class="muted">${esc(d.evento(p.eventoId)?.circuito?.nombre || '')}</span></td><td>${[p.p1, p.p2, p.p3].map(x => esc(d.apellido(x))).join(' · ')}</td><td class="pts">${p.puntos}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
  </div>
  <aside class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Clasificación general</h3></div>${tablaRanking()}</div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Cómo se puntúa</h3></div><ul class="lista" style="font-size:.9rem">
      <li>Ganador exacto: <b>10</b></li><li>2º o 3º exacto: <b>5</b> cada uno</li><li>Piloto en el podio pero en otra posición: <b>2</b></li><li>Podio perfecto: <b>+10</b> extra</li>
      <li class="muted">Se cierra a la vez que las estrategias de los equipos.</li></ul></div>
  </aside>
</div>`;

function tarjeta(s) {
    const pilotos = d.pilotosLiga(s.ev.liga).sort((a, b) => a.apellido.localeCompare(b.apellido));
    const prev = porSid[s.sid];
    const opts = (sel) => `<option value="">—</option>${pilotos.map(p => `<option value="${esc(p.id)}" ${sel === p.id ? 'selected' : ''}>${esc(p.apellido)}, ${esc(p.nombre)} (${esc(d.equipo(p.equipoId)?.corto || '')})</option>`).join('')}`;
    return `<form class="tarjeta" data-sid="${esc(s.sid)}" data-ev="${esc(s.evId)}" data-tipo="${esc(s.tipo)}" data-liga="${esc(s.ev.liga)}">
      <div class="tarjeta-titulo"><div><b>${banderaLiga(s.ev.liga)} ${esc(SESION_INFO[s.tipo].nombre)}</b> <span class="muted">· R${s.ev.ronda} ${bandera(s.ev.circuito?.pais)} ${esc(s.ev.circuito?.nombre)}</span><div class="muted" style="font-size:.82rem">${fecha(s.publishAt)} · cierra en <span data-cuenta="${s.lockAt}"></span></div></div>${prev ? '<span class="estado abierta">Guardado ✓</span>' : ''}</div>
      <div class="campo-fila"><label>🥇 Ganador<select name="p1" ${!u ? 'disabled' : ''}>${opts(prev?.p1)}</select></label><label>🥈 Segundo<select name="p2" ${!u ? 'disabled' : ''}>${opts(prev?.p2)}</select></label><label>🥉 Tercero<select name="p3" ${!u ? 'disabled' : ''}>${opts(prev?.p3)}</select></label></div>
      <div class="fila-botones"><button class="btn btn-peq" ${!u ? 'disabled' : ''}>${prev ? 'Actualizar' : 'Guardar pronóstico'}</button></div></form>`;
}

function tablaRanking() {
    const lista = Object.entries(ranking?.usuarios || {}).map(([uid, x]) => ({ uid, ...x })).sort((a, b) => b.puntos - a.puntos);
    if (!lista.length) return vacio('Aún no hay puntos.', '🎯');
    return `<table class="tabla"><thead><tr><th>Pos</th><th>Jugador</th><th class="cen">Plenos</th><th class="der">Pts</th></tr></thead><tbody>${lista.map((x, i) => `<tr class="${x.uid === u?.uid ? 'yo' : ''}"><td>${pos(i + 1)}</td><td>${esc(x.nombre)}</td><td class="cen">${x.plenos || 0}</td><td class="pts">${x.puntos}</td></tr>`).join('')}</tbody></table>`;
}

$$('form[data-sid]').forEach(f => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const p1 = fd.get('p1'), p2 = fd.get('p2'), p3 = fd.get('p3');
    if (!p1 || !p2 || !p3) return toast('Elige los tres pilotos del podio', 'error');
    if (new Set([p1, p2, p3]).size < 3) return toast('No puedes repetir piloto', 'error');
    const data = { uid: u.uid, nombre: u.perfil?.nombre || 'Anónimo', sesionId: f.dataset.sid, eventoId: f.dataset.ev, tipo: f.dataset.tipo, liga: f.dataset.liga, p1, p2, p3, creado: ahora() };
    try {
        await store().set(`pronosticos/${f.dataset.sid}_${u.uid}`, data);
        toast('Pronóstico guardado');
        f.querySelector('.tarjeta-titulo').insertAdjacentHTML('beforeend', '');
        f.querySelector('button').textContent = 'Actualizar';
    } catch (err) { toast('No se pudo guardar (¿se ha cerrado ya?)', 'error'); console.error(err); }
}));
void LIGAS;
