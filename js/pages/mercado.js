import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store, usuario, encolar } from '../core/app.js';
import { esc, banderaLiga, bandera, vacio, fecha, toast, $, $$ } from '../core/ui.js';
import { celdaPiloto, celdaEquipo, fmtValor } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL } from '../engine/constants.js';
import { calcularRiesgo } from '../engine/stats.js';

const u = await montar({ activo: 'mercado' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const m = await store().get(`mercado/T${d.temporada}`).catch(() => null);
const miEq = u?.perfil?.equipoId;

main.innerHTML = `<div class="cabecera-pagina"><div><h1>Mercado</h1><p class="sub">Retención mínima del 70%: traspasos internacionales obligatorios, despidos por rendimiento frente al compañero y draft de rookies.</p></div></div><div id="cuerpo"></div>`;
const cuerpo = $('#cuerpo');
if (m) mercadoReal(); else proyeccion();

function mercadoReal() {
    const abierto = m.estado === 'draft';
    const misVacantes = (m.vacantes || []).filter(v => v.eq === miEq);
    const nombreGuardado = (x) => d.piloto(x.pid) ? celdaPiloto(d, x.pid) : esc(x.nombre || x.pid);
    cuerpo.innerHTML = `
    ${abierto ? `<div class="aviso-caja" style="margin-bottom:16px">El draft de rookies cierra el <b>${fecha(m.deadline)}</b> (<span data-cuenta="${m.deadline}"></span>). Los equipos sin mánager eligen automáticamente.</div>` : `<div class="info-caja" style="margin-bottom:16px">Mercado cerrado. Así quedan las parrillas para la próxima temporada.</div>`}
    ${misVacantes.length && abierto ? draftUI(misVacantes) : ''}
    <div class="rejilla rejilla-2">
      <div class="tarjeta"><div class="tarjeta-titulo"><h2>Traspasos internacionales</h2></div>
        ${m.plan.traspasos.length ? `<table class="tabla"><tbody>${m.plan.traspasos.map(t => `<tr><td><span class="insignia ${t.tipo === 'galactico' ? 'mundial' : 'p1'}">${t.tipo === 'galactico' ? 'Galáctico' : 'Táctico'}</span></td><td>${nombreGuardado(t)}</td><td>${banderaLiga(t.de)} → ${banderaLiga(t.a)} ${celdaEquipo(d, t.eqDestino)}</td></tr>`).join('')}</tbody></table>` : vacio('Sin traspasos.')}
      </div>
      <div class="tarjeta"><div class="tarjeta-titulo"><h2>Despidos</h2></div>
        ${m.plan.despidos.length ? `<table class="tabla"><tbody>${m.plan.despidos.map(x => `<tr><td>${banderaLiga(x.liga)}</td><td>${nombreGuardado(x)}</td><td>${celdaEquipo(d, x.eq)}</td><td><span class="insignia ${x.motivo === 'directo' ? 'despido' : 'peligro'}">${x.motivo === 'directo' ? 'Directo' : 'Zona de peligro'}</span></td></tr>`).join('')}</tbody></table>` : vacio('Sin despidos.')}
        ${m.plan.salvados?.length ? `<p class="etiqueta" style="margin-top:12px">Salvados por la Regla del Compañero</p><ul class="lista">${m.plan.salvados.map(x => `<li>${banderaLiga(x.liga)} ${nombreGuardado(x)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
    <div class="tarjeta" style="margin-top:16px"><div class="tarjeta-titulo"><h2>Draft de rookies</h2></div>
      ${m.elegidos?.length ? `<table class="tabla"><thead><tr><th>Escudería</th><th>Rookie elegido</th></tr></thead><tbody>${m.elegidos.map(x => `<tr><td>${celdaEquipo(d, x.eq)}</td><td>${d.piloto(x.rookie) ? celdaPiloto(d, x.rookie) : esc(x.nombre)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="etiqueta">Orden del draft (peor escudería primero)</p>
      <ol style="columns:2;font-size:.9rem">${(m.vacantes || []).map(v => `<li>${banderaLiga(v.liga, { ancho: 14 })} ${esc(d.nombreEquipo(v.eq))}</li>`).join('')}</ol>
      <p class="etiqueta" style="margin-top:10px">Bolsa de rookies</p>
      ${LIGAS_NACIONALES.map(l => `<div style="margin:8px 0"><b>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</b> <span class="muted">${m.rookies.filter(r => r.liga === l).map(r => `${bandera(r.nac)} ${esc(r.nombre)} ${esc(r.apellido)} ${''.repeat(r.estrellas)}`).join(' · ')}</span></div>`).join('')}
    </div>`;
    if (misVacantes.length && abierto) activarDraft(misVacantes);
}

function draftUI(vacantes) {
    const liga = vacantes[0].liga;
    const pref = m.preferencias?.[miEq] || [];
    const companero = Object.entries(d.cat.pilotos).find(([, p]) => p.equipoId === miEq);
    const debeLocal = !companero || companero[1].nac !== NAC_LOCAL[liga];
    const rookies = m.rookies.filter(r => r.liga === liga);
    return `<div class="tarjeta resaltada" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2>Tu draft · ${vacantes.length} vacante${vacantes.length > 1 ? 's' : ''}</h2></div>
      <p class="muted">Ordena tus favoritos (hasta 5). Cuando cierre el draft, se te asignará el primero de tu lista que siga libre. ${debeLocal ? `<b class="aviso">Debes fichar un piloto ${esc(LIGAS[liga].gentilicio)} para el asiento de Piloto 1.</b>` : ''}</p>
      <div class="campo-fila">${[0, 1, 2, 3, 4].map(i => `<label>Opción ${i + 1}<select data-pref="${i}"><option value="">—</option>${rookies.map(r => `<option value="${esc(r.id)}" ${pref[i] === r.id ? 'selected' : ''} ${debeLocal && r.nac !== NAC_LOCAL[liga] ? 'disabled' : ''}>${esc(r.nombre)} ${esc(r.apellido)} (${r.nac.toUpperCase()}, ${r.edad}) ${''.repeat(r.estrellas)}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="fila-botones"><button class="btn" id="guardar-draft">Guardar preferencias</button></div></div>`;
}

function activarDraft() {
    $('#guardar-draft').addEventListener('click', async () => {
        const lista = $$('[data-pref]').map(s => s.value).filter(Boolean);
        if (new Set(lista).size !== lista.length) return toast('Hay rookies repetidos', 'error');
        try { await encolar('draft', { lista }); toast('Preferencias enviadas. Se registrarán en el próximo ciclo.'); }
        catch (e) { toast(e.message, 'error'); }
    });
}

function proyeccion() {
    const proy = d.clasificadosMundial();
    const inmunes = new Set(proy.clasificados?.map(c => c.pid) || []);
    cuerpo.innerHTML = `<div class="info-caja" style="margin-bottom:16px">El mercado se abre automáticamente al terminar el Mundial. Esta es la proyección si la temporada acabara hoy.</div>
    <div class="rejilla rejilla-2">${LIGAS_NACIONALES.map(l => {
        if (!d.sesionesLiga(l).length) return `<div class="tarjeta"><h3>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</h3>${vacio('Aún sin carreras.')}</div>`;
        const r = calcularRiesgo(d.tabla(l), d.pilotosLiga(l), { inmunes }).filter(x => x.zona === 'despido' || x.zona === 'peligro');
        const top5 = d.clasificacionPilotos(l).slice(0, 5);
        return `<div class="tarjeta"><div class="tarjeta-titulo"><h3>${banderaLiga(l)} ${esc(LIGAS[l].nombre)}</h3><a class="muted" href="liga.html?l=${l}&tab=riesgo">Detalle →</a></div>
          <p class="etiqueta">En riesgo</p><ul class="lista">${r.map(x => `<li class="fila-entre"><span>${celdaPiloto(d, x.pid)}</span><span><span class="insignia ${x.zona}">${x.zona === 'despido' ? 'Despido' : 'Peligro'}</span> <span class="muted" style="font-size:.8rem">compañero ${x.posComp}º · índice ${fmtValor(x.riesgo)}</span></span></li>`).join('')}</ul>
          ${(() => { const esc2 = Object.entries(d.cat.equipos).filter(([, e]) => e.liga === l && e.escaparate); return esc2.length ? `<p class="etiqueta" style="margin-top:10px">En el escaparate (candidatos a Táctico)</p><p class="muted peq">${esc2.map(([id, e]) => `${esc(d.nombre(e.escaparate))} <span class="tenue">(${esc(e.corto || e.nombre)})</span>`).join(' · ')}</p>` : ''; })()}
          <p class="etiqueta" style="margin-top:10px">Candidatos a Galáctico (top 5)</p><p class="muted" style="font-size:.88rem">${top5.map(s => esc(d.nombre(s.pid))).join(' · ')}</p></div>`;
    }).join('')}</div>`;
}
void usuario;
