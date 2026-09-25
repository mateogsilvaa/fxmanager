// Ciclo automático del juego (lo lanza GitHub Actions).
// Modo normal: un ciclo y termina.  Modo continuo (--continuo MIN): se queda encendido MIN minutos
// escuchando Firestore en tiempo real y ejecuta el ciclo en cuanto hay algo que hacer
// (una acción de un mánager, una elección, una sesión que cierra o se publica, un proyecto que acaba…).
// Usa la cuenta BOT_EMAIL / BOT_PASSWORD (secrets del repositorio). Si no existe, la crea;
// después hay que marcarla como administradora una vez en control.html → Usuarios.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../js/config.js';
import { FirestoreStore } from '../js/core/store.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { finDiaMadrid } from '../js/engine/constants.js';

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
const iArg = process.argv.indexOf('--continuo');
if (iArg < 0) {
    const r = await ejecutarTick(store, { origen: 'worker', forzar: process.argv.includes('--forzar') });
    console.log(JSON.stringify({ ok: r.ok, errores: r.errores, notas: r.notas, lecturas: store.lecturas, escrituras: store.escrituras }, null, 2));
    process.exit(r.ok === false && !r.omitido ? 1 : 0);
}

// ---------------- Modo continuo ----------------
const minutos = +process.argv[iArg + 1] || 340;
const hasta = Date.now() + minutos * 60_000;
const REPOSO_MAX = 15 * 60_000;   // aunque no pase nada, un ciclo cada 15 min (mercado, avisos…)
const HUECO_MIN = 4_000;          // entre dos ciclos seguidos
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const vivo = { cfg: null, eventos: [], equipos: [], privs: [], acciones: [], decisiones: [], prensa: [] };
const listos = new Set();
const lista = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
let despertar = null;
const avisar = () => despertar?.();
const quitar = [];
const escuchar = (nombre, ref, alCambiar) => quitar.push(onSnapshot(ref, (snap) => { alCambiar(snap); listos.add(nombre); avisar(); }, (e) => log(`listener ${nombre}: ${e.code || e.message}`)));

let temporadaEventos = null, quitarEventos = null;
escuchar('cfg', doc(db, 'config/juego'), (s) => {
    vivo.cfg = s.exists() ? s.data() : null;
    const t = vivo.cfg?.temporada || 1;
    if (t !== temporadaEventos) {
        temporadaEventos = t;
        quitarEventos?.();
        listos.delete('eventos');
        quitarEventos = onSnapshot(query(collection(db, 'eventos'), where('temporada', '==', t)), (snap) => { vivo.eventos = lista(snap); listos.add('eventos'); avisar(); }, (e) => log(`listener eventos: ${e.code || e.message}`));
    }
});
escuchar('equipos', collection(db, 'equipos'), (s) => { vivo.equipos = lista(s); });
escuchar('privs', collection(db, 'equipos_priv'), (s) => { vivo.privs = lista(s); });
escuchar('acciones', query(collection(db, 'acciones'), where('estado', '==', 'pendiente')), (s) => { vivo.acciones = lista(s); });
escuchar('decisiones', query(collection(db, 'decisiones'), where('aplicada', '==', false)), (s) => { vivo.decisiones = lista(s); });
escuchar('prensa', query(collection(db, 'prensa'), where('aplicada', '==', false)), (s) => { vivo.prensa = lista(s); });

// Próximo instante en el que el ciclo tiene trabajo por horario
function proximoVencimiento(ahora) {
    let t = finDiaMadrid(ahora);
    for (const ev of vivo.eventos) for (const s of Object.values(ev.sesiones || {})) {
        if (s.estado === 'programada') t = Math.min(t, s.lockAt);
        else if (s.estado === 'simulada') t = Math.min(t, s.revealAt);
    }
    for (const p of vivo.privs) for (const pr of p.proyectos || []) t = Math.min(t, pr.fin);
    for (const d of vivo.decisiones) t = Math.min(t, d.expira);
    for (const d of vivo.prensa) t = Math.min(t, d.expira);
    return t;
}
function motivo(ahora, ultimo) {
    if (vivo.acciones.length) return `${vivo.acciones.length} acción(es)`;
    if (vivo.decisiones.some(d => d.eleccion)) return 'decisión elegida';
    if (vivo.prensa.some(d => d.eleccion)) return 'respuesta a la prensa';
    const venc = proximoVencimiento(ahora);
    // si algo vencido no se resuelve (p. ej. un error), no insistir más de una vez por minuto
    if (venc <= ahora && !(venc === atasco.venc && ahora - atasco.t < 60_000)) { atasco.venc = venc; atasco.t = ahora; return 'vencimiento'; }
    if (ahora - ultimo >= REPOSO_MAX) return 'repaso periódico';
    return null;
}

let ultimo = 0, ciclos = 0, fallos = 0;
const atasco = { venc: null, t: 0 };
log(`Worker continuo durante ${minutos} min`);
while (Date.now() < hasta) {
    const ahora = Date.now();
    const listosTodos = ['cfg', 'eventos', 'equipos', 'privs', 'acciones', 'decisiones', 'prensa'].every(n => listos.has(n));
    const m = listosTodos && ahora - ultimo >= HUECO_MIN ? motivo(ahora, ultimo) : null;
    if (m) {
        ultimo = ahora;
        try {
            const r = await ejecutarTick(store, {
                ahora, origen: 'worker', log: () => {}, precarga: { eventos: vivo.eventos, equipos: vivo.equipos, privs: vivo.privs },
                extra: { continuoHasta: hasta },
            });
            ciclos++;
            if (r.errores?.length) { fallos++; log(`Ciclo (${m}) con errores: ${r.errores.join(' | ')}`); }
            else if (!r.omitido) log(`Ciclo (${m}) ${r.duracionMs} ms${r.notas?.length ? ' · ' + r.notas.slice(-4).join(' · ') : ''}`);
        } catch (e) { fallos++; log(`Ciclo (${m}) falló: ${e.stack || e}`); }
        continue;
    }
    // Dormir hasta el próximo vencimiento, un cambio en Firestore o como mucho 30 s
    const venc = listosTodos ? proximoVencimiento(ahora) : ahora + 2_000;
    const espera = Math.max(1_000, Math.min(30_000, venc - ahora + 300, hasta - ahora));
    await new Promise(res => { const t = setTimeout(res, espera); despertar = () => { clearTimeout(t); setTimeout(res, 1_500); }; });
    despertar = null;
}
quitar.forEach(f => f()); quitarEventos?.();
log(`Fin del turno: ${ciclos} ciclos, ${fallos} con errores, ${store.lecturas} lecturas y ${store.escrituras} escrituras (sin contar listeners)`);
process.exit(0);
