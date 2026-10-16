import{a as d,b as A,i as T,n as O}from"./c/CXTVGE7T.js";import{g as k}from"./c/YKS4L6W4.js";import"./c/YDS3XFUC.js";import{b as y,c as I}from"./c/OZ4IW754.js";import{a as M,c as x,d as S,l as w}from"./c/4XYTXYRR.js";import{g as R}from"./c/4VC5MTQO.js";import"./c/C2OQADPK.js";import"./c/QA2CC7VW.js";import"./c/KG6NJ7KS.js";import{a as E,b as L}from"./c/GOTG5RUR.js";import{c as i,d as m,f as u,r as $}from"./c/YUWPRQBV.js";import{l as p,m as P}from"./c/R7E3CXPW.js";import{a as j,h as q}from"./c/SPI3NESF.js";var n=new URLSearchParams(location.search).get("id");await E();var V=document.getElementById("main"),o=await R();L(o);var t=o.equipo(n);if(!t)throw V.innerHTML=$("Escuder\xEDa no encontrada."),new Error("no encontrado");var[D,G]=await Promise.all([p().get(`equipos/${n}`).catch(()=>null),p().get(A).then(a=>a?.lista||null).catch(()=>null)]),v=G?T(G,n).sort((a,s)=>Object.keys(d).indexOf(a.cat)-Object.keys(d).indexOf(s.cat)):[],r=t.liga,e=o.tabla(r).equipos[n],H=o.clasificacionEquipos(r),N=H.find(a=>a.eq===n)?.posicion,z=Object.entries(o.cat.pilotos).filter(([,a])=>a.equipoId===n).map(([a,s])=>({id:a,...s})).sort((a,s)=>a.rol==="P1"?-1:1),F=t.grupo?Object.entries(o.cat.equipos).filter(([a,s])=>s.grupo===t.grupo&&a!==n):[],b=o.eventosLiga(r),h=o.tabla("INT").equipos[n],W=P()?.perfil?.equipoId===n,_=o.sesionesLiga(r),C=_.flatMap(a=>a.filas.filter(s=>s.eq===n).map(s=>({...s,s:a}))),g=C.filter(a=>a.s.tipo.startsWith("R")&&a.estado==="FIN").sort((a,s)=>a.pos-s.pos)[0],f=C.filter(a=>a.s.tipo.startsWith("R")&&a.estado==="FIN"&&a.parrilla).map(a=>({...a,g:a.parrilla-a.pos})).sort((a,s)=>s.g-a.g)[0];V.innerHTML=`
<section class="hero">
  <div class="etiqueta">${u(r,{ancho:18})} ${i(j[r]?.nombre)}${t.grupo?` \xB7 Grupo ${i(t.grupo)}`:""}</div>
  <h1 style="margin:6px 0">${i(t.nombre)}</h1>
  <p>M\xE1nager: <b style="color:var(--texto)">${M(t,{enlace:!0})}</b>${W?' (t\xFA) \xB7 <a href="escuderia.html">Ir al panel</a>':!t.ownerNombre&&t.inscribible!==!1?' \xB7 <a href="escuderia.html">\xBFLa quieres?</a>':""} \xB7 ${t.fans||0} fans${t.reputacion!=null?` \xB7 reputaci\xF3n ${t.reputacion} (${k(t.reputacion).toLowerCase()})`:""}</p>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="datos">
      ${l(N?`${N}\xBA`:"\u2014","Posici\xF3n")}${l(e?.pts??0,"Puntos")}${l(e?.victorias??0,"Victorias")}${l(e?.dobletes??0,"Dobletes")}
      ${l(e?.podios??0,"Podios")}${l(e?.poles??0,"Poles")}${l(e?.dnf??0,"Abandonos")}${l(e?.grandSlams||0,"Grand Slams")}${l(e?.quietSlams||0,"Quiet Slams")}
    </div></div>
    <div class="rejilla rejilla-2">${z.map(a=>{let s=o.tabla(r).pilotos[a.id],c=s?.victorias??0;return`<a class="tarjeta" href="piloto.html?id=${i(a.id)}"><div class="piloto-tarjeta">
          ${y(a.id,t.color,48)}
          <div class="nom"><span>${i(a.nombre)}</span><b>${i(a.apellido)}</b></div>
          ${a.rookie?'<span class="insignia rookie">Rookie</span>':"<span></span>"}
        </div>
        <div class="fila muted" style="font-size:.85rem;margin-top:10px"><span class="con-bandera">${m(a.nac,{ancho:18})}<span class="txt">${i(q[a.nac]||"")}</span></span><span>\xB7 ${s?.pts??0} pts \xB7 ${c} victoria${c===1?"":"s"}</span></div></a>`}).join("")}</div>
    ${v.length?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Ingenieros</h3><span>${v.length}</span></div>${v.map(a=>`<div class="ing-fila">${I(a.id,t.color,34)}<div class="ing-nom"><b>${i(a.nombre)} ${i(a.apellido)}</b><div class="muted peq">${i(d[a.cat].nombre)} \xB7 <span class="estrellas">${O(a.estrellas)}</span></div></div></div>`).join("")}</div>`:""}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Puntos por jornada</h3></div>${B()}</div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Palmar\xE9s e historia</h3></div>${Q()}</div>
  </div>
  <aside class="pila">
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>R\xE9cords del equipo</h3></div><ul class="lista">
      <li class="fila-entre"><span class="muted">Mejor resultado</span><b>${g?`${g.pos}\xBA \xB7 ${i(o.apellido(g.pid))}`:"\u2014"}</b></li>
      <li class="fila-entre"><span class="muted">Mejor jornada</span><b>${e?.mejorFinde??0} pts</b></li>
      <li class="fila-entre"><span class="muted">Mayor remontada</span><b>${f?.g>0?`+${f.g} \xB7 ${i(o.apellido(f.pid))}`:"\u2014"}</b></li>
      <li class="fila-entre"><span class="muted">Carreras con los dos en puntos</span><b>${e?.ambosEnPuntos??0}</b></li>
      <li class="fila-entre"><span class="muted">Adelantamientos</span><b>${e?.adel??0}</b></li>
      <li class="fila-entre"><span class="muted">Vueltas lideradas</span><b>${e?.lideradas??0}</b></li>
      <li class="fila-entre"><span class="muted">Media de llegada</span><b>${e?.mediaPos!=null?w(e.mediaPos):"\u2014"}</b></li>
      <li class="fila-entre"><span class="muted">Errores de pilotaje</span><b>${e?.errores??0}</b></li>
    </ul></div>
    ${h?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Mundial de Escuder\xEDas</h3></div><div class="datos">${l(h.pts,"Puntos")}${l(h.victorias,"Victorias")}</div></div>`:""}
    ${F.length?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Grupo ${i(t.grupo)}</h3></div><p class="muted" style="font-size:.88rem">Franquicia con equipos en varios pa\xEDses.</p><ul class="lista">${F.map(([a,s])=>`<li><span class="con-bandera">${u(s.liga,{ancho:18})}${x(o,a)}</span></li>`).join("")}</ul></div>`:""}
  </aside>
