// Llamadas y cartas en pantalla + registro del tiempo de juego (para decidir cada cuánto llaman y para las
// estadísticas de uso del panel de control).
//  · Llamada: pantalla de teléfono que suena (vibra en el móvil), se contesta y la conversación sigue como un chat.
//  · Carta: un sobre lacrado con el color del remitente; al abrirlo sale la carta y se responde con sellos.
//  · Las que dejas para luego quedan en un buzón flotante (abajo a la derecha) hasta que caducan.
import { usuario, store, escuchar, escucharConsulta, ahora, sumarUso, DEMO } from './app.js';
import { esc, modal, toast } from './ui.js';
import { avatar } from './avatar.js';
import { diaMadrid, horaMadrid } from '../engine/constants.js';
import { QUIEN } from '../engine/llamadas.js';

// ---------- Tiempo de juego ----------
// Cada minuto con la pestaña visible suma 1 al día, a la hora, al día de la semana × hora y a la página (y pestaña)
// en la que estás. Se envía cada 5 minutos o al salir.
const CLAVE_USO = 'fx-uso-pend';
function pendiente() { try { return JSON.parse(localStorage.getItem(CLAVE_USO)) || {}; } catch { return {}; } }
function guardarPendiente(p) { try { localStorage.setItem(CLAVE_USO, JSON.stringify(p)); } catch { } }
async function enviarUso() {
    const p = pendiente();
    if (!Object.keys(p).length) return;
    guardarPendiente({});
    try { await sumarUso(p); } catch { const q = pendiente(); for (const [k, v] of Object.entries(p)) q[k] = (q[k] || 0) + v; guardarPendiente(q); }
}
// Página actual (y pestaña activa si la hay): "escuderia-coche", "liga", "control-usuarios"…
export function paginaActual() {
    const base = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
    const tab = document.querySelector('.pestanas [data-tab].activa')?.dataset.tab;
    return String(tab ? `${base}-${tab}` : base).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'index';
}
export function registrarUso() {
    if (DEMO || !usuario()) return;
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        const p = pendiente(), t = ahora();
        const h = Math.floor(horaMadrid(t));
        const dow = new Date(`${diaMadrid(t)}T12:00:00Z`).getUTCDay();
        for (const k of [`dias.${diaMadrid(t)}`, `horas.${h}`, `semana.${dow}_${h}`, `paginas.${paginaActual()}`, 'total']) p[k] = (p[k] || 0) + 1;
        guardarPendiente(p);
    }, 60_000);
    setInterval(enviarUso, 5 * 60_000);
    addEventListener('pagehide', () => { enviarUso(); });
    enviarUso();
}

// ---------- Llamadas ----------
let abierta = false;
let vivas = [];
let temporizador = null;
const oyentes = new Set();
export const onLlamadas = (f) => { oyentes.add(f); f(vivas); return () => oyentes.delete(f); };

const pospuesta = (id) => { try { return sessionStorage.getItem(`fx-llam-${id}`) === '1'; } catch { return false; } };
const posponer = (id) => { try { sessionStorage.setItem(`fx-llam-${id}`, '1'); } catch { } };
const disponible = (l, t = ahora()) => !l.aplicada && !l.eleccion && l.expira > t && l.disponible <= t;

export function vigilarLlamadas() {
    const u = usuario();
    if (!u?.perfil?.equipoId) return;
    escucharConsulta('llamadas', [['uid', '==', u.uid]], (lista) => {
        clearTimeout(temporizador);
        const t = ahora();
        vivas = lista.filter(l => !l.aplicada && !l.eleccion && l.expira > t).sort((a, b) => a.disponible - b.disponible);
        oyentes.forEach(f => f(lista));
        pintarBuzon();
        const ya = vivas.find(l => l.disponible <= t && !pospuesta(l.id));
        if (ya) return mostrar(ya);
        const prox = vivas.find(l => l.disponible > t);
        if (prox) temporizador = setTimeout(() => { if (!pospuesta(prox.id)) mostrar(prox); pintarBuzon(); }, Math.min(prox.disponible - t + 500, 2 ** 31 - 1));
    });
}

