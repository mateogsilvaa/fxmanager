// Piezas de interfaz reutilizadas por varias páginas
import { esc, bandera, banderaLiga, posClase, chipEquipo, fecha, hora, modal, vacio } from './ui.js';
import { SESION_INFO, LIGAS, SESIONES } from '../engine/constants.js';
import { ranking } from '../engine/stats.js';
import { usuario } from './app.js';

export function celdaPiloto(d, pid, { equipo = false, enlace = true } = {}) {
    const p = d.piloto(pid);
    if (!p) return `<span class="muted">Piloto retirado</span>`;
    const eq = d.equipo(p.equipoId);
    const nombre = `<span class="nombre">${esc(p.nombre)} <b>${esc(p.apellido)}</b></span>`;
    return `<div class="piloto-celda">${bandera(p.nac)}${enlace ? `<a href="piloto.html?id=${esc(pid)}">${nombre}</a>` : nombre}${p.rookie ? ' <span class="insignia rookie">Rookie</span>' : ''}${equipo && eq ? ` <span class="muted">·</span> ${chipEquipo(eq, { corto: true })}` : ''}</div>`;
}

export function celdaEquipo(d, eqId, { enlace = true } = {}) {
    const e = d.equipo(eqId);
    if (!e) return '<span class="muted">—</span>';
    const inner = `<span class="chip-equipo" style="color:var(--texto)"><i style="background:${esc(e.color)}"></i>${esc(e.nombre)}</span>`;
    return enlace ? `<a href="equipo.html?id=${esc(eqId)}">${inner}</a>` : inner;
}

export function pos(p) { return `<span class="pos ${posClase(p)}">${p ?? '—'}</span>`; }

