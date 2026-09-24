// Genera las páginas HTML (todas con la misma estructura). Uso: node worker/generar-html.mjs
import { writeFileSync } from 'node:fs';
const FB = '10.12.2';
const PAGINAS = {
    index: ['Hyper Race X1 · FX Manager', 'inicio'],
    liga: ['Liga · Hyper Race X1', 'liga'],
    piloto: ['Piloto · Hyper Race X1', 'piloto'],
    equipo: ['Escudería · Hyper Race X1', 'equipo'],
    sesion: ['Sesión · Hyper Race X1', 'sesion'],
    cronica: ['Crónica · Hyper Race X1', 'cronica'],
    estadisticas: ['Estadísticas · Hyper Race X1', 'estadisticas'],
    pronosticos: ['Pronósticos · Hyper Race X1', 'pronosticos'],
    mercado: ['Mercado · Hyper Race X1', 'mercado'],
    reglamento: ['Reglamento · Hyper Race X1', 'reglamento'],
    entrar: ['Entrar · Hyper Race X1', 'entrar'],
    escuderia: ['Mi escudería · Hyper Race X1', 'escuderia'],
    control: ['Control · Hyper Race X1', 'control'],
};
const icono = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ff4d2e"/><text x="32" y="44" font-family="Arial Black,Arial" font-weight="900" font-size="30" text-anchor="middle" fill="#fff">X1</text></svg>')}`;
for (const [archivo, [titulo, js]] of Object.entries(PAGINAS)) {
    writeFileSync(new URL(`../${archivo}.html`, import.meta.url), `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${titulo}</title>
    <meta name="description" content="Hyper Race X1: campeonato global de gestión de escuderías con BAC Mono.">
    <meta name="theme-color" content="#0a0c11">
    <link rel="icon" href="${icono}">
    <link rel="stylesheet" href="css/app.css">
    <script type="importmap">
    {
        "imports": {
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
    <script type="module" src="js/pages/${js}.js"></script>
</body>
</html>
`);
}
console.log('HTML generado:', Object.keys(PAGINAS).length);
