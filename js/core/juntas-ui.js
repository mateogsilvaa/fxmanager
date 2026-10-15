// Juntas de pilotos en pantalla: votación (consigna del mánager) y resultados con el recuento
import { esc, cuentaAtras, $$ } from './ui.js';
import { VOTOS_FIA } from '../engine/juntas.js';

// j: documento juntas/{id} · voto: consigna ya enviada { tema: opcion } · editable: se puede votar
export function juntaHtml(j, { voto = {}, editable = false, enCola = false } = {}) {
    const abierta = j.estado === 'abierta';
    const cab = `<div class="tarjeta-titulo"><h2>Junta de pilotos ${j.n}</h2><span class="muted peq">${abierta ? `Cierra en <span data-cuenta="${j.cierra}" data-corta>${cuentaAtras(j.cierra, true)}</span>` : 'Resultado'}</span></div>`;
    if (abierta) {
        return `<div class="tarjeta junta" data-junta="${esc(j.id)}">${cab}
          <p class="muted peq">Cada piloto titular tiene un voto y la FIA ${VOTOS_FIA}. ${editable ? 'Dile a tus dos pilotos qué votar. Si tienen la moral baja pueden ir por libre.' : 'Votan los pilotos de las cinco ligas: cada mánager da su consigna.'} Lo que salga se aplica desde la siguiente sesión.</p>
          ${j.temas.map(t => `<fieldset class="junta-tema"><legend>${esc(t.titulo)}</legend><p>${esc(t.texto)}</p>
            <div class="junta-ops">${t.opciones.map(o => `<label class="junta-op ${voto[t.id] === o.id ? 'sel' : ''}"><input type="radio" name="jt-${esc(t.id)}" value="${esc(o.id)}" ${voto[t.id] === o.id ? 'checked' : ''} ${editable && !enCola ? '' : 'disabled'}><span>${esc(o.texto)}</span>${o.id === t.fia ? '<small class="junta-fia">la FIA vota esto</small>' : ''}</label>`).join('')}</div></fieldset>`).join('')}
          ${editable ? `<div class="fila-botones">${Object.keys(voto).length ? '<span class="muted peq">Consigna enviada. Puedes cambiarla hasta el cierre.</span>' : ''}<button class="btn" data-votar ${enCola ? 'disabled' : ''}>${enCola ? 'Enviando…' : Object.keys(voto).length ? 'Cambiar consigna' : 'Enviar consigna'}</button></div>` : ''}
        </div>`;
    }
    return `<div class="tarjeta junta">${cab}
      ${(j.resultados || []).map(r => {
          const t = j.temas.find(x => x.id === r.tema) || {};
          const total = Object.values(r.cuenta).reduce((s, v) => s + v, 0) || 1;
          return `<div class="junta-res"><b>${esc(t.titulo || '')}</b>
            ${(t.opciones || []).map(o => { const v = r.cuenta[o.id] || 0; return `<div class="junta-barra ${o.id === r.ganador ? 'gana' : ''}"><span>${esc(o.texto)}${o.id === t.fia ? ' <small>(FIA)</small>' : ''}${voto[t.id] === o.id ? ' <small>· tu consigna</small>' : ''}</span><i style="width:${Math.round(v / total * 100)}%"></i><b>${v}</b></div>`; }).join('')}</div>`;
      }).join('')}
      <p class="muted peq" style="margin:8px 0 0">Votaron ${j.votantes || '—'} pilotos y la FIA (${VOTOS_FIA} votos).${j.rebeldes ? ` ${j.rebeldes} votos fueron contra la consigna de su mánager.` : ''}</p></div>`;
}

export function activarJunta(el, j, enviar) {
    const caja = el.querySelector(`[data-junta="${j.id}"]`);
    if (!caja) return;
    $$('input[type=radio]', caja).forEach(r => r.addEventListener('change', () => {
        $$(`input[name="${r.name}"]`, caja).forEach(x => x.closest('.junta-op').classList.toggle('sel', x.checked));
    }));
    caja.querySelector('[data-votar]')?.addEventListener('click', () => {
        const votos = {};
        for (const t of j.temas) { const v = caja.querySelector(`input[name="jt-${t.id}"]:checked`)?.value; if (v) votos[t.id] = v; }
        enviar(votos);
    });
}
