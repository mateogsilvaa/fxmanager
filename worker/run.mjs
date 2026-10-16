// Ciclo automático del juego (lo lanza GitHub Actions). Lleva la partida original y todas las partidas de amigos.
// Modo normal: un ciclo y termina.  Modo continuo (--continuo MIN): se queda encendido MIN minutos
// escuchando Firestore en tiempo real y ejecuta el ciclo en cuanto hay algo que hacer
// (una acción de un mánager, una elección, una sesión que cierra o se publica, un proyecto que acaba…).
// Usa la cuenta BOT_EMAIL / BOT_PASSWORD (secrets del repositorio). Si no existe, la crea;
// después hay que marcarla como administradora una vez en control.html → Usuarios.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { FIREBASE_CONFIG, VAPID_PUBLIC_KEY } from '../js/config.js';
import { FirestoreStore } from '../js/core/store.js';
import { ejecutarTick } from '../js/jobs/tick.js';
import { finDiaMadrid, fijarLigas, fijarLigasDe } from '../js/engine/constants.js';
import { storeDe } from '../js/core/partida-store.js';
import { crearPartida } from '../js/jobs/partidas.js';

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

// Avisos en el móvil: solo si están configurados (clave pública en js/config.js y privada en el secret VAPID_PRIVATE_KEY)
let push = null;
if (VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails('https://fxmanager.es', VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    push = async (sub, payload) => {
        try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 6 * 3600 }); return 'ok'; }
        catch (e) { return e.statusCode === 404 || e.statusCode === 410 ? 'caducada' : 'error'; }
    };
}
// Partidas de amigos activas (la original va aparte, en las colecciones raíz)
const listarPartidas = async () => (await store.list('partidas', [['estado', 'in', ['solicitada', 'activa']]]).catch(() => []));
// Errores del ciclo → colección global "errores" (se ven en Control → Errores)
async function registrarError(pid, origen, texto) {
    try { await store.set(`errores/${store.nuevoId('errores')}`, { origen, partida: pid || 'principal', texto: String(texto).slice(0, 1500), t: Date.now() }); } catch { }
}
// Un ciclo de una partida concreta (fija antes sus ligas: cada partida puede jugar menos de cinco)
async function cicloPartida(pid, opts = {}) {
    const st = storeDe(store, pid);
    let cfg = null;
    if (pid) { cfg = await st.get('config/juego').catch(() => null); fijarLigasDe(cfg); }
    try {
        const r = await ejecutarTick(st, { origen: 'worker', push, ...opts });
        if (r.errores?.length) await registrarError(pid, 'worker', r.errores.join(' | '));
        if (pid && cfg) {
            const c2 = await st.get('config/juego').catch(() => cfg);
            await store.merge(`partidas/${pid}`, { fase: c2.fase, temporada: c2.temporada, ultimoCiclo: Date.now() }).catch(() => { });
        }
        return r;
    } finally { fijarLigas(); }
}

const iArg = process.argv.indexOf('--continuo');
if (iArg < 0) {
    const r = await ejecutarTick(store, { origen: 'worker', forzar: process.argv.includes('--forzar'), push });
    if (r.errores?.length) await registrarError('', 'worker', r.errores.join(' | '));
    for (const p of await listarPartidas()) {
        try {
            if (p.estado === 'solicitada') await crearPartida(store, p, { log: console.log });
            else await cicloPartida(p.id, { forzar: process.argv.includes('--forzar') });
        } catch (e) { console.error(`Partida ${p.id}:`, e.message); await registrarError(p.id, 'worker', e.stack || e.message); }
    }
    console.log(JSON.stringify({ ok: r.ok, errores: r.errores, notas: r.notas, lecturas: store.lecturas, escrituras: store.escrituras }, null, 2));
    process.exit(r.ok === false && !r.omitido ? 1 : 0);
}

// ---------------- Modo continuo ----------------
const minutos = +process.argv[iArg + 1] || 340;
const hasta = Date.now() + minutos * 60_000;
const HUECO_MIN = 400;            // entre dos ciclos seguidos (las acciones se procesan casi al momento)
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const lista = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
let despertar = null;
const avisar = () => despertar?.();

