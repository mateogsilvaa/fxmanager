// Rating de mánager (0–100): cómo de bien ha dirigido su escudería en una temporada.
// Mismo cálculo en la web (temporada en curso) y en el worker (se guarda al acabar cada temporada).
//
//   40% posición final en su liga · 25% puntos respecto al líder · 15% pilotos en el Mundial
//   10% éxitos (título, victorias y podios) · 10% fans respecto a su liga
// Escala: 20 = el peor posible, 100 = temporada perfecta.

export const PESOS_RATING = { pos: 0.40, pts: 0.25, mundial: 0.15, exito: 0.10, fans: 0.10 };

// clas: [{eq, posicion, pts, victorias, podios}] con TODAS las escuderías de la liga
// fans: {eq: n} · mundial: {eq: pilotos clasificados}
export function ratingsLiga(clas, { fans = {}, mundial = {} } = {}) {
    const n = clas.length;
    if (!n || !clas.some(e => e.pts > 0)) return {};
    const lider = Math.max(1, ...clas.map(e => e.pts || 0));
    const porFans = clas.map(e => fans[e.eq] || 0).sort((a, b) => a - b);
    const out = {};
    for (const e of clas) {
        const f = fans[e.eq] || 0;
        const partes = {
            pos: n > 1 ? (n - e.posicion) / (n - 1) : 1,
            pts: (e.pts || 0) / lider,
            mundial: Math.min(1, (mundial[e.eq] || 0) / 2),
            exito: e.posicion === 1 ? 1 : Math.min(1, ((e.victorias || 0) * 2 + (e.podios || 0)) / 12),
            fans: n > 1 ? porFans.filter(x => x < f).length / (n - 1) : 1,
        };
        const suma = Object.entries(PESOS_RATING).reduce((s, [k, w]) => s + w * partes[k], 0);
        out[e.eq] = { rating: Math.round(20 + 80 * suma), partes };
    }
    return out;
}

// Rating de carrera: media de sus temporadas, pesando más las recientes
export function ratingCarrera(historial) {
    const h = (historial || []).filter(x => x.rating != null).sort((a, b) => a.temporada - b.temporada);
    if (!h.length) return null;
    let s = 0, w = 0;
    h.forEach((x, i) => { const p = 1 + i * 0.5; s += x.rating * p; w += p; });
    return Math.round(s / w);
}

export function nivelRating(r) {
    if (r == null) return '—';
    return r >= 90 ? 'Leyenda' : r >= 80 ? 'Élite' : r >= 70 ? 'Muy bueno' : r >= 60 ? 'Bueno' : r >= 45 ? 'Correcto' : r >= 35 ? 'Flojo' : 'En apuros';
}
