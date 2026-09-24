// Adaptador Firestore con una interfaz mínima común (la misma que MemStore)
import {
    doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit as qLimit, writeBatch,
} from 'firebase/firestore';

export class FirestoreStore {
    constructor(db) { this.db = db; this.lecturas = 0; this.escrituras = 0; }

    async get(path) {
        const s = await getDoc(doc(this.db, path));
        this.lecturas++;
        return s.exists() ? { id: s.id, ...s.data() } : null;
    }

    // filtros: [[campo, '==', valor], ...]
    // orden: [campo, 'asc'|'desc']
    async list(coll, filtros = [], { limit, orden } = {}) {
        const cons = filtros.map(([c, op, v]) => where(c, op, v));
        if (orden) cons.push(orderBy(orden[0], orden[1] || 'asc'));
        if (limit) cons.push(qLimit(limit));
        const s = await getDocs(query(collection(this.db, coll), ...cons));
        this.lecturas += Math.max(1, s.size);
        return s.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async set(path, data) { this.escrituras++; await setDoc(doc(this.db, path), limpiar(data)); }
    async merge(path, data) { this.escrituras++; await setDoc(doc(this.db, path), limpiar(data), { merge: true }); }
    // update admite claves con puntos: {'sesiones.R1.estado': 'simulada'}
    async update(path, data) { this.escrituras++; await updateDoc(doc(this.db, path), limpiar(data)); }
    async del(path) { this.escrituras++; await deleteDoc(doc(this.db, path)); }

    // ops: [{op:'set'|'merge'|'update'|'del', path, data}]
    async batch(ops) {
        for (let i = 0; i < ops.length; i += 400) {
            const b = writeBatch(this.db);
            for (const o of ops.slice(i, i + 400)) {
                const ref = doc(this.db, o.path);
                if (o.op === 'set') b.set(ref, limpiar(o.data));
                else if (o.op === 'merge') b.set(ref, limpiar(o.data), { merge: true });
                else if (o.op === 'update') b.update(ref, limpiar(o.data));
                else if (o.op === 'del') b.delete(ref);
            }
            await b.commit();
            this.escrituras += Math.min(400, ops.length - i);
        }
    }

    nuevoId(coll) { return doc(collection(this.db, coll)).id; }
}

// Firestore no acepta undefined
export function limpiar(v) {
    if (Array.isArray(v)) return v.map(limpiar);
    if (v && typeof v === 'object' && !(v instanceof Date) && v.constructor === Object) {
        const o = {};
        for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = limpiar(x);
        return o;
    }
    return v;
}
