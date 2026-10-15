// Gestión de una partida de amigos (su administrador): invitar, abrir o cerrar la inscripción, echar a alguien,
// nombrar más admins o archivarla. Es un control "light": el juego lo lleva el servidor y aquí solo se piden cambios.
import { montar } from '../core/layout.js';
import { store, usuario, PARTIDA, partida, esAdminPartida, escuchar, escucharConsulta } from '../core/app.js';
import { esc, vacio, toast, $, $$, confirmar, hace, banderaLiga } from '../core/ui.js';

const u = await montar({ activo: 'partida' });
const main = document.getElementById('main');
if (!u) { location.href = 'entrar.html'; throw new Error('sin sesión'); }
if (!PARTIDA || !esAdminPartida()) { main.innerHTML = `<div class="caja-auth tarjeta"><h1>Sin acceso</h1><p class="muted">Solo el administrador de una partida puede gestionarla.</p><a class="btn" href="partidas.html">Mis partidas</a></div>`; throw new Error('no admin'); }

let p = partida(), cfg = await store().get('config/juego'), priv = await store().get(`partidas_priv/${PARTIDA}`).catch(() => null);
let miembros = [], gestiones = [];
const equipos = Object.fromEntries((await store().list('equipos')).map(e => [e.id, e]));

async function pedir(tipo, params, msg) {
    try {
        await store().set(`gestion/${store().nuevoId('gestion')}`, { uid: u.uid, tipo, params, creado: Date.now(), estado: 'pendiente' });
        toast(`${msg}: se aplica en unos segundos`, 'info');
    } catch (e) { toast('No se pudo: ' + (e.message || ''), 'error'); }
}

