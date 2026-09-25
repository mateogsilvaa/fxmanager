import { montar, barraDirecto, selectorLigas } from '../core/layout.js';
import { cargarDatos, cargarNoticias, cargarHistorico } from '../core/datos.js';
import { usuario } from '../core/app.js';
import { esc, banderaLiga, bandera, vacio, pestanas, $, $$, fecha, chipEquipo } from '../core/ui.js';
import {
    celdaPiloto, celdaEquipo, pos, tablaClasificacionPilotos, tablaClasificacionEquipos, tarjetaEvento, listaNoticias,
    tarjetasRecords, activarRecords, fmtValor, managerDe } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, SESION_INFO, PAISES } from '../engine/constants.js';
import { CATEGORIAS_PILOTO, CATEGORIAS_EQUIPO, calcularRiesgo, construirTemporada } from '../engine/stats.js';
import { generarCronica } from '../engine/cronica.js';

const liga = (new URLSearchParams(location.search).get('l') || 'ESP').toUpperCase();
if (!LIGAS[liga]) location.replace('liga.html?l=ESP');
await montar({ liga });
const main = document.getElementById('main');
const [d, noticias] = await Promise.all([cargarDatos(), cargarNoticias(60)]);
barraDirecto(d);
const L = LIGAS[liga];
const esInt = liga === 'INT';
const eventos = d.eventosLiga(liga);
const tabla = d.tabla(liga);
const clasP = d.clasificacionPilotos(liga);

main.innerHTML = `
${selectorLigas(liga)}
<div class="cabecera-pagina">
  <div><div class="etiqueta">${esInt ? 'Fase final' : 'Liga nacional'} · T${d.temporada}</div><h1>${banderaLiga(liga, { ancho: 26 })} ${esc(esInt ? 'Liga Intercontinental' : L.nombre)}</h1>
  <p class="sub">${esInt ? `${d.cfg.mundial?.nombre ? `Sede: ${esc(d.cfg.mundial.nombre)} · ` : ''}top 3 de cada liga + 5 mejores del resto` : `Temporada ${d.temporada} · 10 escuderías · 5 jornadas`}</p></div>
</div>
<div class="pestanas" id="tabs">
  <button data-tab="clasificacion">Clasificación</button>
  <button data-tab="calendario">Calendario</button>
  <button data-tab="equipos">Escuderías</button>
  <button data-tab="estadisticas">Estadísticas</button>
  ${esInt ? '' : '<button data-tab="riesgo">Mundial y mercado</button>'}
</div>
<section data-panel="clasificacion" id="p-clasificacion"></section>
<section data-panel="calendario" id="p-calendario"></section>
<section data-panel="equipos" id="p-equipos"></section>
<section data-panel="estadisticas" id="p-estadisticas"></section>
<section data-panel="riesgo" id="p-riesgo"></section>`;

const pintados = new Set();
pestanas($('#tabs').parentElement, {
    alCambiar: (id) => {
        if (pintados.has(id)) return;
        pintados.add(id);
        ({ resumen, clasificacion, calendario, cronicas, estadisticas, pilotos, equipos, riesgo })[id]?.();
    },
});

