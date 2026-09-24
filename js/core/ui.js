// Utilidades de interfaz
import { PAISES, LIGAS } from '../engine/constants.js';
import { ahora } from './app.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function bandera(nac, { ancho = 20, titulo = true } = {}) {
    if (!nac) return '';
    const n = String(nac).toLowerCase();
    const alto = Math.round(ancho * 0.75);
    return `<img class="bandera" src="https://flagcdn.com/w40/${esc(n)}.png" srcset="https://flagcdn.com/w80/${esc(n)}.png 2x" width="${ancho}" height="${alto}" alt="${esc(PAISES[n] || n.toUpperCase())}" ${titulo ? `title="${esc(PAISES[n] || n.toUpperCase())}"` : ''} loading="lazy">`;
}

export function banderaLiga(liga, opts) {
    if (liga === 'INT') return `<span class="bandera-int" title="Intercontinental">🌐</span>`;
    return bandera(LIGAS[liga]?.pais, opts);
}

export function dinero(v, { signo = false } = {}) {
    if (v == null) return '—';
    const abs = Math.abs(v);
    const s = abs >= 1e6 ? `${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2).replace('.', ',')} M€` : `${Math.round(abs / 1000)} k€`;
    return (v < 0 ? '−' : signo ? '+' : '') + s;
}

export function fecha(ms, opts = {}) {
    if (!ms) return '—';
    return new Date(ms).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...opts });
}
export function fechaCorta(ms) { return fecha(ms, { weekday: undefined, hour: undefined, minute: undefined }); }
export function hora(ms) { return new Date(ms).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }); }

export function cuentaAtras(ms) {
    let d = ms - ahora();
    if (d <= 0) return 'ya';
    const dias = Math.floor(d / 864e5); d -= dias * 864e5;
    const h = Math.floor(d / 36e5); d -= h * 36e5;
    const m = Math.floor(d / 6e4); d -= m * 6e4;
    const s = Math.floor(d / 1e3);
    if (dias > 0) return `${dias}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
}
export function hace(ms) {
    const d = ahora() - ms;
    if (d < 60e3) return 'ahora mismo';
    if (d < 36e5) return `hace ${Math.round(d / 6e4)} min`;
    if (d < 864e5) return `hace ${Math.round(d / 36e5)} h`;
    return `hace ${Math.round(d / 864e5)} d`;
}

// Actualiza cada segundo los elementos [data-cuenta="ms"]
let relojActivo = false;
export function activarCuentas() {
    if (relojActivo) return;
    relojActivo = true;
    setInterval(() => $$('[data-cuenta]').forEach(el => { el.textContent = cuentaAtras(+el.dataset.cuenta); }), 1000);
}

export function toast(msg, tipo = 'ok') {
    let cont = $('#toasts');
    if (!cont) { cont = document.createElement('div'); cont.id = 'toasts'; document.body.appendChild(cont); }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => t.classList.add('fuera'), 3800);
    setTimeout(() => t.remove(), 4300);
}

export function modal(html, { ancho = 640, alCerrar } = {}) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `<div class="modal" style="max-width:${ancho}px" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Cerrar">✕</button><div class="modal-cuerpo">${html}</div></div>`;
    const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', tecla); alCerrar?.(); };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(); });
    fondo.querySelector('.modal-x').addEventListener('click', cerrar);
    document.addEventListener('keydown', tecla);
    document.body.appendChild(fondo);
    return { el: fondo.querySelector('.modal-cuerpo'), cerrar };
}

export function confirmar(texto, { si = 'Confirmar', no = 'Cancelar', peligro = false } = {}) {
    return new Promise(res => {
        const m = modal(`<p class="confirmar-txt">${texto}</p><div class="fila-botones"><button class="btn btn-sec" data-r="0">${esc(no)}</button><button class="btn ${peligro ? 'btn-peligro' : ''}" data-r="1">${esc(si)}</button></div>`, { ancho: 460, alCerrar: () => res(false) });
        m.el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { res(b.dataset.r === '1'); m.cerrar(); }));
    });
}

// Pestañas: contenedor con botones [data-tab] y paneles [data-panel]
export function pestanas(root, { alCambiar, param = 'tab' } = {}) {
    const botones = $$('[data-tab]', root);
    const activar = (id, push = true) => {
        botones.forEach(b => b.classList.toggle('activa', b.dataset.tab === id));
        $$('[data-panel]', root).forEach(p => { p.hidden = p.dataset.panel !== id; });
        if (push) { const u = new URL(location.href); u.searchParams.set(param, id); history.replaceState(null, '', u); }
        alCambiar?.(id);
    };
    botones.forEach(b => b.addEventListener('click', () => activar(b.dataset.tab)));
    const inicial = new URLSearchParams(location.search).get(param);
    activar(botones.some(b => b.dataset.tab === inicial) ? inicial : botones[0]?.dataset.tab, false);
    return activar;
}

export function vacio(texto, icono = '🏁') {
    return `<div class="vacio"><div class="vacio-icono">${icono}</div><p>${texto}</p></div>`;
}

export function cargando(el, texto = 'Cargando…') { if (el) el.innerHTML = `<div class="cargando"><span class="spinner"></span>${esc(texto)}</div>`; }

export function posClase(pos) { return pos === 1 ? 'oro' : pos === 2 ? 'plata' : pos === 3 ? 'bronce' : ''; }

export function barra(valor, max = 100, color) {
    const pct = Math.max(0, Math.min(100, (valor / max) * 100));
    return `<div class="barra"><div class="barra-relleno" style="width:${pct}%;${color ? `background:${color}` : ''}"></div></div>`;
}

export function chipEquipo(eq, { corto = false } = {}) {
    if (!eq) return '<span class="muted">—</span>';
    return `<span class="chip-equipo"><i style="background:${esc(eq.color)}"></i>${esc(corto ? eq.corto || eq.nombre : eq.nombre)}</span>`;
}
