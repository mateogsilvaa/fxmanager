// Almacén en memoria con la misma interfaz que FirestoreStore (pruebas y modo demo)
const copia = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

function fusionar(dst, src) {
    for (const [k, v] of Object.entries(src)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) fusionar(dst[k], v);
        else dst[k] = copia(v);
    }
    return dst;
}

export class MemStore {
    constructor(datos = {}) { this.d = copia(datos); this.lecturas = 0; this.escrituras = 0; this._n = 0; }

    _split(path) { const i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; }

    async get(path) {
        this.lecturas++;
        const [c, id] = this._split(path);
        const v = this.d[c]?.[id];
        return v ? { id, ...copia(v) } : null;
    }

    async list(coll, filtros = [], { limit, orden } = {}) {
        let out = Object.entries(this.d[coll] || {}).map(([id, v]) => ({ id, ...copia(v) }));
        for (const [campo, op, valor] of filtros) {
            out = out.filter(x => {
                const v = campo.split('.').reduce((o, k) => o?.[k], x);
                if (op === '==') return v === valor;
                if (op === '!=') return v !== valor;
                if (op === '<=') return v <= valor;
                if (op === '<') return v < valor;
                if (op === '>=') return v >= valor;
                if (op === '>') return v > valor;
                if (op === 'in') return valor.includes(v);
                return true;
            });
        }
        if (orden) {
            const [campo, dir] = orden;
            out.sort((a, b) => (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
        }
        if (limit) out = out.slice(0, limit);
        this.lecturas += Math.max(1, out.length);
        return out;
    }

    async set(path, data) { this.escrituras++; const [c, id] = this._split(path); (this.d[c] ||= {})[id] = copia(data); }
    async merge(path, data) { this.escrituras++; const [c, id] = this._split(path); (this.d[c] ||= {}); this.d[c][id] = fusionar(this.d[c][id] || {}, data); }
    async update(path, data) {
        this.escrituras++;
        const [c, id] = this._split(path);
        const obj = this.d[c]?.[id];
        if (!obj) throw new Error(`No existe ${path}`);
        for (const [k, v] of Object.entries(data)) {
            const partes = k.split('.');
            let o = obj;
            for (const p of partes.slice(0, -1)) o = (o[p] ||= {});
            if (v === undefined) continue;
            o[partes[partes.length - 1]] = copia(v);
        }
    }
    async del(path) { this.escrituras++; const [c, id] = this._split(path); if (this.d[c]) delete this.d[c][id]; }
    async batch(ops) {
        for (const o of ops) {
            if (o.op === 'set') await this.set(o.path, o.data);
            else if (o.op === 'merge') await this.merge(o.path, o.data);
            else if (o.op === 'update') await this.update(o.path, o.data);
            else if (o.op === 'del') await this.del(o.path);
        }
    }
    nuevoId() { return 'm' + Date.now().toString(36) + (this._n++).toString(36) + Math.random().toString(36).slice(2, 6); }
    volcar() { return copia(this.d); }
}
