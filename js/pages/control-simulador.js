// Control → Simulador: ensayos con los datos reales sin tocar nada. Se copia lo necesario a un almacén en memoria y
// ahí se ejecuta el cierre del mercado o el paso a la temporada siguiente, para ver qué pasaría.
import { store, ahora } from '../core/app.js';
import { MemStore } from '../core/memstore.js';
import { esc, vacio, dinero, banderaLiga, toast, $ } from '../core/ui.js';
import { LIGAS_NACIONALES, AREAS } from '../engine/constants.js';
import { crearContexto } from '../jobs/comun.js';
import { cerrarMercado, nuevaTemporada } from '../jobs/temporada.js';

const sinId = ({ id, ...r }) => r;
const nombre = (p) => p ? `${p.nombre} ${p.apellido}` : '—';

// Copia en memoria de las colecciones y documentos indicados
async function copiar({ colecciones, docs, filtros = {} }) {
    const datos = {};
    await Promise.all(colecciones.map(async c => { datos[c] = Object.fromEntries((await store().list(c, filtros[c] || [])).map(d => [d.id, sinId(d)])); }));
    await Promise.all(docs.map(async p => {
        const d = await store().get(p).catch(() => null);
        if (!d) return;
        const [c, id] = p.split('/');
        (datos[c] ||= {})[id] = sinId(d);
    }));
    return new MemStore(datos);
}
async function copiaJuego(cfg) {
    const T = cfg.temporada;
    return copiar({
        colecciones: ['equipos', 'equipos_priv', 'pilotos', 'pilotos_priv', 'managers', 'eventos'],
        filtros: { eventos: [['temporada', '==', T]] },
        docs: ['config/juego', `mercado/T${T}`, `mercado_priv/T${T}`, `resumen/T${T}`, 'secreto/juego', 'secreto/sombra', 'ingenieros/plantilla'],
    });
}
async function contexto(mem) {
    const c = crearContexto(mem, { ahora: ahora(), log: () => { } });
    c.cfg = await mem.get('config/juego');
    c.secreto = (await mem.get('secreto/juego'))?.clave || 'sin-secreto';
    c.temporada = c.cfg.temporada;
    c.sombra = await mem.get('secreto/sombra');
    return c;
}

// Alineaciones antes y después: solo las escuderías que cambian
function cambiosAlineacion(antes, despues, equipos) {
    const de = (lista, eq) => lista.filter(p => p.equipoId === eq).map(p => p.id).sort();
    return Object.entries(equipos).map(([eq, e]) => ({ eq, e, a: de(antes, eq), d: de(despues, eq) }))
        .filter(x => x.a.join() !== x.d.join()).sort((x, y) => x.e.liga.localeCompare(y.e.liga) || x.e.nombre.localeCompare(y.e.nombre));
}