// Buzón flotante con las llamadas y cartas que has dejado para luego
function pintarBuzon() {
    let b = document.getElementById('buzon-llamadas');
    const listas = vivas.filter(l => disponible(l));
    if (!listas.length || abierta) { b?.remove(); return; }
    if (!b) {
        b = document.createElement('button');
        b.id = 'buzon-llamadas';
        b.type = 'button';
        b.className = 'buzon';
        b.addEventListener('click', () => { const l = vivas.find(x => disponible(x)); if (l) mostrar(l, { forzar: true }); });
        document.body.appendChild(b);
    }
    const cartas = listas.filter(l => l.formato === 'carta').length, llamadas = listas.length - cartas;
    const l = listas[0];
    b.innerHTML = `<span class="buzon-av">${avatar({ tipo: l.personaje?.tipo || 'patrocinador', semilla: l.personaje?.semilla || l.id, color: l.personaje?.color || null, tam: 34 })}</span>
      <span class="buzon-txt"><b>${llamadas ? `${llamadas} llamada${llamadas > 1 ? 's' : ''} perdida${llamadas > 1 ? 's' : ''}` : ''}${llamadas && cartas ? ' · ' : ''}${cartas ? `${cartas} carta${cartas > 1 ? 's' : ''}` : ''}</b><small>Toca para ${l.formato === 'carta' ? 'leer' : 'devolver la llamada'}</small></span>
      <span class="buzon-n">${listas.length}</span>`;
    b.setAttribute('aria-label', `${listas.length} llamadas o cartas pendientes`);
}

// Abre una llamada o carta concreta (desde Mi escudería)
export async function abrirLlamada(id) {
    const l = vivas.find(x => x.id === id) || await store().get(`llamadas/${id}`);
    if (l && disponible(l)) mostrar(l, { forzar: true });
    else toast('Esa llamada ya no está disponible', 'error');
}

const ICONO_TEL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
const reloj = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Escribe el texto poco a poco (o de golpe si se prefiere sin animaciones)
async function teclear(el, texto) {
    if (reducido()) { el.textContent = texto; return; }
    const paso = Math.max(1, Math.round(texto.length / 60));
    for (let i = 0; i <= texto.length; i += paso) { el.textContent = texto.slice(0, i); await espera(16); }
    el.textContent = texto;
}

function chipsHtml(chips) {
    if (!chips?.length) return '';
    return `<div class="ll-chips">${chips.map(c => `<span class="ll-chip ${c.v > 0 ? 'pos' : c.v < 0 ? 'neg' : ''}">${esc(c.t)}</span>`).join('')}</div>`;
}

// Espera a que el servidor aplique la respuesta; si tarda, avisa de que llegará a Avisos
function esperarResultado(id, alLlegar, alTardar) {
    let hecho = false;
    const parar = escuchar(`llamadas/${id}`, (doc) => {
        if (!doc?.aplicada || hecho) return;
        hecho = true; parar?.(); alLlegar(doc);
    });
    setTimeout(() => { if (!hecho) alTardar(); }, 25_000);
    return () => { hecho = true; parar?.(); };
}

function mostrar(l, { forzar = false } = {}) {
    if (abierta) return;
    if (!forzar && pospuesta(l.id)) return;
    abierta = true;
    document.getElementById('buzon-llamadas')?.remove();
    if (l.formato === 'carta') mostrarCarta(l); else mostrarLlamada(l);
}

const personajeDe = (l) => l.personaje || {};
const avatarDe = (l, tam) => { const p = personajeDe(l); return avatar({ tipo: p.tipo || 'patrocinador', semilla: p.semilla || l.id, color: p.color || null, tam, titulo: p.nombre }); };

async function responder(l, id) {
    await store().update(`llamadas/${l.id}`, { eleccion: id });
}

