// Ruedas de prensa: preguntas a los mánagers según lo que pasa en pista, y sus efectos.
// Cada opción: texto (lo que dices), fans [min, max], moral (para el piloto de la pregunta), companero (moral del otro piloto)

export const PLANTILLAS = {
    accidente: {
        pregunta: (c) => `${c.piloto} se ha ido contra las protecciones en la ${c.sesion} de ${c.circuito}. ¿Qué le dices?`,
        contexto: (c) => `Preguntado por el accidente de ${c.piloto} en la ${c.sesion} de ${c.circuito}`,
        opciones: [
            { id: 'apoyo', texto: 'Son cosas de las carreras. Tiene toda mi confianza.', fans: [4, 14], moral: 7 },
            { id: 'critica', texto: 'Tiene que aprender. Hoy nos ha costado muchos puntos.', fans: [-12, 28], moral: -10 },
            { id: 'coche', texto: 'El coche era muy difícil de llevar. La culpa es nuestra.', fans: [-6, 10], moral: 4 },
            { id: 'nada', texto: 'Prefiero no hablar de eso.', fans: [-10, 2] },
        ],
    },
    toque: {
        pregunta: (c) => `${c.piloto} y ${c.rival} (${c.equipoRival}) se tocaron en la vuelta ${c.vuelta} de la ${c.sesion}. ¿De quién fue la culpa?`,
        contexto: (c) => `Sobre el toque entre ${c.piloto} y ${c.rival} en la ${c.sesion} de ${c.circuito}`,
        opciones: [
            { id: 'rival', texto: (c) => `De ${c.rivalApellido}. Fue una maniobra temeraria.`, fans: [-5, 35], moral: 5 },
            { id: 'incidente', texto: 'Incidente de carrera. Nada más.', fans: [4, 12] },
            { id: 'nuestro', texto: (c) => `Se equivocó ${c.pilotoApellido}. Pediremos disculpas a ${c.equipoRival}.`, fans: [-4, 16], moral: -6 },
            { id: 'sancion', texto: 'Que lo miren los comisarios. Debería haber sanción.', fans: [-10, 25], moral: 2 },
        ],
    },
    averia: {
        pregunta: (c) => `${c.piloto} ha abandonado por ${c.motivo.toLowerCase()} en la ${c.sesion}. ¿Qué está fallando?`,
        contexto: (c) => `Tras el abandono de ${c.piloto} por ${c.motivo.toLowerCase()} en ${c.circuito}`,
        opciones: [
            { id: 'asumir', texto: 'Es culpa nuestra. Lo vamos a arreglar ya.', fans: [4, 14], moral: 3 },
            { id: 'suerte', texto: 'Mala suerte. Son cosas que pasan.', fans: [-6, 6] },
            { id: 'proveedor', texto: 'Hablaremos muy seriamente con el proveedor de esa pieza.', fans: [-4, 18] },
        ],
    },
    victoria: {
        pregunta: (c) => `¡Victoria de ${c.piloto} en la ${c.sesion} de ${c.circuito}! ¿Vais a por el título?`,
        contexto: (c) => `Tras la victoria de ${c.piloto} en ${c.circuito}`,
        opciones: [
            { id: 'humilde', texto: 'Vamos carrera a carrera. Queda mucho.', fans: [6, 16], moral: 3 },
            { id: 'titulo', texto: 'Sí. Este año el título es nuestro.', fans: [-8, 45], moral: 5 },
            { id: 'equipo', texto: 'Esta victoria es de los mecánicos y de toda la fábrica.', fans: [10, 22], moral: 2 },
        ],
    },
    podio: {
        pregunta: (c) => `Podio para ${c.piloto} en ${c.circuito}. ¿Contento o queríais más?`,
        contexto: (c) => `Tras el podio de ${c.piloto} en ${c.circuito}`,
        opciones: [
            { id: 'contento', texto: 'Muy contento. Es un gran resultado para nosotros.', fans: [5, 12], moral: 4 },
            { id: 'mas', texto: 'Queríamos ganar. El podio se nos queda corto.', fans: [-4, 22], moral: -2 },
            { id: 'coche', texto: 'El coche ha dado un paso adelante. Esto va a más.', fans: [4, 18] },
        ],
    },
    sinPuntos: {
        pregunta: (c) => `Ninguno de tus pilotos ha puntuado en la ${c.sesion} de ${c.circuito}. ¿Hay crisis en ${c.equipo}?`,
        contexto: (c) => `Tras quedarse sin puntos en la ${c.sesion} de ${c.circuito}`,
        opciones: [
            { id: 'calma', texto: 'Ninguna crisis. Sabemos lo que tenemos que hacer.', fans: [-4, 10] },
            { id: 'autocritica', texto: 'Ha sido un día horrible y la responsabilidad es mía.', fans: [4, 16] },
            { id: 'pilotos', texto: 'Los pilotos tienen que dar más. El coche estaba para puntuar.', fans: [-10, 20], moral: -8, companero: -8 },
        ],
    },
    duelo: {
        pregunta: (c) => `${c.piloto} y ${c.companero} han peleado rueda con rueda en la ${c.sesion}. ¿Hay un número uno en el equipo?`,
        contexto: (c) => `Preguntado por el duelo entre ${c.piloto} y ${c.companero}`,
        opciones: [
            { id: 'igualdad', texto: 'Los dos tienen las mismas opciones. Que gane el mejor.', fans: [4, 14], moral: 2, companero: 2 },
            { id: 'primero', texto: (c) => `${c.pilotoApellido} es nuestro número uno.`, fans: [-4, 18], moral: 8, companero: -10 },
            { id: 'segundo', texto: (c) => `Ahora mismo ${c.companeroApellido} lo está haciendo mejor.`, fans: [-4, 18], moral: -10, companero: 8 },
        ],
    },
    rivalEquipo: {
        pregunta: (c) => `¿Qué te parece la temporada de ${c.equipoRival}${c.managerRival ? `, que dirige ${c.managerRival}` : ''}?`,
        contexto: (c) => `Sobre ${c.equipoRival}`,
        opciones: [
            { id: 'elogio', texto: 'Lo están haciendo muy bien. Mis respetos.', fans: [2, 10] },
            { id: 'pulla', texto: 'Mucho ruido y pocas nueces. En pista no se nota.', fans: [-18, 40] },
            { id: 'nuestro', texto: 'Me preocupo de mi equipo, no del resto.', fans: [0, 8] },
        ],
    },
    rivalPiloto: {
        pregunta: (c) => `${c.rival} (${c.equipoRival}) está entre los mejores de la liga. ¿Lo ficharías?`,
        contexto: (c) => `Preguntado por ${c.rival}`,
        opciones: [
            { id: 'si', texto: 'Sin dudarlo. Es de los mejores.', fans: [2, 12], moral: -4, companero: -4 },
            { id: 'no', texto: 'Estoy muy contento con mis pilotos.', fans: [2, 10], moral: 5, companero: 5 },
            { id: 'sobrevalorado', texto: 'Está sobrevalorado. Con su coche cualquiera iría rápido.', fans: [-15, 35] },
        ],
    },
    tema: {
        pregunta: (c) => c.texto,
        contexto: (c) => `Preguntado por ${c.asunto}`,
        opciones: [
            { id: 'favor', texto: (c) => c.favor, fans: [0, 12] },
            { id: 'contra', texto: (c) => c.contra, fans: [-8, 20] },
            { id: 'neutral', texto: 'No tengo una opinión clara. Nosotros a lo nuestro.', fans: [0, 5] },
        ],
    },
    rumorSalida: {
        pregunta: (c) => `Se dice que el asiento de ${c.piloto} peligra. ¿Es verdad?`,
        contexto: (c) => `Sobre el futuro de ${c.piloto}`,
        opciones: [
            { id: 'respaldo', texto: 'Cero dudas. Sigue con nosotros.', fans: [2, 10], moral: 9 },
            { id: 'nadie', texto: 'Aquí nadie tiene el puesto asegurado.', fans: [-6, 18], moral: -10 },
            { id: 'evasivo', texto: 'Eso lo decidirá la pista.', fans: [0, 8], moral: -3 },
        ],
    },
};

