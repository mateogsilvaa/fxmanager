// Control → Uso: tiempo de juego de cada persona, páginas y pestañas donde más se está, horas punta y un
// calendario de actividad (mapa de calor por días). Sale de usuarios/{uid}.uso, que va sumando cada navegador
// (minutos con la pestaña visible): dias.AAAA-MM-DD, horas.H, semana.D_H (día de la semana × hora),
// paginas.pagina-pestaña y total.
import { esc, hace, vacio, $, $$ } from '../core/ui.js';
import { diaMadrid } from '../engine/constants.js';

const PAGINAS = {
    index: 'Inicio', inicio: 'Inicio', escuderia: 'Mi escudería', sombra: 'Modo sombra', liga: 'Ligas', mercado: 'Mercado', estadisticas: 'Estadísticas',
    piloto: 'Ficha de piloto', equipo: 'Ficha de escudería', sesion: 'Sesión en directo', cronica: 'Crónicas', paddock: 'Paddock', manager: 'Mánagers',
    reglamento: 'Cómo funciona', control: 'Control', laboratorio: 'Laboratorio', entrar: 'Entrar',
};
const PESTANAS = { hoy: 'Hoy', carrera: 'Carrera', coche: 'Coche', equipo: 'Equipo', rivales: 'Rivales' };
export function nombrePagina(k) {
    const [base, ...resto] = String(k).split('-');
    const tab = resto.join('-');
    return `${PAGINAS[base] || base}${tab ? ` · ${PESTANAS[tab] || tab}` : ''}`;
}
export const minutos = (m) => { m = Math.round(m || 0); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const sumar = (o) => Object.values(o || {}).reduce((s, v) => s + (+v || 0), 0);
const diaMenos = (n) => diaMadrid(Date.now() - n * 864e5);

// Intensidad de un valor en 5 escalones de una sola tinta (el acento de la web)
const nivel = (v, max) => !v ? 0 : max <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));

function resumenPersona(u) {
    const uso = u.uso || {};
    const dias = uso.dias || {};
    const d7 = diaMenos(6), d30 = diaMenos(29);
    const de = (desde) => Object.entries(dias).filter(([k]) => k >= desde);
    const activos30 = de(d30).filter(([, v]) => v > 0).length;
    const m30 = sumar(Object.fromEntries(de(d30)));
    const pag = Object.entries(uso.paginas || {}).sort((a, b) => b[1] - a[1]);
    return {
        id: u.id, nombre: u.nombre || u.email || u.id.slice(0, 6), equipoId: u.equipoId, ultimo: u.ultimoAcceso || null,
        total: uso.total || sumar(dias), m7: sumar(Object.fromEntries(de(d7))), m30, activos30, media: activos30 ? m30 / activos30 : 0,
        favorita: pag[0]?.[0] || null, uso,
    };
}

// Junta el uso de varias personas (o devuelve el de una)
function combinar(lista) {
    const out = { dias: {}, horas: {}, semana: {}, paginas: {} };
    for (const p of lista) for (const k of Object.keys(out)) for (const [c, v] of Object.entries(p.uso[k] || {})) out[k][c] = (out[k][c] || 0) + (+v || 0);
    return out;
}

