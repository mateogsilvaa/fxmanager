import{a as k,c as Z}from"./c/Q7ZD5DR2.js";import{a as _,b as G}from"./c/RIKA6AP4.js";import{n as W}from"./c/WDTX7UIM.js";import{c as U}from"./c/YDS3XFUC.js";import{j as q,l as V,n as z,r as Q,s as B,u as j}from"./c/QA2CC7VW.js";import{b as P}from"./c/KG6NJ7KS.js";import{a as F}from"./c/GOTG5RUR.js";import{a as r,b as O,c as i,d as x}from"./c/YUWPRQBV.js";import"./c/R7E3CXPW.js";import{A as T,j as E,k as A,l as H,r as w}from"./c/SPI3NESF.js";await F({});var oa=document.getElementById("main"),ia=[["Aurora Racing","#c1121f"],["Nimbus Motorsport","#1d3557"],["V\xE9rtice GP","#2a9d8f"],["Halc\xF3n Competici\xF3n","#e9c46a"],["Brisa Corse","#6a3fa0"],["Norte Engineering","#264653"],["\xC1mbar Racing","#f4a261"],["Delta Works","#8d99ae"],["Tempesta Team","#e76f51"],["Cobalto Racing","#457b9d"]],sa=["es","es","it","gb","de","fr","pt","au","nl","br"];function J(e){let o=P(`lab|${e}`),s=new Set,c={},t=[];return ia.forEach(([l,f],v)=>{let p=`eq${v}`,b=o.int(0,6);c[p]={id:p,nombre:l,corto:l.split(" ")[0],color:f,coche:{motor:I(b+o.int(-2,2)),aero:I(b+o.int(-2,2)),chasis:I(b+o.int(-2,2)),fiabilidad:I(b+o.int(-2,2))},reglaje:Math.round((.55+o.next()*.4)*100)/100};for(let $=0;$<2;$++){let n=o.pick(sa),{nombre:g,apellido:C}=U(o,n,s);t.push({id:`p${v}_${$}`,nombre:g,apellido:C,nac:n,numero:2+v*7+$*3,equipoId:p,attrs:W(o,{estrella:o.chance(.15)?1:0}),moral:o.int(40,85),forma:Math.round((o.next()-.5)*60)/100,estr:{riesgo:o.pick([1,2,2,3]),ritmo:o.pick(["conservador","equilibrado","equilibrado","ataque"]),actitud:o.pick(["defensiva","normal","normal","agresiva"])}})}}),{equipos:c,pilotos:t}}var I=e=>Math.max(0,Math.min(10,e)),D=Math.floor(Math.random()*1e9),u=J(D),R=null,m={piloto:e=>u.pilotos.find(o=>o.id===e)||null,equipo:e=>u.equipos[e]||null,nombre:e=>{let o=m.piloto(e);return o?`${o.nombre} ${o.apellido}`:"\u2014"},apellido:e=>m.piloto(e)?.apellido||"\u2014",nombreEquipo:e=>u.equipos[e]?.nombre||"\u2014"},la=k.filter(e=>_[e.id]);oa.innerHTML=`
<div class="cabecera-pagina"><div><div class="etiqueta">Laboratorio \xB7 parrilla inventada</div><h1>Simulador de sesiones</h1>
  <p class="sub">As\xED simula el juego unos libres, una clasificaci\xF3n y una carrera. Nada de lo que hagas aqu\xED afecta a la liga.</p></div></div>

<div class="rejilla rejilla-lado">
  <div class="pila">
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>Sesi\xF3n</h2></div>
      <div class="lab-controles">
        <label>Tipo<select id="l-tipo">
          <option value="FP">Entrenamientos libres</option><option value="Q1">Clasificaci\xF3n</option>
          <option value="R1">Carrera corta (10 vueltas)</option><option value="R3">Carrera larga (20 vueltas, con paradas)</option></select></label>
        <label>Circuito<select id="l-circuito">${la.map(e=>`<option value="${i(e.id)}" ${e.id==="jerez"?"selected":""}>${i(e.nombre)}</option>`).join("")}</select></label>
        <label class="lab-check"><input type="checkbox" id="l-lluvia"> Lluvia</label>
      </div>
      <p class="muted peq" id="l-parrilla-txt"></p>
      <div class="fila-botones"><button class="btn btn-sec" id="l-otra">Otra parrilla</button><button class="btn" id="l-simular">Simular</button></div>
    </section>
    <section id="l-directo"></section>
    <section id="l-resultado"></section>
  </div>
  <aside class="pila">
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>Tu equipo</h2></div>
      <p class="muted peq" style="margin-top:0">Cambia estos valores de <b id="l-mio-nombre"></b> y vuelve a simular para ver su efecto.</p>
      <div id="l-mio"></div>
    </section>
    <section class="tarjeta">
      <div class="tarjeta-titulo"><h2>C\xF3mo funciona</h2></div>
      <div class="guia-lab">
        <h4>Ritmo de cada piloto</h4>
        <p>Cada vuelta parte del tiempo de referencia del circuito y se corrige con el coche (motor, aero y chasis seg\xFAn lo que pida el trazado), el ritmo del piloto, su experiencia, la calidad del reglaje, la moral y la forma. Con lluvia todo va un 9% m\xE1s lento y cuenta la habilidad en mojado.</p>
        <h4>Libres</h4>
        <p>8 vueltas lanzadas. Un 8% de vueltas pillan tr\xE1fico y a veces hay errores que anulan la vuelta. Cuenta la mejor. No dan puntos.</p>
        <h4>Clasificaci\xF3n</h4>
        <p>4 intentos. El riesgo elegido (seguro, normal, al l\xEDmite) gana hasta un 0,35% por vuelta pero multiplica los errores; al l\xEDmite hay opciones de accidente. Da puntos al top 5 y la parrilla de la carrera.</p>
        <h4>Carrera</h4>
        <p>Vuelta a vuelta: salida (experiencia y agresividad), degradaci\xF3n de neum\xE1ticos (seg\xFAn circuito, ritmo y compuesto), errores, accidentes y aver\xEDas (fiabilidad). Cuando un coche es m\xE1s r\xE1pido que el de delante intenta adelantar: la probabilidad depende de la diferencia de ritmo, de lo f\xE1cil que sea adelantar en ese circuito y del duelo entre agresividad y defensa. Los adelantamientos pueden acabar en toque.</p>
      </div>
    </section>
  </aside>
</div>`;var y="eq0",h={salida:"auto",parada:10,tras:"duro"};function K(){let e=u.equipos[y],o=u.pilotos.filter(t=>t.equipoId===y);r("#l-mio-nombre").textContent=e.nombre;let s=o[0].estr,c=(t,l,f)=>`<select data-mio="${t}">${l.map(([v,p])=>`<option value="${v}" ${String(v)===String(f)?"selected":""}>${p}</option>`).join("")}</select>`;r("#l-mio").innerHTML=`
      ${Object.keys(T).map(t=>`<div class="setup-param"><span>${i(T[t].nombre)}</span><input type="range" min="0" max="10" data-coche="${t}" value="${e.coche[t]}" oninput="this.nextElementSibling.value=this.value"><output>${e.coche[t]}</output></div>`).join("")}
      <div class="setup-param"><span>Reglaje (0-100%)</span><input type="range" min="30" max="100" data-mio="reglaje" value="${Math.round(e.reglaje*100)}" oninput="this.nextElementSibling.value=this.value"><output>${Math.round(e.reglaje*100)}</output></div>
      <div class="lab-controles" style="margin-top:10px">
        <label>Riesgo en qualy${c("riesgo",[[1,"Seguro"],[2,"Normal"],[3,"Al l\xEDmite"]],s.riesgo)}</label>
        <label>Ritmo de carrera${c("ritmo",[["conservador","Suave"],["equilibrado","Normal"],["ataque","Ataque"]],s.ritmo)}</label>
        <label>Actitud${c("actitud",[["defensiva","Defensiva"],["normal","Normal"],["agresiva","Agresiva"]],s.actitud)}</label>
      </div>
      <div class="lab-controles" style="margin-top:10px">
        <label>Carrera 20 v \xB7 salida${c("salida",[["auto","Lo que diga el ingeniero"],...Object.entries(q).map(([t,l])=>[t,l.nombre])],h.salida)}</label>
        <label>Parada en la vuelta<input type="number" min="1" max="19" data-mio="parada" value="${h.parada}"><small class="muted">obligatorio parar y cambiar de compuesto</small></label>
        <label>Neum\xE1tico tras parar${c("tras",Object.entries(q).map(([t,l])=>[t,l.nombre]),h.tras)}</label>
      </div>
      <p class="muted peq">Pilotos: ${o.map(t=>`${x(t.nac,{ancho:14})} ${i(t.apellido)} (ritmo ${t.attrs.ritmo})`).join(" \xB7 ")}</p>`,O("[data-coche]").forEach(t=>t.addEventListener("input",()=>{e.coche[t.dataset.coche]=+t.value})),O("[data-mio]").forEach(t=>t.addEventListener("change",()=>{t.dataset.mio==="reglaje"?e.reglaje=+t.value/100:t.dataset.mio==="salida"?h.salida=t.value:t.dataset.mio==="parada"?h.parada=+t.value:t.dataset.mio==="tras"?h.tras=t.value:o.forEach(l=>{l.estr[t.dataset.mio]=t.dataset.mio==="riesgo"?+t.value:t.value})})),r('[data-mio="reglaje"]').addEventListener("input",t=>{e.reglaje=+t.target.value/100})}function N(){let e=r("#l-tipo").value;r("#l-parrilla-txt").textContent=A(e)?R?"La carrera sale con la parrilla de tu \xFAltima clasificaci\xF3n.":"No has simulado una clasificaci\xF3n: la parrilla ser\xE1 por sorteo.":""}K();N();r("#l-tipo").addEventListener("change",N);r("#l-otra").addEventListener("click",()=>{D=Math.floor(Math.random()*1e9),u=J(D),R=null,K(),N(),r("#l-directo").innerHTML="",r("#l-resultado").innerHTML=""});r("#l-simular").addEventListener("click",na);function ra(e,o){let s=u.equipos[e.equipoId];return{id:e.id,equipoId:e.equipoId,attrs:e.attrs,moral:e.moral,forma:e.forma,coche:s.coche,setupQ:s.reglaje,estr:e.estr,riesgoFiab:1}}function na(){let e=r("#l-tipo").value,o=Z(k.find(n=>n.id===r("#l-circuito").value)),s=r("#l-lluvia").checked,c=P(`lab|sim|${Math.random()}`),t=V(`lab${Math.random()}`,"lab",o),l=E[e].vueltas,f=u.pilotos.map(n=>{let g=ra(n,o);if(E[e].estrategia){let C=n.equipoId===y&&h.salida!=="auto",S=Object.fromEntries(Object.entries(t).map(([d,M])=>[d,Math.max(2,M+Math.round((Math.random()-.5)*4))])),a=z(S,l,o,n.estr.ritmo);g.estr={...n.estr,...C?{neumatico:h.salida,paradas:[{vuelta:Math.max(1,h.parada),neumatico:h.tras}]}:{neumatico:a.neumatico,paradas:a.paradas}}}return g}),v=null;A(e)&&(v=R||P(`lab|parrilla|${Math.random()}`).shuffle(u.pilotos.map(n=>n.id)));let p=B({tipo:e,circuito:o,pilotos:f,parrilla:v,lluvia:s,rng:c,vidas:t});p.vidas=t,H(e)&&(R=p.filas.map(n=>n.pid),N());let b=Date.now(),$={publishAt:b,revealAt:b+w(e)};r("#l-resultado").innerHTML="",G(r("#l-directo"),{r:p,ses:$,ev:{id:"lab",circuito:o},d:m,miEq:y,repeticion:!0,alFinal:()=>da(p,o,s,f)}),r("#l-directo").scrollIntoView({behavior:"smooth",block:"start"})}function da(e,o,s,c){let t=e.tipo,l=A(t),f=Object.fromEntries(c.map(a=>[a.id,a])),v=e.filas.map(a=>`<tr class="${a.eq===y?"yo":""}">
        <td class="cen mono">${a.pos}</td>
        <td>${x(m.piloto(a.pid)?.nac,{ancho:14})} ${i(m.nombre(a.pid))}<div class="muted peq"><span class="lb-eq"><i style="background:${i(u.equipos[a.eq].color)}"></i>${i(u.equipos[a.eq].nombre)}</span></div></td>
        <td class="der mono">${l?a.estado==="DNF"?`<span class="mal">${i(a.motivo||"Abandono")}</span>`:a.pos===1?j(a.tiempo):j(a.gap,!0):a.mejor!=null?j(a.mejor):'<span class="mal">Sin tiempo</span>'}</td>
        ${l?`<td class="cen mono">${a.parrilla??""}</td><td class="cen mono">${a.adel||0}</td><td class="mono peq">${(a.neumaticos||[]).map(d=>q[d].corto).join(" \u203A ")}</td>`:`<td class="cen mono">${a.errores||0}</td>`}
        <td class="der mono">${a.pts||""}</td></tr>`).join(""),p=o.tiempoBase*(s?1.09:1),b=o.motor+o.aero+o.chasis,$=c.map(a=>{let d=a.attrs,M=a.coche,L=ta=>ta*p,X=L(-((o.motor*M.motor+o.aero*M.aero+o.chasis*M.chasis)/b/10)*.01),Y=L((80-d.ritmo)*55e-5+(s?(75-(d.lluvia??70))*4e-4:0)-((d.experiencia??50)-50)*5e-5),aa=L((1-a.setupQ)*.008*(s?.5:1)),ea=L(-((a.moral-60)/40)*.0015-a.forma*.001);return{p:a,total:Q(a,o,s),coche:X,piloto:Y,reglaje:aa,animo:ea}}).sort((a,d)=>a.total-d.total),n=$[0].total,g=a=>`<span class="lab-delta ${a<=0?"ok":"mal"}">${a<=0?"\u2212":"+"}${(Math.abs(a)/1e3).toFixed(3)}</span>`,C=$.map((a,d)=>`<tr class="${a.p.equipoId===y?"yo":""}">
        <td class="cen mono">${d+1}</td><td>${i(m.apellido(a.p.id))} <span class="muted peq">${i(u.equipos[a.p.equipoId].corto)}</span></td>
        <td class="der mono">${j(Math.round(a.total))}</td><td class="der mono muted">${d?"+"+((a.total-n)/1e3).toFixed(3):""}</td>
        <td class="der">${g(a.coche)}</td><td class="der">${g(a.piloto)}</td><td class="der">${g(a.reglaje)}</td><td class="der">${g(a.animo)}</td>
        ${l?`<td class="peq muted">${i(a.p.estr.ritmo)} \xB7 ${i(a.p.estr.actitud)}</td>`:`<td class="peq muted">riesgo ${a.p.estr.riesgo}</td>`}
      </tr>`).join(""),S=e.eventos.filter(a=>["abandono","toque","accidente","error","sc","vsc","parada"].includes(a.tipo)).slice(0,30);r("#l-resultado").innerHTML=`
    <div class="tarjeta portada-seccion">
      <div class="tarjeta-titulo"><h2>Resultado \xB7 ${i(E[t].nombre)}</h2><span>${i(o.nombre)}${s?" \xB7 lluvia":""}</span></div>
      ${E[t].estrategia&&!s?`<p class="muted peq" style="margin-top:0">Vida real de los neum\xE1ticos hoy: ${Object.entries(e.vidas).map(([a,d])=>`${q[a].nombre.toLowerCase()} ${d} vueltas`).join(" \xB7 ")}. ${e.eventos.some(a=>a.tipo==="sc")?"Hubo coche de seguridad.":e.eventos.some(a=>a.tipo==="vsc")?"Hubo VSC.":""}</p>`:""}
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th class="cen">Pos</th><th>Piloto</th><th class="der">${l?"Tiempo":"Mejor vuelta"}</th>${l?'<th class="cen">Salida</th><th class="cen">Adel.</th><th>Neum.</th>':'<th class="cen">Errores</th>'}<th class="der">Pts</th></tr></thead><tbody>${v}</tbody></table></div>
    </div>
    <div class="tarjeta portada-seccion">
      <div class="tarjeta-titulo"><h2>Por qu\xE9</h2><span>ritmo te\xF3rico por vuelta, sin azar</span></div>
      <p class="muted peq" style="margin-top:0">Lo que aporta cada factor al tiempo por vuelta respecto al de referencia (${j(Math.round(p))}). Verde, m\xE1s r\xE1pido; rojo, m\xE1s lento. Luego el azar (errores, tr\xE1fico, salidas, aver\xEDas) hace el resto.</p>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th class="cen">#</th><th>Piloto</th><th class="der">Ritmo</th><th class="der">Dif.</th><th class="der">Coche</th><th class="der">Piloto</th><th class="der">Reglaje</th><th class="der">Moral y forma</th><th>Estrategia</th></tr></thead><tbody>${C}</tbody></table></div>
    </div>
    ${S.length?`<div class="tarjeta portada-seccion"><div class="tarjeta-titulo"><h2>Incidentes</h2></div>
      <ul class="lista">${S.map(a=>`<li>V${a.v} \xB7 ${a.tipo==="sc"?"<b>Coche de seguridad</b>":a.tipo==="vsc"?"<b>Coche de seguridad virtual</b>":a.tipo==="parada"?`Parada de ${i(m.apellido(a.pid))}: ${i(q[a.neumatico].nombre.toLowerCase())}`:a.tipo==="abandono"?`Abandono de ${i(m.apellido(a.pid))} (${i((a.motivo||"").toLowerCase())}${a.grave?", da\xF1os graves":""})`:a.tipo==="toque"?`Toque ${a.pid2?`entre ${i(m.apellido(a.pid))} y ${i(m.apellido(a.pid2))}`:`de ${i(m.apellido(a.pid))} en la salida`}`:a.tipo==="accidente"?`Accidente de ${i(m.apellido(a.pid))}${a.grave?" (da\xF1os graves)":""}`:`Error de ${i(m.apellido(a.pid))} (${(a.ms/1e3).toFixed(1)} s)`}</li>`).join("")}</ul></div>`:""}`}