</div>`;function l(a,s){return`<div class="dato"><b>${a}</b><span>${s}</span></div>`}function B(){if(!b.length)return $("Sin calendario.");let a=Math.max(1,...b.map(s=>e?.ptsEvento?.[s.id]||0));return`<div style="display:grid;gap:8px">${b.map(s=>{let c=e?.ptsEvento?.[s.id];return`<div class="pts-jornada"><span class="con-bandera" title="${i(s.circuito?.nombre||"")}">${m(s.circuito?.pais,{ancho:18})}<span class="txt"><b>R${s.ronda}</b> <span class="solo-ancho">${i(s.circuito?.nombre||"")}</span></span></span><div class="barra" style="height:14px"><div class="barra-relleno" style="width:${(c||0)/a*100}%;background:${i(t.color)}"></div></div><b class="num" style="text-align:right">${c??"\xB7"}</b></div>`}).join("")}</div>`}function Q(){let a=D?.historia||[];return a.length?`<table class="tabla"><thead><tr><th>Temporada</th><th class="cen">Pos</th><th class="cen">V</th><th class="der">Pts</th></tr></thead><tbody>${a.slice().reverse().map(s=>`<tr><td>T${s.temporada}</td><td class="cen">${S(s.pos)}</td><td class="cen">${s.victorias||0}</td><td class="pts">${s.pts}</td></tr>`).join("")}</tbody></table>`:'<p class="muted">Primera temporada en Hyper Race X1.</p>'}
