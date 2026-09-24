// Ciclo automático del juego (lo lanza GitHub Actions cada 10 min).
// Usa la cuenta BOT_EMAIL / BOT_PASSWORD (secrets del repositorio). Si no existe, la crea;
// después hay que marcarla como administradora una vez en control.html → Usuarios.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../js/config.js';
import { FirestoreStore } from '../js/core/store.js';
import { ejecutarTick } from '../js/jobs/tick.js';

const { BOT_EMAIL, BOT_PASSWORD } = process.env;
if (!BOT_EMAIL || !BOT_PASSWORD) {
    console.error('❌ Faltan los secrets BOT_EMAIL y BOT_PASSWORD (GitHub → Settings → Secrets and variables → Actions).');
    process.exit(1);
}
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let cred;
try {
    cred = await signInWithEmailAndPassword(auth, BOT_EMAIL, BOT_PASSWORD);
} catch (e) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
        try {
            cred = await createUserWithEmailAndPassword(auth, BOT_EMAIL, BOT_PASSWORD);
            console.log(`Cuenta del bot creada: ${BOT_EMAIL}`);
        } catch (e2) {
            if (e2.code === 'auth/email-already-in-use') console.error('❌ Ese email ya tiene cuenta pero la contraseña de BOT_PASSWORD no coincide.');
            else console.error('❌ No se pudo crear la cuenta del bot:', e2.code || e2.message);
            process.exit(1);
        }
    } else { console.error('❌ Error al iniciar sesión:', e.code || e.message); process.exit(1); }
}

const ref = doc(db, `usuarios/${cred.user.uid}`);
const perfil = await getDoc(ref);
if (!perfil.exists()) await setDoc(ref, { nombre: 'Bot del juego', email: BOT_EMAIL, isAdmin: false, equipoId: null, estado: 'pendiente' });
if (!perfil.exists() || perfil.data().isAdmin !== true) {
    console.error(`❌ La cuenta "${BOT_EMAIL}" (Bot del juego) todavía no es administradora.\n   Entra en la web → control.html → pestaña Usuarios → marca la casilla Admin de "Bot del juego" y vuelve a lanzar el workflow.`);
    process.exit(1);
}

const store = new FirestoreStore(db);
const r = await ejecutarTick(store, { origen: 'worker', forzar: process.argv.includes('--forzar') });
console.log(JSON.stringify({ ok: r.ok, errores: r.errores, notas: r.notas, lecturas: store.lecturas, escrituras: store.escrituras }, null, 2));
process.exit(r.ok === false && !r.omitido ? 1 : 0);
