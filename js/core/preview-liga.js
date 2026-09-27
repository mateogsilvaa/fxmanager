// Vista previa de una liga (portada y pestaña Resumen) y pilotos destacados del Mundial
import { esc, bandera, banderaLiga, fecha, hace, cuentaAtras } from './ui.js';
import { managerDe } from './componentes.js';
import { LIGAS, LIGAS_NACIONALES, SESIONES, SESION_INFO } from '../engine/constants.js';
import { ahora } from './app.js';

const nombreLiga = (l) => l === 'INT' ? 'Liga Intercontinental' : LIGAS[l].nombre;
// Nombre de circuito sin el prefijo genérico: «Circuito del Jarama» → «Jarama»
const circuitoCorto = (n) => {
    const entre = (n || '').match(/\(([^)]+)\)/)?.[1];
    if (entre && entre !== 'Moto' && entre !== 'Madrid') return entre;
    return (n || '').replace(/^Circuit of the /i, '').replace(/^(Circuit(o)?|Autodromo|Autódromo)( Nazionale| Internacional| Internazionale)?( de la| del| de| do| dell'| dell’| dei)? /i, '');
};
const corto = (s, n) => s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : (s || '');

// Estado del calendario de una liga: jornadas jugadas, la actual/próxima y su siguiente sesión
export function estadoLiga(d, liga) {
    const eventos = d.eventosLiga(liga);
    const t = ahora();
    const sesiones = (ev) => SESIONES.filter(x => ev.sesiones?.[x]).map(x => ({ tipo: x, ...ev.sesiones[x] }));
    const terminada = (ev) => sesiones(ev).every(s => s.revealAt <= t);
    const empezada = (ev) => sesiones(ev).some(s => s.publishAt <= t);
    const jugadas = eventos.filter(terminada).length;
    const actual = eventos.find(ev => !terminada(ev)) || null;
    const siguiente = actual ? sesiones(actual).find(s => s.publishAt > t) || null : null;
    return { eventos, total: eventos.length, jugadas, actual, enCurso: actual ? empezada(actual) : false, siguiente, terminada: eventos.length > 0 && !actual };
}

// Sesión de un evento que se está emitiendo ahora mismo (o null)
function sesionEnDirecto(ev) {
    const t = ahora();
    const tipo = SESIONES.find(x => ev.sesiones?.[x] && ev.sesiones[x].publishAt <= t && ev.sesiones[x].revealAt > t);
    return tipo ? { tipo, ...ev.sesiones[tipo] } : null;
}

// Tira superior con las cinco ligas y la cuenta atrás de cada una
export function tiraLigas(d, { ancla = true } = {}) {
    return `<nav class="tira-ligas" aria-label="Ligas">${LIGAS_NACIONALES.map(l => {
        const e = estadoLiga(d, l);
        const directo = e.actual && sesionEnDirecto(e.actual);
        const pie = directo ? '<span class="tira-cuenta en-vivo-txt">En directo</span>' : e.siguiente ? `<span class="tira-cuenta mono" data-cuenta="${e.siguiente.publishAt}" data-corta>${cuentaAtras(e.siguiente.publishAt, true)}</span>`
            : e.terminada ? '<span class="tira-cuenta muted">Terminada</span>' : '<span class="tira-cuenta muted">Sin fecha</span>';
        return `<a class="tira-liga" href="${ancla ? `#liga-${l}` : `liga.html?l=${l}`}">
          <span class="tira-nombre">${banderaLiga(l, { ancho: 18, titulo: false })}${esc(LIGAS[l].nombre)}</span>
          <span class="tira-ronda">${e.total ? `J${Math.min(e.total, e.jugadas + (e.actual ? 1 : 0))} de ${e.total}` : '—'}</span>
          ${pie}</a>`;
    }).join('')}</nav>`;
}

// Bloque completo de una liga: próxima jornada, recorrido, top 5, top 3 escuderías y última noticia
export function bloqueLiga(d, liga, noticias, { enlace = true, titulo = true } = {}) {
    const e = estadoLiga(d, liga);
    const clasP = d.clasificacionPilotos(liga);
    const clasE = d.clasificacionEquipos(liga);
    const empezo = clasP.some(p => p.pts > 0);
    const noticia = noticias.find(n => n.liga === liga);
    const ev = e.actual;
    const max = Math.max(1, clasP[0]?.pts || 0);
    const vivo = ev ? sesionEnDirecto(ev) : null;

    const cabeceraProxima = ev ? `<div class="lb-proxima">
        <div class="etiqueta">${e.enCurso ? `Jornada ${ev.ronda} · en curso` : `Próxima jornada · J${ev.ronda}`}</div>
        <div class="lb-circuito">${bandera(ev.circuito?.pais, { ancho: 18 })} ${esc(ev.circuito?.nombre || '')}</div>
        ${vivo ? `<a class="lb-directo" href="sesion.html?id=${esc(ev.id)}_${vivo.tipo}">${esc(SESION_INFO[vivo.tipo].nombre)} en directo →</a>`
        : e.siguiente ? `<div class="muted peq">${esc(SESION_INFO[e.siguiente.tipo].nombre)} · ${fecha(e.siguiente.publishAt)}</div>
        <div class="cuenta lb-cuenta" data-cuenta="${e.siguiente.publishAt}">${cuentaAtras(e.siguiente.publishAt)}</div>` : '<div class="muted peq">Publicando resultados…</div>'}
      </div>` : `<div class="lb-proxima"><div class="etiqueta">${e.terminada ? 'Liga terminada' : 'Calendario'}</div><div class="lb-circuito">${e.terminada ? `Campeón: ${esc(d.nombre(clasP[0]?.pid))}` : 'Aún sin jornadas'}</div></div>`;

    const rondas = e.total ? `<ol class="rondas">${e.eventos.map((x, i) => {
        const estado = i < e.jugadas ? 'hecha' : x === ev ? 'actual' : 'pendiente';
        return `<li class="ronda ${estado}"><span class="ronda-barra"></span><span class="ronda-txt"><b>J${x.ronda}</b> ${esc(corto(circuitoCorto(x.circuito?.nombre), 18))}</span></li>`;
    }).join('')}</ol>` : '';

    const top5 = `<div class="lb-col">
        <h3 class="lb-sub">${empezo ? 'Top 5 pilotos' : 'Pilotos'}</h3>
        ${clasP.slice(0, 5).map((p, i) => {
            const pil = d.piloto(p.pid), eq = d.equipo(p.eq || pil?.equipoId);
            return `<a class="lb-piloto" href="piloto.html?id=${esc(p.pid)}">
              <span class="lb-pos mono">${i + 1}</span>
              <span class="lb-quien">${bandera(pil?.nac, { ancho: 16 })}<b>${esc(pil?.nombre || '')} ${esc(pil?.apellido || '')}</b><span class="lb-eq"><i style="background:${esc(eq?.color || '#999')}"></i>${esc(eq?.corto || eq?.nombre || '')}</span></span>
              <span class="lb-pts mono">${p.pts}</span>
              ${empezo ? `<span class="lb-barra"><span style="width:${Math.round(p.pts / max * 100)}%;background:${esc(eq?.color || 'var(--ink)')}"></span></span>` : ''}
            </a>`;
        }).join('')}
      </div>`;

    const top3 = `<div class="lb-col">
        <h3 class="lb-sub">${empezo ? 'Top 3 escuderías' : 'Escuderías'}</h3>
        ${clasE.slice(0, 3).map((x, i) => {
            const eq = d.equipo(x.eq);
            return `<a class="lb-equipo" href="equipo.html?id=${esc(x.eq)}" style="--c:${esc(eq?.color || '#999')}">
              <span class="lb-pos-grande">${i + 1}</span>
              <span><b>${esc(eq?.nombre || '')}</b><span class="muted peq">${managerDe(eq)}</span></span>
              <span class="lb-pts mono">${x.pts}<small>pts</small></span></a>`;
        }).join('')}
      </div>`;

    const news = `<div class="lb-col lb-noticia">
        <h3 class="lb-sub">Última noticia</h3>
        ${noticia ? `<article><div class="muted peq">${hace(noticia.publishAt)}</div><h4>${esc(noticia.titulo)}</h4>${noticia.texto ? `<p>${esc(corto(noticia.texto, 190))}</p>` : ''}</article>` : '<p class="muted">Todavía no hay noticias de esta liga.</p>'}
      </div>`;

    return `<section class="liga-bloque${titulo ? "" : " sin-titulo"}" id="liga-${liga}">
      <header class="lb-cab">
        ${titulo ? `<div class="lb-titulo">${banderaLiga(liga, { ancho: 44, titulo: false })}<div>
          <div class="etiqueta">${liga === 'INT' ? 'Fase final' : 'Liga nacional'} · ${e.total ? `${e.jugadas} de ${e.total} jornadas jugadas` : 'sin calendario'}</div>
          <h2>${esc(nombreLiga(liga))}</h2></div></div>` : ''}
        ${cabeceraProxima}
      </header>
      ${rondas}
      <div class="lb-cuerpo">${top5}${top3}${news}</div>
      ${enlace ? `<a class="lb-mas" href="liga.html?l=${liga}">${esc(liga === 'INT' ? 'Ver el Mundial completo' : `Ver la liga de ${LIGAS[liga].nombre} completa`)} →</a>` : ''}
    </section>`;
}

// Pilotos destacados del Mundial y por qué lo son
export function destacadosMundial(d, n = 6) {
    const participantes = d.cfg.mundial?.participantes || [];
    if (!participantes.length) return [];
    const intP = d.clasificacionPilotos('INT');
    const posInt = Object.fromEntries(intP.map(p => [p.pid, p]));
    const clasif = Object.fromEntries((d.cfg.mundial?.clasificados || []).map(c => [c.pid, c]));
    const hayInt = intP.some(p => p.pts > 0);
    const out = participantes.map(pid => {
        const pil = d.piloto(pid);
        const c = clasif[pid] || {};
        const liga = c.liga || pil?.liga;
        const nat = liga && LIGAS[liga] ? d.tabla(liga).clasPilotos.find(x => x.pid === pid) : null;
        const pI = posInt[pid];
        const motivos = [];
        let score = 0;
        if (hayInt && pI?.posicion === 1) { motivos.push(`Lidera el Mundial con ${pI.pts} puntos`); score += 200; }
        if (pI?.victorias) { motivos.push(`${pI.victorias} victoria${pI.victorias > 1 ? 's' : ''} en el Mundial`); score += 40 * pI.victorias; }
        const posLiga = c.posLiga || nat?.posicion;
        if (posLiga === 1) { motivos.push(`Campeón de ${LIGAS[liga].nombre}`); score += 90; }
        else if (posLiga && posLiga <= 3) { motivos.push(`${posLiga}º en ${LIGAS[liga].nombre}`); score += 45; }
        if (nat?.victorias >= 2) { motivos.push(`${nat.victorias} victorias en su liga`); score += 10 * nat.victorias; }
        if (nat?.poles >= 2) { motivos.push(`${nat.poles} poles`); score += 4 * nat.poles; }
        if (c.via === 'repesca') { motivos.push('Entró entre los 5 mejores del resto'); score += 5; }
        if (pil?.rookie) { motivos.push('Rookie en su primera temporada'); score += 15; }
        score += (pI?.pts || 0) * 2 + (nat?.pts || 0) * 0.3;
        return { pid, liga, pI, nat, motivos, score };
    }).filter(x => x.motivos.length);
    return out.sort((a, b) => b.score - a.score).slice(0, n);
}

export function tarjetasDestacados(d, lista) {
    return `<div class="destacados">${lista.map((x, i) => {
        const pil = d.piloto(x.pid), eq = d.equipo(pil?.equipoId);
        return `<a class="destacado" href="piloto.html?id=${esc(x.pid)}" style="--c:${esc(eq?.color || '#999')}">
          <div class="destacado-cab"><span class="destacado-n mono">${String(i + 1).padStart(2, '0')}</span>${banderaLiga(x.liga, { ancho: 18 })}</div>
          <div class="destacado-nombre">${bandera(pil?.nac, { ancho: 18 })} <span>${esc(pil?.nombre || '')}</span> <b>${esc(pil?.apellido || '')}</b></div>
          <div class="lb-eq"><i style="background:${esc(eq?.color || '#999')}"></i>${esc(eq?.nombre || '')}</div>
          <p class="destacado-motivo">${esc(x.motivos[0])}</p>
          ${x.motivos.length > 1 ? `<p class="muted peq">${x.motivos.slice(1, 3).map(esc).join(' · ')}</p>` : ''}
          <div class="destacado-datos"><span><b class="mono">${x.pI?.pts ?? 0}</b> pts Mundial</span><span><b class="mono">${x.nat?.pts ?? 0}</b> pts en su liga</span></div>
        </a>`;
    }).join('')}</div>`;
}
