import { montar } from '../core/layout.js';
import {
    PUNTOS_CARRERA, PUNTOS_CARRERA_LARGA, PUNTOS_QUALY, PUNTOS_VR, ECO, costeMejora, tandasSimulador, SLOTS_ID, RECARGO_URGENTE,
    costeInstalacion, INSTALACIONES, ENTRENO,
} from '../engine/constants.js';
import { MERCADO } from '../engine/mercado.js';
import { asignacionTemporada, PRESUPUESTO_MIN, BONUS_GLOBAL } from '../engine/constants.js';
import { dinero } from '../core/ui.js';

await montar({ activo: 'reglamento' });

const indice = [
    ['simulacion', 'Qué es esto'], ['formato', 'El campeonato'], ['jornada', 'Una jornada'], ['puntos', 'Puntos'],
    ['mundial', 'El Mundial'], ['mercado', 'El mercado'], ['novedades', 'Temporada 2'], ['despidos', 'Despidos'], ['economia', 'Economía'],
    ['cada-dia', 'Qué hacer cada día'], ['club', 'Imagen y filiales'], ['carrera', 'Cómo se decide una carrera'],
];
const seccion = (id, titulo, html) => `<section id="${id}" style="scroll-margin-top:90px;padding:30px 0;border-bottom:1px solid var(--hair)">
  <div class="tarjeta-titulo"><h2>${titulo}</h2></div><div class="guia">${html}</div></section>`;
