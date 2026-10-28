import{a as r}from"./c/W4EI63WK.js";import"./c/KG6NJ7KS.js";import{a as t}from"./c/26WOZTAA.js";import"./c/5ZHPE3TI.js";import{d as n,o}from"./c/7335QGPC.js";import"./c/KXL2YMTU.js";var e=await t({activo:"descubre"}),l=document.getElementById("main"),c=e?"partidas.html":"entrar.html?modo=registro&volver=partidas.html",d=["piloto","ingeniero","manager","patrocinador","periodista","fia","aficionado"].map((s,i)=>r({tipo:s,semilla:`landing${i}`,color:["#e63946","#2a9d8f","#4361ee",null,null,null,"#f4a261"][i],tam:72})).join(""),a=(s,i)=>`<div class="landing-f"><h3>${s}</h3><p>${i}</p></div>`;l.innerHTML=`
<section class="landing-hero">
  <div class="etiqueta">FX Manager \xB7 Hyper Race X1</div>
  <h1>Tu campeonato de motor,<br>con tus amigos.</h1>
  <p>Monta una liga privada, elige escuder\xEDa y compite: t\xFA decides el coche, la estrategia, los fichajes y la pelea en los despachos. Las carreras se simulan solas y se publican a su hora, con directo. T\xFA solo tienes que entrar cada d\xEDa y tomar decisiones.</p>
  <div class="fila"><a class="btn" href="${c}">${e?"Crear o unirme a una liga":"Crear cuenta gratis"}</a><a class="btn btn-sec" href="index.html?demo=1">Probar la demo</a></div>
  <div class="landing-caras" aria-hidden="true">${d}</div>
</section>

<section class="landing-pasos">
  <div><b>1</b><h3>Crea tu liga</h3><p>Pon nombre y elige cu\xE1ntas ligas nacionales quer\xE9is (de una a cinco), si hay Mundial al final, cada cu\xE1ntos d\xEDas hay jornada y a qu\xE9 hora se corre.</p></div>
  <div><b>2</b><h3>Invita a tus amigos</h3><p>Comparte el enlace o el c\xF3digo. Cada uno elige una escuder\xEDa; las que nadie coge las lleva la IA, que tambi\xE9n compite (y negocia, y ficha\u2026).</p></div>
  <div><b>3</b><h3>A jugar</h3><p>Cada jornada tiene libres, dos clasificaciones y tres carreras. Entre jornada y jornada: mejoras, reglajes, simulador, prensa, llamadas, mercado\u2026</p></div>
</section>

<section class="landing-funciones">
  <div class="tarjeta-titulo"><h2>Qu\xE9 se hace en FX Manager</h2></div>
  <div class="landing-grid">
    ${a("Desarrollo del coche","Motor, aerodin\xE1mica, chasis y fiabilidad, con un \xE1rbol de ramas: dos coches con el mismo nivel pueden comportarse de forma muy distinta.")}
    ${a("Estrategia de carrera","Reglaje, ritmo, actitud y neum\xE1ticos. La lectura de los libres y el simulador te dicen qu\xE9 funciona en cada circuito.")}
    ${a("Pilotos e ingenieros","Entrena a tus pilotos, ficha ingenieros, cuida la moral\u2026 y prep\xE1rate para lesiones, retiradas y despidos.")}
    ${a("Mercado","Gal\xE1cticos que cambian de liga, pujas, agentes libres, trueques y negociaciones con otras escuder\xEDas (humanas o de la IA).")}
    ${a("Pol\xEDtica","Juntas de pilotos que votan el reglamento, sanciones, la FIA meti\xE9ndose en medio y rivales que llaman pidiendo tu voto.")}
    ${a("Historia","Temporadas que se encadenan, palmar\xE9s, r\xE9cords, rating de m\xE1nager y una prensa que no perdona.")}
  </div>
</section>

<section class="landing-final">
  <h2>\xBFTe han pasado un c\xF3digo?</h2>
  <p>Entra con tu cuenta (o cr\xE9ala en un minuto) y pega el c\xF3digo en \xABMis partidas\xBB.</p>
  <div class="fila"><a class="btn" href="${e?"partidas.html":"entrar.html"}">${e?"Ir a mis partidas":"Entrar"}</a>${e&&o()&&n===""?'<a class="btn btn-sec" href="index.html">Volver a mi liga</a>':""}</div>
</section>`;
