// Laboratorio: simular libres, qualy y carrera con una parrilla inventada (no toca datos del juego)
import { montar } from '../core/layout.js';
import { esc, bandera, $, $$ } from '../core/ui.js';
import { montarDirecto } from '../core/directo.js';
import { simularSesion, ritmoBase, formatoTiempo } from '../engine/sim.js';
import { CIRCUITOS, normalizarCircuito } from '../engine/circuitos.js';
import { SESION_INFO, esCarrera, esQualy, duracionDirecto, AREAS } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { nombreAleatorio } from '../engine/nombres.js';
import { atributosAleatorios, calidadSetup } from '../engine/juego.js';
import { TRAZADOS } from '../engine/trazados.js';
import { COMPUESTOS, vidaNeumaticos, mejorEstrategia } from '../engine/neumaticos.js';

await montar({});
const main = document.getElementById('main');

// ---------------------------------------------------------------- Parrilla inventada
const EQUIPOS = [
    ['Aurora Racing', '#c1121f'], ['Nimbus Motorsport', '#1d3557'], ['Vértice GP', '#2a9d8f'], ['Halcón Competición', '#e9c46a'],
    ['Brisa Corse', '#6a3fa0'], ['Norte Engineering', '#264653'], ['Ámbar Racing', '#f4a261'], ['Delta Works', '#8d99ae'],
    ['Tempesta Team', '#e76f51'], ['Cobalto Racing', '#457b9d'],
];
const NACS = ['es', 'es', 'it', 'gb', 'de', 'fr', 'pt', 'au', 'nl', 'br'];

function nuevaParrilla(semilla) {
    const rng = crearRng(`lab|${semilla}`);
    const usados = new Set();
    const equipos = {}, pilotos = [];
    EQUIPOS.forEach(([nombre, color], i) => {
        const id = `eq${i}`;
        const nivel = rng.int(0, 6);
        equipos[id] = {
            id, nombre, corto: nombre.split(' ')[0], color,
            coche: { motor: clampN(nivel + rng.int(-2, 2)), aero: clampN(nivel + rng.int(-2, 2)), chasis: clampN(nivel + rng.int(-2, 2)), fiabilidad: clampN(nivel + rng.int(-2, 2)) },
            reglaje: Math.round((0.55 + rng.next() * 0.4) * 100) / 100,
        };
        for (let k = 0; k < 2; k++) {
            const nac = rng.pick(NACS);
            const { nombre: n, apellido } = nombreAleatorio(rng, nac, usados);
            pilotos.push({
                id: `p${i}_${k}`, nombre: n, apellido, nac, numero: 2 + i * 7 + k * 3, equipoId: id,
                attrs: atributosAleatorios(rng, { estrella: rng.chance(0.15) ? 1 : 0 }),
                moral: rng.int(40, 85), forma: Math.round((rng.next() - 0.5) * 60) / 100,
                estr: { riesgo: rng.pick([1, 2, 2, 3]), ritmo: rng.pick(['conservador', 'equilibrado', 'equilibrado', 'ataque']), actitud: rng.pick(['defensiva', 'normal', 'normal', 'agresiva']) },
            });
        }
    });
    return { equipos, pilotos };
}
const clampN = (v) => Math.max(0, Math.min(10, v));

let semillaParrilla = Math.floor(Math.random() * 1e9);
let P = nuevaParrilla(semillaParrilla);
let ultimaQualy = null;

// Datos mínimos que necesita la retransmisión
const d = {
    piloto: (pid) => P.pilotos.find(p => p.id === pid) || null,
    equipo: (eq) => P.equipos[eq] || null,
    nombre: (pid) => { const p = d.piloto(pid); return p ? `${p.nombre} ${p.apellido}` : '—'; },
    apellido: (pid) => d.piloto(pid)?.apellido || '—',
    nombreEquipo: (eq) => P.equipos[eq]?.nombre || '—',
};

// ---------------------------------------------------------------- Interfaz
const circuitos = CIRCUITOS.filter(c => TRAZADOS[c.id]);
main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Laboratorio · parrilla inventada</div><h1>Simulador de sesiones</h1>
  <p class="sub">Así simula el juego unos libres, una clasificación y una carrera. Nada de lo que hagas aquí afecta a la liga.</p></div></div>

