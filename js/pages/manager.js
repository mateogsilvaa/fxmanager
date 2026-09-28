import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store } from '../core/app.js';
import { esc, banderaLiga, vacio, barra } from '../core/ui.js';
import { celdaEquipo, pos } from '../core/componentes.js';
import { LIGAS } from '../engine/constants.js';
import { ratingCarrera, nivelRating, PESOS_RATING } from '../engine/rating.js';

const uid = new URLSearchParams(location.search).get('id');
await montar();
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);

const doc = uid ? await store().get(`managers/${uid}`).catch(() => null) : null;
const actual = Object.entries(d.cat.equipos).find(([, e]) => e.ownerId === uid);
if (!doc && !actual) { main.innerHTML = vacio('Mánager no encontrado.'); throw new Error('no encontrado'); }

const [eqId, eq] = actual || [null, null];
const nombre = eq?.ownerNombre || doc?.nombre || 'Mánager';
const r = eqId ? d.ratingsTemporada()[eqId] : null;
const pasadas = (doc?.historial || []).filter(x => x.temporada !== d.temporada);
// La temporada en curso cuenta para el rating de carrera en cuanto hay puntos
const conActual = r?.rating != null ? [...pasadas, { temporada: d.temporada, rating: r.rating }] : pasadas;
const carrera = ratingCarrera(conActual);
const titulos = pasadas.filter(x => x.pos === 1).length;
const mundiales = pasadas.filter(x => x.campeonMundial).length;
const sum = (k) => pasadas.reduce((s, x) => s + (x[k] || 0), 0) + (r?.[k] || 0);
const mejor = conActual.reduce((m, x) => (x.rating ?? -1) > (m?.rating ?? -1) ? x : m, null);

const ETIQ = { pos: 'Posición en su liga', pts: 'Puntos respecto al líder', mundial: 'Pilotos en el Mundial', exito: 'Títulos, victorias y podios', fans: 'Fans respecto a su liga' };

main.innerHTML = `
<section class="hero">
  <div class="etiqueta">Mánager${eq ? ` · ${banderaLiga(eq.liga, { ancho: 16 })} ${esc(LIGAS[eq.liga]?.nombre)}` : ''}</div>
  <h1>${esc(nombre)}</h1>
  <div class="fila">${eqId ? celdaEquipo(d, eqId) : '<span class="muted">Sin escudería ahora mismo</span>'}${pasadas.length ? `<span class="muted">· ${pasadas.length + (eqId ? 1 : 0)} temporadas</span>` : ''}</div>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Rating · temporada ${d.temporada}</h3><span>${nivelRating(r?.rating)}</span></div>
      ${r?.rating != null ? `<div class="rating-grande"><b>${r.rating}</b><span>/100</span></div>${barra(r.rating)}
        <div style="margin-top:16px">${Object.keys(PESOS_RATING).map(k => `<div style="margin:8px 0"><div class="fila-entre peq"><span>${ETIQ[k]} <span class="tenue">· ${Math.round(PESOS_RATING[k] * 100)}%</span></span><b>${Math.round((r.partes?.[k] || 0) * 100)}</b></div>${barra((r.partes?.[k] || 0) * 100)}</div>`).join('')}</div>`
        : `<p class="muted">${eqId ? 'El rating aparece en cuanto su escudería sume los primeros puntos.' : 'No dirige ninguna escudería esta temporada.'}</p>`}
    </div>
    ${r ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Esta temporada</h3></div><div class="datos">
      ${dato(r.pos ? `${r.pos}º` : '—', 'Posición')}${dato(r.pts ?? 0, 'Puntos')}${dato(r.victorias, 'Victorias')}${dato(r.podios, 'Podios')}${dato(r.mundial, 'Pilotos al Mundial')}${dato(r.fans ?? 0, 'Fans')}
    </div></div>` : ''}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Temporada a temporada</h3></div>${historial()}</div>
  </div>
  <aside class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Carrera</h3></div><div class="datos">
      ${dato(carrera ?? '—', 'Rating de carrera')}${dato(mejor?.rating ?? '—', `Mejor rating${mejor ? ` (T${mejor.temporada})` : ''}`)}
      ${dato(titulos, 'Títulos de liga')}${dato(mundiales, 'Mundiales')}${dato(sum('victorias'), 'Victorias')}${dato(sum('podios'), 'Podios')}
    </div>
    <p class="muted peq" style="margin:12px 0 0">El rating de carrera es la media de todas sus temporadas, con más peso para las recientes.</p></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Cómo se calcula</h3></div>
      <p class="muted peq">De 0 a 100. Mide lo bien que ha dirigido su escudería: posición final (40%), puntos respecto al líder (25%), pilotos clasificados al Mundial (15%), títulos, victorias y podios (10%) y fans respecto a su liga (10%).</p></div>
  </aside>
</div>`;

function dato(v, t) { return `<div class="dato"><b>${v}</b><span>${t}</span></div>`; }
function historial() {
    const filas = [...pasadas.map(x => ({ ...x, cerrada: true }))];
    if (eqId && r) filas.push({ temporada: d.temporada, equipoId: eqId, liga: eq.liga, pos: r.pos, pts: r.pts, victorias: r.victorias, podios: r.podios, mundial: r.mundial, rating: r.rating, cerrada: false });
    if (!filas.length) return vacio('Todavía sin temporadas.');
    const max = 100;
    return `<div class="rating-evolucion">${filas.map(x => `<div class="re-col" title="T${x.temporada}: ${x.rating ?? '—'}"><span class="re-v">${x.rating ?? '—'}</span><div class="re-barra"><i style="height:${(x.rating || 0) / max * 100}%"></i></div><span class="re-t">T${x.temporada}</span></div>`).join('')}</div>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Temp.</th><th>Escudería</th><th class="cen">Pos</th><th class="cen ancho">V</th><th class="cen ancho">Pod</th><th class="cen ancho" title="Pilotos en el Mundial">Mund.</th><th class="der">Pts</th><th class="der">Rating</th></tr></thead><tbody>
    ${filas.slice().reverse().map(x => `<tr><td>T${x.temporada}${x.cerrada ? '' : ' <span class="insignia">En curso</span>'}</td>
      <td><span class="con-bandera">${banderaLiga(x.liga, { ancho: 16 })}${d.equipo(x.equipoId) ? celdaEquipo(d, x.equipoId) : `<span class="txt">${esc(x.equipo || '—')}</span>`}</span></td>
      <td class="cen">${pos(x.pos)}</td><td class="cen num ancho">${x.victorias || 0}</td><td class="cen num ancho">${x.podios || 0}</td><td class="cen num ancho">${x.mundial || 0}</td>
      <td class="pts">${x.pts ?? 0}</td><td class="der"><b>${x.rating ?? '—'}</b></td></tr>`).join('')}
    </tbody></table></div>`;
}
