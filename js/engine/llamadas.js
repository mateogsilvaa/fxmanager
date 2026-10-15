// Llamadas y cartas (desde la temporada 2): aparecen al entrar en la web, más a menudo cuanto más tiempo juegas.
// Cada guion tiene quién llama, el texto y 2–3 opciones. Los efectos no son solo dinero: moral, fans, entrenamientos,
// información, adelantar una mejora, fichar un ingeniero barato…
//
// efectos: { dinero, fans, moral: { a: 'p1'|'p2'|'ambos', v }, attr: { a: 'p1'|'p2', attr, v }, proyecto: horas,
//            simulador: tandas extra hoy, info: true (revela una pista sobre un rival) }
// Una opción puede tener azar: { exito: 0.6, si: {...efectos, texto}, no: {...efectos, texto} }

export const GUIONES = [
    {
        id: 'sponsor_evento', quien: 'patrocinador', formato: 'llamada', peso: 3,
        titulo: '{sponsor} al teléfono',
        texto: 'Hola, soy {persona}, de {sponsor}. Queremos montar un evento con aficionados en la fábrica este fin de semana. ¿Nos dejáis a {p1} un par de horas?',
        opciones: [
            { id: 'si', texto: 'Claro, contad con él', efectos: { dinero: 180_000, fans: 60, rep: 1, moral: { a: 'p1', v: -4 } }, resultado: '{sponsor} paga el evento y los aficionados salen encantados. {p1} acaba algo cansado.' },
            { id: 'no', texto: 'Ahora no, estamos centrados en correr', efectos: { moral: { a: 'p1', v: 3 } }, resultado: '{sponsor} lo entiende. {p1} agradece poder descansar.' },
        ],
    },
    {
        id: 'sponsor_bono', quien: 'patrocinador', formato: 'carta', peso: 2,
        titulo: 'Carta de {sponsor}',
        texto: '«Estimado mánager: estamos muy satisfechos con la imagen del equipo. Os proponemos un bonus si {p1} acaba en el podio en la próxima jornada, o un pago fijo más pequeño ahora mismo.»',
        opciones: [
            { id: 'fijo', texto: 'El pago fijo, gracias', efectos: { dinero: 250_000 }, resultado: '{sponsor} ingresa el pago fijo.' },
            { id: 'apuesta', texto: 'Apostamos por el podio', efectos: { exito: 0.35, si: { dinero: 900_000, texto: '¡El departamento comercial ha cerrado un acuerdo mejor de lo esperado!' }, no: { fans: 20, texto: 'No hay bonus esta vez, pero {sponsor} valora la ambición.' } }, resultado: '' },
        ],
    },
    {
        id: 'piloto_moral', quien: 'piloto', formato: 'llamada', peso: 3,
        titulo: '{p1} quiere hablar contigo',
        texto: 'Jefe, no me encuentro cómodo con el coche. Siento que no confiáis en mí. ¿Podemos hablar?',
        opciones: [
            { id: 'animar', texto: 'Confío en ti al cien por cien', efectos: { moral: { a: 'p1', v: 8 } }, resultado: '{p1} cuelga con otra cara. Se nota la confianza.' },
            { id: 'exigir', texto: 'Los resultados mandan. Demuéstralo', efectos: { exito: 0.5, si: { attr: { a: 'p1', attr: 'consistencia', v: 1 }, texto: '{p1} se pica y se encierra en el simulador. Gana consistencia.' }, no: { moral: { a: 'p1', v: -6 }, texto: '{p1} se lo toma fatal. La moral cae.' } }, resultado: '' },
            { id: 'psico', texto: 'Te pago un psicólogo deportivo', efectos: { dinero: -120_000, repM: 1, moral: { a: 'p1', v: 12 } }, resultado: '{p1} empieza a trabajar con un especialista. Mucho mejor.' },
        ],
    },
    {
        id: 'piloto_entreno', quien: 'piloto', formato: 'llamada', peso: 2,
        titulo: '{p2} tiene una idea',
        texto: 'He encontrado un circuito de karting donde entrenar adelantamientos. Si me das el día libre, vuelvo mejor.',
        opciones: [
            { id: 'si', texto: 'Adelante, ve', efectos: { attr: { a: 'p2', attr: 'adelantamiento', v: 1 }, moral: { a: 'p2', v: 3 } }, resultado: '{p2} vuelve con ideas nuevas para adelantar.' },
            { id: 'no', texto: 'Te necesito en fábrica', efectos: { proyecto: 2, moral: { a: 'p2', v: -3 } }, resultado: '{p2} ayuda en fábrica y la mejora en curso avanza un poco más rápido.' },
        ],
    },
    {
        id: 'ing_atajo', quien: 'ingeniero', formato: 'llamada', peso: 3,
        titulo: '{ingeniero}, desde fábrica',
        texto: 'Jefe, tengo una idea para la mejora que estamos haciendo. Si metemos turnos de noche la acabamos antes, pero cuesta dinero.',
        opciones: [
            { id: 'pagar', texto: 'Hazlo, turnos de noche', efectos: { dinero: -150_000, proyecto: 6 }, resultado: 'La fábrica no para: la mejora en curso termina 6 horas antes.' },
            { id: 'no', texto: 'Mejor no forzar', efectos: {}, resultado: '{ingeniero} lo entiende. Todo sigue a su ritmo.' },
        ],
    },
    {
        id: 'ing_simulador', quien: 'ingeniero', formato: 'llamada', peso: 2,
        titulo: '{ingeniero} quiere probar algo',
        texto: 'He preparado un programa nuevo para el simulador. Con tu permiso, hoy hacemos tandas extra.',
        opciones: [
            { id: 'si', texto: 'Perfecto, adelante', efectos: { simulador: 2 }, resultado: 'Hoy tienes 2 tandas extra en el simulador.' },
            { id: 'no', texto: 'Hoy no toca', efectos: { moral: { a: 'ambos', v: 1 } }, resultado: 'Los pilotos agradecen el día tranquilo.' },
        ],
    },
    {
        id: 'ing_espia', quien: 'ingeniero', formato: 'carta', peso: 2,
        titulo: 'Nota confidencial de {ingeniero}',
        texto: '«Un mecánico de {rival} me ha pasado información sobre su coche. No sé si es fiable. ¿La miramos?»',
        opciones: [
            { id: 'mirar', texto: 'Echa un vistazo', efectos: { exito: 0.75, si: { info: true, texto: 'La información parece buena.' }, no: { dinero: -200_000, fans: -40, rep: -5, repM: -4, texto: 'Era una trampa: la FIA te multa por uso de información ajena.' } }, resultado: '' },
            { id: 'no', texto: 'Ni tocarla. Juego limpio', efectos: { fans: 50, rep: 3, repM: 2 }, resultado: 'Se corre la voz de que sois un equipo limpio. Los aficionados lo valoran.' },
        ],
    },
    {
        id: 'fia_inspeccion', quien: 'fia', formato: 'llamada', peso: 2,
        titulo: 'La FIA al teléfono',
        texto: 'Buenas, le llamo de la FIA. Vamos a hacer una inspección técnica sorpresa en su fábrica. ¿Colaboran ahora o lo dejamos para el lunes?',
        opciones: [
            { id: 'ahora', texto: 'Pasen cuando quieran', efectos: { exito: 0.85, si: { fans: 40, rep: 3, texto: 'Todo en regla. La FIA felicita al equipo.' }, no: { dinero: -250_000, rep: -4, texto: 'Detectan un pequeño fallo de homologación. Multa.' } }, resultado: '' },
            { id: 'lunes', texto: 'Mejor el lunes', efectos: { dinero: -60_000 }, resultado: 'La FIA acepta, pero cobra una tasa por cambiar la fecha.' },
        ],
    },
    {
        id: 'fia_seguridad', quien: 'fia', formato: 'carta', peso: 1,
        titulo: 'Comunicado de la FIA',
        texto: '«La FIA busca escuderías voluntarias para probar nuevos sistemas de seguridad. Se compensará el tiempo invertido.»',
        opciones: [
            { id: 'si', texto: 'Nos apuntamos', efectos: { dinero: 220_000, rep: 2, moral: { a: 'ambos', v: -2 } }, resultado: 'Los pilotos pasan un día de pruebas aburridas, pero la FIA paga bien.' },
            { id: 'no', texto: 'No, gracias', efectos: {}, resultado: 'Sin cambios.' },
        ],
    },
    {
        id: 'prensa_exclusiva', quien: 'periodista', formato: 'llamada', peso: 2,
        titulo: 'Una periodista pide una exclusiva',
        texto: 'Hola, soy {persona}. Preparo un reportaje sobre {equipo}. ¿Me concedes una entrevista exclusiva con {p1}?',
        opciones: [
            { id: 'si', texto: 'Hecho', efectos: { fans: 120, moral: { a: 'p1', v: 2 } }, resultado: 'El reportaje sale genial. Más aficionados os siguen.' },
            { id: 'polemica', texto: 'Solo si hablamos de {rival}', efectos: { exito: 0.5, si: { fans: 220, repM: 2, texto: 'El titular contra {rival} arrasa en redes.' }, no: { fans: -60, repM: -3, texto: 'La entrevista se vuelve en vuestra contra.' } }, resultado: '' },
            { id: 'no', texto: 'No es buen momento', efectos: {}, resultado: '{persona} lo intentará en otra ocasión.' },
        ],
    },
    {
        id: 'rival_pacto', quien: 'rival', formato: 'llamada', peso: 1,
        titulo: 'El mánager de {rival} llama',
        texto: 'Te propongo algo: compartimos datos de túnel de viento esta semana. Los dos ganamos. ¿Te interesa?',
        opciones: [
            { id: 'si', texto: 'Trato hecho', efectos: { proyecto: 4, fans: -10, repM: 2 }, resultado: 'Los datos ayudan: tu mejora en curso avanza 4 horas. Algunos aficionados no entienden el pacto.' },
            { id: 'no', texto: 'Cada uno a lo suyo', efectos: { moral: { a: 'ambos', v: 2 } }, resultado: 'El equipo aplaude que no os fiéis del rival.' },
        ],
    },
    {
        id: 'aficionado_carta', quien: 'aficionado', formato: 'carta', peso: 2,
        titulo: 'Carta de un aficionado',
        texto: '«Llevo años siguiendo a {equipo}. Mi hijo sueña con conocer a {p2}. ¿Sería posible una visita al box?»',
        opciones: [
            { id: 'si', texto: 'Por supuesto, que vengan', efectos: { fans: 80, rep: 2, moral: { a: 'p2', v: 5 } }, resultado: 'La foto de {p2} con el niño da la vuelta al mundo.' },
            { id: 'firma', texto: 'Le mandamos una gorra firmada', efectos: { fans: 25 }, resultado: 'Un detalle que no cuesta nada.' },
        ],
    },
    {
        id: 'sponsor_rival', quien: 'patrocinador', formato: 'llamada', peso: 1,
        titulo: 'Una marca nueva llama',
        texto: 'Soy {persona}, de una marca de bebidas energéticas. Queremos poner nuestro logo en el casco de {p1} esta jornada. Pagamos al momento.',
        opciones: [
            { id: 'si', texto: 'Adelante', efectos: { dinero: 300_000, rep: -2, moral: { a: 'p1', v: -2 } }, resultado: 'Dinero fácil. A {p1} no le gusta mucho el diseño.' },
            { id: 'no', texto: 'Respetamos a nuestro patrocinador', efectos: { fans: 30, rep: 2 }, resultado: 'Tu patrocinador agradece la fidelidad.' },
        ],
    },
    {
        id: 'ing_fichaje', quien: 'ingeniero', formato: 'carta', peso: 1,
        titulo: 'Un ingeniero quiere trabajar contigo',
        texto: '«Me llamo {persona}. He visto cómo trabaja {equipo} y me encantaría unirme. Puedo empezar mañana por un sueldo modesto.»',
        opciones: [
            { id: 'si', texto: 'Cuéntame más (ver ingenieros libres)', efectos: { fans: 5 }, resultado: 'Échale un ojo a los ingenieros libres en Mi escudería → Equipo. Algunos están más baratos estos días.' },
            { id: 'no', texto: 'No necesito a nadie', efectos: {}, resultado: 'Sin cambios.' },
        ],
    },
];

export const QUIEN = {
    patrocinador: 'Patrocinador', piloto: 'Piloto', ingeniero: 'Ingeniero', fia: 'FIA', periodista: 'Prensa', rival: 'Mánager rival', aficionado: 'Aficionado',
};

export function rellenar(t, v) { return String(t || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`); }

// Probabilidad diaria de recibir una llamada según los minutos medios que juega la persona al día
export function probLlamada(minutosMedios) { return Math.max(0.12, Math.min(0.85, 0.12 + (minutosMedios || 0) / 40)); }

// Hora (0–23, Madrid) a la que suele conectarse: la más frecuente, con algo de azar
export function horaHabitual(rng, horas) {
    const lista = Object.entries(horas || {}).map(([h, n]) => [+h, n]).filter(([, n]) => n > 0);
    if (!lista.length) return rng.int(9, 21);
    return rng.weighted(lista, ([, n]) => n)[0];
}
