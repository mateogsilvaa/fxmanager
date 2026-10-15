// Landing pública: qué es FX Manager y cómo empezar (crear una liga con amigos o unirse con un código)
import { montar } from '../core/layout.js';
import { usuario, esMiembroOriginal, PARTIDA } from '../core/app.js';
import { avatar } from '../core/avatar.js';

const u = await montar({ activo: 'descubre' });
const main = document.getElementById('main');
const ir = u ? 'partidas.html' : 'entrar.html?modo=registro&volver=partidas.html';
const caras = ['piloto', 'ingeniero', 'manager', 'patrocinador', 'periodista', 'fia', 'aficionado'].map((t, i) =>
    avatar({ tipo: t, semilla: `landing${i}`, color: ['#e63946', '#2a9d8f', '#4361ee', null, null, null, '#f4a261'][i], tam: 72 })).join('');

const funcion = (titulo, texto) => `<div class="landing-f"><h3>${titulo}</h3><p>${texto}</p></div>`;
main.innerHTML = `
<section class="landing-hero">
  <div class="etiqueta">FX Manager · Hyper Race X1</div>
  <h1>Tu campeonato de motor,<br>con tus amigos.</h1>
  <p>Monta una liga privada, elige escudería y compite: tú decides el coche, la estrategia, los fichajes y la pelea en los despachos. Las carreras se simulan solas y se publican a su hora, con directo. Tú solo tienes que entrar cada día y tomar decisiones.</p>
  <div class="fila"><a class="btn" href="${ir}">${u ? 'Crear o unirme a una liga' : 'Crear cuenta gratis'}</a><a class="btn btn-sec" href="index.html?demo=1">Probar la demo</a></div>
  <div class="landing-caras" aria-hidden="true">${caras}</div>
</section>

<section class="landing-pasos">
  <div><b>1</b><h3>Crea tu liga</h3><p>Pon nombre y elige cuántas ligas nacionales queréis (de una a cinco), si hay Mundial al final, cada cuántos días hay jornada y a qué hora se corre.</p></div>
  <div><b>2</b><h3>Invita a tus amigos</h3><p>Comparte el enlace o el código. Cada uno elige una escudería; las que nadie coge las lleva la IA, que también compite (y negocia, y ficha…).</p></div>
  <div><b>3</b><h3>A jugar</h3><p>Cada jornada tiene libres, dos clasificaciones y tres carreras. Entre jornada y jornada: mejoras, reglajes, simulador, prensa, llamadas, mercado…</p></div>
</section>

<section class="landing-funciones">
  <div class="tarjeta-titulo"><h2>Qué se hace en FX Manager</h2></div>
  <div class="landing-grid">
    ${funcion('Desarrollo del coche', 'Motor, aerodinámica, chasis y fiabilidad, con un árbol de ramas: dos coches con el mismo nivel pueden comportarse de forma muy distinta.')}
    ${funcion('Estrategia de carrera', 'Reglaje, ritmo, actitud y neumáticos. La lectura de los libres y el simulador te dicen qué funciona en cada circuito.')}
    ${funcion('Pilotos e ingenieros', 'Entrena a tus pilotos, ficha ingenieros, cuida la moral… y prepárate para lesiones, retiradas y despidos.')}
    ${funcion('Mercado', 'Galácticos que cambian de liga, pujas, agentes libres, trueques y negociaciones con otras escuderías (humanas o de la IA).')}
    ${funcion('Política', 'Juntas de pilotos que votan el reglamento, sanciones, la FIA metiéndose en medio y rivales que llaman pidiendo tu voto.')}
    ${funcion('Historia', 'Temporadas que se encadenan, palmarés, récords, rating de mánager y una prensa que no perdona.')}
  </div>
</section>

<section class="landing-final">
  <h2>¿Te han pasado un código?</h2>
  <p>Entra con tu cuenta (o créala en un minuto) y pega el código en «Mis partidas».</p>
  <div class="fila"><a class="btn" href="${u ? 'partidas.html' : 'entrar.html'}">${u ? 'Ir a mis partidas' : 'Entrar'}</a>${u && esMiembroOriginal() && PARTIDA === '' ? '<a class="btn btn-sec" href="index.html">Volver a mi liga</a>' : ''}</div>
</section>`;
void usuario;
