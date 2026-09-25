// Modo sombra (solo admin): dirigir en secreto una escudería. Para los demás sigue siendo de la IA.
import { montar } from '../core/layout.js';
import { cargarDatos, limpiarCache } from '../core/datos.js';
import { iniciar, usuario, esAdmin, store, fijarSombra } from '../core/app.js';
import { esc, banderaLiga, vacio, toast, confirmar, $$ } from '../core/ui.js';
import { LIGAS, LIGAS_NACIONALES } from '../engine/constants.js';
import { reconstruirCatalogo } from '../jobs/catalogo.js';

await iniciar();
const u = usuario();
const sombra = u && esAdmin() ? await store().get('secreto/sombra').catch(() => null) : null;

if (u && esAdmin() && sombra?.equipoId && sombra.uid === u.uid) {
    // Ya tiene escudería en sombra: se abre el panel normal de escudería sobre ella
    fijarSombra(sombra.equipoId);
    await import('./escuderia.js');
} else {
    await montar({ activo: 'escuderia' });
    const main = document.getElementById('main');
    if (!u) location.href = 'entrar.html';
    else if (!esAdmin()) main.innerHTML = `<div class="caja-auth tarjeta"><h1>Solo administración</h1><p class="muted">Esta página no está disponible.</p><a class="btn btn-sec" href="index.html">Ir al inicio</a></div>`;
    else if (sombra?.equipoId) main.innerHTML = `<div class="caja-auth tarjeta"><h1>Modo sombra ocupado</h1><p class="muted">Otra cuenta de administración ya lleva una escudería en sombra.</p></div>`;
    else await elegir(main);
}

async function elegir(main) {
    const d = await cargarDatos();
    let liga = LIGAS_NACIONALES[0];
    const pintar = () => {
        const libres = Object.entries(d.cat.equipos).filter(([, e]) => !e.ownerId && e.liga === liga);
        main.innerHTML = `<div class="cabecera-pagina"><div><div class="etiqueta">Solo administración</div><h1>Modo sombra</h1>
          <p class="sub">Elige una escudería de la IA y dirígela en secreto. Para el resto de mánagers seguirá siendo de la IA, con su mánager ficticio, y no se podrá elegir.</p></div></div>
        <div class="selector-ligas">${LIGAS_NACIONALES.map(l => `<a href="#" data-liga="${l}" class="${l === liga ? 'activo' : ''}">${banderaLiga(l, { ancho: 18, titulo: false })}${esc(LIGAS[l].nombre)}</a>`).join('')}</div>
        <div class="tarjeta">${libres.length ? libres.map(([id, e]) => `<div class="fila-entre" style="padding:12px 0;border-top:1px solid var(--hair2)">
            <div><div class="chip-equipo" style="color:var(--texto)"><i style="background:${esc(e.color)}"></i><b>${esc(e.nombre)}</b></div>
            <div class="muted peq">${e.managerIA ? `Te harás pasar por ${esc(e.managerIA)} (IA)` : 'Mánager de la IA'}${e.grupo ? ` · grupo ${esc(e.grupo)}` : ''}</div></div>
            <button class="btn btn-peq" data-eq="${esc(id)}">Llevar en secreto</button></div>`).join('') : vacio('No hay escuderías de la IA en esta liga.')}</div>`;
        $$('[data-liga]').forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); liga = a.dataset.liga; pintar(); }));
        $$('[data-eq]').forEach(b => b.addEventListener('click', async () => {
            const e = d.equipo(b.dataset.eq);
            if (!await confirmar(`¿Dirigir <b>${esc(e.nombre)}</b> en secreto?`)) return;
            await store().set('secreto/sombra', { uid: u.uid, equipoId: b.dataset.eq, desde: Date.now() });
            await reconstruirCatalogo(store(), d.cfg).catch(() => { });
            limpiarCache();
            toast('Listo. Nadie sabrá que eres tú.');
            setTimeout(() => location.reload(), 700);
        }));
    };
    pintar();
}
