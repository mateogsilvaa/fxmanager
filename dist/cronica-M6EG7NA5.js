import{a as y}from"./c/IBLVIUNU.js";import{b as $,d as u}from"./c/WD3DATWE.js";import{f as L,g as q}from"./c/72YMXJL5.js";import{c as v}from"./c/HSHR4D3Y.js";import"./c/BYPAWYPD.js";import"./c/KG6NJ7KS.js";import{a as S,b as E}from"./c/26WOZTAA.js";import{c as s,d as h,f as j,h as w,r as m}from"./c/5ZHPE3TI.js";import"./c/7335QGPC.js";import{a as g,i as c,j as d}from"./c/KXL2YMTU.js";var n=new URLSearchParams(location.search).get("ev")||"",A=n.split("_")[1];await S({liga:A});var f=document.getElementById("main"),e=await q();E(e);var i=e.evento(n);if(!i)throw f.innerHTML=m("Evento no encontrado."),new Error("no encontrado");var p=c.filter(a=>i.sesiones[a]).pop();if(e.estadoSesion(i.sesiones[p])!=="final")throw f.innerHTML=`<div class="tarjeta">${m(`La cr\xF3nica se publica al terminar la ${d[p].nombre} (${w(i.sesiones[p].revealAt)}).`,"")}</div>`,new Error("pendiente");var r={};await Promise.all(c.filter(a=>i.sesiones[a]).map(async a=>{let t=await L(`${n}_${a}`).catch(()=>null);t&&(r[a]=t)}));var P=e.sesionesLiga(i.liga),I=v(P.filter(a=>a.ev!==n&&a.t<i.sesiones.FP?.publishAt)),x=v(P.filter(a=>a.t<=i.sesiones[p].publishAt)),o=y({evento:{id:n,...i},sesiones:r,nombre:e.nombre,apellido:e.apellido,equipo:e.nombreEquipo,antes:I,despues:x});f.innerHTML=`
<article class="rejilla rejilla-lado">
  <div class="tarjeta cronica">
    <div class="etiqueta">${j(i.liga)} ${s(g[i.liga].nombre)} \xB7 Jornada ${i.ronda} \xB7 ${h(i.circuito?.pais)} ${s(i.circuito?.nombre)}</div>
    <h2 style="margin-top:10px">${s(o.titulo)}</h2>
    <p class="entradilla">${s(o.entradilla)}</p>
    <div class="cuerpo">${o.parrafos.map(a=>`<p>${s(a)}</p>`).join("")}</div>
    <div class="fila" style="margin-top:14px">${c.filter(a=>r[a]).map(a=>`<a class="btn btn-sec btn-peq" href="sesion.html?id=${s(n)}_${a}">${s(d[a].corto)}</a>`).join("")}</div>
  </div>
  <aside class="pila">
    ${o.mvp?`<div class="tarjeta tarjeta-acento"><div class="etiqueta">Piloto de la jornada</div><div style="margin-top:8px">${$(e,o.mvp.pid,{equipo:!0})}</div><div class="cuenta">${o.mvp.pts} pts</div></div>`:""}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Podios</h3></div>
      ${["Q1","R1","Q2","R2","R3"].filter(a=>r[a]).map(a=>`<div style="margin-bottom:10px"><div class="etiqueta">${s(d[a].nombre)}${r[a].lluvia?" ":""}</div>${r[a].filas.slice(0,3).map(t=>`<div class="fila" style="margin:4px 0">${u(t.pos)} ${$(e,t.pid)}</div>`).join("")}</div>`).join("")}
    </div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>General tras la ronda</h3></div>
      <ul class="lista">${x.clasPilotos.slice(0,10).map((a,t)=>{let b=I.pilotos[a.pid]?.posicion,l=b?b-(t+1):0;return`<li class="fila-entre"><span>${u(t+1)} ${s(e.nombre(a.pid))} ${l>0?`<span class="ok">\u25B2${l}</span>`:l<0?`<span class="mal">\u25BC${-l}</span>`:""}</span><b class="num">${a.pts}</b></li>`}).join("")}</ul>
    </div>
  </aside>
</article>`;
