import { montar, barraDirecto } from '../core/layout.js';
import { cargarDatos, cargarPaddock, cargarNoticias } from '../core/datos.js';
import { esc, banderaLiga, vacio, hace } from '../core/ui.js';
import { celdaPiloto } from '../core/componentes.js';
import { tiraLigas, bloqueLiga, destacadosMundial, tarjetasDestacados } from '../core/preview-liga.js';
import { LIGAS_NACIONALES, SESION_INFO } from '../engine/constants.js';

const FASES = {
    pretemporada: 'Pretemporada', nacional: 'Ligas nacionales', mundial: 'Liga Intercontinental',
    mercado: 'Mercado de fin de temporada', cerrada: 'Temporada cerrada',
};

const u = await montar({ activo: 'inicio' });
const main = document.getElementById('main');
const [d, paddock, noticias] = await Promise.all([cargarDatos(), cargarPaddock(3), cargarNoticias(120)]);
barraDirecto(d);

const mundial = d.cfg.fase === 'mundial';
const cta = u?.perfil?.equipoId ? `<a class="btn" href="escuderia.html">Mi escudería</a>`
    : u ? `<a class="btn" href="escuderia.html">Elegir escudería</a>`
    : `<a class="btn" href="entrar.html?modo=registro">Crear cuenta</a><a class="btn btn-sec" href="entrar.html">Entrar</a>`;

const ultimas = d.sesiones.filter(s => s.tipo !== 'FP' && (!mundial || s.liga === 'INT')).sort((a, b) => b.t - a.t).slice(0, 5);
const managers = d.rankingManagers().slice(0, 5);

const hero = `<section class="hero">
  <div class="etiqueta">${esc(FASES[d.cfg.fase] || '')} · Temporada ${d.temporada}</div>
  <h1>${mundial ? 'El Mundial' : 'Hyper Race X1'}</h1>
  <p>${mundial
      ? `Los 20 mejores pilotos de las cinco ligas se juegan el título en ${esc(d.cfg.mundial?.nombre || 'la sede del Mundial')}. Cada punto vale el triple en premios.`
      : 'Cinco ligas nacionales, cien pilotos y veinte plazas para el Mundial. Dirige una escudería y pelea por ellas.'}</p>
  <div class="fila">${cta}</div>
</section>`;

