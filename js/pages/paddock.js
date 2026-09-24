import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarPaddock } from '../core/datos.js';
import { store, usuario, ahora } from '../core/app.js';
import { esc, banderaLiga, vacio, hace, toast, $, $$ } from '../core/ui.js';
import { celdaEquipo, pos } from '../core/componentes.js';
import { LIGAS, LIGAS_NACIONALES, diaMadrid } from '../engine/constants.js';

const u = await montar({ activo: 'paddock' });
const main = document.getElementById('main');
const [d, declaraciones] = await Promise.all([cargarDatos(), cargarPaddock(60)]);
barraDirecto(d);
const miEq = u?.perfil?.equipoId;
const ranking = d.rankingManagers();
const hoy = diaMadrid(ahora());
const yaHoy = declaraciones.some(x => x.uid === u?.uid && x.dia === hoy);
let filtro = 'TODAS';

main.innerHTML = `
<div class="cabecera-pagina"><div><div class="etiqueta">Mánagers</div><h1>Paddock</h1><p class="sub">Lo que dicen los mánagers y quién lo está haciendo mejor.</p></div></div>
<div class="rejilla rejilla-lado">
  <div class="pila">
    ${miEq ? `<form class="tarjeta" id="f-decl">
      <div class="tarjeta-titulo"><h2>Declaración a la prensa</h2><span class="muted peq" id="cont">0/240</span></div>
      <textarea name="texto" rows="3" maxlength="240" placeholder="${yaHoy ? 'Ya has hablado hoy. Vuelve mañana.' : 'Una declaración al día. Pica a tus rivales, defiende a tus pilotos…'}" ${yaHoy ? 'disabled' : ''}></textarea>
      <div class="fila-botones"><button class="btn btn-peq" ${yaHoy ? 'disabled' : ''}>Publicar</button></div></form>` : ''}
    <div class="tarjeta">
      <div class="barra-opciones"><span class="etiqueta">Declaraciones</span><select id="filtro"><option value="TODAS">Todas las ligas</option>${LIGAS_NACIONALES.map(l => `<option value="${l}">${esc(LIGAS[l].nombre)}</option>`).join('')}</select></div>
      <div id="lista"></div>
    </div>
  </div>
  <aside class="tarjeta">
    <div class="tarjeta-titulo"><h2>Ranking de mánagers</h2></div>
    <p class="muted peq">Puntos de su escudería respecto a la media de su liga (100 = media), para poder comparar entre ligas.</p>
    ${ranking.length ? ranking.map((r, i) => `<div class="ranking-fila"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${r.eq === miEq ? '<b>' : ''}${esc(r.nombre)}${r.eq === miEq ? '</b>' : ''} <span class="muted peq">${banderaLiga(r.liga, { ancho: 12 })} ${esc(d.nombreEquipo(r.eq))} · ${r.pos}º</span></span><span class="v">${r.indice}</span><div class="barra"><div class="barra-relleno" style="width:${Math.min(100, r.indice / Math.max(...ranking.map(x => x.indice)) * 100)}%"></div></div></div>`).join('') : vacio('Todavía no hay mánagers con escudería.')}
  </aside>
</div>`;

function pintarLista() {
    const lista = declaraciones.filter(x => filtro === 'TODAS' || x.liga === filtro);
    $('#lista').innerHTML = lista.length ? lista.map(x => `<div class="declaracion">
      <div class="fila-entre"><span class="meta">${banderaLiga(x.liga, { ancho: 14 })} <b style="color:var(--texto)">${esc(x.nombre)}</b> · ${esc(d.nombreEquipo(x.equipoId))}</span><span class="meta">${hace(x.fecha)}${x.uid === u?.uid ? ` · <a href="#" data-borrar="${esc(x.id)}">borrar</a>` : ''}</span></div>
      <p>${esc(x.texto)}</p></div>`).join('') : vacio('Nadie ha dicho nada todavía.');
    $$('[data-borrar]').forEach(a => a.addEventListener('click', async (e) => {
        e.preventDefault();
        await store().del(`paddock/${a.dataset.borrar}`);
        location.reload();
    }));
}
$('#filtro').addEventListener('change', (e) => { filtro = e.target.value; pintarLista(); });
pintarLista();

const f = $('#f-decl');
if (f) {
    f.texto.addEventListener('input', () => { $('#cont').textContent = `${f.texto.value.length}/240`; });
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = f.texto.value.trim();
        if (!texto) return;
        const eq = d.equipo(miEq);
        try {
            await store().set(`paddock/${hoy}_${u.uid}`, { uid: u.uid, nombre: u.perfil.nombre, equipoId: miEq, liga: eq?.liga || null, texto, fecha: ahora(), dia: hoy });
            toast('Declaración publicada');
            setTimeout(() => location.reload(), 600);
        } catch (err) { console.error(err); toast('No se pudo publicar (¿ya hablaste hoy?)', 'error'); }
    });
}