export function pintarSimulador(el, cfg) {
    const T = cfg?.temporada || 1;
    el.innerHTML = `
    <p class="muted" style="max-width:72ch">Ensayos con los datos reales de ahora mismo. Se hace una copia en memoria y se ejecuta ahí: <b>no se guarda nada</b> ni se avisa a nadie. Cada ensayo lee unos cientos de documentos.</p>
    <div class="rejilla rejilla-3" style="margin-bottom:20px">
      <div class="tarjeta"><h3>Cerrar el mercado ahora</h3><p class="muted peq">Qué Galácticos se irían y adónde, cómo se cubrirían las vacantes (agentes libres, rookies) y cómo quedarían las alineaciones.</p>
        <button class="btn" id="sim-mercado">Simular cierre</button></div>
      <div class="tarjeta"><h3>Empezar la temporada ${T + 1}</h3><p class="muted peq">Cierra el mercado (si está abierto) y pasa de temporada: presupuestos según el puesto, reinicio de coches, instalaciones y novedades.</p>
        <label style="margin:8px 0">Cambio de reglamento<select id="sim-reg"><option value="no">No</option><option value="si">Sí</option></select></label>
        <button class="btn" id="sim-temporada">Simular temporada ${T + 1}</button></div>
      <div class="tarjeta"><h3>Vista previa de la temporada 2</h3><p class="muted peq">Una partida de prueba ya avanzada en la temporada 2 con todo lo nuevo: juntas de pilotos, ramas del coche, lesiones, agentes libres, llamadas… Recorre todas las pantallas como mánager. Se abre en otra pestaña y no toca la partida real.</p>
        <a class="btn btn-sec" href="index.html?demo=t2" target="_blank" rel="noopener">Abrir la vista previa</a></div>
    </div>
    <div id="sim-salida"></div>`;
    const salida = $('#sim-salida', el);
    const ocupado = async (btn, fn) => {
        const txt = btn.textContent; btn.disabled = true; btn.textContent = 'Simulando…';
        salida.innerHTML = '<div class="cargando"><span class="spinner"></span>Copiando datos y simulando…</div>';
        try { await fn(); } catch (e) { console.error(e); salida.innerHTML = `<div class="aviso-caja">No se pudo simular: ${esc(e.message || e)}</div>`; toast(e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = txt; }
    };
    $('#sim-mercado', el).addEventListener('click', (e) => ocupado(e.target, async () => {
        const mem = await copiaJuego(cfg);
        const m0 = await mem.get(`mercado/T${T}`);
        if (!m0) throw new Error('Todavía no hay mercado esta temporada (se abre al empezar el Mundial).');
        if (m0.estado === 'cerrado') throw new Error('El mercado ya está cerrado.');
        const antes = await mem.list('pilotos');
        const c = await contexto(mem);
        await cerrarMercado(c);
        salida.innerHTML = await informeMercado(mem, T, antes);
    }));
    $('#sim-temporada', el).addEventListener('click', (e) => ocupado(e.target, async () => {
        const mem = await copiaJuego(cfg);
        const antes = await mem.list('pilotos');
        const privsAntes = Object.fromEntries((await mem.list('equipos_priv')).map(p => [p.id, p]));
        const m0 = await mem.get(`mercado/T${T}`);
        if (m0 && m0.estado !== 'cerrado') await cerrarMercado(await contexto(mem));
        const pal = await nuevaTemporada(mem, { ahora: ahora(), reglamento: $('#sim-reg', el).value });
        salida.innerHTML = (m0 && m0.estado !== 'cerrado' ? await informeMercado(mem, T, antes) : '') + await informeTemporada(mem, privsAntes, pal);
    }));
}

async function informeMercado(mem, T, antes) {
    const m = await mem.get(`mercado/T${T}`);
    const despues = await mem.list('pilotos');
    const porId = Object.fromEntries([...antes, ...despues].map(p => [p.id, p]));
    const equipos = Object.fromEntries((await mem.list('equipos')).map(e => [e.id, e]));
    const eqN = (id) => equipos[id]?.nombre || '—';
    const cambios = cambiosAlineacion(antes, despues, equipos);
    const G = m.galacticos || [];
    const via = { aceptada: 'oferta aceptada', oferta: 'mejor oferta', solicitud: 'solicitud a la liga', ia: 'decide la liga (IA)', suerte: 'por sorpresa' };
    return `<section class="tarjeta" style="margin-bottom:16px"><div class="tarjeta-titulo"><h2>Si el mercado cerrara ahora</h2><span>simulación</span></div>
      <h3>Galácticos</h3>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Liga</th><th>Candidato</th><th>Escudería</th><th>Resultado</th></tr></thead><tbody>
      ${G.map(g => `<tr><td>${banderaLiga(g.liga)}</td><td><b>${esc(g.nombre)}</b> <span class="muted peq">${g.pos}º</span></td><td>${esc(eqN(g.eq))}</td>
        <td>${g.estado === 'vendido' ? `<span class="ok">Se va a <b>${esc(eqN(g.destino.eq))}</b></span> · ${dinero(g.destino.importe)} · ${via[g.destino.via] || ''}${g.destino.nombreTactico ? ` · a cambio llega ${esc(g.destino.nombreTactico)}` : ''}` : `<span class="muted">Se queda${g.estado === 'blindado' ? ' (blindado)' : g.motivo ? ` (${esc(g.motivo)})` : ''}</span>`}</td></tr>`).join('') || `<tr><td colspan="4">${vacio('Sin Galácticos.')}</td></tr>`}
      </tbody></table></div>
      <h3 style="margin-top:18px">Vacantes cubiertas al cierre</h3>
      ${(m.elegidos || []).length ? `<ul class="lista">${m.elegidos.map(x => `<li>${esc(eqN(x.eq))}: <b>${esc(x.nombre)}</b> <span class="insignia ${x.rookie ? 'rookie' : ''}">${x.rookie ? 'rookie' : 'agente libre'}</span></li>`).join('')}</ul>` : vacio('No queda ninguna vacante por cubrir.')}
      <h3 style="margin-top:18px">Así cambian las alineaciones (${cambios.length} escuderías)</h3>
      ${cambios.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Escudería</th><th>Ahora</th><th>Tras el cierre</th></tr></thead><tbody>
        ${cambios.map(x => `<tr><td><span class="con-bandera">${banderaLiga(x.e.liga, { ancho: 14 })}${esc(x.e.nombre)}</span></td><td class="peq">${x.a.map(id => esc(nombre(porId[id]))).join('<br>') || '—'}</td><td class="peq">${x.d.map(id => `${x.a.includes(id) ? '' : '<b class="ok">+ </b>'}${esc(nombre(porId[id]))}`).join('<br>') || '—'}</td></tr>`).join('')}
      </tbody></table></div>` : vacio('Nadie cambia de escudería.')}
    </section>`;
}

async function informeTemporada(mem, privsAntes, pal) {
    const cfg = await mem.get('config/juego');
    const equipos = (await mem.list('equipos')).filter(e => LIGAS_NACIONALES.includes(e.liga));
    const privs = Object.fromEntries((await mem.list('equipos_priv')).map(p => [p.id, p]));
    const coche = (c) => Object.keys(AREAS).map(k => c?.[k] || 0).join('·');
    const filas = equipos.sort((a, b) => a.liga.localeCompare(b.liga) || (privs[b.id]?.presupuesto || 0) - (privs[a.id]?.presupuesto || 0));
    const plantilla = (await mem.get('ingenieros/plantilla'))?.lista;
    return `<section class="tarjeta"><div class="tarjeta-titulo"><h2>Temporada ${cfg.temporada}: así se empezaría</h2><span>simulación</span></div>
      <p class="muted peq">Fase: <b>${esc(cfg.fase)}</b> · inscripción ${cfg.inscripcion ? 'abierta' : 'cerrada'} · ${pal.cambioReglamento ? '<b>con cambio de reglamento</b>' : 'sin cambio de reglamento'} · novedades ${cfg.novedades || cfg.temporada >= 2 ? 'activas' : 'no activas'}${plantilla ? ` · ${Object.keys(plantilla).length} ingenieros` : ''}.</p>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Escudería</th><th class="der">Presupuesto ahora</th><th class="der">Al empezar</th><th class="cen">Coche ahora</th><th class="cen">Al empezar</th><th>Mánager</th></tr></thead><tbody>
      ${filas.map(e => `<tr><td><span class="con-bandera">${banderaLiga(e.liga, { ancho: 14 })}${esc(e.nombre)}</span></td>
        <td class="der num">${dinero(privsAntes[e.id]?.presupuesto || 0)}</td><td class="der num"><b>${dinero(privs[e.id]?.presupuesto || 0)}</b></td>
        <td class="cen mono peq">${coche(privsAntes[e.id]?.coche)}</td><td class="cen mono peq">${coche(privs[e.id]?.coche)}</td>
        <td class="peq">${e.ownerNombre ? esc(e.ownerNombre) : `<span class="muted">${esc(e.managerIA || 'IA')}</span>`}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted peq" style="margin:8px 0 0">Coche: motor · aero · chasis · fiabilidad.</p>
    </section>`;
}