// Cada partida tiene su vigía: escucha en tiempo real lo que le hace falta y sabe cuándo le toca un ciclo.
// La original repasa cada 15 min aunque no pase nada; las de amigos, cada hora (para gastar pocas lecturas).
class Vigia {
    constructor(pid) {
        this.pid = pid; this.pre = pid ? `partidas/${pid}/` : '';
        this.reposo = pid ? 60 * 60_000 : 15 * 60_000;
        this.vivo = { cfg: null, eventos: [], equipos: [], privs: [], acciones: [], decisiones: [], prensa: [], avisos: [], llamadas: [], gestion: [], sombra: null };
        // ultimo = último ciclo de cualquier tipo (para no encadenar dos seguidos) · ultimoCompleto = último ciclo entero
        this.listos = new Set(); this.quitar = []; this.ultimo = 0; this.ultimoCompleto = 0; this.catalogoDesde = 0; this.atasco = { venc: null, t: 0 }; this.secreto = null;
        this.temporada = null; this.quitarEventos = null;
        const necesarios = ['cfg', 'eventos', 'equipos', 'privs', 'acciones', 'decisiones', 'prensa', 'llamadas'];
        if (!pid) necesarios.push('avisos', 'sombra'); else necesarios.push('gestion');
        this.necesarios = necesarios;
        const P = this.pre;
        this.escuchar('cfg', doc(db, `${P}config/juego`), (s) => {
            this.vivo.cfg = s.exists() ? s.data() : null;
            const t = this.vivo.cfg?.temporada || 1;
            if (t !== this.temporada) {
                this.temporada = t;
                this.quitarEventos?.();
                this.listos.delete('eventos');
                this.quitarEventos = onSnapshot(query(collection(db, `${P}eventos`), where('temporada', '==', t)), (snap) => { this.vivo.eventos = lista(snap); this.listos.add('eventos'); avisar(); }, (e) => log(`${this.nombre} eventos: ${e.code || e.message}`));
            }
        });
        this.escuchar('equipos', collection(db, `${P}equipos`), (s) => { this.vivo.equipos = lista(s); });
        this.escuchar('privs', collection(db, `${P}equipos_priv`), (s) => { this.vivo.privs = lista(s); });
        this.escuchar('acciones', query(collection(db, `${P}acciones`), where('estado', '==', 'pendiente')), (s) => { this.vivo.acciones = lista(s); });
        this.escuchar('decisiones', query(collection(db, `${P}decisiones`), where('aplicada', '==', false)), (s) => { this.vivo.decisiones = lista(s); });
        this.escuchar('prensa', query(collection(db, `${P}prensa`), where('aplicada', '==', false)), (s) => { this.vivo.prensa = lista(s); });
        this.escuchar('llamadas', query(collection(db, `${P}llamadas`), where('aplicada', '==', false)), (s) => { this.vivo.llamadas = lista(s); });
        if (!pid) this.escuchar('sombra', doc(db, 'secreto/sombra'), (s) => { this.vivo.sombra = s.exists() ? s.data() : null; });
        if (!pid) this.escuchar('avisos', query(collection(db, 'avisos_admin'), where('estado', '==', 'pendiente')), (s) => { this.vivo.avisos = lista(s); });
        else this.escuchar('gestion', query(collection(db, `${P}gestion`), where('estado', '==', 'pendiente')), (s) => { this.vivo.gestion = lista(s); });
    }
    get nombre() { return this.pid ? `partida ${this.pid}` : 'principal'; }
    escuchar(n, ref, f) { this.quitar.push(onSnapshot(ref, (snap) => { f(snap); this.listos.add(n); avisar(); }, (e) => log(`${this.nombre} ${n}: ${e.code || e.message}`))); }
    parar() { this.quitar.forEach(f => f()); this.quitarEventos?.(); }
    get listo() { return this.necesarios.every(n => this.listos.has(n)); }
    proximo(ahora) {
        const v = this.vivo;
        let t = finDiaMadrid(ahora);
        for (const ev of v.eventos) for (const s of Object.values(ev.sesiones || {})) {
            if (s.estado === 'programada') t = Math.min(t, s.lockAt);
            else if (s.estado === 'simulada') t = Math.min(t, s.revealAt);
        }
        for (const p of v.privs) for (const pr of p.proyectos || []) t = Math.min(t, pr.retenida || pr.fin);
        for (const d of [...v.decisiones, ...v.prensa, ...v.llamadas]) t = Math.min(t, d.expira);
        if (this.catalogoDesde) t = Math.min(t, this.catalogoDesde + 45_000);
        return Math.min(t, this.ultimoCompleto + this.reposo);
    }
    // Qué toca hacer: { texto, solo }. Si solo hay cosas de jugadores (una llamada, una acción…) se ejecuta solo ese paso
    // (vía rápida, un segundo en vez de varios); si hay algo por horario o repaso, el ciclo entero.
    motivo(ahora) {
        const v = this.vivo, solo = [], texto = [];
        const hay = (cond, paso, t) => { if (cond) { solo.push(paso); texto.push(t); } };
        hay(v.acciones.length, 'procesarAcciones', `${v.acciones.length} acción(es)`);
        hay(v.gestion.length, 'procesarGestion', 'gestión de la partida');
        hay(v.decisiones.some(d => d.eleccion), 'procesarDecisiones', 'decisión elegida');
        hay(v.prensa.some(d => d.eleccion), 'procesarPrensa', 'respuesta a la prensa');
        hay(v.llamadas.some(d => d.eleccion), 'procesarLlamadas', 'respuesta a una llamada');
        hay(push && v.avisos.length, 'avisosOrganizacion', 'aviso de la organización');
        const venc = this.proximo(ahora);
        if (ahora - this.ultimoCompleto >= this.reposo) return { texto: 'repaso periódico', solo: null };
        // si algo vencido no se resuelve (p. ej. un error), no insistir más de una vez por minuto
        if (venc <= ahora && !(venc === this.atasco.venc && ahora - this.atasco.t < 60_000)) { this.atasco.venc = venc; this.atasco.t = ahora; return { texto: 'vencimiento', solo: null }; }
        if (solo.length) return { texto: texto.join(' + '), solo };
        // Catálogo público pendiente de reconstruir (fans, reputación…): una vez cada 45 s como mucho
        if (this.catalogoDesde && ahora - this.catalogoDesde >= 45_000) return { texto: 'catálogo', solo: ['__catalogo'] };
        return null;
    }
    async ciclo(ahora, m) {
        this.ultimo = ahora;
        const v = this.vivo;
        if (this.pid) fijarLigasDe(v.cfg);
        try {
            // El secreto no cambia: se lee una sola vez
            if (!this.secreto) this.secreto = (await store.get(`${this.pre}secreto/juego`).catch(() => null))?.clave || null;
            const r = await ejecutarTick(storeDe(store, this.pid), {
                ahora, origen: 'worker', log: () => { }, solo: m.solo,
                precarga: { cfg: v.cfg, secreto: this.secreto, sombra: v.sombra, eventos: v.eventos, equipos: v.equipos, privs: v.privs, acciones: v.acciones, decisiones: v.decisiones, prensa: v.prensa, avisos: v.avisos, llamadas: v.llamadas, gestion: v.gestion },
                extra: { continuoHasta: hasta }, push,
            });
            if (!m.solo) { this.ultimoCompleto = ahora; this.catalogoDesde = 0; }
            else if (m.solo.includes('__catalogo')) this.catalogoDesde = 0;
            else if (r.catalogoSucio && !this.catalogoDesde) this.catalogoDesde = ahora;
            const etiqueta = `${m.texto}${m.solo ? ' ⚡' : ''}`;
            if (r.errores?.length) { log(`${this.nombre} · ciclo (${etiqueta}) con errores: ${r.errores.join(' | ')}`); await registrarError(this.pid, 'worker', r.errores.join(' | ')); return false; }
            if (!r.omitido) log(`${this.nombre} · ciclo (${etiqueta}) ${r.duracionMs} ms${r.notas?.length ? ' · ' + r.notas.slice(-4).join(' · ') : ''}`);
            if (!m.solo && this.pid && v.cfg) await store.merge(`partidas/${this.pid}`, { fase: v.cfg.fase, temporada: v.cfg.temporada, ultimoCiclo: ahora }).catch(() => { });
            return true;
        } catch (e) { log(`${this.nombre} · ciclo (${m.texto}) falló: ${e.stack || e}`); await registrarError(this.pid, 'worker', e.stack || e); return false; }
        finally { if (this.pid) fijarLigas(); }
    }
}

