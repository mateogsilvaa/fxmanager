// Cabecera, navegación y pie comunes
import { iniciar, usuario, esAdmin, salir, DEMO, store, escucharConsulta } from './app.js';
import { LIGAS, LIGAS_NACIONALES, SESION_INFO } from '../engine/constants.js';
import { esc, banderaLiga, $, activarCuentas } from './ui.js';

export async function montar({ activo = '', liga = null } = {}) {
    await iniciar();
    pintarCabecera(activo, liga);
    pintarPie();
    activarCuentas();
    if (liga && LIGAS[liga]) document.documentElement.style.setProperty('--acento', LIGAS[liga].color);
    return usuario();
}

function pintarCabecera(activo, ligaActiva) {
    const u = usuario();
    const cab = document.getElementById('cabecera') || document.body.insertBefore(document.createElement('header'), document.body.firstChild);
    cab.id = 'cabecera';
    const ligas = [...LIGAS_NACIONALES, 'INT'].map(l => `<a href="liga.html?l=${l}" class="${ligaActiva === l ? 'activo' : ''}">${banderaLiga(l, { ancho: 22 })}<span>${esc(LIGAS[l].nombre)}</span></a>`).join('');
    cab.innerHTML = `
    ${DEMO ? `<div class="aviso-demo">Modo demostración: datos simulados, nada se guarda. <a href="index.html?demo=0">Salir del modo demo</a></div>` : ''}
    <div class="barra-directo" id="barra-directo" hidden></div>
    <nav class="nav">
      <a class="marca" href="index.html"><span class="marca-x">X1</span><span class="marca-txt"><b>HYPER RACE</b><small>FX Manager</small></span></a>
      <button class="nav-menu" aria-label="Menú" aria-expanded="false"><span></span><span></span><span></span></button>
      <div class="nav-enlaces">
        <a href="index.html" class="${activo === 'inicio' ? 'activo' : ''}">Inicio</a>
        <div class="nav-ligas">${ligas}</div>
        <a href="estadisticas.html" class="${activo === 'estadisticas' ? 'activo' : ''}">Estadísticas</a>
        <a href="pronosticos.html" class="${activo === 'pronosticos' ? 'activo' : ''}">Pronósticos</a>
        <a href="mercado.html" class="${activo === 'mercado' ? 'activo' : ''}">Mercado</a>
        <a href="reglamento.html" class="${activo === 'reglamento' ? 'activo' : ''}">Reglamento</a>
        <span class="nav-sep"></span>
        ${u ? `
          <a href="escuderia.html" class="nav-escuderia ${activo === 'escuderia' ? 'activo' : ''}">🏎️ Mi escudería <span class="punto" id="nav-punto" hidden></span></a>
          ${esAdmin() ? `<a href="control.html" class="${activo === 'control' ? 'activo' : ''}" title="Control">⚙️</a>` : ''}
          <button class="nav-salir" id="btn-salir" title="Cerrar sesión">${esc(u.perfil?.nombre || u.email)} · Salir</button>
        ` : `<a href="entrar.html" class="btn btn-nav">Entrar</a>`}
      </div>
    </nav>`;
    const btn = $('.nav-menu', cab), enl = $('.nav-enlaces', cab);
    btn.addEventListener('click', () => { const a = enl.classList.toggle('abierto'); btn.setAttribute('aria-expanded', a); });
    $('#btn-salir', cab)?.addEventListener('click', () => salir());
    if (u?.perfil?.equipoId) vigilarPendientes(u);
}

// Punto rojo en "Mi escudería" si hay decisión del día sin responder o notificaciones sin leer
function vigilarPendientes(u) {
    try {
        escucharConsulta('notificaciones', [['uid', '==', u.uid], ['leida', '==', false]], (lista) => {
            const p = document.getElementById('nav-punto');
            if (p) p.hidden = !lista.length;
        });
    } catch { }
}

export function barraDirecto(datos) {
    const el = document.getElementById('barra-directo');
    if (!el) return;
    const vivos = datos.vivos || [];
    if (!vivos.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = vivos.slice(0, 3).map(v => `<a href="sesion.html?id=${esc(v.sid)}"><span class="en-vivo">EN DIRECTO</span> ${banderaLiga(v.ev.liga, { ancho: 18 })} ${esc(SESION_INFO[v.tipo].nombre)} · ${esc(v.ev.circuito?.nombre || '')}</a>`).join('');
}

function pintarPie() {
    if (document.getElementById('pie')) return;
    const pie = document.createElement('footer');
    pie.id = 'pie';
    pie.innerHTML = `<div><b>Hyper Race X1</b> · Campeonato Global · BAC Mono (580 kg · 304 bhp · sin ayudas)</div><div class="muted">FX Manager · Las sesiones se simulan y publican automáticamente a su hora.</div>`;
    document.body.appendChild(pie);
}

export { store };