// ---------- Pantalla de llamada ----------
function mostrarLlamada(l) {
    const p = personajeDe(l);
    let parar = () => { }, cronometro = null, inicio = 0, terminado = false;
    try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { }
    const m = modal(`<div class="tel" style="--tel-color:${esc(p.color || '#b8730b')}">
        <div class="tel-cab">
          <div class="tel-estado" id="tel-estado">Llamada entrante · ${esc(QUIEN[l.quien] || '')}</div>
          <div class="tel-avatar sonando" id="tel-av"><i></i><i></i><span class="tel-cara">${avatarDe(l, 112)}</span></div>
          <h2 class="tel-nombre">${esc(p.nombre || '')}</h2>
          <div class="tel-titulo">${esc(l.titulo || '')}</div>
        </div>
        <div class="tel-chat" id="tel-chat" hidden></div>
        <div class="tel-pie" id="tel-pie">
          <button class="tel-btn colgar" data-ll="colgar" aria-label="Rechazar">${ICONO_TEL}<span>Rechazar</span></button>
          <button class="tel-btn luego" data-ll="luego" aria-label="Luego">⏱<span>Luego</span></button>
          <button class="tel-btn contestar" data-ll="contestar" aria-label="Contestar">${ICONO_TEL}<span>Contestar</span></button>
        </div>
      </div>`, { ancho: 440, alCerrar: () => {
        abierta = false; clearInterval(cronometro); parar();
        try { navigator.vibrate?.(0); } catch { }
        if (!terminado) posponer(l.id);
        pintarBuzon();
    } });
    m.el.parentElement.classList.add('modal-tel');
    const $ = (s) => m.el.querySelector(s);
    const chat = $('#tel-chat'), pie = $('#tel-pie'), estado = $('#tel-estado');
    const burbuja = (quien, html = '') => { const b = document.createElement('div'); b.className = `tel-msg ${quien}`; b.innerHTML = html; chat.appendChild(b); chat.scrollTop = chat.scrollHeight; return b; };
    const escribiendo = () => burbuja('ellos', '<span class="tel-puntos"><i></i><i></i><i></i></span>');
    const colgarFin = (txt = 'Llamada finalizada') => {
        clearInterval(cronometro);
        estado.textContent = `${txt} · ${reloj(ahora() - inicio)}`;
        pie.innerHTML = '<button class="btn" data-ll="fin">Cerrar</button>';
        pie.querySelector('[data-ll="fin"]').addEventListener('click', () => m.cerrar());
    };

    $('[data-ll="luego"]').addEventListener('click', () => m.cerrar());
    $('[data-ll="colgar"]').addEventListener('click', async () => {
        terminado = true;
        try { await responder(l, 'colgar'); } catch (e) { toast('No se pudo colgar: ' + (e.message || ''), 'error'); }
        m.cerrar();
    });
    $('[data-ll="contestar"]').addEventListener('click', async () => {
        try { navigator.vibrate?.(0); } catch { }
        $('#tel-av').classList.remove('sonando');
        m.el.querySelector('.tel').classList.add('en-curso');
        inicio = ahora();
        estado.textContent = '00:00';
        cronometro = setInterval(() => { estado.textContent = reloj(ahora() - inicio); }, 1000);
        chat.hidden = false;
        pie.innerHTML = '';
        const e = escribiendo();
        await espera(reducido() ? 0 : 900);
        e.innerHTML = '<span></span>';
        await teclear(e.firstChild, l.texto);
        const ops = document.createElement('div');
        ops.className = 'tel-opciones';
        ops.innerHTML = l.opciones.map(o => `<button data-op="${esc(o.id)}">${esc(o.texto)}</button>`).join('');
        chat.appendChild(ops);
        chat.scrollTop = chat.scrollHeight;
        ops.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', async () => {
            ops.remove();
            burbuja('yo', esc(b.textContent));
            const pensando = escribiendo();
            terminado = true;
            try { await responder(l, b.dataset.op); }
            catch (err) { pensando.remove(); burbuja('sistema', `No se pudo responder: ${esc(err.message || '')}`); colgarFin('Llamada cortada'); return; }
            parar = esperarResultado(l.id, async (doc) => {
                pensando.innerHTML = '<span></span>';
                await teclear(pensando.firstChild, doc.resultado || '');
                if (doc.chips?.length) pensando.insertAdjacentHTML('beforeend', chipsHtml(doc.chips));
                chat.scrollTop = chat.scrollHeight;
                colgarFin();
            }, () => {
                pensando.innerHTML = 'Te llamo luego con la respuesta.';
                burbuja('sistema', 'Tu respuesta ha quedado registrada. El resultado te llegará a Avisos en cuanto pase el próximo ciclo.');
                colgarFin('Llamada finalizada');
            });
        }));
    });
}

