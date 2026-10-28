import"./c/4XYTXYRR.js";import{g as j,j as k}from"./c/AUNHQKVZ.js";import"./c/C2OQADPK.js";import"./c/QA2CC7VW.js";import"./c/KG6NJ7KS.js";import{a as E,b as L}from"./c/GOTG5RUR.js";import{a as s,b as q,c as i,f as p,l as y,n as m,r as u}from"./c/YUWPRQBV.js";import{f as l,l as c}from"./c/R7E3CXPW.js";import{$ as g,a as $,c as f}from"./c/SPI3NESF.js";var t=await E({activo:"paddock"}),I=document.getElementById("main"),[d,S]=await Promise.all([j(),k(60)]);L(d);var n=t?.perfil?.equipoId,D=d.rankingManagers(),h=g(l()),v=S.some(a=>a.uid===t?.uid&&a.dia===h),b="TODAS";I.innerHTML=`
<div class="cabecera-pagina"><div><div class="etiqueta">M\xE1nagers</div><h1>Paddock</h1><p class="sub">Lo que dicen los m\xE1nagers y qui\xE9n lo est\xE1 haciendo mejor.</p></div></div>
<div class="rejilla rejilla-lado">
  <div class="pila">
    ${n?`<form class="tarjeta" id="f-decl">
      <div class="tarjeta-titulo"><h2>Declaraci\xF3n a la prensa</h2><span class="muted peq" id="cont">0/240</span></div>
      <textarea name="texto" rows="3" maxlength="240" placeholder="${v?"Ya has hablado hoy. Vuelve ma\xF1ana.":"Una declaraci\xF3n al d\xEDa. Pica a tus rivales, defiende a tus pilotos\u2026"}" ${v?"disabled":""}></textarea>
      <div class="fila-botones"><button class="btn btn-peq" ${v?"disabled":""}>Publicar</button></div></form>`:""}
    <div class="tarjeta">
      <div class="barra-opciones"><span class="etiqueta">Declaraciones</span><select id="filtro"><option value="TODAS">Todas las ligas</option>${f.map(a=>`<option value="${a}">${i($[a].nombre)}</option>`).join("")}</select></div>
      <div id="lista"></div>
    </div>
  </div>
  <aside class="tarjeta">
    <div class="tarjeta-titulo"><h2>Ranking de m\xE1nagers</h2></div>
    <p class="muted peq">Rating de 0 a 100 de la temporada. <a href="estadisticas.html">Ranking completo en Estad\xEDsticas</a>.</p>
    ${D.length?D.map((a,e)=>`<div class="ranking-fila"><span class="n">${String(e+1).padStart(2,"0")}</span><span><a href="manager.html?id=${i(a.uid)}">${a.eq===n?"<b>":""}${i(a.nombre)}${a.eq===n?"</b>":""}</a> <span class="muted peq">${p(a.liga,{ancho:12})} ${i(d.nombreEquipo(a.eq))}${a.pos?` \xB7 ${a.pos}\xBA`:""}</span></span><span class="v">${a.rating??"\u2014"}</span><div class="barra"><div class="barra-relleno" style="width:${a.rating||0}%"></div></div></div>`).join(""):u("Todav\xEDa no hay m\xE1nagers con escuder\xEDa.")}
  </aside>
</div>`;function T(){let a=S.filter(e=>b==="TODAS"||e.liga===b);s("#lista").innerHTML=a.length?a.map(e=>`<div class="declaracion">
      <div class="fila-entre"><span class="meta">${p(e.liga,{ancho:14})} <b style="color:var(--texto)">${i(e.nombre)}</b> \xB7 ${i(d.nombreEquipo(e.equipoId))}</span><span class="meta">${y(e.fecha)}${e.uid===t?.uid?` \xB7 <a href="#" data-borrar="${i(e.id)}">borrar</a>`:""}</span></div>
      <p>${i(e.texto)}</p></div>`).join(""):u("Nadie ha dicho nada todav\xEDa."),q("[data-borrar]").forEach(e=>e.addEventListener("click",async r=>{r.preventDefault(),await c().del(`paddock/${e.dataset.borrar}`),location.reload()}))}s("#filtro").addEventListener("change",a=>{b=a.target.value,T()});T();var o=s("#f-decl");o&&(o.texto.addEventListener("input",()=>{s("#cont").textContent=`${o.texto.value.length}/240`}),o.addEventListener("submit",async a=>{a.preventDefault();let e=o.texto.value.trim();if(!e)return;let r=d.equipo(n);try{await c().set(`paddock/${h}_${t.uid}`,{uid:t.uid,nombre:t.perfil.nombre,equipoId:n,liga:r?.liga||null,texto:e,fecha:l(),dia:h}),m("Declaraci\xF3n publicada"),setTimeout(()=>location.reload(),600)}catch(A){console.error(A),m("No se pudo publicar (\xBFya hablaste hoy?)","error")}}));
