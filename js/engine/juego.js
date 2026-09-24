// Reglas de gestión: reglajes, decisiones diarias, patrocinadores, moral, IA
import { crearRng } from './rng.js';
import { SETUP_PARAMS, tandasSimulador, NIVELES_LECTURA, nivelLectura } from './constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Reglaje ----------
// El ideal depende del circuito y es distinto para cada coche (secreto del servidor).
export function setupIdeal(secreto, eventoId, equipoId, circuito) {
    const rng = crearRng(`${secreto}|setup|${eventoId}|${equipoId}`);
    const baseAla = 2 + circuito.aero * 9 - circuito.motor * 3;
    const baseSusp = 3 + (1 - circuito.chasis) * 5;
    const baseMarchas = 2 + circuito.motor * 9;
    const basePresion = 7 - (circuito.desgaste ?? 0.5) * 5;
    const f = (b) => clamp(Math.round(b + rng.gauss(0, 1.8)), 1, 10);
    return { ala: f(baseAla), susp: f(baseSusp), marchas: f(baseMarchas), presion: f(basePresion) };
}

export function calidadSetup(setup, ideal) {
    if (!setup) return 0.5;
    const claves = Object.keys(SETUP_PARAMS);
    const d = claves.map(k => Math.abs((+setup[k] || 5) - (ideal[k] ?? 5)));
    return clamp(1 - d.reduce((s, x) => s + x, 0) / claves.length / 6, 0, 1);
}

// Informe del ingeniero: para cada ajuste, un nivel de Excelente a Súper malo.
// Con simulador de nivel 2 o más, además dice si hay que subir o bajar.
export function informeSetup(setup, ideal, nivelSim, rng) {
    const out = {};
    for (const k of Object.keys(SETUP_PARAMS)) {
        const dif = (+setup[k] || 5) - (ideal[k] ?? 5);
        let n = nivelLectura(Math.abs(dif));
        // simulador básico: a veces se equivoca en un nivel
        if (nivelSim === 0 && rng.chance(0.12)) n = clamp(n + (rng.chance(0.5) ? 1 : -1), 0, 4);
        out[k] = { nivel: n, texto: NIVELES_LECTURA[n], dir: nivelSim >= 2 && dif !== 0 ? (dif > 0 ? 'bajar' : 'subir') : null };
    }
    const q = calidadSetup(setup, ideal);
    out.sensacion = q > 0.93 ? 'El piloto está encantado con el coche.' : q > 0.78 ? 'El coche va bien, pero se puede afinar.' : q > 0.6 ? 'El piloto no termina de confiar en el coche.' : 'El coche es muy difícil de conducir.';
    return out;
}

export function textoLectura(l) {
    if (!l) return '';
    if (typeof l === 'string') return l; // informes antiguos
    return l.texto + (l.dir ? ` (${l.dir})` : '');
}

export function tandasDisponibles(priv, dia) {
    const max = tandasSimulador(priv.inst?.simulador || 0) + (priv.tandasExtra?.dia === dia ? priv.tandasExtra.n : 0);
    const usadas = priv.simuladorUso?.dia === dia ? priv.simuladorUso.n : 0;
    return { max, usadas, quedan: Math.max(0, max - usadas) };
}

