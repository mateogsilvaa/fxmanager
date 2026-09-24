import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarNoticias } from '../core/datos.js';
import { store, usuario } from '../core/app.js';
import { esc, banderaLiga, fecha, vacio, bandera } from '../core/ui.js';
import { celdaPiloto, listaNoticias, pos } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, SESION_INFO } from '../engine/constants.js';

const FASES = {
    pretemporada: 'Pretemporada · elige tu escudería',
    nacional: 'Ligas nacionales en juego',
    mundial: 'Liga Intercontinental en juego',
    mercado: 'Mercado de fin de temporada',
    cerrada: 'Temporada cerrada',
};

const u = await montar({ activo: 'inicio' });
const main = document.getElementById('main');
const [d, noticias] = await Promise.all([cargarDatos(), cargarNoticias(12)]);
barraDirecto(d);
const rank = await store().get(`ranking/pronosticos_T${d.temporada}`).catch(() => null);

const prox = d.proximas(8);
const siguiente = prox[0];
const ultimas = d.sesiones.filter(s => s.tipo !== 'FP').sort((a, b) => b.t - a.t).slice(0, 6);
const proy = d.clasificadosMundial();

main.innerHTML = `
<section class="hero">
  <div class="etiqueta">${esc(FASES[d.cfg.fase] || '')} · Temporada ${d.temporada}</div>
  <h1>Hyper Race <em>X1</em></h1>
  <p>Cinco ligas nacionales, 50 escuderías, 100 pilotos y un único coche: el BAC Mono. Dirige tu escudería, afina el reglaje, decide la estrategia de cada sesión y pelea por las 20 plazas del Mundial.</p>
  <div class="fila" style="margin-top:18px">
    ${u?.perfil?.equipoId ? `<a class="btn btn-grande" href="escuderia.html">🏎️ Ir a mi escudería</a>` : u ? `<a class="btn btn-grande" href="escuderia.html">Elegir escudería</a>` : `<a class="btn btn-grande" href="entrar.html?modo=registro">Crear cuenta y dirigir un equipo</a>`}
    <a class="btn btn-sec btn-grande" href="pronosticos.html">🎯 Pronósticos</a>
  </div>
</section>

${d.vivos.length ? `<section class="tarjeta resaltada" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2><span class="en-vivo">EN DIRECTO</span></h2></div>
  <div class="rejilla rejilla-3">${d.vivos.map(v => `<a class="tarjeta" href="sesion.html?id=${esc(v.sid)}" style="background:var(--panel-2)">${banderaLiga(v.ev.liga)} <b>${esc(SESION_INFO[v.tipo].nombre)}</b><div class="muted">${esc(v.ev.circuito?.nombre)}</div><div class="btn btn-peq" style="margin-top:10px">Ver en directo</div></a>`).join('')}</div></section>` : ''}

<div class="rejilla rejilla-lado">
  <div class="pila">
    ${siguiente ? `<section class="tarjeta tarjeta-acento">
      <div class="etiqueta">Próxima sesión</div>
      <div class="fila-entre" style="margin-top:6px">
        <div><h2 style="margin:0">${banderaLiga(siguiente.ev.liga, { ancho: 26 })} ${esc(SESION_INFO[siguiente.tipo].nombre)}</h2>
        <div class="muted">${esc(LIGAS[siguiente.ev.liga].nombre)} · ${esc(siguiente.ev.circuito?.nombre)} · ${fecha(siguiente.publishAt)}</div></div>
        <div style="text-align:right"><div class="cuenta" data-cuenta="${siguiente.publishAt}"></div>
        <div class="muted" style="font-size:.85rem">Estrategias cierran en <span data-cuenta="${siguiente.lockAt}"></span></div></div>
      </div></section>` : ''}

    <section>
      <div class="rejilla rejilla-auto">${LIGAS_NACIONALES.map(l => tarjetaLiga(l)).join('')}${tarjetaLiga('INT')}</div>
    </section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Últimos resultados</h2></div>
      ${ultimas.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${ultimas.map(s => `<tr>
        <td>${banderaLiga(s.liga)}</td><td><a href="sesion.html?id=${esc(s.sid)}"><b>${esc(SESION_INFO[s.tipo].nombre)}</b></a><div class="muted" style="font-size:.8rem">${esc(d.evento(s.ev)?.circuito?.nombre || '')}</div></td>
        <td>${pos(1)} ${celdaPiloto(d, s.filas[0]?.pid, { enlace: true })}</td><td class="muted">${fecha(s.t)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no se ha disputado ninguna sesión.')}
    </section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Noticias del paddock</h2></div>${listaNoticias(noticias, { liga: true })}</section>
  </div>

  <aside class="pila">
    <section class="tarjeta"><div class="tarjeta-titulo"><h3>Próximas sesiones</h3></div>
      ${prox.length ? `<ul class="lista">${prox.map(s => `<li><div class="fila-entre"><span>${banderaLiga(s.ev.liga)} <b>${esc(SESION_INFO[s.tipo].corto)}</b> <span class="muted">R${s.ev.ronda}</span></span><span class="muted mono" data-cuenta="${s.publishAt}"></span></div><div class="muted" style="font-size:.8rem">${esc(s.ev.circuito?.nombre)} · ${fecha(s.publishAt)}</div></li>`).join('')}</ul>` : vacio('No hay sesiones programadas.', '📅')}
    </section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h3>🌐 ${proy.fijado ? 'Clasificados al Mundial' : 'Si acabara hoy, al Mundial…'}</h3></div>
      ${proy.clasificados?.length && d.sesiones.length ? `<ul class="lista">${proy.clasificados.slice(0, 20).map(c => `<li class="fila-entre"><span>${banderaLiga(c.liga, { ancho: 16 })} ${esc(d.nombre(c.pid))} ${c.via === 'repesca' ? '<span class="insignia mundial">repesca</span>' : ''}</span><span class="num muted">${c.pts} pts</span></li>`).join('')}</ul>
      ${!proy.fijado && proy.corte ? `<p class="muted" style="font-size:.85rem;margin-top:8px">Corte de repesca: ${proy.corte} pts</p>` : ''}` : vacio('Se decide cuando arranquen las ligas.', '🌐')}
      ${d.cfg.mundial?.nombre ? `<p class="muted" style="font-size:.85rem">Sede del Mundial: ${bandera(d.cfg.mundial.pais)} ${esc(d.cfg.mundial.nombre)}</p>` : ''}
    </section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h3>🎯 Ranking de pronósticos</h3><a class="muted" href="pronosticos.html">Jugar →</a></div>
      ${rankingHtml(rank)}
    </section>
  </aside>
</div>`;

function tarjetaLiga(l) {
    const t = d.clasificacionPilotos(l);
    const lider = d.sesionesLiga(l).length ? t[0] : null;
    const px = d.proximas(1, l)[0];
    return `<a class="tarjeta" href="liga.html?l=${l}" style="border-top:3px solid ${LIGAS[l].color}">
      <div class="fila-entre"><h3 style="margin:0">${banderaLiga(l, { ancho: 26 })} ${esc(LIGAS[l].nombre)}</h3></div>
      <div class="muted" style="font-size:.85rem;margin-top:6px">${lider ? `Líder: <b style="color:var(--texto)">${esc(d.nombre(lider.pid))}</b> · ${lider.pts} pts` : l === 'INT' ? 'La gran final de temporada' : 'Aún sin puntos'}</div>
      <div class="muted" style="font-size:.85rem">${px ? `${esc(SESION_INFO[px.tipo].corto)} en <span data-cuenta="${px.publishAt}"></span>` : 'Sin sesiones pendientes'}</div>
    </a>`;
}

function rankingHtml(r) {
    const lista = Object.entries(r?.usuarios || {}).map(([uid, x]) => ({ uid, ...x })).sort((a, b) => b.puntos - a.puntos).slice(0, 8);
    if (!lista.length) return vacio('Nadie ha puntuado todavía. ¡Sé el primero!', '🎯');
    return `<ul class="lista">${lista.map((x, i) => `<li class="fila-entre"><span>${pos(i + 1)} ${esc(x.nombre)}${x.uid === usuario()?.uid ? ' <span class="muted">(tú)</span>' : ''}</span><b class="num">${x.puntos}</b></li>`).join('')}</ul>`;
}
