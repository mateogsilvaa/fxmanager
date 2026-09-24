// Retransmisión en directo de una sesión: circuito con los coches, torre de tiempos, rótulos y narración.
// Todo sale de los datos simulados (tiempos por vuelta e incidentes); aquí solo se reproducen en el tiempo.
import { esc, bandera } from './ui.js';
import { ahora } from './app.js';
import { SESION_INFO, esCarrera } from '../engine/constants.js';
import { formatoTiempo } from '../engine/sim.js';
import { crearRng, hash32 } from '../engine/rng.js';
import { TRAZADOS } from '../engine/trazados.js';

const LUCES_MS = 5200;       // duración de la secuencia de semáforos
const COLA_MS = 9000;        // tiempo tras la bandera a cuadros
const FILA = 30;             // alto de fila de la torre (px)

// ---------------------------------------------------------------- Circuito
// Trazado real del circuito; si es un circuito personalizado sin trazado, se genera una silueta
function trazado(id) {
    if (TRAZADOS[id]) return TRAZADOS[id];
    const rng = crearRng(`pista|${id}`);
    const n = 9 + rng.int(0, 4);
    const cx = 300, cy = 185, pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.18, 0.18);
        const r = rng.range(0.55, 1);
        pts.push([cx + Math.cos(a) * 250 * r, cy + Math.sin(a) * 140 * r]);
    }
    // Catmull-Rom cerrado → curvas Bézier
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
}

