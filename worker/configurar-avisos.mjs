// Configura los avisos en el móvil (Web Push). Ejecútalo UNA vez en tu ordenador:
//   node worker/configurar-avisos.mjs
// Genera las claves VAPID, guarda la privada como secret del repositorio (VAPID_PRIVATE_KEY, con gh)
// y la pública en js/config.js, y sube el cambio. Necesita gh con sesión iniciada (gh auth status).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import webpush from 'web-push';

const ruta = new URL('../js/config.js', import.meta.url);
const config = readFileSync(ruta, 'utf8');
const actual = config.match(/VAPID_PUBLIC_KEY = '([^']*)'/)?.[1];
if (actual && !process.argv.includes('--rehacer')) {
    console.log('Los avisos ya están configurados. Si quieres claves nuevas (se perderán las suscripciones actuales), usa --rehacer.');
    process.exit(0);
}
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
// la clave privada va directa a GitHub por la entrada estándar: no se muestra ni se guarda en disco
execFileSync('gh', ['secret', 'set', 'VAPID_PRIVATE_KEY'], { input: privateKey, stdio: ['pipe', 'inherit', 'inherit'] });
writeFileSync(ruta, config.replace(/VAPID_PUBLIC_KEY = '[^']*'/, `VAPID_PUBLIC_KEY = '${publicKey}'`));
execFileSync('git', ['add', 'js/config.js'], { stdio: 'inherit' });
execFileSync('git', ['commit', '-m', 'Clave pública de los avisos en el móvil'], { stdio: 'inherit' });
execFileSync('git', ['push'], { stdio: 'inherit' });
console.log('\nListo: avisos configurados. El worker los empezará a enviar en su próximo turno.');
