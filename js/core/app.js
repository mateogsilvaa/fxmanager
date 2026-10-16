// Arranque común de todas las páginas: Firebase (o modo demo), usuario y reloj
import { MemStore } from './memstore.js';
import { StorePartida, rutaEn } from './partida-store.js';
import { fijarLigas } from '../engine/constants.js';

const params = new URLSearchParams(location.search);
// ?demo=1 → demo de la temporada 1 · ?demo=t2 → vista previa de la temporada 2 · ?demo=0 → salir
if (params.has('demo')) {
    try {
        const v = params.get('demo') === '0' ? '' : (params.get('demo') || '1');
        if (sessionStorage.getItem('fx-demo') !== v) sessionStorage.removeItem('fx-demo-estado');
        sessionStorage.setItem('fx-demo', v);
        localStorage.removeItem('fx-demo');
    } catch { }
}
let demoActivo = '';
try { demoActivo = sessionStorage.getItem('fx-demo') || ''; } catch { }
export const DEMO = !!demoActivo;
export const DEMO_VARIANTE = demoActivo;
const FICHEROS_DEMO = { 1: 'demo.json', t2: 'demo-t2.json' };

// Partida: ?p=<id> entra en una liga de amigos y ?p=0 vuelve a la partida original. Se recuerda en el navegador.
if (params.has('p')) { try { const v = params.get('p'); v && v !== '0' ? localStorage.setItem('fx-partida', v) : localStorage.removeItem('fx-partida'); } catch { } }
let partidaGuardada = '';
try { partidaGuardada = localStorage.getItem('fx-partida') || ''; } catch { }
export const PARTIDA = DEMO ? '' : partidaGuardada.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
let _partida = null, _miembro = null;
export const partida = () => _partida;
export const salirDePartida = () => { try { localStorage.removeItem('fx-partida'); } catch { } };
// Errores de la web → colección global "errores" (Control → Errores). Como mucho 5 por visita.
let erroresEnviados = 0;
const IGNORAR = /sin sesión|no admin|sin equipo|no encontrado|ResizeObserver|Script error/i;
function registrarErrorWeb(texto) {
    if (DEMO || !_store || erroresEnviados >= 5 || IGNORAR.test(String(texto))) return;
    erroresEnviados++;
    const base = _store.base || _store;
    base.set(`errores/${base.nuevoId('errores')}`, {
        origen: 'web', partida: PARTIDA || 'principal', texto: String(texto).slice(0, 1900), url: (location.pathname + location.search).slice(0, 300),
        uid: _usuario?.uid || null, t: Date.now(), ua: navigator.userAgent.slice(0, 300),
    }).catch(() => { });
}
addEventListener('error', (e) => registrarErrorWeb(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => registrarErrorWeb(`Promesa: ${e.reason?.stack || e.reason}`));

// Ruta real en Firestore (con el prefijo de la partida si hace falta)
export const ruta = (p) => rutaEn(PARTIDA, p);

let _store = null, _auth = null, _fb = null, _offset = 0;
let _usuario = null; // {uid, email, perfil}
const oyentes = new Set();
let listo = null;

export function ahora() { return Date.now() + _offset; }

export function iniciar() {
    if (listo) return listo;
    listo = (async () => {
        if (DEMO) {
            // El estado demo se conserva en la pestaña para poder navegar entre páginas
            let guardado = null;
            try { guardado = JSON.parse(sessionStorage.getItem('fx-demo-estado')); } catch { }
            if (!guardado) {
                const demo = await (await fetch(new URL(`../../data/${FICHEROS_DEMO[demoActivo] || 'demo.json'}`, import.meta.url))).json();
                guardado = { offset: demo.ahora - Date.now(), datos: demo.datos };
            }
            _offset = guardado.offset;
            _store = new MemStore(guardado.datos);
            let t = null;
            const persistir = () => { clearTimeout(t); t = setTimeout(() => { try { sessionStorage.setItem('fx-demo-estado', JSON.stringify({ offset: _offset, datos: _store.volcar() })); } catch { } }, 200); };
            for (const m of ['set', 'merge', 'update', 'del', 'batch']) {
                const orig = _store[m].bind(_store);
                _store[m] = async (...a) => { const r = await orig(...a); persistir(); return r; };
            }
            addEventListener('pagehide', () => { try { sessionStorage.setItem('fx-demo-estado', JSON.stringify({ offset: _offset, datos: _store.volcar() })); } catch { } });
            const eq = (await _store.get('usuarios/u_ana'))?.equipoId ?? 'tramontana';
            _usuario = { uid: 'u_ana', email: 'ana@demo', perfil: { nombre: 'Ana (demo)', isAdmin: true, equipoId: eq, estado: 'aprobado' } };
            return;
        }
        const [{ initializeApp }, authMod, fsMod, { FirestoreStore }, { FIREBASE_CONFIG }] = await Promise.all([
            import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('./store.js'), import('../config.js'),
        ]);
        const app = initializeApp(FIREBASE_CONFIG);
        _auth = authMod.getAuth(app);
        _fb = { ...authMod, ...fsMod };
        _store = new FirestoreStore(fsMod.initializeFirestore(app, { experimentalAutoDetectLongPolling: true }));
        if (PARTIDA) {
            const base = _store;
            _partida = await base.get(`partidas/${PARTIDA}`).catch(() => null);
            if (!_partida || _partida.estado === 'archivada') { salirDePartida(); location.replace(location.pathname + (location.pathname.endsWith('partidas.html') ? '' : '')); await new Promise(() => { }); }
            _store = new StorePartida(base, PARTIDA);
            fijarLigas(_partida.ajustes?.ligas, !_partida.ajustes?.mundial);
        }
        await new Promise(res => {
            let primera = true;
            // Solo se crea el perfil si la lectura ha ido bien y de verdad no existe. Si falla (red, sesión
            // recién renovada…) nunca se escribe: sobrescribiría un perfil existente y quitaría el admin.
            const leerPerfil = async (u) => {
                let perfil = null, leido = true;
                try { perfil = await _store.get(`usuarios/${u.uid}`); } catch { leido = false; }
                if (!perfil && leido) {
                    perfil = { nombre: u.displayName || u.email.split('@')[0], email: u.email, isAdmin: false, equipoId: null, estado: 'pendiente' };
                    await _store.set(`usuarios/${u.uid}`, perfil).catch(() => { });
                }
                if (perfil) guardarPerfil(u.uid, perfil);
                return perfil;
            };
            authMod.onAuthStateChanged(_auth, async (u) => {
                if (u) {
                    // El perfil de la visita anterior sirve para pintar ya; el del servidor llega en segundo plano
                    const guardado = perfilGuardado(u.uid);
                    if (guardado) {
                        _usuario = { uid: u.uid, email: u.email, perfil: guardado };
                        leerPerfil(u).then(p => {
                            if (!p || _usuario?.uid !== u.uid || JSON.stringify(p) === JSON.stringify(guardado)) return;
                            _usuario.perfil = adaptarPerfil(_sombra ? { ...p, equipoId: _sombra } : p);
                            oyentes.forEach(f => f(_usuario));
                        });
                    } else {
                        const perfil = await leerPerfil(u) || { nombre: u.displayName || u.email.split('@')[0], email: u.email, isAdmin: false, equipoId: null, estado: 'pendiente' };
                        _usuario = { uid: u.uid, email: u.email, perfil };
                    }
                    marcarVisita(u.uid);
                    if (PARTIDA) { _miembro = await _store.get(`miembros/${u.uid}`).catch(() => null); _usuario.perfil = adaptarPerfil(_usuario.perfil); }
                    else await sombraAdmin(u.uid);
                } else _usuario = null;
                if (primera) { primera = false; res(); } else oyentes.forEach(f => f(_usuario));
            });
        });
    })();
    return listo;
}

// En una partida de amigos el equipo y el papel de cada uno salen de su ficha de miembro, no del perfil global
function adaptarPerfil(p) {
    if (!PARTIDA || !p) return p;
    return { ...p, equipoId: _miembro?.equipoId || null, estado: 'aprobado', miembro: !!_miembro, adminPartida: (_partida?.admins || []).includes(_usuario?.uid) };
}
export const esMiembro = () => !PARTIDA || !!_miembro;
export const esAdminPartida = () => !!_usuario?.perfil?.isAdmin || !!_usuario?.perfil?.adminPartida;

// Modo sombra: el admin que lleva en secreto una escudería la tiene como suya en todas las páginas, igual que
// cualquier mánager (se deja desde Control). Se recuerda en el navegador y se comprueba en segundo plano.
async function sombraAdmin(uid) {
    if (!_usuario?.perfil?.isAdmin || _usuario.perfil.equipoId) return;
    const clave = `fx-sombra-${uid}`;
    let guardada = null;
    try { guardada = localStorage.getItem(clave) || null; } catch { }
    const leer = () => _store.get('secreto/sombra').then(s => (s?.uid === uid && s.equipoId) || null).catch(() => guardada);
    const aplicar = (eq) => { try { eq ? localStorage.setItem(clave, eq) : localStorage.removeItem(clave); } catch { } if (eq) fijarSombra(eq); };
    if (guardada) {
        aplicar(guardada);
        leer().then(eq => { if (eq !== guardada) { aplicar(eq); location.reload(); } });
    } else aplicar(await leer());
}
export function olvidarSombra() { try { Object.keys(localStorage).filter(k => k.startsWith('fx-sombra-')).forEach(k => localStorage.removeItem(k)); } catch { } _sombra = null; }

// Última visita (como mucho una escritura cada 10 minutos por navegador)
function marcarVisita(uid) {
    try {
        const clave = `fx-v-${uid}`;
        if (Date.now() - (+localStorage.getItem(clave) || 0) < 10 * 60_000) return;
        localStorage.setItem(clave, String(Date.now()));
    } catch { }
    _fb.updateDoc(_fb.doc(_store.db, `usuarios/${uid}`), { ultimoAcceso: Date.now() }).catch(() => { });
}

// Suma minutos de juego (uso.dias.AAAA-MM-DD y uso.horas.H) para calcular cada cuánto llegan las llamadas
export function sumarUso(cambios) {
    if (!_usuario || DEMO || !_fb) return Promise.resolve();
    const data = {};
    for (const [k, v] of Object.entries(cambios)) data[`uso.${k}`] = _fb.increment(v);
    return _fb.updateDoc(_fb.doc(_store.db, `usuarios/${_usuario.uid}`), data);
}

export const store = () => _store;
export const usuario = () => _usuario;
export const onUsuario = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
export const esAdmin = () => !!_usuario?.perfil?.isAdmin;
// ¿Es del grupo de la liga original? (aprobado, con escudería o administración). La liga original es privada:
// el resto de gente solo ve la landing y sus propias partidas.
export const esMiembroOriginal = () => { const p = _usuario?.perfil; return !!p && (!!p.isAdmin || p.estado === 'aprobado' || !!p.equipoId); };

// Perfil guardado en el navegador (solo para pintar antes; el servidor siempre manda)
function perfilGuardado(uid) { try { return JSON.parse(localStorage.getItem(`fx-perfil-${uid}`)); } catch { return null; } }
function guardarPerfil(uid, p) { try { localStorage.setItem(`fx-perfil-${uid}`, JSON.stringify(p)); } catch { } }

export async function refrescarPerfil() {
    if (!_usuario || DEMO) return _usuario;
    const p = await _store.get(`usuarios/${_usuario.uid}`).catch(() => _usuario.perfil);
    if (p) { _usuario.perfil = p; guardarPerfil(_usuario.uid, p); }
    if (PARTIDA) { _miembro = await _store.get(`miembros/${_usuario.uid}`).catch(() => _miembro); _usuario.perfil = adaptarPerfil(_usuario.perfil); }
    if (_sombra) _usuario.perfil = { ..._usuario.perfil, equipoId: _sombra };
    return _usuario;
}

// Modo sombra (solo admin): dirigir en secreto una escudería que los demás ven como de la IA
let _sombra = null;
export function fijarSombra(equipoId) {
    _sombra = equipoId;
    if (_usuario?.perfil) _usuario.perfil = { ..._usuario.perfil, equipoId };
}
export const enSombra = () => !!_sombra;

export async function entrar(email, password) {
    if (DEMO) return;
    await _fb.signInWithEmailAndPassword(_auth, email, password);
}
// estado 'publico': cuenta creada desde la landing (para jugar en partidas de amigos); no entra en la cola de la liga original
export async function registrar(nombre, email, password, estado = 'pendiente') {
    if (DEMO) return;
    const cred = await _fb.createUserWithEmailAndPassword(_auth, email, password);
    await _store.set(`usuarios/${cred.user.uid}`, { nombre, email, isAdmin: false, equipoId: null, estado: estado === 'publico' ? 'publico' : 'pendiente', creado: Date.now() });
}
export async function recuperar(email) {
    if (DEMO) return;
    await _fb.sendPasswordResetEmail(_auth, email);
}
export async function salir() {
    if (DEMO) { try { sessionStorage.removeItem('fx-demo'); sessionStorage.removeItem('fx-demo-estado'); } catch { } location.href = 'index.html'; return; }
    await _fb.signOut(_auth);
    location.href = 'index.html';
}

// Reclamar un equipo: escritura atómica equipo + perfil (validada por las reglas)
export async function reclamarEquipo(equipoId, nombreManager) {
    const u = _usuario;
    if (DEMO) { u.perfil.equipoId = equipoId; return; }
    const { writeBatch, doc } = _fb;
    const db = _store.db;
    // Si de verdad está cogida, avisamos antes de intentarlo
    const actual = await _store.get(`equipos/${equipoId}`);
    if (actual?.ownerId && actual.ownerId !== u.uid) throw Object.assign(new Error('Esa escudería ya tiene mánager.'), { code: 'ocupada' });
    const b = writeBatch(db);
    b.update(doc(db, ruta(`equipos/${equipoId}`)), { ownerId: u.uid, ownerNombre: nombreManager || u.email.split('@')[0] });
    // En una partida de amigos el equipo se guarda en la ficha de miembro; en la original, en el perfil
    if (PARTIDA) b.update(doc(db, ruta(`miembros/${u.uid}`)), { equipoId });
    else b.update(doc(db, `usuarios/${u.uid}`), { equipoId });
    try { await b.commit(); }
    catch (e) {
        if (e.code === 'permission-denied') throw Object.assign(new Error('Firebase no ha dejado guardar el cambio. Comprueba que tu cuenta está aprobada, que la inscripción está abierta y que las reglas de Firestore están actualizadas.'), { code: e.code });
        throw e;
    }
    u.perfil.equipoId = equipoId;
    await _store.set(`acciones/${_store.nuevoId('acciones')}`, { uid: u.uid, equipoId, tipo: 'reclamar', params: {}, creado: Date.now(), estado: 'pendiente' });
}

// Encola una acción para el servidor
export async function encolar(tipo, params = {}) {
    const u = _usuario;
    if (!u?.perfil?.equipoId) throw new Error('No diriges ningún equipo');
    const id = _store.nuevoId('acciones');
    await _store.set(`acciones/${id}`, { uid: u.uid, equipoId: u.perfil.equipoId, tipo, params, creado: ahora(), estado: 'pendiente' });
    return id;
}

// Escucha en tiempo real (solo Firestore); en demo hace polling barato
export function escuchar(path, cb) {
    if (DEMO || !_fb) {
        let vivo = true;
        const f = async () => { if (!vivo) return; cb(await _store.get(path)); setTimeout(f, 3000); };
        f();
        return () => { vivo = false; };
    }
    return _fb.onSnapshot(_fb.doc(_store.db, ruta(path)), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => { });
}
export function escucharConsulta(coll, filtros, cb) {
    if (DEMO || !_fb) {
        let vivo = true;
        const f = async () => { if (!vivo) return; cb(await _store.list(coll, filtros)); setTimeout(f, 3000); };
        f();
        return () => { vivo = false; };
    }
    const q = _fb.query(_fb.collection(_store.db, ruta(coll)), ...filtros.map(([c, o, v]) => _fb.where(c, o, v)));
    return _fb.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
}
