import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, resultado } from '../core/datos.js';
import { ahora, usuario } from '../core/app.js';
import { esc, banderaLiga, bandera, vacio, fecha, $, cuentaAtras } from '../core/ui.js';
import { celdaPiloto, celdaEquipo, pos } from '../core/componentes.js';
import { LIGAS, SESION_INFO, esCarrera, esQualy, SESIONES } from '../engine/constants.js';
import { formatoTiempo } from '../engine/sim.js';

const sid = new URLSearchParams(location.search).get('id') || '';
const tipo = sid.split('_').pop();
const evId = sid.slice(0, sid.length - tipo.length - 1);
const ligaUrl = evId.split('_')[1];
await montar({ liga: ligaUrl });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const ev = d.evento(evId);
if (!ev || !ev.sesiones?.[tipo]) {
    main.innerHTML = vacio('Sesión no encontrada.');
    throw new Error('sesion no encontrada');
}
const ses = ev.sesiones[tipo];
const info = SESION_INFO[tipo];
const miEq = usuario()?.perfil?.equipoId;
const colorEq = (eq) => d.equipo(eq)?.color || '#888';

main.innerHTML = `
<div class="cabecera-pagina">
  <div><div class="etiqueta">${banderaLiga(ev.liga, { ancho: 18 })} ${esc(LIGAS[ev.liga].nombre)} · Ronda ${ev.ronda} · <a href="liga.html?l=${ev.liga}&tab=calendario">calendario</a></div>
  <h1>${esc(info.nombre)}</h1>
  <p class="sub">${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)} · ${fecha(ses.publishAt)}${info.vueltas ? ` · ${info.vueltas} vueltas` : info.minutos ? ` · ${info.minutos} min` : ''}</p></div>
  <div class="sub-pestanas">${SESIONES.filter(t => ev.sesiones[t]).map(t => `<a class="btn btn-peq ${t === tipo ? '' : 'btn-sec'}" href="sesion.html?id=${esc(evId)}_${t}">${esc(SESION_INFO[t].corto)}</a>`).join('')}</div>
</div>
<div id="contenido"></div>`;
const cont = $('#contenido');

const t0 = ahora();
if (t0 < ses.publishAt) antesDePublicar();
else {
    const r = await resultado(sid).catch(() => null);
    if (!r) {
        cont.innerHTML = `<div class="tarjeta">${vacio('La FIA está verificando los resultados. Esta página se actualizará sola.')}</div>`;
        setTimeout(() => location.reload(), 20_000);
    }
    else if (ahora() < ses.revealAt) directo(r);
    else final(r);
}

function antesDePublicar() {
    const abierta = ahora() < ses.lockAt;
    const lluvia = Math.round((ev.meteo?.[tipo] || 0) * 100);
    cont.innerHTML = `<div class="rejilla rejilla-2">
      <div class="tarjeta tarjeta-acento"><div class="etiqueta">La sesión empieza en</div><div class="cuenta" data-cuenta="${ses.publishAt}">${cuentaAtras(ses.publishAt)}</div>
        <p class="muted" style="margin-top:8px">${abierta ? `Las estrategias se cierran en <b data-cuenta="${ses.lockAt}"></b>. Después la FIA simula la sesión y la retransmite en directo a esta hora exacta.` : 'Estrategias cerradas. La sesión se retransmitirá en directo aquí mismo.'}</p>
        <div class="fila">${miEq && abierta ? '<a class="btn" href="escuderia.html?tab=carrera">Preparar estrategia</a>' : ''}</div>
      </div>
      <div class="tarjeta"><div class="etiqueta">Previsión meteorológica</div><div class="cuenta">${lluvia}%</div><p class="muted">Probabilidad de lluvia. Con lluvia el reglaje importa menos y la habilidad del piloto en mojado mucho más.</p>
        <div class="etiqueta" style="margin-top:12px">Circuito</div><p class="muted">${ev.circuito?.km} km · referencia ${formatoTiempo(ev.circuito?.tiempoBase)} · Adelantar: ${nivelTxt(ev.circuito?.adelantar)} · Desgaste: ${nivelTxt(ev.circuito?.desgaste)}</p></div>
    </div>`;
    setTimeout(() => location.reload(), Math.max(5000, ses.publishAt - ahora() + 1500));
}
function nivelTxt(v) { return v == null ? '—' : v > 0.55 ? 'alto' : v > 0.35 ? 'medio' : 'bajo'; }

