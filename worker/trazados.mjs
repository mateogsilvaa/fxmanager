// Genera js/engine/trazados.js con los trazados reales de los circuitos (SVG).
// Fuentes: bacinger/f1-circuits (MIT) y OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Uso: node worker/trazados.mjs <ruta a f1-circuits.geojson>
import { readFileSync, writeFileSync } from 'node:fs';
import { CIRCUITOS } from '../js/engine/circuitos.js';

const F1 = {
    'barcelona-gp': 'es-1991', 'barcelona-moto': 'es-1991', madring: 'es-2026', portimao: 'pt-2008', estoril: 'pt-1972',
    monza: 'it-1922', imola: 'it-1953', mugello: 'it-1914', 'silverstone-gp': 'gb-1948', 'nurburgring-gp': 'de-1927',
    hockenheim: 'de-1932', redbullring: 'at-1969', 'albert-park': 'au-1953', spa: 'be-1925', zandvoort: 'nl-1948',
    cota: 'us-2012', suzuka: 'jp-1962', kyalami: 'za-1961', interlagos: 'br-1940', 'paul-ricard': 'fr-1969',
    hungaroring: 'hu-1986', 'yas-marina': 'ae-2009', 'watkins-glen': 'us-1956',
};
// Circuitos sacados de OpenStreetMap: [lat, lon, radio de búsqueda en m]
const OSM = {
    jarama: [40.617, -3.585, 2500], valencia: [39.486, -0.628, 2500], jerez: [36.709, -6.034, 2500],
    aragon: [41.079, -0.203, 3000], navarra: [42.558, -2.169, 2500], vallelunga: [42.158, 12.370, 2500],
    'vallelunga-club': [42.158, 12.370, 2500], magione: [43.134, 12.236, 2000], misano: [43.962, 12.684, 2500],
    'silverstone-nat': [52.073, -1.015, 3000], 'silverstone-int': [52.073, -1.015, 3000], 'brands-gp': [51.357, 0.262, 2500],
    'brands-indy': [51.357, 0.262, 2500], donington: [52.830, -1.377, 2500], snetterton: [52.465, 0.946, 2500],
    oulton: [53.178, -2.614, 2500], 'nurburgring-sprint': [50.333, 6.944, 2500], nordschleife: [50.355, 6.970, 9000],
    sachsenring: [50.792, 12.689, 2500], lausitzring: [51.534, 13.923, 3000], oschersleben: [52.027, 11.280, 2500],
    bathurst: [-33.447, 149.558, 3000, 'Mount Panorama Circuit'], 'phillip-island': [-38.502, 145.235, 2500], sandown: [-37.950, 145.166, 2000],
    'the-bend': [-35.280, 139.510, 3500], queensland: [-27.690, 152.654, 2000], winton: [-36.518, 146.088, 2000],
    'hidden-valley': [-12.450, 130.906, 2000], 'laguna-seca': [36.584, -121.753, 2000], 'road-america': [43.797, -87.989, 3000],
    fuji: [35.371, 138.927, 2500],
};

const R = 6371000;
const dist = (a, b) => {
    const [lon1, lat1] = a, [lon2, lat2] = b;
    const x = (lon2 - lon1) * Math.PI / 180 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
    const y = (lat2 - lat1) * Math.PI / 180;
    return Math.hypot(x, y) * R;
};
const longitud = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

// Ramer–Douglas–Peucker en coordenadas proyectadas
function simplificar(pts, eps) {
    if (pts.length < 3) return pts;
    // Bucle cerrado: partir por el punto más lejano del inicio
    if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) {
        let lejos = 1, dmax = 0;
        pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > dmax) { dmax = d; lejos = i; } });
        return [...simplificar(pts.slice(0, lejos + 1), eps).slice(0, -1), ...simplificar(pts.slice(lejos), eps)];
    }
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let max = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        const num = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]);
        const den = Math.hypot(b[1] - a[1], b[0] - a[0]) || 1;
        const d = num / den;
        if (d > max) { max = d; idx = i; }
    }
    if (max <= eps) return [a, b];
    return [...simplificar(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplificar(pts.slice(idx), eps)];
}

