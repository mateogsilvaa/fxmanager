// Ramas de desarrollo (desde la temporada 2): un árbol por área del coche. Al llegar a los niveles 3, 6 y 9 de un
// área se desbloquea una bifurcación con dos caminos. Lo que elijas define el carácter del coche: dos escuderías
// con el mismo nivel en todo pueden tener coches muy distintos (uno vuela en las rectas y rompe más, otro cuida los
// neumáticos, otro es un cohete a una vuelta…).
// priv.ramas = { motor: { 3: 'potencia', 6: 'mapaCarrera' }, aero: { … } }
//
// Efectos (se suman y los usa el simulador), todos expresados como ventaja:
//   rectas / curvas   ritmo en circuitos que premian motor / aero+chasis (fracción de tiempo por vuelta)
//   ritmoQualy        ritmo a una vuelta (libres y clasificación)      ritmoCarrera  ritmo en carrera
//   lluvia            ritmo con lluvia                                  deg           menos desgaste de neumáticos
//   ataque / defensa  puntos para adelantar / defenderse                salida        ms ganados en la primera vuelta
//   consistencia      menos dispersión entre vueltas                   boxes         ms ganados en cada parada
//   danos             daños de los toques que se evitan                fallo         más (+) o menos (−) averías
import { AREAS } from './constants.js';

export const TIERS = [3, 6, 9];
export const COSTE_CAMBIO_RAMA = 800_000;

export const RAMAS = {
    motor: {
        3: [
            { id: 'potencia', nombre: 'Potencia punta', desc: 'Más velocidad en las rectas a cambio de algo más de riesgo de avería.', ef: { rectas: 0.0012, fallo: 0.1 } },
            { id: 'par', nombre: 'Par motor', desc: 'Salidas explosivas y más empuje al salir de las curvas para adelantar.', ef: { salida: 300, ataque: 3 } },
        ],
        6: [
            { id: 'mapaQualy', nombre: 'Mapa de clasificación', desc: 'Un modo motor para exprimir una vuelta: brilla en clasificación.', ef: { ritmoQualy: 0.0012 } },
            { id: 'mapaCarrera', nombre: 'Mapa de carrera', desc: 'Entrega más suave: ritmo constante y neumáticos que duran más.', ef: { ritmoCarrera: 0.0008, deg: 0.04 } },
        ],
        9: [
            { id: 'empuje', nombre: 'Sistema de empuje', desc: 'Un extra de potencia al atacar: adelantar se vuelve mucho más fácil.', ef: { ataque: 6, rectas: 0.0005 } },
            { id: 'blindado', nombre: 'Bloque blindado', desc: 'El motor casi no se rompe.', ef: { fallo: -0.3 } },
        ],
    },
    aero: {
        3: [
            { id: 'carga', nombre: 'Alta carga', desc: 'Pegado al suelo en las curvas, algo más lento en recta.', ef: { curvas: 0.0014, rectas: -0.0004 } },
            { id: 'baja', nombre: 'Baja resistencia', desc: 'Un misil en recta, más delicado en las curvas.', ef: { rectas: 0.0014, curvas: -0.0004 } },
        ],
        6: [
            { id: 'mojado', nombre: 'Paquete de lluvia', desc: 'Mucho más rápido cuando llueve.', ef: { lluvia: 0.003 } },
            { id: 'aireSucio', nombre: 'Estela turbulenta', desc: 'El aire que deja detrás hace muy difícil seguirte: defiendes mejor.', ef: { defensa: 6 } },
        ],
        9: [
            { id: 'flexible', nombre: 'Alerón flexible', desc: 'Al límite del reglamento: más rápido a una vuelta y en curva.', ef: { ritmoQualy: 0.001, curvas: 0.0005 } },
            { id: 'seguimiento', nombre: 'Aero de seguimiento', desc: 'Puedes ir pegado al de delante sin perder carga: atacas mejor.', ef: { ataque: 6 } },
        ],
    },
    chasis: {
        3: [
            { id: 'traccion', nombre: 'Tracción', desc: 'Buenas salidas y menos patinazos que gastan goma.', ef: { salida: 200, deg: 0.05 } },
            { id: 'frenada', nombre: 'Frenada tardía', desc: 'Frenas más tarde que nadie: ganas en los duelos.', ef: { ataque: 4, defensa: 2 } },
        ],
        6: [
            { id: 'cuidaGomas', nombre: 'Cuida neumáticos', desc: 'Suspensión blanda que alarga mucho la vida de las gomas.', ef: { deg: 0.12 } },
            { id: 'rigido', nombre: 'Chasis rígido', desc: 'Más rápido a una vuelta, pero castiga los neumáticos.', ef: { ritmoQualy: 0.0012, deg: -0.06 } },
        ],
        9: [
            { id: 'activa', nombre: 'Suspensión activa', desc: 'El coche hace siempre lo mismo: vueltas mucho más regulares.', ef: { consistencia: 0.12 } },
            { id: 'reparto', nombre: 'Reparto de pesos', desc: 'Equilibrio perfecto en las curvas.', ef: { curvas: 0.0012 } },
        ],
    },
    fiabilidad: {
        3: [
            { id: 'ligero', nombre: 'Componentes ligeros', desc: 'Menos peso, más ritmo… y más riesgo de romper.', ef: { ritmoCarrera: 0.0006, fallo: 0.15 } },
            { id: 'robusto', nombre: 'Sobredimensionado', desc: 'Piezas más gruesas: aguanta lo que le echen.', ef: { fallo: -0.2 } },
        ],
        6: [
            { id: 'boxes', nombre: 'Paradas rápidas', desc: 'Piezas de cambio rápido: ganas tiempo en cada parada.', ef: { boxes: 700 } },
            { id: 'refrigeracion', nombre: 'Refrigeración', desc: 'Motor y frenos siempre a buena temperatura.', ef: { fallo: -0.15, ritmoCarrera: 0.0003 } },
        ],
        9: [
            { id: 'telemetria', nombre: 'Telemetría avanzada', desc: 'El piloto sabe en cada curva dónde gana tiempo: más regular.', ef: { consistencia: 0.1 } },
            { id: 'resistente', nombre: 'Carrocería resistente', desc: 'Los toques apenas dejan daños.', ef: { danos: 0.5, defensa: 2 } },
        ],
    },
};

