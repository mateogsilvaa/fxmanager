import { montar } from '../core/layout.js';
import { PUNTOS_CARRERA, PUNTOS_QUALY, ECO, costeMejora, tandasSimulador } from '../engine/constants.js';
import { dinero } from '../core/ui.js';

await montar({ activo: 'reglamento' });
document.getElementById('main').innerHTML = `
<div class="cabecera-pagina"><div><h1>Reglamento</h1><p class="sub">Campeonato Global Hyper Race X1 · Vehículo oficial: BAC Mono (580 kg, 304 bhp, tracción trasera, dirección a 540°, sin ayudas electrónicas).</p></div></div>
<div class="rejilla rejilla-2">
<section class="tarjeta"><h2>1. La competición</h2>
<p><b>Fase 1 · Ligas nacionales.</b> España, Italia, Reino Unido, Alemania y Australia. 20 pilotos y 10 escuderías por país, 5 fines de semana por liga.</p>
<p><b>Fase 2 · Liga Intercontinental.</b> Sede neutral distinta cada año, 3 fines de semana. Clasifican 20 pilotos: el top 3 de cada liga nacional y los 5 mejores del resto por puntos. Se compite por el título de Pilotos y el Mundial de Escuderías.</p>
<p><b>Recompensa.</b> Clasificar al Mundial da inmunidad de despido para la temporada siguiente.</p></section>

<section class="tarjeta"><h2>2. El fin de semana</h2>
<ul class="lista">
<li><b>Viernes:</b> Libres (20 min) + Clasificación 1 (15 min).</li>
<li><b>Sábado:</b> Carrera 1 (10 vueltas, parrilla de la Qualy 1) + Clasificación 2.</li>
<li><b>Domingo:</b> Carrera 2 (10 vueltas, parrilla de la Qualy 2) + Carrera 3 (15 vueltas, parrilla según el resultado de la Carrera 2).</li></ul>
<p class="muted">Los horarios exactos los fija la organización y aparecen en el calendario de cada liga.</p></section>

<section class="tarjeta"><h2>3. Puntos</h2>
<p><b>Clasificación (top 5):</b> ${PUNTOS_QUALY.join(', ')}.</p>
<p><b>Carrera (top 15):</b> ${PUNTOS_CARRERA.join(', ')}.</p>
<p><b>Vuelta rápida:</b> +3 puntos al piloto que la consiga y termine la carrera.</p>
<p>La clasificación de escuderías suma los puntos de sus dos pilotos.</p></section>

<section class="tarjeta"><h2>4. Franquicias y mercado</h2>
<p><b>Cuota nacional:</b> mínimo 11 pilotos locales de 20 por liga. El Piloto 1 de cada escudería es siempre de la nacionalidad de la liga. Algunos grupos tienen equipos en varios países.</p>
<p><b>Traspasos internacionales:</b> cada liga pierde un <i>Galáctico</i> (un piloto del top 5) y un <i>Táctico</i> (media tabla), que cambian de país.</p>
<p><b>Despidos por rendimiento relativo:</b> no se despide a los últimos por ser últimos, sino según su rendimiento frente al compañero de equipo (distancia en la clasificación y duelos directos). Los 2 peores índices son despidos directos; los 2 siguientes entran en zona de peligro y solo caen si su compañero está en el top 8 y les saca 5 o más puestos, o si les saca 10 o más (si los dos van mal, el problema es el coche). Las vacantes se cubren con un draft de rookies.</p></section>

<section class="tarjeta"><h2>5. Cómo se juega (mánagers)</h2>
<ul class="lista">
<li>🗓️ <b>Cada día:</b> recoge tu recompensa (la racha multiplica el dinero: hasta ${dinero(ECO.checkinBase + 7 * ECO.checkinPorRacha)} al día) y responde a la <b>decisión del día</b> antes de medianoche. Si no contestas, se aplica la peor opción.</li>
<li>🧪 <b>Simulador:</b> cada evento tiene un reglaje ideal secreto (ala, suspensión, marchas) distinto para cada coche. Tienes ${tandasSimulador(0)} tandas diarias (más con el simulador mejorado) para acercarte. Un buen reglaje vale varias décimas por vuelta.</li>
<li>🎛️ <b>Estrategia por sesión:</b> reglaje, nivel de riesgo en qualy, ritmo y actitud en carrera. Cada sesión se cierra ${60} min antes de su hora.</li>
<li>🔧 <b>I+D:</b> motor, aerodinámica, chasis y fiabilidad (niveles 0-10). Los proyectos tardan horas y pueden fallar. El primer nivel cuesta ${dinero(costeMejora(0))}.</li>
<li>🏗️ <b>Instalaciones:</b> fábrica, simulador y marketing.</li>
<li>🕵️ <b>Espionaje:</b> coche, pilotos o la estrategia de un rival. Te pueden pillar.</li>
<li>💼 <b>Patrocinador:</b> seguro, por rendimiento o de alto riesgo. Uno por temporada.</li>
<li>🎯 <b>Pronósticos:</b> abiertos a todo el mundo, tengas equipo o no.</li></ul>
<p class="muted">Todo se procesa automáticamente: las sesiones se simulan al cerrar las estrategias y se publican, con retransmisión en directo, a la hora del calendario.</p></section>
</div>`;
