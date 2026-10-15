// Partidas: cada liga de amigos vive aislada en partidas/{id}/<coleccion>/<doc>, con la misma estructura que la
// partida original (que sigue en las colecciones raíz). Este envoltorio añade el prefijo a todas las rutas del juego
// para que el motor, el worker y las páginas funcionen igual sin saber en qué partida están.
// Las colecciones globales (cuentas, partidas, errores…) no llevan prefijo.
export const GLOBALES = new Set(['usuarios', 'suscripciones', 'avisos_admin', 'partidas', 'partidas_priv', 'errores']);
export const PRINCIPAL = '';

export class StorePartida {
    constructor(base, pid) { this.base = base; this.pid = pid; this.pre = `partidas/${pid}/`; }
    ruta(p) { return GLOBALES.has(String(p).split('/')[0]) ? p : this.pre + p; }
    get db() { return this.base.db; }
    get lecturas() { return this.base.lecturas; }
    get escrituras() { return this.base.escrituras; }
    get(p) { return this.base.get(this.ruta(p)); }
    list(c, f, o) { return this.base.list(this.ruta(c), f, o); }
    set(p, d) { return this.base.set(this.ruta(p), d); }
    merge(p, d) { return this.base.merge(this.ruta(p), d); }
    update(p, d) { return this.base.update(this.ruta(p), d); }
    del(p) { return this.base.del(this.ruta(p)); }
    batch(ops) { return this.base.batch(ops.map(o => ({ ...o, path: this.ruta(o.path) }))); }
    nuevoId(c) { return this.base.nuevoId(this.ruta(c)); }
}
export const storeDe = (base, pid) => pid ? new StorePartida(base, pid) : base;
export const rutaEn = (pid, p) => pid && !GLOBALES.has(String(p).split('/')[0]) ? `partidas/${pid}/${p}` : p;
