import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store } from '../core/app.js';
import { esc, banderaLiga, vacio, $, $$, bandera } from '../core/ui.js';
import { tarjetasRecords, activarRecords, celdaPiloto, celdaEquipo, pos } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES } from '../engine/constants.js';
import { CATEGORIAS_PILOTO, CATEGORIAS_EQUIPO, ranking } from '../engine/stats.js';

await montar({ activo: 'estadisticas' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);

main.innerHTML = `
<div class="cabecera-pagina"><div><h1>Estadísticas</h1><p class="sub">Temporada ${d.temporada}. Pulsa cualquier récord para ver el ranking completo.</p></div></div>
<div class="sub-pestanas" id="filtro">
  <button data-l="TODAS" class="activa">🌍 Todas las ligas</button>
  ${[...LIGAS_NACIONALES, 'INT'].map(l => `<button data-l="${l}">${banderaLiga(l, { ancho: 16 })} ${esc(LIGAS[l].nombre)}</button>`).join('')}
  <button data-l="PALMARES">🏆 Palmarés</button>
</div>
<div id="cuerpo"></div>`;

const pintar = (l) => {
    $$('#filtro button').forEach(b => b.classList.toggle('activa', b.dataset.l === l));
    const cuerpo = $('#cuerpo');
    if (l === 'PALMARES') return palmares(cuerpo);
    const t = l === 'TODAS' ? d.tablaTodas() : d.tabla(l);
    const pil = Object.values(t.pilotos), eqs = Object.values(t.equipos);
    if (!pil.length) { cuerpo.innerHTML = vacio('Aún no hay datos para estas estadísticas.', '📊'); return; }
    const titulo = l === 'TODAS' ? 'Todas las ligas nacionales' : LIGAS[l].nombre;
    const lider = ranking(CATEGORIAS_PILOTO[0], pil)[0];
    const eficaz = ranking(CATEGORIAS_PILOTO.find(c => c.id === 'eficacia'), pil)[0];
    cuerpo.innerHTML = `
    <div class="rejilla rejilla-4" style="margin-bottom:16px">
      ${destacado('Más puntos', lider && d.nombre(lider.x.pid), lider?.v)}
      ${destacado('Más eficaz', eficaz && d.nombre(eficaz.x.pid), eficaz ? eficaz.v + '/100' : '')}
      ${destacado('Sesiones disputadas', '', (l === 'TODAS' ? d.sesiones.filter(s => s.liga !== 'INT') : d.sesionesLiga(l)).length)}
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
$$('#filtro button').forEach(b => b.addEventListener('click', () => pintar(b.dataset.l)));
pintar('TODAS');

function destacado(t, nombre, v) {
    return `<div class="tarjeta"><div class="etiqueta">${esc(t)}</div><div class="cuenta">${esc(v ?? '—')}</div><div class="muted">${esc(nombre || '')}</div></div>`;
}

async function palmares(cuerpo) {
    const lista = d.cfg.palmares || [];
    if (!lista.length) { cuerpo.innerHTML = vacio('El palmarés se escribe al terminar la primera temporada.', '🏆'); return; }
    const pilotosPub = {};
    const ids = [...new Set(lista.flatMap(p => [...Object.values(p.ligas).map(x => x.piloto), p.mundial]).filter(Boolean))];
    await Promise.all(ids.filter(id => !d.piloto(id)).map(async id => { pilotosPub[id] = await store().get(`pilotos/${id}`).catch(() => null); }));
    const nom = (id) => d.piloto(id) ? celdaPiloto(d, id) : pilotosPub[id] ? `${bandera(pilotosPub[id].nac)} ${esc(pilotosPub[id].nombre)} ${esc(pilotosPub[id].apellido)}` : '—';
    cuerpo.innerHTML = lista.slice().reverse().map(p => `<div class="tarjeta" style="margin-bottom:14px"><div class="tarjeta-titulo"><h2>Temporada ${p.temporada}</h2></div>
      ${p.mundial ? `<p>🌐 <b>Campeón del Mundo:</b> ${nom(p.mundial)} ${p.mundialEquipos ? `· Escuderías: ${celdaEquipo(d, p.mundialEquipos)}` : ''}</p>` : ''}
      <table class="tabla"><thead><tr><th>Liga</th><th>Campeón</th><th>Escudería campeona</th><th class="der">Pts</th></tr></thead><tbody>
      ${Object.entries(p.ligas).map(([l, x]) => `<tr><td>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</td><td>${nom(x.piloto)}</td><td>${celdaEquipo(d, x.equipo)}</td><td class="pts">${x.pts}</td></tr>`).join('')}</tbody></table></div>`).join('');
    void pos;
}
