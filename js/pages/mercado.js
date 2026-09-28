import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { store, encolar, escuchar } from '../core/app.js';
import { esc, banderaLiga, vacio, fecha, toast, dinero, $, $$, activarCuentas, confirmar } from '../core/ui.js';
import { celdaPiloto, celdaEquipo } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL } from '../engine/constants.js';
import { calcularRiesgo } from '../engine/stats.js';
import { candidatosGalactico } from '../core/mercado-ui.js';
import { MERCADO, valorPiloto, tacticoDe } from '../engine/mercado.js';

const u = await montar({ activo: 'mercado' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
let [m, docOfertas] = await Promise.all([
    store().get(`mercado/T${d.temporada}`).catch(() => null),
    store().get(`mercado_ofertas/T${d.temporada}`).catch(() => null),
]);
const miEq = u?.perfil?.equipoId;

main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Temporada ${d.temporada}</div><h1>Mercado</h1><p class="sub">Tres días de fichajes al acabar el Mundial: Galácticos, vacantes y trueques. Siempre con al menos un 55% de pilotos locales en cada liga.</p></div>
<a class="btn btn-sec btn-peq" href="reglamento.html#mercado">Cómo funciona</a></div>
<div id="cuerpo"></div>`;
const cuerpo = $('#cuerpo');
const pintar = () => { if (m) mercadoReal(); else temporadaEnCurso(); activarCuentas(); };
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

// ---------------------------------------------------------------- Durante la temporada
function temporadaEnCurso() {
    const ofertas = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o })).sort((a, b) => b.importe - a.importe);
    const proy = d.clasificadosMundial();
    const inmunes = new Set(proy.clasificados?.map(c => c.pid) || []);
    const candidatos = LIGAS_NACIONALES.flatMap(l => candidatosGalactico(d, l));
    const riesgo = LIGAS_NACIONALES.flatMap(l => d.sesionesLiga(l).length
        ? calcularRiesgo(d.tabla(l), d.pilotosLiga(l), { inmunes }).filter(x => x.zona === 'despido' || x.zona === 'peligro').map(x => ({ ...x, liga: l })) : []);
    cuerpo.innerHTML = `
    <div class="aviso-caja" style="margin-bottom:30px">El mercado abre al terminar el Mundial y dura ${MERCADO.diasVentana} días. Esto es lo que pasaría si la temporada acabara hoy.</div>
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Candidatos a Galáctico</h2><span>top 5 elegible</span></div>
          ${candidatos.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Piloto</th><th class="ancho">Escudería</th><th class="der">Pos</th></tr></thead><tbody>
          ${candidatos.map(c => `<tr><td>${banderaLiga(c.liga)}</td><td>${celdaPiloto(d, c.pid)}</td><td class="ancho">${celdaEquipo(d, c.eq)}</td><td class="der">${c.pos}º</td></tr>`).join('')}
          </tbody></table></div>` : vacio('Aún sin carreras.')}
          <p class="muted peq" style="margin:10px 0 0">Cada liga cede un Galáctico. Solo puede salir un piloto cuyo compañero sea de la nacionalidad de la liga, para que la escudería conserve a su Piloto 1.</p>
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>En riesgo de despido</h2><span>contra su compañero</span></div>
          ${riesgo.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Piloto</th><th class="der">Pos</th><th class="der">Compañero</th><th>Situación</th></tr></thead><tbody>
          ${riesgo.map(x => `<tr><td>${banderaLiga(x.liga)}</td><td>${celdaPiloto(d, x.pid)}</td><td class="der">${x.pos}º</td><td class="der">${x.posComp ?? '—'}º</td><td><span class="insignia ${x.zona}">${x.zona === 'despido' ? 'Despido' : x.caeria ? 'Peligro · caería' : 'Peligro · se salva'}</span></td></tr>`).join('')}
          </tbody></table></div>` : vacio('Aún sin carreras.')}
        </section>
      </div>
      <aside class="tarjeta"><div class="tarjeta-titulo"><h2>Ofertas por Galácticos</h2><span>${ofertas.length}</span></div>
        ${ofertas.length ? ofertas.map(o => `<div class="declaracion"><div class="meta">${esc(d.nombreEquipo(o.eq))} · ${fecha(o.fecha)}</div>
          <p>Quiere a <b>${esc(d.nombre(o.pid))}</b> ${banderaLiga(d.piloto(o.pid)?.liga, { ancho: 14 })} y ofrece <b>${dinero(o.importe)}</b>.</p></div>`).join('') : vacio('Ninguna escudería ha hecho ofertas todavía.')}
        <p class="muted peq" style="margin:12px 0 0">Las ${MERCADO.topComprador} mejores escuderías de cada liga pueden pujar desde Mi escudería. Las ofertas tienen prioridad cuando la liga elige al Galáctico.</p>
      </aside>
    </div>`;
}

// ---------------------------------------------------------------- Mercado (abierto o cerrado)
function mercadoReal() {
    const abierto = m.estado !== 'cerrado' && m.deadline > Date.now() - 60_000;
    const nomP = (pid, guardado) => d.piloto(pid) ? celdaPiloto(d, pid) : esc(guardado || pid);
    const G = m.galacticos || [];
    cuerpo.innerHTML = `
    ${abierto ? `<div class="aviso-caja mercado-reloj"><span>El mercado cierra en <b data-cuenta="${m.deadline}"></b></span><span class="muted peq">${fecha(m.deadline)}</span></div>`
        : '<div class="info-caja" style="margin-bottom:30px">Mercado cerrado. Así quedan las parrillas para la próxima temporada.</div>'}
    ${abierto && miEq ? `<div id="mi-mercado"></div>` : ''}
    <section class="tarjeta" style="margin-bottom:36px"><div class="tarjeta-titulo"><h2>Galácticos</h2><span>uno por liga</span></div>
      ${G.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Galáctico</th><th class="ancho">Escudería</th><th class="cen ancho">Ofertas</th><th>Destino</th></tr></thead><tbody>
      ${G.map(g => {
          const ofs = (m.ofertas || []).filter(o => o.pid === g.pid && o.estado === 'pendiente');
          const dest = g.destino ? `<span class="con-bandera">${celdaEquipo(d, g.destino.eq)}</span> <span class="muted peq">${dinero(g.destino.importe)} · ${{ aceptada: 'oferta aceptada', oferta: 'la liga elige la mejor oferta', solicitud: 'solicitud a la liga', ia: 'decidido por la liga', suerte: 'por sorpresa' }[g.destino.via]}</span>`
              : g.estado === 'se_queda' ? '<span class="muted">Se queda</span>' : `<span class="insignia">${g.decision === 'liga' ? 'Decide la liga' : 'Pendiente'}</span>`;
          return `<tr><td>${banderaLiga(g.liga)}</td><td><div class="fila" style="flex-wrap:nowrap;gap:6px">${nomP(g.pid, g.nombre)}<span class="muted peq">${g.pos}º</span></div></td><td class="ancho">${celdaEquipo(d, g.eq)}</td><td class="cen num ancho">${ofs.length || '—'}</td><td>${dest}</td></tr>`;
      }).join('')}</tbody></table></div>` : vacio('Sin Galácticos esta temporada.')}
      <p class="muted peq" style="margin:10px 0 0">Si su escudería no acepta ninguna oferta, decide la liga al cerrar: primero las ofertas, luego las solicitudes de traspaso y luego la IA. Quien pierde al Galáctico recibe al segundo piloto del comprador.</p>
    </section>
    <div class="rejilla rejilla-lado" style="margin-bottom:36px">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Movimientos</h2><span>${(m.movimientos || []).length}</span></div>
        ${(m.movimientos || []).length ? `<ul class="lista">${m.movimientos.map(x => `<li><span class="muted peq mono">${fecha(x.t)}</span><div>${esc(x.texto)}</div></li>`).join('')}</ul>` : vacio('Todavía no se ha cerrado ninguna operación.')}
      </section>
      <aside class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Con ficha de fichaje</h2><span>${Object.keys(m.fichas || {}).length}</span></div>
          ${Object.keys(m.fichas || {}).length ? `<ul class="lista">${Object.keys(m.fichas).map(eq => `<li><span class="con-bandera">${banderaLiga(d.equipo(eq)?.liga, { ancho: 16 })}${celdaEquipo(d, eq)}</span></li>`).join('')}</ul>` : vacio('Nadie todavía.')}
          <p class="muted peq" style="margin:10px 0 0">Pueden hacer trueques de pilotos entre ellas.</p>
        </section>
      </aside>
    </div>
    <div class="rejilla rejilla-2">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Despidos</h2><span>${m.plan.despidos.length}</span></div>
        ${m.plan.despidos.map(x => `<div class="declaracion"><div class="meta"><span class="con-bandera">${banderaLiga(x.liga, { ancho: 12 })}<span class="txt">${esc(d.nombreEquipo(x.eq))} · ${x.motivo === 'directo' ? 'despido directo' : 'zona de peligro'}</span></span></div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º con su compañero ${x.posComp}º.</p></div>`).join('') || vacio('Sin despidos.')}
      </section>
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Salvan el asiento</h2><span>${m.plan.salvados?.length || 0}</span></div>
        ${(m.plan.salvados || []).map(x => `<div class="declaracion"><div class="meta"><span class="con-bandera">${banderaLiga(x.liga, { ancho: 12 })}<span class="txt">${esc(d.nombreEquipo(x.eq))}</span></span></div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º, pero su compañero acabó ${x.posComp}º. El coche no daba para más.</p></div>`).join('') || vacio('Nadie.')}
      </section>
    </div>
    ${m.elegidos?.length ? `<section class="tarjeta" style="margin-top:36px"><div class="tarjeta-titulo"><h2>Rookies</h2><span>${m.elegidos.length}</span></div>
      <div class="tabla-scroll"><table class="tabla"><tbody>${m.elegidos.map(x => `<tr><td>${celdaEquipo(d, x.eq)}</td><td>${d.piloto(x.rookie) ? celdaPiloto(d, x.rookie) : esc(x.nombre)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
    if (abierto && miEq) miMercado($('#mi-mercado'));
}

// ---------------------------------------------------------------- Lo que puede hacer mi escudería
function miMercado(el) {
    const eq = d.equipo(miEq);
    const liga = eq?.liga;
    const suyos = Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === miEq).map(([id, p]) => ({ id, ...p }));
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

    // 1. Mi Galáctico está en venta
    if (miG) {
        const ofs = (m.ofertas || []).filter(o => o.pid === miG.pid && o.estado === 'pendiente').sort((a, b) => b.importe - a.importe);
        bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Tu Galáctico: ${esc(miG.nombre)}</h2><span>${ofs.length} oferta${ofs.length === 1 ? '' : 's'}</span></div>
          <p class="muted">Se va a otra liga. Acepta una oferta (cobras lo que ofrecen y recibes a su segundo piloto) o deja que decida la liga (cobras ${dinero(MERCADO.compensacionLiga)} y recibes al segundo piloto de quien se lo lleve).</p>
          ${ofs.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Escudería</th><th>Te llega</th><th class="der">Oferta</th><th></th></tr></thead><tbody>
          ${ofs.map(o => { const t = tacticoDe(Object.entries(d.cat.pilotos).map(([id, p]) => ({ id, ...p })), o.eq, d.equipo(o.eq)?.liga); return `<tr><td><span class="con-bandera">${banderaLiga(d.equipo(o.eq)?.liga, { ancho: 16 })}${celdaEquipo(d, o.eq)}</span></td><td>${t ? celdaPiloto(d, t.id) : '<span class="muted">Nadie</span>'}</td><td class="pts">${dinero(o.importe)}</td><td class="der"><button class="btn btn-peq" data-aceptar="${esc(o.id)}">Aceptar</button></td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted">Todavía nadie ha pujado. Las ofertas llegan de las 3 mejores escuderías de las otras ligas.</p>'}
          <div class="fila-botones">${miG.decision === 'liga' ? '<span class="muted peq">Has dejado que decida la liga.</span><button class="btn btn-sec btn-peq" data-liga="0">Me lo pienso</button>' : '<button class="btn btn-sec" data-liga="1">Que decida la liga</button>'}</div></section>`);
    }

    // 2. Vacante: fichar a un piloto de otra escudería
    if (vacante) {
        const mias = (m.fichajes || []).filter(f => f.eq === miEq);
        const bloqueados = new Set((m.galacticos || []).filter(g => g.estado === 'pendiente').map(g => g.pid));
        const opciones = LIGAS_NACIONALES.map(l => {
            const ps = Object.entries(d.cat.pilotos).filter(([id, p]) => p.liga === l && p.equipoId !== miEq && !bloqueados.has(id))
                .sort((a, b) => (posPil[a[0]] || 20) - (posPil[b[0]] || 20));
            return `<optgroup label="${esc(LIGAS[l].nombre)}">${ps.map(([id, p]) => `<option value="${esc(id)}" data-valor="${valorPiloto(posPil[id])}">${esc(p.nombre)} ${esc(p.apellido)} (${p.nac.toUpperCase()}) · ${esc(d.nombreEquipo(p.equipoId))} · ${posPil[id] ? `${posPil[id]}º` : '—'}</option>`).join('')}</optgroup>`;
        }).join('');
        const companero = suyos[0];
        const debeLocal = !companero || companero.nac !== NAC_LOCAL[liga];
        bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Tienes una vacante</h2></div>
          <p class="muted">Haz una oferta por un piloto de otra escudería. Si es de la IA, acepta al momento si pagas lo que vale; si tiene mánager, decide él. Si no cubres la vacante antes del cierre, la liga te asigna un rookie.${debeLocal ? ` Ojo: necesitas un piloto ${esc(LIGAS[liga].gentilicio)} para el asiento de Piloto 1.` : ''}</p>
          <form id="f-fichaje" class="campo-fila"><label>Piloto<select name="pid">${opciones}</select></label><label>Oferta (€)<input name="importe" type="number" min="${MERCADO.fichajeMinimo}" step="50000" value="1000000"></label></form>
          <p class="muted peq" id="valor-pil"></p>
          <div class="fila-botones"><button class="btn" id="b-fichaje">Enviar oferta</button></div>
          ${mias.length ? `<ul class="lista">${mias.slice().reverse().map(f => `<li class="fila-entre"><span>${esc(f.nombre)} · ${dinero(f.importe)} <span class="insignia">${estadoTxt(f.estado)}</span>${f.motivo ? ` <span class="muted peq">${esc(f.motivo)}</span>` : ''}</span>${f.estado === 'pendiente' ? `<button class="btn btn-sec btn-peq" data-cancelar-f="${esc(f.id)}">Retirar</button>` : ''}</li>`).join('')}</ul>` : ''}
          ${draftUI(liga, debeLocal)}</section>`);
    }

    // 3. Ofertas recibidas por mis pilotos
    if (recibidasF.length) bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Quieren a tus pilotos</h2></div>
      <p class="muted">Si vendes, tendrás una vacante que cubrir (fichando o con un rookie).</p>
      <ul class="lista">${recibidasF.map(f => `<li class="fila-entre"><span>${celdaEquipo(d, f.eq)} ofrece <b>${dinero(f.importe)}</b> por ${esc(f.nombre)}</span><span class="fila"><button class="btn btn-peq" data-resp-f="${esc(f.id)}" data-acepta="1">Vender</button><button class="btn btn-sec btn-peq" data-resp-f="${esc(f.id)}" data-acepta="0">No</button></span></li>`).join('')}</ul></section>`);

    // 4. Fichar un Galáctico (top 3)
    if (esTop && !yaG) {
        const disp = (m.galacticos || []).filter(g => g.estado === 'pendiente' && g.liga !== liga);
        const mias = (m.ofertas || []).filter(o => o.eq === miEq);
        const sol = m.solicitudes?.[miEq];
        const t = tacticoDe(suyos, miEq, liga);
        bloques.push(`<section class="tarjeta"><div class="tarjeta-titulo"><h2>Ficha un Galáctico</h2><span>${posEq}º de tu liga</span></div>
          <p class="muted">A cambio se va tu segundo piloto${t ? `: <b>${esc(t.nombre)} ${esc(t.apellido)}</b>` : ''}. Las ofertas tienen prioridad; si la liga decide, también mira las solicitudes de traspaso.</p>
          ${disp.length ? `<form id="f-galactico" class="campo-fila"><label>Galáctico<select name="pid">${disp.map(g => `<option value="${esc(g.pid)}">${esc(g.nombre)} · ${esc(LIGAS[g.liga].nombre)} (${g.pos}º)</option>`).join('')}</select></label><label>Oferta (€)<input name="importe" type="number" min="${MERCADO.importeMinimo}" step="100000" value="${MERCADO.importeMinimo * 2}"></label></form>
          <div class="fila-botones"><button class="btn" id="b-galactico">Hacer oferta</button></div>` : '<p class="muted">No quedan Galácticos de otras ligas en el mercado.</p>'}
          ${mias.length ? `<ul class="lista">${mias.slice().reverse().map(o => `<li class="fila-entre"><span>${esc(d.nombre(o.pid))} · ${dinero(o.importe)} <span class="insignia">${estadoTxt(o.estado)}</span></span>${o.estado === 'pendiente' ? `<button class="btn btn-sec btn-peq" data-cancelar-o="${esc(o.id)}">Retirar</button>` : ''}</li>`).join('')}</ul>` : ''}
          <h3 style="margin-top:18px">Solicitud de traspaso a la liga</h3>
          <p class="muted peq">Dices cuánto pagarías por un Galáctico cualquiera. Si al cerrar te toca uno, se te cobra esa cantidad y das a tu segundo piloto.</p>
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
              <label>Recibes<select name="recibe">${conFicha.map(x => `<optgroup label="${esc(d.nombreEquipo(x))}">${Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === x).map(([id, p]) => `<option value="${esc(id)}" data-eq="${esc(x)}">${esc(p.nombre)} ${esc(p.apellido)} (${p.nac.toUpperCase()}) · ${posPil[id] ? `${posPil[id]}º` : '—'}</option>`).join('')}</optgroup>`).join('')}</select></label></form>
              <div class="fila-botones"><button class="btn" id="b-trueque">Proponer trueque</button></div>` : '<p class="muted">Tienes ficha. Aún no hay otras escuderías con ficha para hacer un trueque.</p>'}
          ${misT.length ? `<ul class="lista">${misT.slice().reverse().map(t => `<li>${esc(t.nombreDa)} ↔ ${esc(t.nombreRecibe)} (${esc(d.nombreEquipo(t.conEq))}) <span class="insignia">${estadoTxt(t.estado)}</span>${t.motivo ? ` <span class="muted peq">${esc(t.motivo)}</span>` : ''}</li>`).join('')}</ul>` : ''}</section>`);
    }
    if (recibidasT.length) bloques.push(`<section class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h2>Te proponen un trueque</h2></div>
      <ul class="lista">${recibidasT.map(t => `<li class="fila-entre"><span>${celdaEquipo(d, t.eq)}: te da a <b>${esc(t.nombreDa)}</b> por <b>${esc(t.nombreRecibe)}</b></span><span class="fila"><button class="btn btn-peq" data-resp-t="${esc(t.id)}" data-acepta="1">Aceptar</button><button class="btn btn-sec btn-peq" data-resp-t="${esc(t.id)}" data-acepta="0">No</button></span></li>`).join('')}</ul></section>`);

    el.innerHTML = bloques.length ? `<div class="pila" style="margin-bottom:36px">${bloques.join('')}</div>` : '';

    // Eventos
    $$('[data-aceptar]', el).forEach(b => b.addEventListener('click', async () => { if (await confirmar('¿Aceptar esta oferta? El Galáctico se va ya.')) lanzar('mercado_aceptar', { ofertaId: b.dataset.aceptar }, '¡Traspaso cerrado!'); }));
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
    return `<h3 style="margin-top:18px">Si no ficha a nadie: tus rookies favoritos</h3>
      <p class="muted peq">Al cerrar se te asigna el primero de tu lista que siga libre (elige antes la peor escudería).</p>
      <div class="campo-fila">${[0, 1, 2].map(i => `<label>Opción ${i + 1}<select data-pref="${i}"><option value="">—</option>${rookies.map(r => `<option value="${esc(r.id)}" ${pref[i] === r.id ? 'selected' : ''} ${debeLocal && r.nac !== NAC_LOCAL[liga] ? 'disabled' : ''}>${esc(r.nombre)} ${esc(r.apellido)} (${r.nac.toUpperCase()}, ${r.edad}) ${'★'.repeat(r.estrellas)}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="fila-botones"><button class="btn btn-sec" id="guardar-draft">Guardar preferencias</button></div>`;
}