// Proyecta [lon, lat] a una caja de 600x370 (norte arriba) y devuelve un path SVG cerrado
function aSvg(coords) {
    const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    let pts = coords.map(([lon, lat]) => [lon * k, -lat]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const W = 600, H = 370, M = 26;
    const esc = Math.min((W - 2 * M) / (maxX - minX), (H - 2 * M) / (maxY - minY));
    const ox = (W - (maxX - minX) * esc) / 2, oy = (H - (maxY - minY) * esc) / 2;
    pts = pts.map(([x, y]) => [ox + (x - minX) * esc, oy + (y - minY) * esc]);
    pts = simplificar(pts, 0.6);
    if (dist(coords[0], coords[coords.length - 1]) < 1) pts.pop();
    return 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
}

// ---------- OpenStreetMap: de tramos sueltos a una vuelta completa ----------
import { existsSync, mkdirSync } from 'node:fs';
const CACHE = process.env.CACHE_TRAZADOS || './.cache-trazados';
async function overpass(lat, lon, radio, relacion) {
    if (!existsSync(CACHE)) mkdirSync(CACHE);
    const f = `${CACHE}/${lat}_${lon}_${radio}${relacion ? '_rel' : ''}.json`;
    if (existsSync(f)) return JSON.parse(readFileSync(f));
    const els = await overpassRed(lat, lon, radio, relacion);
    writeFileSync(f, JSON.stringify(els));
    return els;
}
async function overpassRed(lat, lon, radio, relacion) {
    // Circuitos urbanos (p. ej. Bathurst): las vías son calles, se toman de la relación type=circuit
    const q = relacion
        ? `[out:json][timeout:60];relation["type"="circuit"]["name"="${relacion}"](around:${radio},${lat},${lon});way(r);out body geom;`
        : `[out:json][timeout:60];way["highway"="raceway"](around:${radio},${lat},${lon});out body geom;`;
    for (let intento = 0; intento < 4; intento++) {
        const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'User-Agent': 'fxmanager-trazados/1.0' } });
        if (r.ok) return (await r.json()).elements;
        await new Promise(res => setTimeout(res, 5000 * (intento + 1)));
    }
    throw new Error('Overpass no responde');
}