// ---------------------------------------------------------------- Directo
function directo(r, { repeticion = false, velocidad = 1 } = {}) {
    const duracion = Math.max(20_000, ses.revealAt - ses.publishAt - 15_000);
    const inicio = repeticion ? Date.now() : null;
    const n = esCarrera(tipo) ? info.vueltas : Math.max(...r.filas.map(f => f.laps.length));
    cont.innerHTML = `<div class="rejilla rejilla-lado">
      <div class="tarjeta"><div class="tarjeta-titulo"><h2><span class="en-vivo">${repeticion ? 'REPETICIÓN' : 'EN DIRECTO'}</span></h2><span class="progreso-carrera" id="prog"></span></div>
        ${r.lluvia ? '<div class="info-caja" style="margin-bottom:10px">Sesión en mojado</div>' : ''}
        <div class="torre" id="torre"></div>
        <div class="fila-botones"><button class="btn btn-sec btn-peq" id="spoiler">Saltar al resultado final</button></div></div>
      <div class="tarjeta"><div class="tarjeta-titulo"><h3>Lo que está pasando</h3></div><div class="feed" id="feed"></div></div>
    </div>`;
    $('#spoiler').addEventListener('click', () => { clearInterval(h); final(r); });
    const offset = {};
    r.filas.forEach(f => { offset[f.pid] = ((f.parrilla || 1) - 1) * 250; });
    let prevOrden = [];
    const pintar = () => {
        const trans = repeticion ? (Date.now() - inicio) * velocidad : ahora() - ses.publishAt;
        const frac = Math.min(1, trans / duracion);
        const k = Math.min(n, Math.floor(frac * n + 1e-9));
        let filas;
        if (esCarrera(tipo)) {
            $('#prog').textContent = k === 0 ? 'Salida' : k >= n ? 'Bandera a cuadros' : `Vuelta ${k + 1}/${n}`;
            filas = r.filas.map(f => {
                const hechas = Math.min(k, f.laps.length);
                const fuera = f.estado === 'DNF' && hechas < k;
                const cum = offset[f.pid] + f.laps.slice(0, hechas).reduce((s, x) => s + x, 0);
                const p = hechas > 0 ? f.posLap[hechas - 1] : f.parrilla;
                return { f, cum, p: fuera ? 100 + (f.vueltas) : (p ?? 99), fuera, hechas };
            }).sort((a, b) => a.fuera - b.fuera || (a.fuera ? b.hechas - a.hechas : a.p - b.p));
            const lider = filas[0]?.cum || 0;
            filas.forEach((x, i) => { x.txt = x.fuera ? 'OUT' : k === 0 ? `P${x.f.parrilla}` : i === 0 ? `V${k}` : `+${((x.cum - lider) / 1000).toFixed(1)}`; });
        } else {
            $('#prog').textContent = k >= n ? 'Sesión terminada' : `Quedan ${Math.max(0, Math.ceil((1 - frac) * (info.minutos || 15)))} min`;
            filas = r.filas.map(f => {
                const vistas = f.laps.slice(0, k).filter(t => t > 0);
                const best = vistas.length ? Math.min(...vistas) : null;
                return { f, best };
            }).sort((a, b) => (a.best ?? 1e12) - (b.best ?? 1e12));
            const mejor = filas[0]?.best;
            filas.forEach((x, i) => { x.txt = x.best == null ? 'Sin tiempo' : i === 0 ? formatoTiempo(x.best) : `+${((x.best - mejor) / 1000).toFixed(3)}`; });
        }
        const orden = filas.map(x => x.f.pid);
        $('#torre').innerHTML = filas.map((x, i) => {
            const antes = prevOrden.indexOf(x.f.pid);
            const cls = antes >= 0 && antes > i ? 'sube' : antes >= 0 && antes < i ? 'baja' : '';
            return `<div class="torre-fila ${cls} ${x.fuera ? 'fuera' : ''}" style="border-left:3px solid ${esc(colorEq(x.f.eq))}${x.f.eq === miEq ? ';outline:1px solid var(--acento)' : ''}">${pos(i + 1)}${celdaPiloto(d, x.f.pid, { enlace: false })}<span class="muted" style="font-size:.8rem">${esc(d.equipo(x.f.eq)?.corto || '')}</span><span class="gap">${esc(x.txt)}</span></div>`;
        }).join('');
        prevOrden = orden;
        if (esCarrera(tipo)) {
            const evs = (r.eventos || []).filter(e => e.v <= k).slice().reverse();
            $('#feed').innerHTML = evs.length ? evs.slice(0, 60).map(textoEvento).join('') : '<div>Semáforo en rojo… ¡se apagan las luces!</div>';
        } else {
            const vr = filas[0];
            $('#feed').innerHTML = vr?.best ? `<div class="adel">Mejor tiempo provisional: <b>${esc(d.nombre(vr.f.pid))}</b> · ${formatoTiempo(vr.best)}</div>` : '<div>Los coches salen a pista…</div>';
        }
        if (frac >= 1) { clearInterval(h); setTimeout(() => final(r), 2500); }
    };
    const h = setInterval(pintar, 1000);
    pintar();
}

