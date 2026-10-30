import{b as x}from"./c/W4EI63WK.js";import{c as I,d as S,l as q}from"./c/WD3DATWE.js";import{g as Q,k as B}from"./c/72YMXJL5.js";import{c as V,g as A}from"./c/HSHR4D3Y.js";import"./c/BYPAWYPD.js";import"./c/KG6NJ7KS.js";import{a as z,b as D}from"./c/26WOZTAA.js";import{c as r,d as g,f as P,r as y,u as N}from"./c/5ZHPE3TI.js";import{l as j,m as C}from"./c/7335QGPC.js";import{a as b,h as E,j as L}from"./c/KXL2YMTU.js";var e=new URLSearchParams(location.search).get("id");await z();var G=document.getElementById("main"),o=await Q();D(o);var J=o.piloto(e),R=await j().get(`pilotos/${e}`).catch(()=>null);if(!J&&!R)throw G.innerHTML=y("Piloto no encontrado."),new Error("no encontrado");var l=J||R,n=l.liga,w=o.equipo(l.equipoId),F=C()?.perfil?.equipoId,Z=F&&l.equipoId===F,d=Z?await j().get(`pilotos_priv/${e}`).catch(()=>null):null,i=n?o.tabla(n).pilotos[e]:null,K=n?o.clasificacionPilotos(n):[],H=K.find(s=>s.pid===e)?.posicion,m=n?o.companeros(n)[e]:null,M=m?o.tabla(n).pilotos[m]:null,v=o.tabla("INT").pilotos[e],T=o.clasificadosMundial(),Y=T.clasificados?.find(s=>s.pid===e),u=null;if(n&&n!=="INT"&&i){let s=new Set(T.clasificados?.map(a=>a.pid)||[]);u=A(o.tabla(n),o.pilotosLiga(n),{inmunes:s}).find(a=>a.pid===e)}var O=n?o.eventosLiga(n):[],U=await B(o),h=V(U.filter(s=>s.filas.some(a=>a.pid===e))).pilotos[e],aa=(o.cfg.palmares||[]).reduce((s,a)=>s+Object.values(a.ligas||{}).filter(f=>f.piloto===e).length,0),sa=(o.cfg.palmares||[]).filter(s=>s.mundial===e).length,_=new Set(U.filter(s=>s.filas.some(a=>a.pid===e)).map(s=>s.sid.split("_")[0])).size;G.innerHTML=`
<section class="hero">
  <div class="ficha-cab">
    <div class="fila" style="flex-wrap:nowrap;gap:12px;align-items:flex-end">${x(e,w?.color,72)}${l.numero!=null?`<div class="dorsal-grande" style="color:${r(w?.color||"var(--accent)")}">${l.numero}</div>`:""}</div>
    <div><div class="etiqueta">${l.rookie?"Rookie \xB7 ":""}${l.edad??"?"} a\xF1os</div><h1>${r(l.nombre)} ${r(l.apellido)}</h1></div>
    <div class="ficha-meta">
      <span class="con-bandera">${g(l.nac,{ancho:22})}<span class="txt">${r(E[l.nac]||"")}</span></span>
      ${w?I(o,l.equipoId):'<span class="muted">Sin equipo</span>'}
      ${n?`<a class="con-bandera" href="liga.html?l=${n}">${P(n,{ancho:18})}<span class="txt muted">Liga ${r(b[n]?.nombre)}</span></a>`:""}
      ${Y?`<span class="insignia mundial">${T.fijado?"Clasificado al Mundial":"En zona Mundial"}</span>`:""}
    </div>
  </div>
</section>
<div class="rejilla rejilla-lado">
  <div class="pila">
    <div class="tarjeta"><div class="datos">
      ${t(H?`${H}\xBA`:"\u2014","Posici\xF3n")}${t(i?.pts??0,"Puntos")}${t(i?.victorias??0,"Victorias")}${t(i?.podios??0,"Podios")}
      ${t(i?.poles??0,"Poles")}${t(i?.vr??0,"Vueltas r\xE1pidas")}${t(i?.dnf??0,"Abandonos")}${t(i?.mediaPos!=null?q(i.mediaPos):"\u2014","Media llegada")}
      ${t(i?.grandSlams||0,"Grand Slams")}${t(i?.quietSlams||0,"Quiet Slams")}${t(i?.adel??0,"Adelantamientos")}${t(i?.posGanadas??0,"Posiciones ganadas")}${t(i?.lideradas??0,"Vueltas lideradas")}
    </div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Resultados de la temporada</h3></div>${ia()}</div>
    ${v?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Liga Intercontinental</h3></div><div class="datos">${t(v.pts,"Puntos")}${t(v.victorias,"Victorias")}${t(v.podios,"Podios")}${t(v.poles,"Poles")}</div></div>`:""}
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Carrera deportiva</h3><span>${_} temporada${_===1?"":"s"}</span></div>
      <div class="datos">${t(h?.carreras??0,"Carreras")}${t(h?.victorias??0,"Victorias")}${t(h?.podios??0,"Podios")}${t(h?.poles??0,"Poles")}${t(h?.pts??0,"Puntos")}${t(aa,"T\xEDtulos de liga")}${t(sa,"Mundiales")}</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo"><h3>Trayectoria</h3></div>${oa()}</div>
  </div>
  <aside class="pila">
    ${m?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Duelo con su compa\xF1ero</h3></div>
      <p><a class="con-bandera" href="piloto.html?id=${r(m)}">${g(o.piloto(m)?.nac)}<span class="txt">${r(o.nombre(m))}</span></a></p>
      ${k("Carreras",i?.h2hC,M?.h2hC)}${k("Clasificaciones",i?.h2hQ,M?.h2hQ)}
      <div class="fila-entre" style="margin-top:10px"><span class="muted">Puntos</span><b>${i?.pts??0} \xB7 ${M?.pts??0}</b></div></div>`:""}
    ${u?`<div class="tarjeta"><div class="tarjeta-titulo"><h3>Situaci\xF3n contractual</h3></div>
      <p>${{despido:'<span class="insignia despido">Despido directo</span>',peligro:'<span class="insignia peligro">Zona de peligro</span>',inmune:'<span class="insignia inmune">Inmune: Mundial</span>',seguro:'<span class="insignia inmune">Asiento seguro</span>'}[u.zona]}</p>
      <p class="muted" style="font-size:.88rem">D\xE9ficit con su compa\xF1ero: ${u.deficit>0?"+":""}${u.deficit} puestos \xB7 \xCDndice de riesgo ${q(u.riesgo)} (si la temporada acabara hoy).</p></div>`:""}
    ${d?`<div class="tarjeta tarjeta-acento"><div class="tarjeta-titulo"><h3>Informe interno</h3></div>
      <p class="muted" style="font-size:.85rem">Solo lo ves t\xFA porque es tu piloto.</p>
      ${p("Ritmo",d.attrs?.ritmo)}${p("Consistencia",d.attrs?.consistencia)}${p("Agresividad",d.attrs?.agresividad)}${p("Adelantamiento",d.attrs?.adelantamiento)}${p("Defensa",d.attrs?.defensa)}${p("Lluvia",d.attrs?.lluvia)}${p("Experiencia",d.attrs?.experiencia)}
      <div class="fila-entre" style="margin-top:10px"><span class="muted">Moral</span><b>${ta(d.moral)}</b></div>
      <div class="fila-entre"><span class="muted">Forma</span><b>${d.forma>.2?"En racha":d.forma<-.2?"Baj\xF3n":"Normal"}</b></div></div>`:""}
  </aside>
</div>`;function t(s,a){return`<div class="dato"><b>${s}</b><span>${a}</span></div>`}function p(s,a){return`<div style="margin:8px 0"><div class="fila-entre" style="font-size:.88rem"><span>${s}</span><b>${a??"?"}</b></div>${N(a||0)}</div>`}function ta(s){return s>=75?"Muy alta":s>=60?"Buena":s>=45?"Normal":s>=30?"Baja":"Por los suelos"}function k(s,a={g:0,p:0},f){let $=(a?.g||0)+(a?.p||0),c=$?a.g/$*100:50;return`<div style="margin:8px 0"><div class="fila-entre" style="font-size:.88rem"><span>${s}</span><b>${a?.g||0} - ${a?.p||0}</b></div><div class="barra"><div class="barra-relleno" style="width:${c}%"></div></div></div>`}function ia(){if(!O.length||!i)return y("Todav\xEDa no ha competido esta temporada.");let s=["Q1","R1","Q2","R2","R3"];return`<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Jornada</th>${s.map(a=>`<th class="cen">${L[a].corto}</th>`).join("")}<th class="der">Pts</th></tr></thead><tbody>
    ${O.map(a=>{let f=s.map($=>{let c=i.historial.find(X=>X.sid===`${a.id}_${$}`);if(!c)return'<td class="cen tenue">\xB7</td>';let W=c.estado==="DNF"?'<span class="insignia dnf">DNF</span>':c.estado==="SIN TIEMPO"?'<span class="muted">ST</span>':S(c.pos);return`<td class="cen"><a href="sesion.html?id=${r(c.sid)}">${W}</a>${c.vr&&$.startsWith("R")?'<span class="insignia vr">VR</span>':""}</td>`}).join("");return`<tr><td><div class="celda-jornada">${g(a.circuito?.pais,{ancho:18})}<b>R${a.ronda}</b><span class="circ" title="${r(a.circuito?.nombre||"")}">${r(a.circuito?.nombre||"")}</span></div></td>${f}<td class="pts">${i.ptsEvento[a.id]??""}</td></tr>`}).join("")}</tbody></table></div>`}function oa(){let s=R?.historia||[];return s.length?`<table class="tabla"><thead><tr><th>Temporada</th><th>Liga</th><th>Escuder\xEDa</th><th class="cen">Pos</th><th class="cen">V</th><th class="der">Pts</th></tr></thead><tbody>
    ${s.slice().reverse().map(a=>`<tr><td>T${a.temporada}</td><td><span class="con-bandera">${P(a.liga,{ancho:16})}<span class="txt">${r(b[a.liga]?.nombre||a.liga)}</span></span></td><td>${I(o,a.equipoId)}</td><td class="cen">${S(a.pos)}</td><td class="cen">${a.victorias||0}</td><td class="pts">${a.pts}</td></tr>`).join("")}</tbody></table>`:`<p class="muted">${l.rookie?"Primera temporada en Hyper Race X1.":"Sin temporadas anteriores registradas."}</p>`}