function pintar() {
    const enlace = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}partidas.html?unirse=${PARTIDA}&c=${priv?.codigo || ''}`;
    const errores = gestiones.filter(g => g.estado === 'error').slice(0, 3);
    main.innerHTML = `
    <div class="cabecera-pagina"><div><div class="etiqueta">Administración de la partida</div><h1>${esc(p.nombre)}</h1>
      <p class="sub">${(p.ajustes?.ligas || []).map(l => banderaLiga(l, { ancho: 16 })).join(' ')} ${p.ajustes?.mundial ? '+ Mundial' : 'sin Mundial'} · ${p.ajustes?.jornadas || 5} jornadas por liga, una cada ${p.ajustes?.diasEntre || 4} días a las ${p.ajustes?.hora || 19}:00 · temporada ${cfg?.temporada || 1}</p></div>
      <a class="btn btn-sec" href="index.html">Ir a la partida</a></div>
    ${errores.length ? `<div class="aviso-caja" style="margin-bottom:14px">${errores.map(g => esc(g.resultado?.error || 'Error')).join('<br>')}</div>` : ''}
    <div class="rejilla rejilla-2" style="align-items:start">
      <div class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Invitar</h2></div>
          <p class="muted peq">Pásales este enlace. También pueden escribir el código en «Mis partidas».</p>
          <div class="codigo-caja"><code id="enlace">${esc(enlace)}</code><button class="btn btn-peq" id="copiar">Copiar</button></div>
          <p class="peq" style="margin:8px 0 0">Código: <b class="mono">${esc(PARTIDA)}-${esc(priv?.codigo || '····')}</b></p>
          <div class="fila-botones"><button class="btn btn-sec btn-peq" id="nuevo-codigo">Cambiar el código</button></div>
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Ajustes</h2></div>
          <label class="chk"><input type="checkbox" id="inscripcion" ${cfg?.inscripcion !== false ? 'checked' : ''}> Se pueden coger escuderías libres <span class="muted peq">(se cierra sola tras la primera jornada)</span></label>
          <label class="chk" style="margin-top:8px"><input type="checkbox" id="publica" ${p.publica ? 'checked' : ''}> Abierta: cualquiera puede unirse sin código</label>
          <form id="f-nombre" class="campo-fila" style="margin-top:12px"><label>Nombre<input name="nombre" minlength="3" maxlength="40" value="${esc(p.nombre)}"></label></form>
          <div class="fila-botones"><button class="btn btn-sec btn-peq" id="renombrar">Cambiar nombre</button></div>
        </section>
        <section class="tarjeta" style="border-color:var(--mal)"><h3 class="mal">Archivar</h3><p class="muted peq">La partida deja de jugarse y desaparece de las listas. Los datos se conservan.</p>
          <button class="btn btn-peligro btn-peq" id="archivar">Archivar la partida</button></section>
      </div>
      <section class="tarjeta"><div class="tarjeta-titulo"><h2>Mánagers</h2><span>${miembros.length}</span></div>
        ${miembros.length ? miembros.map(m => {
            const esAdm = (p.admins || []).includes(m.id), eq = equipos[m.equipoId];
            return `<div class="fila-entre" style="padding:9px 0;border-top:1px solid var(--hair2);gap:10px;flex-wrap:wrap">
              <div><b>${esc(m.nombre || 'Mánager')}</b>${esAdm ? ' <span class="insignia">admin</span>' : ''}${m.id === u.uid ? ' <span class="muted peq">(tú)</span>' : ''}
                <div class="muted peq">${eq ? `${banderaLiga(eq.liga, { ancho: 12 })} ${esc(eq.nombre)}` : 'Sin escudería'} · se unió ${hace(m.unido)}</div></div>
              ${m.id === u.uid ? '' : `<span class="fila"><button class="btn btn-sec btn-peq" data-admin="${esc(m.id)}" data-si="${esAdm ? '0' : '1'}">${esAdm ? 'Quitar admin' : 'Hacer admin'}</button><button class="btn btn-peligro btn-peq" data-echar="${esc(m.id)}">Echar</button></span>`}</div>`;
        }).join('') : vacio('Todavía no hay nadie.')}
        <p class="muted peq" style="margin:10px 0 0">Si echas a alguien, su escudería vuelve a manos de la IA.</p>
      </section>
    </div>`;
    $('#copiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText(enlace); toast('Enlace copiado'); } catch { toast('Cópialo a mano', 'error'); } });
    $('#nuevo-codigo').addEventListener('click', async () => { if (await confirmar('¿Cambiar el código? El enlace anterior dejará de funcionar.')) pedir('codigo', {}, 'Código nuevo'); });
    $('#inscripcion').addEventListener('change', (e) => pedir('inscripcion', { abierta: e.target.checked }, e.target.checked ? 'Inscripción abierta' : 'Inscripción cerrada'));
    $('#publica').addEventListener('change', (e) => pedir('publica', { publica: e.target.checked }, e.target.checked ? 'Ahora es abierta' : 'Ahora es privada'));
    $('#renombrar').addEventListener('click', () => pedir('renombrar', { nombre: $('#f-nombre').nombre.value }, 'Nombre cambiado'));
    $('#archivar').addEventListener('click', async () => { if (await confirmar(`¿Archivar <b>${esc(p.nombre)}</b>? Dejará de jugarse.`, { peligro: true })) pedir('archivar', {}, 'Partida archivada'); });
    $$('[data-admin]', main).forEach(b => b.addEventListener('click', () => pedir('admin', { uid: b.dataset.admin, si: b.dataset.si === '1' }, 'Permisos cambiados')));
    $$('[data-echar]', main).forEach(b => b.addEventListener('click', async () => {
        const m = miembros.find(x => x.id === b.dataset.echar);
        if (await confirmar(`¿Echar a <b>${esc(m?.nombre || '')}</b> de la partida?`, { peligro: true })) pedir('expulsar', { uid: m.id }, 'Mánager fuera');
    }));
}

escucharConsulta('miembros', [], (l) => { miembros = l.sort((a, b) => (a.unido || 0) - (b.unido || 0)); pintar(); });
escucharConsulta('gestion', [['uid', '==', u.uid]], (l) => { gestiones = l.sort((a, b) => (b.creado || 0) - (a.creado || 0)); pintar(); });
escuchar(`partidas/${PARTIDA}`, async (doc) => { if (doc) { p = doc; priv = await store().get(`partidas_priv/${PARTIDA}`).catch(() => priv); cfg = await store().get('config/juego'); pintar(); } });
pintar();
