// Documento "catalogo/actual": toda la información pública en una sola lectura
export async function reconstruirCatalogo(store, cfg) {
    const temporada = cfg?.temporada || 1;
    const [equipos, pilotos, eventos] = await Promise.all([
        store.list('equipos'), store.list('pilotos'), store.list('eventos', [['temporada', '==', temporada]]),
    ]);
    const cat = {
        temporada, actualizado: Date.now(),
        equipos: Object.fromEntries(equipos.map(e => [e.id, {
            nombre: e.nombre, corto: e.corto || e.nombre, liga: e.liga, grupo: e.grupo || null, color: e.color || '#888',
            ownerId: e.ownerId || null, ownerNombre: e.ownerNombre || null, fans: e.fans || 0,
        }])),
        // todos los pilotos (también retirados) para poder mostrar las estadísticas históricas
        pilotos: Object.fromEntries(pilotos.map(p => [p.id, {
            nombre: p.nombre, apellido: p.apellido, nac: p.nac, numero: p.numero ?? null, equipoId: p.equipoId || null,
            liga: p.liga || null, rol: p.rol || 'P2', edad: p.edad ?? null, rookie: !!p.rookie, estado: p.estado || 'activo',
        }])),
        eventos: Object.fromEntries(eventos.map(ev => [ev.id, {
            liga: ev.liga, temporada: ev.temporada, ronda: ev.ronda, fase: ev.fase || 'nacional',
            circuito: ev.circuito, meteo: ev.meteo || {},
            sesiones: Object.fromEntries(Object.entries(ev.sesiones || {}).map(([t, s]) => [t, { publishAt: s.publishAt, lockAt: s.lockAt, revealAt: s.revealAt }])),
        }])),
    };
    await store.set('catalogo/actual', cat);
    return cat;
}
