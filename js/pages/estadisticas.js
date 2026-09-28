import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarHistorico } from '../core/datos.js';
import { store, usuario } from '../core/app.js';
import { esc, banderaLiga, vacio, $, $$, bandera } from '../core/ui.js';
import { tarjetasRecords, activarRecords, celdaPiloto, celdaEquipo, pos, managerDe, leyendaZonas } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES } from '../engine/constants.js';
import { CATEGORIAS_PILOTO, CATEGORIAS_EQUIPO, ranking, construirTemporada } from '../engine/stats.js';

await montar({ activo: 'estadisticas' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);

main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Desde la temporada 1</div><h1>Estadísticas</h1><p class="sub">Récords históricos acumulados. Pulsa cualquiera para ver el ranking completo.</p></div></div>
<div class="barra-opciones">
  <div class="sub-pestanas" style="margin:0"><button data-modo="historico" class="activa">Histórico</button><button data-modo="temporada">Temporada ${d.temporada}</button><button data-modo="global">Clasificación global</button><button data-modo="palmares">Palmarés</button></div>
  <select id="filtro"><option value="TODAS">Todas las ligas</option><optgroup label="Ligas nacionales">${LIGAS_NACIONALES.map(l => `<option value="${l}">${esc(LIGAS[l].nombre)}</option>`).join('')}</optgroup><optgroup label="Final"><option value="INT">Intercontinental</option></optgroup></select>
</div>
<div id="cuerpo"></div>`;

const historico = await cargarHistorico(d);
let modo = 'historico';
const pintar = () => {
    const l = $('#filtro').value;
    $$('[data-modo]').forEach(b => b.classList.toggle('activa', b.dataset.modo === modo));
    $('#filtro').hidden = modo === 'palmares' || modo === 'global';
    const cuerpo = $('#cuerpo');
    if (modo === 'palmares') return palmares(cuerpo);
    if (modo === 'global') return global(cuerpo);
    const base = modo === 'historico' ? historico : d.sesiones;
    const sesionesSel = base.filter(s => l === 'TODAS' ? s.liga !== 'INT' : s.liga === l);
    const t = construirTemporada(sesionesSel);
    const pil = Object.values(t.pilotos), eqs = Object.values(t.equipos);
    if (!pil.length) { cuerpo.innerHTML = vacio('Aún no hay datos para estas estadísticas.'); return; }
    const titulo = `${l === 'TODAS' ? 'Todas las ligas nacionales' : LIGAS[l].nombre} · ${modo === 'historico' ? 'histórico' : `temporada ${d.temporada}`}`;
    const lider = ranking(CATEGORIAS_PILOTO[0], pil)[0];
    const eficaz = ranking(CATEGORIAS_PILOTO.find(c => c.id === 'eficacia'), pil)[0];
    cuerpo.innerHTML = `
    <div class="rejilla rejilla-4" style="margin-bottom:16px">
      ${destacado('Más puntos', lider && d.nombre(lider.x.pid), lider?.v)}
      ${destacado('Más eficaz', eficaz && d.nombre(eficaz.x.pid), eficaz ? eficaz.v + '/100' : '')}
      ${destacado('Sesiones disputadas', '', sesionesSel.length)}
      ${destacado('Adelantamientos', '', pil.reduce((s, p) => s + (p.adel || 0), 0))}
    </div>
    <h2>Pilotos · lo mejor</h2><div class="rejilla rejilla-auto" id="rp1">${tarjetasRecords(d, CATEGORIAS_PILOTO.filter(c => c.bueno), pil)}</div>
    <h2 style="margin-top:24px">Pilotos · el lado oscuro</h2><div class="rejilla rejilla-auto" id="rp2">${tarjetasRecords(d, CATEGORIAS_PILOTO.filter(c => !c.bueno), pil)}</div>
    <h2 style="margin-top:24px">Escuderías · lo mejor</h2><div class="rejilla rejilla-auto" id="re1">${tarjetasRecords(d, CATEGORIAS_EQUIPO.filter(c => c.bueno), eqs, { tipo: 'equipo' })}</div>
    <h2 style="margin-top:24px">Escuderías · el lado oscuro</h2><div class="rejilla rejilla-auto" id="re2">${tarjetasRecords(d, CATEGORIAS_EQUIPO.filter(c => !c.bueno), eqs, { tipo: 'equipo' })}</div>
    <p class="muted" style="margin-top:16px;font-size:.85rem">La eficacia mide la regularidad vuelta a vuelta en carrera: 100 significa rodar siempre en el mismo tiempo; errores y altibajos la bajan.</p>`;
    activarRecords($('#rp1'), d, CATEGORIAS_PILOTO, pil, { titulo });
    activarRecords($('#rp2'), d, CATEGORIAS_PILOTO, pil, { titulo });
    activarRecords($('#re1'), d, CATEGORIAS_EQUIPO, eqs, { tipo: 'equipo', titulo });
    activarRecords($('#re2'), d, CATEGORIAS_EQUIPO, eqs, { tipo: 'equipo', titulo });
};
$('#filtro').addEventListener('change', () => pintar());
$$('[data-modo]').forEach(b => b.addEventListener('click', () => { modo = b.dataset.modo; pintar(); }));
pintar();

// Clasificación global: todos los pilotos y escuderías de las cinco ligas nacionales juntos
let globalHistorico = false;
function global(cuerpo) {
    const base = (globalHistorico ? historico : d.sesiones).filter(s => s.liga !== 'INT');
    const t = construirTemporada(base);
    const miEq = usuario()?.perfil?.equipoId;
    const P = t.clasPilotos, E = t.clasEquipos;
    const ligaDe = (pid, eq) => d.piloto(pid)?.liga || d.equipo(eq)?.liga;
    // Sombreado: top 3 de cada liga y los 5 wildcards (solo tiene sentido en la temporada actual)
    const proy = !globalHistorico && P.some(p => p.pts > 0) ? d.clasificadosMundial() : null;
    const via = Object.fromEntries((proy?.clasificados || []).map(c => [c.pid, c.via]));
    const zona = (pid) => via[pid] === 'top3' ? 'zona-top3' : via[pid] === 'repesca' ? 'zona-wc' : '';
    cuerpo.innerHTML = `
    <div class="sub-pestanas"><button data-g="0" class="${globalHistorico ? '' : 'activa'}">Temporada ${d.temporada}</button><button data-g="1" class="${globalHistorico ? 'activa' : ''}">Histórico</button></div>
    <p class="muted" style="margin:0 0 18px;max-width:70ch">Las cinco ligas nacionales en una sola tabla: todas corren el mismo número de carreras con el mismo sistema de puntos. ${globalHistorico ? 'Suma todas las temporadas.' : ''}</p>
    ${!P.length ? vacio('Todavía no se ha disputado ninguna sesión.') : `
    <div class="rejilla rejilla-lado">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Pilotos</h2><span>${P.length}</span></div>
        <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Piloto</th><th class="ancho">Liga</th><th class="ancho">Escudería</th><th class="cen" title="Carreras">Car</th><th class="cen" title="Victorias">V</th><th class="cen" title="Podios">Pod</th><th class="cen ancho" title="Poles">Pole</th><th class="cen ancho" title="Puntos por carrera">Pts/C</th><th class="der">Pts</th></tr></thead><tbody>
        ${P.map((p, i) => `<tr class="${d.piloto(p.pid)?.equipoId === miEq ? 'yo' : ''} ${zona(p.pid)}"><td>${pos(i + 1)}</td><td><div class="fila" style="flex-wrap:nowrap;gap:6px">${celdaPiloto(d, p.pid)}${zona(p.pid) === 'zona-wc' ? '<span class="insignia wc" title="Wildcard: uno de los 5 mejores del resto">WC</span>' : ''}</div></td>
          <td class="ancho">${ligaDe(p.pid, p.eq) ? banderaLiga(ligaDe(p.pid, p.eq), { ancho: 16 }) : ''}</td><td class="ancho">${celdaEquipo(d, d.piloto(p.pid)?.equipoId || p.eq)}</td>
          <td class="cen num">${p.carreras || 0}</td><td class="cen num">${p.victorias || 0}</td><td class="cen num">${p.podios || 0}</td><td class="cen num ancho">${p.poles || 0}</td>
          <td class="cen num ancho">${p.carreras ? (p.ptsCarrera / p.carreras).toFixed(1).replace('.', ',') : '—'}</td><td class="pts">${p.pts}</td></tr>`).join('')}
        </tbody></table></div>${proy ? leyendaZonas() : ''}</section>
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Escuderías</h2><span>${E.length}</span></div>
        <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Escudería</th><th class="cen" title="Victorias">V</th><th class="cen" title="Podios">Pod</th><th class="der">Pts</th></tr></thead><tbody>
        ${E.map((e, i) => { const eq = d.equipo(e.eq); return `<tr class="${e.eq === miEq ? 'yo' : ''} ${i < 3 ? 'zona-top3' : ''}"><td>${pos(i + 1)}</td>
          <td><span class="con-bandera">${eq?.liga ? banderaLiga(eq.liga, { ancho: 16 }) : ''}${celdaEquipo(d, e.eq)}</span><div class="muted peq">${managerDe(eq)}</div></td>
          <td class="cen num">${e.victorias || 0}</td><td class="cen num">${e.podios || 0}</td><td class="pts">${e.pts}</td></tr>`; }).join('')}
        </tbody></table></div></section>
    </div>`}`;
    $$('[data-g]', cuerpo).forEach(b => b.addEventListener('click', () => { globalHistorico = b.dataset.g === '1'; global(cuerpo); }));
}

function destacado(t, nombre, v) {
    return `<div class="tarjeta"><div class="etiqueta">${esc(t)}</div><div class="cuenta">${esc(v ?? '—')}</div><div class="muted">${esc(nombre || '')}</div></div>`;
}

async function palmares(cuerpo) {
    const lista = d.cfg.palmares || [];
    if (!lista.length) { cuerpo.innerHTML = vacio('El palmarés se escribe al terminar la primera temporada.'); return; }
    const pilotosPub = {};
    const ids = [...new Set(lista.flatMap(p => [...Object.values(p.ligas).map(x => x.piloto), p.mundial]).filter(Boolean))];
    await Promise.all(ids.filter(id => !d.piloto(id)).map(async id => { pilotosPub[id] = await store().get(`pilotos/${id}`).catch(() => null); }));
    const nom = (id) => d.piloto(id) ? celdaPiloto(d, id) : pilotosPub[id] ? `${bandera(pilotosPub[id].nac)} ${esc(pilotosPub[id].nombre)} ${esc(pilotosPub[id].apellido)}` : '—';
    cuerpo.innerHTML = lista.slice().reverse().map(p => `<div class="tarjeta" style="margin-bottom:14px"><div class="tarjeta-titulo"><h2>Temporada ${p.temporada}</h2></div>
      ${p.mundial ? `<p><b>Campeón del Mundo:</b> ${nom(p.mundial)} ${p.mundialEquipos ? `· Escuderías: ${celdaEquipo(d, p.mundialEquipos)}` : ''}</p>` : ''}
      <table class="tabla"><thead><tr><th>Liga</th><th>Campeón</th><th>Escudería campeona</th><th class="der">Pts</th></tr></thead><tbody>
      ${Object.entries(p.ligas).map(([l, x]) => `<tr><td>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</td><td>${nom(x.piloto)}</td><td>${celdaEquipo(d, x.equipo)}</td><td class="pts">${x.pts}</td></tr>`).join('')}</tbody></table></div>`).join('');
    void pos;
}
