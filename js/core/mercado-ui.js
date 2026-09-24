// Ayudas del mercado para la interfaz (misma lógica de elegibilidad que el motor)
import { NAC_LOCAL } from '../engine/constants.js';
import { MERCADO } from '../engine/mercado.js';
import { calcularRiesgo } from '../engine/stats.js';

// Un piloto puede cambiar de liga si su compañero es local (la escudería conserva a su Piloto 1)
function puedeSalir(d, pid) {
    const p = d.piloto(pid);
    if (!p?.equipoId) return false;
    const comp = Object.entries(d.cat.pilotos).find(([id, o]) => o.equipoId === p.equipoId && id !== pid);
    return !!comp && comp[1].nac === NAC_LOCAL[p.liga];
}

function enRiesgo(d, liga) {
    if (!d.sesionesLiga(liga).length) return new Set();
    return new Set(calcularRiesgo(d.tabla(liga), d.pilotosLiga(liga)).filter(r => r.zona === 'despido' || (r.zona === 'peligro' && r.caeria)).map(r => r.pid));
}
function companeroDe(d, pid) {
    const p = d.piloto(pid);
    return Object.entries(d.cat.pilotos).find(([id, o]) => o.equipoId === p?.equipoId && id !== pid)?.[0];
}

// Pilotos del top 5 actual de una liga que podrían ser su Galáctico (su compañero local no puede estar en zona de despido)
export function candidatosGalactico(d, liga) {
    if (!d.sesionesLiga(liga).length) return [];
    const riesgo = enRiesgo(d, liga);
    return d.clasificacionPilotos(liga).slice(0, MERCADO.topGalactico)
        .filter(s => puedeSalir(d, s.pid) && !riesgo.has(companeroDe(d, s.pid)))
        .map(s => ({ pid: s.pid, eq: d.piloto(s.pid)?.equipoId, pos: s.posicion, pts: s.pts, liga }));
}

// Pilotos de mi escudería que pueden salir como Táctico (fuera del top 5)
export function tacticosDisponibles(d, eqId) {
    const eq = d.equipo(eqId);
    if (!eq) return [];
    const clas = d.clasificacionPilotos(eq.liga);
    // Un piloto en zona de despido no sirve de Táctico: si le despiden, la oferta no vale
    const riesgo = enRiesgo(d, eq.liga);
    return Object.entries(d.cat.pilotos).filter(([, p]) => p.equipoId === eqId).map(([id]) => id)
        .filter(id => puedeSalir(d, id) && !riesgo.has(id) && !riesgo.has(companeroDe(d, id)) && (clas.find(s => s.pid === id)?.posicion || 99) > MERCADO.topGalactico);
}

export function puedePedirGalactico(d, eqId) {
    const eq = d.equipo(eqId);
    if (!eq) return { puede: false, pos: null };
    const pos = d.clasificacionEquipos(eq.liga).find(e => e.eq === eqId)?.posicion || null;
    return { puede: !!pos && pos <= MERCADO.topComprador, pos };
}

export { MERCADO };
