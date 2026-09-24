// Base de circuitos (Assetto Corsa: oficiales y mods populares).
// vel = velocidad media aproximada del BAC Mono en km/h (para el tiempo de referencia)
// motor/aero/chasis = importancia relativa de cada área · adelantar/desgaste/lluvia = 0..1
// acId = carpeta del circuito en assettocorsa/content/tracks (y layout si lo tiene)

const C = (id, nombre, pais, km, vel, motor, aero, chasis, adelantar, desgaste, lluvia, acId, oficial = false) =>
    ({ id, nombre, pais, km, vel, motor, aero, chasis, adelantar, desgaste, lluvia, acId, oficial });

export const CIRCUITOS = [
    // España
    C('barcelona-gp', 'Circuit de Barcelona-Catalunya', 'es', 4.657, 162, 0.3, 0.45, 0.25, 0.35, 0.7, 0.12, 'ks_barcelona/layout_gp', true),
    C('barcelona-moto', 'Barcelona-Catalunya (Moto)', 'es', 4.627, 158, 0.3, 0.4, 0.3, 0.4, 0.7, 0.12, 'ks_barcelona/layout_moto', true),
    C('jarama', 'Circuito del Jarama', 'es', 3.85, 148, 0.2, 0.35, 0.45, 0.25, 0.5, 0.12, 'jarama'),
    C('valencia', 'Circuit Ricardo Tormo', 'es', 4.005, 146, 0.25, 0.3, 0.45, 0.4, 0.55, 0.1, 'valencia'),
    C('jerez', 'Circuito de Jerez - Ángel Nieto', 'es', 4.428, 158, 0.3, 0.4, 0.3, 0.45, 0.6, 0.12, 'jerez'),
    C('aragon', 'MotorLand Aragón', 'es', 5.345, 165, 0.45, 0.3, 0.25, 0.55, 0.55, 0.1, 'motorland_aragon'),
    C('navarra', 'Circuito de Navarra', 'es', 3.933, 152, 0.3, 0.35, 0.35, 0.4, 0.5, 0.2, 'navarra'),
    C('portimao', 'Autódromo do Algarve', 'pt', 4.653, 160, 0.35, 0.4, 0.25, 0.4, 0.65, 0.1, 'portimao'),
    // Italia
    C('monza', 'Autodromo Nazionale Monza', 'it', 5.793, 196, 0.6, 0.15, 0.25, 0.65, 0.4, 0.15, 'monza', true),
    C('imola', 'Autodromo Enzo e Dino Ferrari (Imola)', 'it', 4.909, 170, 0.35, 0.35, 0.3, 0.25, 0.5, 0.18, 'imola', true),
    C('mugello', 'Autodromo del Mugello', 'it', 5.245, 178, 0.35, 0.45, 0.2, 0.4, 0.6, 0.15, 'mugello', true),
    C('vallelunga', 'Vallelunga Piero Taruffi', 'it', 4.085, 158, 0.3, 0.35, 0.35, 0.35, 0.5, 0.15, 'vallelunga', true),
    C('vallelunga-club', 'Vallelunga Club', 'it', 1.74, 128, 0.2, 0.3, 0.5, 0.3, 0.45, 0.15, 'vallelunga/club_circuit', true),
    C('magione', 'Autodromo dell\'Umbria (Magione)', 'it', 2.507, 132, 0.2, 0.3, 0.5, 0.2, 0.45, 0.15, 'magione', true),
    C('misano', 'Misano World Circuit', 'it', 4.226, 155, 0.3, 0.35, 0.35, 0.4, 0.55, 0.12, 'misano'),
    // Reino Unido
    C('silverstone-gp', 'Silverstone Grand Prix', 'gb', 5.891, 180, 0.35, 0.45, 0.2, 0.55, 0.6, 0.3, 'ks_silverstone/gp', true),
    C('silverstone-nat', 'Silverstone National', 'gb', 2.639, 150, 0.35, 0.35, 0.3, 0.45, 0.45, 0.3, 'ks_silverstone/national', true),
    C('silverstone-int', 'Silverstone International', 'gb', 2.978, 152, 0.4, 0.3, 0.3, 0.45, 0.45, 0.3, 'ks_silverstone/international', true),
    C('brands-gp', 'Brands Hatch GP', 'gb', 3.908, 162, 0.3, 0.4, 0.3, 0.3, 0.5, 0.32, 'ks_brands_hatch/gp', true),
    C('brands-indy', 'Brands Hatch Indy', 'gb', 1.929, 150, 0.25, 0.35, 0.4, 0.3, 0.45, 0.32, 'ks_brands_hatch/indy', true),
    C('donington', 'Donington Park', 'gb', 4.02, 162, 0.35, 0.35, 0.3, 0.45, 0.5, 0.3, 'donington'),
    C('snetterton', 'Snetterton 300', 'gb', 4.778, 165, 0.45, 0.3, 0.25, 0.5, 0.45, 0.3, 'snetterton'),
    C('oulton', 'Oulton Park', 'gb', 4.307, 155, 0.25, 0.4, 0.35, 0.2, 0.5, 0.33, 'oulton_park'),
    // Alemania
    C('nurburgring-gp', 'Nürburgring GP', 'de', 5.148, 162, 0.35, 0.35, 0.3, 0.45, 0.5, 0.28, 'ks_nurburgring/layout_gp_a', true),
    C('nurburgring-sprint', 'Nürburgring Sprint', 'de', 3.629, 158, 0.35, 0.3, 0.35, 0.45, 0.45, 0.28, 'ks_nurburgring/layout_sprint_a', true),
    C('nordschleife', 'Nürburgring Nordschleife', 'de', 20.832, 172, 0.4, 0.4, 0.2, 0.3, 0.55, 0.3, 'ks_nordschleife/nordschleife', true),
    C('hockenheim', 'Hockenheimring', 'de', 4.574, 170, 0.5, 0.25, 0.25, 0.6, 0.5, 0.2, 'hockenheim'),
    C('sachsenring', 'Sachsenring', 'de', 3.671, 145, 0.2, 0.35, 0.45, 0.25, 0.55, 0.22, 'sachsenring'),
    C('lausitzring', 'Lausitzring', 'de', 4.345, 160, 0.4, 0.3, 0.3, 0.5, 0.45, 0.2, 'lausitzring'),
    C('oschersleben', 'Motorsport Arena Oschersleben', 'de', 3.696, 145, 0.25, 0.3, 0.45, 0.35, 0.5, 0.22, 'oschersleben'),
    C('redbullring', 'Red Bull Ring', 'at', 4.318, 175, 0.5, 0.25, 0.25, 0.6, 0.45, 0.22, 'ks_red_bull_ring/layout_gp', true),
    // Australia
    C('bathurst', 'Mount Panorama (Bathurst)', 'au', 6.213, 168, 0.45, 0.35, 0.2, 0.35, 0.55, 0.15, 'bathurst'),
    C('phillip-island', 'Phillip Island', 'au', 4.445, 178, 0.35, 0.45, 0.2, 0.5, 0.65, 0.22, 'phillip_island'),
    C('sandown', 'Sandown Raceway', 'au', 3.1, 150, 0.4, 0.25, 0.35, 0.45, 0.5, 0.18, 'sandown'),
    C('albert-park', 'Albert Park', 'au', 5.278, 172, 0.4, 0.35, 0.25, 0.4, 0.5, 0.15, 'albert_park'),
    C('the-bend', 'The Bend Motorsport Park', 'au', 4.95, 165, 0.4, 0.35, 0.25, 0.5, 0.55, 0.1, 'the_bend'),
    C('queensland', 'Queensland Raceway', 'au', 3.12, 150, 0.45, 0.2, 0.35, 0.55, 0.45, 0.15, 'queensland_raceway'),
    C('winton', 'Winton Motor Raceway', 'au', 3.0, 135, 0.2, 0.3, 0.5, 0.3, 0.5, 0.15, 'winton'),
    C('hidden-valley', 'Hidden Valley (Darwin)', 'au', 2.87, 150, 0.45, 0.2, 0.35, 0.5, 0.6, 0.1, 'hidden_valley'),
    // Resto del mundo (sedes del Mundial)
    C('spa', 'Circuit de Spa-Francorchamps', 'be', 7.004, 182, 0.45, 0.4, 0.15, 0.55, 0.55, 0.35, 'spa', true),
    C('zandvoort', 'Circuit Zandvoort', 'nl', 4.259, 162, 0.3, 0.45, 0.25, 0.25, 0.55, 0.28, 'ks_zandvoort', true),
    C('laguna-seca', 'WeatherTech Laguna Seca', 'us', 3.602, 150, 0.25, 0.35, 0.4, 0.3, 0.5, 0.05, 'ks_laguna_seca', true),
    C('road-america', 'Road America', 'us', 6.515, 178, 0.55, 0.25, 0.2, 0.55, 0.45, 0.15, 'road_america'),
    C('watkins-glen', 'Watkins Glen', 'us', 5.472, 175, 0.4, 0.35, 0.25, 0.45, 0.5, 0.15, 'watkins_glen'),
    C('cota', 'Circuit of the Americas', 'us', 5.513, 165, 0.35, 0.4, 0.25, 0.55, 0.6, 0.1, 'cota'),
    C('suzuka', 'Suzuka Circuit', 'jp', 5.807, 172, 0.3, 0.5, 0.2, 0.3, 0.6, 0.25, 'suzuka'),
    C('fuji', 'Fuji Speedway', 'jp', 4.563, 170, 0.5, 0.25, 0.25, 0.55, 0.45, 0.28, 'fuji'),
    C('kyalami', 'Kyalami', 'za', 4.529, 165, 0.35, 0.4, 0.25, 0.4, 0.55, 0.12, 'kyalami'),
    C('interlagos', 'Autódromo José Carlos Pace', 'br', 4.309, 165, 0.4, 0.3, 0.3, 0.55, 0.55, 0.3, 'interlagos'),
    C('paul-ricard', 'Circuit Paul Ricard', 'fr', 5.842, 170, 0.45, 0.35, 0.2, 0.5, 0.55, 0.1, 'paul_ricard'),
    C('hungaroring', 'Hungaroring', 'hu', 4.381, 150, 0.2, 0.45, 0.35, 0.2, 0.6, 0.12, 'hungaroring'),
    C('yas-marina', 'Yas Marina', 'ae', 5.281, 160, 0.4, 0.3, 0.3, 0.5, 0.45, 0.01, 'yas_marina'),
    C('estoril', 'Circuito do Estoril', 'pt', 4.182, 158, 0.35, 0.35, 0.3, 0.4, 0.55, 0.12, 'estoril'),
];

export const CIRCUITOS_POR_ID = Object.fromEntries(CIRCUITOS.map(c => [c.id, c]));

export function tiempoReferencia(c) {
    return Math.round(c.km / c.vel * 3600 * 1000);
}

// Normaliza un circuito (incluidos los personalizados creados en el admin)
export function normalizarCircuito(c) {
    const vel = +c.vel || 160;
    const km = +c.km || 4;
    const out = {
        id: c.id, nombre: c.nombre, pais: c.pais || 'es', km, vel,
        motor: +c.motor || 0.33, aero: +c.aero || 0.33, chasis: +c.chasis || 0.33,
        adelantar: c.adelantar != null ? +c.adelantar : 0.4, desgaste: c.desgaste != null ? +c.desgaste : 0.5,
        lluvia: c.lluvia != null ? +c.lluvia : 0.15, acId: c.acId || '', oficial: !!c.oficial,
    };
    out.tiempoBase = c.tiempoBase ? +c.tiempoBase : tiempoReferencia(out);
    return out;
}