function mejorVuelta(ways, objetivoM, sinFiltro = false) {
    const excluir = /\bpit(s\b| ?lane| ?entry| ?exit| ?road|\b(?! straight))|boxengasse|kart|drift|paddock(?! hill)|motocross|skid|drag|oval.*test|service|access|fahrsicherheit|driving|off.?road|rally/i;
    const validos = ways.filter(w => w.geometry?.length > 1 && (sinFiltro || !excluir.test(`${w.tags?.name || ''} ${w.tags?.raceway || ''} ${w.tags?.service || ''} ${w.tags?.sport || ''}`) && !/unpaved|dirt|gravel|grass/.test(w.tags?.surface || '')) && w.tags?.area !== 'yes');
    // Grafo de nodos
    const coord = {}, ady = {};
    const arista = (a, b) => { (ady[a] ||= new Set()).add(b); (ady[b] ||= new Set()).add(a); };
    for (const w of validos) {
        w.nodes.map(String).forEach((n, i) => { coord[n] = [w.geometry[i].lon, w.geometry[i].lat]; if (i) arista(String(w.nodes[i - 1]), n); });
    }
    const grado = (n) => ady[n]?.size || 0;
    const cruces = Object.keys(ady).filter(n => grado(n) !== 2);
    // Cadenas entre cruces (supertramos)
    const tramos = [];
    const visto = new Set();
    const clave = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
    for (const c of cruces) for (const v of ady[c]) {
        if (visto.has(clave(c, v))) continue;
        const camino = [c, v]; visto.add(clave(c, v));
        let prev = c, cur = v;
        while (grado(cur) === 2) {
            const sig = [...ady[cur]].find(x => x !== prev);
            if (visto.has(clave(cur, sig))) break;
            visto.add(clave(cur, sig)); camino.push(sig); prev = cur; cur = sig;
        }
        const pts = camino.map(n => coord[n]);
        tramos.push({ a: c, b: cur, nodos: camino, len: longitud(pts) });
    }
    // Bucles sin cruces (una vía cerrada suelta)
    const candidatos = [];
    for (const n of Object.keys(ady)) {
        if (visto.has(`loop|${n}`) || grado(n) !== 2) continue;
        const camino = [n]; let prev = null, cur = n, ok = true;
        while (true) {
            const sig = [...ady[cur]].find(x => x !== prev);
            if (!sig || grado(sig) !== 2) { ok = false; break; }
            if (sig === n) break;
            camino.push(sig); prev = cur; cur = sig;
            if (camino.length > 50000) { ok = false; break; }
        }
        camino.forEach(x => visto.add(`loop|${x}`));
        if (ok) { const pts = [...camino, n].map(x => coord[x]); candidatos.push({ pts, len: longitud(pts) }); }
    }
    // Ciclos simples en el grafo de cruces (búsqueda acotada)
    const porCruce = {};
    tramos.forEach((t, i) => { (porCruce[t.a] ||= []).push(i); (porCruce[t.b] ||= []).push(i); });
    let pasos = 0;
    const usados = new Set();
    for (const inicio of cruces) {
        pasos = 0;
        const dfs = (nodo, lista, len) => {
            if (++pasos > 150000 || len > objetivoM * 1.6) return;
            for (const ti of porCruce[nodo] || []) {
                if (usados.has(ti)) continue;
                const t = tramos[ti];
                const otro = t.a === nodo ? t.b : t.a;
                usados.add(ti); lista.push({ ti, desde: nodo });
                if (otro === inicio && lista.length >= 1) {
                    const pts = [];
                    for (const { ti: k, desde } of lista) {
                        const tr = tramos[k];
                        const ns = tr.a === desde ? tr.nodos : tr.nodos.slice().reverse();
                        ns.forEach((n, j) => { if (j || !pts.length) pts.push(coord[n]); });
                    }
                    candidatos.push({ pts, len: len + t.len });
                } else if (!lista.some(x => x.desde === otro)) dfs(otro, lista, len + t.len);
                lista.pop(); usados.delete(ti);
            }
        };
        dfs(inicio, [], 0);
    }
    const buenos = candidatos.filter(c => c.len > objetivoM * 0.6 && c.len < objetivoM * 1.4);
    buenos.sort((a, b) => Math.abs(a.len - objetivoM) - Math.abs(b.len - objetivoM));
    return buenos[0] || null;
}

const geo = JSON.parse(readFileSync(process.argv[2]));
const porId = Object.fromEntries(geo.features.map(f => [f.properties.id, f]));
const salida = {}, informe = [];
for (const c of CIRCUITOS) {
    if (F1[c.id]) {
        const f = porId[F1[c.id]];
        const coords = f.geometry.coordinates;
        salida[c.id] = aSvg(coords);
        informe.push(`${c.id}: F1 ${F1[c.id]} (${(longitud(coords) / 1000).toFixed(2)} km, oficial ${c.km})`);
        continue;
    }
    const o = OSM[c.id];
    if (!o) { informe.push(`${c.id}: SIN FUENTE`); continue; }
    try {
        const ways = await overpass(...o);
        const v = mejorVuelta(ways, c.km * 1000, !!o[3]);
        if (!v) { informe.push(`${c.id}: no se encontró una vuelta (${ways.length} tramos)`); continue; }
        salida[c.id] = aSvg(v.pts);
        informe.push(`${c.id}: OSM ${(v.len / 1000).toFixed(2)} km (oficial ${c.km})`); console.error(informe[informe.length - 1]);
    } catch (e) { informe.push(`${c.id}: ERROR ${e.message}`); console.error(informe[informe.length - 1]); }
    await new Promise(r => setTimeout(r, 1500));
}
writeFileSync(new URL('../js/engine/trazados.js', import.meta.url),
    `// Trazados reales de los circuitos (SVG 600x370). Generado por worker/trazados.mjs\n// Fuentes: bacinger/f1-circuits (MIT) y © OpenStreetMap contributors (ODbL)\nexport const TRAZADOS = ${JSON.stringify(salida, null, 0).replace(/","/g, '",\n"')};\n`);
console.log(informe.join('\n'));