<div class="rejilla rejilla-lado">
  <div class="pila">
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>Sesión</h2></div>
      <div class="lab-controles">
        <label>Tipo<select id="l-tipo">
          <option value="FP">Entrenamientos libres</option><option value="Q1">Clasificación</option>
          <option value="R1">Carrera corta (10 vueltas)</option><option value="R3">Carrera larga (20 vueltas, con paradas)</option></select></label>
        <label>Circuito<select id="l-circuito">${circuitos.map(c => `<option value="${esc(c.id)}" ${c.id === 'jerez' ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
        <label class="lab-check"><input type="checkbox" id="l-lluvia"> Lluvia</label>
      </div>
      <p class="muted peq" id="l-parrilla-txt"></p>
      <div class="fila-botones"><button class="btn btn-sec" id="l-otra">Otra parrilla</button><button class="btn" id="l-simular">Simular</button></div>
    </section>
    <section id="l-directo"></section>
    <section id="l-resultado"></section>
  </div>
  <aside class="pila">
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>Tu equipo</h2></div>
      <p class="muted peq" style="margin-top:0">Cambia estos valores de <b id="l-mio-nombre"></b> y vuelve a simular para ver su efecto.</p>
      <div id="l-mio"></div>
    </section>
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>Cómo funciona</h2></div>
      <div class="guia-lab">
        <h4>Ritmo de cada piloto</h4>
        <p>Cada vuelta parte del tiempo de referencia del circuito y se corrige con el coche (motor, aero y chasis según lo que pida el trazado), el ritmo del piloto, su experiencia, la calidad del reglaje, la moral y la forma. Con lluvia todo va un 9% más lento y cuenta la habilidad en mojado.</p>
        <h4>Libres</h4>
        <p>8 vueltas lanzadas. Un 8% de vueltas pillan tráfico y a veces hay errores que anulan la vuelta. Cuenta la mejor. No dan puntos.</p>
        <h4>Clasificación</h4>
        <p>4 intentos. El riesgo elegido (seguro, normal, al límite) gana hasta un 0,35% por vuelta pero multiplica los errores; al límite hay opciones de accidente. Da puntos al top 5 y la parrilla de la carrera.</p>
        <h4>Carrera</h4>
        <p>Vuelta a vuelta: salida (experiencia y agresividad), degradación de neumáticos (según circuito, ritmo y compuesto), errores, accidentes y averías (fiabilidad). Cuando un coche es más rápido que el de delante intenta adelantar: la probabilidad depende de la diferencia de ritmo, de lo fácil que sea adelantar en ese circuito y del duelo entre agresividad y defensa. Los adelantamientos pueden acabar en toque.</p>
      </div>
    </section>
  </aside>
</div>`;

const mioId = 'eq0';
const miPlan = { salida: 'auto', parada: 10, tras: 'duro' };
function pintarMio() {
    const e = P.equipos[mioId];
    const pil = P.pilotos.filter(p => p.equipoId === mioId);
    $('#l-mio-nombre').textContent = e.nombre;
    const s = pil[0].estr;
    const sel = (id, opts, v) => `<select data-mio="${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    $('#l-mio').innerHTML = `
      ${Object.keys(AREAS).map(k => `<div class="setup-param"><span>${esc(AREAS[k].nombre)}</span><input type="range" min="0" max="10" data-coche="${k}" value="${e.coche[k]}" oninput="this.nextElementSibling.value=this.value"><output>${e.coche[k]}</output></div>`).join('')}
      <div class="setup-param"><span>Reglaje (0-100%)</span><input type="range" min="30" max="100" data-mio="reglaje" value="${Math.round(e.reglaje * 100)}" oninput="this.nextElementSibling.value=this.value"><output>${Math.round(e.reglaje * 100)}</output></div>
      <div class="lab-controles" style="margin-top:10px">
        <label>Riesgo en qualy${sel('riesgo', [[1, 'Seguro'], [2, 'Normal'], [3, 'Al límite']], s.riesgo)}</label>
        <label>Ritmo de carrera${sel('ritmo', [['conservador', 'Suave'], ['equilibrado', 'Normal'], ['ataque', 'Ataque']], s.ritmo)}</label>
        <label>Actitud${sel('actitud', [['defensiva', 'Defensiva'], ['normal', 'Normal'], ['agresiva', 'Agresiva']], s.actitud)}</label>
      </div>
      <div class="lab-controles" style="margin-top:10px">
        <label>Carrera 20 v · salida${sel('salida', [['auto', 'Lo que diga el ingeniero'], ...Object.entries(COMPUESTOS).map(([k, c]) => [k, c.nombre])], miPlan.salida)}</label>
        <label>Parada en la vuelta<input type="number" min="0" max="19" data-mio="parada" value="${miPlan.parada}"><small class="muted">0 = sin parar</small></label>
        <label>Neumático tras parar${sel('tras', Object.entries(COMPUESTOS).map(([k, c]) => [k, c.nombre]), miPlan.tras)}</label>
      </div>
      <p class="muted peq">Pilotos: ${pil.map(p => `${bandera(p.nac, { ancho: 14 })} ${esc(p.apellido)} (ritmo ${p.attrs.ritmo})`).join(' · ')}</p>`;
    $$('[data-coche]').forEach(i => i.addEventListener('input', () => { e.coche[i.dataset.coche] = +i.value; }));
    $$('[data-mio]').forEach(i => i.addEventListener('change', () => {
        if (i.dataset.mio === 'reglaje') e.reglaje = +i.value / 100;
        else if (i.dataset.mio === 'salida') miPlan.salida = i.value;
        else if (i.dataset.mio === 'parada') miPlan.parada = +i.value;
        else if (i.dataset.mio === 'tras') miPlan.tras = i.value;
        else pil.forEach(p => { p.estr[i.dataset.mio] = i.dataset.mio === 'riesgo' ? +i.value : i.value; });
    }));
    $('[data-mio="reglaje"]').addEventListener('input', (ev) => { e.reglaje = +ev.target.value / 100; });
}
function textoParrilla() {
    const tipo = $('#l-tipo').value;
    $('#l-parrilla-txt').textContent = esCarrera(tipo) ? (ultimaQualy ? 'La carrera sale con la parrilla de tu última clasificación.' : 'No has simulado una clasificación: la parrilla será por sorteo.') : '';
}
pintarMio(); textoParrilla();
$('#l-tipo').addEventListener('change', textoParrilla);
$('#l-otra').addEventListener('click', () => { semillaParrilla = Math.floor(Math.random() * 1e9); P = nuevaParrilla(semillaParrilla); ultimaQualy = null; pintarMio(); textoParrilla(); $('#l-directo').innerHTML = ''; $('#l-resultado').innerHTML = ''; });
$('#l-simular').addEventListener('click', simular);

// ---------------------------------------------------------------- Simulación
function datosPiloto(p, circuito) {
    const e = P.equipos[p.equipoId];
    return { id: p.id, equipoId: p.equipoId, attrs: p.attrs, moral: p.moral, forma: p.forma, coche: e.coche, setupQ: e.reglaje, estr: p.estr, riesgoFiab: 1 };
}

function simular() {
    const tipo = $('#l-tipo').value;
    const circuito = normalizarCircuito(CIRCUITOS.find(c => c.id === $('#l-circuito').value));
    const lluvia = $('#l-lluvia').checked;
    const rng = crearRng(`lab|sim|${Math.random()}`);
    const vidas = vidaNeumaticos(`lab${Math.random()}`, 'lab', circuito);
    const n = SESION_INFO[tipo].vueltas;
    const pilotos = P.pilotos.map(p => {
        const x = datosPiloto(p, circuito);
        if (SESION_INFO[tipo].estrategia) {
            const mio = p.equipoId === mioId && miPlan.salida !== 'auto';
            const leidas = Object.fromEntries(Object.entries(vidas).map(([k, v]) => [k, Math.max(2, v + Math.round((Math.random() - 0.5) * 4))]));
            const m = mejorEstrategia(leidas, n, circuito, p.estr.ritmo);
            x.estr = { ...p.estr, ...(mio ? { neumatico: miPlan.salida, paradas: miPlan.parada > 0 ? [{ vuelta: miPlan.parada, neumatico: miPlan.tras }] : [] } : { neumatico: m.neumatico, paradas: m.paradas }) };
        }
        return x;
    });
    let parrilla = null;
    if (esCarrera(tipo)) parrilla = ultimaQualy || crearRng(`lab|parrilla|${Math.random()}`).shuffle(P.pilotos.map(p => p.id));
    const res = simularSesion({ tipo, circuito, pilotos, parrilla, lluvia, rng, vidas });
    res.vidas = vidas;
    if (esQualy(tipo)) { ultimaQualy = res.filas.map(f => f.pid); textoParrilla(); }
    const inicio = Date.now();
    const ses = { publishAt: inicio, revealAt: inicio + duracionDirecto(tipo) };
    $('#l-resultado').innerHTML = '';
    montarDirecto($('#l-directo'), {
        r: res, ses, ev: { id: 'lab', circuito }, d, miEq: mioId, repeticion: true,
        alFinal: () => pintarResultado(res, circuito, lluvia, pilotos),
    });
    $('#l-directo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pintarResultado(res, circuito, lluvia, pilotos) {
    const tipo = res.tipo;
    const carrera = esCarrera(tipo);
    const porId = Object.fromEntries(pilotos.map(p => [p.id, p]));
    const filasRes = res.filas.map(f => `<tr class="${f.eq === mioId ? 'yo' : ''}">
        <td class="cen mono">${f.pos}</td>
        <td>${bandera(d.piloto(f.pid)?.nac, { ancho: 14 })} ${esc(d.nombre(f.pid))}<div class="muted peq"><span class="lb-eq"><i style="background:${esc(P.equipos[f.eq].color)}"></i>${esc(P.equipos[f.eq].nombre)}</span></div></td>
        <td class="der mono">${carrera ? (f.estado === 'DNF' ? `<span class="mal">${esc(f.motivo || 'Abandono')}</span>` : f.pos === 1 ? formatoTiempo(f.tiempo) : formatoTiempo(f.gap, true)) : f.mejor != null ? formatoTiempo(f.mejor) : '<span class="mal">Sin tiempo</span>'}</td>
        ${carrera ? `<td class="cen mono">${f.parrilla ?? ''}</td><td class="cen mono">${f.adel || 0}</td><td class="mono peq">${(f.neumaticos || []).map(k => COMPUESTOS[k].corto).join(' › ')}</td>` : `<td class="cen mono">${f.errores || 0}</td>`}
        <td class="der mono">${f.pts || ''}</td></tr>`).join('');

    // Por qué: ritmo teórico de cada piloto y de dónde sale
    const base = circuito.tiempoBase * (lluvia ? 1.09 : 1);
    const wSum = circuito.motor + circuito.aero + circuito.chasis;
    const desglose = pilotos.map(p => {
        const a = p.attrs, c = p.coche;
        const ms = (x) => x * base;
        const coche = ms(-(((circuito.motor * c.motor) + (circuito.aero * c.aero) + (circuito.chasis * c.chasis)) / wSum / 10) * 0.010);
        const piloto = ms((80 - a.ritmo) * 0.00055 + (lluvia ? (75 - (a.lluvia ?? 70)) * 0.0004 : 0) - ((a.experiencia ?? 50) - 50) * 0.00005);
        const reglaje = ms((1 - p.setupQ) * 0.008 * (lluvia ? 0.5 : 1));
        const animo = ms(-((p.moral - 60) / 40) * 0.0015 - p.forma * 0.001);
        return { p, total: ritmoBase(p, circuito, lluvia), coche, piloto, reglaje, animo };
    }).sort((x, y) => x.total - y.total);
    const mejor = desglose[0].total;
    const barra = (v) => `<span class="lab-delta ${v <= 0 ? 'ok' : 'mal'}">${v <= 0 ? '−' : '+'}${(Math.abs(v) / 1000).toFixed(3)}</span>`;
    const filasDes = desglose.map((x, i) => `<tr class="${x.p.equipoId === mioId ? 'yo' : ''}">
        <td class="cen mono">${i + 1}</td><td>${esc(d.apellido(x.p.id))} <span class="muted peq">${esc(P.equipos[x.p.equipoId].corto)}</span></td>
        <td class="der mono">${formatoTiempo(Math.round(x.total))}</td><td class="der mono muted">${i ? '+' + ((x.total - mejor) / 1000).toFixed(3) : ''}</td>
        <td class="der">${barra(x.coche)}</td><td class="der">${barra(x.piloto)}</td><td class="der">${barra(x.reglaje)}</td><td class="der">${barra(x.animo)}</td>
        ${carrera ? `<td class="peq muted">${esc(x.p.estr.ritmo)} · ${esc(x.p.estr.actitud)}</td>` : `<td class="peq muted">riesgo ${x.p.estr.riesgo}</td>`}
      </tr>`).join('');

    const inc = res.eventos.filter(e => ['abandono', 'toque', 'accidente', 'error', 'sc', 'vsc', 'parada'].includes(e.tipo)).slice(0, 30);
    $('#l-resultado').innerHTML = `
    <div class="tarjeta portada-seccion">
      <div class="tarjeta-titulo"><h2>Resultado · ${esc(SESION_INFO[tipo].nombre)}</h2><span>${esc(circuito.nombre)}${lluvia ? ' · lluvia' : ''}</span></div>
      ${SESION_INFO[tipo].estrategia && !lluvia ? `<p class="muted peq" style="margin-top:0">Vida real de los neumáticos hoy: ${Object.entries(res.vidas).map(([k, v]) => `${COMPUESTOS[k].nombre.toLowerCase()} ${v} vueltas`).join(' · ')}. ${res.eventos.some(e => e.tipo === 'sc') ? 'Hubo coche de seguridad.' : res.eventos.some(e => e.tipo === 'vsc') ? 'Hubo VSC.' : ''}</p>` : ''}
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th class="cen">Pos</th><th>Piloto</th><th class="der">${carrera ? 'Tiempo' : 'Mejor vuelta'}</th>${carrera ? '<th class="cen">Salida</th><th class="cen">Adel.</th><th>Neum.</th>' : '<th class="cen">Errores</th>'}<th class="der">Pts</th></tr></thead><tbody>${filasRes}</tbody></table></div>
    </div>
    <div class="tarjeta portada-seccion">
      <div class="tarjeta-titulo"><h2>Por qué</h2><span>ritmo teórico por vuelta, sin azar</span></div>
      <p class="muted peq" style="margin-top:0">Lo que aporta cada factor al tiempo por vuelta respecto al de referencia (${formatoTiempo(Math.round(base))}). Verde, más rápido; rojo, más lento. Luego el azar (errores, tráfico, salidas, averías) hace el resto.</p>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th class="cen">#</th><th>Piloto</th><th class="der">Ritmo</th><th class="der">Dif.</th><th class="der">Coche</th><th class="der">Piloto</th><th class="der">Reglaje</th><th class="der">Moral y forma</th><th>Estrategia</th></tr></thead><tbody>${filasDes}</tbody></table></div>
    </div>
    ${inc.length ? `<div class="tarjeta portada-seccion"><div class="tarjeta-titulo"><h2>Incidentes</h2></div>
      <ul class="lista">${inc.map(e => `<li>V${e.v} · ${e.tipo === 'sc' ? '<b>Coche de seguridad</b>' : e.tipo === 'vsc' ? '<b>Coche de seguridad virtual</b>' : e.tipo === 'parada' ? `Parada de ${esc(d.apellido(e.pid))}: ${esc(COMPUESTOS[e.neumatico].nombre.toLowerCase())}` : e.tipo === 'abandono' ? `Abandono de ${esc(d.apellido(e.pid))} (${esc((e.motivo || '').toLowerCase())}${e.grave ? ', daños graves' : ''})` : e.tipo === 'toque' ? `Toque ${e.pid2 ? `entre ${esc(d.apellido(e.pid))} y ${esc(d.apellido(e.pid2))}` : `de ${esc(d.apellido(e.pid))} en la salida`}` : e.tipo === 'accidente' ? `Accidente de ${esc(d.apellido(e.pid))}${e.grave ? ' (daños graves)' : ''}` : `Error de ${esc(d.apellido(e.pid))} (${(e.ms / 1000).toFixed(1)} s)`}</li>`).join('')}</ul></div>` : ''}`;
}
void calidadSetup;
