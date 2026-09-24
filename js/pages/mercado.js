import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos } from '../core/datos.js';
import { store, encolar } from '../core/app.js';
import { esc, banderaLiga, vacio, fecha, toast, dinero, $, $$ } from '../core/ui.js';
import { celdaPiloto, celdaEquipo } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, NAC_LOCAL } from '../engine/constants.js';
import { calcularRiesgo } from '../engine/stats.js';
import { candidatosGalactico } from '../core/mercado-ui.js';

const u = await montar({ activo: 'mercado' });
const main = document.getElementById('main');
const d = await cargarDatos();
barraDirecto(d);
const [m, docOfertas] = await Promise.all([
    store().get(`mercado/T${d.temporada}`).catch(() => null),
    store().get(`mercado_ofertas/T${d.temporada}`).catch(() => null),
]);
const miEq = u?.perfil?.equipoId;

main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Temporada ${d.temporada}</div><h1>Mercado</h1><p class="sub">Los pilotos son de la liga: aquí se decide quién cambia de país, quién pierde el asiento y quién debuta.</p></div>
<a class="btn btn-sec btn-peq" href="reglamento.html#mercado">Cómo funciona</a></div>
<div id="cuerpo"></div>`;
const cuerpo = $('#cuerpo');
if (m) mercadoReal(); else temporadaEnCurso();

// ---------------------------------------------------------------- Durante la temporada
function temporadaEnCurso() {
    const ofertas = Object.entries(docOfertas?.ofertas || {}).map(([eq, o]) => ({ eq, ...o })).sort((a, b) => b.importe - a.importe);
    const proy = d.clasificadosMundial();
    const inmunes = new Set(proy.clasificados?.map(c => c.pid) || []);
    const candidatos = LIGAS_NACIONALES.flatMap(l => candidatosGalactico(d, l));
    const riesgo = LIGAS_NACIONALES.flatMap(l => d.sesionesLiga(l).length
        ? calcularRiesgo(d.tabla(l), d.pilotosLiga(l), { inmunes }).filter(x => x.zona === 'despido' || x.zona === 'peligro').map(x => ({ ...x, liga: l })) : []);
    cuerpo.innerHTML = `
    <div class="aviso-caja" style="margin-bottom:30px">El mercado se resuelve solo al terminar el Mundial. Esto es lo que pasaría si la temporada acabara hoy.</div>
    <div class="rejilla rejilla-lado">
      <div class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Candidatos a Galáctico</h2><span>top 5 elegible</span></div>
          ${candidatos.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Piloto</th><th class="ancho">Escudería</th><th class="der">Pos</th></tr></thead><tbody>
          ${candidatos.map(c => `<tr><td>${banderaLiga(c.liga)}</td><td>${celdaPiloto(d, c.pid)}</td><td class="ancho">${celdaEquipo(d, c.eq)}</td><td class="der">${c.pos}º</td></tr>`).join('')}
          </tbody></table></div>` : vacio('Aún sin carreras.')}
          <p class="muted peq" style="margin:10px 0 0">Solo puede salir un piloto cuyo compañero sea de la nacionalidad de la liga, para que la escudería conserve a su Piloto 1.</p>
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>En riesgo de despido</h2><span>contra su compañero</span></div>
          ${riesgo.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Piloto</th><th class="der">Pos</th><th class="der">Compañero</th><th>Situación</th></tr></thead><tbody>
          ${riesgo.map(x => `<tr><td>${banderaLiga(x.liga)}</td><td>${celdaPiloto(d, x.pid)}</td><td class="der">${x.pos}º</td><td class="der">${x.posComp ?? '—'}º</td><td><span class="insignia ${x.zona}">${x.zona === 'despido' ? 'Despido' : x.caeria ? 'Peligro · caería' : 'Peligro · se salva'}</span></td></tr>`).join('')}
          </tbody></table></div>` : vacio('Aún sin carreras.')}
        </section>
      </div>
      <aside class="tarjeta"><div class="tarjeta-titulo"><h2>Ofertas por Galácticos</h2><span>${ofertas.length}</span></div>
        ${ofertas.length ? ofertas.map(o => `<div class="declaracion"><div class="meta">${esc(d.nombreEquipo(o.eq))} · ${fecha(o.fecha)}</div>
          <p>Quiere a <b>${esc(d.nombre(o.pid))}</b> ${banderaLiga(d.piloto(o.pid)?.liga, { ancho: 14 })} y ofrece <b>${dinero(o.importe)}</b> más a ${esc(d.nombre(o.tactico))}.</p></div>`).join('') : vacio('Ninguna escudería ha hecho ofertas todavía.')}
        <p class="muted peq" style="margin:12px 0 0">Las 5 mejores escuderías de cada liga pueden hacer una oferta desde Mi escudería → Equipo.</p>
      </aside>
    </div>`;
}

// ---------------------------------------------------------------- Mercado resuelto
function mercadoReal() {
    const abierto = m.estado === 'draft';
    const misVacantes = (m.vacantes || []).filter(v => v.eq === miEq);
    const nom = (pid, guardado) => d.piloto(pid) ? celdaPiloto(d, pid) : esc(guardado || pid);
    const ops = m.plan.operaciones || [];
    cuerpo.innerHTML = `
    ${abierto ? `<div class="aviso-caja" style="margin-bottom:30px">El draft de rookies cierra el <b>${fecha(m.deadline)}</b>. Las escuderías sin mánager eligen automáticamente.</div>` : `<div class="info-caja" style="margin-bottom:30px">Mercado cerrado. Así quedan las parrillas para la próxima temporada.</div>`}
    ${misVacantes.length && abierto ? draftUI(misVacantes) : ''}
    <section class="tarjeta" style="margin-bottom:42px"><div class="tarjeta-titulo"><h2>Traspasos internacionales</h2><span>${ops.length} operaciones</span></div>
      ${ops.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Galáctico</th><th>Destino</th><th>A cambio</th><th class="der">Importe</th><th class="ancho">Origen</th></tr></thead><tbody>
      ${ops.map(o => `<tr><td>${nom(o.pid, o.nombre)} <span class="muted peq">${o.pos ? `${o.pos}º` : ''}</span></td><td class="peq">${banderaLiga(o.de)} → ${banderaLiga(o.a)} ${celdaEquipo(d, o.eq)}</td><td>${nom(o.tactico, o.nombreTactico)} <span class="insignia">Táctico</span></td><td class="der">${dinero(o.importe)}</td><td class="ancho peq muted">${o.humano ? 'Oferta de mánager' : 'Decidido por la liga'}</td></tr>`).join('')}
      </tbody></table></div>` : vacio('Sin traspasos.')}
      <p class="muted peq" style="margin:10px 0 0">La escudería que pierde a su Galáctico recibe al Táctico del comprador y el importe.</p>
    </section>
    <div class="rejilla rejilla-2">
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Despidos</h2><span>${m.plan.despidos.length}</span></div>
        ${m.plan.despidos.map(x => `<div class="declaracion"><div class="meta">${banderaLiga(x.liga, { ancho: 12 })} ${esc(d.nombreEquipo(x.eq))} · ${x.motivo === 'directo' ? 'despido directo' : 'zona de peligro'}</div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º con su compañero ${x.posComp}º.</p></div>`).join('') || vacio('Sin despidos.')}
      </section>
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Salvan el asiento</h2><span>${m.plan.salvados?.length || 0}</span></div>
        ${(m.plan.salvados || []).map(x => `<div class="declaracion"><div class="meta">${banderaLiga(x.liga, { ancho: 12 })} ${esc(d.nombreEquipo(x.eq))}</div><p><b>${esc(x.nombre || d.nombre(x.pid))}</b>: ${x.pos}º, pero su compañero acabó ${x.posComp}º. El coche no daba para más.</p></div>`).join('') || vacio('Nadie.')}
      </section>
    </div>
    <section class="tarjeta" style="margin-top:42px"><div class="tarjeta-titulo"><h2>Draft de rookies</h2><span>${(m.vacantes || []).length} vacantes</span></div>
      ${m.elegidos?.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${m.elegidos.map(x => `<tr><td>${celdaEquipo(d, x.eq)}</td><td>${d.piloto(x.rookie) ? celdaPiloto(d, x.rookie) : esc(x.nombre)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <p class="etiqueta" style="margin-top:14px">Orden de elección (peor escudería primero)</p>
      <ol style="columns:2;font-size:13px;padding-left:18px">${(m.vacantes || []).map(v => `<li>${esc(d.nombreEquipo(v.eq))}</li>`).join('')}</ol>
    </section>`;
    if (misVacantes.length && abierto) activarDraft();
}

function draftUI(vacantes) {
    const liga = vacantes[0].liga;
    const pref = m.preferencias?.[miEq] || [];
    const companero = Object.entries(d.cat.pilotos).find(([, p]) => p.equipoId === miEq);
    const debeLocal = !companero || companero[1].nac !== NAC_LOCAL[liga];
    const rookies = m.rookies.filter(r => r.liga === liga);
    return `<section class="tarjeta" style="margin-bottom:42px"><div class="tarjeta-titulo"><h2>Tu draft</h2><span>${vacantes.length} vacante${vacantes.length > 1 ? 's' : ''}</span></div>
      <p class="muted">Ordena tus favoritos. Al cerrar el draft se te asigna el primero de tu lista que siga libre.${debeLocal ? ` Debe ser ${esc(LIGAS[liga].gentilicio)} para el asiento de Piloto 1.` : ''}</p>
      <div class="campo-fila">${[0, 1, 2, 3, 4].map(i => `<label>Opción ${i + 1}<select data-pref="${i}"><option value="">—</option>${rookies.map(r => `<option value="${esc(r.id)}" ${pref[i] === r.id ? 'selected' : ''} ${debeLocal && r.nac !== NAC_LOCAL[liga] ? 'disabled' : ''}>${esc(r.nombre)} ${esc(r.apellido)} (${r.nac.toUpperCase()}, ${r.edad}) ${'★'.repeat(r.estrellas)}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="fila-botones"><button class="btn" id="guardar-draft">Guardar preferencias</button></div></section>`;
}

function activarDraft() {
    $('#guardar-draft').addEventListener('click', async () => {
        const lista = $$('[data-pref]').map(s => s.value).filter(Boolean);
        if (new Set(lista).size !== lista.length) return toast('Hay rookies repetidos', 'error');
        try { await encolar('draft', { lista }); toast('Preferencias enviadas'); }
        catch (e) { toast(e.message, 'error'); }
    });
}