// ---------- Decisiones diarias ----------
// Cada efecto: presupuesto (€), moral {p1,p2,ambos}, forma, fans, horasID (acelera proyectos),
// riesgoFiab (multiplicador para el próximo evento), tandas (+tandas de simulador hoy), prob (probabilidad del efecto bueno)
export const CARTAS = [
    {
        id: 'simulador_noche', texto: '{p1} quiere quedarse esta noche en el simulador preparando el próximo circuito.',
        opciones: [
            { id: 'si', texto: 'Adelante, que se quede', efectos: { forma: { p1: 0.4 }, moral: { p1: 3 }, tandas: 1 } },
            { id: 'no', texto: 'Que descanse', efectos: { moral: { p1: -2 } }, defecto: true },
        ],
    },
    {
        id: 'proveedor_barato', texto: 'Un proveedor ofrece piezas de fibra de carbono un 40% más baratas, pero sin homologar del todo.',
        opciones: [
            { id: 'aceptar', texto: 'Aceptar la oferta (+0,5 M€)', efectos: { presupuesto: 500_000, riesgoFiab: 1.5 } },
            { id: 'rechazar', texto: 'Seguir con el proveedor oficial', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'entrevista', texto: 'Una televisión quiere entrevistar a {p2}. Le preguntarán por su compañero de equipo.',
        opciones: [
            { id: 'diplomatico', texto: 'Que sea diplomático', efectos: { fans: 150, moral: { ambos: 1 } } },
            { id: 'picante', texto: 'Que diga lo que piensa', efectos: { fans: 600, moral: { p1: -4, p2: 3 } } },
            { id: 'cancelar', texto: 'Cancelar la entrevista', efectos: { fans: -200 }, defecto: true },
        ],
    },
    {
        id: 'ingeniero_rival', texto: 'Un ingeniero de {rival} quiere venir a tu equipo. Pide un buen sueldo.',
        opciones: [
            { id: 'fichar', texto: 'Ficharlo (−0,6 M€, acelera tu I+D 6 h)', efectos: { presupuesto: -600_000, horasID: 6 } },
            { id: 'pasar', texto: 'No, gracias', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'evento_fans', texto: 'El club de fans organiza una quedada en la fábrica esta jornada.',
        opciones: [
            { id: 'ambos', texto: 'Van los dos pilotos (−100 k€)', efectos: { presupuesto: -100_000, fans: 700, moral: { ambos: 2 } } },
            { id: 'uno', texto: 'Solo {p1}', efectos: { fans: 300, moral: { p2: -1 } } },
            { id: 'nadie', texto: 'No hay tiempo para eso', efectos: { fans: -300 }, defecto: true },
        ],
    },
    {
        id: 'queja_sueldo', texto: '{p2} se queja: dice que cobra menos de lo que merece.',
        opciones: [
            { id: 'prima', texto: 'Darle una prima (−300 k€)', efectos: { presupuesto: -300_000, moral: { p2: 8 } } },
            { id: 'charla', texto: 'Hablar con él y prometerle un buen coche', efectos: { moral: { p2: 2 } } },
            { id: 'ignorar', texto: 'Ignorarlo', efectos: { moral: { p2: -7 } }, defecto: true },
        ],
    },
    {
        id: 'tunel_viento', texto: 'Queda libre una franja en el túnel de viento compartido. Es cara, pero rápida.',
        opciones: [
            { id: 'reservar', texto: 'Reservarla (−400 k€, acelera tu I+D 8 h)', efectos: { presupuesto: -400_000, horasID: 8 } },
            { id: 'no', texto: 'Dejarla pasar', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'marca_ropa', texto: 'Una marca de ropa quiere hacer una colección con los colores del equipo.',
        opciones: [
            { id: 'si', texto: 'Aceptar (+250 k€)', efectos: { presupuesto: 250_000, fans: 200 } },
            { id: 'exclusiva', texto: 'Pedir exclusiva: más dinero o nada', efectos: { presupuesto: 700_000, prob: 0.5, fans: 300 } },
            { id: 'no', texto: 'No encaja con la marca', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'mecanicos_cansados', texto: 'Los mecánicos llevan tres noches sin dormir. Piden un día libre antes de la carrera.',
        opciones: [
            { id: 'dar', texto: 'Dárselo', efectos: { riesgoFiab: 0.85 } },
            { id: 'negar', texto: 'Hay que seguir trabajando', efectos: { horasID: 3, riesgoFiab: 1.3 }, defecto: true },
        ],
    },
    {
        id: 'coach', texto: 'Un preparador físico de renombre se ofrece a trabajar con {p1} esta semana.',
        opciones: [
            { id: 'contratar', texto: 'Contratarlo (−200 k€)', efectos: { presupuesto: -200_000, forma: { p1: 0.6 } } },
            { id: 'no', texto: 'No hace falta', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'rumor_prensa', texto: 'La prensa dice que {p1} ha tenido contactos con otro equipo.',
        opciones: [
            { id: 'desmentir', texto: 'Desmentirlo públicamente', efectos: { moral: { p1: 3 }, fans: 100 } },
            { id: 'callar', texto: 'No decir nada', efectos: { moral: { p1: -3 } }, defecto: true },
        ],
    },
    {
        id: 'datos_filtrados', texto: 'Alguien te ofrece datos de telemetría de {rival}. Huele fatal.',
        opciones: [
            { id: 'comprar', texto: 'Comprarlos (−300 k€). Si te pillan, multa.', efectos: { presupuesto: -300_000, tandas: 2, prob: 0.75, malo: { presupuesto: -1_000_000, fans: -500 } } },
            { id: 'denunciar', texto: 'Denunciarlo a la FIA', efectos: { fans: 250 }, defecto: false },
            { id: 'ignorar', texto: 'Ignorarlo', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'cena_patrocinador', texto: 'El patrocinador principal organiza una cena y quiere a los dos pilotos allí.',
        opciones: [
            { id: 'ir', texto: 'Ir los dos', efectos: { presupuesto: 150_000, moral: { ambos: -1 } } },
            { id: 'excusa', texto: 'Poner una excusa', efectos: { presupuesto: -100_000 }, defecto: true },
        ],
    },
    {
        id: 'pique_interno', texto: '{p1} y {p2} han discutido en el briefing por la estrategia de la última carrera.',
        opciones: [
            { id: 'p1', texto: 'Dar la razón a {p1}', efectos: { moral: { p1: 5, p2: -6 } } },
            { id: 'p2', texto: 'Dar la razón a {p2}', efectos: { moral: { p1: -6, p2: 5 } } },
            { id: 'reunion', texto: 'Reunión con los dos (−50 k€)', efectos: { presupuesto: -50_000, moral: { ambos: 1 } } },
            { id: 'nada', texto: 'Que lo arreglen ellos', efectos: { moral: { ambos: -4 } }, defecto: true },
        ],
    },
    {
        id: 'motor_prueba', texto: 'El departamento de motor quiere probar un mapa más agresivo en el banco.',
        opciones: [
            { id: 'probar', texto: 'Probar (−150 k€). Puede salir bien… o romper un motor.', efectos: { presupuesto: -150_000, horasID: 5, prob: 0.6, malo: { presupuesto: -400_000 } } },
            { id: 'no', texto: 'Mejor no arriesgar', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'streamer', texto: 'Un streamer muy conocido quiere retransmitir un día en el equipo.',
        opciones: [
            { id: 'si', texto: 'Adelante', efectos: { fans: 900, forma: { ambos: -0.2 } } },
            { id: 'no', texto: 'Distrae demasiado', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'descanso_piloto', texto: '{p2} está agotado tras la última jornada. El médico recomienda descanso.',
        opciones: [
            { id: 'descanso', texto: 'Dos días de descanso', efectos: { forma: { p2: 0.3 }, moral: { p2: 2 } } },
            { id: 'entrenar', texto: 'Que siga entrenando', efectos: { forma: { p2: -0.4 } }, defecto: true },
        ],
    },
    {
        id: 'academia', texto: 'La academia local de karting pide un patrocinio pequeño.',
        opciones: [
            { id: 'si', texto: 'Patrocinar (−120 k€)', efectos: { presupuesto: -120_000, fans: 500 } },
            { id: 'no', texto: 'Este año no', efectos: { fans: -100 }, defecto: true },
        ],
    },
];

export function cartaDelDia(secreto, dia, equipoId) {
    const rng = crearRng(`${secreto}|carta|${dia}|${equipoId}`);
    return rng.pick(CARTAS);
}

export function rellenarTexto(txt, ctx) {
    return txt.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? k);
}

// Aplica los efectos de una opción. Devuelve {cambiosPriv, cambiosMoral:{pid:delta}, cambiosForma, fans, resumen}
export function efectosOpcion(opcion, ctx, rng) {
    let ef = opcion.efectos || {};
    let exito = true;
    if (ef.prob != null && !rng.chance(ef.prob)) { exito = false; ef = ef.malo || {}; }
    const moral = {}, forma = {};
    const aplicar = (obj, dst) => {
        if (!obj) return;
        for (const [k, v] of Object.entries(obj)) {
            const ids = k === 'ambos' ? [ctx.p1Id, ctx.p2Id] : [k === 'p1' ? ctx.p1Id : ctx.p2Id];
            ids.filter(Boolean).forEach(id => { dst[id] = (dst[id] || 0) + v; });
        }
    };
    aplicar(ef.moral, moral);
    aplicar(ef.forma, forma);
    return {
        exito, presupuesto: ef.presupuesto || 0, fans: ef.fans || 0, horasID: ef.horasID || 0,
        riesgoFiab: ef.riesgoFiab || null, tandas: ef.tandas || 0, moral, forma,
    };
}

// ---------- Patrocinadores ----------
const MARCAS = ['Voltra Energy', 'Nexa Telecom', 'Brisa Seguros', 'Orbis Logistics', 'Kairo Watches', 'Solén Bank', 'Tessel Tyres', 'Arcadia Airlines', 'Lumen Tech', 'Faro Café', 'Vértice Apparel', 'Quanta Cloud', 'Helix Fuel', 'Monteverde Wines', 'Pulsar Audio'];

// expectativa: posición esperada del equipo (1..10)
export function ofertasSponsor(secreto, temporada, equipoId, expectativa = 5) {
    const rng = crearRng(`${secreto}|sponsor|${temporada}|${equipoId}`);
    const marcas = rng.shuffle(MARCAS).slice(0, 3);
    const ptsObj = Math.max(20, Math.round((11 - expectativa) * 14 + rng.int(-10, 10)));
    return [
        { id: 'fijo', marca: marcas[0], tipo: 'Seguro', base: 1_300_000 + rng.int(0, 4) * 50_000, bonus: 0, objetivo: null, desc: 'Cantidad fija por jornada, sin objetivos.' },
        { id: 'rendimiento', marca: marcas[1], tipo: 'Rendimiento', base: 800_000, bonus: 900_000, objetivo: { tipo: 'puntos', valor: ptsObj }, desc: `Bonus si el equipo suma ${ptsObj} puntos o más en la jornada.` },
        { id: 'riesgo', marca: marcas[2], tipo: 'Alto riesgo', base: 350_000, bonus: 2_600_000, objetivo: { tipo: 'podio' }, desc: 'Bonus enorme si algún piloto sube al podio en la jornada.' },
    ];
}

export function pagoSponsor(sponsor, resumenFinde) {
    if (!sponsor) return { total: 0, cumplido: false };
    let cumplido = false;
    if (sponsor.objetivo?.tipo === 'puntos') cumplido = resumenFinde.puntos >= sponsor.objetivo.valor;
    else if (sponsor.objetivo?.tipo === 'podio') cumplido = resumenFinde.mejorPos != null && resumenFinde.mejorPos <= 3;
    return { total: sponsor.base + (cumplido ? sponsor.bonus : 0), cumplido };
}

// ---------- Salarios ----------
export function salarioPiloto(attrs) {
    const nivel = (attrs.ritmo * 2 + attrs.consistencia + attrs.agresividad * 0.5 + (attrs.defensa ?? 70) * 0.5) / 4;
    return Math.round(Math.max(120_000, (nivel - 55) * 22_000) / 10_000) * 10_000;
}

// ---------- Moral tras una carrera ----------
export function deltaMoral(fila, filaComp, esperado) {
    let d = 0;
    if (fila.estado === 'DNF') d -= 3;
    else {
        if (fila.pos === 1) d += 6;
        else if (fila.pos <= 3) d += 3;
        d += Math.max(-4, Math.min(4, (esperado - fila.pos) * 0.5));
    }
    if (filaComp) d += fila.pos < filaComp.pos ? 1 : -1.5;
    return Math.round(d);
}

// ---------- Atributos por defecto ----------
export function atributosAleatorios(rng, { rookie = false, estrella = 0 } = {}) {
    const g = (m, sd, a = 50, b = 97) => clamp(Math.round(rng.gauss(m, sd)), a, b);
    const ritmo = g(rookie ? 70 : 76 + estrella * 6, 6, 58, 95);
    return {
        ritmo,
        consistencia: g(rookie ? 66 : 74, 8, 45, 96),
        agresividad: g(68, 10, 40, 95),
        adelantamiento: g(70, 9, 45, 96),
        defensa: g(70, 9, 45, 96),
        lluvia: g(ritmo - 4, 9, 45, 97),
        experiencia: rookie ? g(20, 8, 5, 40) : g(55, 15, 20, 95),
        potencial: rookie ? g(ritmo + 10, 5, ritmo, 97) : g(ritmo + 2, 3, ritmo, 97),
    };
}

// Rango aproximado de un atributo (para informes de espionaje / ojeadores)
export function rangoAprox(v, rng, margen = 4) {
    const c = v + rng.int(-2, 2);
    return [Math.max(0, c - margen), Math.min(100, c + margen)];
}

// ---------- IA de equipos sin mánager ----------
export function decisionIA(priv, circuitoProx, rng) {
    // devuelve el área en la que invertir o null
    const areas = ['motor', 'aero', 'chasis', 'fiabilidad'];
    const pesos = circuitoProx
        ? { motor: circuitoProx.motor + 0.2, aero: circuitoProx.aero + 0.2, chasis: circuitoProx.chasis + 0.2, fiabilidad: 0.35 }
        : { motor: 1, aero: 1, chasis: 1, fiabilidad: 0.6 };
    return rng.weighted(areas.filter(a => (priv.coche?.[a] || 0) < 10), a => pesos[a] / (1 + (priv.coche?.[a] || 0) * 0.15));
}

export function setupIA(ideal, rng, habilidad = 1) {
    const f = (v) => clamp(v + Math.round(rng.gauss(0, 1.3 * habilidad)), 1, 10);
    return Object.fromEntries(Object.keys(SETUP_PARAMS).map(k => [k, f(ideal[k] ?? 5)]));
}