export const opcionRama = (area, tier, id) => RAMAS[area]?.[tier]?.find(o => o.id === id) || null;

// Ramas activas: solo cuentan las de niveles que el coche tiene de verdad (tras el reinicio de temporada pueden
// quedar elegidas pero dormidas hasta volver a ese nivel)
export function ramasActivas(priv) {
    const out = [];
    for (const area of Object.keys(RAMAS)) for (const t of TIERS) {
        const id = priv?.ramas?.[area]?.[t];
        const o = id && opcionRama(area, t, id);
        if (o && (priv?.coche?.[area] || 0) >= t) out.push({ area, tier: t, ...o });
    }
    return out;
}
export function efectosRamas(priv) {
    const ef = {};
    for (const r of ramasActivas(priv)) for (const [k, v] of Object.entries(r.ef)) ef[k] = (ef[k] || 0) + v;
    return ef;
}
// Ramas por elegir: niveles alcanzados sin camino elegido
export const ramasPendientes = (priv) => Object.keys(RAMAS).flatMap(a => TIERS.filter(t => (priv?.coche?.[a] || 0) >= t && !priv?.ramas?.[a]?.[t]).map(t => ({ area: a, tier: t })));

// Perfil del coche para la interfaz: cada rasgo de −2 a +2 (sumando los efectos de las ramas)
export const RASGOS = [
    { id: 'recta', nombre: 'Rectas', v: (e) => (e.rectas || 0) / 0.0012 },
    { id: 'curva', nombre: 'Curvas', v: (e) => (e.curvas || 0) / 0.0012 },
    { id: 'vuelta', nombre: 'Una vuelta', v: (e) => (e.ritmoQualy || 0) / 0.0011 },
    { id: 'carrera', nombre: 'Ritmo de carrera', v: (e) => (e.ritmoCarrera || 0) / 0.0007 + (e.consistencia || 0) / 0.11 },
    { id: 'gomas', nombre: 'Neumáticos', v: (e) => (e.deg || 0) / 0.08 },
    { id: 'lluvia', nombre: 'Lluvia', v: (e) => (e.lluvia || 0) / 0.0025 },
    { id: 'ataque', nombre: 'Adelantar', v: (e) => (e.ataque || 0) / 5 + (e.salida || 0) / 400 },
    { id: 'defensa', nombre: 'Defender', v: (e) => (e.defensa || 0) / 5 },
    { id: 'fiable', nombre: 'Fiabilidad', v: (e) => -(e.fallo || 0) / 0.2 + (e.danos || 0) / 0.5 + (e.boxes || 0) / 1400 },
];
export const perfilCoche = (priv) => { const e = efectosRamas(priv); return RASGOS.map(r => ({ ...r, valor: Math.max(-2, Math.min(2, Math.round(r.v(e) * 10) / 10)) })); };

// Elección de la IA: con algo de personalidad (cada escudería tira hacia un estilo)
export function eleccionIA(rng, area, tier) { return rng.pick(RAMAS[area][tier]).id; }
void AREAS;
