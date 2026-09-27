// Decisiones diarias adicionales. Mismo formato que CARTAS en juego.js.
// Efectos: presupuesto (€), moral {p1,p2,ambos}, forma {p1,p2,ambos}, fans, horasID, riesgoFiab, tandas,
// prob (probabilidad de que salga bien) + malo (efectos si sale mal). Marcadores: {p1} {p2} {rival} {equipo}
export const CARTAS_EXTRA = [
    {
        id: 'documental', texto: 'Una plataforma quiere grabar un documental sobre {equipo} toda la temporada.',
        opciones: [
            { id: 'todo', texto: 'Acceso total (+600 k€)', efectos: { presupuesto: 600_000, fans: 900, moral: { ambos: -3 } } },
            { id: 'parcial', texto: 'Solo en carreras (+250 k€)', efectos: { presupuesto: 250_000, fans: 400 } },
            { id: 'no', texto: 'No queremos cámaras', efectos: { fans: -150 }, defecto: true },
        ],
    },
    {
        id: 'lluvia_test', texto: 'Llueve en el circuito de pruebas. {p2} quiere aprovechar para rodar en mojado.',
        opciones: [
            { id: 'rodar', texto: 'Rodar (−80 k€)', efectos: { presupuesto: -80_000, forma: { p2: 0.4 }, tandas: 1 } },
            { id: 'ambos', texto: 'Que rueden los dos (−150 k€)', efectos: { presupuesto: -150_000, forma: { ambos: 0.3 } } },
            { id: 'no', texto: 'No arriesgamos el coche', efectos: { moral: { p2: -2 } }, defecto: true },
        ],
    },
    {
        id: 'fallo_calidad', texto: 'Control de calidad ha encontrado grietas en un lote de piezas de suspensión.',
        opciones: [
            { id: 'cambiar', texto: 'Cambiarlas todas (−350 k€)', efectos: { presupuesto: -350_000, riesgoFiab: 0.7 } },
            { id: 'revisar', texto: 'Revisarlas una a una (−100 k€)', efectos: { presupuesto: -100_000, riesgoFiab: 0.9 } },
            { id: 'nada', texto: 'Seguro que aguantan', efectos: { riesgoFiab: 1.6 }, defecto: true },
        ],
    },
    {
        id: 'becario_genio', texto: 'Un becario ha propuesto una idea brillante para el difusor.',
        opciones: [
            { id: 'probar', texto: 'Probarla (−200 k€). Puede ser genial… o nada.', efectos: { presupuesto: -200_000, horasID: 10, prob: 0.55, malo: { presupuesto: -200_000 } } },
            { id: 'contratar', texto: 'Contratarlo en plantilla (−150 k€)', efectos: { presupuesto: -150_000, horasID: 4 } },
            { id: 'ignorar', texto: 'Ahora no es momento', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'influencer_piloto', texto: '{p1} quiere abrir un canal de vídeos contando su día a día.',
        opciones: [
            { id: 'si', texto: 'Adelante, sin límites', efectos: { fans: 700, forma: { p1: -0.2 }, moral: { p1: 4 } } },
            { id: 'controlado', texto: 'Sí, pero lo revisa comunicación', efectos: { fans: 350, moral: { p1: 1 } } },
            { id: 'no', texto: 'Primero, rendir en pista', efectos: { moral: { p1: -4 } }, defecto: true },
        ],
    },
    {
        id: 'banco_prestamo', texto: 'Un banco ofrece un préstamo rápido a {equipo}.',
        opciones: [
            { id: 'grande', texto: 'Préstamo para la fábrica: intereses de 400 k€, I+D 6 h más rápido', efectos: { presupuesto: -400_000, horasID: 6 } },
            { id: 'pequeno', texto: 'Préstamo pequeño: intereses de 100 k€, I+D 2 h más rápido', efectos: { presupuesto: -100_000, horasID: 2 } },
            { id: 'no', texto: 'No nos endeudamos', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'boicot_rival', texto: 'Se rumorea que {rival} ha presentado una queja sobre la legalidad de tu alerón.',
        opciones: [
            { id: 'defender', texto: 'Defenderlo con abogados (−250 k€)', efectos: { presupuesto: -250_000, fans: 200, prob: 0.8, malo: { presupuesto: -400_000, fans: -300 } } },
            { id: 'cambiar', texto: 'Cambiar el alerón por si acaso', efectos: { horasID: -4, riesgoFiab: 0.9 } },
            { id: 'contraatacar', texto: 'Denunciar su suelo también', efectos: { fans: 500, prob: 0.5, malo: { fans: -400, presupuesto: -200_000 } } },
        ],
    },
    {
        id: 'cumple_mecanico', texto: 'Es el cumpleaños del jefe de mecánicos, que lleva 20 años en el equipo.',
        opciones: [
            { id: 'fiesta', texto: 'Fiesta sorpresa en el taller (−40 k€)', efectos: { presupuesto: -40_000, riesgoFiab: 0.85, moral: { ambos: 2 } } },
            { id: 'regalo', texto: 'Un regalo y una tarjeta', efectos: { riesgoFiab: 0.95 } },
            { id: 'nada', texto: 'Hay demasiado trabajo', efectos: { riesgoFiab: 1.1 }, defecto: true },
        ],
    },
    {
        id: 'simulador_nuevo', texto: 'El fabricante del simulador ofrece probar su nuevo software una semana.',
        opciones: [
            { id: 'probar', texto: 'Probarlo (−180 k€)', efectos: { presupuesto: -180_000, tandas: 3 } },
            { id: 'demo', texto: 'Solo la versión de prueba gratuita', efectos: { tandas: 1 } },
            { id: 'no', texto: 'Estamos bien así', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'foto_polemica', texto: 'Aparece una foto de {p2} de fiesta dos días antes de la carrera.',
        opciones: [
            { id: 'multa', texto: 'Multarle públicamente', efectos: { moral: { p2: -8 }, fans: 200 } },
            { id: 'privado', texto: 'Hablarlo en privado', efectos: { moral: { p2: -2 }, forma: { p2: 0.2 } } },
            { id: 'defender', texto: 'Defenderle: tiene derecho a desconectar', efectos: { moral: { p2: 6 }, fans: -250 } },
        ],
    },
    {
        id: 'motorista_extra', texto: 'El proveedor de motor ofrece una unidad extra para el banco de pruebas.',
        opciones: [
            { id: 'comprar', texto: 'Comprarla (−450 k€)', efectos: { presupuesto: -450_000, horasID: 8, riesgoFiab: 0.9 } },
            { id: 'alquilar', texto: 'Alquilarla una semana (−150 k€)', efectos: { presupuesto: -150_000, horasID: 3 } },
            { id: 'no', texto: 'No hace falta', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'visita_colegio', texto: 'Un colegio de la zona pide que {p1} dé una charla a los alumnos.',
        opciones: [
            { id: 'ir', texto: 'Que vaya', efectos: { fans: 350, moral: { p1: 2 } } },
            { id: 'video', texto: 'Mandar un vídeo', efectos: { fans: 100 } },
            { id: 'no', texto: 'No tiene tiempo', efectos: { fans: -150 }, defecto: true },
        ],
    },
    {
        id: 'ingeniero_quemado', texto: 'Tu ingeniero de pista dice que está quemado y piensa en irse.',
        opciones: [
            { id: 'subida', texto: 'Subirle el sueldo (−250 k€)', efectos: { presupuesto: -250_000, tandas: 1, moral: { ambos: 1 } } },
            { id: 'vacaciones', texto: 'Darle una semana libre', efectos: { tandas: -1, riesgoFiab: 1.1 } },
            { id: 'dejarle', texto: 'Si quiere irse, que se vaya', efectos: { moral: { ambos: -3 }, tandas: -1 }, defecto: true },
        ],
    },
    {
        id: 'videojuego', texto: 'Un estudio quiere incluir a {equipo} en su próximo videojuego de carreras.',
        opciones: [
            { id: 'licencia', texto: 'Vender la licencia (+400 k€)', efectos: { presupuesto: 400_000, fans: 400 } },
            { id: 'gratis', texto: 'Gratis, a cambio de visibilidad', efectos: { fans: 900 } },
            { id: 'no', texto: 'No nos interesa', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'neumaticos_prueba', texto: 'El proveedor de neumáticos busca un equipo para probar un compuesto nuevo.',
        opciones: [
            { id: 'si', texto: 'Presentarse voluntarios (+200 k€)', efectos: { presupuesto: 200_000, tandas: 1, forma: { ambos: -0.1 } } },
            { id: 'solo_p2', texto: 'Que lo pruebe solo {p2}', efectos: { presupuesto: 100_000, forma: { p2: -0.2 }, moral: { p2: -1 } } },
            { id: 'no', texto: 'Nos centramos en lo nuestro', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'director_marketing', texto: 'El director de marketing quiere pintar el coche de rosa para una campaña benéfica.',
        opciones: [
            { id: 'si', texto: '¡Adelante!', efectos: { fans: 800, presupuesto: 100_000 } },
            { id: 'una', texto: 'Solo una carrera', efectos: { fans: 300 } },
            { id: 'no', texto: 'Los colores no se tocan', efectos: { fans: -100 }, defecto: true },
        ],
    },
    {
        id: 'rival_pide_piezas', texto: '{rival} se ha quedado sin piezas de recambio y te pide unas prestadas.',
        opciones: [
            { id: 'prestar', texto: 'Prestárselas', efectos: { fans: 400, riesgoFiab: 1.15 } },
            { id: 'vender', texto: 'Vendérselas caras (+300 k€)', efectos: { presupuesto: 300_000, fans: -150 } },
            { id: 'no', texto: 'Que se busquen la vida', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'ayuno', texto: '{p1} quiere hacer una dieta extrema para perder peso antes de la carrera.',
        opciones: [
            { id: 'nutricionista', texto: 'Con un nutricionista (−60 k€)', efectos: { presupuesto: -60_000, forma: { p1: 0.3 } } },
            { id: 'libre', texto: 'Que lo haga a su manera', efectos: { forma: { p1: 0.5 }, prob: 0.5, malo: { forma: { p1: -0.5 } } } },
            { id: 'prohibir', texto: 'Prohibírselo', efectos: { moral: { p1: -3 } }, defecto: true },
        ],
    },
    {
        id: 'tormenta_fabrica', texto: 'Una tormenta ha dejado sin luz la fábrica esta noche.',
        opciones: [
            { id: 'generador', texto: 'Alquilar generadores (−120 k€)', efectos: { presupuesto: -120_000 } },
            { id: 'esperar', texto: 'Esperar a que vuelva la luz', efectos: { horasID: -5 }, defecto: true },
            { id: 'turno', texto: 'Turno extra cuando vuelva (−60 k€)', efectos: { presupuesto: -60_000, horasID: -1, riesgoFiab: 1.1 } },
        ],
    },
    {
        id: 'piloto_reserva', texto: 'Un piloto de reserva con experiencia se ofrece para trabajar en el simulador.',
        opciones: [
            { id: 'fichar', texto: 'Ficharlo (−220 k€)', efectos: { presupuesto: -220_000, tandas: 2 } },
            { id: 'prueba', texto: 'Una semana de prueba (−60 k€)', efectos: { presupuesto: -60_000, tandas: 1 } },
            { id: 'no', texto: 'No hace falta', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'celebracion', texto: 'Los fans piden que el equipo celebre en la calle el buen momento.',
        opciones: [
            { id: 'fiesta', texto: 'Fiesta con los aficionados (−150 k€)', efectos: { presupuesto: -150_000, fans: 1000, forma: { ambos: -0.1 } } },
            { id: 'firmas', texto: 'Sesión de firmas', efectos: { fans: 400 } },
            { id: 'no', texto: 'Todavía no hemos ganado nada', efectos: { moral: { ambos: 1 } }, defecto: true },
        ],
    },
    {
        id: 'contrato_largo', texto: '{p1} pide hablar de su futuro: quiere saber si cuentas con él.',
        opciones: [
            { id: 'renovar', texto: 'Prometerle continuidad', efectos: { moral: { p1: 7 }, forma: { p1: 0.2 } } },
            { id: 'rendimiento', texto: 'Depende de sus resultados', efectos: { moral: { p1: -3 }, forma: { p1: 0.3 } } },
            { id: 'evitar', texto: 'Cambiar de tema', efectos: { moral: { p1: -5 } }, defecto: true },
        ],
    },
    {
        id: 'app_telemetria', texto: 'Una startup ofrece una app que analiza la telemetría con inteligencia artificial.',
        opciones: [
            { id: 'comprar', texto: 'Comprar la licencia (−300 k€)', efectos: { presupuesto: -300_000, tandas: 2, horasID: 2 } },
            { id: 'invertir', texto: 'Invertir en la startup: puede multiplicar el dinero… o perderlo', efectos: { presupuesto: 700_000, prob: 0.4, malo: { presupuesto: -500_000 } } },
            { id: 'no', texto: 'Suena a humo', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'error_estrategia', texto: 'El jefe de estrategia admite que se equivocó en la última carrera.',
        opciones: [
            { id: 'apoyar', texto: 'Apoyarle en público', efectos: { moral: { ambos: 1 }, fans: 100 } },
            { id: 'sustituir', texto: 'Traer a otro (−200 k€)', efectos: { presupuesto: -200_000, tandas: 1, moral: { ambos: 2 } } },
            { id: 'bronca', texto: 'Bronca delante de todos', efectos: { moral: { ambos: -2 } }, defecto: true },
        ],
    },
    {
        id: 'intercambio_datos', texto: 'Otra escudería de tu grupo o de otra liga propone intercambiar datos de reglaje.',
        opciones: [
            { id: 'aceptar', texto: 'Aceptar el intercambio', efectos: { tandas: 2, prob: 0.8, malo: { fans: -200 } } },
            { id: 'pagar', texto: 'Comprar sus datos sin dar los nuestros (−200 k€)', efectos: { presupuesto: -200_000, tandas: 2 } },
            { id: 'no', texto: 'Nuestros datos no salen de aquí', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'fan_enfermo', texto: 'Un niño enfermo, gran fan de {p2}, sueña con conocerle.',
        opciones: [
            { id: 'visita', texto: 'Que le visite con el casco firmado', efectos: { fans: 900, moral: { p2: 5 } } },
            { id: 'invitar', texto: 'Invitarle al box en la próxima carrera', efectos: { fans: 1200, moral: { p2: 4 }, forma: { p2: -0.1 } } },
            { id: 'regalo', texto: 'Enviarle un regalo', efectos: { fans: 250 }, defecto: true },
        ],
    },
    {
        id: 'motor_viejo', texto: 'Queda en el almacén un motor de la temporada pasada con pocos kilómetros.',
        opciones: [
            { id: 'vender', texto: 'Venderlo a un coleccionista (+350 k€)', efectos: { presupuesto: 350_000 } },
            { id: 'banco', texto: 'Usarlo en el banco de pruebas', efectos: { horasID: 4 } },
            { id: 'museo', texto: 'Exponerlo en la fábrica', efectos: { fans: 300 }, defecto: true },
        ],
    },
    {
        id: 'apuesta_piloto', texto: '{p1} y {p2} apuestan a ver quién es más rápido en la próxima qualy.',
        opciones: [
            { id: 'permitir', texto: 'Que se piquen, es sano', efectos: { forma: { ambos: 0.3 }, moral: { ambos: -1 } } },
            { id: 'premio', texto: 'Poner un premio al ganador (−50 k€)', efectos: { presupuesto: -50_000, forma: { ambos: 0.4 } } },
            { id: 'prohibir', texto: 'Aquí se corre en equipo', efectos: { moral: { ambos: -2 } }, defecto: true },
        ],
    },
    {
        id: 'huelga_transporte', texto: 'Hay huelga de transporte: el camión con las piezas llegará tarde.',
        opciones: [
            { id: 'avion', texto: 'Mandarlas en avión (−200 k€)', efectos: { presupuesto: -200_000 } },
            { id: 'furgonetas', texto: 'Llevarlas en furgonetas propias (−70 k€)', efectos: { presupuesto: -70_000, riesgoFiab: 1.1 } },
            { id: 'esperar', texto: 'Esperar', efectos: { horasID: -6, riesgoFiab: 1.2 }, defecto: true },
        ],
    },
    {
        id: 'leyenda', texto: 'Un excampeón de la categoría se ofrece como mentor de {p2}.',
        opciones: [
            { id: 'aceptar', texto: 'Aceptar (−180 k€)', efectos: { presupuesto: -180_000, forma: { p2: 0.5 }, moral: { p2: 3 } } },
            { id: 'ambos', texto: 'Que trabaje con los dos (−300 k€)', efectos: { presupuesto: -300_000, forma: { ambos: 0.4 } } },
            { id: 'no', texto: 'No hace falta', efectos: { moral: { p2: -1 } }, defecto: true },
        ],
    },
    {
        id: 'sorteo', texto: 'Marketing propone sortear un día en el equipo entre los aficionados.',
        opciones: [
            { id: 'si', texto: 'Hacer el sorteo (−30 k€)', efectos: { presupuesto: -30_000, fans: 600 } },
            { id: 'vip', texto: 'Venderlo como experiencia VIP (+150 k€)', efectos: { presupuesto: 150_000, fans: 100 } },
            { id: 'no', texto: 'No', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'escuderia_quiebra', texto: 'Se rumorea que {rival} está en apuros económicos y vende material.',
        opciones: [
            { id: 'comprar', texto: 'Comprar su simulador (−350 k€)', efectos: { presupuesto: -350_000, tandas: 3 } },
            { id: 'herramientas', texto: 'Comprar herramientas (−120 k€)', efectos: { presupuesto: -120_000, riesgoFiab: 0.85 } },
            { id: 'no', texto: 'No aprovecharse', efectos: { fans: 150 }, defecto: true },
        ],
    },
    {
        id: 'fallo_informatico', texto: 'Un fallo informático ha borrado parte de los datos de la última jornada.',
        opciones: [
            { id: 'recuperar', texto: 'Pagar a expertos para recuperarlos (−150 k€)', efectos: { presupuesto: -150_000 } },
            { id: 'rehacer', texto: 'Rehacer el trabajo con horas extra', efectos: { horasID: -3, tandas: -1 } },
            { id: 'olvidar', texto: 'Seguir adelante', efectos: { tandas: -1 }, defecto: true },
        ],
    },
    {
        id: 'bandera_local', texto: 'El ayuntamiento quiere dar la medalla de la ciudad a {p1}.',
        opciones: [
            { id: 'ir', texto: 'Acto con todo el equipo', efectos: { fans: 500, moral: { p1: 4, p2: -1 } } },
            { id: 'p1', texto: 'Que vaya solo {p1}', efectos: { fans: 250, moral: { p1: 3 } } },
            { id: 'aplazar', texto: 'Aplazarlo a final de temporada', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'reglamento_duda', texto: 'Tus ingenieros encuentran un vacío en el reglamento que podría darte ventaja.',
        opciones: [
            { id: 'explotar', texto: 'Explotarlo (−200 k€)', efectos: { presupuesto: -200_000, horasID: 8, prob: 0.6, malo: { presupuesto: -500_000, fans: -300 } } },
            { id: 'consultar', texto: 'Consultar antes a la FIA', efectos: { horasID: 2 } },
            { id: 'no', texto: 'No jugar con fuego', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'retiro_estres', texto: 'La psicóloga del equipo recomienda un fin de semana de desconexión para {p2}.',
        opciones: [
            { id: 'si', texto: 'Hacerle caso', efectos: { moral: { p2: 6 }, forma: { p2: 0.2 } } },
            { id: 'ambos', texto: 'Que vayan los dos (−80 k€)', efectos: { presupuesto: -80_000, moral: { ambos: 4 } } },
            { id: 'no', texto: 'No es momento', efectos: { moral: { p2: -3 } }, defecto: true },
        ],
    },
    {
        id: 'subasta', texto: 'Una casa de subastas quiere vender el casco de la primera victoria del equipo.',
        opciones: [
            { id: 'vender', texto: 'Venderlo (+300 k€)', efectos: { presupuesto: 300_000, fans: -200 } },
            { id: 'benefica', texto: 'Subasta benéfica', efectos: { fans: 600 } },
            { id: 'quedarlo', texto: 'Es historia del equipo', efectos: { moral: { ambos: 1 } }, defecto: true },
        ],
    },
    {
        id: 'motor_fiable', texto: 'Motores propone bajar potencia para ganar fiabilidad en la próxima jornada.',
        opciones: [
            { id: 'fiable', texto: 'Prioridad: acabar las carreras', efectos: { riesgoFiab: 0.6, forma: { ambos: -0.1 } } },
            { id: 'potencia', texto: 'Prioridad: velocidad', efectos: { riesgoFiab: 1.3, forma: { ambos: 0.2 } } },
            { id: 'igual', texto: 'Dejarlo como está', efectos: {}, defecto: true },
        ],
    },
    {
        id: 'socio_inversor', texto: 'Un inversor quiere comprar una pequeña parte de {equipo}.',
        opciones: [
            { id: 'vender', texto: 'Vender un 5% (+900 k€)', efectos: { presupuesto: 900_000, moral: { ambos: -1 } } },
            { id: 'negociar', texto: 'Negociar más dinero', efectos: { presupuesto: 1_400_000, prob: 0.45, malo: {} } },
            { id: 'no', texto: 'El equipo no se vende', efectos: { fans: 200 }, defecto: true },
        ],
    },
];

// Opciones extra para cartas que solo tenían dos
export const OPCIONES_EXTRA = {
    simulador_noche: { id: 'los_dos', texto: 'Que se queden los dos (−50 k€)', efectos: { presupuesto: -50_000, forma: { ambos: 0.3 }, tandas: 1, moral: { ambos: -1 } } },
    proveedor_barato: { id: 'probar', texto: 'Comprar solo unas pocas para probar (+150 k€)', efectos: { presupuesto: 150_000, riesgoFiab: 1.15 } },
    ingeniero_rival: { id: 'consultor', texto: 'Contratarlo solo como consultor (−250 k€, I+D 2 h)', efectos: { presupuesto: -250_000, horasID: 2 } },
    tunel_viento: { id: 'media', texto: 'Media franja (−200 k€, I+D 3 h)', efectos: { presupuesto: -200_000, horasID: 3 } },
    mecanicos_cansados: { id: 'turnos', texto: 'Organizar turnos (−80 k€)', efectos: { presupuesto: -80_000, riesgoFiab: 0.95, horasID: 1 } },
    coach: { id: 'ambos', texto: 'Que trabaje con los dos (−350 k€)', efectos: { presupuesto: -350_000, forma: { ambos: 0.4 } } },
    rumor_prensa: { id: 'bromear', texto: 'Tomárselo con humor en redes', efectos: { fans: 300, prob: 0.7, malo: { moral: { p1: -4 } } } },
    cena_patrocinador: { id: 'uno', texto: 'Que vaya solo {p1}', efectos: { presupuesto: 50_000, moral: { p1: -1 } } },
    motor_prueba: { id: 'suave', texto: 'Probar un mapa intermedio (−80 k€)', efectos: { presupuesto: -80_000, horasID: 2 } },
    streamer: { id: 'un_rato', texto: 'Solo una hora, sin entrar al box', efectos: { fans: 350 } },
    descanso_piloto: { id: 'medio', texto: 'Un día de descanso y fisio', efectos: { forma: { p2: 0.1 }, moral: { p2: 1 } } },
    academia: { id: 'curso', texto: 'Dar un curso con {p1} (−40 k€)', efectos: { presupuesto: -40_000, fans: 350, moral: { p1: 1 } } },
};