export const TEMAS = [
    { asunto: 'el mercado de Galácticos', texto: '¿Es justo que cada liga tenga que ceder a un piloto de su top 5?', favor: 'Sí. Así las ligas se mezclan y hay más nivel.', contra: 'No. Castiga a quien hace bien las cosas.' },
    { asunto: 'la cuota de pilotos locales', texto: '¿Debería mantenerse la obligación de que el Piloto 1 sea local?', favor: 'Por supuesto. Es la esencia de las ligas nacionales.', contra: 'No. Que corran los mejores, vengan de donde vengan.' },
    { asunto: 'las jornadas de dos días', texto: '¿Te gusta el formato de jornadas en dos días?', favor: 'Mucho. Da tiempo a reaccionar entre carreras.', contra: 'Se hace largo. Lo haría todo en un día.' },
    { asunto: 'la lluvia', texto: 'Se esperan más carreras con lluvia. ¿Te gusta?', favor: 'Me encanta. Es donde se ve a los buenos pilotos.', contra: 'Es una lotería. No debería decidir campeonatos.' },
    { asunto: 'el Mundial', texto: '¿Es el Mundial más importante que ganar tu liga?', favor: 'Sí. Ahí están los mejores de todo el mundo.', contra: 'No. Lo primero es ganar en casa.' },
    { asunto: 'los presupuestos', texto: '¿Hay demasiada diferencia de dinero entre escuderías?', favor: 'Sí. Habría que poner un límite de gasto.', contra: 'No. El que gestiona bien, gasta bien.' },
    { asunto: 'el espionaje', texto: 'Se habla mucho de espionaje en el paddock. ¿Lo habéis sufrido?', favor: 'Sí, y sabemos quién ha sido.', contra: 'Nosotros no espiamos ni nos preocupa.' },
    { asunto: 'los rookies', texto: '¿Apostarías por un rookie para el año que viene?', favor: 'Claro. El talento joven es el futuro.', contra: 'No. Aquí se viene a ganar ya.' },
];

