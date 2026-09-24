import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store, usuario } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio } from '../core/ui.js';
import { celdaPiloto, celdaEquipo, pos, fmtValor } from '../core/componentes.js';
import { LIGAS, PAISES } from '../engine/constants.js';

const eqId = new URLSearchParams(location.search).get('id');
await montar();
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const e = d.equipo(eqId);
if (!e) { main.innerHTML = vacio('Escudería no encontrada.', '❓'); throw new Error('no encontrado'); }
document.documentElement.style.setProperty('--acento', e.color);
const pub = await store().get(`equipos/${eqId}`).catch(() => null);
const liga = e.liga;
const st = d.tabla(liga).equipos[eqId];
const clas = d.clasificacionEquipos(liga);
const miPos = clas.find(x => x.eq === eqId)?.posicion;
const pilotos = Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eqId).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.rol === 'P1' ? -1 : 1));
const hermanos = e.grupo ? Object.entries(d.cat.equipos).filter(([id, x]) => x.grupo === e.grupo && id !== eqId) : [];
const eventos = d.eventosLiga(liga);
const stInt = d.tabla('INT').equipos[eqId];
const esMio = usuario()?.perfil?.equipoId === eqId;

// Mejores resultados individuales del equipo
const sesiones = d.sesionesLiga(liga);
const filasEq = sesiones.flatMap(s => s.filas.filter(f => f.eq === eqId).map(f => ({ ...f, s })));
const mejorCarrera = filasEq.filter(f => f.s.tipo.startsWith('R') && f.estado === 'FIN').sort((a, b) => a.pos - b.pos)[0];
const mejorRemontada = filasEq.filter(f => f.s.tipo.startsWith('R') && f.estado === 'FIN' && f.parrilla).map(f => ({ ...f, g: f.parrilla - f.pos })).sort((a, b) => b.g - a.g)[0];