const resultados = `<section class="tarjeta"><div class="tarjeta-titulo"><h2>Últimos resultados</h2></div>
  ${ultimas.length ? `<div class="tabla-scroll"><table class="tabla"><tbody>${ultimas.map(s => `<tr>
    <td style="width:1%">${banderaLiga(s.liga)}</td><td><a href="sesion.html?id=${esc(s.sid)}">${esc(SESION_INFO[s.tipo].nombre)}</a><div class="muted peq">${esc(d.evento(s.ev)?.circuito?.nombre || '')}</div></td>
    <td>${celdaPiloto(d, s.filas[0]?.pid)}</td><td class="der muted peq">${hace(s.t)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no se ha disputado ninguna sesión.')}
</section>`;

if (mundial) {
    const destacados = destacadosMundial(d, 6);
    main.innerHTML = `${hero}
    ${bloqueLiga(d, 'INT', noticias)}
    <section class="portada-seccion">
      <div class="tarjeta-titulo"><h2>Pilotos a seguir</h2><span>${(d.cfg.mundial?.participantes || []).length} en parrilla</span></div>
      <p class="portada-intro">Quiénes llegan más fuertes al Mundial y por qué.</p>
      ${destacados.length ? tarjetasDestacados(d, destacados) : vacio('La parrilla del Mundial todavía no está cerrada.')}
    </section>
    <div class="portada-seccion">${resultados}</div>`;
} else {
    main.innerHTML = `${hero}
    <section class="portada-seccion carrusel" aria-roledescription="carrusel" aria-label="Las cinco ligas">
      <div class="tarjeta-titulo"><h2>Las cinco ligas</h2><span class="solo-escritorio">Cuenta atrás para la próxima sesión</span></div>
      ${tiraLigas(d, { carrusel: true })}
      <div class="carrusel-pista">${LIGAS_NACIONALES.map((l, i) => `<div class="carrusel-diapo" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${LIGAS_NACIONALES.length}">${bloqueLiga(d, l, noticias)}</div>`).join('')}</div>
      <div class="carrusel-ctrl">
        <button class="carrusel-btn" data-mover="-1" aria-label="Liga anterior">←</button>
        <span class="carrusel-n mono"></span>
        <button class="carrusel-btn" data-mover="1" aria-label="Liga siguiente">→</button>
      </div>
    </section>
    <div class="rejilla rejilla-lado portada-seccion">
      <div class="pila">${resultados}</div>
      <aside class="pila">
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Paddock</h2><a class="muted peq" href="paddock.html">Ver todo</a></div>
          ${paddock.length ? paddock.map(x => `<div class="declaracion"><div class="meta">${banderaLiga(x.liga, { ancho: 14 })} <b style="color:var(--texto)">${esc(x.nombre)}</b> · ${hace(x.fecha)}</div><p>${esc(x.texto)}</p></div>`).join('') : vacio('Los mánagers todavía no han hablado.')}
        </section>
        <section class="tarjeta"><div class="tarjeta-titulo"><h2>Mejores mánagers</h2><a class="muted peq" href="paddock.html">Ranking</a></div>
          ${managers.length ? managers.map((m, i) => `<div class="ranking-fila"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(m.nombre)} <span class="muted peq">${esc(d.nombreEquipo(m.eq))}</span></span><span class="v">${m.indice}</span><div class="barra"><div class="barra-relleno" style="width:${Math.min(100, m.indice / Math.max(...managers.map(x => x.indice)) * 100)}%"></div></div></div>`).join('') : vacio('Aún no hay mánagers.')}
        </section>
      </aside>
    </div>`;
}

// ---------- Carrusel de ligas ----------
function carrusel(raiz) {
    if (!raiz) return;
    const pista = raiz.querySelector('.carrusel-pista');
    const diapos = [...pista.children];
    const tiles = [...raiz.querySelectorAll('[data-slide]')];
    const n = diapos.length;
    const INTERVALO = 9000;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let actual = 0, timer = null, pausa = false;
    const marcar = () => {
        tiles.forEach((t, k) => { t.classList.toggle('activa', k === actual); t.setAttribute('aria-selected', k === actual); });
        raiz.querySelector('.carrusel-n').textContent = `${actual + 1} / ${n}`;
        // reinicia la barra de progreso de la liga activa
        raiz.style.setProperty('--dur', `${INTERVALO}ms`);
        raiz.classList.remove('corriendo'); void raiz.offsetWidth;
        if (!pausa && !reducido) raiz.classList.add('corriendo');
    };
    const ir = (k, suave = true) => {
        actual = (k + n) % n;
        pista.scrollTo({ left: diapos[actual].offsetLeft - pista.offsetLeft, behavior: suave && !reducido ? 'smooth' : 'auto' });
        marcar(); programar();
    };
    const programar = () => { clearTimeout(timer); if (!pausa && !reducido) timer = setTimeout(() => ir(actual + 1), INTERVALO); };
    const pausar = (p) => { pausa = p; raiz.classList.toggle('en-pausa', p); marcar(); programar(); };
    tiles.forEach(t => t.addEventListener('click', (e) => { e.preventDefault(); ir(+t.dataset.slide); }));
    raiz.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => ir(actual + +b.dataset.mover)));
    // al deslizar con el dedo, la diapositiva visible pasa a ser la actual
    let fin = null;
    pista.addEventListener('scroll', () => {
        clearTimeout(fin);
        fin = setTimeout(() => {
            const x = pista.scrollLeft + pista.offsetLeft;
            const k = diapos.reduce((mejor, dd, j) => Math.abs(dd.offsetLeft - x) < Math.abs(diapos[mejor].offsetLeft - x) ? j : mejor, 0);
            if (k !== actual) { actual = k; marcar(); programar(); }
        }, 120);
    }, { passive: true });
    raiz.addEventListener('mouseenter', () => pausar(true));
    raiz.addEventListener('mouseleave', () => pausar(false));
    raiz.addEventListener('focusin', () => pausar(true));
    raiz.addEventListener('focusout', (e) => { if (!raiz.contains(e.relatedTarget)) pausar(false); });
    pista.addEventListener('touchstart', () => pausar(true), { passive: true });
    document.addEventListener('visibilitychange', () => pausar(document.hidden));
    raiz.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') ir(actual + 1); if (e.key === 'ArrowLeft') ir(actual - 1); });
    marcar(); programar();
}
carrusel(document.querySelector('.carrusel'));
