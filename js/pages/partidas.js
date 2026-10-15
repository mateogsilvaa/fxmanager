// Mis partidas: crear una liga con amigos, unirse con un código o a una pública, y cambiar de partida.
import { montar } from '../core/layout.js';
import { store, usuario, PARTIDA, refrescarPerfil, escuchar } from '../core/app.js';
import { esc, vacio, toast, $, $$, hace, banderaLiga } from '../core/ui.js';
import { LIGAS, LIGAS_TODAS } from '../engine/constants.js';

const u = await montar({ activo: 'partidas' });
const main = document.getElementById('main');
if (!u) { location.href = 'entrar.html?volver=partidas.html' + encodeURIComponent(location.search); throw new Error('sin sesión'); }
await refrescarPerfil();
const params = new URLSearchParams(location.search);
const FASES = { pretemporada: 'Pretemporada', nacional: 'Ligas nacionales', mundial: 'Mundial', mercado: 'Mercado', cerrada: 'Fin de temporada' };
const idNuevo = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
const entrarEn = (pid) => { location.href = `index.html?p=${pid || 0}`; };
const perfil = () => usuario().perfil || {};
const misIds = () => [...new Set(misIdsGlobal || [])];
// ¿Juega la liga original? (se mira el perfil global: dentro de una partida el perfil se adapta a ella)
const global = await store().get(`usuarios/${u.uid}`).catch(() => null) || {};
const principal = !!global.equipoId || global.estado === 'aprobado' || !!global.isAdmin;
const misIdsGlobal = global.partidas || [];

async function cargarMias() {
    const ids = misIds();
    return (await Promise.all(ids.map(id => store().get(`partidas/${id}`).catch(() => null)))).filter(Boolean);
}
async function apuntar(pid) {
    const lista = [...new Set([...misIds(), pid])].slice(-20);
    await store().merge(`usuarios/${u.uid}`, { partidas: lista });
    misIdsGlobal.splice(0, misIdsGlobal.length, ...lista);
}

