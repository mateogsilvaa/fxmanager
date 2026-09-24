# FX Manager · Hyper Race X1

Juego de gestión de escuderías sobre el campeonato **Hyper Race X1** (BAC Mono): 5 ligas nacionales (España, Italia, Reino Unido, Alemania, Australia) con 10 escuderías y 20 pilotos cada una, y una Liga Intercontinental final con los 20 mejores.

Las sesiones se **simulan solas** al cerrar las estrategias y se **publican a la hora exacta** del calendario, con retransmisión en directo. Todo lo demás (economía, I+D, espionaje, decisiones diarias, mercado de fin de temporada) también es automático.

## Cómo funciona

```
Navegador (web estática)  ──lee/escribe──▶  Firestore  ◀──cada 10 min──  GitHub Actions (worker/run.mjs)
```

- **Web**: HTML + JS sin compilar. Se puede servir desde GitHub Pages, Firebase Hosting o cualquier hosting estático.
- **Firestore**: los datos. Las reglas (`firestore.rules`) impiden que nadie toque su presupuesto o vea resultados antes de tiempo: los resultados se guardan al cerrar las estrategias pero solo se pueden leer a partir de su `publishAt`.
- **Worker**: `js/jobs/tick.js`. Cada ciclo simula las sesiones cerradas, publica las que ya han terminado su directo, procesa la cola de acciones de los mánagers, completa proyectos de I+D, aplica decisiones diarias y cambia de fase. El mismo código se puede lanzar desde el panel de control (botón «Ejecutar ciclo ahora»).

## Puesta en marcha (una sola vez)

1. **Reglas de Firestore.** Firebase Console → Firestore Database → Reglas → pega `firestore.rules` → Publicar.
2. **Web en GitHub Pages.** Settings → Pages → Deploy from a branch → `main` / `(root)`. El archivo `CNAME` apunta a `fxmanager.es`.
3. **El "bot".** Es la cuenta con la que el ciclo automático de GitHub entra en Firebase para escribir resultados (las reglas solo dejan escribir a administradores). No hace falta un email real:
   1. GitHub → Settings → Secrets and variables → Actions → *New repository secret*: `BOT_EMAIL` (por ejemplo `bot@fxmanager.es`) y `BOT_PASSWORD` (cualquier contraseña de 6+ caracteres que te inventes).
   2. Actions → «Ciclo del juego» → *Run workflow*. La primera vez crea la cuenta y falla a propósito diciendo que aún no es admin.
   3. En la web, `control.html` → Usuarios → marca **Admin** en «Bot del juego».
   4. Vuelve a lanzar el workflow: debería salir en verde. A partir de ahí corre solo cada 10 minutos.
4. **Preparar la temporada** desde `control.html` (solo visible para administradores):
   1. *Temporada* → **Borrar todo** (limpia la temporada pasada; conserva las cuentas).
   2. *Parrilla* → **Cargar la parrilla ficticia incluida** → Validar → Importar.
   3. *Calendario* → guarda la sede del Mundial y **genera el calendario** de cada liga y de la Intercontinental.
   4. *Estado* → **Ejecutar ciclo ahora** una vez.
   5. Pasa el enlace: la gente se registra, elige escudería en «Mi escudería» y a jugar.

## Frecuencia del ciclo

El repositorio es público, así que los minutos de GitHub Actions son gratis: el ciclo corre cada 10 minutos. GitHub a veces retrasa unos minutos las ejecuciones programadas; por eso las estrategias cierran 30 minutos antes de cada sesión (ajustable en el panel). Los resultados se publican a la hora exacta igualmente.

## Probar sin tocar Firebase

- **Modo demo**: abre `index.html?demo=1` servido en local (`npx http-server`). Carga `data/demo.json` (una temporada a mitad) y te pone como mánager y admin; nada se guarda. `?demo=0` para salir.
- **Temporada completa simulada**: `npm run prueba` (ligas → Mundial → mercado → nueva temporada). `node worker/prueba-temporada.mjs --demo` regenera `data/demo.json`.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `js/engine/` | Reglamento, simulador, estadísticas, crónicas, economía y mercado (JS puro, se usa en web y worker) |
| `js/jobs/` | Trabajos del servidor: ciclo, catálogo, operaciones de temporada |
| `js/core/` | Arranque, acceso a datos, interfaz común |
| `js/pages/` | Una por página |
| `worker/` | Runner de GitHub Actions, prueba de temporada y generadores |
| `data/` | Parrilla ficticia y datos de la demo |

Para cambiar el HTML común de todas las páginas edita `worker/generar-html.mjs` y ejecuta `node worker/generar-html.mjs`.
