// Ramas de desarrollo del coche (desde la temporada 2): elegir camino en cada bifurcación del árbol.
import { AREAS } from '../engine/constants.js';
import { crearRng } from '../engine/rng.js';
import { RAMAS, TIERS, COSTE_CAMBIO_RAMA, opcionRama, ramasPendientes, eleccionIA } from '../engine/ramas.js';
import { movimiento, duenoReal, jornadaEnCurso, cargarEventos } from './comun.js';

const activas = (cfg) => (cfg?.temporada || 1) >= 2 || cfg?.novedades === true;
const M = (v) => `${(v / 1e6).toFixed(2).replace('.', ',')} M€`;

// La IA elige sola sus caminos cuando desbloquea una bifurcación
export function ramasIA(ctx, dia) {
    if (!activas(ctx.cfg)) return;
    for (const [eq, priv] of Object.entries(ctx.privs || {})) {
        if (duenoReal(ctx, eq)) continue;
        const pend = ramasPendientes(priv);
        if (!pend.length) continue;
        const rng = crearRng(`${ctx.secreto}|ramaIA|${dia}|${eq}`);
        priv.ramas ||= {};
        for (const { area, tier } of pend) priv.ramas[area] = { ...(priv.ramas[area] || {}), [tier]: eleccionIA(rng, area, tier) };
        ctx.sucios.privs.add(eq);
    }
}

export const ACCIONES_RAMAS = {
    // { area, tier, opcion }. Elegir es gratis; cambiar un camino ya elegido cuesta un rediseño.
    async rama_elegir(ctx, a) {
        if (!activas(ctx.cfg)) throw new Error('Las ramas de desarrollo llegan la próxima temporada.');
        const { area, opcion } = a.params || {};
        const tier = +a.params?.tier;
        if (!AREAS[area] || !TIERS.includes(tier) || !opcionRama(area, tier, opcion)) throw new Error('Rama no válida.');
        const priv = ctx.privs[a.equipoId];
        if (!priv) throw new Error('Escudería sin datos');
        if ((priv.coche?.[area] || 0) < tier) throw new Error(`Necesitas el nivel ${tier} de ${AREAS[area].nombre.toLowerCase()}.`);
        const actual = priv.ramas?.[area]?.[tier];
        if (actual === opcion) throw new Error('Ya tienes ese camino.');
        let coste = 0;
        if (actual) {
            const pc = jornadaEnCurso(await cargarEventos(ctx, ctx.cfg.temporada), [ctx.equipos[a.equipoId]?.liga], ctx.ahora);
            if (pc) throw new Error('Parque cerrado: no se puede rediseñar el coche durante la jornada.');
            coste = COSTE_CAMBIO_RAMA;
            if ((priv.presupuesto || 0) < coste) throw new Error(`Rediseñar cuesta ${M(coste)}.`);
            movimiento(priv, `Rediseño: ${AREAS[area].nombre} → ${opcionRama(area, tier, opcion).nombre}`, -coste, ctx.ahora);
        }
        priv.ramas = { ...(priv.ramas || {}), [area]: { ...(priv.ramas?.[area] || {}), [tier]: opcion } };
        ctx.sucios.privs.add(a.equipoId);
        return { ok: true, coste };
    },
};
void RAMAS;
