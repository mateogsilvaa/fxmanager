// Mánagers de la IA: nombres y noticias de prensa sobre ellos
import { NAC_LOCAL } from './constants.js';
import { NOMBRES, EXTRANJEROS, nombreAleatorio } from './nombres.js';

export const conIA = (nombre) => `${nombre} (IA)`;

// Nombre del mánager de una escudería de la IA (casi siempre de la nacionalidad de su liga)
export function nombreManagerIA(rng, liga, usados = new Set()) {
    const nac = rng.chance(0.8) ? NAC_LOCAL[liga] || 'gb' : rng.pick(EXTRANJEROS[liga] || ['gb']);
    const { nombre, apellido } = nombreAleatorio(rng, NOMBRES[nac] ? nac : 'gb', usados);
    return `${nombre} ${apellido}`;
}

const cita = (rng, lista) => rng.pick(lista);

// Genera una noticia sobre un mánager de la IA.
// eq: {id, nombre, liga, managerIA}; pos: puesto en la liga (o null); rival: {nombre, manager} de la misma liga
// Devuelve {titulo, texto, tipo, espia?: equipoId objetivo}
export function noticiaManagerIA(rng, { eq, pos, n, rival, piloto, carreras }) {
    const m = conIA(eq.managerIA);
    const opciones = [];
    // Espionaje (tiene efectos: la escudería pierde fans y el espiado recibe un aviso)
    if (rival) opciones.push(['espia', 3, () => ({
        titulo: `${m} pillado espiando a ${rival.nombre}`,
        texto: cita(rng, [
            `Personal de ${eq.nombre} fue sorprendido fotografiando el coche de ${rival.nombre} en el taller. ${eq.managerIA} lo niega todo.`,
            `Seguridad de ${rival.nombre} ha expulsado a dos ingenieros de ${eq.nombre}. Todo apunta a una misión ordenada por ${eq.managerIA}.`,
            `Escándalo en el paddock: ${eq.managerIA}, mánager de ${eq.nombre}, habría intentado hacerse con los datos de telemetría de ${rival.nombre}.`,
        ]),
        tipo: 'rumor', espia: rival.id,
    })]);
    // Declaraciones según cómo le va
    if (pos != null && carreras) {
        if (pos <= 2) opciones.push(['decl', 3, () => ({
            titulo: `${m}: "${cita(rng, ['Este año el título es nuestro', 'No vamos a levantar el pie', 'Somos la referencia y lo vamos a demostrar'])}"`,
            texto: `El mánager de ${eq.nombre}, ahora ${pos}º en la liga, se muestra muy confiado de cara a lo que queda de temporada.`, tipo: 'noticia',
        })]);
        else if (pos >= n - 2) opciones.push(['crisis', 3, () => ({
            titulo: rng.chance(0.5) ? `Se tambalea el puesto de ${m}` : `${m} pide calma en ${eq.nombre}`,
            texto: `${eq.nombre} es ${pos}º y en la fábrica ya se habla de cambios. ${eq.managerIA} insiste en que el proyecto necesita tiempo.`, tipo: 'rumor',
        })]);
        else opciones.push(['decl', 2, () => ({
            titulo: `${m}: "${cita(rng, ['Estamos más cerca de lo que parece', 'Nos falta un paso para pelear arriba', 'El coche va a mejorar mucho en las próximas jornadas'])}"`,
            texto: `${eq.nombre} es ${pos}º en la liga y su mánager cree que todavía puede escalar posiciones.`, tipo: 'noticia',
        })]);
    }
    // Contra un rival (si lo dirige un mánager real, más picante)
    if (rival) opciones.push(['pique', 2, () => ({
        titulo: `${m} carga contra ${rival.manager || rival.nombre}`,
        texto: cita(rng, [
            `"${rival.nombre} habla mucho y corre poco", ha dicho ${eq.managerIA} en la rueda de prensa.`,
            `${eq.managerIA} acusa a ${rival.nombre} de jugar al límite del reglamento: "Que miren bien su coche".`,
            `"No me preocupa ${rival.nombre}. Nos preocupamos de nosotros", responde ${eq.managerIA}, con cierto retintín.`,
        ]), tipo: 'rumor',
    })]);
    // Tensión con un piloto
    if (piloto && carreras) opciones.push(['bronca', 2, () => ({
        titulo: `Tensión en ${eq.nombre}: ${m} y ${piloto} no se hablan`,
        texto: `Según fuentes del equipo, ${eq.managerIA} y ${piloto} discutieron a gritos en el box tras la última carrera.`, tipo: 'rumor',
    })]);
    // Inversiones y fichajes de personal
    opciones.push(['inversion', 2, () => ({
        titulo: cita(rng, [`${m} anuncia una ampliación de la fábrica`, `${eq.nombre} ficha a un ingeniero de renombre`, `${m} consigue más presupuesto para ${eq.nombre}`]),
        texto: cita(rng, [
            `${eq.managerIA} quiere que ${eq.nombre} dé un salto en el desarrollo del coche en las próximas semanas.`,
            `"Queremos ser la escudería que más evoluciona", asegura ${eq.managerIA}.`,
        ]), tipo: 'noticia',
    })]);
    const total = opciones.reduce((s, o) => s + o[1], 0);
    let r = rng.next() * total;
    for (const [, peso, f] of opciones) { r -= peso; if (r <= 0) return f(); }
    return opciones[0][2]();
}
