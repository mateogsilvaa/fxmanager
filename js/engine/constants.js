// Reglamento Hyper Race X1 — constantes compartidas por web y worker.

export const LIGAS = {
    ESP: { id: 'ESP', nombre: 'España', pais: 'es', color: '#e63946', gentilicio: 'española' },
    ITA: { id: 'ITA', nombre: 'Italia', pais: 'it', color: '#2a9d8f', gentilicio: 'italiana' },
    GBR: { id: 'GBR', nombre: 'Reino Unido', pais: 'gb', color: '#4361ee', gentilicio: 'británica' },
    GER: { id: 'GER', nombre: 'Alemania', pais: 'de', color: '#f4a261', gentilicio: 'alemana' },
    AUS: { id: 'AUS', nombre: 'Australia', pais: 'au', color: '#e9c46a', gentilicio: 'australiana' },
    INT: { id: 'INT', nombre: 'Intercontinental', pais: null, color: '#b388ff', gentilicio: 'mundial' },
};
export const LIGAS_NACIONALES = ['ESP', 'ITA', 'GBR', 'GER', 'AUS'];

// Nacionalidad (ISO-2) que cuenta como "local" en cada liga
export const NAC_LOCAL = { ESP: 'es', ITA: 'it', GBR: 'gb', GER: 'de', AUS: 'au' };

export const PAISES = {
    es: 'España', it: 'Italia', gb: 'Reino Unido', de: 'Alemania', au: 'Australia', fr: 'Francia',
    pt: 'Portugal', nl: 'Países Bajos', be: 'Bélgica', ch: 'Suiza', at: 'Austria', se: 'Suecia',
    no: 'Noruega', dk: 'Dinamarca', fi: 'Finlandia', pl: 'Polonia', ie: 'Irlanda', us: 'Estados Unidos',
    ca: 'Canadá', mx: 'México', ar: 'Argentina', br: 'Brasil', cl: 'Chile', co: 'Colombia', uy: 'Uruguay',
    jp: 'Japón', nz: 'Nueva Zelanda', za: 'Sudáfrica', cz: 'Chequia', hu: 'Hungría', ee: 'Estonia',
    ae: 'Emiratos Árabes', cn: 'China', kr: 'Corea del Sur', in: 'India', th: 'Tailandia', mc: 'Mónaco',
};

export const SESIONES = ['FP', 'Q1', 'R1', 'Q2', 'R2', 'R3'];
export const SESION_INFO = {
    FP: { nombre: 'Entrenamientos Libres', corto: 'Libres', tipo: 'fp', minutos: 20 },
    Q1: { nombre: 'Clasificación 1', corto: 'Qualy 1', tipo: 'qualy', minutos: 15 },
    R1: { nombre: 'Carrera 1', corto: 'Carrera 1', tipo: 'carrera', vueltas: 10, parrilla: 'Q1' },
    Q2: { nombre: 'Clasificación 2', corto: 'Qualy 2', tipo: 'qualy', minutos: 15 },
    R2: { nombre: 'Carrera 2', corto: 'Carrera 2', tipo: 'carrera', vueltas: 10, parrilla: 'Q2' },
    R3: { nombre: 'Carrera 3', corto: 'Carrera 3', tipo: 'carrera', vueltas: 15, parrilla: 'R2' },
};
export const esCarrera = (t) => SESION_INFO[t]?.tipo === 'carrera';
export const esQualy = (t) => SESION_INFO[t]?.tipo === 'qualy';

export const PUNTOS_QUALY = [7, 5, 3, 2, 1];
export const PUNTOS_CARRERA = [30, 24, 21, 19, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3];
export const PUNTOS_VR = 3;

// Duración de la retransmisión "en directo" (ms). Tras ella la sesión cuenta en clasificaciones.
export function duracionDirecto(tipo) {
    if (tipo === 'FP') return 150_000;
    if (esQualy(tipo)) return 150_000;
    return (SESION_INFO[tipo]?.vueltas || 10) * 24_000 + 15_000; // semáforos + carrera + bandera a cuadros
}

export const PLAZAS_MUNDIAL = { porLiga: 3, mejoresRestantes: 5 };

