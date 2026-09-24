import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarHistorico } from '../core/datos.js';
import { store, usuario } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio, $, barra } from '../core/ui.js';
import { celdaEquipo, pos, fmtValor } from '../core/componentes.js';
import { LIGAS, PAISES, SESION_INFO } from '../engine/constants.js';
import { calcularRiesgo, construirTemporada } from '../engine/stats.js';

const pid = new URLSearchParams(location.search).get('id');
await montar();
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const p = d.piloto(pid);
const pub = await store().get(`pilotos/${pid}`).catch(() => null);
if (!p && !pub) { main.innerHTML = vacio('Piloto no encontrado.'); throw new Error('no encontrado'); }
const pl = p || pub;
const liga = pl.liga;

const eq = d.equipo(pl.equipoId);
const miEq = usuario()?.perfil?.equipoId;
const esMio = miEq && pl.equipoId === miEq;
const priv = esMio ? await store().get(`pilotos_priv/${pid}`).catch(() => null) : null;

const st = liga ? d.tabla(liga).pilotos[pid] : null;
const clas = liga ? d.clasificacionPilotos(liga) : [];
const miPos = clas.find(x => x.pid === pid)?.posicion;
const compId = liga ? d.companeros(liga)[pid] : null;
const stComp = compId ? d.tabla(liga).pilotos[compId] : null;
const stInt = d.tabla('INT').pilotos[pid];
const proy = d.clasificadosMundial();
const enMundial = proy.clasificados?.find(c => c.pid === pid);
let zona = null;
if (liga && liga !== 'INT' && st) {
    const inm = new Set(proy.clasificados?.map(c => c.pid) || []);
    zona = calcularRiesgo(d.tabla(liga), d.pilotosLiga(liga), { inmunes: inm }).find(r => r.pid === pid);
}

const eventos = liga ? d.eventosLiga(liga) : [];
const historico = await cargarHistorico(d);
const carrera = construirTemporada(historico.filter(s => s.filas.some(f => f.pid === pid))).pilotos[pid];
const titulos = (d.cfg.palmares || []).reduce((n, p) => n + Object.values(p.ligas || {}).filter(x => x.piloto === pid).length, 0);
const mundiales = (d.cfg.palmares || []).filter(p => p.mundial === pid).length;
const temporadas = new Set(historico.filter(s => s.filas.some(f => f.pid === pid)).map(s => s.sid.split('_')[0])).size;
main.innerHTML = `
<section class="hero">
  <div class="fila" style="gap:20px;align-items:flex-end">
    <div style="font-size:40px;font-weight:700;line-height:1;color:${esc(eq?.color || 'var(--acento)')}">${pl.numero ?? ''}</div>
    <div><div class="fila">${bandera(pl.nac, { ancho: 30 })}<span class="muted">${esc(PAISES[pl.nac] || '')} · ${pl.edad ?? '?'} años</span>${pl.rol === 'P1' ? '<span class="insignia p1">Piloto 1</span>' : ''}${pl.rookie ? '<span class="insignia rookie">Rookie</span>' : ''}${enMundial ? `<span class="insignia mundial">${proy.fijado ? 'Clasificado al Mundial' : 'En zona Mundial'}</span>` : ''}</div>
    <h1 style="margin:6px 0 0">${esc(pl.nombre)} ${esc(pl.apellido)}</h1>
    <div class="fila" style="margin-top:6px">${eq ? celdaEquipo(d, pl.equipoId) : '<span class="muted">Sin equipo</span>'} ${liga ? `<a href="liga.html?l=${liga}">${banderaLiga(liga)} ${esc(LIGAS[liga]?.nombre)}</a>` : ''}</div></div>
  </div>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="datos">
      ${dato(miPos ? `${miPos}º` : '—', 'Posición')}${dato(st?.pts ?? 0, 'Puntos')}${dato(st?.victorias ?? 0, 'Victorias')}${dato(st?.podios ?? 0, 'Podios')}
      ${dato(st?.poles ?? 0, 'Poles')}${dato(st?.vr ?? 0, 'Vueltas rápidas')}${dato(st?.dnf ?? 0, 'Abandonos')}${dato(st?.mediaPos != null ? fmtValor(st.mediaPos) : '—', 'Media llegada')}
      ${dato(st?.eficacia ?? '—', 'Eficacia')}${dato(st?.adel ?? 0, 'Adelantamientos')}${dato(st?.posGanadas ?? 0, 'Posiciones ganadas')}${dato(st?.lideradas ?? 0, 'Vueltas lideradas')}
    </div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Resultados de la temporada</h3></div>${tablaResultados()}</div>
    ${stInt ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Liga Intercontinental</h3></div><div class="datos">${dato(stInt.pts, 'Puntos')}${dato(stInt.victorias, 'Victorias')}${dato(stInt.podios, 'Podios')}${dato(stInt.poles, 'Poles')}</div></div>` : ''}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Carrera deportiva</h3><span>${temporadas} temporada${temporadas === 1 ? '' : 's'}</span></div>
      <div class="datos">${dato(carrera?.carreras ?? 0, 'Carreras')}${dato(carrera?.victorias ?? 0, 'Victorias')}${dato(carrera?.podios ?? 0, 'Podios')}${dato(carrera?.poles ?? 0, 'Poles')}${dato(carrera?.pts ?? 0, 'Puntos')}${dato(titulos, 'Títulos de liga')}${dato(mundiales, 'Mundiales')}</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Trayectoria</h3></div>${historia()}</div>
  </div>
  <aside class="pila">
    ${compId ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Duelo con su compañero</h3></div>
      <p><a href="piloto.html?id=${esc(compId)}">${bandera(d.piloto(compId)?.nac)} ${esc(d.nombre(compId))}</a></p>
      ${duelo('Carreras', st?.h2hC, stComp?.h2hC)}${duelo('Clasificaciones', st?.h2hQ, stComp?.h2hQ)}
      <div class="fila-entre" style="margin-top:10px"><span class="muted">Puntos</span><b>${st?.pts ?? 0} · ${stComp?.pts ?? 0}</b></div></div>` : ''}
    ${zona ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Situación contractual</h3></div>
      <p>${{ despido: '<span class="insignia despido">Despido directo</span>', peligro: '<span class="insignia peligro">Zona de peligro</span>', inmune: '<span class="insignia inmune">Inmune: Mundial</span>', seguro: '<span class="insignia inmune">Asiento seguro</span>' }[zona.zona]}</p>
      <p class="muted" style="font-size:.88rem">Déficit con su compañero: ${zona.deficit > 0 ? '+' : ''}${zona.deficit} puestos · Índice de riesgo ${fmtValor(zona.riesgo)} (si la temporada acabara hoy).</p></div>` : ''}
    ${priv ? `<div class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h3>Informe interno</h3></div>
      <p class="muted" style="font-size:.85rem">Solo lo ves tú porque es tu piloto.</p>
      ${attr('Ritmo', priv.attrs?.ritmo)}${attr('Consistencia', priv.attrs?.consistencia)}${attr('Agresividad', priv.attrs?.agresividad)}${attr('Adelantamiento', priv.attrs?.adelantamiento)}${attr('Defensa', priv.attrs?.defensa)}${attr('Lluvia', priv.attrs?.lluvia)}${attr('Experiencia', priv.attrs?.experiencia)}
      <div class="fila-entre" style="margin-top:10px"><span class="muted">Moral</span><b>${moralTxt(priv.moral)}</b></div>
      <div class="fila-entre"><span class="muted">Forma</span><b>${priv.forma > 0.2 ? 'En racha' : priv.forma < -0.2 ? 'Bajón' : 'Normal'}</b></div></div>` : ''}
  </aside>
