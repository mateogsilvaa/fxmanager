// Reputación (desde la temporada 2), de 0 a 100, empieza en 50.
//  · Reputación del equipo (equipos/{id}.reputacion, pública): mejores patrocinadores, más fans y más fácil fichar ingenieros.
//  · Reputación del mánager (managers/{uid}.reputacion, pública): cómo te ven la directiva (margen antes del despido)
//    y las otras escuderías (aceptan antes tus negociaciones y te llaman para dirigirlas).
export const REP_INICIAL = 50;
export const ajustarRep = (v, d) => Math.max(0, Math.min(100, Math.round((v ?? REP_INICIAL) + d)));

// Equipo
export const factorSponsor = (rep) => 0.8 + (rep ?? REP_INICIAL) / 250;          // 0,8 … 1,2
export const factorFans = (rep) => 0.75 + (rep ?? REP_INICIAL) / 200;            // 0,75 … 1,25
export const descuentoPrimaIngeniero = (rep) => Math.max(0, ((rep ?? REP_INICIAL) - 50) / 250); // hasta −20%

// Mánager
// La IA pide un margen al negociar: 15% con reputación 0, 5% con 50 y ninguno con 100
export const margenIA = (repM) => Math.max(0, 0.15 - (repM ?? REP_INICIAL) / 500);
// La directiva despide por debajo de este rating: 40 con reputación 0, 30 con 50, 20 con 100
export const umbralDespido = (repM) => Math.round(40 - (repM ?? REP_INICIAL) / 5);
// Más reputación, más ofertas para dirigir otras escuderías
export const factorOfertasPlaza = (repM) => 0.5 + (repM ?? REP_INICIAL) / 100;  // 0,5 … 1,5

export function nivelRep(v) {
    const r = v ?? REP_INICIAL;
    return r >= 85 ? 'Legendaria' : r >= 70 ? 'Excelente' : r >= 58 ? 'Buena' : r >= 43 ? 'Normal' : r >= 30 ? 'Discutida' : 'Por los suelos';
}
// Al cerrar la temporada: se mueve según el rating (0–100) de esa temporada
export const cambioRepTemporada = (rating) => rating == null ? 0 : Math.round((rating - 50) / 4);
