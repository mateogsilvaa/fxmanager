import{a as z}from"./4XYTXYRR.js";import{c as i,d as A,f as L,h as P,k as T,l as y}from"./YUWPRQBV.js";import{f as S}from"./R7E3CXPW.js";import{a as f,c as C,i as M,j as N}from"./SPI3NESF.js";var D=a=>a==="INT"?"Liga Intercontinental":f[a].nombre,_=a=>{let o=(a||"").match(/\(([^)]+)\)/)?.[1];return o&&o!=="Moto"&&o!=="Madrid"?o:(a||"").replace(/^Circuit of the /i,"").replace(/^(Circuit(o)?|Autodromo|Autódromo)( Nazionale| Internacional| Internazionale)?( de la| del| de| do| dell'| dell’| dei)? /i,"")},O=(a,o)=>a&&a.length>o?a.slice(0,o-1).trimEnd()+"\u2026":a||"";function k(a,o){let n=a.eventosLiga(o),l=S(),p=e=>M.filter(r=>e.sesiones?.[r]).map(r=>({tipo:r,...e.sesiones[r]})),s=e=>p(e).every(r=>r.revealAt<=l),v=e=>p(e).some(r=>r.publishAt<=l),g=n.filter(s).length,t=n.find(e=>!s(e))||null,u=t&&p(t).find(e=>e.publishAt>l)||null;return{eventos:n,total:n.length,jugadas:g,actual:t,enCurso:t?v(t):!1,siguiente:u,terminada:n.length>0&&!t}}function J(a){let o=S(),n=M.find(l=>a.sesiones?.[l]&&a.sesiones[l].publishAt<=o&&a.sesiones[l].revealAt>o);return n?{tipo:n,...a.sesiones[n]}:null}function B(a,{ancla:o=!0,carrusel:n=!1}={}){return`<nav class="tira-ligas" aria-label="Ligas">${C.map((l,p)=>{let s=k(a,l),g=s.actual&&J(s.actual)?'<span class="tira-cuenta en-vivo-txt">En directo</span>':s.siguiente?`<span class="tira-cuenta mono" data-cuenta="${s.siguiente.publishAt}" data-corta>${T(s.siguiente.publishAt,!0)}</span>`:s.terminada?'<span class="tira-cuenta muted">Terminada</span>':'<span class="tira-cuenta muted">Sin fecha</span>';return`<a class="tira-liga" href="${o?`#liga-${l}`:`liga.html?l=${l}`}"${n?` data-slide="${p}" role="tab"`:""}>
          <span class="tira-nombre">${L(l,{ancho:18,titulo:!1})}${i(f[l].nombre)}</span>
          <span class="tira-ronda">${s.total?`J${Math.min(s.total,s.jugadas+(s.actual?1:0))} de ${s.total}`:"\u2014"}</span>
          ${g}${n?'<span class="tira-progreso"></span>':""}</a>`}).join("")}</nav>`}function H(a,o,n,{enlace:l=!0,titulo:p=!0}={}){let s=k(a,o),v=a.clasificacionPilotos(o),g=a.clasificacionEquipos(o),t=v.some(c=>c.pts>0),u=n.find(c=>c.liga===o),e=s.actual,r=Math.max(1,v[0]?.pts||0),d=e?J(e):null,$=o==="INT"?{}:Object.fromEntries((a.clasificadosMundial().clasificados||[]).map(c=>[c.pid,c.via])),b=e?`<div class="lb-proxima">
        <div class="etiqueta">${s.enCurso?`Jornada ${e.ronda} \xB7 en curso`:`Pr\xF3xima jornada \xB7 J${e.ronda}`}</div>
        <div class="lb-circuito">${A(e.circuito?.pais,{ancho:18})} ${i(e.circuito?.nombre||"")}</div>
        ${d?`<a class="lb-directo" href="sesion.html?id=${i(e.id)}_${d.tipo}">${i(N[d.tipo].nombre)} en directo \u2192</a>`:s.siguiente?`<div class="muted peq">${i(N[s.siguiente.tipo].nombre)} \xB7 ${P(s.siguiente.publishAt)}</div>
        <div class="cuenta lb-cuenta" data-cuenta="${s.siguiente.publishAt}">${T(s.siguiente.publishAt)}</div>`:'<div class="muted peq">Publicando resultados\u2026</div>'}
      </div>`:`<div class="lb-proxima"><div class="etiqueta">${s.terminada?"Liga terminada":"Calendario"}</div><div class="lb-circuito">${s.terminada?`Campe\xF3n: ${i(a.nombre(v[0]?.pid))}`:"A\xFAn sin jornadas"}</div></div>`,m=s.total?`<ol class="rondas">${s.eventos.map((c,I)=>`<li class="ronda ${I<s.jugadas?"hecha":c===e?"actual":"pendiente"}"><span class="ronda-barra"></span><span class="ronda-txt"><b>J${c.ronda}</b> ${i(O(_(c.circuito?.nombre),18))}</span></li>`).join("")}</ol>`:"",q=`<div class="lb-col">
        <h3 class="lb-sub">${t?"Top 5 pilotos":"Pilotos"}</h3>
        ${v.slice(0,5).map((c,I)=>{let h=a.piloto(c.pid),j=a.equipo(c.eq||h?.equipoId);return`<a class="lb-piloto ${t?$[c.pid]==="top3"?"zona-top3":$[c.pid]==="repesca"?"zona-wc":"":""}" href="piloto.html?id=${i(c.pid)}">
              <span class="lb-pos mono">${I+1}</span>
              <span class="lb-quien">${A(h?.nac,{ancho:16})}<b>${i(h?.nombre||"")} ${i(h?.apellido||"")}</b><span class="lb-eq"><i style="background:${i(j?.color||"#999")}"></i>${i(j?.corto||j?.nombre||"")}</span></span>
              <span class="lb-pts mono">${c.pts}</span>
              ${t?`<span class="lb-barra"><span style="width:${Math.round(c.pts/r*100)}%;background:${i(j?.color||"var(--ink)")}"></span></span>`:""}
            </a>`}).join("")}
      </div>`,E=`<div class="lb-col">
        <h3 class="lb-sub">${t?"Top 3 escuder\xEDas":"Escuder\xEDas"}</h3>
        ${g.slice(0,3).map((c,I)=>{let h=a.equipo(c.eq);return`<a class="lb-equipo" href="equipo.html?id=${i(c.eq)}" style="--c:${i(h?.color||"#999")}">
              <span class="lb-pos-grande">${I+1}</span>
              <span><b>${i(h?.nombre||"")}</b><span class="muted peq">${z(h)}</span></span>
              <span class="lb-pts mono">${c.pts}<small>pts</small></span></a>`}).join("")}
      </div>`,w=`<div class="lb-col lb-noticia">
        <h3 class="lb-sub">\xDAltima noticia</h3>
        ${u?`<article><div class="muted peq">${y(u.publishAt)}</div><h4>${i(u.titulo)}</h4>${u.texto?`<p>${i(O(u.texto,190))}</p>`:""}</article>`:'<p class="muted">Todav\xEDa no hay noticias de esta liga.</p>'}
        <a class="lb-mas lb-mas-peq" href="liga.html?l=${o}&tab=noticias">Todas las noticias \u2192</a>
      </div>`;return`<section class="liga-bloque${p?"":" sin-titulo"}" id="liga-${o}">
      <header class="lb-cab">
        ${p?`<div class="lb-titulo">${L(o,{ancho:44,titulo:!1})}<div>
          <div class="etiqueta">${o==="INT"?"Fase final":"Liga nacional"} \xB7 ${s.total?`${s.jugadas} de ${s.total} jornadas jugadas`:"sin calendario"}</div>
          <h2>${i(D(o))}</h2></div></div>`:""}
        ${b}
      </header>
      ${m}
      <div class="lb-cuerpo">${q}${E}${w}</div>
      ${l?`<a class="lb-mas" href="liga.html?l=${o}">${i(o==="INT"?"Ver el Mundial completo":`Ver la liga de ${f[o].nombre} completa`)} \u2192</a>`:""}
    </section>`}function K(a,o=6){let n=a.cfg.mundial?.participantes||[];if(!n.length)return[];let l=a.clasificacionPilotos("INT"),p=Object.fromEntries(l.map(t=>[t.pid,t])),s=Object.fromEntries((a.cfg.mundial?.clasificados||[]).map(t=>[t.pid,t])),v=l.some(t=>t.pts>0);return n.map(t=>{let u=a.piloto(t),e=s[t]||{},r=e.liga||u?.liga,d=r&&f[r]?a.tabla(r).clasPilotos.find(E=>E.pid===t):null,$=p[t],b=[],m=0;v&&$?.posicion===1&&(b.push(`Lidera el Mundial con ${$.pts} puntos`),m+=200),$?.victorias&&(b.push(`${$.victorias} victoria${$.victorias>1?"s":""} en el Mundial`),m+=40*$.victorias);let q=e.posLiga||d?.posicion;return q===1?(b.push(`Campe\xF3n de ${f[r].nombre}`),m+=90):q&&q<=3&&(b.push(`${q}\xBA en ${f[r].nombre}`),m+=45),d?.victorias>=2&&(b.push(`${d.victorias} victorias en su liga`),m+=10*d.victorias),d?.poles>=2&&(b.push(`${d.poles} poles`),m+=4*d.poles),e.via==="repesca"&&(b.push("Entr\xF3 entre los 5 mejores del resto"),m+=5),u?.rookie&&(b.push("Rookie en su primera temporada"),m+=15),m+=($?.pts||0)*2+(d?.pts||0)*.3,{pid:t,liga:r,pI:$,nat:d,motivos:b,score:m}}).filter(t=>t.motivos.length).sort((t,u)=>u.score-t.score).slice(0,o)}function Q(a,o){return`<div class="destacados">${o.map((n,l)=>{let p=a.piloto(n.pid),s=a.equipo(p?.equipoId);return`<a class="destacado" href="piloto.html?id=${i(n.pid)}" style="--c:${i(s?.color||"#999")}">
          <div class="destacado-cab"><span class="destacado-n mono">${String(l+1).padStart(2,"0")}</span>${L(n.liga,{ancho:18})}</div>
          <div class="destacado-nombre">${A(p?.nac,{ancho:18})} <span>${i(p?.nombre||"")}</span> <b>${i(p?.apellido||"")}</b></div>
          <div class="lb-eq"><i style="background:${i(s?.color||"#999")}"></i>${i(s?.nombre||"")}</div>
          <p class="destacado-motivo">${i(n.motivos[0])}</p>
          ${n.motivos.length>1?`<p class="muted peq">${n.motivos.slice(1,3).map(i).join(" \xB7 ")}</p>`:""}
          <div class="destacado-datos"><span><b class="mono">${n.pI?.pts??0}</b> pts Mundial</span><span><b class="mono">${n.nat?.pts??0}</b> pts en su liga</span></div>
        </a>`}).join("")}</div>`}export{B as a,H as b,K as c,Q as d};
