// Avisos en el móvil (Web Push): permiso, suscripción y guardado en Firestore
import { VAPID_PUBLIC_KEY } from '../config.js';
import { store, usuario, DEMO } from './app.js';

const soportado = () => !DEMO && !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'activo' | 'inactivo' | 'bloqueado' | 'ios-instalar' | 'no-soportado'
export async function estadoAvisos() {
    if (DEMO || !VAPID_PUBLIC_KEY) return 'no-soportado';
    if (esIOS() && !instalada()) return 'ios-instalar';
    if (!soportado()) return 'no-soportado';
    if (Notification.permission === 'denied') { marcarRechazo('bloqueado'); return 'bloqueado'; }
    if (Notification.permission !== 'granted') return 'inactivo';
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return 'inactivo';
    await guardar(sub).catch(() => { });
    return 'activo';
}

export async function activarAvisos() {
    if (!soportado()) throw new Error('Este navegador no admite avisos.');
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { marcarRechazo(permiso === 'denied' ? 'bloqueado' : 'sin permiso'); throw new Error('No has dado permiso para los avisos.'); }
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLIC_KEY) });
    await guardar(sub);
}

async function guardar(sub) {
    const u = usuario();
    if (!u) return;
    const ref = `suscripciones/${u.uid}`;
    const json = sub.toJSON();
    const doc = await store().get(ref).catch(() => null);
    if (doc?.subs?.some(s => s.endpoint === json.endpoint)) return;
    const subs = [...(doc?.subs || []), { endpoint: json.endpoint, keys: json.keys, creado: Date.now() }].slice(-5);
    await store().merge(ref, { uid: u.uid, subs, actualizado: Date.now(), rechazo: null });
}

// Guarda que la persona no quiere avisos (para el panel de control); una vez por navegador y motivo
export function marcarRechazo(motivo) {
    const u = usuario();
    if (!u || DEMO) return;
    const clave = `fx-rechazo-${u.uid}-${motivo}`;
    try { if (localStorage.getItem(clave)) return; localStorage.setItem(clave, '1'); } catch { }
    store().merge(`suscripciones/${u.uid}`, { uid: u.uid, rechazo: motivo, rechazoFecha: Date.now() }).catch(() => { });
}

function aBytes(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}