// Economía (en euros)
export const ECO = {
    presupuestoInicial: 12_000_000,
    premioPorPunto: 9_000,          // por punto de equipo en cada sesión
    checkinBase: 120_000,
    checkinPorRacha: 45_000,        // por día de racha (máx 7)
    checkinPorMarketing: 40_000,
    costeInvestigacion: { coche: 400_000, piloto: 250_000, estrategia: 600_000 },
    horasInvestigacion: { coche: 2, piloto: 1, estrategia: 1 },
    probDeteccionEspia: 0.2,
    // Mundial
    bonusClasificadoMundial: 1_500_000,   // por cada piloto que la escudería lleva al Mundial
    multPremioMundial: 3,                 // los puntos del Mundial valen el triple en premios
    premiosMundialEscuderias: [5_000_000, 3_000_000, 2_000_000],
    bonusCampeonMundial: 3_000_000,       // para la escudería del campeón del mundo
    // Fin de temporada: premio por posición en el campeonato de escuderías de cada liga
    premiosLiga: [6_000_000, 5_000_000, 4_500_000, 4_000_000, 3_500_000, 3_000_000, 2_500_000, 2_000_000, 1_500_000, 1_000_000],
    // Identidad y grupo (solo fuera del periodo de carreras)
    cambioNombre: 2_000_000,
    cambioColor: 600_000,
    compraFilial: 9_000_000,
    maxFiliales: 2,
    dividendoFilial: 90_000,              // al día, por cada filial
    // Ofertas para dirigir otra escudería tras una temporada excepcional
    probOfertaHermanas: 0.05,
    probOfertaNormal: 0.09,
    diasOfertaPlaza: 7,
};

// Fases en las que se puede cambiar nombre/colores o comprar una filial (no durante las carreras)
export const FASES_IDENTIDAD = ['pretemporada', 'mercado', 'cerrada'];
export const identidadAbierta = (fase) => FASES_IDENTIDAD.includes(fase);

export const AREAS = {
    motor: { nombre: 'Motor', icono: '' },
    aero: { nombre: 'Aerodinámica', icono: '' },
    chasis: { nombre: 'Chasis y tracción', icono: '' },
    fiabilidad: { nombre: 'Fiabilidad', icono: '' },
};
export const NIVEL_MAX_AREA = 10;

export const INSTALACIONES = {
    fabrica: { nombre: 'Fábrica', desc: 'Proyectos de I+D más rápidos y con más éxito.' },
    simulador: { nombre: 'Simulador', desc: 'Más tandas diarias y lecturas más precisas del reglaje.' },
    marketing: { nombre: 'Marketing', desc: 'Más fans e ingresos diarios.' },
};
export const NIVEL_MAX_INST = 5;

export const SLOTS_ID = 2;

export function costeMejora(nivel) { return Math.round(600_000 * (1 + 0.5 * nivel) / 10_000) * 10_000; }
export function horasMejora(nivel, fabrica, urgente) {
    const h = 8 * (1 + 0.3 * nivel) / (1 + 0.15 * fabrica);
    return Math.max(1, Math.round((urgente ? h * 0.4 : h) * 10) / 10);
}
export function probExitoMejora(nivel, fabrica) { return Math.min(0.97, 0.9 - 0.04 * nivel + 0.025 * fabrica); }
export const RECARGO_URGENTE = 1.75;

export function costeInstalacion(nivel) { return 2_000_000 * (nivel + 1); }
export function horasInstalacion(nivel) { return 24 * (nivel + 1); }

export function tandasSimulador(nivelSim) { return 3 + Math.floor(nivelSim / 2); }

export const SETUP_PARAMS = {
    ala: { nombre: 'Ala / carga', bajo: 'poca carga', alto: 'mucha carga' },
    susp: { nombre: 'Suspensión', bajo: 'blanda', alto: 'dura' },
    marchas: { nombre: 'Desarrollo de marchas', bajo: 'corto', alto: 'largo' },
    presion: { nombre: 'Presión de neumáticos', bajo: 'baja', alto: 'alta' },
};
export const SETUP_BASE = { ala: 5, susp: 5, marchas: 5, presion: 5 };
// Lectura del ingeniero por ajuste según la distancia al ideal
export const NIVELES_LECTURA = ['Excelente', 'Bueno', 'Medio', 'Malo', 'Súper malo'];
export function nivelLectura(distancia) { return distancia === 0 ? 0 : distancia === 1 ? 1 : distancia === 2 ? 2 : distancia <= 4 ? 3 : 4; }

export const ESTRATEGIA_DEF = {
    riesgo: 2,          // qualy 1..3
    ritmo: 'equilibrado', // conservador | equilibrado | ataque
    actitud: 'normal',  // defensiva | normal | agresiva
};

export const TZ = 'Europe/Madrid';
export function diaMadrid(ms = Date.now()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
// Epoch ms de la próxima medianoche (hora de Madrid) después de ms
export function finDiaMadrid(ms = Date.now()) {
    const dia = diaMadrid(ms);
    let t = ms;
    // avanzar por horas hasta cambiar de día y luego afinar por minutos
    while (diaMadrid(t) === dia) t += 3600_000;
    t -= 3600_000;
    while (diaMadrid(t) === dia) t += 60_000;
    return t - (t % 60_000);
}