async function pintar() {
    const [mias, publicas] = await Promise.all([
        cargarMias(),
        store().list('partidas', [['publica', '==', true], ['estado', '==', 'activa']], { limit: 30 }).catch(() => []),
    ]);
    const tarjeta = (p) => `<div class="partida-tarjeta ${p.id === PARTIDA ? 'actual' : ''}">
        <div><b>${esc(p.nombre)}</b>${p.estado === 'solicitada' ? ' <span class="insignia">preparándose…</span>' : p.estado !== 'activa' ? ` <span class="insignia peligro">${esc(p.estado)}</span>` : ''}
          <div class="muted peq">${(p.ajustes?.ligas || []).map(l => banderaLiga(l, { ancho: 14 })).join(' ')} ${p.ajustes?.mundial ? '+ Mundial' : ''} · ${p.miembros || 1} mánager${(p.miembros || 1) === 1 ? '' : 's'} · ${p.temporada ? `temporada ${p.temporada}` : ''}${p.fase ? ` · ${FASES[p.fase] || p.fase}` : ''}${(p.admins || []).includes(u.uid) ? ' · <b>eres admin</b>' : ''}</div></div>
        <div class="fila">${p.id === PARTIDA ? '<span class="muted peq">Estás aquí</span>' : p.estado === 'activa' ? `<button class="btn btn-peq" data-entrar="${esc(p.id)}">Entrar</button>` : ''}${(p.admins || []).includes(u.uid) && p.estado === 'activa' ? `<a class="btn btn-sec btn-peq" href="partida.html?p=${esc(p.id)}">Gestionar</a>` : ''}</div></div>`;
    main.innerHTML = `
    <div class="cabecera-pagina"><div><div class="etiqueta">FX Manager</div><h1>Mis partidas</h1><p class="sub">Cada partida es un campeonato distinto, con sus escuderías, sus pilotos y su historia. Puedes estar en varias a la vez.</p></div></div>
    <div class="rejilla rejilla-lado" style="align-items:start">
      <div class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Tus partidas</h2></div>
          ${principal ? `<div class="partida-tarjeta ${!PARTIDA ? 'actual' : ''}"><div><b>Hyper Race X1 · la liga original</b><div class="muted peq">Cinco ligas y Mundial</div></div><div class="fila">${!PARTIDA ? '<span class="muted peq">Estás aquí</span>' : '<button class="btn btn-peq" data-entrar="">Entrar</button>'}</div></div>` : ''}
          ${mias.length ? mias.map(tarjeta).join('') : principal ? '' : vacio('Todavía no estás en ninguna partida. Crea una o únete con un código.')}
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Unirme con un código</h2></div>
          <p class="muted peq">Te lo pasa quien creó la partida (también vale el enlace de invitación).</p>
          <form id="f-unirme" class="campo-fila"><label>Código<input name="codigo" required placeholder="abc123xyz9-1234" value="${esc(params.get('unirse') ? `${params.get('unirse')}${params.get('c') ? '-' + params.get('c') : ''}` : '')}"></label></form>
          <div class="fila-botones"><button class="btn" id="b-unirme">Unirme</button></div>
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Partidas abiertas</h2><span>${publicas.length}</span></div>
          ${publicas.filter(p => !misIds().includes(p.id)).map(p => `<div class="partida-tarjeta"><div><b>${esc(p.nombre)}</b><div class="muted peq">${(p.ajustes?.ligas || []).map(l => banderaLiga(l, { ancho: 14 })).join(' ')} · ${p.miembros || 1} mánagers · creada ${hace(p.creada)}</div></div><button class="btn btn-sec btn-peq" data-publica="${esc(p.id)}">Unirme</button></div>`).join('') || vacio('Ahora mismo no hay partidas abiertas a cualquiera.')}
        </section>
      </div>
      <form class="tarjeta" id="f-crear"><div class="tarjeta-titulo"><h2>Crear una partida</h2></div>
        <label>Nombre<input name="nombre" required minlength="3" maxlength="40" placeholder="La liga de los jueves"></label>
        <fieldset class="crear-ligas"><legend>Ligas nacionales</legend>${LIGAS_TODAS.map((l, i) => `<label class="chk">${banderaLiga(l, { ancho: 16 })}<input type="checkbox" name="liga" value="${l}" ${i === 0 ? 'checked' : ''}> ${esc(LIGAS[l].nombre)}</label>`).join('')}
          <p class="muted peq" style="margin:4px 0 0">Cada liga tiene 10 escuderías. Con pocos amigos, una o dos ligas es lo más divertido.</p></fieldset>
        <label class="chk" style="margin-top:10px"><input type="checkbox" name="mundial" checked> Mundial al final de la temporada (con dos ligas o más)</label>
        <div class="campo-fila" style="margin-top:10px">
          <label>Jornadas por liga<select name="jornadas">${[3, 4, 5, 6, 8].map(n => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Una jornada cada<select name="diasEntre">${[2, 3, 4, 5, 7].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n} días</option>`).join('')}</select></label>
          <label>Hora de la primera sesión<select name="hora">${[16, 17, 18, 19, 20, 21].map(h => `<option value="${h}" ${h === 19 ? 'selected' : ''}>${h}:00</option>`).join('')}</select></label>
        </div>
        <label class="chk" style="margin-top:10px"><input type="checkbox" name="novedades" checked> Con todo desde el principio (ingenieros, ramas del coche, juntas de pilotos, lesiones, llamadas…)</label>
        <label class="chk"><input type="checkbox" name="publica"> Abierta: cualquiera puede unirse sin código</label>
        <p class="muted peq">La primera jornada es dentro de dos días. Después de cada temporada empieza otra sola.</p>
        <div class="fila-botones"><button class="btn" id="b-crear">Crear partida</button></div>
      </form>
    </div>`;
    $$('[data-entrar]', main).forEach(b => b.addEventListener('click', () => entrarEn(b.dataset.entrar)));
    $$('[data-publica]', main).forEach(b => b.addEventListener('click', () => unirme(b.dataset.publica, '')));
    $('#b-unirme').addEventListener('click', () => {
        const v = $('#f-unirme').codigo.value.trim();
        const [pid, codigo] = [v.slice(0, v.lastIndexOf('-') > 0 ? v.lastIndexOf('-') : v.length), v.lastIndexOf('-') > 0 ? v.slice(v.lastIndexOf('-') + 1) : ''];
        if (!pid) return toast('Escribe el código', 'error');
        unirme(pid, codigo);
    });
    const f = $('#f-crear');
    f.addEventListener('submit', (e) => { e.preventDefault(); crear(f); });
    if (params.get('unirse') && params.get('c') && !misIds().includes(params.get('unirse'))) unirme(params.get('unirse'), params.get('c'));
}

async function unirme(pid, codigo) {
    const p = await store().get(`partidas/${pid}`).catch(() => null);
    if (!p || p.estado !== 'activa') return toast('No existe ninguna partida activa con ese código.', 'error');
    if (misIds().includes(pid)) return entrarEn(pid);
    try {
        await store().set(`partidas/${pid}/miembros/${u.uid}`, { uid: u.uid, nombre: (perfil().nombre || 'Mánager').slice(0, 40), codigo: codigo || '', equipoId: null, unido: Date.now() });
    } catch { return toast(p.publica ? 'No se pudo entrar en la partida.' : 'El código no es correcto.', 'error'); }
    await apuntar(pid);
    toast(`Bienvenido a ${p.nombre}`);
    setTimeout(() => { location.href = `escuderia.html?p=${pid}`; }, 600);
}

async function crear(f) {
    const ligas = $$('[name=liga]:checked', f).map(x => x.value);
    if (!ligas.length) return toast('Elige al menos una liga', 'error');
    const btn = $('#b-crear'); btn.disabled = true; btn.textContent = 'Creando…';
    const id = idNuevo();
    const ajustes = { ligas, mundial: f.mundial.checked && ligas.length >= 2, jornadas: +f.jornadas.value, diasEntre: +f.diasEntre.value, hora: +f.hora.value, novedades: f.novedades.checked };
    try {
        await store().set(`partidas/${id}`, { nombre: f.nombre.value.trim().slice(0, 40), creador: u.uid, creadorNombre: (perfil().nombre || 'Admin').slice(0, 40), ajustes, estado: 'solicitada', creada: Date.now(), publica: f.publica.checked });
        await apuntar(id);
    } catch (e) { btn.disabled = false; btn.textContent = 'Crear partida'; return toast('No se pudo crear: ' + (e.message || ''), 'error'); }
    main.innerHTML = `<div class="caja-auth tarjeta"><h1>Preparando tu partida…</h1><p class="muted">Estamos generando las escuderías, los pilotos y el calendario. Tarda unos segundos.</p><div class="cargando"><span class="spinner"></span></div></div>`;
    const parar = escuchar(`partidas/${id}`, (p) => {
        if (p?.estado === 'activa') { parar?.(); location.href = `escuderia.html?p=${id}`; }
        else if (p?.estado === 'rechazada' || p?.estado === 'error') { parar?.(); main.innerHTML = `<div class="caja-auth tarjeta"><h1>No se pudo crear</h1><p>${esc(p.motivo || 'Inténtalo más tarde.')}</p><a class="btn" href="partidas.html">Volver</a></div>`; }
    });
}

await pintar();
