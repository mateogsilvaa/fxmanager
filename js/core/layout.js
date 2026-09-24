// Cabecera, navegación (arriba en escritorio, abajo en móvil) y pie
import { iniciar, usuario, esAdmin, salir, DEMO, store, escucharConsulta } from './app.js';
import { LIGAS, LIGAS_NACIONALES, SESION_INFO } from '../engine/constants.js';
import { esc, banderaLiga, $, activarCuentas } from './ui.js';

const ICONOS = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    ligas: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
    equipo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5.5M5.2 15.5l4.6-2.3M18.8 15.5l-4.6-2.3"/>',
    stats: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H3"/>',
    mas: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
};
const icono = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`;

export async function montar({ activo = '', liga = null } = {}) {
    await iniciar();
    pintarCabecera(activo, liga);
    pintarPie();
    activarCuentas();
    return usuario();
}

function pintarCabecera(activo, ligaActiva) {
    const u = usuario();
    const cab = document.getElementById('cabecera') || document.body.insertBefore(document.createElement('header'), document.body.firstChild);
    cab.id = 'cabecera';
    const a = (href, txt, clave, extra = '') => `<a href="${href}" class="${activo === clave ? 'activo' : ''}" ${extra}>${txt}</a>`;
    cab.innerHTML = `
    ${DEMO ? `<div class="aviso-demo">Modo demostración · nada se guarda · <a href="index.html?demo=0">salir</a></div>` : ''}
    <div class="barra-directo" id="barra-directo" hidden></div>
    <nav class="nav">
      <a class="marca" href="index.html"><span class="marca-x">X1</span><span>Hyper Race</span></a>
      <div class="nav-enlaces">
        ${a(`liga.html?l=${ligaActiva || 'ESP'}`, 'Ligas', '', ligaActiva ? 'data-liga-activa' : '')}
        ${a('mercado.html', 'Mercado', 'mercado')}
        ${a('estadisticas.html', 'Estadísticas', 'estadisticas')}
        ${a('reglamento.html', 'Cómo funciona', 'reglamento')}
        <span class="nav-sep"></span>
        ${u ? `${esAdmin() ? a('control.html', 'Control', 'control') : ''}
          <button id="btn-salir" title="Cerrar sesión">Salir</button>
          <a href="escuderia.html" class="btn btn-nav">Mi escudería<span class="punto" data-punto hidden></span></a>`
        : `<a href="entrar.html" class="btn btn-nav">Entrar</a>`}
      </div>
      <div class="nav-cuenta">${u ? '' : '<a href="entrar.html" class="btn btn-peq">Entrar</a>'}</div>
    </nav>`;
    cab.querySelector('[data-liga-activa]')?.classList.add('activo');
    $('#btn-salir', cab)?.addEventListener('click', () => salir());

    // Barra inferior en móvil
    const movil = document.createElement('nav');
    movil.className = 'nav-movil';
    const enLiga = activo === '' && ligaActiva;
    movil.innerHTML = `
      <a href="index.html" class="${activo === 'inicio' ? 'activo' : ''}">${icono('inicio')}Inicio</a>
      <a href="liga.html?l=${ligaActiva || 'ESP'}" class="${enLiga ? 'activo' : ''}">${icono('ligas')}Ligas</a>
      <a href="${u ? 'escuderia.html' : 'entrar.html'}" class="${activo === 'escuderia' ? 'activo' : ''}">${icono('equipo')}Escudería<span class="punto" data-punto hidden></span></a>
      <a href="estadisticas.html" class="${activo === 'estadisticas' ? 'activo' : ''}">${icono('stats')}Stats</a>
      <button type="button" class="${['paddock', 'mercado', 'reglamento', 'control'].includes(activo) ? 'activo' : ''}">${icono('mas')}Más</button>`;
    document.body.appendChild(movil);
    movil.querySelector('button').addEventListener('click', () => {
        const hoja = document.createElement('div');
        hoja.className = 'hoja-mas';
        hoja.innerHTML = `<div>
          <a href="mercado.html">Mercado</a><a href="paddock.html">Paddock</a><a href="reglamento.html">Cómo funciona</a>
          ${u && esAdmin() ? '<a href="control.html">Control</a>' : ''}
          ${u ? `<button data-salir>Cerrar sesión (${esc(u.perfil?.nombre || u.email)})</button>` : '<a href="entrar.html">Entrar o registrarse</a>'}
        </div>`;
        hoja.addEventListener('click', (e) => { if (e.target === hoja) hoja.remove(); });
        hoja.querySelector('[data-salir]')?.addEventListener('click', () => salir());
        document.body.appendChild(hoja);
    });
    if (u?.perfil?.equipoId) vigilarPendientes(u);
}

// Punto en "Mi escudería" si hay notificaciones sin leer
function vigilarPendientes(u) {
    try {
        escucharConsulta('notificaciones', [['uid', '==', u.uid], ['leida', '==', false]], (lista) => {
            document.querySelectorAll('[data-punto]').forEach(p => { p.hidden = !lista.length; });
        });
    } catch { }
}

export function barraDirecto(datos) {
    const el = document.getElementById('barra-directo');
    if (!el) return;
    const vivos = datos.vivos || [];
    if (!vivos.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = vivos.slice(0, 3).map(v => `<a href="sesion.html?id=${esc(v.sid)}"><span class="en-vivo">En directo</span> ${banderaLiga(v.ev.liga, { ancho: 16 })} ${esc(SESION_INFO[v.tipo].nombre)} · ${esc(v.ev.circuito?.nombre || '')}</a>`).join('');
}

// Selector de liga (chips con bandera) para la cabecera de páginas de liga
export function selectorLigas(activa) {
    return `<div class="selector-ligas">${[...LIGAS_NACIONALES, 'INT'].map(l => `<a href="liga.html?l=${l}" class="${l === activa ? 'activo' : ''}">${banderaLiga(l, { ancho: 18, titulo: false })}${esc(l === 'INT' ? 'Mundial' : LIGAS[l].nombre)}</a>`).join('')}</div>`;
}

function pintarPie() {
    if (document.getElementById('pie')) return;
    const pie = document.createElement('footer');
    pie.id = 'pie';
    pie.textContent = 'Hyper Race X1 · FX Manager · BAC Mono · resultados publicados automáticamente a su hora';
    document.body.appendChild(pie);
}

export { store };