// ---------- Carta ----------
function mostrarCarta(l) {
    const p = personajeDe(l);
    let parar = () => { }, terminado = false;
    const fecha = new Date(l.disponible || ahora()).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long' });
    const m = modal(`<div class="carta" style="--sello:${esc(p.color || '#a8321f')}">
        <div class="carta-cab"><div class="etiqueta">Te ha llegado una carta · ${esc(QUIEN[l.quien] || '')}</div><h2>${esc(p.nombre || '')}</h2></div>
        <div class="sobre" id="sobre">
          <div class="sobre-papel" id="papel">
            <div class="papel-sello">${avatarDe(l, 54)}</div>
            <div class="papel-fecha">${esc(fecha)}</div>
            <h3>${esc(l.titulo || '')}</h3>
            <p class="papel-texto">${esc(l.texto || '')}</p>
            <div class="papel-firma">— ${esc(p.nombre || '')}</div>
            <div id="carta-resp"></div>
          </div>
          <div class="sobre-cuerpo"></div>
          <div class="sobre-solapa"></div>
          <div class="sobre-lacre" aria-hidden="true">${esc((p.nombre || 'X').trim()[0] || 'X')}</div>
        </div>
        <div class="fila-botones" id="carta-pie"><button class="btn btn-sec" data-ll="luego">Luego</button><button class="btn" data-ll="abrir">Abrir la carta</button></div>
      </div>`, { ancho: 520, alCerrar: () => { abierta = false; parar(); if (!terminado) posponer(l.id); pintarBuzon(); } });
    const $ = (s) => m.el.querySelector(s);
    $('[data-ll="luego"]').addEventListener('click', () => m.cerrar());
    $('[data-ll="abrir"]').addEventListener('click', async () => {
        $('#sobre').classList.add('abierto');
        $('#carta-pie').innerHTML = '';
        await espera(reducido() ? 0 : 850);
        const resp = $('#carta-resp');
        resp.innerHTML = `<div class="papel-responder"><span>Responder:</span>${l.opciones.map(o => `<button class="sello-btn" data-op="${esc(o.id)}">${esc(o.texto)}</button>`).join('')}</div>`;
        resp.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', async () => {
            resp.innerHTML = `<div class="papel-enviada"><b>Tu respuesta:</b> ${esc(b.textContent)}<div class="cargando"><span class="spinner"></span>Enviando…</div></div>`;
            terminado = true;
            try { await responder(l, b.dataset.op); }
            catch (err) { resp.innerHTML = `<p class="mal">No se pudo responder: ${esc(err.message || '')}</p>`; return; }
            const fin = () => { $('#carta-pie').innerHTML = '<button class="btn" data-ll="fin">Cerrar</button>'; $('[data-ll="fin"]').addEventListener('click', () => m.cerrar()); };
            parar = esperarResultado(l.id, (doc) => {
                resp.innerHTML = `<div class="papel-enviada"><b>Tu respuesta:</b> ${esc(b.textContent)}</div><div class="papel-resultado"><span class="matasellos">Respondida</span><p>${esc(doc.resultado || '')}</p>${chipsHtml(doc.chips)}</div>`;
                fin();
            }, () => {
                resp.innerHTML = `<div class="papel-enviada"><b>Tu respuesta:</b> ${esc(b.textContent)}</div><p class="muted peq">Enviada. La contestación te llegará a Avisos en cuanto pase el próximo ciclo.</p>`;
                fin();
            });
        }));
    });
}