function calendarioHtml(dias) {
    // 26 semanas hasta hoy, columnas = semanas (lunes arriba)
    const hoy = new Date(`${diaMadrid()}T12:00:00Z`);
    const dow = (hoy.getUTCDay() + 6) % 7;
    const inicio = new Date(hoy.getTime() - (25 * 7 + dow) * 864e5);
    const celdas = [];
    for (let i = 0; i < 26 * 7; i++) {
        const f = new Date(inicio.getTime() + i * 864e5);
        if (f > hoy) break;
        celdas.push(f.toISOString().slice(0, 10));
    }
    const max = Math.max(1, ...celdas.map(c => dias[c] || 0));
    const meses = [];
    celdas.forEach((c, i) => { if (i % 7 === 0 && (i === 0 || c.slice(8) <= '07')) meses.push({ col: Math.floor(i / 7), txt: new Date(`${c}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'short' }) }); });
    const activos = celdas.filter(c => dias[c] > 0).length;
    return `<div class="cal-envoltura"><div class="cal-meses" style="grid-template-columns:repeat(${Math.ceil(celdas.length / 7)}, 1fr)">${meses.map(m => `<span style="grid-column:${m.col + 1}">${esc(m.txt)}</span>`).join('')}</div>
      <div class="cal-cuerpo"><div class="cal-dias"><span>Lun</span><span></span><span>Mié</span><span></span><span>Vie</span><span></span><span>Dom</span></div>
      <div class="cal">${celdas.map(c => `<i class="n${nivel(dias[c], max)}" data-tip="${esc(new Date(`${c}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}: ${dias[c] ? minutos(dias[c]) : 'sin actividad'}"></i>`).join('')}</div></div>
      <div class="cal-pie"><span class="muted peq">${activos} días con actividad en 6 meses</span><span class="cal-leyenda">Menos ${[0, 1, 2, 3, 4].map(n => `<i class="n${n}"></i>`).join('')} Más</span></div></div>`;
}

function semanaHtml(semana) {
    const max = Math.max(1, ...Object.values(semana));
    return `<div class="semana"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="sem-h">${h % 3 === 0 ? h : ''}</span>`).join('')}
      ${ORDEN_SEMANA.map(dw => `<span class="sem-d">${DIAS[dw]}</span>${Array.from({ length: 24 }, (_, h) => { const v = semana[`${dw}_${h}`] || 0; return `<i class="n${nivel(v, max)}" data-tip="${DIAS[dw]} ${h}:00–${h + 1}:00 · ${minutos(v)}"></i>`; }).join('')}`).join('')}</div>`;
}

function barrasHtml(pares, { total }) {
    if (!pares.length) return vacio('Todavía no hay datos.');
    const max = Math.max(...pares.map(p => p[1]));
    return `<div class="barras-uso">${pares.map(([k, v]) => `<div class="bu" data-tip="${esc(nombrePagina(k))}: ${minutos(v)} (${Math.round(v / total * 100)}%)"><span class="bu-n">${esc(nombrePagina(k))}</span><span class="bu-b"><i style="width:${Math.max(2, v / max * 100)}%"></i></span><b>${minutos(v)}</b></div>`).join('')}</div>`;
}

function horasHtml(horas) {
    const max = Math.max(1, ...Object.values(horas));
    return `<div class="horas-uso">${Array.from({ length: 24 }, (_, h) => { const v = horas[h] || 0; return `<div class="hu" data-tip="${h}:00–${h + 1}:00 · ${minutos(v)}"><i style="height:${v ? Math.max(3, v / max * 100) : 0}%"></i><span>${h % 3 === 0 ? h : ''}</span></div>`; }).join('')}</div>`;
}

export function pintarUso(el, usuarios, d) {
    const personas = usuarios.map(resumenPersona).filter(p => p.total > 0 || p.ultimo).sort((a, b) => b.m30 - a.m30 || b.total - a.total);
    let sel = '';
    const hoy = diaMadrid();
    const pintar = () => {
        const lista = sel ? personas.filter(p => p.id === sel) : personas;
        const uso = combinar(lista);
        const total = sumar(uso.paginas) || 1;
        const activosHoy = personas.filter(p => (p.uso.dias || {})[hoy] > 0).length;
        const activos7 = personas.filter(p => p.m7 > 0).length, activos30 = personas.filter(p => p.m30 > 0).length;
        const m30 = lista.reduce((s, p) => s + p.m30, 0);
        const pags = Object.entries(uso.paginas).sort((a, b) => b[1] - a[1]).slice(0, 14);
        el.innerHTML = `
        <div class="fila-entre" style="margin-bottom:16px;flex-wrap:wrap;gap:10px"><p class="muted peq" style="margin:0;max-width:620px">Minutos con la web abierta y visible. Las páginas y pestañas se registran desde esta versión; el tiempo por día y por hora viene de antes.</p>
          <label style="min-width:220px">Ver<select id="uso-quien"><option value="">Todas las personas</option>${personas.map(p => `<option value="${esc(p.id)}" ${sel === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label></div>
        <div class="tarjeta" style="margin-bottom:14px"><div class="datos datos-4">
          ${sel ? `<div class="dato"><b>${minutos(lista[0]?.total)}</b><span>Tiempo total</span></div><div class="dato"><b>${minutos(lista[0]?.m7)}</b><span>Últimos 7 días</span></div><div class="dato"><b>${lista[0]?.activos30 || 0}</b><span>Días activos (30)</span></div><div class="dato"><b>${minutos(lista[0]?.media)}</b><span>Media por día activo</span></div>`
            : `<div class="dato"><b>${activosHoy}</b><span>Activos hoy</span></div><div class="dato"><b>${activos7}</b><span>Activos 7 días</span></div><div class="dato"><b>${activos30}</b><span>Activos 30 días</span></div><div class="dato"><b>${minutos(m30)}</b><span>Tiempo en 30 días</span></div>`}
        </div></div>
        <div class="tarjeta" style="margin-bottom:14px"><div class="tarjeta-titulo"><h2>Calendario de actividad</h2><span>${sel ? esc(lista[0]?.nombre) : 'todas las personas'}</span></div>${calendarioHtml(uso.dias)}</div>
        <div class="rejilla rejilla-2" style="margin-bottom:14px;align-items:start">
          <div class="tarjeta"><div class="tarjeta-titulo"><h2>Dónde pasan el tiempo</h2><span>páginas y pestañas</span></div>${barrasHtml(pags, { total })}</div>
          <div class="pila">
            <div class="tarjeta"><div class="tarjeta-titulo"><h2>Horas punta</h2><span>hora de Madrid</span></div>${horasHtml(uso.horas)}</div>
            <div class="tarjeta"><div class="tarjeta-titulo"><h2>Semana × hora</h2></div>${Object.keys(uso.semana).length ? semanaHtml(uso.semana) : vacio('Se empieza a registrar desde esta versión.')}</div>
          </div>
        </div>
        <div class="tarjeta"><div class="tarjeta-titulo"><h2>Por persona</h2><span>${personas.length}</span></div>
          ${personas.length ? `<div class="tabla-scroll"><table class="tabla tabla-uso"><thead><tr><th>Persona</th><th class="der">Total</th><th class="der">7 días</th><th class="der">30 días</th><th class="der">Días activos (30)</th><th class="der">Media/día</th><th>Lo que más usa</th><th>Última visita</th></tr></thead><tbody>
          ${personas.map(p => `<tr data-persona="${esc(p.id)}" class="${sel === p.id ? 'sel' : ''}"><td><b>${esc(p.nombre)}</b>${p.equipoId ? `<div class="muted peq">${esc(d.nombreEquipo(p.equipoId))}</div>` : ''}</td><td class="der num">${minutos(p.total)}</td><td class="der num">${minutos(p.m7)}</td><td class="der num">${minutos(p.m30)}</td><td class="der num">${p.activos30}</td><td class="der num">${minutos(p.media)}</td><td class="peq">${p.favorita ? esc(nombrePagina(p.favorita)) : '<span class="tenue">—</span>'}</td><td class="peq">${p.ultimo ? hace(p.ultimo) : '<span class="tenue">—</span>'}</td></tr>`).join('')}
          </tbody></table></div><p class="muted peq" style="margin:8px 0 0">Toca una fila para ver solo a esa persona.</p>` : vacio('Nadie ha usado la web todavía con esta versión.')}</div>
        <div class="tip-uso" id="tip-uso" hidden></div>`;
        $('#uso-quien', el).addEventListener('change', (e) => { sel = e.target.value; pintar(); });
        $$('[data-persona]', el).forEach(tr => tr.addEventListener('click', () => { sel = sel === tr.dataset.persona ? '' : tr.dataset.persona; pintar(); el.scrollIntoView({ behavior: 'smooth' }); }));
    };
    // Tooltip al pasar por encima de cualquier celda o barra
    el.addEventListener('pointerover', (e) => {
            const tip = $('#tip-uso', el);
            if (!tip) return;
            const t = e.target.closest('[data-tip]');
            if (!t) { tip.hidden = true; return; }
            tip.textContent = t.dataset.tip; tip.hidden = false;
            const r = t.getBoundingClientRect();
            tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
            tip.style.top = `${r.top - tip.offsetHeight - 6}px`;
        });
    el.addEventListener('pointerleave', () => { const tip = $('#tip-uso', el); if (tip) tip.hidden = true; });
    pintar();
}