function textoEvento(e) {
    const n = (pid) => `<b>${esc(d.apellido(pid))}</b>`;
    if (e.tipo === 'adelantamiento') return `<div class="adel">V${e.v} · ${n(e.pid)} adelanta a ${n(e.pid2)}</div>`;
    if (e.tipo === 'abandono') return `<div class="aband">V${e.v} · Abandono de ${n(e.pid)}${e.motivo ? ` (${esc(e.motivo.toLowerCase())})` : ''}</div>`;
    if (e.tipo === 'error') return `<div class="err">V${e.v} · ${n(e.pid)} se sale y pierde ${(e.ms / 1000).toFixed(1)} s</div>`;
    if (e.tipo === 'toque') return `<div class="err">V${e.v} · Toque${e.pid2 ? ` entre ${n(e.pid)} y ${n(e.pid2)}` : ` de ${n(e.pid)}`}${e.perjudicado ? `: el peor parado es ${n(e.perjudicado)}` : ''}</div>`;
    if (e.tipo === 'accidente') return `<div class="aband">${n(e.pid)} se va contra las protecciones</div>`;
    return '';
}

// ---------------------------------------------------------------- Resultado final
function final(r) {
    const carrera = esCarrera(tipo);
    const vr = r.vr?.pid;
    const lider = r.filas[0];
    cont.innerHTML = `
    ${r.lluvia ? '<div class="info-caja" style="margin-bottom:12px">Sesión disputada en mojado</div>' : ''}
    <div class="podio" style="margin-bottom:16px">${[1, 0, 2].map(i => r.filas[i]).map((f, k) => f ? `<div class="p${[2, 1, 3][k]}"><div class="muted">${[2, 1, 3][k]}º</div>${bandera(d.piloto(f.pid)?.nac, { ancho: 24 })}<b>${esc(d.apellido(f.pid))}</b><div class="muted" style="font-size:.85rem">${esc(d.equipo(f.eq)?.nombre || '')}</div></div>` : '<div></div>').join('')}</div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h2>Clasificación</h2>${carrera || esQualy(tipo) ? '<button class="btn btn-sec btn-peq" id="repetir">▶ Ver repetición</button>' : ''}</div>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Piloto</th><th class="ancho">Escudería</th>
      ${carrera ? '<th class="cen ancho">Salida</th><th class="cen">+/−</th><th class="cen ancho">Vueltas</th><th class="der">Tiempo</th><th class="der ancho">Mejor vuelta</th><th class="cen ancho">Adel.</th>' : '<th class="der">Mejor vuelta</th><th class="der">Dif.</th><th class="cen ancho">Vueltas</th>'}
      <th class="der">Pts</th></tr></thead><tbody>
      ${r.filas.map(f => {
        const dif = f.parrilla && f.estado === 'FIN' ? f.parrilla - f.pos : null;
        return `<tr class="${f.eq === miEq ? 'yo' : ''}"><td>${pos(f.pos)}</td><td>${celdaPiloto(d, f.pid)} ${vr === f.pid && carrera ? '<span class="insignia vr" title="Vuelta rápida +3">VR</span>' : ''}</td><td class="ancho">${celdaEquipo(d, f.eq)}</td>
        ${carrera ? `<td class="cen ancho">${f.parrilla ?? '—'}</td><td class="cen ${dif > 0 ? 'ok' : dif < 0 ? 'mal' : 'muted'}">${dif == null ? '' : dif > 0 ? `▲${dif}` : dif < 0 ? `▼${-dif}` : '='}</td><td class="cen ancho">${f.vueltas}</td>
          <td class="der mono">${f.estado === 'DNF' ? `<span class="insignia dnf">DNF</span> <span class="muted" style="font-size:.8rem">${esc(f.motivo || '')}</span>` : f.pos === 1 ? formatoTiempo(f.tiempo) : formatoTiempo(f.gap, true)}</td>
          <td class="der mono ancho">${formatoTiempo(f.mejor)}</td><td class="cen ancho">${f.adel || 0}</td>`
            : `<td class="der mono">${f.mejor ? formatoTiempo(f.mejor) : '<span class="muted">Sin tiempo</span>'}</td><td class="der mono muted">${f.mejor && f !== lider ? formatoTiempo(f.mejor - lider.mejor, true) : ''}</td><td class="cen ancho">${f.laps.length}</td>`}
        <td class="pts">${f.pts || ''}</td></tr>`;
    }).join('')}
    </tbody></table></div>
    ${vr && carrera ? `<p class="muted" style="margin-top:10px">Vuelta rápida: <b style="color:var(--texto)">${esc(d.nombre(vr))}</b> · ${formatoTiempo(r.vr.t)} (vuelta ${r.vr.v}) · +3 puntos</p>` : ''}
    </div>
    ${carrera ? `<div class="rejilla rejilla-2" style="margin-top:16px"><div class="tarjeta"><div class="tarjeta-titulo"><h3>Posiciones vuelta a vuelta</h3></div><div class="grafica">${graficaPosiciones(r)}</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Incidencias</h3></div><div class="feed">${(r.eventos || []).filter(e => e.tipo !== 'adelantamiento').map(textoEvento).join('') || '<div>Carrera limpia, sin incidentes.</div>'}</div>
    <p class="muted" style="margin-top:10px;font-size:.85rem">${(r.eventos || []).filter(e => e.tipo === 'adelantamiento').length} adelantamientos en pista.</p></div></div>` : ''}
    ${carrera ? `<div class="tarjeta" style="margin-top:16px"><div class="tarjeta-titulo"><h3>Tiempos por vuelta</h3></div>${tablaVueltas(r)}</div>` : ''}`;
    $('#repetir')?.addEventListener('click', () => directo(r, { repeticion: true, velocidad: 4 }));
}

