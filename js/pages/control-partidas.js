// Control (solo superadmin): todas las partidas de amigos y el registro de errores (web y worker)
import { store, PARTIDA } from '../core/app.js';
import { esc, vacio, hace, toast, confirmar, banderaLiga, $, $$ } from '../core/ui.js';

const FASES = { pretemporada: 'Pretemporada', nacional: 'Ligas', mundial: 'Mundial', mercado: 'Mercado', cerrada: 'Fin de temporada' };
// En una partida de amigos el almacén lleva prefijo, pero partidas/ y errores/ son globales: se usan igual
const base = () => store();

export async function pintarPartidas(el) {
    el.innerHTML = '<div class="cargando"><span class="spinner"></span>Cargando…</div>';
    const [partidas, usuarios] = await Promise.all([base().list('partidas'), base().list('usuarios')]);
    const nombre = (uid) => usuarios.find(x => x.id === uid)?.nombre || uid?.slice(0, 6) || '—';
    const orden = partidas.sort((a, b) => (b.ultimoCiclo || b.creada || 0) - (a.ultimoCiclo || a.creada || 0));
    const activas = orden.filter(p => p.estado === 'activa');
    const enPartidas = new Set(usuarios.filter(x => x.partidas?.length).map(x => x.id));
    el.innerHTML = `
    <div class="mercado-kpis">
      <div><b>${activas.length}</b><span>partidas activas</span></div>
      <div><b>${activas.reduce((s, p) => s + (p.miembros || 0), 0)}</b><span>mánagers en partidas</span></div>
      <div><b>${usuarios.length}</b><span>cuentas</span></div>
      <div><b>${enPartidas.size}</b><span>cuentas en alguna partida</span></div>
      <div><b>${orden.filter(p => p.creada > Date.now() - 7 * 864e5).length}</b><span>creadas esta semana</span></div>
    </div>
    ${PARTIDA ? `<div class="aviso-caja" style="margin-bottom:12px">Ahora mismo Control está trabajando sobre la partida <b>${esc(PARTIDA)}</b>. <a href="control.html?p=0">Volver a la original</a></div>` : ''}
    <section class="tarjeta"><div class="tarjeta-titulo"><h2>Partidas</h2><span>${orden.length}</span></div>
      ${orden.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Partida</th><th>Creador</th><th>Ligas</th><th class="cen">Mánagers</th><th>Estado</th><th>Último ciclo</th><th></th></tr></thead><tbody>
      ${orden.map(p => `<tr><td><b>${esc(p.nombre)}</b><div class="muted peq mono">${esc(p.id)}${p.publica ? ' · abierta' : ''}</div></td><td class="peq">${esc(nombre(p.creador))}</td>
        <td>${(p.ajustes?.ligas || []).map(l => banderaLiga(l, { ancho: 14 })).join(' ')}${p.ajustes?.mundial ? ' <span class="muted peq">+M</span>' : ''}</td>
        <td class="cen num">${p.miembros || 0}</td>
        <td class="peq">${p.estado === 'activa' ? `T${p.temporada || 1} · ${FASES[p.fase] || p.fase || ''}` : `<span class="${p.estado === 'error' || p.estado === 'rechazada' ? 'mal' : 'muted'}">${esc(p.estado)}</span>${p.motivo ? `<div class="muted">${esc(p.motivo)}</div>` : ''}`}</td>
        <td class="peq">${p.ultimoCiclo ? hace(p.ultimoCiclo) : '—'}</td>
        <td class="der"><span class="fila" style="justify-content:flex-end">${p.estado === 'activa' ? `<a class="btn btn-peq" href="index.html?p=${esc(p.id)}">Ver</a><a class="btn btn-sec btn-peq" href="control.html?p=${esc(p.id)}">Controlar</a>` : ''}
          ${p.estado === 'activa' ? `<button class="btn btn-sec btn-peq" data-archivar="${esc(p.id)}">Archivar</button>` : p.estado === 'archivada' ? `<button class="btn btn-sec btn-peq" data-reactivar="${esc(p.id)}">Reactivar</button>` : ''}</span></td></tr>`).join('')}
      </tbody></table></div>` : vacio('Todavía nadie ha creado una partida.')}
      <p class="muted peq" style="margin:10px 0 0">«Controlar» abre este panel completo sobre esa partida (calendario, parrilla, temporada, simulador…). Sus mánagers no tienen nada de esto: solo la gestión ligera de su admin.</p>
    </section>`;
    $$('[data-archivar]', el).forEach(b => b.addEventListener('click', async () => {
        if (!await confirmar('¿Archivar esta partida? Deja de jugarse.', { peligro: true })) return;
        await base().merge(`partidas/${b.dataset.archivar}`, { estado: 'archivada', archivada: Date.now() }); toast('Archivada'); pintarPartidas(el);
    }));
    $$('[data-reactivar]', el).forEach(b => b.addEventListener('click', async () => { await base().merge(`partidas/${b.dataset.reactivar}`, { estado: 'activa' }); toast('Reactivada'); pintarPartidas(el); }));
}

export async function pintarErrores(el) {
    el.innerHTML = '<div class="cargando"><span class="spinner"></span>Cargando…</div>';
    const lista = await base().list('errores', [], { orden: ['t', 'desc'], limit: 150 }).catch(() => []);
    const porTexto = {};
    for (const e of lista) { const k = `${e.origen}|${String(e.texto).slice(0, 120)}`; (porTexto[k] ||= { ...e, n: 0, partidas: new Set() }).n++; porTexto[k].partidas.add(e.partida || 'principal'); }
    const grupos = Object.values(porTexto).sort((a, b) => b.t - a.t);
    el.innerHTML = `<section class="tarjeta"><div class="tarjeta-titulo"><h2>Errores recientes</h2><span>${lista.length}</span></div>
      <p class="muted peq">Los de la web los manda el navegador de quien juega (como mucho 5 por visita); los del worker, cada ciclo que falla. Se agrupan los repetidos.</p>
      ${grupos.length ? grupos.map(g => `<div style="padding:9px 0;border-top:1px solid var(--hair2)">
        <div class="fila-entre"><span><span class="insignia ${g.origen === 'web' ? '' : 'peligro'}">${esc(g.origen)}</span> <span class="muted peq">${[...g.partidas].map(esc).join(', ')}${g.url ? ` · ${esc(g.url)}` : ''}</span></span><span class="muted peq">${g.n > 1 ? `×${g.n} · ` : ''}${hace(g.t)}</span></div>
        <pre class="mono peq" style="white-space:pre-wrap;margin:6px 0 0;max-height:160px;overflow:auto">${esc(g.texto)}</pre></div>`).join('') : vacio('Sin errores. ¡Bien!')}
      ${lista.length ? '<div class="fila-botones"><button class="btn btn-sec btn-peq" id="limpiar-errores">Borrar todos</button></div>' : ''}</section>`;
    $('#limpiar-errores', el)?.addEventListener('click', async () => {
        if (!await confirmar('¿Borrar el registro de errores?')) return;
        await base().batch(lista.map(e => ({ op: 'del', path: `errores/${e.id}` }))); toast('Registro vacío'); pintarErrores(el);
    });
}
