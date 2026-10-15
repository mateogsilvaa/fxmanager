import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { store, encolar, escuchar, ahora } from '../core/app.js';
import { esc, bandera, banderaLiga, vacio, fecha, hace, toast, dinero, $, $$, activarCuentas, confirmar } from '../core/ui.js';
import { celdaPiloto, celdaEquipo } from '../core/componentes.js';
import { avatarPiloto } from '../core/avatar.js';
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL, PAISES } from '../engine/constants.js';
import { calcularRiesgo } from '../engine/stats.js';
import { candidatosGalactico } from '../core/mercado-ui.js';
import { MERCADO, valorPiloto, tacticoDe } from '../engine/mercado.js';
import { novedadesActivas, minimoBlindaje } from '../jobs/novedades.js';

const u = await montar({ activo: 'mercado' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
let [m, docOfertas] = await Promise.all([
    store().get(`mercado/T${d.temporada}`).catch(() => null),
    store().get(`mercado_ofertas/T${d.temporada}`).catch(() => null),
]);
const miEq = u?.perfil?.equipoId;
const estrellas = (n) => `<span class="estrellas" title="${n} de 5">${'★'.repeat(n || 1)}${'☆'.repeat(5 - (n || 1))}</span>`;
const ICONO_MOV = { galactico: '★', puja: '€', fichaje: '→', trueque: '⇄', libre: '+', blindaje: '🔒' };
const pilotosDe = (eq) => Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eq).map(([id, p]) => ({ id, ...p }));

main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Temporada ${d.temporada}</div><h1>Mercado</h1>
<p class="sub">Aquí se decide quién corre dónde la próxima temporada. Abre al empezar el Mundial y cierra 2 días después de que termine. Siempre con al menos un 55% de pilotos locales en cada liga.</p></div>
<a class="btn btn-sec btn-peq" href="reglamento.html#mercado">Reglamento completo</a></div>
<div id="fases"></div>
<details class="mercado-guia" ${m ? '' : 'open'}><summary>Cómo funciona el mercado, en 4 pasos</summary>
<div class="guia-pasos">
  <div class="paso"><b>1</b><h3>Galácticos</h3><p>Cada liga tiene hasta <b>${MERCADO.candidatos} candidatos</b> de su top 5. <b>Solo se va uno</b>: el primero por el que se cierre un acuerdo o, al cierre, el que decida la liga. Los demás se quedan.</p></div>
  <div class="paso"><b>2</b><h3>Pujas</h3><p>Las ${MERCADO.topComprador} mejores escuderías de cada liga (humanos e IA) pujan por candidatos de <b>otras</b> ligas. Quien lo vende cobra la oferta y recibe al segundo piloto del comprador.</p></div>
  <div class="paso"><b>3</b><h3>Vacantes</h3><p>Despidos y retiradas dejan asientos libres. Se cubren fichando un <b>agente libre</b> (precio fijo, al momento), comprando a un piloto de otra escudería o con un <b>rookie</b> del draft al cerrar.</p></div>
  <div class="paso"><b>4</b><h3>Trueques</h3><p>Si tu alineación no se mueve, pide una <b>ficha de fichaje</b> y cambia piloto por piloto con otra escudería que también la tenga.</p></div>
</div></details>
<div id="cuerpo"></div>`;
const cuerpo = $('#cuerpo');
const pintar = () => { pintarFases(); if (m) mercadoReal(); else temporadaEnCurso(); activarCuentas(); };
pintar();
// El mercado cambia en directo mientras está abierto
if (m && m.estado !== 'cerrado') escuchar(`mercado/T${d.temporada}`, (nuevo) => { if (nuevo && JSON.stringify(nuevo) !== JSON.stringify(m)) { m = nuevo; limpiarCache(); pintar(); } });

// Envía una acción y avisa cuando el servidor la procese
async function lanzar(tipo, params, msg) {
    try {
        const id = await encolar(tipo, params);
        toast('Enviado. Se procesa en unos segundos…', 'info');
        const parar = escuchar(`acciones/${id}`, (a) => {
            if (!a || a.estado === 'pendiente') return;
            parar?.();
            if (a.estado === 'error') toast(a.resultado?.error || 'No se pudo hacer.', 'error');
            else if (a.resultado?.estado === 'rechazada') toast(a.resultado.motivo || 'Han dicho que no.', 'error');
            else toast(msg || 'Hecho');
        });
    } catch (e) { toast(e.message, 'error'); }
}

// ---------------------------------------------------------------- En qué punto estamos
function pintarFases() {
    const abierto = m && m.estado !== 'cerrado';
    const idx = !m ? (d.cfg.fase === 'mundial' ? 1 : 0) : abierto ? 1 : 2;
    const pasos = [['Temporada', 'Se forman los candidatos'], ['Mercado abierto', m?.deadline && abierto ? `Cierra en <b data-cuenta="${m.deadline}"></b>` : 'Con el Mundial'], ['Cerrado', 'Se aplican los cambios'], ['Nueva temporada', 'Parrillas nuevas']];
    $('#fases').innerHTML = `<ol class="fases">${pasos.map(([t, s], i) => `<li class="${i < idx ? 'hecho' : i === idx ? 'ahora' : ''}"><i>${i + 1}</i><b>${t}</b><span>${s}</span></li>`).join('')}</ol>
      ${abierto && d.cfg.fase === 'mundial' ? '<div class="info-caja" style="margin-bottom:24px">El Mundial se está jugando: lo que se cierre ahora se aplica en cuanto termine, para que nadie cambie de equipo a mitad de competición.</div>' : ''}`;
}

// ---------------------------------------------------------------- Galácticos por liga
function candidatoHtml(c, { real }) {
    const p = d.piloto(c.pid), eq = d.equipo(c.eq);
    const ofs = real ? (m.ofertas || []).filter(o => o.pid === c.pid && o.estado === 'pendiente') : [];
    const mejor = Math.max(0, ...ofs.map(o => o.importe));
    const estado = !real ? 'pendiente' : c.estado;
    const via = { aceptada: 'oferta aceptada', oferta: 'la liga elige la mejor oferta', solicitud: 'solicitud a la liga', ia: 'decide la liga', suerte: '¡por sorpresa!' };
    const pie = !real ? `<span class="muted">${c.pts} puntos</span>`
        : estado === 'vendido' ? `<span class="gal-sale">Se va a ${celdaEquipo(d, c.destino.eq)} · ${dinero(c.destino.importe)} · ${via[c.destino.via] || ''}</span>`
        : estado === 'blindado' ? '<span class="muted">Se queda: blindado por su escudería</span>'
        : estado === 'se_queda' ? `<span class="muted">Se queda${c.motivo ? ` (${esc(c.motivo)})` : ''}</span>`
        : ofs.length ? `<span>Mejor oferta <b>${dinero(mejor)}</b> · ${ofs.length} puja${ofs.length > 1 ? 's' : ''}</span>` : '<span class="muted">Sin pujas todavía</span>';
    return `<div class="gal-cand ${estado}">
      <span class="gal-av">${avatarPiloto(c.pid, eq?.color, 46)}</span>
      <div class="gal-info"><div class="gal-nom">${p ? `<a href="piloto.html?id=${esc(c.pid)}">${bandera(p.nac, { ancho: 16 })} ${esc(p.nombre)} <b>${esc(p.apellido)}</b></a>` : esc(c.nombre || '')} <span class="gal-pos">${c.pos}º</span></div>
        <div class="peq">${celdaEquipo(d, c.eq)}</div>
        <div class="peq gal-pie">${pie}</div></div>
      ${real && estado === 'pendiente' && c.decision === 'liga' ? '<span class="insignia">Decide la liga</span>' : ''}</div>`;
}
function galacticosHtml(porLiga, { real }) {
    return `<div class="gal-ligas">${LIGAS_NACIONALES.map(l => {
        const lista = porLiga[l] || [];
        const vendido = lista.find(c => c.estado === 'vendido');
        const cab = !real ? 'Si la temporada acabara hoy' : vendido ? `Sale ${esc(vendido.nombre || d.nombre(vendido.pid))}` : lista.some(c => c.estado === 'pendiente') ? 'En juego · solo sale uno' : 'Nadie cambia de liga';
        return `<section class="gal-liga ${vendido ? 'resuelta' : ''}"><header>${banderaLiga(l, { ancho: 20 })}<h3>${esc(LIGAS[l].nombre)}</h3><span>${cab}</span></header>
          ${lista.length ? lista.map(c => candidatoHtml(c, { real })).join('') : '<p class="muted peq" style="margin:8px 0 0">Sin candidatos.</p>'}</section>`;
    }).join('')}</div>`;
}

// ---------------------------------------------------------------- Agentes libres
function libresHtml({ puedeFichar }) {
    const libres = Object.entries(d.cat.pilotos).filter(([, p]) => !p.equipoId && p.estado === 'libre' && p.valoracion != null).map(([id, p]) => ({ id, ...p }));
    if (!libres.length) return '';
    const nacs = [...new Set(libres.map(p => p.nac))].sort((a, b) => (PAISES[a] || a).localeCompare(PAISES[b] || b));
    return `<section class="tarjeta" id="libres"><div class="tarjeta-titulo"><h2>Agentes libres</h2><span>${libres.length} pilotos</span></div>
      <p class="muted">Pilotos sin equipo: despedidos, veteranos y jóvenes que buscan su oportunidad. ${puedeFichar ? '<b>Tienes una vacante:</b> puedes fichar a cualquiera al momento pagando su precio.' : 'Se pueden fichar para cubrir una vacante en el mercado o como sustitutos cuando un piloto se lesiona.'} Las estrellas son una estimación pública de su nivel.</p>
      <div class="libres-filtros"><label>Nacionalidad<select id="lf-nac"><option value="">Todas</option>${LIGAS_NACIONALES.map(l => `<option value="${NAC_LOCAL[l]}">${esc(PAISES[NAC_LOCAL[l]])} (locales ${esc(LIGAS[l].nombre)})</option>`).join('')}<option value="ext">Otros países</option>${nacs.filter(n => !Object.values(NAC_LOCAL).includes(n)).map(n => `<option value="${n}">${esc(PAISES[n] || n)}</option>`).join('')}</select></label>
        <label>Mínimo<select id="lf-est"><option value="0">Cualquier nivel</option>${[2, 3, 4].map(n => `<option value="${n}">${n}★ o más</option>`).join('')}</select></label>
        <label>Ordenar<select id="lf-orden"><option value="val">Mejor valorados</option><option value="precio">Más baratos</option><option value="joven">Más jóvenes</option></select></label></div>
      <div class="libres-grid" id="lf-lista"></div>
      <div class="fila-botones"><button class="btn btn-sec btn-peq" id="lf-mas" hidden>Ver más</button></div></section>`;
}
function activarLibres(el, { puedeFichar }) {
    const caja = $('#lf-lista', el);
    if (!caja) return;
    let limite = 24;
    const locales = new Set(Object.values(NAC_LOCAL));
    const todos = Object.entries(d.cat.pilotos).filter(([, p]) => !p.equipoId && p.estado === 'libre' && p.valoracion != null).map(([id, p]) => ({ id, ...p }));
    const repintar = () => {
        const nac = $('#lf-nac', el).value, min = +$('#lf-est', el).value, orden = $('#lf-orden', el).value;
        const lista = todos.filter(p => (!nac || (nac === 'ext' ? !locales.has(p.nac) : p.nac === nac)) && (p.valoracion || 0) >= min)
            .sort(orden === 'precio' ? (a, b) => a.precio - b.precio : orden === 'joven' ? (a, b) => (a.edad || 0) - (b.edad || 0) : (a, b) => b.valoracion - a.valoracion || a.precio - b.precio);
        caja.innerHTML = lista.slice(0, limite).map(p => `<div class="libre">
            <span class="libre-av">${avatarPiloto(p.id, null, 52)}</span>
            <div class="libre-info"><a href="piloto.html?id=${esc(p.id)}">${bandera(p.nac, { ancho: 16 })} ${esc(p.nombre)} <b>${esc(p.apellido)}</b></a>
              <div class="peq muted">${p.edad ?? '?'} años · ${esc(PAISES[p.nac] || p.nac)}</div>
              <div class="peq">${estrellas(p.valoracion)} <b class="libre-precio">${dinero(p.precio)}</b></div></div>
            ${puedeFichar ? `<button class="btn btn-peq" data-libre="${esc(p.id)}">Fichar</button>` : ''}</div>`).join('') || vacio('Nadie con esos filtros.');
        $('#lf-mas', el).hidden = lista.length <= limite;
        $$('[data-libre]', caja).forEach(b => b.addEventListener('click', async () => {
            const p = todos.find(x => x.id === b.dataset.libre);
            if (!await confirmar(`¿Fichar a <b>${esc(p.nombre)} ${esc(p.apellido)}</b> por <b>${dinero(p.precio)}</b>? Ocupará tu vacante.`)) return;
            lanzar('mercado_libre', { pid: p.id }, `¡${p.apellido} ficha por tu escudería!`);
        }));
    };
    ['#lf-nac', '#lf-est', '#lf-orden'].forEach(s => $(s, el).addEventListener('change', () => { limite = 24; repintar(); }));
    $('#lf-mas', el).addEventListener('click', () => { limite += 24; repintar(); });
    repintar();
}

// ---------------------------------------------------------------- Durante la temporada
function temporadaEnCurso() {
    const ofertas = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o })).sort((a, b) => b.importe - a.importe);
    const proy = d.clasificadosMundial();
    const inmunes = new Set(proy.clasificados?.map(c => c.pid) || []);
    const porLiga = Object.fromEntries(LIGAS_NACIONALES.map(l => [l, candidatosGalactico(d, l).slice(0, MERCADO.candidatos)]));
    const riesgo = LIGAS_NACIONALES.flatMap(l => d.sesionesLiga(l).length
        ? calcularRiesgo(d.tabla(l), d.pilotosLiga(l), { inmunes }).filter(x => x.zona === 'despido' || x.zona === 'peligro').map(x => ({ ...x, liga: l })) : []);
    cuerpo.innerHTML = `
    <section style="margin-bottom:36px"><div class="tarjeta-titulo"><h2>Candidatos a Galáctico</h2><span>si la temporada acabara hoy</span></div>
      <p class="muted">De cada liga saldrán como mucho ${MERCADO.candidatos} candidatos de su top 5, pero <b>solo uno cambiará de liga</b>. Solo puede ser candidato quien tiene un compañero local, para que su escudería conserve a su Piloto 1. Las pujas hechas durante la temporada dan prioridad a ese piloto.</p>
      ${galacticosHtml(porLiga, { real: false })}</section>
    <div class="rejilla rejilla-lado" style="margin-bottom:36px">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>En riesgo de despido</h2><span>contra su compañero</span></div>
        <p class="muted peq">Se compara a cada piloto con su compañero: quien rinde mucho peor con el mismo coche pierde el asiento al abrir el mercado. Los clasificados al Mundial están a salvo.</p>
        ${riesgo.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Piloto</th><th class="der">Pos</th><th class="der">Compañero</th><th>Situación</th></tr></thead><tbody>
        ${riesgo.map(x => `<tr><td>${banderaLiga(x.liga)}</td><td>${celdaPiloto(d, x.pid)}</td><td class="der">${x.pos}º</td><td class="der">${x.posComp ?? '—'}º</td><td><span class="insignia ${x.zona}">${x.zona === 'despido' ? 'Despido' : x.caeria ? 'Peligro · caería' : 'Peligro · se salva'}</span></td></tr>`).join('')}
        </tbody></table></div>` : vacio('Aún sin carreras.')}
      </section>
      <aside class="tarjeta"><div class="tarjeta-titulo"><h2>Pujas adelantadas</h2><span>${ofertas.length}</span></div>
        ${ofertas.length ? ofertas.map(o => `<div class="declaracion"><div class="meta">${esc(d.nombreEquipo(o.eq))} · ${fecha(o.fecha)}</div>
          <p>Quiere a <b>${esc(d.nombre(o.pid))}</b> ${banderaLiga(d.piloto(o.pid)?.liga, { ancho: 14 })} y ofrece <b>${dinero(o.importe)}</b>.</p></div>`).join('') : vacio('Ninguna escudería ha pujado todavía.')}
        <p class="muted peq" style="margin:12px 0 0">Las ${MERCADO.topComprador} mejores escuderías de cada liga pueden pujar desde Mi escudería. Si al final ese piloto es candidato, la puja cuenta.</p>
      </aside>
    </div>
    ${libresHtml({ puedeFichar: false })}`;
    activarLibres(cuerpo, { puedeFichar: false });
}

// ---------------------------------------------------------------- Mercado (abierto o cerrado)
function mercadoReal() {
    const abierto = m.estado !== 'cerrado' && m.deadline > ahora() - 60_000;
    const G = m.galacticos || [];
    const porLiga = Object.fromEntries(LIGAS_NACIONALES.map(l => [l, G.filter(g => g.liga === l).sort((a, b) => a.pos - b.pos)]));
    const vacante = miEq && pilotosDe(miEq).length < 2;
    const retiros = m.plan?.retiros || [];
    cuerpo.innerHTML = `
    ${!abierto ? '<div class="info-caja" style="margin-bottom:30px">Mercado cerrado. Así quedan las parrillas para la próxima temporada.</div>' : ''}
    ${abierto && miEq ? '<div id="mi-mercado"></div>' : ''}
    <section style="margin-bottom:36px"><div class="tarjeta-titulo"><h2>Galácticos</h2><span>${G.filter(g => g.estado === 'vendido').length} de ${LIGAS_NACIONALES.length} ligas resueltas</span></div>
      <p class="muted">Hasta ${MERCADO.candidatos} candidatos por liga; <b>solo sale uno</b>. En cuanto se cierra un traspaso, los demás candidatos de esa liga se quedan. Lo que siga pendiente lo decide la liga al cerrar: primero las ofertas, luego las solicitudes y luego la IA.</p>
      ${G.length ? galacticosHtml(porLiga, { real: true }) : vacio('Sin Galácticos esta temporada.')}</section>
    <div class="rejilla rejilla-lado" style="margin-bottom:36px">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Movimientos</h2><span>${(m.movimientos || []).length}</span></div>
        ${(m.movimientos || []).length ? `<ul class="mov-lista">${m.movimientos.slice(0, 60).map(x => `<li class="mov ${esc(x.tipo || '')}"><i>${ICONO_MOV[x.tipo] || '·'}</i><div>${esc(x.texto)}<div class="muted peq">${hace(x.t)}</div></div></li>`).join('')}</ul>` : vacio('Todavía no se ha cerrado ninguna operación.')}
      </section>
      <aside class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Vacantes</h2><span>${m.plan.despidos.length + retiros.length}</span></div>
          ${m.plan.despidos.map(x => `<div class="declaracion"><div class="meta"><span class="con-bandera">${banderaLiga(x.liga, { ancho: 12 })}<span class="txt">${esc(d.nombreEquipo(x.eq))} · ${x.motivo === 'directo' ? 'despido' : 'despido (zona de peligro)'}</span></span></div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º con su compañero ${x.posComp}º.</p></div>`).join('')}
          ${retiros.map(x => `<div class="declaracion"><div class="meta"><span class="con-bandera">${banderaLiga(x.liga, { ancho: 12 })}<span class="txt">${esc(d.nombreEquipo(x.eq))} · retirada</span></span></div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b> cuelga el casco con ${x.edad} años.</p></div>`).join('')}
          ${!m.plan.despidos.length && !retiros.length ? vacio('Sin vacantes.') : ''}
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Salvan el asiento</h2><span>${m.plan.salvados?.length || 0}</span></div>
          ${(m.plan.salvados || []).map(x => `<div class="declaracion"><div class="meta"><span class="con-bandera">${banderaLiga(x.liga, { ancho: 12 })}<span class="txt">${esc(d.nombreEquipo(x.eq))}</span></span></div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º, pero su compañero acabó ${x.posComp}º. El coche no daba para más.</p></div>`).join('') || vacio('Nadie.')}
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Con ficha de fichaje</h2><span>${Object.keys(m.fichas || {}).length}</span></div>
          ${Object.keys(m.fichas || {}).length ? `<ul class="lista">${Object.keys(m.fichas).map(eq => `<li><span class="con-bandera">${banderaLiga(d.equipo(eq)?.liga, { ancho: 16 })}${celdaEquipo(d, eq)}</span></li>`).join('')}</ul>` : vacio('Nadie todavía.')}
          <p class="muted peq" style="margin:10px 0 0">Pueden hacer trueques de pilotos entre ellas.</p>
        </section>
      </aside>
    </div>
    ${m.elegidos?.length ? `<section class="tarjeta" style="margin-bottom:36px"><div class="tarjeta-titulo"><h2>Vacantes cubiertas al cierre</h2><span>${m.elegidos.length}</span></div>
      <div class="tabla-scroll"><table class="tabla"><tbody>${m.elegidos.map(x => { const pid = x.rookie || x.libre; return `<tr><td>${celdaEquipo(d, x.eq)}</td><td>${d.piloto(pid) ? celdaPiloto(d, pid) : esc(x.nombre)}</td><td><span class="insignia ${x.rookie ? 'rookie' : ''}">${x.rookie ? 'Rookie' : 'Agente libre'}</span></td></tr>`; }).join('')}</tbody></table></div></section>` : ''}
    ${libresHtml({ puedeFichar: abierto && vacante })}`;
    if (abierto && miEq) miMercado($('#mi-mercado'));
    activarLibres(cuerpo, { puedeFichar: abierto && vacante });
}

// ---------------------------------------------------------------- Lo que puede hacer mi escudería
function miMercado(el) {
    const eq = d.equipo(miEq);
    const liga = eq?.liga;
    const suyos = pilotosDe(miEq);
    const posEq = m.posiciones?.equipos?.[miEq];
    const posPil = m.posiciones?.pilotos || {};
    const miG = (m.galacticos || []).find(g => g.eq === miEq && g.estado === 'pendiente');
    const vacante = suyos.length < 2;
    const esTop = (posEq || 99) <= MERCADO.topComprador;
    const yaG = (m.galacticos || []).some(g => g.destino?.eq === miEq);
    const ficha = !!m.fichas?.[miEq];
    const recibidasF = (m.fichajes || []).filter(f => f.estado === 'pendiente' && suyos.some(p => p.id === f.pid));
    const recibidasT = (m.trueques || []).filter(t => t.estado === 'pendiente' && t.conEq === miEq);
    const bloques = [];
    const estadoTxt = (e) => ({ pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada', anulada: 'Anulada', caducada: 'Caducada' }[e] || e);
    const resumen = [
        miG && ['aviso', `Tu piloto ${esc(miG.nombre)} es candidato a Galáctico`],
        vacante && ['aviso', 'Tienes una vacante que cubrir'],
        esTop && !yaG && ['ok', `Puedes fichar un Galáctico (${posEq}º de tu liga)`],
        yaG && ['ok', 'Ya has fichado tu Galáctico'],
        recibidasF.length && ['aviso', `${recibidasF.length} oferta${recibidasF.length > 1 ? 's' : ''} por tus pilotos`],
        recibidasT.length && ['aviso', `${recibidasT.length} trueque${recibidasT.length > 1 ? 's' : ''} propuesto${recibidasT.length > 1 ? 's' : ''}`],
        ficha && ['ok', 'Tienes ficha de fichaje'],
    ].filter(Boolean);

    // 1. Mi candidato a Galáctico
    if (miG) {
        const ofs = (m.ofertas || []).filter(o => o.pid === miG.pid && o.estado === 'pendiente').sort((a, b) => b.importe - a.importe);
        const otros = (m.galacticos || []).filter(g => g.liga === miG.liga && g !== miG && g.estado === 'pendiente').map(g => g.nombre);
        bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Tu candidato: ${esc(miG.nombre)}</h2><span>${ofs.length} oferta${ofs.length === 1 ? '' : 's'}</span></div>
          <p class="muted">Es uno de los candidatos a Galáctico de ${esc(LIGAS[miG.liga].nombre)}${otros.length ? ` junto a ${otros.map(esc).join(' y ')}` : ''}. <b>Solo se va uno</b>: si se cierra antes el traspaso de otro, el tuyo se queda. Puedes aceptar una oferta (cobras lo que ofrecen y recibes a su segundo piloto) o dejar que decida la liga al cerrar (cobras ${dinero(MERCADO.compensacionLiga)} si te toca).</p>
          ${ofs.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Escudería</th><th>Te llega</th><th class="der">Oferta</th><th></th></tr></thead><tbody>
          ${ofs.map(o => { const t = tacticoDe(Object.entries(d.cat.pilotos).map(([id, p]) => ({ id, ...p })).filter(p => !(m.galacticos || []).some(g => g.pid === p.id && g.estado === 'pendiente')), o.eq, d.equipo(o.eq)?.liga); return `<tr><td><span class="con-bandera">${banderaLiga(d.equipo(o.eq)?.liga, { ancho: 16 })}${celdaEquipo(d, o.eq)}</span>${o.ia ? ' <span class="insignia">IA</span>' : ''}</td><td>${t ? celdaPiloto(d, t.id) : '<span class="muted">Nadie</span>'}</td><td class="pts">${dinero(o.importe)}</td><td class="der"><button class="btn btn-peq" data-aceptar="${esc(o.id)}">Aceptar</button></td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted">Todavía nadie ha pujado. Las ofertas llegan de las 3 mejores escuderías de las otras ligas.</p>'}
          ${novedadesActivas(d.cfg) ? `<div class="info-caja" style="margin:12px 0"><b>Blindarlo.</b> Si pagas al menos <b>${dinero(minimoBlindaje(ofs))}</b> (1,5 veces la puja más alta, o 2 M€ si nadie ha pujado), se queda en tu escudería. La cifra no se publica.
            <div class="fila" style="margin-top:8px"><input type="number" id="blindaje" min="${minimoBlindaje(ofs)}" step="100000" value="${minimoBlindaje(ofs)}" style="max-width:180px"><button class="btn btn-sec btn-peq" id="b-blindar">Blindar</button></div></div>` : ''}
          <div class="fila-botones">${miG.decision === 'liga' ? '<span class="muted peq">Has dejado que decida la liga.</span><button class="btn btn-sec btn-peq" data-liga="0">Me lo pienso</button>' : '<button class="btn btn-sec" data-liga="1">Que decida la liga</button>'}</div></section>`);
    }

    // 2. Vacante: tres formas de cubrirla
    if (vacante) {
        const mias = (m.fichajes || []).filter(f => f.eq === miEq);
        const bloqueados = new Set((m.galacticos || []).filter(g => g.estado === 'pendiente').map(g => g.pid));
        const opciones = LIGAS_NACIONALES.map(l => {
            const ps = Object.entries(d.cat.pilotos).filter(([id, p]) => p.liga === l && p.equipoId && p.equipoId !== miEq && !bloqueados.has(id))
                .sort((a, b) => (posPil[a[0]] || 20) - (posPil[b[0]] || 20));
            return `<optgroup label="${esc(LIGAS[l].nombre)}">${ps.map(([id, p]) => `<option value="${esc(id)}" data-valor="${valorPiloto(posPil[id])}">${esc(p.nombre)} ${esc(p.apellido)} (${p.nac.toUpperCase()}) · ${esc(d.nombreEquipo(p.equipoId))} · ${posPil[id] ? `${posPil[id]}º` : '—'}</option>`).join('')}</optgroup>`;
        }).join('');
        const companero = suyos[0];
        const debeLocal = !companero || companero.nac !== NAC_LOCAL[liga];
        bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Tienes una vacante</h2></div>
          ${debeLocal ? `<div class="aviso-caja" style="margin-bottom:12px">Necesitas un piloto ${esc(LIGAS[liga].gentilicio)} para el asiento de Piloto 1.</div>` : ''}
          <div class="vias">
            <div class="via"><b>A · Agente libre</b><p>Precio fijo, se cierra al momento. <a href="#libres">Ver la lista ↓</a></p></div>
            <div class="via"><b>B · Piloto de otra escudería</b><p>Haces una oferta. La IA acepta si pagas lo que vale; un mánager decide él.</p></div>
            <div class="via"><b>C · Rookie del draft</b><p>Gratis, al cerrar el mercado. Ordena tus favoritos abajo.</p></div>
          </div>
          <h3>B · Oferta por un piloto</h3>
          <form id="f-fichaje" class="campo-fila"><label>Piloto<select name="pid">${opciones}</select></label><label>Oferta (€)<input name="importe" type="number" min="${MERCADO.fichajeMinimo}" step="50000" value="1000000"></label></form>
          <p class="muted peq" id="valor-pil"></p>
          <div class="fila-botones"><button class="btn" id="b-fichaje">Enviar oferta</button></div>
          ${mias.length ? `<ul class="lista">${mias.slice().reverse().map(f => `<li class="fila-entre"><span>${esc(f.nombre)} · ${dinero(f.importe)} <span class="insignia">${estadoTxt(f.estado)}</span>${f.motivo ? ` <span class="muted peq">${esc(f.motivo)}</span>` : ''}</span>${f.estado === 'pendiente' ? `<button class="btn btn-sec btn-peq" data-cancelar-f="${esc(f.id)}">Retirar</button>` : ''}</li>`).join('')}</ul>` : ''}
          ${draftUI(liga, debeLocal)}</section>`);
    }

    // 3. Ofertas recibidas por mis pilotos
    if (recibidasF.length) bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Quieren a tus pilotos</h2></div>
      <p class="muted">Si vendes, tendrás una vacante que cubrir (con un agente libre, fichando o con un rookie).</p>
      <ul class="lista">${recibidasF.map(f => `<li class="fila-entre"><span>${celdaEquipo(d, f.eq)} ofrece <b>${dinero(f.importe)}</b> por ${esc(f.nombre)}</span><span class="fila"><button class="btn btn-peq" data-resp-f="${esc(f.id)}" data-acepta="1">Vender</button><button class="btn btn-sec btn-peq" data-resp-f="${esc(f.id)}" data-acepta="0">No</button></span></li>`).join('')}</ul></section>`);

    // 4. Fichar un Galáctico (top 3)
    if (esTop && !yaG) {
        const disp = (m.galacticos || []).filter(g => g.estado === 'pendiente' && g.liga !== liga);
        const mias = (m.ofertas || []).filter(o => o.eq === miEq);
        const sol = m.solicitudes?.[miEq];
        const t = tacticoDe(suyos.filter(p => !(m.galacticos || []).some(g => g.pid === p.id && g.estado === 'pendiente')), miEq, liga);
        bloques.push(`<section class="tarjeta"><div class="tarjeta-titulo"><h2>Ficha un Galáctico</h2><span>${posEq}º de tu liga</span></div>
          <p class="muted">Puedes pujar por cualquier candidato de otra liga. A cambio se va tu segundo piloto${t ? `: <b>${esc(t.nombre)} ${esc(t.apellido)}</b>` : ''}. Ojo: si otro candidato de esa liga se va antes, tu puja por este se anula sin coste.</p>
          ${disp.length ? `<form id="f-galactico" class="campo-fila"><label>Candidato<select name="pid">${LIGAS_NACIONALES.filter(l => disp.some(g => g.liga === l)).map(l => `<optgroup label="${esc(LIGAS[l].nombre)}">${disp.filter(g => g.liga === l).map(g => { const mx = Math.max(0, ...(m.ofertas || []).filter(o => o.pid === g.pid && o.estado === 'pendiente').map(o => o.importe)); return `<option value="${esc(g.pid)}">${esc(g.nombre)} (${g.pos}º)${mx ? ` · mejor puja ${dinero(mx)}` : ''}</option>`; }).join('')}</optgroup>`).join('')}</select></label><label>Oferta (€)<input name="importe" type="number" min="${MERCADO.importeMinimo}" step="100000" value="${MERCADO.importeMinimo * 2}"></label></form>
          <div class="fila-botones"><button class="btn" id="b-galactico">Hacer oferta</button></div>` : '<p class="muted">No quedan candidatos de otras ligas en el mercado.</p>'}
          ${mias.length ? `<ul class="lista">${mias.slice().reverse().map(o => `<li class="fila-entre"><span>${esc(d.nombre(o.pid))} · ${dinero(o.importe)} <span class="insignia">${estadoTxt(o.estado)}</span></span>${o.estado === 'pendiente' ? `<button class="btn btn-sec btn-peq" data-cancelar-o="${esc(o.id)}">Retirar</button>` : ''}</li>`).join('')}</ul>` : ''}
          <h3 style="margin-top:18px">Solicitud de traspaso a la liga</h3>
          <p class="muted peq">Dices cuánto pagarías por el candidato que te asigne la liga al cerrar. Si te toca uno, se te cobra esa cantidad y das a tu segundo piloto.</p>
          <form id="f-solicitud" class="campo-fila"><label>Pagaría hasta (€)<input name="importe" type="number" min="${MERCADO.importeMinimo}" step="100000" value="${sol?.importe || MERCADO.importeMinimo * 2}"></label></form>
          <div class="fila-botones">${sol ? `<span class="muted peq">Solicitud enviada: ${dinero(sol.importe)}</span><button class="btn btn-sec btn-peq" id="b-sol-cancelar">Retirar</button>` : ''}<button class="btn btn-sec" id="b-solicitud">${sol ? 'Actualizar' : 'Enviar solicitud'}</button></div></section>`);
    }

    // 5. Ficha de fichaje y trueques
    const conFicha = Object.keys(m.fichas || {}).filter(x => x !== miEq);
    const misT = (m.trueques || []).filter(t => t.eq === miEq);
    if (!miG && !vacante) {
        bloques.push(`<section class="tarjeta"><div class="tarjeta-titulo"><h2>Ficha de fichaje</h2>${ficha ? '<span>la tienes</span>' : ''}</div>
          ${!ficha ? `<p class="muted">Si quieres cambiar un piloto, pide una ficha a la liga. Con ella puedes proponer un trueque a otra escudería que también la tenga.</p><div class="fila-botones"><button class="btn btn-sec" id="b-ficha">Pedir ficha</button></div>`
            : conFicha.length ? `<p class="muted">Propón un cambio de piloto por piloto. La IA acepta si no sale perdiendo.</p>
              <form id="f-trueque" class="campo-fila"><label>Das<select name="da">${suyos.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)} ${esc(p.apellido)} (${p.nac.toUpperCase()})</option>`).join('')}</select></label>
              <label>Recibes<select name="recibe">${conFicha.map(x => `<optgroup label="${esc(d.nombreEquipo(x))}">${pilotosDe(x).map(p => `<option value="${esc(p.id)}" data-eq="${esc(x)}">${esc(p.nombre)} ${esc(p.apellido)} (${p.nac.toUpperCase()}) · ${posPil[p.id] ? `${posPil[p.id]}º` : '—'}</option>`).join('')}</optgroup>`).join('')}</select></label></form>
              <div class="fila-botones"><button class="btn" id="b-trueque">Proponer trueque</button></div>` : '<p class="muted">Tienes ficha. Aún no hay otras escuderías con ficha para hacer un trueque.</p>'}
          ${misT.length ? `<ul class="lista">${misT.slice().reverse().map(t => `<li>${esc(t.nombreDa)} ↔ ${esc(t.nombreRecibe)} (${esc(d.nombreEquipo(t.conEq))}) <span class="insignia">${estadoTxt(t.estado)}</span>${t.motivo ? ` <span class="muted peq">${esc(t.motivo)}</span>` : ''}</li>`).join('')}</ul>` : ''}</section>`);
    }
    if (recibidasT.length) bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Te proponen un trueque</h2></div>
      <ul class="lista">${recibidasT.map(t => `<li class="fila-entre"><span>${celdaEquipo(d, t.eq)}: te da a <b>${esc(t.nombreDa)}</b> por <b>${esc(t.nombreRecibe)}</b></span><span class="fila"><button class="btn btn-peq" data-resp-t="${esc(t.id)}" data-acepta="1">Aceptar</button><button class="btn btn-sec btn-peq" data-resp-t="${esc(t.id)}" data-acepta="0">No</button></span></li>`).join('')}</ul></section>`);

    el.innerHTML = `<section class="mi-mercado"><div class="tarjeta-titulo"><h2>Tu mercado · ${esc(eq?.nombre || '')}</h2></div>
      <div class="mi-resumen">${resumen.length ? resumen.map(([c, t]) => `<span class="chip-estado ${c}">${t}</span>`).join('') : '<span class="chip-estado">Sin movimientos previstos para tu escudería</span>'}</div>
      ${bloques.length ? `<div class="pila">${bloques.join('')}</div>` : ''}</section>`;

    // Eventos
    $$('[data-aceptar]', el).forEach(b => b.addEventListener('click', async () => { if (await confirmar('¿Aceptar esta oferta? Tu piloto se va ya y los demás candidatos de tu liga se quedan.')) lanzar('mercado_aceptar', { ofertaId: b.dataset.aceptar }, '¡Traspaso cerrado!'); }));
    $('#b-blindar', el)?.addEventListener('click', async () => {
        const v = +$('#blindaje', el).value;
        if (!await confirmar(`¿Pagar <b>${dinero(v)}</b> para que ${esc(miG.nombre)} se quede?`)) return;
        lanzar('galactico_blindar', { importe: v }, '¡Blindado!');
    });
    $$('[data-liga]', el).forEach(b => b.addEventListener('click', () => lanzar('mercado_liga', { liga: b.dataset.liga === '1' }, b.dataset.liga === '1' ? 'Decidirá la liga' : 'Vuelves a decidir tú')));
    const fF = $('#f-fichaje', el);
    if (fF) {
        const valor = () => { const o = fF.pid.selectedOptions[0]; $('#valor-pil', el).textContent = o ? `Valor aproximado: ${dinero(+o.dataset.valor)}. La IA no vende por menos.` : ''; };
        fF.pid.addEventListener('change', valor); valor();
        $('#b-fichaje', el).addEventListener('click', () => lanzar('mercado_fichaje', { pid: fF.pid.value, importe: +fF.importe.value }, 'Oferta enviada'));
    }
    $$('[data-cancelar-f]', el).forEach(b => b.addEventListener('click', () => lanzar('mercado_fichaje', { cancelar: b.dataset.cancelarF }, 'Oferta retirada')));
    $$('[data-resp-f]', el).forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.acepta === '1' && !await confirmar('¿Vender a este piloto? Tendrás una vacante que cubrir.')) return;
        lanzar('mercado_fichaje_responder', { id: b.dataset.respF, acepta: b.dataset.acepta === '1' }, b.dataset.acepta === '1' ? 'Venta cerrada' : 'Oferta rechazada');
    }));
    const fG = $('#f-galactico', el);
    if (fG) $('#b-galactico', el).addEventListener('click', () => lanzar('mercado_galactico', { pid: fG.pid.value, importe: +fG.importe.value }, 'Oferta enviada'));
    $$('[data-cancelar-o]', el).forEach(b => b.addEventListener('click', () => lanzar('mercado_galactico', { cancelar: b.dataset.cancelarO }, 'Oferta retirada')));
    const fS = $('#f-solicitud', el);
    if (fS) $('#b-solicitud', el).addEventListener('click', () => lanzar('mercado_solicitud', { importe: +fS.importe.value }, 'Solicitud enviada'));
    $('#b-sol-cancelar', el)?.addEventListener('click', () => lanzar('mercado_solicitud', { cancelar: true }, 'Solicitud retirada'));
    $('#b-ficha', el)?.addEventListener('click', () => lanzar('mercado_ficha', {}, 'Tienes ficha de fichaje'));
    const fT = $('#f-trueque', el);
    if (fT) $('#b-trueque', el).addEventListener('click', () => lanzar('mercado_trueque', { conEq: fT.recibe.selectedOptions[0].dataset.eq, da: fT.da.value, recibe: fT.recibe.value }, '¡Trueque cerrado!'));
    $$('[data-resp-t]', el).forEach(b => b.addEventListener('click', () => lanzar('mercado_trueque_responder', { id: b.dataset.respT, acepta: b.dataset.acepta === '1' }, b.dataset.acepta === '1' ? 'Trueque cerrado' : 'Trueque rechazado')));
    $('#guardar-draft', el)?.addEventListener('click', async () => {
        const lista = $$('[data-pref]', el).map(s => s.value).filter(Boolean);
        if (new Set(lista).size !== lista.length) return toast('Hay rookies repetidos', 'error');
        lanzar('draft', { lista }, 'Preferencias guardadas');
    });
}

function draftUI(liga, debeLocal) {
    const pref = m.preferencias?.[miEq] || [];
    const rookies = (m.rookies || []).filter(r => r.liga === liga);
    if (!rookies.length) return '';
    return `<h3 style="margin-top:18px">C · Tus rookies favoritos</h3>
      <p class="muted peq">Si no cubres la vacante antes del cierre, se te asigna el primero de tu lista que siga libre (elige antes la peor escudería).</p>
      <div class="campo-fila">${[0, 1, 2].map(i => `<label>Opción ${i + 1}<select data-pref="${i}"><option value="">—</option>${rookies.map(r => `<option value="${esc(r.id)}" ${pref[i] === r.id ? 'selected' : ''} ${debeLocal && r.nac !== NAC_LOCAL[liga] ? 'disabled' : ''}>${esc(r.nombre)} ${esc(r.apellido)} (${r.nac.toUpperCase()}, ${r.edad}) ${'★'.repeat(r.estrellas)}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="fila-botones"><button class="btn btn-sec" id="guardar-draft">Guardar preferencias</button></div>`;
}
