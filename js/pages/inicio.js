import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarPaddock } from '../core/datos.js';
import { esc, banderaLiga, fecha, vacio, hace } from '../core/ui.js';
import { celdaPiloto, pos } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, SESION_INFO } from '../engine/constants.js';

const FASES = {
    pretemporada: 'Pretemporada', nacional: 'Ligas nacionales', mundial: 'Liga Intercontinental',
    mercado: 'Mercado de fin de temporada', cerrada: 'Temporada cerrada',
};

const u = await montar({ activo: 'inicio' });
const main = document.getElementById('main');
const [d, paddock] = await Promise.all([cargarDatos(), cargarPaddock(3)]);
barraDirecto(d);

const prox = d.proximas(6);
const siguiente = prox[0];
const ultimas = d.sesiones.filter(s => s.tipo !== 'FP').sort((a, b) => b.t - a.t).slice(0, 5);
const managers = d.rankingManagers().slice(0, 5);

const cta = u?.perfil?.equipoId ? `<a class="btn" href="escuderia.html">Mi escudería</a>`
    : u ? `<a class="btn" href="escuderia.html">Elegir escudería</a>`
    : `<a class="btn" href="entrar.html?modo=registro">Crear cuenta</a><a class="btn btn-sec" href="entrar.html">Entrar</a>`;

main.innerHTML = `
<section class="hero">
  <div class="etiqueta">${esc(FASES[d.cfg.fase] || '')} · Temporada ${d.temporada}</div>
  <h1>Hyper Race X1</h1>
  <p>Dirige una escudería en una de las 5 ligas y lucha por las 20 plazas del Mundial.</p>
  <div class="fila">${cta}</div>
</section>

${siguiente ? `<a class="tarjeta fila-entre" href="liga.html?l=${siguiente.ev.liga}&tab=calendario" style="margin-bottom:12px">
  <div><div class="etiqueta">Próxima sesión</div>
  <div style="margin-top:2px">${banderaLiga(siguiente.ev.liga)} <b>${esc(SESION_INFO[siguiente.tipo].nombre)}</b> <span class="muted">· ${esc(siguiente.ev.circuito?.nombre)}</span></div>
  <div class="muted peq">${fecha(siguiente.publishAt)} · estrategias cierran en <span data-cuenta="${siguiente.lockAt}"></span></div></div>
  <div class="cuenta mono" data-cuenta="${siguiente.publishAt}"></div></a>` : ''}

<div class="rejilla rejilla-lado">
  <div class="pila">
    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Ligas</h2></div>
      <div class="tabla-scroll"><table class="tabla"><tbody>
      ${[...LIGAS_NACIONALES, 'INT'].map(l => {
          const lider = d.sesionesLiga(l).length ? d.clasificacionPilotos(l)[0] : null;
          const px = d.proximas(1, l)[0];
          return `<tr><td style="width:1%">${banderaLiga(l)}</td><td style="white-space:nowrap"><a href="liga.html?l=${l}"><b>${esc(l === 'INT' ? 'Mundial' : LIGAS[l].nombre)}</b></a></td>
            <td>${lider ? `${esc(d.nombre(lider.pid))} <span class="muted">${lider.pts}</span>` : '<span class="tenue">—</span>'}</td>
            <td class="der muted peq" style="white-space:nowrap">${px ? `${esc(SESION_INFO[px.tipo].corto)}<br><span data-cuenta="${px.publishAt}" data-corta></span>` : ''}</td></tr>`;
      }).join('')}
      </tbody></table></div></section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Últimos resultados</h2></div>
      ${ultimas.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${ultimas.map(s => `<tr>
        <td style="width:1%">${banderaLiga(s.liga)}</td><td><a href="sesion.html?id=${esc(s.sid)}">${esc(SESION_INFO[s.tipo].nombre)}</a><div class="muted peq">${esc(d.evento(s.ev)?.circuito?.nombre || '')}</div></td>
        <td>${celdaPiloto(d, s.filas[0]?.pid)}</td><td class="der muted peq">${hace(s.t)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no se ha disputado ninguna sesión.')}
    </section>

  </div>

  <aside class="pila">
    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Paddock</h2><a class="muted peq" href="paddock.html">Ver todo</a></div>
      ${paddock.length ? paddock.map(x => `<div class="declaracion"><div class="meta">${banderaLiga(x.liga, { ancho: 14 })} <b style="color:var(--texto)">${esc(x.nombre)}</b> · ${hace(x.fecha)}</div><p>${esc(x.texto)}</p></div>`).join('') : vacio('Los mánagers todavía no han hablado.')}
    </section>

    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Mejores mánagers</h2><a class="muted peq" href="paddock.html">Ranking</a></div>
      ${managers.length ? `<ul class="lista">${managers.map((m, i) => `<li class="fila-entre"><span>${pos(i + 1)} ${esc(m.nombre)} <span class="muted peq">${esc(d.nombreEquipo(m.eq))}</span></span><b class="num">${m.indice}</b></li>`).join('')}</ul>` : vacio('Aún no hay mánagers.')}
    </section>

  </aside>
</div>`;