export const MAX_PREGUNTAS_JORNADA = 3;

const r = (rng, [a, b]) => Math.round(a + rng.next() * (b - a));
const txt = (t, c) => typeof t === 'function' ? t(c) : t;

// Pregunta lista para guardar: {plantilla, pregunta, opciones:[{id, texto}], ctx}
export function crearPregunta(plantilla, ctx) {
    const p = PLANTILLAS[plantilla];
    return { plantilla, pregunta: p.pregunta(ctx), opciones: p.opciones.map(o => ({ id: o.id, texto: txt(o.texto, ctx) })), ctx };
}

// Efectos de una respuesta (o de no responder). comunicacion: nivel de la instalación
export function efectosRespuesta(doc, eleccion, rng, comunicacion = 0) {
    const p = PLANTILLAS[doc.plantilla];
    const o = p?.opciones.find(x => x.id === eleccion);
    if (!o) return { fans: -12, sinRespuesta: true };
    let fans = r(rng, o.fans);
    fans = Math.round(fans > 0 ? fans * (1 + 0.15 * comunicacion) : fans * (1 - 0.12 * comunicacion));
    return { fans, moral: o.moral || 0, companero: o.companero || 0, texto: txt(o.texto, doc.ctx), contexto: p.contexto(doc.ctx) };
}

