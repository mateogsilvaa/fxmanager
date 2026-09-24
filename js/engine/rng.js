// Aleatoriedad determinista (misma semilla => mismo resultado)

export function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    // mezcla final
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
}

export function crearRng(semilla) {
    let a = typeof semilla === 'number' ? semilla >>> 0 : hash32(String(semilla));
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = {
        next,
        range: (min, max) => min + next() * (max - min),
        int: (min, max) => Math.floor(min + next() * (max - min + 1)),
        chance: (p) => next() < p,
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        gauss: (media = 0, sd = 1) => {
            let u = 0, v = 0;
            while (u === 0) u = next();
            while (v === 0) v = next();
            return media + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        },
        shuffle: (arr) => {
            const a2 = arr.slice();
            for (let i = a2.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [a2[i], a2[j]] = [a2[j], a2[i]];
            }
            return a2;
        },
        weighted: (items, pesoFn) => {
            const pesos = items.map(pesoFn);
            const total = pesos.reduce((s, p) => s + p, 0);
            let r = next() * total;
            for (let i = 0; i < items.length; i++) { r -= pesos[i]; if (r <= 0) return items[i]; }
            return items[items.length - 1];
        },
    };
    return rng;
}
