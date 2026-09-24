import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, resultado } from '../core/datos.js';
import { esc, bandera, banderaLiga, vacio, fecha } from '../core/ui.js';
import { celdaPiloto, pos } from '../core/componentes.js';
import { LIGAS, SESIONES, SESION_INFO } from '../engine/constants.js';
import { construirTemporada } from '../engine/stats.js';
import { generarCronica } from '../engine/cronica.js';

const evId = new URLSearchParams(location.search).get('ev') || '';
const ligaUrl = evId.split('_')[1];
await montar({ liga: ligaUrl });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const ev = d.evento(evId);
if (!ev) { main.innerHTML = vacio('Evento no encontrado.'); throw new Error('no encontrado'); }
const ultima = SESIONES.filter(t => ev.sesiones[t]).pop();
if (d.estadoSesion(ev.sesiones[ultima]) !== 'final') {
    main.innerHTML = `<div class="tarjeta">${vacio(`La crónica se publica al terminar la ${SESION_INFO[ultima].nombre} (${fecha(ev.sesiones[ultima].revealAt)}).`, '')}</div>`;
    throw new Error('pendiente');
}
const S = {};
await Promise.all(SESIONES.filter(t => ev.sesiones[t]).map(async t => { const r = await resultado(`${evId}_${t}`).catch(() => null); if (r) S[t] = r; }));
const todas = d.sesionesLiga(ev.liga);
const antes = construirTemporada(todas.filter(s => s.ev !== evId && s.t < ev.sesiones.FP?.publishAt));
const despues = construirTemporada(todas.filter(s => s.t <= ev.sesiones[ultima].publishAt));
const c = generarCronica({ evento: { id: evId, ...ev }, sesiones: S, nombre: d.nombre, apellido: d.apellido, equipo: d.nombreEquipo, antes, despues });

main.innerHTML = `
<article class="rejilla rejilla-lado">
  <div class="tarjeta cronica">
    <div class="etiqueta">${banderaLiga(ev.liga)} ${esc(LIGAS[ev.liga].nombre)} · Ronda ${ev.ronda} · ${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)}</div>
    <h2 style="margin-top:10px">${esc(c.titulo)}</h2>
    <p class="entradilla">${esc(c.entradilla)}</p>
    <div class="cuerpo">${c.parrafos.map(p => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="fila" style="margin-top:14px">${SESIONES.filter(t => S[t]).map(t => `<a class="btn btn-sec btn-peq" href="sesion.html?id=${esc(evId)}_${t}">${esc(SESION_INFO[t].corto)}</a>`).join('')}</div>
  </div>
  <aside class="pila">
    ${c.mvp ? `<div class="tarjeta tarjeta-acento"><div class="etiqueta">Piloto del fin de semana</div><div style="margin-top:8px">${celdaPiloto(d, c.mvp.pid, { equipo: true })}</div><div class="cuenta">${c.mvp.pts} pts</div></div>` : ''}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Podios</h3></div>
      ${['Q1', 'R1', 'Q2', 'R2', 'R3'].filter(t => S[t]).map(t => `<div style="margin-bottom:10px"><div class="etiqueta">${esc(SESION_INFO[t].nombre)}${S[t].lluvia ? ' ' : ''}</div>${S[t].filas.slice(0, 3).map(f => `<div class="fila" style="margin:4px 0">${pos(f.pos)} ${celdaPiloto(d, f.pid)}</div>`).join('')}</div>`).join('')}
    </div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>General tras la ronda</h3></div>
      <ul class="lista">${despues.clasPilotos.slice(0, 10).map((p, i) => { const a = antes.pilotos[p.pid]?.posicion; const dlt = a ? a - (i + 1) : 0; return `<li class="fila-entre"><span>${pos(i + 1)} ${esc(d.nombre(p.pid))} ${dlt > 0 ? `<span class="ok">▲${dlt}</span>` : dlt < 0 ? `<span class="mal">▼${-dlt}</span>` : ''}</span><b class="num">${p.pts}</b></li>`; }).join('')}</ul>
    </div>
  </aside>
</article>`;