export function tablaClasificacionPilotos(d, liga, { limite = null, corteMundial = true, extra = null } = {}) {
    const lista = d.clasificacionPilotos(liga).slice(0, limite || undefined);
    if (!lista.length) return vacio('Aún no hay pilotos en esta liga.');
    const miEq = usuario()?.perfil?.equipoId;
    const proy = liga !== 'INT' ? d.clasificadosMundial() : null;
    const clasif = new Set((proy?.clasificados || []).map(c => c.pid));
    const filas = lista.map((s, i) => {
        const p = d.piloto(s.pid);
        return `<tr class="${p?.equipoId === miEq ? 'yo' : ''} ${corteMundial && liga !== 'INT' && i === 2 ? 'corte' : ''}">
          <td>${pos(i + 1)}</td>
          <td class="dorsal">${p?.numero ?? ''}</td>
          <td>${celdaPiloto(d, s.pid)} ${p?.rol === 'P1' ? '<span class="insignia p1">P1</span>' : ''} ${clasif.has(s.pid) ? '<span class="insignia mundial" title="En zona de Mundial">🌐</span>' : ''}</td>
          <td>${celdaEquipo(d, p?.equipoId || s.eq)}</td>
          <td class="cen num">${s.victorias || 0}</td>
          <td class="cen num">${s.podios || 0}</td>
          <td class="cen num">${s.poles || 0}</td>
          ${extra ? `<td class="cen num">${extra(s) ?? ''}</td>` : ''}
          <td class="pts">${s.pts}</td></tr>`;
    }).join('');
    return `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>#</th><th>Piloto</th><th>Equipo</th><th class="cen" title="Victorias">V</th><th class="cen" title="Podios">Pod</th><th class="cen" title="Poles">Pole</th>${extra ? '<th class="cen">+</th>' : ''}<th class="der">Pts</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

export function tablaClasificacionEquipos(d, liga, { limite = null } = {}) {
    const lista = d.clasificacionEquipos(liga).slice(0, limite || undefined);
    if (!lista.length) return vacio('Sin equipos.');
    const miEq = usuario()?.perfil?.equipoId;
    return `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>Escudería</th><th>Mánager</th><th class="cen">V</th><th class="cen">Dobletes</th><th class="cen">Pod</th><th class="der">Pts</th></tr></thead><tbody>${lista.map((s, i) => {
        const e = d.equipo(s.eq);
        return `<tr class="${s.eq === miEq ? 'yo' : ''}"><td>${pos(i + 1)}</td><td>${celdaEquipo(d, s.eq)} ${e?.grupo ? `<span class="muted" title="Grupo multinacional">· ${esc(e.grupo)}</span>` : ''}</td><td class="muted">${e?.ownerNombre ? esc(e.ownerNombre) : '<span class="tenue">IA</span>'}</td><td class="cen num">${s.victorias || 0}</td><td class="cen num">${s.dobletes || 0}</td><td class="cen num">${s.podios || 0}</td><td class="pts">${s.pts}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

export function filaSesion(d, s) {
    const estado = d.estadoSesion(s);
    const txt = { abierta: 'Estrategia abierta', cerrada: 'Estrategias cerradas', directo: 'EN DIRECTO', final: 'Resultados' }[estado];
    const pub = d.sesionPublicada(s.sid);
    let detalle = `<span class="muted">${fecha(s.publishAt)}</span>`;
    if (estado === 'final' && pub?.filas?.[0]) detalle = `${celdaPiloto(d, pub.filas[0].pid, { enlace: false })}`;
    else if (estado === 'final') detalle = `<span class="muted">Procesando…</span>`;
    const enlace = estado === 'directo' || estado === 'final';
    const tag = enlace ? 'a' : 'div';
    return `<${tag} class="sesion-fila" ${enlace ? `href="sesion.html?id=${esc(s.sid)}"` : ''}><b>${esc(SESION_INFO[s.tipo].corto)}</b>${detalle}<span class="estado ${estado}">${estado === 'abierta' ? `Cierra en <span data-cuenta="${s.lockAt}"></span>` : txt}</span></${tag}>`;
}

export function tarjetaEvento(d, ev, { mostrarLiga = false } = {}) {
    const sesiones = SESIONES.filter(t => ev.sesiones?.[t]).map(t => ({ sid: `${ev.id}_${t}`, tipo: t, evId: ev.id, ev, ...ev.sesiones[t] }));
    const inicio = sesiones[0]?.publishAt;
    const terminado = sesiones.every(s => d.estadoSesion(s) === 'final');
    return `<div class="tarjeta evento-tarjeta ${!terminado && sesiones.some(s => d.estadoSesion(s) !== 'final') && sesiones.some(s => ['directo', 'abierta', 'cerrada'].includes(d.estadoSesion(s))) ? 'resaltada' : ''}">
      <div class="evento-cab"><span class="ronda-num">R${ev.ronda}</span>
        <div style="min-width:0"><div class="fila">${bandera(ev.circuito?.pais)} <b>${esc(ev.circuito?.nombre || 'Circuito por definir')}</b></div>
        <div class="muted" style="font-size:.85rem">${mostrarLiga ? `${banderaLiga(ev.liga, { ancho: 16 })} ${esc(LIGAS[ev.liga]?.nombre)} · ` : ''}${inicio ? fecha(inicio, { hour: undefined, minute: undefined }) : ''}${ev.circuito?.km ? ` · ${ev.circuito.km} km` : ''}</div></div>
      </div>
      <div class="sesiones-lista">${sesiones.map(s => filaSesion(d, s)).join('')}</div>
      ${terminado ? `<a class="btn btn-sec btn-peq" href="cronica.html?ev=${esc(ev.id)}">📰 Leer la crónica</a>` : ''}
    </div>`;
}

export function listaNoticias(noticias, { liga = false } = {}) {
    if (!noticias.length) return vacio('Todavía no hay noticias.', '📰');
    return noticias.map(n => `<div class="noticia"><h4>${n.tipo === 'rumor' ? '🗣️ ' : n.tipo === 'mercado' ? '🔁 ' : n.tipo === 'cronica' ? '📰 ' : n.tipo === 'fase' ? '🏁 ' : ''}${esc(n.titulo)}</h4>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}<div class="meta">${liga && n.liga ? `${banderaLiga(n.liga, { ancho: 14 })} ` : ''}${fecha(n.publishAt)}</div></div>`).join('');
}

// Tarjetas de récords: al pulsar se abre el ranking completo
export function tarjetasRecords(d, categorias, lista, { tipo = 'piloto' } = {}) {
    return categorias.map(c => {
        const r = ranking(c, lista).slice(0, 3);
        if (!r.length) return '';
        return `<div class="tarjeta record-tarjeta" data-cat="${esc(c.id)}" tabindex="0" role="button">
          <div class="etiqueta">${c.bueno ? '' : '⚠️ '}${esc(c.nombre)}</div>
          <div class="top">${r.map(x => `<div><span>${x.pos}. ${esc(tipo === 'piloto' ? d.nombre(x.x.pid) : d.nombreEquipo(x.x.eq))}</span><span class="num">${fmtValor(x.v)}${c.sufijo || ''}</span></div>`).join('')}</div>
          <div class="ver">Ver ranking completo →</div></div>`;
    }).join('');
}

export function activarRecords(root, d, categorias, lista, { tipo = 'piloto', titulo = '' } = {}) {
    root.querySelectorAll('.record-tarjeta').forEach(el => {
        const abrir = () => {
            const c = categorias.find(x => x.id === el.dataset.cat);
            const r = ranking(c, lista);
            modal(`<h2>${esc(c.nombre)}</h2>${titulo ? `<p class="muted">${esc(titulo)}</p>` : ''}${c.desc ? `<p class="muted">${esc(c.desc)}</p>` : ''}
              <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pos</th><th>${tipo === 'piloto' ? 'Piloto' : 'Escudería'}</th>${tipo === 'piloto' ? '<th>Equipo</th>' : ''}<th class="der">Valor</th></tr></thead><tbody>
              ${r.map(x => `<tr><td>${pos(x.pos)}</td><td>${tipo === 'piloto' ? celdaPiloto(d, x.x.pid) : celdaEquipo(d, x.x.eq)}</td>${tipo === 'piloto' ? `<td>${celdaEquipo(d, d.piloto(x.x.pid)?.equipoId || x.x.eq)}</td>` : ''}<td class="pts">${fmtValor(x.v)}${c.sufijo || ''}</td></tr>`).join('')}
              </tbody></table></div>`, { ancho: 720 });
        };
        el.addEventListener('click', abrir);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') abrir(); });
    });
}

export function fmtValor(v) { return typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1).replace('.', ',') : v; }

export function tiempoSesionTexto(s) { return `${SESION_INFO[s.tipo]?.nombre} · ${hora(s.publishAt)}`; }