const vigias = new Map([['', new Vigia('')]]);
const porCrear = [];
// Las partidas aparecen y desaparecen en directo: se crea un vigía para cada partida activa
onSnapshot(query(collection(db, 'partidas'), where('estado', 'in', ['solicitada', 'activa'])), (snap) => {
    const activas = new Set();
    for (const p of lista(snap)) {
        if (p.estado === 'solicitada') { if (!porCrear.some(x => x.id === p.id)) porCrear.push(p); continue; }
        activas.add(p.id);
        if (!vigias.has(p.id)) { vigias.set(p.id, new Vigia(p.id)); log(`Vigilando la partida ${p.id} (${p.nombre || ''})`); }
    }
    for (const [pid, v] of vigias) if (pid && !activas.has(pid)) { v.parar(); vigias.delete(pid); log(`Partida ${pid} ya no está activa`); }
    avisar();
}, (e) => log(`listener partidas: ${e.code || e.message}`));

let ciclos = 0, fallos = 0;
log(`Worker continuo durante ${minutos} min`);
while (Date.now() < hasta) {
    const ahora = Date.now();
    // 1. Partidas recién pedidas desde la web
    if (porCrear.length) {
        const p = porCrear.shift();
        try { await crearPartida(store, p, { log }); } catch (e) { log(`No se pudo crear la partida ${p.id}: ${e.stack || e}`); await registrarError(p.id, 'creación', e.stack || e); await store.merge(`partidas/${p.id}`, { estado: 'error', motivo: String(e.message || e).slice(0, 200) }).catch(() => { }); }
        continue;
    }
    // 2. La primera partida a la que le toque un ciclo (la original va siempre primero)
    let hecho = false;
    for (const v of vigias.values()) {
        if (!v.listo) continue;
        if (ahora - v.ultimo < HUECO_MIN) continue;
        const m = v.motivo(ahora);
        if (!m) continue;
        ciclos++;
        if (!(await v.ciclo(ahora, m))) fallos++;
        hecho = true;
        break;
    }
    if (hecho) continue;
    // 3. Dormir hasta el próximo vencimiento de cualquier partida, un cambio en Firestore o como mucho 30 s
    //    (y como mucho hasta que acabe el hueco entre ciclos de una partida que acaba de trabajar: si en ese
    //    momento llegó algo, se atiende al instante en vez de esperar a la siguiente señal)
    const venc = Math.min(...[...vigias.values()].map(v => !v.listo ? ahora + 2_000 : Math.min(v.proximo(ahora), ahora - v.ultimo < HUECO_MIN ? v.ultimo + HUECO_MIN : Infinity)));
    const espera = Math.max(150, Math.min(30_000, venc - ahora + 50, hasta - ahora));
    await new Promise(res => { const t = setTimeout(res, espera); despertar = () => { clearTimeout(t); setTimeout(res, 250); }; });
    despertar = null;
}
for (const v of vigias.values()) v.parar();
log(`Fin del turno: ${ciclos} ciclos, ${fallos} con errores, ${vigias.size} partidas vigiladas, ${store.lecturas} lecturas y ${store.escrituras} escrituras (sin contar listeners)`);
process.exit(0);