const tabla = (cab, filas) => `<div class="tabla-scroll" style="margin-bottom:14px"><table class="tabla"><thead><tr>${cab.map((c, i) => `<th class="${i ? 'der' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td class="${i ? 'der' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const tablaTexto = (cab, filas) => `<div class="tabla-scroll" style="margin-bottom:14px"><table class="tabla"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

document.getElementById('main').innerHTML = `
<style>
  .guia p, .guia li { font-size: 15px; line-height: 1.6; color: var(--body); max-width: 68ch; }
  .guia ul, .guia ol { padding-left: 18px; margin: 0 0 1em; }
  .guia li { margin-bottom: 6px; }
  .guia b { color: var(--ink); }
  .indice { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 0 0 18px; border-bottom: 1px solid var(--hair); }
  .indice a { font: 700 10px var(--sans); text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
  .indice a:hover { color: var(--accent); }
</style>
<div class="cabecera-pagina"><div><div class="etiqueta">Guía completa</div><h1>Cómo funciona</h1><p class="sub">Todo lo que necesitas saber para dirigir tu escudería.</p></div></div>
<nav class="indice">${indice.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>

${seccion('simulacion', 'Qué es esto', `
<p>Hyper Race X1 es un campeonato de coches iguales (el BAC Mono) repartido en cinco ligas nacionales. <b>Tú no conduces: diriges una escudería.</b> Tus decisiones (reglaje, estrategia, desarrollo del coche y dinero) cambian cómo rinden tus dos pilotos.</p>
<p><b>Todas las sesiones se simulan solas</b> con los datos de cada piloto, cada coche y lo que haya decidido cada mánager. De esa simulación salen los resultados, los tiempos por vuelta, los adelantamientos, las estadísticas y las crónicas. Se publican a la hora exacta del calendario y se pueden seguir en directo.</p>`)}

${seccion('formato', 'El campeonato', `
<ul>
<li><b>Cinco ligas nacionales:</b> España, Italia, Reino Unido, Alemania y Australia. Cada una tiene 10 escuderías, 20 pilotos y 5 jornadas.</li>
<li><b>Los pilotos se mueven en el mercado de fin de temporada</b>, siempre con las normas de la liga (Galácticos, vacantes y trueques).</li>
<li><b>Cuota nacional (55%):</b> el Piloto 1 de cada escudería es siempre de la nacionalidad de la liga, y cada liga tiene al menos 11 de sus 20 pilotos locales. Ningún movimiento del mercado puede romperlo.</li>
<li>Algunas marcas (Valcor, Kessler, Altair, Stellari, Northline) tienen escuderías en varios países. Cuando una mejora un área del coche, sus hermanas la desarrollan un 25% más barata. Esas escuderías no se pueden elegir al inscribirse: solo se llega a ellas por una oferta.</li>
<li>Las escuderías sin mánager las dirige la IA, cada una con su propio mánager ficticio (lo verás como «Nombre (IA)», también en la prensa).</li>
<li>Al terminar las ligas se juega la <b>Liga Intercontinental</b> (el Mundial) en una sede neutral.</li>
</ul>`)}

${seccion('jornada', 'Una jornada', `
<p>Hay una jornada cada pocos días (lo marca el calendario de cada liga). Cada jornada dura <b>dos días</b>:</p>
${tablaTexto(['Día', 'Sesiones'], [['Día 1', 'Libres · Clasificación 1 · Carrera 1 (10 vueltas, sale según la Clasificación 1)'], ['Día 2', 'Clasificación 2 · Carrera 2 (10 vueltas, sale según la Clasificación 2) · Carrera 3 (20 vueltas con parada obligatoria, sale según el resultado de la Carrera 2)']])}
<p>La estrategia de cada sesión se cierra un rato antes de que empiece (normalmente 30 minutos). Después ya no se puede cambiar.</p>`)}

${seccion('puntos', 'Puntos', `
${tabla(['Posición', 'Clasificación', 'Carreras 1 y 2', 'Carrera 3'], PUNTOS_CARRERA.map((p, i) => [`${i + 1}º`, PUNTOS_QUALY[i] ?? '—', p, PUNTOS_CARRERA_LARGA[i]]))}
<p>La vuelta rápida de cada carrera da <b>${PUNTOS_VR} puntos extra</b> si el piloto termina. Una escudería suma los puntos de sus dos pilotos.</p>`)}

${seccion('mundial', 'El Mundial', `
<ul>
<li>Clasifican <b>20 pilotos</b>: los 3 primeros de cada liga y los 5 mejores del resto por puntos, sea cual sea su liga.</li>
<li>Se juegan <b>3 jornadas</b> y hay título de pilotos y de escuderías.</li>
<li>Los pilotos que van al Mundial <b>no pueden ser despedidos</b> ese verano.</li>
<li>Tu escudería cobra <b>${dinero(ECO.bonusClasificadoMundial)} por cada piloto clasificado</b>, y en el Mundial <b>cada punto vale el triple</b> en premios.</li>
<li>Al final: ${ECO.premiosMundialEscuderias.map((v, i) => `${i + 1}º de escuderías ${dinero(v)}`).join(', ')}, y ${dinero(ECO.bonusCampeonMundial)} para la escudería del campeón del mundo.</li>
</ul>`)}

${seccion('mercado', 'El mercado', `
<p>El mercado <b>abre al empezar el Mundial y cierra 2 días después de que termine</b>. Lo que se cierre mientras se juega el Mundial se aplica en cuanto acaba, para que nadie cambie de equipo a mitad de competición. Todo se hace desde la página de Mercado y cada operación se ve en directo. Ningún movimiento puede dejar una liga por debajo del <b>55% de pilotos locales</b> ni a una escudería sin piloto local.</p>
<p><b>Los Galácticos (sale uno por liga).</b> Cada liga presenta hasta <b>${MERCADO.candidatos} candidatos</b> de su top 5, pero <b>solo uno cambia de liga</b>: el primero por el que se cierre un traspaso o, al cerrar el mercado, el que decida la liga. En cuanto uno se va, los demás candidatos de su liga se quedan y las pujas por ellos se anulan sin coste. Solo puede ser candidato un piloto cuyo compañero sea local, para que su escudería conserve a su Piloto 1. Las escuderías de la IA también pujan por candidatos de otras ligas y venden a los suyos si les pagan bien.</p>
<ul>
<li><b>Si te quitan a tu Galáctico</b> tienes dos opciones: aceptar una oferta de otra escudería (cobras lo que ofrece y recibes a su segundo piloto) o dejar que decida la liga (cobras la compensación de la liga, ${dinero(MERCADO.compensacionLiga)}, y recibes al segundo piloto de quien se lo lleve).</li>
<li><b>Para fichar un Galáctico</b> tu escudería tiene que haber acabado entre las ${MERCADO.topComprador} mejores de su liga. Puedes hacer una oferta por uno concreto (también durante la temporada, desde Mi escudería) o pedir un traspaso a la liga diciendo cuánto pagarías. A cambio se va tu segundo piloto.</li>
<li><b>Si decide la liga</b> (al cerrar el mercado), mira primero las ofertas, luego las solicitudes de traspaso (si te toca, se te cobra lo que dijiste) y luego a las escuderías de la IA. Muy de vez en cuando se lo da por sorpresa a otra escudería; si no lo había pedido, paga solo un precio simbólico de ${dinero(MERCADO.precioSimbolico)}.</li>
</ul>
<p><b>Retiradas.</b> Al abrir el mercado algunos veteranos (sobre todo a partir de los 33 años) anuncian que cuelgan el casco y dejan una vacante, igual que un despido.</p>
<p><b>Agentes libres.</b> Hay una bolsa de más de cien pilotos sin equipo (despedidos, veteranos y jóvenes) que se rellena sola. Tienen una valoración pública en estrellas y un precio fijo: si tienes una vacante, puedes fichar a cualquiera al momento desde Mercado. La IA también tira de ellos si son mejores que los rookies.</p>
<p><b>Vacantes.</b> Si te despiden a un piloto (o se retira), durante el mercado puedes fichar a un agente libre o a uno de otra escudería (de cualquier liga) haciendo una oferta (mínimo ${dinero(MERCADO.fichajeMinimo)}). Una escudería de la IA vende si le pagas lo que vale el piloto; un mánager decide él. Quien vende se queda con una vacante. Si al cerrar no la has cubierto, la liga te asigna un rookie (puedes ordenar a tus favoritos; eligen antes las peor clasificadas).</p>
<p><b>Despido de mánagers.</b> Al terminar el Mundial, el consejo de cada escudería echa al mánager que lo ha hecho muy mal (rating por debajo de 30, casi siempre el último de su liga). Vale para la IA y para las personas: si te despiden, pierdes la escudería y puedes elegir otra libre.</p>
<p><b>Fichas de fichaje y trueques.</b> Si tu alineación no tiene movimientos previstos, puedes pedir una ficha de fichaje a la liga. Con ella propones un cambio de piloto por piloto a otra escudería que también tenga ficha. La IA acepta si no sale perdiendo.</p>`)}

${seccion('novedades', 'Novedades de la temporada 2', `
<p><b>Ingenieros.</b> Cada escudería tiene 2 ingenieros de motor, 2 de aerodinámica, 2 de chasis, 2 de fiabilidad y 1 ingeniero de pista. Cada estrella de los ingenieros de un área hace las mejoras de esa área un 1,5% más baratas, un 1,5% más rápidas y un 1% más seguras. El ingeniero de pista afina las lecturas del reglaje. Cobran un sueldo diario. Puedes fichar ingenieros libres (pagando una prima) o despedir a los tuyos (con indemnización).</p>
<p><b>Negociaciones entre escuderías.</b> Puedes proponer a cualquier escudería una compra (pides algo y pagas), un intercambio (cosa por cosa) o un intercambio con compensación (cosa por cosa y dinero). Se negocian ingenieros, pilotos (solo fuera del periodo de carreras y cumpliendo el 55% de locales) y planos de piezas. Con los planos de un nivel que la otra escudería ya tiene, tu mejora hasta ese nivel no falla y sale un 30% más barata. La IA acepta si sale ganando; un mánager decide él.</p>
<p><b>Blindar a tu Galáctico.</b> Si tu piloto sale como Galáctico, puedes pagar en secreto 1,5 veces la puja más alta que haya por él (o 2 M€ si nadie ha pujado) y se queda en tu escudería.</p>
<p><b>Llamadas y cartas.</b> De vez en cuando, al entrar, te llamará o te escribirá alguien: tu patrocinador, tus pilotos o ingenieros, la FIA, la prensa, un rival o un aficionado. Cuanto más tiempo juegas, más a menudo pasa, y suele ser a la hora a la que sueles conectarte. Lo que decidas tiene consecuencias: dinero, fans, moral, entrenamientos, adelantar una mejora, información… o nada. Si no puedes atenderla en ese momento, queda en el buzón (abajo a la derecha) hasta el final del día.</p>
<p><b>Ramas de desarrollo.</b> Al llegar a los niveles 3, 6 y 9 de cada área del coche eliges uno de dos caminos (potencia punta o par motor, alta carga o baja resistencia, cuidar neumáticos o chasis rígido…). Elegir es gratis; cambiar un camino ya elegido cuesta ${dinero(800_000)}. Así dos coches con el mismo nivel se comportan distinto: uno vuela en las rectas, otro en las curvas, otro con lluvia, otro gasta menos neumáticos o se rompe menos. Puedes ver el carácter de tu coche en Mi escudería → Coche.</p>
<p><b>Juntas de pilotos.</b> Dos veces por temporada (tras la primera jornada y a mitad de liga) se vota durante 48 horas un paquete de micro-cambios: sistema de puntuación, si la última carrera de la liga vale doble o ×1,5, puntos por vuelta rápida o en clasificación, parrilla invertida en la Carrera 2, premios por punto o sanciones a un piloto conflictivo. Cada piloto titular vota (su mánager le da una consigna, pero con la moral baja puede ir por libre) y la FIA tiene 20 votos. Lo aprobado se aplica desde la siguiente sesión.</p>
<p><b>Lesiones.</b> Un accidente grave en la liga nacional puede lesionar al piloto y hacerle perder varias carreras. Eliges a su sustituto entre los agentes libres (pagando un contrato corto); si no eliges a tiempo, el equipo técnico ficha al mejor que se pueda pagar. Al recuperarse vuelve a su asiento y el sustituto a la bolsa. Al acabar las ligas nacionales todos se recuperan.</p>
<p><b>Reputación</b> (de 0 a 100, empieza en 50). La de tu escudería mejora a los patrocinadores, los fans y el precio de los ingenieros. La tuya como mánager decide cuánta paciencia te tiene la directiva (con mucha reputación aguanta un rating más bajo antes de despedirte), lo fácil que es negociar con la IA y cuántas ofertas te llegan para dirigir otras escuderías. Sube con buenos resultados, acuerdos limpios y decisiones valientes; baja con escándalos, despidos o echarte atrás.</p>`)}

${seccion('despidos', 'Despidos', `
<p>No se despide a los últimos por ser últimos. Se mide a cada piloto <b>contra su compañero</b>, que lleva el mismo coche:</p>
<ul>
<li>Cuenta la distancia entre los dos en la clasificación y cuántas veces se han ganado el uno al otro en carrera y en clasificación.</li>
<li><b>Despido directo:</b> los 2 pilotos de cada liga que peor rinden frente a su compañero.</li>
<li><b>Zona de peligro:</b> los 2 siguientes. Caen si su compañero acabó en el top 8 y les sacó 5 puestos o más, o si les sacó 10 o más. Si los dos van mal, se entiende que el coche era malo y se salvan.</li>
<li>Ejemplo: un 18º cuyo compañero es 4º está en peligro; un 16º cuyo compañero es 19º, no.</li>
<li>Los clasificados al Mundial son inmunes.</li>
</ul>
<p>En la pestaña "Mundial y mercado" de cada liga ves en tiempo real quién caería si la temporada acabara hoy.</p>`)}

${seccion('economia', 'Economía', `
<p>Empiezas con <b>${dinero(ECO.presupuestoInicial)}</b>. Solo puedes coger una escudería hasta que termina la primera jornada de todas las ligas; después, la inscripción se cierra hasta la próxima temporada. El dinero sirve para mejorar el coche y las instalaciones, espiar y pedir Galácticos.</p>
${tablaTexto(['Entra dinero por', 'Cuánto'], [
    ['Recompensa diaria', `${dinero(ECO.checkinBase + ECO.checkinPorRacha)} el primer día, hasta ${dinero(ECO.checkinBase + 7 * ECO.checkinPorRacha)} con 7 días seguidos (más con marketing)`],
    ['Puntos', `${dinero(ECO.premioPorPunto)} por cada punto de tus pilotos (el triple en el Mundial)`],
    ['Patrocinador', 'Un pago por jornada, más un bonus si cumples su objetivo'],
    ['Pilotos en el Mundial', `${dinero(ECO.bonusClasificadoMundial)} por cada uno`],
    ['Fin de temporada', `Según tu puesto en la liga: de ${dinero(ECO.premiosLiga[0])} (1º) a ${dinero(ECO.premiosLiga[ECO.premiosLiga.length - 1])} (10º)`],
    ['Clasificación global', `Según tu puesto entre las 50 escuderías: ${BONUS_GLOBAL.map((v, i) => `${i + 1}º ${dinero(v)}`).join(', ')}, del 6º al 10º ${dinero(1_500_000)}, del 11º al 20º ${dinero(1_000_000)} y del 21º al 30º ${dinero(500_000)}`],
    ['Vender un Galáctico', 'El importe de la operación'],
    ['Filiales', `${dinero(ECO.dividendoFilial)} al día por cada una`],
])}
${tablaTexto(['Sale dinero por', 'Cuánto'], [
    ['Salarios de los pilotos', 'Al terminar cada jornada de liga'],
    ['Mejorar un área del coche', `De ${dinero(costeMejora(0))} (nivel 1) a ${dinero(costeMejora(9))} (nivel 10). Urgente: ×${RECARGO_URGENTE} el precio y menos de la mitad de tiempo`],
    ['Instalaciones', `${Object.values(INSTALACIONES).length} tipos: 2 M€ el primer nivel, 4 M€ el segundo…`],
    ['Entrenar a un piloto', `${dinero(ENTRENO.coste)} cada vez`],
    ['Espionaje', `De ${dinero(ECO.costeInvestigacion.piloto)} a ${dinero(ECO.costeInvestigacion.estrategia)} por misión`],
    ['Pedir un Galáctico', 'Lo que ofrezcas, solo si la operación se hace'],
    ['Nombre / colores / filial', `${dinero(ECO.cambioNombre)} / ${dinero(ECO.cambioColor)} / ${dinero(ECO.compraFilial)} (solo fuera del periodo de carreras)`],
])}
<p>El coche tiene cuatro áreas (motor, aerodinámica, chasis y fiabilidad) con 10 niveles. Puedes tener ${SLOTS_ID} mejoras en marcha a la vez; tardan horas y pueden fallar (si fallan recuperas la mitad). Cada circuito premia más unas áreas que otras.</p>
<p><b>Cierre técnico:</b> desde que termina tu liga nacional hasta que acaba el Mundial no se pueden encargar mejoras del coche (las que ya estaban en marcha terminan con normalidad).</p>
<p><b>Parque cerrado:</b> desde que cierra la estrategia de los libres hasta que se publica la última carrera de la jornada no se puede encargar ninguna mejora del coche. Si una mejora termina durante la jornada, la pieza espera en fábrica y se monta al acabar.</p>
<p>Instalaciones (${dinero(costeInstalacion(0))} el primer nivel, hasta 5): ${Object.values(INSTALACIONES).map(i => `<b>${i.nombre}</b> (${i.desc.replace(/[.]$/, '').toLowerCase()})`).join('; ')}.</p>
<p>Al acabar la temporada recibes un resumen con tu posición, puntos, victorias, podios, tus pilotos, el Mundial y el dinero.</p>
<p>Al empezar una temporada nueva cada área del coche pierde 1 o 2 niveles y el presupuesto se queda en la mitad de lo ahorrado más una asignación según tu puesto en la liga la temporada anterior: ${dinero(asignacionTemporada(1))} si fuiste 1º, bajando hasta ${dinero(PRESUPUESTO_MIN)} el 10º. Nunca se empieza con menos de ${dinero(PRESUPUESTO_MIN)}. Las instalaciones no pierden nivel, pero necesitan una <b>limpieza</b> (${dinero(ECO.limpiezaPorNivel)} por nivel) antes de volver a usarse.</p>
<p><b>Temporadas con cambio de reglamento.</b> Algunas temporadas la liga cambia las normas técnicas: el coche pierde entre el 75% y el 85% de su desarrollo (redondeando hacia arriba) y cada instalación hasta 2 niveles. Todas las escuderías reciben 2 M€ de ayuda. Se anuncia en las noticias y te llega un aviso.</p>`)}

${seccion('cada-dia', 'Qué hacer cada día', `
<ol>
<li><b>Recoge la recompensa diaria.</b> Si fallas un día, la racha vuelve a 1.</li>
<li><b>Responde la decisión del día</b> antes de medianoche. Si no, se aplica la opción por defecto (normalmente la peor).</li>
<li><b>Prueba reglajes en el simulador</b> (${tandasSimulador(0)} pruebas al día, más si lo mejoras). Cada coche tiene un reglaje ideal secreto en cada circuito (ala, suspensión, marchas, presión de neumáticos, reparto de frenada y altura de suelo). El ingeniero califica cada ajuste de Súper malo a Excelente; con el simulador mejorado (nivel 2) además te dice si subir o bajar.</li>
<li><b>Guarda la estrategia</b> de la próxima jornada antes de que cierre: riesgo en qualy, ritmo y actitud en cada carrera y, en la Carrera 3, neumático de salida y paradas.</li>
<li><b>Atiende a la prensa.</b> Tras las carreras (2 o 3 preguntas por jornada) y de vez en cuando entre jornadas te preguntan por accidentes, toques, averías, victorias, rivales o la actualidad. Lo que respondes sale publicado y te hace ganar o perder fans; algunas respuestas cambian la moral de tus pilotos. Si no contestas en 24 h, pierdes fans.</li>
<li><b>Entrena a tus pilotos</b> (${dinero(ENTRENO.coste)}, cada ${ENTRENO.diasEspera} días por piloto): puede subir un punto un atributo.</li>
<li><b>Ten el coche siempre en desarrollo.</b></li>
</ol>
<p>Todo lo que pides (mejoras, simulador, espionaje…) lo procesa el servidor en unos segundos.</p>`)}

${seccion('club', 'Imagen, filiales y ofertas', `
<p>En <b>pretemporada</b> y <b>al acabar la temporada</b> (nunca con las carreras en marcha), desde Mi escudería → Equipo puedes:</p>
<ul>
<li><b>Cambiar el nombre</b> (y el nombre corto) por ${dinero(ECO.cambioNombre)}, y <b>los colores</b> por ${dinero(ECO.cambioColor)}. Los nombres ofensivos no se aceptan.</li>
<li><b>Comprar una escudería extranjera</b> sin mánager ni grupo por ${dinero(ECO.compraFilial)} (hasta ${ECO.maxFiliales}, una por país). Pasa a ser tu filial: la sigue llevando la IA, formáis grupo (−25% en I+D cuando una mejora un área) y te paga ${dinero(ECO.dividendoFilial)} al día. También puedes cambiarle el nombre y los colores.</li>
</ul>
<p><b>Ofertas de otras escuderías.</b> Si haces una temporada excepcional (top 3 de escuderías de tu liga, o top 3 del Mundial en pilotos o escuderías), al acabar puede llamarte otra escudería: un ${Math.round(ECO.probOfertaHermanas * 100)}% de probabilidad de que sea una de un grupo con hermanas y un ${Math.round(ECO.probOfertaNormal * 100)}% de que sea una normal. Tienes ${ECO.diasOfertaPlaza} días para decidir. Si aceptas, tu escudería actual pasa a la IA y te quedas con el presupuesto, el coche y los pilotos de la nueva.</p>`)}

${seccion('carrera', 'Cómo se decide una carrera', `
<p>Cada vuelta de cada piloto se calcula con:</p>
<ul>
<li><b>El piloto:</b> ritmo, regularidad, agresividad, defensa, lluvia, experiencia, moral y forma.</li>
<li><b>El coche:</b> los niveles de motor, aero y chasis según lo que pida el circuito, y la fiabilidad para las averías.</li>
<li><b>El reglaje</b> (6 ajustes): cuanto más cerca del ideal, más rápido (hasta un 0,8% por vuelta).</li>
<li><b>Carrera 3 (20 vueltas) y neumáticos:</b> es la única con estrategia de neumáticos. El blando es el más rápido pero dura poco; el duro, el más lento pero aguanta. Cuando un neumático pasa de su vida, pierde mucho tiempo por vuelta. Lo que dura cada compuesto depende mucho del circuito: hay trazados que se comen el blando y otros donde el duro dura menos de lo normal. Es obligatorio parar al menos una vez y usar al menos dos compuestos distintos. Parar en boxes cuesta unos segundos (menos con coche de seguridad) y la parada puede salir muy bien o mal; con el Taller y mecánicos mejorado, las malas son menos frecuentes. Tras los libres, el ingeniero te estima cuántas vueltas aguanta cada compuesto: la estimación es más precisa cuanto mejor sea tu reglaje, tu simulador y la experiencia de tus pilotos. Si no eliges estrategia, se aplica la propuesta del ingeniero.</li>
<li><b>Coche de seguridad y VSC:</b> tras un accidente o un coche parado en pista puede salir el coche de seguridad (el pelotón se agrupa) o el virtual (todos a ritmo lento). No se puede adelantar y parar en boxes cuesta menos.</li>
<li><b>Accidentes y daños:</b> un choque leve te hace perder el resto de esa sesión; un toque puede dañar el alerón y hacerte más lento el resto de la carrera. Si el accidente es grave y queda otra sesión en la jornada, eliges: reparación urgente (${dinero(ECO.reparacionUrgente)}, llegas a la siguiente sesión) o normal (${dinero(ECO.reparacionNormal)}, te la pierdes). Te avisamos al momento.</li>
<li><b>La estrategia:</b> riesgo en clasificación, y ritmo y actitud en carrera.</li>
<li><b>El azar:</b> errores, toques, averías, tráfico y lluvia (que se anuncia antes como probabilidad).</li>
</ul>
<p>Los adelantamientos dependen de la diferencia de ritmo, de lo fácil que sea adelantar en ese circuito y del duelo entre la agresividad de uno y la defensa del otro.</p>`)}
`;
