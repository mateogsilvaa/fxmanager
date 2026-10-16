import{a as l}from"./c/6WBGZQDG.js";import"./c/WDTX7UIM.js";import"./c/YDS3XFUC.js";import"./c/C2OQADPK.js";import"./c/QA2CC7VW.js";import"./c/KG6NJ7KS.js";import{a as C}from"./c/GOTG5RUR.js";import{g as a}from"./c/YUWPRQBV.js";import"./c/R7E3CXPW.js";import{C as t,H as d,J as f,O as u,R as $,S as j,U as q,m,n as b,o as g,q as v,t as e,u as c,v as y,x as h}from"./c/SPI3NESF.js";await C({activo:"reglamento"});var A=[["simulacion","Qu\xE9 es esto"],["formato","El campeonato"],["jornada","Una jornada"],["puntos","Puntos"],["mundial","El Mundial"],["mercado","El mercado"],["novedades","Temporada 2"],["despidos","Despidos"],["economia","Econom\xEDa"],["cada-dia","Qu\xE9 hacer cada d\xEDa"],["club","Imagen y filiales"],["carrera","C\xF3mo se decide una carrera"]],i=(o,s,r)=>`<section id="${o}" style="scroll-margin-top:90px;padding:30px 0;border-bottom:1px solid var(--hair)">
  <div class="tarjeta-titulo"><h2>${s}</h2></div><div class="guia">${r}</div></section>`,S=(o,s)=>`<div class="tabla-scroll" style="margin-bottom:14px"><table class="tabla"><thead><tr>${o.map((r,n)=>`<th class="${n?"der":""}">${r}</th>`).join("")}</tr></thead><tbody>${s.map(r=>`<tr>${r.map((n,E)=>`<td class="${E?"der":""}">${n}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,p=(o,s)=>`<div class="tabla-scroll" style="margin-bottom:14px"><table class="tabla"><thead><tr>${o.map(r=>`<th>${r}</th>`).join("")}</tr></thead><tbody>${s.map(r=>`<tr>${r.map(n=>`<td>${n}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;document.getElementById("main").innerHTML=`
<style>
  .guia p, .guia li { font-size: 15px; line-height: 1.6; color: var(--body); max-width: 68ch; }
  .guia ul, .guia ol { padding-left: 18px; margin: 0 0 1em; }
  .guia li { margin-bottom: 6px; }
  .guia b { color: var(--ink); }
  .indice { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 0 0 18px; border-bottom: 1px solid var(--hair); }
  .indice a { font: 700 10px var(--sans); text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
  .indice a:hover { color: var(--accent); }
</style>
<div class="cabecera-pagina"><div><div class="etiqueta">Gu\xEDa completa</div><h1>C\xF3mo funciona</h1><p class="sub">Todo lo que necesitas saber para dirigir tu escuder\xEDa.</p></div></div>
<nav class="indice">${A.map(([o,s])=>`<a href="#${o}">${s}</a>`).join("")}</nav>

${i("simulacion","Qu\xE9 es esto",`
<p>Hyper Race X1 es un campeonato de coches iguales (el BAC Mono) repartido en cinco ligas nacionales. <b>T\xFA no conduces: diriges una escuder\xEDa.</b> Tus decisiones (reglaje, estrategia, desarrollo del coche y dinero) cambian c\xF3mo rinden tus dos pilotos.</p>
<p><b>Todas las sesiones se simulan solas</b> con los datos de cada piloto, cada coche y lo que haya decidido cada m\xE1nager. De esa simulaci\xF3n salen los resultados, los tiempos por vuelta, los adelantamientos, las estad\xEDsticas y las cr\xF3nicas. Se publican a la hora exacta del calendario y se pueden seguir en directo.</p>`)}

${i("formato","El campeonato",`
<ul>
<li><b>Cinco ligas nacionales:</b> Espa\xF1a, Italia, Reino Unido, Alemania y Australia. Cada una tiene 10 escuder\xEDas, 20 pilotos y 5 jornadas.</li>
<li><b>Los pilotos se mueven en el mercado de fin de temporada</b>, siempre con las normas de la liga (Gal\xE1cticos, vacantes y trueques).</li>
<li><b>Cuota nacional (55%):</b> el Piloto 1 de cada escuder\xEDa es siempre de la nacionalidad de la liga, y cada liga tiene al menos 11 de sus 20 pilotos locales. Ning\xFAn movimiento del mercado puede romperlo.</li>
<li>Algunas marcas (Valcor, Kessler, Altair, Stellari, Northline) tienen escuder\xEDas en varios pa\xEDses. Cuando una mejora un \xE1rea del coche, sus hermanas la desarrollan un 25% m\xE1s barata. Esas escuder\xEDas no se pueden elegir al inscribirse: solo se llega a ellas por una oferta.</li>
<li>Las escuder\xEDas sin m\xE1nager las dirige la IA, cada una con su propio m\xE1nager ficticio (lo ver\xE1s como \xABNombre (IA)\xBB, tambi\xE9n en la prensa).</li>
<li>Al terminar las ligas se juega la <b>Liga Intercontinental</b> (el Mundial) en una sede neutral.</li>
</ul>`)}

${i("jornada","Una jornada",`
<p>Hay una jornada cada pocos d\xEDas (lo marca el calendario de cada liga). Cada jornada dura <b>dos d\xEDas</b>:</p>
${p(["D\xEDa","Sesiones"],[["D\xEDa 1","Libres \xB7 Clasificaci\xF3n 1 \xB7 Carrera 1 (10 vueltas, sale seg\xFAn la Clasificaci\xF3n 1)"],["D\xEDa 2","Clasificaci\xF3n 2 \xB7 Carrera 2 (10 vueltas, sale seg\xFAn la Clasificaci\xF3n 2) \xB7 Carrera 3 (20 vueltas con parada obligatoria, sale seg\xFAn el resultado de la Carrera 2)"]])}
<p>La estrategia de cada sesi\xF3n se cierra un rato antes de que empiece (normalmente 30 minutos). Despu\xE9s ya no se puede cambiar.</p>`)}

${i("puntos","Puntos",`
${S(["Posici\xF3n","Clasificaci\xF3n","Carreras 1 y 2","Carrera 3"],b.map((o,s)=>[`${s+1}\xBA`,m[s]??"\u2014",o,g[s]]))}
<p>La vuelta r\xE1pida de cada carrera da <b>${v} puntos extra</b> si el piloto termina. Una escuder\xEDa suma los puntos de sus dos pilotos.</p>`)}

${i("mundial","El Mundial",`
<ul>
<li>Clasifican <b>20 pilotos</b>: los 3 primeros de cada liga y los 5 mejores del resto por puntos, sea cual sea su liga.</li>
<li>Se juegan <b>3 jornadas</b> y hay t\xEDtulo de pilotos y de escuder\xEDas.</li>
<li>Los pilotos que van al Mundial <b>no pueden ser despedidos</b> ese verano.</li>
<li>Tu escuder\xEDa cobra <b>${a(e.bonusClasificadoMundial)} por cada piloto clasificado</b>, y en el Mundial <b>cada punto vale el triple</b> en premios.</li>
<li>Al final: ${e.premiosMundialEscuderias.map((o,s)=>`${s+1}\xBA de escuder\xEDas ${a(o)}`).join(", ")}, y ${a(e.bonusCampeonMundial)} para la escuder\xEDa del campe\xF3n del mundo.</li>
</ul>`)}

${i("mercado","El mercado",`
<p>El mercado <b>abre al empezar el Mundial y cierra 2 d\xEDas despu\xE9s de que termine</b>. Lo que se cierre mientras se juega el Mundial se aplica en cuanto acaba, para que nadie cambie de equipo a mitad de competici\xF3n. Todo se hace desde la p\xE1gina de Mercado y cada operaci\xF3n se ve en directo. Ning\xFAn movimiento puede dejar una liga por debajo del <b>55% de pilotos locales</b> ni a una escuder\xEDa sin piloto local.</p>
<p><b>Los Gal\xE1cticos (sale uno por liga).</b> Cada liga presenta hasta <b>${l.candidatos} candidatos</b> de su top 5, pero <b>solo uno cambia de liga</b>: el primero por el que se cierre un traspaso o, al cerrar el mercado, el que decida la liga. En cuanto uno se va, los dem\xE1s candidatos de su liga se quedan y las pujas por ellos se anulan sin coste. Solo puede ser candidato un piloto cuyo compa\xF1ero sea local, para que su escuder\xEDa conserve a su Piloto 1. Las escuder\xEDas de la IA tambi\xE9n pujan por candidatos de otras ligas y venden a los suyos si les pagan bien.</p>
<ul>
<li><b>Si te quitan a tu Gal\xE1ctico</b> tienes dos opciones: aceptar una oferta de otra escuder\xEDa (cobras lo que ofrece y recibes a su segundo piloto) o dejar que decida la liga (cobras la compensaci\xF3n de la liga, ${a(l.compensacionLiga)}, y recibes al segundo piloto de quien se lo lleve).</li>
<li><b>Para fichar un Gal\xE1ctico</b> tu escuder\xEDa tiene que haber acabado entre las ${l.topComprador} mejores de su liga. Puedes hacer una oferta por uno concreto (tambi\xE9n durante la temporada, desde Mi escuder\xEDa) o pedir un traspaso a la liga diciendo cu\xE1nto pagar\xEDas. A cambio se va tu segundo piloto.</li>
<li><b>Si decide la liga</b> (al cerrar el mercado), mira primero las ofertas, luego las solicitudes de traspaso (si te toca, se te cobra lo que dijiste) y luego a las escuder\xEDas de la IA. Muy de vez en cuando se lo da por sorpresa a otra escuder\xEDa; si no lo hab\xEDa pedido, paga solo un precio simb\xF3lico de ${a(l.precioSimbolico)}.</li>
</ul>
<p><b>Retiradas.</b> Al abrir el mercado algunos veteranos (sobre todo a partir de los 33 a\xF1os) anuncian que cuelgan el casco y dejan una vacante, igual que un despido.</p>
<p><b>Agentes libres.</b> Hay una bolsa de m\xE1s de cien pilotos sin equipo (despedidos, veteranos y j\xF3venes) que se rellena sola. Tienen una valoraci\xF3n p\xFAblica en estrellas y un precio fijo: si tienes una vacante, puedes fichar a cualquiera al momento desde Mercado. La IA tambi\xE9n tira de ellos si son mejores que los rookies.</p>
<p><b>Vacantes.</b> Si te despiden a un piloto (o se retira), durante el mercado puedes fichar a un agente libre o a uno de otra escuder\xEDa (de cualquier liga) haciendo una oferta (m\xEDnimo ${a(l.fichajeMinimo)}). Una escuder\xEDa de la IA vende si le pagas lo que vale el piloto; un m\xE1nager decide \xE9l. Quien vende se queda con una vacante. Si al cerrar no la has cubierto, la liga te asigna un rookie (puedes ordenar a tus favoritos; eligen antes las peor clasificadas).</p>
<p><b>Despido de m\xE1nagers.</b> Al terminar el Mundial, el consejo de cada escuder\xEDa echa al m\xE1nager que lo ha hecho muy mal (rating por debajo de 30, casi siempre el \xFAltimo de su liga). Vale para la IA y para las personas: si te despiden, pierdes la escuder\xEDa y puedes elegir otra libre.</p>
<p><b>Fichas de fichaje y trueques.</b> Si tu alineaci\xF3n no tiene movimientos previstos, puedes pedir una ficha de fichaje a la liga. Con ella propones un cambio de piloto por piloto a otra escuder\xEDa que tambi\xE9n tenga ficha. La IA acepta si no sale perdiendo.</p>`)}

${i("novedades","Novedades de la temporada 2",`
<p><b>Ingenieros.</b> Cada escuder\xEDa tiene 2 ingenieros de motor, 2 de aerodin\xE1mica, 2 de chasis, 2 de fiabilidad y 1 ingeniero de pista. Cada estrella de los ingenieros de un \xE1rea hace las mejoras de esa \xE1rea un 1,5% m\xE1s baratas, un 1,5% m\xE1s r\xE1pidas y un 1% m\xE1s seguras. El ingeniero de pista afina las lecturas del reglaje. Cobran un sueldo diario. Puedes fichar ingenieros libres (pagando una prima) o despedir a los tuyos (con indemnizaci\xF3n).</p>
<p><b>Negociaciones entre escuder\xEDas.</b> Puedes proponer a cualquier escuder\xEDa una compra (pides algo y pagas), un intercambio (cosa por cosa) o un intercambio con compensaci\xF3n (cosa por cosa y dinero). Se negocian ingenieros, pilotos (solo fuera del periodo de carreras y cumpliendo el 55% de locales) y planos de piezas. Con los planos de un nivel que la otra escuder\xEDa ya tiene, tu mejora hasta ese nivel no falla y sale un 30% m\xE1s barata. La IA acepta si sale ganando; un m\xE1nager decide \xE9l.</p>
<p><b>Blindar a tu Gal\xE1ctico.</b> Si tu piloto sale como Gal\xE1ctico, puedes pagar en secreto 1,5 veces la puja m\xE1s alta que haya por \xE9l (o 2 M\u20AC si nadie ha pujado) y se queda en tu escuder\xEDa.</p>
<p><b>Llamadas y cartas.</b> De vez en cuando, al entrar, te llamar\xE1 o te escribir\xE1 alguien: tu patrocinador, tus pilotos o ingenieros, la FIA, la prensa, un rival o un aficionado. Cuanto m\xE1s tiempo juegas, m\xE1s a menudo pasa, y suele ser a la hora a la que sueles conectarte. Lo que decidas tiene consecuencias: dinero, fans, moral, entrenamientos, adelantar una mejora, informaci\xF3n\u2026 o nada. Si no puedes atenderla en ese momento, queda en el buz\xF3n (abajo a la derecha) hasta el final del d\xEDa.</p>
<p><b>Ramas de desarrollo.</b> Al llegar a los niveles 3, 6 y 9 de cada \xE1rea del coche eliges uno de dos caminos (potencia punta o par motor, alta carga o baja resistencia, cuidar neum\xE1ticos o chasis r\xEDgido\u2026). Elegir es gratis; cambiar un camino ya elegido cuesta ${a(8e5)}. As\xED dos coches con el mismo nivel se comportan distinto: uno vuela en las rectas, otro en las curvas, otro con lluvia, otro gasta menos neum\xE1ticos o se rompe menos. Puedes ver el car\xE1cter de tu coche en Mi escuder\xEDa \u2192 Coche.</p>
<p><b>Juntas de pilotos.</b> Dos veces por temporada (tras la primera jornada y a mitad de liga) se vota durante 48 horas un paquete de micro-cambios: sistema de puntuaci\xF3n, si la \xFAltima carrera de la liga vale doble o \xD71,5, puntos por vuelta r\xE1pida o en clasificaci\xF3n, parrilla invertida en la Carrera 2, premios por punto o sanciones a un piloto conflictivo. Cada piloto titular vota (su m\xE1nager le da una consigna, pero con la moral baja puede ir por libre) y la FIA tiene 20 votos. Lo aprobado se aplica desde la siguiente sesi\xF3n.</p>
<p><b>Lesiones.</b> Un accidente grave en la liga nacional puede lesionar al piloto y hacerle perder varias carreras. Eliges a su sustituto entre los agentes libres (pagando un contrato corto); si no eliges a tiempo, el equipo t\xE9cnico ficha al mejor que se pueda pagar. Al recuperarse vuelve a su asiento y el sustituto a la bolsa. Al acabar las ligas nacionales todos se recuperan.</p>
<p><b>Reputaci\xF3n</b> (de 0 a 100, empieza en 50). La de tu escuder\xEDa mejora a los patrocinadores, los fans y el precio de los ingenieros. La tuya como m\xE1nager decide cu\xE1nta paciencia te tiene la directiva (con mucha reputaci\xF3n aguanta un rating m\xE1s bajo antes de despedirte), lo f\xE1cil que es negociar con la IA y cu\xE1ntas ofertas te llegan para dirigir otras escuder\xEDas. Sube con buenos resultados, acuerdos limpios y decisiones valientes; baja con esc\xE1ndalos, despidos o echarte atr\xE1s.</p>`)}

${i("despidos","Despidos",`
<p>No se despide a los \xFAltimos por ser \xFAltimos. Se mide a cada piloto <b>contra su compa\xF1ero</b>, que lleva el mismo coche:</p>
<ul>
<li>Cuenta la distancia entre los dos en la clasificaci\xF3n y cu\xE1ntas veces se han ganado el uno al otro en carrera y en clasificaci\xF3n.</li>
<li><b>Despido directo:</b> los 2 pilotos de cada liga que peor rinden frente a su compa\xF1ero.</li>
<li><b>Zona de peligro:</b> los 2 siguientes. Caen si su compa\xF1ero acab\xF3 en el top 8 y les sac\xF3 5 puestos o m\xE1s, o si les sac\xF3 10 o m\xE1s. Si los dos van mal, se entiende que el coche era malo y se salvan.</li>
<li>Ejemplo: un 18\xBA cuyo compa\xF1ero es 4\xBA est\xE1 en peligro; un 16\xBA cuyo compa\xF1ero es 19\xBA, no.</li>
<li>Los clasificados al Mundial son inmunes.</li>
</ul>
<p>En la pesta\xF1a "Mundial y mercado" de cada liga ves en tiempo real qui\xE9n caer\xEDa si la temporada acabara hoy.</p>`)}

${i("economia","Econom\xEDa",`
<p>Empiezas con <b>${a(e.presupuestoInicial)}</b>. Solo puedes coger una escuder\xEDa hasta que termina la primera jornada de todas las ligas; despu\xE9s, la inscripci\xF3n se cierra hasta la pr\xF3xima temporada. El dinero sirve para mejorar el coche y las instalaciones, espiar y pedir Gal\xE1cticos.</p>
${p(["Entra dinero por","Cu\xE1nto"],[["Recompensa diaria",`${a(e.checkinBase+e.checkinPorRacha)} el primer d\xEDa, hasta ${a(e.checkinBase+7*e.checkinPorRacha)} con 7 d\xEDas seguidos (m\xE1s con marketing)`],["Puntos",`${a(e.premioPorPunto)} por cada punto de tus pilotos (el triple en el Mundial)`],["Patrocinador","Un pago por jornada, m\xE1s un bonus si cumples su objetivo"],["Pilotos en el Mundial",`${a(e.bonusClasificadoMundial)} por cada uno`],["Fin de temporada",`Seg\xFAn tu puesto en la liga: de ${a(e.premiosLiga[0])} (1\xBA) a ${a(e.premiosLiga[e.premiosLiga.length-1])} (10\xBA)`],["Clasificaci\xF3n global",`Seg\xFAn tu puesto entre las 50 escuder\xEDas: ${h.map((o,s)=>`${s+1}\xBA ${a(o)}`).join(", ")}, del 6\xBA al 10\xBA ${a(15e5)}, del 11\xBA al 20\xBA ${a(1e6)} y del 21\xBA al 30\xBA ${a(5e5)}`],["Vender un Gal\xE1ctico","El importe de la operaci\xF3n"],["Filiales",`${a(e.dividendoFilial)} al d\xEDa por cada una`]])}
${p(["Sale dinero por","Cu\xE1nto"],[["Salarios de los pilotos","Al terminar cada jornada de liga"],["Mejorar un \xE1rea del coche",`De ${a(u(0))} (nivel 1) a ${a(u(9))} (nivel 10). Urgente: \xD7${$} el precio y menos de la mitad de tiempo`],["Instalaciones",`${Object.values(t).length} tipos: 2 M\u20AC el primer nivel, 4 M\u20AC el segundo\u2026`],["Entrenar a un piloto",`${a(d.coste)} cada vez`],["Espionaje",`De ${a(e.costeInvestigacion.piloto)} a ${a(e.costeInvestigacion.estrategia)} por misi\xF3n`],["Pedir un Gal\xE1ctico","Lo que ofrezcas, solo si la operaci\xF3n se hace"],["Nombre / colores / filial",`${a(e.cambioNombre)} / ${a(e.cambioColor)} / ${a(e.compraFilial)} (solo fuera del periodo de carreras)`]])}
<p>El coche tiene cuatro \xE1reas (motor, aerodin\xE1mica, chasis y fiabilidad) con 10 niveles. Puedes tener ${f} mejoras en marcha a la vez; tardan horas y pueden fallar (si fallan recuperas la mitad). Cada circuito premia m\xE1s unas \xE1reas que otras.</p>
<p><b>Cierre t\xE9cnico:</b> desde que termina tu liga nacional hasta que acaba el Mundial no se pueden encargar mejoras del coche (las que ya estaban en marcha terminan con normalidad).</p>
<p><b>Parque cerrado:</b> desde que cierra la estrategia de los libres hasta que se publica la \xFAltima carrera de la jornada no se puede encargar ninguna mejora del coche. Si una mejora termina durante la jornada, la pieza espera en f\xE1brica y se monta al acabar.</p>
<p>Instalaciones (${a(j(0))} el primer nivel, hasta 5): ${Object.values(t).map(o=>`<b>${o.nombre}</b> (${o.desc.replace(/[.]$/,"").toLowerCase()})`).join("; ")}.</p>
<p>Al acabar la temporada recibes un resumen con tu posici\xF3n, puntos, victorias, podios, tus pilotos, el Mundial y el dinero.</p>
<p>Al empezar una temporada nueva cada \xE1rea del coche pierde 1 o 2 niveles y el presupuesto se queda en la mitad de lo ahorrado m\xE1s una asignaci\xF3n seg\xFAn tu puesto en la liga la temporada anterior: ${a(y(1))} si fuiste 1\xBA, bajando hasta ${a(c)} el 10\xBA. Nunca se empieza con menos de ${a(c)}. Las instalaciones no pierden nivel, pero necesitan una <b>limpieza</b> (${a(e.limpiezaPorNivel)} por nivel) antes de volver a usarse.</p>
<p><b>Temporadas con cambio de reglamento.</b> Algunas temporadas la liga cambia las normas t\xE9cnicas: el coche pierde entre el 75% y el 85% de su desarrollo (redondeando hacia arriba) y cada instalaci\xF3n hasta 2 niveles. Todas las escuder\xEDas reciben 2 M\u20AC de ayuda. Se anuncia en las noticias y te llega un aviso.</p>`)}

${i("cada-dia","Qu\xE9 hacer cada d\xEDa",`
<ol>
<li><b>Recoge la recompensa diaria.</b> Si fallas un d\xEDa, la racha vuelve a 1.</li>
<li><b>Responde la decisi\xF3n del d\xEDa</b> antes de medianoche. Si no, se aplica la opci\xF3n por defecto (normalmente la peor).</li>
<li><b>Prueba reglajes en el simulador</b> (${q(0)} pruebas al d\xEDa, m\xE1s si lo mejoras). Cada coche tiene un reglaje ideal secreto en cada circuito (ala, suspensi\xF3n, marchas, presi\xF3n de neum\xE1ticos, reparto de frenada y altura de suelo). El ingeniero califica cada ajuste de S\xFAper malo a Excelente; con el simulador mejorado (nivel 2) adem\xE1s te dice si subir o bajar.</li>
<li><b>Guarda la estrategia</b> de la pr\xF3xima jornada antes de que cierre: riesgo en qualy, ritmo y actitud en cada carrera y, en la Carrera 3, neum\xE1tico de salida y paradas.</li>
<li><b>Atiende a la prensa.</b> Tras las carreras (2 o 3 preguntas por jornada) y de vez en cuando entre jornadas te preguntan por accidentes, toques, aver\xEDas, victorias, rivales o la actualidad. Lo que respondes sale publicado y te hace ganar o perder fans; algunas respuestas cambian la moral de tus pilotos. Si no contestas en 24 h, pierdes fans.</li>
<li><b>Entrena a tus pilotos</b> (${a(d.coste)}, cada ${d.diasEspera} d\xEDas por piloto): puede subir un punto un atributo.</li>
<li><b>Ten el coche siempre en desarrollo.</b></li>
</ol>
<p>Todo lo que pides (mejoras, simulador, espionaje\u2026) lo procesa el servidor en unos segundos.</p>`)}

${i("club","Imagen, filiales y ofertas",`
<p>En <b>pretemporada</b> y <b>al acabar la temporada</b> (nunca con las carreras en marcha), desde Mi escuder\xEDa \u2192 Equipo puedes:</p>
<ul>
<li><b>Cambiar el nombre</b> (y el nombre corto) por ${a(e.cambioNombre)}, y <b>los colores</b> por ${a(e.cambioColor)}. Los nombres ofensivos no se aceptan.</li>
<li><b>Comprar una escuder\xEDa extranjera</b> sin m\xE1nager ni grupo por ${a(e.compraFilial)} (hasta ${e.maxFiliales}, una por pa\xEDs). Pasa a ser tu filial: la sigue llevando la IA, form\xE1is grupo (\u221225% en I+D cuando una mejora un \xE1rea) y te paga ${a(e.dividendoFilial)} al d\xEDa. Tambi\xE9n puedes cambiarle el nombre y los colores.</li>
</ul>
<p><b>Ofertas de otras escuder\xEDas.</b> Si haces una temporada excepcional (top 3 de escuder\xEDas de tu liga, o top 3 del Mundial en pilotos o escuder\xEDas), al acabar puede llamarte otra escuder\xEDa: un ${Math.round(e.probOfertaHermanas*100)}% de probabilidad de que sea una de un grupo con hermanas y un ${Math.round(e.probOfertaNormal*100)}% de que sea una normal. Tienes ${e.diasOfertaPlaza} d\xEDas para decidir. Si aceptas, tu escuder\xEDa actual pasa a la IA y te quedas con el presupuesto, el coche y los pilotos de la nueva.</p>`)}

${i("carrera","C\xF3mo se decide una carrera",`
<p>Cada vuelta de cada piloto se calcula con:</p>
<ul>
<li><b>El piloto:</b> ritmo, regularidad, agresividad, defensa, lluvia, experiencia, moral y forma.</li>
<li><b>El coche:</b> los niveles de motor, aero y chasis seg\xFAn lo que pida el circuito, y la fiabilidad para las aver\xEDas.</li>
<li><b>El reglaje</b> (6 ajustes): cuanto m\xE1s cerca del ideal, m\xE1s r\xE1pido (hasta un 0,8% por vuelta).</li>
<li><b>Carrera 3 (20 vueltas) y neum\xE1ticos:</b> es la \xFAnica con estrategia de neum\xE1ticos. El blando es el m\xE1s r\xE1pido pero dura poco; el duro, el m\xE1s lento pero aguanta. Cuando un neum\xE1tico pasa de su vida, pierde mucho tiempo por vuelta. Lo que dura cada compuesto depende mucho del circuito: hay trazados que se comen el blando y otros donde el duro dura menos de lo normal. Es obligatorio parar al menos una vez y usar al menos dos compuestos distintos. Parar en boxes cuesta unos segundos (menos con coche de seguridad) y la parada puede salir muy bien o mal; con el Taller y mec\xE1nicos mejorado, las malas son menos frecuentes. Tras los libres, el ingeniero te estima cu\xE1ntas vueltas aguanta cada compuesto: la estimaci\xF3n es m\xE1s precisa cuanto mejor sea tu reglaje, tu simulador y la experiencia de tus pilotos. Si no eliges estrategia, se aplica la propuesta del ingeniero.</li>
<li><b>Coche de seguridad y VSC:</b> tras un accidente o un coche parado en pista puede salir el coche de seguridad (el pelot\xF3n se agrupa) o el virtual (todos a ritmo lento). No se puede adelantar y parar en boxes cuesta menos.</li>
<li><b>Accidentes y da\xF1os:</b> un choque leve te hace perder el resto de esa sesi\xF3n; un toque puede da\xF1ar el aler\xF3n y hacerte m\xE1s lento el resto de la carrera. Si el accidente es grave y queda otra sesi\xF3n en la jornada, eliges: reparaci\xF3n urgente (${a(e.reparacionUrgente)}, llegas a la siguiente sesi\xF3n) o normal (${a(e.reparacionNormal)}, te la pierdes). Te avisamos al momento.</li>
<li><b>La estrategia:</b> riesgo en clasificaci\xF3n, y ritmo y actitud en carrera.</li>
<li><b>El azar:</b> errores, toques, aver\xEDas, tr\xE1fico y lluvia (que se anuncia antes como probabilidad).</li>
</ul>
<p>Los adelantamientos dependen de la diferencia de ritmo, de lo f\xE1cil que sea adelantar en ese circuito y del duelo entre la agresividad de uno y la defensa del otro.</p>`)}
`;