main.innerHTML = `
<section class="hero" style="padding:28px;border-top:4px solid ${esc(e.color)}">
  <div class="etiqueta">${banderaLiga(liga)} ${esc(LIGAS[liga]?.nombre)}${e.grupo ? ` · Grupo ${esc(e.grupo)}` : ''}</div>
  <h1 style="margin:6px 0">${esc(e.nombre)}</h1>
  <p>${e.ownerNombre ? `Mánager: <b style="color:var(--texto)">${esc(e.ownerNombre)}</b>${esMio ? ' (tú) · <a href="escuderia.html">Ir al panel</a>' : ''}` : 'Sin mánager: la dirige la IA. <a href="escuderia.html">¿La quieres?</a>'} · ${e.fans || 0} fans</p>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="datos">
      ${dato(miPos ? `${miPos}º` : '—', 'Posición')}${dato(st?.pts ?? 0, 'Puntos')}${dato(st?.victorias ?? 0, 'Victorias')}${dato(st?.dobletes ?? 0, 'Dobletes')}
      ${dato(st?.podios ?? 0, 'Podios')}${dato(st?.poles ?? 0, 'Poles')}${dato(st?.dnf ?? 0, 'Abandonos')}${dato(st?.eficacia ?? '—', 'Eficacia media')}
    </div></div>
    <div class="rejilla rejilla-2">${pilotos.map(p => {
        const s = d.tabla(liga).pilotos[p.id];
        return `<a class="tarjeta" href="piloto.html?id=${esc(p.id)}"><div class="fila-entre"><span class="dorsal" style="font-size:2rem;color:${esc(e.color)}">${p.numero ?? ''}</span>${p.rol === 'P1' ? '<span class="insignia p1">Piloto 1</span>' : '<span class="muted">Piloto 2</span>'}</div>
        <div class="fila">${bandera(p.nac, { ancho: 24 })}<div><div>${esc(p.nombre)}</div><b style="font-family:var(--f-titulo);font-size:1.5rem;text-transform:uppercase">${esc(p.apellido)}</b></div></div>
        <div class="muted" style="font-size:.85rem;margin-top:6px">${esc(PAISES[p.nac] || '')} · ${s?.pts ?? 0} pts · ${s?.victorias ?? 0} victorias</div></a>`;
    }).join('')}</div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Puntos por fin de semana</h3></div>${porRonda()}</div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Palmarés e historia</h3></div>${historia()}</div>
  </div>
  <aside class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Récords del equipo</h3></div><ul class="lista">
      <li class="fila-entre"><span class="muted">Mejor resultado</span><b>${mejorCarrera ? `${mejorCarrera.pos}º · ${esc(d.apellido(mejorCarrera.pid))}` : '—'}</b></li>
      <li class="fila-entre"><span class="muted">Mejor fin de semana</span><b>${st?.mejorFinde ?? 0} pts</b></li>
      <li class="fila-entre"><span class="muted">Mayor remontada</span><b>${mejorRemontada?.g > 0 ? `+${mejorRemontada.g} · ${esc(d.apellido(mejorRemontada.pid))}` : '—'}</b></li>
      <li class="fila-entre"><span class="muted">Carreras con los dos en puntos</span><b>${st?.ambosEnPuntos ?? 0}</b></li>
      <li class="fila-entre"><span class="muted">Adelantamientos</span><b>${st?.adel ?? 0}</b></li>
      <li class="fila-entre"><span class="muted">Vueltas lideradas</span><b>${st?.lideradas ?? 0}</b></li>
      <li class="fila-entre"><span class="muted">Media de llegada</span><b>${st?.mediaPos != null ? fmtValor(st.mediaPos) : '—'}</b></li>
      <li class="fila-entre"><span class="muted">Errores de pilotaje</span><b>${st?.errores ?? 0}</b></li>
    </ul></div>
    ${stInt ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>🌐 Mundial de Escuderías</h3></div><div class="datos">${dato(stInt.pts, 'Puntos')}${dato(stInt.victorias, 'Victorias')}</div></div>` : ''}
    ${hermanos.length ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Grupo ${esc(e.grupo)}</h3></div><p class="muted" style="font-size:.88rem">Franquicia con equipos en varios países.</p><ul class="lista">${hermanos.map(([id, x]) => `<li>${banderaLiga(x.liga)} ${celdaEquipo(d, id)}</li>`).join('')}</ul></div>` : ''}
  </aside>
</div>`;

function dato(v, t) { return `<div class="dato"><b>${v}</b><span>${t}</span></div>`; }
function porRonda() {
    if (!eventos.length) return vacio('Sin calendario.');
    const max = Math.max(1, ...eventos.map(ev => st?.ptsEvento?.[ev.id] || 0));
    return `<div style="display:grid;gap:8px">${eventos.map(ev => { const v = st?.ptsEvento?.[ev.id]; return `<div class="fila" style="flex-wrap:nowrap"><span style="min-width:170px;font-size:.88rem">${bandera(ev.circuito?.pais)} R${ev.ronda} ${esc(ev.circuito?.nombre?.split(' ').slice(0, 3).join(' ') || '')}</span><div class="barra" style="flex:1;height:14px"><div class="barra-relleno" style="width:${((v || 0) / max) * 100}%;background:${esc(e.color)}"></div></div><b class="num" style="min-width:34px;text-align:right">${v ?? '·'}</b></div>`; }).join('')}</div>`;
}
function historia() {
    const h = pub?.historia || [];
    if (!h.length) return '<p class="muted">Primera temporada en Hyper Race X1.</p>';
    return `<table class="tabla"><thead><tr><th>Temporada</th><th class="cen">Pos</th><th class="cen">V</th><th class="der">Pts</th></tr></thead><tbody>${h.slice().reverse().map(x => `<tr><td>T${x.temporada}</td><td class="cen">${pos(x.pos)}</td><td class="cen">${x.victorias || 0}</td><td class="pts">${x.pts}</td></tr>`).join('')}</tbody></table>`;
}
void celdaPiloto;
