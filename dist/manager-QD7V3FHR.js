import{g as E}from"./c/YKS4L6W4.js";import{c as g,d as y}from"./c/4XYTXYRR.js";import{a as v,c as q,d as P,g as T}from"./c/4VC5MTQO.js";import"./c/C2OQADPK.js";import"./c/QA2CC7VW.js";import"./c/KG6NJ7KS.js";import{a as j,b as M}from"./c/GOTG5RUR.js";import{c,f as p,r as u,u as m}from"./c/YUWPRQBV.js";import{l as f}from"./c/R7E3CXPW.js";import{a as b}from"./c/SPI3NESF.js";var h=new URLSearchParams(location.search).get("id");await j();var I=document.getElementById("main"),e=await T();M(e);var d=h?await f().get(`managers/${h}`).catch(()=>null):null,R=Object.entries(e.cat.equipos).find(([,a])=>a.ownerId===h);if(!d&&!R)throw I.innerHTML=u("M\xE1nager no encontrado."),new Error("no encontrado");var[n,l]=R||[null,null],S=l?.ownerNombre||d?.nombre||"M\xE1nager",s=n?e.ratingsTemporada()[n]:null,r=(d?.historial||[]).filter(a=>a.temporada!==e.temporada),L=s?.rating!=null?[...r,{temporada:e.temporada,rating:s.rating}]:r,C=q(L),A=r.filter(a=>a.pos===1).length,D=r.filter(a=>a.campeonMundial).length,w=a=>r.reduce((o,t)=>o+(t[a]||0),0)+(s?.[a]||0),$=L.reduce((a,o)=>(o.rating??-1)>(a?.rating??-1)?o:a,null),N={pos:"Posici\xF3n en su liga",pts:"Puntos respecto al l\xEDder",mundial:"Pilotos en el Mundial",exito:"T\xEDtulos, victorias y podios",fans:"Fans respecto a su liga"};I.innerHTML=`
<section class="hero">
  <div class="etiqueta">M\xE1nager${l?` \xB7 ${p(l.liga,{ancho:16})} ${c(b[l.liga]?.nombre)}`:""}</div>
  <h1>${c(S)}</h1>
  <div class="fila">${n?g(e,n):'<span class="muted">Sin escuder\xEDa ahora mismo</span>'}${r.length?`<span class="muted">\xB7 ${r.length+(n?1:0)} temporadas</span>`:""}</div>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Rating \xB7 temporada ${e.temporada}</h3><span>${P(s?.rating)}</span></div>
      ${s?.rating!=null?`<div class="rating-grande"><b>${s.rating}</b><span>/100</span></div>${m(s.rating)}
        <div style="margin-top:16px">${Object.keys(v).map(a=>`<div style="margin:8px 0"><div class="fila-entre peq"><span>${N[a]} <span class="tenue">\xB7 ${Math.round(v[a]*100)}%</span></span><b>${Math.round((s.partes?.[a]||0)*100)}</b></div>${m((s.partes?.[a]||0)*100)}</div>`).join("")}</div>`:`<p class="muted">${n?"El rating aparece en cuanto su escuder\xEDa sume los primeros puntos.":"No dirige ninguna escuder\xEDa esta temporada."}</p>`}
    </div>
    ${s?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Esta temporada</h3></div><div class="datos">
      ${i(s.pos?`${s.pos}\xBA`:"\u2014","Posici\xF3n")}${i(s.pts??0,"Puntos")}${i(s.victorias,"Victorias")}${i(s.podios,"Podios")}${i(s.mundial,"Pilotos al Mundial")}${i(s.fans??0,"Fans")}
    </div></div>`:""}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Temporada a temporada</h3></div>${O()}</div>
  </div>
  <aside class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Carrera</h3></div><div class="datos">
      ${d?.reputacion!=null?i(d.reputacion,`Reputaci\xF3n \xB7 ${E(d.reputacion).toLowerCase()}`):""}${i(C??"\u2014","Rating de carrera")}${i($?.rating??"\u2014",`Mejor rating${$?` (T${$.temporada})`:""}`)}
      ${i(A,"T\xEDtulos de liga")}${i(D,"Mundiales")}${i(w("victorias"),"Victorias")}${i(w("podios"),"Podios")}
    </div>
    <p class="muted peq" style="margin:12px 0 0">El rating de carrera es la media de todas sus temporadas, con m\xE1s peso para las recientes.</p></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>C\xF3mo se calcula</h3></div>
      <p class="muted peq">De 0 a 100. Mide lo bien que ha dirigido su escuder\xEDa: posici\xF3n final (40%), puntos respecto al l\xEDder (25%), pilotos clasificados al Mundial (15%), t\xEDtulos, victorias y podios (10%) y fans respecto a su liga (10%).</p></div>
  </aside>
</div>`;function i(a,o){return`<div class="dato"><b>${a}</b><span>${o}</span></div>`}function O(){let a=[...r.map(t=>({...t,cerrada:!0}))];if(n&&s&&a.push({temporada:e.temporada,equipoId:n,liga:l.liga,pos:s.pos,pts:s.pts,victorias:s.victorias,podios:s.podios,mundial:s.mundial,rating:s.rating,cerrada:!1}),!a.length)return u("Todav\xEDa sin temporadas.");let o=100;return`<div class="rating-evolucion">${a.map(t=>`<div class="re-col" title="T${t.temporada}: ${t.rating??"\u2014"}"><span class="re-v">${t.rating??"\u2014"}</span><div class="re-barra"><i style="height:${(t.rating||0)/o*100}%"></i></div><span class="re-t">T${t.temporada}</span></div>`).join("")}</div>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Temp.</th><th>Escuder\xEDa</th><th class="cen">Pos</th><th class="cen ancho">V</th><th class="cen ancho">Pod</th><th class="cen ancho" title="Pilotos en el Mundial">Mund.</th><th class="der">Pts</th><th class="der">Rating</th></tr></thead><tbody>
    ${a.slice().reverse().map(t=>`<tr><td>T${t.temporada}${t.cerrada?"":' <span class="insignia">En curso</span>'}</td>
      <td><span class="con-bandera">${p(t.liga,{ancho:16})}${e.equipo(t.equipoId)?g(e,t.equipoId):`<span class="txt">${c(t.equipo||"\u2014")}</span>`}</span></td>
      <td class="cen">${y(t.pos)}</td><td class="cen num ancho">${t.victorias||0}</td><td class="cen num ancho">${t.podios||0}</td><td class="cen num ancho">${t.mundial||0}</td>
      <td class="pts">${t.pts??0}</td><td class="der"><b>${t.rating??"\u2014"}</b></td></tr>`).join("")}
    </tbody></table></div>`}
