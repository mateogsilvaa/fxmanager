// Llamadas y cartas en pantalla + registro del tiempo de juego (para decidir cada cuánto llaman)
import { usuario, store, escuchar, escucharConsulta, ahora, sumarUso, DEMO } from './app.js';
import { esc, modal, toast } from './ui.js';
import { avatar } from './avatar.js';
import { diaMadrid, horaMadrid } from '../engine/constants.js';
import { QUIEN } from '../engine/llamadas.js';

// ---------- Tiempo de juego ----------
// Cada minuto con la pestaña visible suma 1 al día y a la hora actual; se envía cada 5 minutos o al salir.
const CLAVE_USO = 'fx-uso-pend';
function pendiente() { try { return JSON.parse(localStorage.getItem(CLAVE_USO)) || {}; } catch { return {}; } }
function guardarPendiente(p) { try { localStorage.setItem(CLAVE_USO, JSON.stringify(p)); } catch { } }
async function enviarUso() {
    const p = pendiente();
    if (!Object.keys(p).length) return;
    guardarPendiente({});
    try { await sumarUso(p); } catch { const q = pendiente(); for (const [k, v] of Object.entries(p)) q[k] = (q[k] || 0) + v; guardarPendiente(q); }
}
export function registrarUso() {
    if (DEMO || !usuario()) return;
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        const p = pendiente(), t = ahora();
        const kd = `dias.${diaMadrid(t)}`, kh = `horas.${Math.floor(horaMadrid(t))}`;
        p[kd] = (p[kd] || 0) + 1; p[kh] = (p[kh] || 0) + 1;
        guardarPendiente(p);
    }, 60_000);
    setInterval(enviarUso, 5 * 60_000);
    addEventListener('pagehide', () => { enviarUso(); });
    enviarUso();
}

// ---------- Llamadas ----------
let abierta = false;
export function vigilarLlamadas() {
    const u = usuario();
    if (!u?.perfil?.equipoId) return;
    let temporizador = null;
    escucharConsulta('llamadas', [['uid', '==', u.uid]], (lista) => {
        clearTimeout(temporizador);
        const t = ahora();
        const vivas = lista.filter(l => !l.aplicada && !l.eleccion && l.expira > t && !pospuesta(l.id));
        const ya = vivas.find(l => l.disponible <= t);
        if (ya) return mostrar(ya);
        const prox = vivas.sort((a, b) => a.disponible - b.disponible)[0];
        if (prox) temporizador = setTimeout(() => mostrar(prox), Math.min(prox.disponible - t + 500, 2 ** 31 - 1));
    });
}
const pospuesta = (id) => { try { return sessionStorage.getItem(`fx-llam-${id}`) === '1'; } catch { return false; } };
const posponer = (id) => { try { sessionStorage.setItem(`fx-llam-${id}`, '1'); } catch { } };

function mostrar(l) {
    if (abierta) return;
    abierta = true;
    const p = l.personaje || {};
    const av = avatar({ tipo: p.tipo || 'patrocinador', semilla: p.semilla || l.id, color: p.color || null, tam: 112, titulo: p.nombre });
    const carta = l.formato === 'carta';
    const m = modal(`<div class="llamada ${carta ? 'es-carta' : 'es-llamada'}">
        <div class="llamada-cab">
          <div class="llamada-avatar ${carta ? '' : 'sonando'}">${av}</div>
          <div><div class="etiqueta">${carta ? 'Te ha llegado una carta' : 'Llamada entrante'} · ${esc(QUIEN[l.quien] || '')}</div>
          <h2 style="margin:4px 0 0">${esc(p.nombre || '')}</h2></div>
        </div>
        <div id="ll-cuerpo">
          <div class="fila-botones">${carta ? '<button class="btn btn-sec" data-ll="luego">Luego</button><button class="btn" data-ll="abrir">Abrir la carta</button>'
            : '<button class="btn btn-peligro" data-ll="colgar">Colgar</button><button class="btn btn-ok" data-ll="abrir">Contestar</button>'}</div>
        </div></div>`, { ancho: 520, alCerrar: () => { abierta = false; posponer(l.id); } });
    const cuerpo = m.el.querySelector('#ll-cuerpo');
    const elegir = async (id) => {
        cuerpo.innerHTML = '<div class="cargando"><span class="spinner"></span>…</div>';
        try { await store().update(`llamadas/${l.id}`, { eleccion: id }); }
        catch (e) { toast('No se pudo responder: ' + (e.message || ''), 'error'); m.cerrar(); return; }
        if (id === 'colgar') { m.cerrar(); return; }
        const parar = escuchar(`llamadas/${l.id}`, (doc) => {
            if (!doc?.aplicada) return;
            parar?.();
            cuerpo.innerHTML = `<p class="llamada-resultado">${esc(doc.resultado || '')}</p><div class="fila-botones"><button class="btn" data-ll="fin">Cerrar</button></div>`;
            cuerpo.querySelector('[data-ll="fin"]').addEventListener('click', () => m.cerrar());
        });
    };
    cuerpo.querySelector('[data-ll="luego"]')?.addEventListener('click', () => m.cerrar());
    cuerpo.querySelector('[data-ll="colgar"]')?.addEventListener('click', () => elegir('colgar'));
    cuerpo.querySelector('[data-ll="abrir"]').addEventListener('click', () => {
        m.el.querySelector('.llamada-avatar')?.classList.remove('sonando');
        cuerpo.innerHTML = `<h3 style="margin:0 0 6px">${esc(l.titulo)}</h3><p class="${carta ? 'llamada-carta' : ''}">${esc(l.texto)}</p>
          <div class="llamada-opciones">${l.opciones.map(o => `<button class="btn btn-sec" data-op="${esc(o.id)}">${esc(o.texto)}</button>`).join('')}</div>`;
        cuerpo.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => elegir(b.dataset.op)));
    });
}
