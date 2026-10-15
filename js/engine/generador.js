// Parrillas y calendarios para las partidas de amigos: cada partida tiene sus propias escuderías y sus propios
// pilotos (generados con la semilla de la partida), así que dos partidas nunca son iguales.
import { LIGAS, NAC_LOCAL, SESIONES, horaMadrid } from './constants.js';
import { nombreAleatorio, EXTRANJEROS } from './nombres.js';
import { CIRCUITOS } from './circuitos.js';

const LUGARES = {
    ESP: ['Montjuïc', 'Guadarrama', 'Tramontana', 'Cantábrico', 'Alhambra', 'Sierra Norte', 'Brava', 'Moncayo', 'Tajo', 'Garraf', 'Ebro', 'Gredos', 'Mediterránea', 'Aitana', 'Picos', 'Doñana', 'Duero', 'Albarracín', 'Teide', 'Ordesa', 'Montserrat', 'Rías Baixas', 'Navarra', 'Levante'],
    ITA: ['Lario', 'Apennino', 'Brenta', 'Torretta', 'Vesuvio', 'Dolomiti', 'Adriatica', 'Borghi', 'Etna', 'Garda', 'Langhe', 'Maremma', 'Po', 'Sila', 'Tirreno', 'Cervino', 'Chianti', 'Gran Sasso', 'Ligure', 'Carso', 'Murge', 'Salento'],
    GBR: ['Ashcombe', 'Pennine', 'Blackmoor', 'Hartwell', 'Thames Valley', 'Highland', 'Solent', 'Cotswold', 'Mersey', 'Severn', 'Dartmoor', 'Snowdon', 'Tyne', 'Kentish', 'Exmoor', 'Wessex', 'Moray', 'Fenland', 'Cumbria', 'Clyde'],
    GER: ['Rheinwerk', 'Isar', 'Elbe', 'Harz', 'Weser', 'Nordring', 'Alpenblick', 'Spessart', 'Taunus', 'Eifel', 'Mosel', 'Oder', 'Allgäu', 'Rhön', 'Brocken', 'Main', 'Schwarzwald', 'Lausitz', 'Donau', 'Ostsee'],
    AUS: ['Blue Mountains', 'Southern Cross', 'Coral Coast', 'Kimberley', 'Tasman', 'Murray River', 'Red Centre', 'Gold Coast', 'Outback', 'Snowy', 'Barossa', 'Pilbara', 'Kakadu', 'Daintree', 'Flinders', 'Gippsland', 'Hunter Valley', 'Nullarbor', 'Whitsunday', 'Grampians'],
};
const SUFIJOS = {
    ESP: ['Racing', 'Motorsport', 'Competición', 'Racing Team', 'Escudería'],
    ITA: ['Corse', 'Racing', 'Motorsport', 'Scuderia', 'Squadra'],
    GBR: ['Racing', 'Motorsport', 'Engineering', 'Racing Team', 'Autosport'],
    GER: ['Racing', 'Motorsport', 'Werks', 'Rennsport', 'Engineering'],
    AUS: ['Racing', 'Motorsport', 'Racing Team', 'Speedworks', 'Motorsport Team'],
};
const DELANTE = new Set(['Escudería', 'Scuderia', 'Squadra']);
const COLORES = ['#e63946', '#2a9d8f', '#4361ee', '#f4a261', '#e9c46a', '#9d4edd', '#06d6a0', '#ff006e', '#3a86ff', '#fb5607', '#8338ec', '#118ab2',
    '#ef476f', '#ffd166', '#073b4c', '#bc6c25', '#606c38', '#d62828', '#003049', '#adb5bd', '#2b9348', '#fca311', '#14213d', '#48cae4', '#b5179e'];
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Parrilla en el formato de importarParrilla: 10 escuderías y 20 pilotos por liga, con al menos 11 locales
// y el Piloto 1 de cada escudería local
export function generarParrilla(rng, ligas, { equiposPorLiga = 10 } = {}) {
    const equipos = [], pilotos = [], usados = new Set(), ids = new Set();
    const colores = rng.shuffle([...COLORES]);
    let c = 0;
    for (const liga of ligas) {
        const lugares = rng.shuffle([...LUGARES[liga]]).slice(0, equiposPorLiga);
        lugares.forEach((lugar, i) => {
            const suf = rng.pick(SUFIJOS[liga]);
            const nombre = DELANTE.has(suf) ? `${suf} ${lugar}` : `${lugar} ${suf}`;
            let id = slug(lugar); if (ids.has(id)) id = `${id}-${liga.toLowerCase()}`; ids.add(id);
            equipos.push({ id, nombre, corto: lugar, liga, color: colores[c++ % colores.length] });
            // P1 local; el P2 es local en 4 de cada 10 escuderías (13 locales de 20 por liga)
            const local = NAC_LOCAL[liga];
            for (const [rol, nac] of [['P1', local], ['P2', i < 4 ? local : rng.pick(EXTRANJEROS[liga])]]) {
                const n = nombreAleatorio(rng, nac, usados);
                pilotos.push({ nombre: n.nombre, apellido: n.apellido, nac, equipo: id, rol, edad: rng.int(19, 35) });
            }
        });
    }
    return { equipos, pilotos };
}

// Hora de Madrid → epoch ms (tiene en cuenta el horario de verano)
export function msMadrid(fechaISO, hora) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const h = Math.floor(hora), min = Math.round((hora - h) * 60);
    const aprox = Date.UTC(y, m - 1, d, h, min);
    const desfase = ((Math.round(horaMadrid(aprox) - (h + min / 60)) % 24) + 24) % 24;
    return aprox - (desfase > 12 ? desfase - 24 : desfase) * 3600_000;
}
const sumarDias = (fechaISO, n) => { const t = new Date(`${fechaISO}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Calendario: jornadas de 2 días (día 1 libres, Q1 y C1; día 2 Q2, C2 y C3) cada X días; el Mundial (si lo hay)
// son 3 jornadas después. Devuelve [{ liga, ronda, circuito, horarios }] para crearEvento y la sede del Mundial.
export function planCalendario(rng, { ligas, mundial, inicio, jornadas = 5, diasEntre = 4, hora = 18 }) {
    const plan = [];
    const HORA = { FP: [0, 0], Q1: [0, 1], R1: [0, 2], Q2: [1, 0], R2: [1, 1], R3: [1, 2] };
    const horarios = (dia, retraso) => Object.fromEntries(SESIONES.map(t => [t, msMadrid(sumarDias(inicio, dia + HORA[t][0]), hora + HORA[t][1] + retraso / 60)]));
    ligas.forEach((liga, li) => {
        const pais = LIGAS[liga].pais;
        const propios = rng.shuffle(CIRCUITOS.filter(c => c.pais === pais));
        for (let k = 0; k < jornadas; k++) plan.push({ liga, ronda: k + 1, circuito: propios[k % propios.length], horarios: horarios(k * diasEntre, li * 10) });
    });
    let sede = null;
    if (mundial) {
        const paises = new Set(ligas.map(l => LIGAS[l].pais));
        const fuera = CIRCUITOS.filter(c => !paises.has(c.pais) && !['es', 'it', 'gb', 'de', 'au'].includes(c.pais));
        const elegido = rng.pick(fuera.length ? fuera : CIRCUITOS);
        const mismos = CIRCUITOS.filter(c => c.pais === elegido.pais);
        sede = elegido.pais;
        for (let k = 0; k < 3; k++) plan.push({ liga: 'INT', ronda: k + 1, circuito: mismos[k % mismos.length], horarios: horarios((jornadas + k) * diasEntre, 0) });
    }
    return { plan, sede };
}
