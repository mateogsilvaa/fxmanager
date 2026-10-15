// Mi escudería → Equipo: ingenieros, negociaciones con otras escuderías y reputación (desde la temporada 2)
import { esc, dinero, confirmar, $$, barra, toast } from '../core/ui.js';
import { avatarIngeniero } from '../core/avatar.js';
import { AREAS, identidadAbierta } from '../engine/constants.js';
import { CATEGORIAS_ING, deEquipo, libres, huecoLibre, primaIngeniero, salarioIngeniero, indemnizacion, estrellasTxt, sueldoDiario } from '../engine/ingenieros.js';
import { nivelRep, descuentoPrimaIngeniero, REP_INICIAL } from '../engine/reputacion.js';

const nombre = (i) => `${i.nombre} ${i.apellido}`;
const ESTADO = { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada', cancelada: 'Cancelada' };

// s: { d, eqId, eq, priv, plantilla, negociaciones, repManager, pendientes, uid }
export function htmlNovedades(s) {
    return `${reputacionHtml(s)}${ingenierosHtml(s)}${negociacionesHtml(s)}`;
}

function reputacionHtml({ eq, repManager }) {
    const re = eq.reputacion ?? REP_INICIAL, rm = repManager ?? REP_INICIAL;
    const fila = (t, v, desc) => `<div style="margin:10px 0"><div class="fila-entre"><span><b>${t}</b> <span class="muted peq">${nivelRep(v)}</span></span><b class="num">${v}</b></div>${barra(v)}<div class="muted peq" style="margin-top:4px">${desc}</div></div>`;
    return `<div class="tarjeta"><div class="tarjeta-titulo"><h2>Reputación</h2></div>
      ${fila('Escudería', re, 'Mejores patrocinadores, más fans y fichajes de ingenieros más baratos.')}
      ${fila('Tú como mánager', rm, 'La directiva te da más margen y las otras escuderías negocian mejor contigo.')}
      <p class="muted peq" style="margin:8px 0 0">Sube con buenos resultados, acuerdos limpios y decisiones valientes; baja con escándalos, despidos o echarte atrás.</p></div>`;
}

function ingenierosHtml({ eqId, eq, plantilla, pendientes, priv }) {
    if (!plantilla) return '';
    const mios = deEquipo(plantilla, eqId);
    const desc = descuentoPrimaIngeniero(eq.reputacion);
    const enCola = new Set([...pendientes('ing_fichar'), ...pendientes('ing_despedir')].map(a => a.params?.id));
    const filaIng = (i, mio) => `<div class="ing-fila">${avatarIngeniero(i.id, mio ? eq.color : null, 34)}
        <div class="ing-nom"><b>${esc(nombre(i))}</b><div class="muted peq">${esc(CATEGORIAS_ING[i.cat].nombre)} · <span class="estrellas">${estrellasTxt(i.estrellas)}</span> · ${dinero(salarioIngeniero(i.estrellas))}/día</div></div>
        ${enCola.has(i.id) ? '<span class="muted peq">En cola…</span>' : mio
            ? `<button class="btn btn-sec btn-peq" data-ing-despedir="${esc(i.id)}" title="Indemnización ${dinero(indemnizacion(i))}">Despedir</button>`
            : `<button class="btn btn-peq" data-ing-fichar="${esc(i.id)}" ${!huecoLibre(plantilla, eqId, i.cat) || priv.presupuesto < primaIngeniero(i.estrellas) * (1 - desc) ? 'disabled' : ''}>Fichar · ${dinero(Math.round(primaIngeniero(i.estrellas) * (1 - desc)))}</button>`}</div>`;
    const porCat = Object.entries(CATEGORIAS_ING).map(([c, info]) => {
        const suyos = mios.filter(i => i.cat === c);
        const huecos = info.huecos - suyos.length;
        return `<div class="ing-cat"><div class="fila-entre"><b>${esc(info.nombre)}</b><span class="muted peq">${suyos.length}/${info.huecos}</span></div>
          ${suyos.map(i => filaIng(i, true)).join('')}${huecos > 0 ? `<div class="muted peq ing-hueco">${huecos} hueco${huecos > 1 ? 's' : ''} libre${huecos > 1 ? 's' : ''}</div>` : ''}</div>`;
    }).join('');
    const disp = libres(plantilla).sort((a, b) => b.estrellas - a.estrellas);
    return `<div class="tarjeta"><div class="tarjeta-titulo"><h2>Ingenieros</h2><span class="muted peq">${dinero(sueldoDiario(plantilla, eqId))}/día en sueldos</span></div>
      <p class="muted peq">Cada estrella de los ingenieros de un área abarata (1,5%), acelera (1,5%) y hace más segura (+1%) cada mejora de esa área. El ingeniero de pista mejora las lecturas del reglaje.</p>
      ${porCat}
      <details class="ing-libres"><summary>Ingenieros libres (${disp.length})${desc > 0 ? ` · ${Math.round(desc * 100)}% de descuento por tu reputación` : ''}</summary>
        <select id="ing-filtro"><option value="">Todas las áreas</option>${Object.entries(CATEGORIAS_ING).map(([c, i]) => `<option value="${c}">${esc(i.nombre)}</option>`).join('')}</select>
        <div id="ing-lista">${disp.map(i => `<div data-cat="${i.cat}">${filaIng(i, false)}</div>`).join('')}</div>
      </details></div>`;
}

function negociacionesHtml({ d, eqId, plantilla, negociaciones, pendientes }) {
    if (!plantilla) return '';
    const recibidas = negociaciones.filter(n => n.a === eqId && n.estado === 'pendiente');
    const enviadas = negociaciones.filter(n => n.de === eqId).slice(0, 6);
    const rivales = Object.entries(d.cat.equipos).filter(([id]) => id !== eqId).sort(([, a], [, b]) => a.liga.localeCompare(b.liga) || a.nombre.localeCompare(b.nombre));
    const enCola = pendientes('neg_proponer').length;
    return `<div class="tarjeta"><div class="tarjeta-titulo"><h2>Negociar con otra escudería</h2></div>
      <p class="muted peq">Compra (pides algo y pagas), intercambio (cosa por cosa) o intercambio con compensación. Puedes negociar ingenieros, pilotos (solo fuera del periodo de carreras y cumpliendo el 55% de locales) y planos de piezas: con los planos de un nivel que el otro tiene, tu mejora hasta ese nivel no falla y sale un 30% más barata. La IA acepta si sale ganando.</p>
      ${recibidas.length ? `<div class="aviso-caja" style="margin:10px 0">${recibidas.map(n => `<div class="fila-entre" style="gap:10px;flex-wrap:wrap;padding:6px 0"><span>${esc(n.texto)}</span><span class="fila"><button class="btn btn-peq" data-neg-si="${esc(n.id)}">Aceptar</button><button class="btn btn-sec btn-peq" data-neg-no="${esc(n.id)}">No</button></span></div>`).join('')}</div>` : ''}
      <form id="f-neg" class="neg-form">
        <label>Con<select name="conEq"><option value="">Elige escudería…</option>${rivales.map(([id, e]) => `<option value="${esc(id)}">${esc(e.nombre)} (${esc(e.liga)})</option>`).join('')}</select></label>
        <div id="neg-lados"></div>
        <div class="fila-botones"><span class="muted peq" id="neg-tipo"></span><button class="btn" ${enCola ? 'disabled' : ''}>${enCola ? 'Enviando…' : 'Enviar propuesta'}</button></div>
      </form>
      ${enviadas.length ? `<h3 style="margin-top:16px">Tus propuestas</h3><ul class="lista">${enviadas.map(n => `<li class="fila-entre" style="gap:8px"><span class="peq">${esc(n.texto)} <span class="insignia">${ESTADO[n.estado] || n.estado}</span>${n.motivo ? `<div class="muted">${esc(n.motivo)}</div>` : ''}</span>${n.estado === 'pendiente' ? `<button class="btn btn-sec btn-peq" data-neg-cancelar="${esc(n.id)}">Retirar</button>` : ''}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function ladoHtml(titulo, pref, { ingenieros, pilotos, pilotosOk }) {
    return `<fieldset class="neg-lado"><legend>${titulo}</legend>
      <label>Dinero (€)<input type="number" name="${pref}-dinero" min="0" step="50000" value="0"></label>
      ${ingenieros.length ? `<div class="neg-items"><span class="muted peq">Ingenieros</span>${ingenieros.map(i => `<label class="chk"><input type="checkbox" name="${pref}-ing" value="${esc(i.id)}"> ${esc(nombre(i))} <span class="muted peq">${esc(CATEGORIAS_ING[i.cat].nombre)} ${i.estrellas}★</span></label>`).join('')}</div>` : ''}
      ${pilotos.length ? `<div class="neg-items"><span class="muted peq">Pilotos${pilotosOk ? '' : ' (solo fuera del periodo de carreras)'}</span>${pilotos.map(([id, p]) => `<label class="chk"><input type="checkbox" name="${pref}-pil" value="${esc(id)}" ${pilotosOk ? '' : 'disabled'}> ${esc(p.nombre)} ${esc(p.apellido)} <span class="muted peq">${p.nac.toUpperCase()}</span></label>`).join('')}</div>` : ''}
      <div class="neg-items"><span class="muted peq">Planos</span>${Object.entries(AREAS).map(([a, x]) => `<label class="chk"><input type="checkbox" name="${pref}-plano" value="${a}"> ${esc(x.nombre)}</label>`).join('')}</div>
    </fieldset>`;
}

export function activarNovedadesUI(el, s) {
    const { d, eqId, plantilla, lanzar } = s;
    $$('[data-ing-fichar]', el).forEach(b => b.addEventListener('click', async () => {
        const i = plantilla[b.dataset.ingFichar];
        if (!await confirmar(`¿Fichar a <b>${esc(nombre(i))}</b>? Cobra ${dinero(salarioIngeniero(i.estrellas))} al día.`)) return;
        lanzar('ing_fichar', { id: i.id }, 'Fichaje enviado');
    }));
    $$('[data-ing-despedir]', el).forEach(b => b.addEventListener('click', async () => {
        const i = plantilla[b.dataset.ingDespedir];
        if (!await confirmar(`¿Despedir a <b>${esc(nombre(i))}</b>? Indemnización: ${dinero(indemnizacion(i))}.`, { peligro: true })) return;
        lanzar('ing_despedir', { id: i.id }, 'Despido enviado');
    }));
    const filtro = el.querySelector('#ing-filtro');
    filtro?.addEventListener('change', () => $$('#ing-lista > [data-cat]', el).forEach(x => { x.hidden = !!filtro.value && x.dataset.cat !== filtro.value; }));
    $$('[data-neg-si]', el).forEach(b => b.addEventListener('click', async () => { if (await confirmar('¿Aceptar el acuerdo?')) lanzar('neg_responder', { id: b.dataset.negSi, acepta: true }, 'Acuerdo enviado'); }));
    $$('[data-neg-no]', el).forEach(b => b.addEventListener('click', () => lanzar('neg_responder', { id: b.dataset.negNo, acepta: false }, 'Propuesta rechazada')));
    $$('[data-neg-cancelar]', el).forEach(b => b.addEventListener('click', () => lanzar('neg_cancelar', { id: b.dataset.negCancelar }, 'Propuesta retirada')));

    const f = el.querySelector('#f-neg');
    if (!f) return;
    const pilotosOk = identidadAbierta(d.cfg.fase);
    const lados = f.querySelector('#neg-lados');
    const pilotosDe = (eq) => Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eq);
    const pintarLados = () => {
        const con = f.conEq.value;
        lados.innerHTML = con ? `<div class="neg-grid">${ladoHtml('Tú das', 'doy', { ingenieros: deEquipo(plantilla, eqId), pilotos: pilotosDe(eqId), pilotosOk })}${ladoHtml(`Pides a ${esc(d.nombreEquipo(con))}`, 'pido', { ingenieros: deEquipo(plantilla, con), pilotos: pilotosDe(con), pilotosOk })}</div>` : '';
        tipo();
    };
    const leer = (pref) => ({
        dinero: +f.querySelector(`[name="${pref}-dinero"]`)?.value || 0,
        ingenieros: $$(`[name="${pref}-ing"]:checked`, f).map(x => x.value),
        pilotos: $$(`[name="${pref}-pil"]:checked`, f).map(x => x.value),
        planos: $$(`[name="${pref}-plano"]:checked`, f).map(x => ({ area: x.value })),
    });
    const cosas = (l) => l.ingenieros.length + l.pilotos.length + l.planos.length;
    const tipo = () => {
        if (!f.conEq.value) { f.querySelector('#neg-tipo').textContent = ''; return; }
        const a = leer('doy'), b = leer('pido');
        f.querySelector('#neg-tipo').textContent = !cosas(b) ? 'Pide algo a cambio' : !cosas(a) && a.dinero ? 'Compra' : cosas(a) && (a.dinero || b.dinero) ? 'Intercambio + compensación' : cosas(a) ? 'Intercambio' : 'Ofrece algo';
    };
    f.conEq.addEventListener('change', pintarLados);
    f.addEventListener('input', tipo);
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!f.conEq.value) return toast('Elige una escudería', 'error');
        const doy = leer('doy'), pido = leer('pido');
        if (!cosas(pido) && !pido.dinero) return toast('Pide algo a cambio', 'error');
        if (!cosas(doy) && !doy.dinero) return toast('Ofrece algo', 'error');
        lanzar('neg_proponer', { conEq: f.conEq.value, doy, pido }, 'Propuesta enviada');
    });
}