// Elige la pregunta tras una carrera para una escudería. Devuelve null si no hay tema.
// info: {pilotos:[{pid, nombre, apellido, fila}], eventos, nombreDe, apellidoDe, equipoDe, eqDe, sesion, circuito, equipo}
export function preguntaTrasCarrera(rng, info) {
    const { pilotos, eventos, sesion, circuito, equipo } = info;
    const base = { sesion, circuito, equipo };
    const mios = new Set(pilotos.map(p => p.pid));
    const cands = [];
    for (const p of pilotos) {
        const f = p.fila;
        if (f?.estado === 'DNF' && /accidente/i.test(f.motivo || '')) cands.push([5, 'accidente', { ...base, pid: p.pid, piloto: p.nombre, pilotoApellido: p.apellido }]);
        else if (f?.estado === 'DNF') cands.push([3, 'averia', { ...base, pid: p.pid, piloto: p.nombre, pilotoApellido: p.apellido, motivo: f.motivo || 'avería' }]);
        if (f?.estado === 'FIN' && f.pos === 1) cands.push([5, 'victoria', { ...base, pid: p.pid, piloto: p.nombre, pilotoApellido: p.apellido }]);
        else if (f?.estado === 'FIN' && f.pos <= 3) cands.push([1.5, 'podio', { ...base, pid: p.pid, piloto: p.nombre, pilotoApellido: p.apellido }]);
    }
    for (const e of eventos || []) {
        if (e.tipo !== 'toque' || !e.pid2) continue;
        const mio = mios.has(e.pid) ? e.pid : mios.has(e.pid2) ? e.pid2 : null;
        const otro = mio === e.pid ? e.pid2 : e.pid;
        if (!mio || mios.has(otro)) continue;
        const pm = pilotos.find(p => p.pid === mio);
        cands.push([4, 'toque', { ...base, pid: mio, piloto: pm.nombre, pilotoApellido: pm.apellido, rival: info.nombreDe(otro), rivalApellido: info.apellidoDe(otro), equipoRival: info.equipoDe(info.eqDe(otro)), vuelta: e.v }]);
    }
    if (pilotos.length && pilotos.every(p => !p.fila || !(p.fila.pts > 0))) cands.push([2, 'sinPuntos', base]);
    if (pilotos.length === 2) {
        const [a, b] = pilotos;
        if (a.fila?.estado === 'FIN' && b.fila?.estado === 'FIN' && Math.abs(a.fila.pos - b.fila.pos) === 1) {
            const [d, t] = a.fila.pos < b.fila.pos ? [a, b] : [b, a];
            cands.push([2, 'duelo', { ...base, pid: d.pid, piloto: d.nombre, pilotoApellido: d.apellido, companeroPid: t.pid, companero: t.nombre, companeroApellido: t.apellido }]);
        }
    }
    if (!cands.length) return null;
    const total = cands.reduce((s, c) => s + c[0], 0);
    let x = rng.next() * total;
    for (const [peso, pl, c] of cands) { x -= peso; if (x <= 0) return crearPregunta(pl, c); }
    return crearPregunta(cands[0][1], cands[0][2]);
}

// Pregunta de opinión (entre jornadas)
// info: {equipo, rivales:[{id, nombre, manager}], topPilotos:[{pid, nombre, apellido, equipo}], enRiesgo:{pid, nombre, apellido}|null, mios}
export function preguntaOpinion(rng, info) {
    const cands = [];
    if (info.rivales.length) cands.push([3, () => { const rv = rng.pick(info.rivales); return crearPregunta('rivalEquipo', { equipo: info.equipo, equipoRival: rv.nombre, managerRival: rv.manager || null, eqRival: rv.id }); }]);
    if (info.topPilotos.length) cands.push([2, () => { const tp = rng.pick(info.topPilotos); return crearPregunta('rivalPiloto', { equipo: info.equipo, rival: tp.nombre, equipoRival: tp.equipo, pid: info.mios[0]?.pid, companeroPid: info.mios[1]?.pid }); }]);
    if (info.enRiesgo) cands.push([2, () => crearPregunta('rumorSalida', { equipo: info.equipo, pid: info.enRiesgo.pid, piloto: info.enRiesgo.nombre })]);
    cands.push([3, () => crearPregunta('tema', { equipo: info.equipo, ...rng.pick(TEMAS) })]);
    const total = cands.reduce((s, c) => s + c[0], 0);
    let x = rng.next() * total;
    for (const [peso, f] of cands) { x -= peso; if (x <= 0) return f(); }
    return cands[cands.length - 1][1]();
}