// ---------------------------------------------------------------- Resumen
function resumen() {
    const el = $('#p-resumen');
    const prox = d.proximas(1, liga)[0];
    const evProx = prox ? eventos.find(e => e.id === prox.evId) : eventos.find(e => Object.values(e.sesiones).some(s => d.estadoSesion(s) !== 'final'));
    const ultimoCompleto = eventos.filter(e => Object.values(e.sesiones).every(s => d.estadoSesion(s) === 'final')).pop();
    const news = noticias.filter(n => n.liga === liga).slice(0, 8);
    const proy = !esInt ? d.clasificadosMundial() : null;
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="pila">
        ${evProx ? `<div><div class="etiqueta" style="margin-bottom:8px">${prox ? 'Próxima jornada' : 'Jornada en curso'}</div>${tarjetaEvento(d, evProx)}</div>` : ''}
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Clasificación</h2><button class="btn btn-sec btn-peq" data-ir="clasificacion">Completa →</button></div>${tablaClasificacionPilotos(d, liga, { limite: 10 })}</div>
        ${ultimoCompleto ? podiosEvento(ultimoCompleto) : ''}
      </div>
      <aside class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Escuderías</h3></div>${miniEquipos()}</div>
        ${!esInt && proy ? `<div class="tarjeta"><div class="tarjeta-titulo"><h3>Zona Mundial</h3><button class="btn btn-sec btn-peq" data-ir="riesgo">Ver →</button></div>${zonaMundialLiga(proy)}</div>` : ''}
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>Noticias</h3></div>${listaNoticias(news)}</div>
      </aside>
    </div>`;
    $$('[data-ir]', el).forEach(b => b.addEventListener('click', () => $(`[data-tab="${b.dataset.ir}"]`).click()));
}

function podiosEvento(ev) {
    const carreras = ['R1', 'R2', 'R3'].map(t => d.sesionPublicada(`${ev.id}_${t}`)).filter(Boolean);
    return `<div class="tarjeta"><div class="tarjeta-titulo"><h2>Última jornada · ${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)}</h2><a class="btn btn-sec btn-peq" href="cronica.html?ev=${esc(ev.id)}">Crónica</a></div>
    <div class="rejilla rejilla-3">${carreras.map(s => {
        const fin = s.filas.filter(f => f.estado === 'FIN');
        return `<a href="sesion.html?id=${esc(s.sid)}" style="display:block"><div class="etiqueta">${esc(SESION_INFO[s.tipo].nombre)}${s.ll ? ' · ' : ''}</div>
          <ol class="lista" style="margin-top:6px">${fin.slice(0, 3).map(f => `<li class="fila">${pos(f.pos)} ${esc(d.nombre(f.pid))}</li>`).join('')}</ol></a>`;
    }).join('')}</div></div>`;
}

function miniEquipos() {
    const lista = d.clasificacionEquipos(liga);
    return `<ul class="lista">${lista.map((e, i) => `<li class="fila-entre"><span>${pos(i + 1)} ${celdaEquipo(d, e.eq)}</span><b class="num">${e.pts}</b></li>`).join('')}</ul>`;
}

function zonaMundialLiga(proy) {
    if (!d.sesionesLiga(liga).length) return vacio('Se decide cuando arranque la liga.');
    const aqui = proy.clasificados.filter(c => c.liga === liga);
    const aspir = (proy.aspirantes || []).filter(a => a.liga === liga).slice(0, 3);
    return `<ul class="lista">${aqui.map(c => `<li class="fila-entre"><span>${esc(d.nombre(c.pid))} ${c.via === 'repesca' ? '<span class="insignia mundial">repesca</span>' : ''}</span><span class="num muted">${c.pts}</span></li>`).join('')}</ul>
    ${aspir.length ? `<p class="etiqueta" style="margin-top:10px">Al acecho</p><ul class="lista">${aspir.map(a => `<li class="fila-entre"><span class="muted">${esc(d.nombre(a.pid))}</span><span class="num muted">a ${a.aCorte} pts</span></li>`).join('')}</ul>` : ''}`;
}

// ---------------------------------------------------------------- Clasificación
function clasificacion() {
    const el = $('#p-clasificacion');
    el.innerHTML = `<div class="sub-pestanas" id="sub-clas"><button data-sub="pilotos" class="activa">Pilotos</button><button data-sub="equipos">Escuderías</button><button data-sub="rondas">Por jornada</button></div><div class="tarjeta" id="clas-cuerpo"></div>`;
    const cuerpo = $('#clas-cuerpo', el);
    const pintar = (sub) => {
        $$('#sub-clas button', el).forEach(b => b.classList.toggle('activa', b.dataset.sub === sub));
        if (sub === 'pilotos') cuerpo.innerHTML = tablaClasificacionPilotos(d, liga) + (esInt ? '' : `<p class="muted peq" style="margin:10px 0 0">MUN = en zona de Mundial ahora mismo.</p>`);
        else if (sub === 'equipos') cuerpo.innerHTML = tablaClasificacionEquipos(d, liga);
        else if (sub === 'rondas') cuerpo.innerHTML = tablaRondas();
        else cuerpo.innerHTML = tablaQualy();
    };
    $$('#sub-clas button', el).forEach(b => b.addEventListener('click', () => pintar(b.dataset.sub)));
    pintar('pilotos');
}

function tablaRondas() {
    if (!eventos.length) return vacio('Sin calendario.');
    return `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Piloto</th>${eventos.map(e => `<th class="cen" title="${esc(e.circuito?.nombre)}">R${e.ronda} ${bandera(e.circuito?.pais, { ancho: 16 })}</th>`).join('')}<th class="der">Total</th></tr></thead><tbody>
    ${clasP.map((s, i) => `<tr><td>${pos(i + 1)}</td><td>${celdaPiloto(d, s.pid)}</td>${eventos.map(e => { const v = s.ptsEvento?.[e.id]; return `<td class="cen num ${v == null ? 'tenue' : ''}">${v ?? '·'}</td>`; }).join('')}<td class="pts">${s.pts}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function tablaQualy() {
    const lista = clasP.slice().sort((a, b) => (b.ptsQualy || 0) - (a.ptsQualy || 0) || (b.poles || 0) - (a.poles || 0));
    return `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Piloto</th><th class="cen">Poles</th><th class="cen">Top 5</th><th class="cen">Media</th><th class="der">Pts qualy</th></tr></thead><tbody>
    ${lista.map((s, i) => `<tr><td>${pos(i + 1)}</td><td>${celdaPiloto(d, s.pid, { equipo: true })}</td><td class="cen">${s.poles || 0}</td><td class="cen">${s.qualyTop5 || 0}</td><td class="cen">${s.mediaQualy != null ? fmtValor(s.mediaQualy) : '—'}</td><td class="pts">${s.ptsQualy || 0}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------- Calendario
function calendario() {
    const el = $('#p-calendario');
    el.innerHTML = eventos.length ? `<div class="rejilla rejilla-auto" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))">${eventos.map(ev => tarjetaEvento(d, ev)).join('')}</div>` : vacio('El calendario todavía no está publicado.');
}

// ---------------------------------------------------------------- Crónicas
function cronicas() {
    const el = $('#p-cronicas');
    const completos = eventos.filter(e => Object.values(e.sesiones).every(s => d.estadoSesion(s) === 'final')).reverse();
    if (!completos.length) { el.innerHTML = vacio('La primera crónica llegará al terminar el primera jornada.'); return; }
    el.innerHTML = `<div class="rejilla rejilla-2">${completos.map(ev => {
        const S = {};
        for (const t of ['FP', 'Q1', 'R1', 'Q2', 'R2', 'R3']) { const s = d.sesionPublicada(`${ev.id}_${t}`); if (s) S[t] = { ...s, vr: s.vr ? { pid: s.vr } : null }; }
        const c = generarCronica({ evento: ev, sesiones: S, nombre: d.nombre, apellido: d.apellido, equipo: d.nombreEquipo });
        return `<a class="tarjeta" href="cronica.html?ev=${esc(ev.id)}"><div class="etiqueta">Jornada ${ev.ronda} · ${bandera(ev.circuito?.pais)} ${esc(ev.circuito?.nombre)}</div><h3 style="margin-top:6px">${esc(c.titulo)}</h3><p class="muted">${esc(c.entradilla)}</p><span class="btn btn-sec btn-peq">Leer crónica</span></a>`;
    }).join('')}</div>`;
}

// ---------------------------------------------------------------- Estadísticas
async function estadisticas() {
    const el = $('#p-estadisticas');
    const historico = (await cargarHistorico(d)).filter(s => s.liga === liga);
    if (!historico.length) { el.innerHTML = vacio('Las estadísticas aparecerán tras la primera sesión.'); return; }
    const tablas = { historico: construirTemporada(historico), temporada: tabla };
    let alcance = 'historico', sub = 'rp';
    el.innerHTML = `<div class="barra-opciones"><div class="sub-pestanas" id="sub-est" style="margin:0"><button data-sub="rp" class="activa">Pilotos</button><button data-sub="re">Escuderías</button><button data-sub="tp">Tabla completa</button></div>
      <select id="alcance"><option value="historico">Histórico</option><option value="temporada">Temporada ${d.temporada}</option></select></div><div id="est-cuerpo"></div>`;
    const cuerpo = $('#est-cuerpo', el);
    const pintar = () => {
        const t = tablas[alcance];
        const pil = Object.values(t.pilotos), eqs = Object.values(t.equipos);
        $$('#sub-est button', el).forEach(b => b.classList.toggle('activa', b.dataset.sub === sub));
        if (!pil.length) { cuerpo.innerHTML = vacio('Sin datos todavía.'); return; }
        if (sub === 'rp' || sub === 're') {
            const cats = sub === 'rp' ? CATEGORIAS_PILOTO : CATEGORIAS_EQUIPO;
            const lista = sub === 'rp' ? pil : eqs;
            const tipo = sub === 'rp' ? 'piloto' : 'equipo';
            cuerpo.innerHTML = `<h3>Lo mejor</h3><div class="rejilla rejilla-auto">${tarjetasRecords(d, cats.filter(c => c.bueno), lista, { tipo })}</div>
              <h3 style="margin-top:30px">El lado oscuro</h3><div class="rejilla rejilla-auto">${tarjetasRecords(d, cats.filter(c => !c.bueno), lista, { tipo })}</div>`;
            activarRecords(cuerpo, d, cats, lista, { tipo, titulo: `${L.nombre} · ${alcance === 'historico' ? 'histórico' : `temporada ${d.temporada}`}` });
        } else cuerpo.innerHTML = `<div class="tarjeta">${tablaOrdenablePilotos(pil)}</div>`;
        activarOrden(cuerpo);
    };
    $$('#sub-est button', el).forEach(b => b.addEventListener('click', () => { sub = b.dataset.sub; pintar(); }));
    $('#alcance', el).addEventListener('change', (e) => { alcance = e.target.value; pintar(); });
    pintar();
}

const COLS_P = [
    ['Pts', p => p.pts], ['Carr', p => p.carreras], ['V', p => p.victorias], ['Pod', p => p.podios], ['Pole', p => p.poles], ['VR', p => p.vr],
    ['DNF', p => p.dnf], ['Media', p => p.mediaPos != null ? +p.mediaPos.toFixed(1) : null], ['Parrilla', p => p.mediaParrilla != null ? +p.mediaParrilla.toFixed(1) : null],
    ['Adel', p => p.adel], ['+Pos', p => p.posGanadas], ['−Pos', p => p.posPerdidas], ['Err', p => p.errores], ['Eficacia', p => p.eficacia], ['H2H', p => p.h2hTotal ? p.h2hTotal.g - p.h2hTotal.p : 0],
];
const COLS_E = [
    ['Pts', e => e.pts], ['V', e => e.victorias], ['Pod', e => e.podios], ['Dobl', e => e.dobletes], ['Pole', e => e.poles], ['VR', e => e.vr], ['DNF', e => e.dnf],
    ['Media', e => e.mediaPos != null ? +e.mediaPos.toFixed(1) : null], ['Adel', e => e.adel], ['Err', e => e.errores], ['Eficacia', e => e.eficacia], ['Mejor finde', e => e.mejorFinde],
];
function tablaOrdenablePilotos(lista) {
    return `<div class="tabla-scroll"><table class="tabla ordenable"><thead><tr><th>Piloto</th>${COLS_P.map(([n], i) => `<th class="cen" data-col="${i + 1}" style="cursor:pointer">${n}</th>`).join('')}</tr></thead><tbody>
    ${lista.sort((a, b) => b.pts - a.pts).map(p => `<tr><td data-v="${esc(d.apellido(p.pid))}">${celdaPiloto(d, p.pid)}</td>${COLS_P.map(([, f]) => { const v = f(p); return `<td class="cen num" data-v="${v ?? ''}">${v == null ? '—' : fmtValor(v)}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div><p class="muted" style="font-size:.8rem;margin-top:8px">Pulsa una columna para ordenar. Eficacia = regularidad vuelta a vuelta (100 = todas las vueltas casi iguales). H2H = duelos ganados menos perdidos contra el compañero.</p>`;
}
function tablaOrdenableEquipos(lista) {
    return `<div class="tabla-scroll"><table class="tabla ordenable"><thead><tr><th>Escudería</th>${COLS_E.map(([n], i) => `<th class="cen" data-col="${i + 1}" style="cursor:pointer">${n}</th>`).join('')}</tr></thead><tbody>
    ${lista.sort((a, b) => b.pts - a.pts).map(e => `<tr><td data-v="${esc(d.nombreEquipo(e.eq))}">${celdaEquipo(d, e.eq)}</td>${COLS_E.map(([, f]) => { const v = f(e); return `<td class="cen num" data-v="${v ?? ''}">${v == null ? '—' : fmtValor(v)}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}
function activarOrden(root) {
    $$('table.ordenable th[data-col]', root).forEach(th => {
        th.addEventListener('click', () => {
            const tbody = th.closest('table').tBodies[0];
            const col = +th.dataset.col;
            const nombre = th.textContent.replace(/ [▲▼]$/, '');
            const menosEsMejor = ['Media', 'Parrilla', 'DNF', 'Err', '−Pos'].includes(nombre);
            const dir = th.dataset.dir ? (th.dataset.dir === 'asc' ? 'desc' : 'asc') : (menosEsMejor ? 'asc' : 'desc');
            $$('th', th.parentElement).forEach(x => { delete x.dataset.dir; x.textContent = x.textContent.replace(/ [▲▼]$/, ''); });
            th.dataset.dir = dir; th.textContent = nombre + (dir === 'asc' ? ' ▲' : ' ▼');
            const filas = [...tbody.rows];
            filas.sort((a, b) => {
                const va = a.cells[col].dataset.v, vb = b.cells[col].dataset.v;
                if (va === '' && vb === '') return 0; if (va === '') return 1; if (vb === '') return -1;
                return (dir === 'asc' ? 1 : -1) * (+va - +vb);
            });
            filas.forEach(r => tbody.appendChild(r));
        });
    });
}

// ---------------------------------------------------------------- Pilotos
function pilotos() {
    const el = $('#p-pilotos');
    const lista = d.pilotosLiga(liga).map(p => ({ ...p, st: clasP.find(s => s.pid === p.id) }))
        .sort((a, b) => (a.st?.posicion || 99) - (b.st?.posicion || 99));
    if (!lista.length) { el.innerHTML = vacio(esInt ? 'Los participantes se conocerán al terminar las ligas nacionales.' : 'Sin pilotos.'); return; }
    el.innerHTML = `<div class="rejilla rejilla-auto">${lista.map(p => {
        const eq = d.equipo(p.equipoId);
        return `<a class="tarjeta" href="piloto.html?id=${esc(p.id)}" style="border-left:4px solid ${esc(eq?.color || 'var(--hair)')}">
          <div class="fila-entre"><span class="dorsal" style="font-size:18px">${p.numero ?? ''}</span>${p.st ? pos(p.st.posicion) : ''}</div>
          <div class="fila" style="margin-top:4px">${bandera(p.nac, { ancho: 24 })}<div><div>${esc(p.nombre)}</div><b style="font-size:16px">${esc(p.apellido)}</b></div></div>
          <div class="fila-entre" style="margin-top:8px">${chipEquipo(eq)}<span>${p.rol === 'P1' ? '<span class="insignia p1">Piloto 1</span>' : ''} ${p.rookie ? '<span class="insignia rookie">Rookie</span>' : ''}</span></div>
          <div class="muted" style="font-size:.85rem;margin-top:6px">${esc(PAISES[p.nac] || '')} · ${p.edad ?? '?'} años · <b style="color:var(--texto)">${p.st?.pts ?? 0} pts</b></div></a>`;
    }).join('')}</div>`;
}

// ---------------------------------------------------------------- Escuderías
function equipos() {
    const el = $('#p-equipos');
    const lista = d.clasificacionEquipos(liga);
    const miEq = usuario()?.perfil?.equipoId;
    el.innerHTML = `<div class="rejilla rejilla-auto" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${lista.map((s, i) => {
        const e = d.equipo(s.eq);
        const suyos = Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === s.eq).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.rol === 'P1' ? -1 : 1));
        return `<a class="tarjeta ${s.eq === miEq ? 'resaltada' : ''}" href="equipo.html?id=${esc(s.eq)}" style="border-top:4px solid ${esc(e?.color)}">
          <div class="fila-entre"><h3 style="margin:0">${esc(e?.nombre)}</h3>${pos(i + 1)}</div>
          <div class="muted" style="font-size:.85rem">${e?.grupo ? `Grupo ${esc(e.grupo)} · ` : ''}Mánager: <b style="color:var(--texto)">${managerDe(e)}</b></div>
          <ul class="lista" style="margin-top:8px">${suyos.map(p => `<li class="fila">${bandera(p.nac)} ${esc(p.nombre)} <b>${esc(p.apellido)}</b> ${p.rol === 'P1' ? '<span class="insignia p1">P1</span>' : ''}</li>`).join('')}</ul>
          <div class="datos" style="margin-top:8px"><div class="dato"><b>${s.pts}</b><span>Puntos</span></div><div class="dato"><b>${s.victorias || 0}</b><span>Victorias</span></div><div class="dato"><b>${e?.fans ?? 0}</b><span>Fans</span></div></div></a>`;
    }).join('')}</div>`;
}

// ---------------------------------------------------------------- Mundial y despidos
function riesgo() {
    const el = $('#p-riesgo');
    if (esInt) return;
    const inmunes = new Set((d.cfg.mundial?.participantes?.length ? d.cfg.mundial.participantes : d.clasificadosMundial().clasificados.map(c => c.pid)));
    const r = calcularRiesgo(tabla.clasPilotos.length ? tabla : { clasPilotos: clasP, pilotos: {} }, d.pilotosLiga(liga), { inmunes });
    const proy = d.clasificadosMundial();
    const zona = { despido: '<span class="insignia despido">Despido directo</span>', peligro: '<span class="insignia peligro">Zona de peligro</span>', inmune: '<span class="insignia inmune">Inmune (Mundial)</span>', seguro: '<span class="muted">Seguro</span>' };
    el.innerHTML = `
    <div class="rejilla rejilla-lado">
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h2>Si la temporada acabara hoy</h2></div>
        <p class="muted peq">El riesgo se mide contra el compañero de equipo, no por ir último.</p>
        <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Piloto</th><th class="cen">Pos</th><th>Compañero</th><th class="cen">Pos</th><th class="cen">Déficit</th><th class="cen">Duelos</th><th class="cen">Índice</th><th>Situación</th></tr></thead><tbody>
        ${r.map(x => `<tr><td>${celdaPiloto(d, x.pid)}</td><td class="cen">${x.pos}</td><td>${x.comp ? esc(d.nombre(x.comp)) : '—'}</td><td class="cen">${x.posComp ?? '—'}</td><td class="cen ${x.deficit > 0 ? 'mal' : 'ok'}">${x.deficit > 0 ? '+' : ''}${x.deficit}</td><td class="cen">${x.h2h.g}-${x.h2h.p}</td><td class="cen num">${fmtValor(x.riesgo)}</td><td>${zona[x.zona]}${x.zona === 'peligro' ? (x.caeria ? ' <span class="mal" style="font-size:.8rem">→ caería</span>' : ' <span class="ok" style="font-size:.8rem">→ se salva</span>') : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted" style="font-size:.82rem;margin-top:10px">Despido directo: los 2 índices más altos. Zona de peligro: los 2 siguientes; caen si su compañero está en el top 8 y les saca 5+ puestos, o si les saca 10+. Los clasificados al Mundial son inmunes. Además, cada liga pierde un Galáctico (top 5) y un Táctico (media tabla) que cambian de país.</p>
      </div>
      <aside class="pila">
        <div class="tarjeta"><div class="tarjeta-titulo"><h3>${proy.fijado ? 'Clasificados' : 'Proyección Mundial'}</h3></div>
          ${proy.clasificados?.length && d.sesiones.length ? `<ul class="lista">${proy.clasificados.map(c => `<li class="fila-entre"><span>${banderaLiga(c.liga, { ancho: 16 })} ${c.liga === liga ? `<b>${esc(d.nombre(c.pid))}</b>` : esc(d.nombre(c.pid))} ${c.via === 'repesca' ? '<span class="insignia mundial">repesca</span>' : ''}</span><span class="num muted">${c.pts}</span></li>`).join('')}</ul>` : vacio('Aún sin datos.')}
        </div>
      </aside>
    </div>`;
}

void LIGAS_NACIONALES; void fecha;
