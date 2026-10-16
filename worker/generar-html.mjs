// Genera las páginas HTML (todas con la misma estructura). Uso: node worker/generar-html.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Todos los módulos que necesita una página (import estáticos y dinámicos), para precargarlos a la vez
// en vez de que el navegador los descubra uno a uno en cascada.
// Cada módulo lleva ?v=<hash de su contenido> (mapa de importación): así, tras subir una versión nueva, el navegador
// nunca mezcla archivos viejos de la caché con archivos nuevos, y los que no han cambiado se reutilizan de la caché.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
function grafo(entrada) {
    const vistos = new Set();
    const pila = [join(RAIZ, entrada)];
    while (pila.length) {
        const f = pila.pop();
        if (vistos.has(f)) continue;
        vistos.add(f);
        let src = '';
        try { src = readFileSync(f, 'utf8'); } catch { continue; }
        for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) pila.push(join(dirname(f), m[1]));
        for (const m of src.matchAll(/^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) pila.push(join(dirname(f), m[1]));
        for (const m of src.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) pila.push(join(dirname(f), m[1]));
    }
    return [...vistos].map(f => relative(RAIZ, f).replace(/\\/g, '/'));
}
const FB = '10.12.2';
const hashes = new Map();
const version = (ruta) => {
    if (!hashes.has(ruta)) hashes.set(ruta, createHash('sha1').update(readFileSync(join(RAIZ, ruta))).digest('hex').slice(0, 8));
    return hashes.get(ruta);
};
// Las tipografías se cargan sin bloquear el pintado de la página (antes iban con @import dentro del CSS)
const FUENTES = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800&family=Space+Mono:wght@400;700&display=swap';
// Si la página se queda en "Cargando…" (red, caché antigua, un módulo que no baja) se avisa con un botón para recargar
const VIGILANTE = `<script>
(function () {
    function aviso(motivo) {
        var m = document.getElementById('main');
        if (!m || !m.querySelector('.cargando') || m.children.length !== 1) return;
        m.innerHTML = '<div class="caja-auth tarjeta"><h1>Esto está tardando más de lo normal</h1><p class="muted">' + motivo + '</p>' +
            '<div class="fila"><button class="btn" id="vig-recargar">Recargar</button><button class="btn btn-sec" id="vig-limpiar">Limpiar la caché y recargar</button></div></div>';
        document.getElementById('vig-recargar').onclick = function () { location.reload(); };
        document.getElementById('vig-limpiar').onclick = function () {
            try { Object.keys(localStorage).filter(function (k) { return /^fx(res)?:/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); sessionStorage.removeItem('fx-demo-estado'); } catch (e) { }
            if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
            location.reload();
        };
    }
    setTimeout(function () { aviso('Puede ser tu conexión o una versión antigua guardada en el navegador.'); }, 12000);
    // Un módulo de la web que no se descarga: se avisa al momento
    addEventListener('error', function (e) { if (e.target && e.target.tagName === 'SCRIPT') setTimeout(function () { aviso('No se ha podido descargar parte de la web. Recarga para intentarlo de nuevo.'); }, 800); }, true);
})();
</script>`;
const PAGINAS = {
    index: ['Hyper Race X1 · FX Manager', 'inicio'],
    liga: ['Liga · Hyper Race X1', 'liga'],
    piloto: ['Piloto · Hyper Race X1', 'piloto'],
    equipo: ['Escudería · Hyper Race X1', 'equipo'],
    sesion: ['Sesión · Hyper Race X1', 'sesion'],
    cronica: ['Crónica · Hyper Race X1', 'cronica'],
    estadisticas: ['Estadísticas · Hyper Race X1', 'estadisticas'],
    mercado: ['Mercado · Hyper Race X1', 'mercado'],
    paddock: ['Paddock · Hyper Race X1', 'paddock'],
    manager: ['Mánager · Hyper Race X1', 'manager'],
    reglamento: ['Cómo funciona · Hyper Race X1', 'reglamento'],
    entrar: ['Entrar · Hyper Race X1', 'entrar'],
    escuderia: ['Mi escudería · Hyper Race X1', 'escuderia'],
    control: ['Control · Hyper Race X1', 'control'],
    sombra: ['Mi escudería · Hyper Race X1', 'sombra'],
    laboratorio: ['Laboratorio · Hyper Race X1', 'laboratorio'],
    descubre: ['FX Manager · Tu campeonato de motor con amigos', 'descubre'],
    partidas: ['Mis partidas · FX Manager', 'partidas'],
    partida: ['Gestionar la partida · FX Manager', 'partida'],
};
const icono = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ff4d2e"/><text x="32" y="44" font-family="Arial Black,Arial" font-weight="900" font-size="30" text-anchor="middle" fill="#fff">X1</text></svg>')}`;
for (const [archivo, [titulo, js]] of Object.entries(PAGINAS)) {
    const modulos = grafo(`js/pages/${js}.js`);
    const mapa = Object.fromEntries(modulos.map(m => [`./${m}`, `./${m}?v=${version(m)}`]));
    writeFileSync(new URL(`../${archivo}.html`, import.meta.url), `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${titulo}</title>
    <meta name="description" content="Hyper Race X1: campeonato global de gestión de escuderías con BAC Mono.">
    <meta name="theme-color" content="#0a0c11">
    <link rel="icon" href="${icono}">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="apple-touch-icon" href="img/icono-180.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Hyper Race">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${FUENTES}" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="${FUENTES}"></noscript>
    <link rel="stylesheet" href="css/app.css?v=${version('css/app.css')}">
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/${FB}/firebase-app.js">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js">
${modulos.map(m => `    <link rel="modulepreload" href="${m}?v=${version(m)}">`).join('\n')}
    <script type="importmap">
    {
        "imports": {
            ${Object.entries(mapa).map(([k, v]) => `"${k}": "${v}"`).join(',\n            ')},
            "firebase/app": "https://www.gstatic.com/firebasejs/${FB}/firebase-app.js",
            "firebase/auth": "https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js",
            "firebase/firestore": "https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js"
        }
    }
    </script>
</head>
<body>
    <header id="cabecera"></header>
    <main id="main"><div class="cargando"><span class="spinner"></span>Cargando…</div></main>
    ${VIGILANTE}
    <script type="module" src="js/pages/${js}.js?v=${version(`js/pages/${js}.js`)}"></script>
</body>
</html>
`);
}
console.log('HTML generado:', Object.keys(PAGINAS).length);
