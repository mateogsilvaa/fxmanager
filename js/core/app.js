// Arranque común de todas las páginas: Firebase (o modo demo), usuario y reloj
import { MemStore } from './memstore.js';

const params = new URLSearchParams(location.search);
if (params.has('demo')) { try { localStorage.setItem('fx-demo', params.get('demo') === '0' ? '' : '1'); if (params.get('demo') === '0') sessionStorage.removeItem('fx-demo-estado'); } catch { } }
let demoActivo = false;
try { demoActivo = localStorage.getItem('fx-demo') === '1'; } catch { }
export const DEMO = demoActivo;

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
                const demo = await (await fetch(new URL('../../data/demo.json', import.meta.url))).json();
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
            const eq = (await _store.get('usuarios/u_ana'))?.equipoId ?? 'valcor-es';
            _usuario = { uid: 'u_ana', email: 'ana@demo', perfil: { nombre: 'Ana (demo)', isAdmin: true, equipoId: eq, estado: 'aprobado' } };
            return;
        }
        const [{ initializeApp }, authMod, fsMod, { FirestoreStore }, { FIREBASE_CONFIG }] = await Promise.all([
            import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('./store.js'), import('../config.js'),
        ]);
        const app = initializeApp(FIREBASE_CONFIG);
        _auth = authMod.getAuth(app);
        _fb = { ...authMod, ...fsMod };
        _store = new FirestoreStore(fsMod.getFirestore(app));
        await new Promise(res => {
            let primera = true;
            authMod.onAuthStateChanged(_auth, async (u) => {
                if (u) {
                    let perfil = await _store.get(`usuarios/${u.uid}`).catch(() => null);
                    if (!perfil) {
                        perfil = { nombre: u.displayName || u.email.split('@')[0], email: u.email, isAdmin: false, equipoId: null, estado: 'pendiente' };
                        await _store.set(`usuarios/${u.uid}`, perfil).catch(() => { });
                    }
                    _usuario = { uid: u.uid, email: u.email, perfil };
                } else _usuario = null;
                if (primera) { primera = false; res(); } else oyentes.forEach(f => f(_usuario));
            });
        });
    })();
    return listo;
}

export const store = () => _store;
export const usuario = () => _usuario;
export const onUsuario = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
export const esAdmin = () => !!_usuario?.perfil?.isAdmin;

export async function refrescarPerfil() {
    if (!_usuario || DEMO) return _usuario;
    _usuario.perfil = await _store.get(`usuarios/${_usuario.uid}`);
    return _usuario;
}

export async function entrar(email, password) {
    if (DEMO) return;
    await _fb.signInWithEmailAndPassword(_auth, email, password);
}
export async function registrar(nombre, email, password) {
    if (DEMO) return;
    const cred = await _fb.createUserWithEmailAndPassword(_auth, email, password);
    await _store.set(`usuarios/${cred.user.uid}`, { nombre, email, isAdmin: false, equipoId: null, estado: 'pendiente', creado: Date.now() });
}
export async function recuperar(email) {
    if (DEMO) return;
    await _fb.sendPasswordResetEmail(_auth, email);
}
export async function salir() {
    if (DEMO) { try { localStorage.removeItem('fx-demo'); sessionStorage.removeItem('fx-demo-estado'); } catch { } location.href = 'index.html'; return; }
    await _fb.signOut(_auth);
    location.href = 'index.html';
}

// Reclamar un equipo: escritura atómica equipo + perfil (validada por las reglas)
export async function reclamarEquipo(equipoId, nombreManager) {
    const u = _usuario;
    if (DEMO) { u.perfil.equipoId = equipoId; return; }
    const { writeBatch, doc } = _fb;
    const db = _store.db;
    const b = writeBatch(db);
    b.update(doc(db, `equipos/${equipoId}`), { ownerId: u.uid, ownerNombre: nombreManager });
    b.update(doc(db, `usuarios/${u.uid}`), { equipoId });
    await b.commit();
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
    return _fb.onSnapshot(_fb.doc(_store.db, path), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => { });
}
export function escucharConsulta(coll, filtros, cb) {
    if (DEMO || !_fb) {
        let vivo = true;
        const f = async () => { if (!vivo) return; cb(await _store.list(coll, filtros)); setTimeout(f, 3000); };
        f();
        return () => { vivo = false; };
    }
    const q = _fb.query(_fb.collection(_store.db, coll), ...filtros.map(([c, o, v]) => _fb.where(c, o, v)));
    return _fb.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
}