function colorTexto(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'var(--bg)';
    const v = parseInt(m[1], 16);
    const l = (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    return l > 0.6 ? 'var(--ink)' : 'var(--bg)';
}

// ---------------------------------------------------------------- Modelo temporal
function modeloCarrera(r) {
    const coches = r.filas.map(f => {
        const c = [((f.parrilla || 1) - 1) * 250];
        f.laps.forEach(t => c.push(c[c.length - 1] + t));
        const media = f.laps.length ? f.laps.reduce((s, t) => s + t, 0) / f.laps.length : 100000;
        return { f, c, media, fin: f.estado === 'FIN', retiro: f.estado === 'DNF' ? c[c.length - 1] + media * 0.45 : null };
    });
    const n = SESION_INFO[r.tipo].vueltas;
    const tFin = Math.max(...coches.filter(x => x.fin).map(x => x.c[x.c.length - 1]), 1);
    return { coches, n, tFin };
}

function progresoCarrera(x, T) {
    const c = x.c, laps = x.f.laps;
    if (x.retiro != null && T >= x.retiro) return { p: laps.length + 0.45, fuera: true };
    if (T >= c[c.length - 1]) return { p: laps.length, acabado: x.fin };
    let k = 0;
    while (k < laps.length && c[k + 1] <= T) k++;
    return { p: k + Math.max(0, (T - c[k]) / laps[k]), vuelta: k };
}

function modeloSesion(r) {
    const tSes = (SESION_INFO[r.tipo].minutos || 15) * 60_000;
    const coches = r.filas.map(f => {
        const abs = f.laps.map(t => Math.abs(t));
        const ref = abs.length ? Math.min(...abs) : 100000;
        const salida = (hash32(`sal|${r.eventoId}|${r.tipo}|${f.pid}`) % 1000) / 1000 * tSes * 0.3;
        const c = [salida, salida + ref * 1.12]; // vuelta de lanzamiento
        abs.forEach(t => c.push(c[c.length - 1] + t));
        return { f, c, abs, ref };
    });
    return { coches, tSes };
}

function progresoSesion(x, T) {
    const c = x.c;
    if (T < c[0]) return { p: null };
    if (T >= c[c.length - 1]) return { p: null, dentro: true };
    let k = 0;
    while (k < c.length - 1 && c[k + 1] <= T) k++;
    const dur = c[k + 1] - c[k];
    return { p: k + (T - c[k]) / dur, vuelta: k };
}

// ---------------------------------------------------------------- Narración
const frase = (rng, lista) => lista[Math.floor(rng.next() * lista.length)];

function eventosCarrera(r, modelo, d) {
    const rng = crearRng(`narr|${r.eventoId}|${r.tipo}`);
    const ap = (pid) => d.apellido(pid);
    const porPid = Object.fromEntries(modelo.coches.map(x => [x.f.pid, x]));
    const tEn = (pid, v, frac = 0.5) => { const x = porPid[pid]; const k = Math.max(0, Math.min(v - 1, x.f.laps.length - 1)); return x.c[k] + frac * (x.f.laps[k] || x.media); };
    const out = [];
    for (const e of r.eventos || []) {
        if (e.tipo === 'adelantamiento') out.push({ t: tEn(e.pid, e.v, 0.6), tipo: 'adel', pid: e.pid, pid2: e.pid2, txt: frase(rng, [`${ap(e.pid)} adelanta a ${ap(e.pid2)}`, `¡Adelantamiento! ${ap(e.pid)} se pone por delante de ${ap(e.pid2)}`, `${ap(e.pid)} se tira por dentro y supera a ${ap(e.pid2)}`, `${ap(e.pid2)} no puede defenderse de ${ap(e.pid)}`]) });
        else if (e.tipo === 'abandono') out.push({ t: porPid[e.pid]?.retiro ?? tEn(e.pid, e.v), tipo: 'aband', pid: e.pid, fuerte: true, txt: `Abandono de ${ap(e.pid)}${e.motivo ? `: ${e.motivo.toLowerCase()}` : ''}` });
        else if (e.tipo === 'error') out.push({ t: tEn(e.pid, e.v, 0.4), tipo: 'err', pid: e.pid, txt: frase(rng, [`${ap(e.pid)} se va largo y pierde ${(e.ms / 1000).toFixed(1)} s`, `Error de ${ap(e.pid)}: trompo y ${(e.ms / 1000).toFixed(1)} s perdidos`, `${ap(e.pid)} pisa la grava`]) });
        else if (e.tipo === 'toque') out.push({ t: tEn(e.pid, e.v, 0.5), tipo: 'err', pid: e.pid, txt: e.pid2 ? `Toque entre ${ap(e.pid)} y ${ap(e.pid2)}${e.perjudicado ? `; sale perdiendo ${ap(e.perjudicado)}` : ''}` : `${ap(e.pid)} se toca en la salida` });
    }
    // Vueltas rápidas a medida que se completan
    const vueltas = [];
    modelo.coches.forEach(x => x.f.laps.forEach((t, i) => { if (i > 0) vueltas.push({ t: x.c[i + 1], pid: x.f.pid, lap: t }); }));
    vueltas.sort((a, b) => a.t - b.t);
    let mejor = Infinity;
    for (const v of vueltas) if (v.lap < mejor) {
        mejor = v.lap;
        if (v.t > modelo.coches[0].c[2] * 0.9) out.push({ t: v.t, tipo: 'vr', pid: v.pid, txt: `Vuelta rápida de ${ap(v.pid)}: ${formatoTiempo(v.lap)}` });
    }
    return out.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------- Montaje
export function montarDirecto(cont, { r, ses, ev, d, miEq, repeticion = false, alFinal }) {
    const tipo = r.tipo, info = SESION_INFO[tipo];
    const carrera = esCarrera(tipo);
    const duracion = Math.max(30_000, (ses.revealAt - ses.publishAt));
    const color = (eq) => d.equipo(eq)?.color || '#8b8e94';
    const modelo = carrera ? modeloCarrera(r) : modeloSesion(r);
    const eventos = carrera ? eventosCarrera(r, modelo, d) : [];
    const pathD = trazado(ev.circuito?.id || ev.id);

    cont.innerHTML = `
    <div class="directo">
      <div class="directo-cab">
        <div><span class="en-vivo">${repeticion ? 'Repetición' : 'En directo'}</span><div class="directo-estado" id="d-estado">—</div></div>
        <div class="directo-controles">${repeticion ? '<div class="seg" id="d-vel"><button data-v="1" class="activa">×1</button><button data-v="2">×2</button><button data-v="4">×4</button></div>' : ''}<button class="btn btn-sec btn-peq" id="d-final">Resultado final</button></div>
      </div>
      <div class="directo-barra"><div id="d-barra"></div></div>
      <div class="directo-grid">
        <div class="pista">
          <svg viewBox="0 0 600 370" id="d-svg" aria-label="Circuito con la posición de los coches">
            <path d="${pathD}" class="pista-borde"/><path d="${pathD}" class="pista-asfalto" id="d-path"/><path d="${pathD}" class="pista-linea"/>
            <g id="d-meta"></g><g id="d-coches"></g>
          </svg>
          <div class="rotulo" id="d-rotulo" hidden></div>
          ${carrera ? `<div class="luces" id="d-luces">${'<i></i>'.repeat(5)}</div>` : ''}
        </div>
        <div class="torre-viva-caja"><div class="torre-viva-cab"><span>Pos</span><span>Piloto</span><span>${carrera ? 'Dif.' : 'Mejor'}</span></div><div class="torre-viva" id="d-torre" style="height:${r.filas.length * FILA}px"></div></div>
      </div>
      <div class="directo-narracion" id="d-feed"></div>
    </div>`;

    const svgPath = cont.querySelector('#d-path');
    const L = svgPath.getTotalLength();
    const punto = (frac) => svgPath.getPointAtLength(((frac % 1) + 1) % 1 * L);
    // Línea de meta
    const p0 = punto(0), p1 = punto(0.004);
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI + 90;
    cont.querySelector('#d-meta').innerHTML = `<rect x="${(p0.x - 11).toFixed(1)}" y="${(p0.y - 2).toFixed(1)}" width="22" height="4" class="pista-meta" transform="rotate(${ang.toFixed(1)} ${p0.x.toFixed(1)} ${p0.y.toFixed(1)})"/>`;

    // Coches y filas de la torre (se crean una vez y se mueven)
    const gCoches = cont.querySelector('#d-coches');
    const torre = cont.querySelector('#d-torre');
    const nodos = {};
    for (const x of modelo.coches) {
        const pid = x.f.pid, pl = d.piloto(pid), col = color(x.f.eq), mio = x.f.eq === miEq;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `coche${mio ? ' mio' : ''}`);
        g.innerHTML = `<circle r="${mio ? 10 : 8.5}" fill="${esc(col)}"/><text text-anchor="middle" dy="3.2" fill="${colorTexto(col)}">${esc(pl?.numero ?? '')}</text>`;
        gCoches.appendChild(g);
        const fila = document.createElement('div');
        fila.className = `tv-fila${mio ? ' mio' : ''}`;
        fila.innerHTML = `<span class="tv-pos"></span><span class="tv-nombre"><i style="background:${esc(col)}"></i>${bandera(pl?.nac, { ancho: 14, titulo: false })}<b>${esc(d.apellido(pid))}</b></span><span class="tv-gap"></span>`;
        torre.appendChild(fila);
        nodos[pid] = { g, fila, pos: fila.querySelector('.tv-pos'), gap: fila.querySelector('.tv-gap') };
    }

    const feed = cont.querySelector('#d-feed');
    const rotulo = cont.querySelector('#d-rotulo');
    let rotuloHasta = 0;
    const mostrarRotulo = (txt, clase = '', ms = 3200) => {
        rotulo.className = `rotulo ${clase}`;
        rotulo.textContent = txt;
        rotulo.hidden = false;
        rotuloHasta = performance.now() + ms;
    };
    const narrar = (txt, clase = '') => {
        const div = document.createElement('div');
        div.className = clase;
        div.innerHTML = `<span class="mono">${esc(cont.querySelector('#d-estado').textContent)}</span> ${esc(txt)}`;
        feed.prepend(div);
        while (feed.children.length > 60) feed.lastChild.remove();
    };

    // Reloj: en directo sigue la hora real; en repetición avanza con la velocidad elegida
    let velocidad = 1, acumulado = 0, marca = performance.now(), terminado = false, parado = false;
    const inicioReal = ses.publishAt;
    const transcurrido = () => repeticion ? acumulado + (performance.now() - marca) * velocidad : ahora() - inicioReal;
    cont.querySelector('#d-vel')?.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        acumulado = transcurrido(); marca = performance.now(); velocidad = +b.dataset.v;
        cont.querySelectorAll('#d-vel button').forEach(x => x.classList.toggle('activa', x === b));
    }));
    cont.querySelector('#d-final').addEventListener('click', () => { parado = true; alFinal?.(); });

    let ultimoOrden = [], lider = null, idxEvento = 0, avisoUltima = false, avisoFin = false, ultimaTorre = 0, luzEncendida = -1;
    const mejorSes = { t: Infinity, pid: null }, mejores = {}, vueltasVistas = {};

    function frame() {
        if (parado) return;
        const e = transcurrido();
        const ahoraPerf = performance.now();
        if (rotuloHasta && ahoraPerf > rotuloHasta) { rotulo.hidden = true; rotuloHasta = 0; }
        let filas;
        if (carrera) {
            // Semáforos
            const luces = cont.querySelector('#d-luces');
            if (e < LUCES_MS) {
                const n = Math.min(5, Math.floor(e / 800) + 1);
                if (n !== luzEncendida) { luzEncendida = n; luces.querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k < n)); }
                cont.querySelector('#d-estado').textContent = 'Parrilla';
            } else if (luces && !luces.classList.contains('fuera')) {
                luces.classList.add('fuera');
                mostrarRotulo('¡Se apagan los semáforos!', 'rotulo-acento', 2600);
                narrar('¡Se apagan los semáforos y arranca la carrera!', 'acento');
            }
            const frac = Math.max(0, Math.min(1, (e - LUCES_MS) / (duracion - LUCES_MS - COLA_MS)));
            const T = frac * modelo.tFin;
            const estados = modelo.coches.map(x => ({ x, ...progresoCarrera(x, T) }));
            const lid = estados.filter(s => !s.fuera).sort((a, b) => b.p - a.p)[0];
            const vueltaLider = Math.min(modelo.n, Math.floor(lid?.p ?? 0) + 1);
            cont.querySelector('#d-barra').style.width = `${frac * 100}%`;
            if (e >= LUCES_MS) cont.querySelector('#d-estado').textContent = frac >= 1 ? 'Bandera a cuadros' : `Vuelta ${vueltaLider}/${modelo.n}`;
            // Coches en pista
            for (const s of estados) {
                const nd = nodos[s.x.f.pid];
                // Formación de parrilla: separación visual que desaparece durante la primera vuelta
                const hueco = ((s.x.f.parrilla || 1) - 1) * 0.0045 * Math.max(0, 1 - s.p);
                const pt = punto(s.p - hueco);
                nd.g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
                nd.g.classList.toggle('fuera', !!s.fuera);
            }
            // Orden y diferencias
            filas = estados.slice().sort((a, b) => (a.fuera - b.fuera) || (a.fuera ? b.p - a.p : (b.p - a.p)));
            const refLider = filas[0].x;
            const tLider = (p) => { const k = Math.min(Math.floor(p), refLider.f.laps.length - 1); return refLider.c[k] + (p - k) * (refLider.f.laps[k] || refLider.media); };
            filas.forEach((s, i) => {
                if (s.fuera) s.txt = 'OUT';
                else if (i === 0) s.txt = frac >= 1 ? 'Ganador' : `V${vueltaLider}`;
                else if (Math.floor(filas[0].p) - Math.floor(s.p) >= 1 && filas[0].p - s.p >= 1) s.txt = `+${Math.floor(filas[0].p - s.p)} v`;
                else s.txt = `+${Math.max(0, (T - tLider(s.p)) / 1000).toFixed(1)}`;
            });
            // Narración de incidentes
            while (idxEvento < eventos.length && eventos[idxEvento].t <= T && e >= LUCES_MS) {
                const ev2 = eventos[idxEvento++];
                narrar(ev2.txt, ev2.tipo);
                if (ev2.tipo === 'aband') mostrarRotulo(ev2.txt, 'rotulo-rojo');
                else if (ev2.tipo === 'vr') { mostrarRotulo(ev2.txt, 'rotulo-morado', 2400); mejorSes.pid = ev2.pid; }
            }
            // Líder, última vuelta y final
            const nuevoLider = filas[0]?.x.f.pid;
            if (e >= LUCES_MS + 1500 && lider && nuevoLider !== lider && frac < 1) { mostrarRotulo(`${d.apellido(nuevoLider)} pasa a liderar`, 'rotulo-acento'); narrar(`${d.apellido(nuevoLider)} es el nuevo líder`, 'acento'); }
            lider = nuevoLider;
            if (!avisoUltima && vueltaLider === modelo.n && frac < 1 && e > LUCES_MS) { avisoUltima = true; mostrarRotulo('Última vuelta', '', 2400); narrar('¡Última vuelta!'); }
            if (!avisoFin && frac >= 1) {
                avisoFin = true;
                const g = r.filas[0];
                mostrarRotulo(`Bandera a cuadros · gana ${d.apellido(g.pid)}`, 'rotulo-acento', 8000);
                narrar(`Bandera a cuadros: victoria de ${d.nombre(g.pid)} (${d.nombreEquipo(g.eq)})`, 'acento');
            }
        } else {
            // Libres y clasificación
            const frac = Math.max(0, Math.min(1, e / (duracion - COLA_MS)));
            const T = frac * modelo.tSes;
            cont.querySelector('#d-barra').style.width = `${frac * 100}%`;
            const resto = Math.max(0, modelo.tSes - T);
            cont.querySelector('#d-estado').textContent = frac >= 1 ? 'Sesión terminada' : `Quedan ${Math.floor(resto / 60000)}:${String(Math.floor(resto % 60000 / 1000)).padStart(2, '0')}`;
            for (const x of modelo.coches) {
                const s = progresoSesion(x, T);
                const nd = nodos[x.f.pid];
                if (s.p == null) { nd.g.classList.add('fuera'); nd.g.setAttribute('transform', 'translate(-50,-50)'); continue; }
                nd.g.classList.remove('fuera');
                const pt = punto(s.p);
                nd.g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
                // Vueltas completadas (la 0 es la de lanzamiento)
                const hechas = Math.max(0, s.vuelta - 1);
                vueltasVistas[x.f.pid] ??= 0;
                while (vueltasVistas[x.f.pid] < hechas) {
                    const t = x.f.laps[vueltasVistas[x.f.pid]++];
                    if (t < 0) { narrar(`${d.apellido(x.f.pid)}: vuelta anulada`, 'err'); continue; }
                    if (t < (mejores[x.f.pid] ?? Infinity)) {
                        mejores[x.f.pid] = t;
                        if (t < mejorSes.t) {
                            const antes = mejorSes.pid;
                            mejorSes.t = t; mejorSes.pid = x.f.pid;
                            narrar(`${d.apellido(x.f.pid)} se pone primero: ${formatoTiempo(t)}`, 'vr');
                            if (antes) mostrarRotulo(`${d.apellido(x.f.pid)} P1 · ${formatoTiempo(t)}`, 'rotulo-morado', 2600);
                        } else narrar(`${d.apellido(x.f.pid)} mejora: ${formatoTiempo(t)}`, 'adel');
                    }
                }
            }
            if (frac >= 1) {
                for (const x of modelo.coches) x.f.laps.forEach(t => { if (t > 0 && t < (mejores[x.f.pid] ?? Infinity)) mejores[x.f.pid] = t; });
                if (!avisoFin) { avisoFin = true; const p = r.filas[0]; mostrarRotulo(tipo === 'FP' ? `Fin de los libres · ${d.apellido(p.pid)} el más rápido` : `Pole para ${d.apellido(p.pid)}`, 'rotulo-acento', 8000); narrar(tipo === 'FP' ? `Fin de la sesión: ${d.nombre(p.pid)} marca el mejor tiempo` : `¡Pole position para ${d.nombre(p.pid)}!`, 'acento'); }
            }
            filas = modelo.coches.map(x => ({ x, best: mejores[x.f.pid] ?? null })).sort((a, b) => (a.best ?? 1e12) - (b.best ?? 1e12));
            const m = filas[0].best;
            filas.forEach((s, i) => { s.txt = s.best == null ? '—' : i === 0 ? formatoTiempo(s.best) : `+${((s.best - m) / 1000).toFixed(3)}`; });
        }
        // Torre (se reordena con animación)
        if (ahoraPerf - ultimaTorre > 250 || !ultimoOrden.length) {
            ultimaTorre = ahoraPerf;
            filas.forEach((s, i) => {
                const nd = nodos[s.x.f.pid];
                nd.fila.style.transform = `translateY(${i * FILA}px)`;
                const antes = ultimoOrden.indexOf(s.x.f.pid);
                if (antes >= 0 && antes !== i) {
                    nd.fila.classList.remove('sube', 'baja'); void nd.fila.offsetWidth;
                    nd.fila.classList.add(antes > i ? 'sube' : 'baja');
                }
                nd.pos.textContent = i + 1;
                nd.gap.textContent = s.txt;
                nd.fila.classList.toggle('fuera', s.txt === 'OUT');
                nd.fila.classList.toggle('vr', mejorSes.pid === s.x.f.pid);
            });
            ultimoOrden = filas.map(s => s.x.f.pid);
        }
        if (e >= duracion && !terminado) { terminado = true; setTimeout(() => { if (!parado) alFinal?.(); }, 2500); return; }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { parar: () => { parado = true; } };
}