function graficaPosiciones(r) {
    const n = info.vueltas, N = r.filas.length;
    const W = 640, H = 360, ml = 28, mr = 90, mt = 10, mb = 22;
    const x = (v) => ml + (v / n) * (W - ml - mr);
    const y = (p) => mt + ((p - 1) / Math.max(1, N - 1)) * (H - mt - mb);
    const lineas = r.filas.map(f => {
        const pts = [[0, f.parrilla || N], ...f.posLap.map((p, i) => [i + 1, p])];
        const color = colorEq(f.eq);
        const ultimo = pts[pts.length - 1];
        const destacar = f.eq === miEq;
        return `<polyline fill="none" stroke="${esc(color)}" stroke-width="${destacar ? 3 : 1.6}" stroke-opacity="${destacar ? 1 : .85}" points="${pts.map(([v, p]) => `${x(v).toFixed(1)},${y(p).toFixed(1)}`).join(' ')}"/>
        <text x="${x(ultimo[0]) + 5}" y="${y(ultimo[1]) + 3}">${esc(d.apellido(f.pid))}${f.estado === 'DNF' ? ' ✕' : ''}</text>`;
    }).join('');
    const ejes = Array.from({ length: n + 1 }, (_, v) => `<line class="eje" x1="${x(v)}" x2="${x(v)}" y1="${mt}" y2="${H - mb}"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle">${v === 0 ? 'S' : v}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Posiciones por vuelta">${ejes}${lineas}</svg>`;
}

function tablaVueltas(r) {
    const n = info.vueltas;
    const mejores = Array.from({ length: n }, (_, i) => Math.min(...r.filas.map(f => f.laps[i] ?? Infinity)));
    return `<div class="tabla-scroll"><table class="tabla mono" style="font-size:.8rem"><thead><tr><th>Piloto</th>${Array.from({ length: n }, (_, i) => `<th class="der">V${i + 1}</th>`).join('')}</tr></thead><tbody>
    ${r.filas.map(f => `<tr><td style="font-family:var(--f-texto)">${esc(d.apellido(f.pid))}</td>${Array.from({ length: n }, (_, i) => { const t = f.laps[i]; return `<td class="der ${t === mejores[i] ? 'ok' : ''} ${t && t - f.mejor > 1500 ? 'aviso' : ''}">${t ? formatoTiempo(t) : ''}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div><p class="muted" style="font-size:.8rem;margin-top:6px">En verde, la vuelta más rápida de cada giro. En amarillo, vueltas con error o tráfico.</p>`;
}