</div>`;

function dato(v, t) { return `<div class="dato"><b>${v}</b><span>${t}</span></div>`; }
function attr(n, v) { return `<div style="margin:8px 0"><div class="fila-entre" style="font-size:.88rem"><span>${n}</span><b>${v ?? '?'}</b></div>${barra(v || 0)}</div>`; }
function moralTxt(m) { return m >= 75 ? 'Muy alta' : m >= 60 ? 'Buena' : m >= 45 ? 'Normal' : m >= 30 ? 'Baja' : 'Por los suelos'; }
function duelo(t, a = { g: 0, p: 0 }, b) {
    const tot = (a?.g || 0) + (a?.p || 0);
    const pct = tot ? (a.g / tot) * 100 : 50;
    return `<div style="margin:8px 0"><div class="fila-entre" style="font-size:.88rem"><span>${t}</span><b>${a?.g || 0} - ${a?.p || 0}</b></div><div class="barra"><div class="barra-relleno" style="width:${pct}%"></div></div></div>`;
}
function tablaResultados() {
    if (!eventos.length || !st) return vacio('Todavía no ha competido esta temporada.');
    const cols = ['Q1', 'R1', 'Q2', 'R2', 'R3'];
    return `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Ronda</th>${cols.map(c => `<th class="cen">${SESION_INFO[c].corto}</th>`).join('')}<th class="der">Pts</th></tr></thead><tbody>
    ${eventos.map(ev => {
        const celdas = cols.map(c => {
            const h = st.historial.find(x => x.sid === `${ev.id}_${c}`);
            if (!h) return '<td class="cen tenue">·</td>';
            const txt = h.estado === 'DNF' ? '<span class="insignia dnf">DNF</span>' : h.estado === 'SIN TIEMPO' ? '<span class="muted">ST</span>' : pos(h.pos);
            return `<td class="cen"><a href="sesion.html?id=${esc(h.sid)}">${txt}</a>${h.vr && c.startsWith('R') ? '<span class="insignia vr">VR</span>' : ''}</td>`;
        }).join('');
        return `<tr><td>${bandera(ev.circuito?.pais)} R${ev.ronda} <span class="muted">${esc(ev.circuito?.nombre || '')}</span></td>${celdas}<td class="pts">${st.ptsEvento[ev.id] ?? ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function historia() {
    const h = pub?.historia || [];
    if (!h.length) return `<p class="muted">${pl.rookie ? 'Primera temporada en Hyper Race X1.' : 'Sin temporadas anteriores registradas.'}</p>`;
    return `<table class="tabla"><thead><tr><th>Temporada</th><th>Liga</th><th>Escudería</th><th class="cen">Pos</th><th class="cen">V</th><th class="der">Pts</th></tr></thead><tbody>
    ${h.slice().reverse().map(x => `<tr><td>T${x.temporada}</td><td>${banderaLiga(x.liga)} ${esc(LIGAS[x.liga]?.nombre || x.liga)}</td><td>${celdaEquipo(d, x.equipoId)}</td><td class="cen">${pos(x.pos)}</td><td class="cen">${x.victorias || 0}</td><td class="pts">${x.pts}</td></tr>`).join('')}</tbody></table>`;
}
void $;
