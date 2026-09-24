// Genera data/parrilla.json (equipos y pilotos ficticios). Uso: node worker/generar-parrilla.mjs
import { writeFileSync } from 'node:fs';
import { crearRng } from '../js/engine/rng.js';
import { nombreAleatorio, EXTRANJEROS } from '../js/engine/nombres.js';
import { NAC_LOCAL, LIGAS_NACIONALES } from '../js/engine/constants.js';

// [id, nombre, corto, grupo, color]
const EQUIPOS = {
    ESP: [
        ['valcor-es', 'Valcor Iberia', 'Valcor', 'Valcor', '#c1121f'],
        ['stellari-es', 'Stellari Hispania', 'Stellari', 'Stellari', '#1d3557'],
        ['altair-es', 'Altair Iberia', 'Altair', 'Altair', '#06d6a0'],
        ['montjuic', 'Escudería Montjuïc', 'Montjuïc', null, '#ffb703'],
        ['guadarrama', 'Guadarrama Racing', 'Guadarrama', null, '#8ecae6'],
        ['brava', 'Brava Motorsport', 'Brava', null, '#fb8500'],
        ['tramontana', 'Tramontana Racing', 'Tramontana', null, '#adb5bd'],
        ['sierra-norte', 'Sierra Norte Competición', 'Sierra Norte', null, '#2a9d8f'],
        ['cantabrico', 'Cantábrico Racing', 'Cantábrico', null, '#0077b6'],
        ['alhambra', 'Alhambra Motorsport', 'Alhambra', null, '#9d4edd'],
    ],
    ITA: [
        ['stellari-it', 'Stellari Corse', 'Stellari', 'Stellari', '#1d3557'],
        ['valcor-it', 'Valcor Italia', 'Valcor', 'Valcor', '#c1121f'],
        ['lario', 'Scuderia Lario', 'Lario', null, '#48cae4'],
        ['apennino', 'Apennino Racing', 'Apennino', null, '#6a994e'],
        ['brenta', 'Officine Brenta', 'Brenta', null, '#f4a261'],
        ['torretta', 'Scuderia Torretta', 'Torretta', null, '#e5383b'],
        ['vesuvio', 'Vesuvio Corse', 'Vesuvio', null, '#343a40'],
        ['dolomiti', 'Dolomiti Racing', 'Dolomiti', null, '#dee2e6'],
        ['adriatica', 'Squadra Adriatica', 'Adriatica', null, '#00b4d8'],
        ['borghi', 'Borghi Motorsport', 'Borghi', null, '#bc6c25'],
    ],
    GBR: [
        ['northline-uk', 'Northline Motorsport', 'Northline', 'Northline', '#003049'],
        ['kessler-uk', 'Kessler Racing UK', 'Kessler', 'Kessler', '#ffd166'],
        ['altair-uk', 'Altair Britannia', 'Altair', 'Altair', '#06d6a0'],
        ['ashcombe', 'Ashcombe Racing', 'Ashcombe', null, '#2b9348'],
        ['pennine', 'Pennine Motorsport', 'Pennine', null, '#9a8c98'],
        ['blackmoor', 'Blackmoor Engineering', 'Blackmoor', null, '#212529'],
        ['hartwell', 'Hartwell Racing', 'Hartwell', null, '#d62828'],
        ['thames', 'Thames Valley Racing', 'Thames Valley', null, '#4895ef'],
        ['highland', 'Highland Motorsport', 'Highland', null, '#7209b7'],
        ['solent', 'Solent Racing', 'Solent', null, '#f77f00'],
    ],
    GER: [
        ['kessler-de', 'Kessler Werks', 'Kessler', 'Kessler', '#ffd166'],
        ['valcor-de', 'Valcor Deutschland', 'Valcor', 'Valcor', '#c1121f'],
        ['rheinwerk', 'Rheinwerk Racing', 'Rheinwerk', null, '#4361ee'],
        ['schwarzwald', 'Schwarzwald Motorsport', 'Schwarzwald', null, '#2d6a4f'],
        ['elbe', 'Team Elbe', 'Elbe', null, '#90e0ef'],
        ['harz', 'Harz Racing', 'Harz', null, '#6c757d'],
        ['isar', 'Isar Motorsport', 'Isar', null, '#e76f51'],
        ['nordring', 'Nordring Racing', 'Nordring', null, '#f1faee'],
        ['weser', 'Weser Engineering', 'Weser', null, '#a4133c'],
        ['alpenblick', 'Alpenblick Racing', 'Alpenblick', null, '#80b918'],
    ],
    AUS: [
        ['northline-au', 'Northline Oceania', 'Northline', 'Northline', '#003049'],
        ['kessler-au', 'Kessler Pacific', 'Kessler', 'Kessler', '#ffd166'],
        ['altair-au', 'Altair Pacific', 'Altair', 'Altair', '#06d6a0'],
        ['southern-cross', 'Southern Cross Racing', 'Southern Cross', null, '#023e8a'],
        ['coral-coast', 'Coral Coast Motorsport', 'Coral Coast', null, '#ff006e'],
        ['red-centre', 'Red Centre Racing', 'Red Centre', null, '#9b2226'],
        ['tasman', 'Tasman Racing', 'Tasman', null, '#0096c7'],
        ['murray', 'Murray River Motorsport', 'Murray River', null, '#ca6702'],
        ['blue-mountains', 'Blue Mountains Racing', 'Blue Mountains', null, '#5e60ce'],
        ['kimberley', 'Kimberley Racing', 'Kimberley', null, '#e9d8a6'],
    ],
};

const rng = crearRng('hyper-race-x1-parrilla-2026');
const usados = new Set();
const equipos = [], pilotos = [];
for (const liga of LIGAS_NACIONALES) {
    const lista = EQUIPOS[liga];
    const conDosLocales = new Set(rng.shuffle(lista.map(e => e[0])).slice(0, 4));
    for (const [id, nombre, corto, grupo, color] of lista) {
        equipos.push({ id, nombre, corto, liga, grupo, color });
        const local = NAC_LOCAL[liga];
        const n1 = nombreAleatorio(rng, local, usados);
        pilotos.push({ ...n1, nac: local, equipo: id, rol: 'P1', edad: rng.int(20, 33) });
        const nac2 = conDosLocales.has(id) ? local : rng.pick(EXTRANJEROS[liga]);
        const n2 = nombreAleatorio(rng, nac2, usados);
        pilotos.push({ ...n2, nac: nac2, equipo: id, rol: 'P2', edad: rng.int(18, 32) });
    }
}
writeFileSync(new URL('../data/parrilla.json', import.meta.url), JSON.stringify({ equipos, pilotos }, null, 1));
console.log(`OK: ${equipos.length} equipos, ${pilotos.length} pilotos`);
