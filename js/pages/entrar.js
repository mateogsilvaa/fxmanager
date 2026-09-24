import { montar } from '../core/layout.js';
import { entrar, registrar, recuperar, usuario } from '../core/app.js';
import { $, toast, esc } from '../core/ui.js';

await montar();
const main = document.getElementById('main');
if (usuario()) { location.href = 'escuderia.html'; }
const modo = new URLSearchParams(location.search).get('modo') === 'registro' ? 'registro' : 'entrar';

main.innerHTML = `<div class="caja-auth tarjeta">
  <div class="pestanas"><button data-m="entrar">Entrar</button><button data-m="registro">Crear cuenta</button></div>
  <form id="f-entrar"><label>Email<input type="email" name="email" required autocomplete="email"></label><label>Contraseña<input type="password" name="pass" required autocomplete="current-password"></label><button class="btn">Entrar</button><button type="button" class="btn btn-sec btn-peq" id="olvido">He olvidado mi contraseña</button></form>
  <form id="f-registro" hidden><label>Tu nombre (se verá en las clasificaciones)<input name="nombre" required maxlength="24"></label><label>Email<input type="email" name="email" required autocomplete="email"></label><label>Contraseña (mínimo 6 caracteres)<input type="password" name="pass" required minlength="6" autocomplete="new-password"></label><p class="muted peq" style="margin:0">La organización revisará tu cuenta antes de que puedas elegir escudería.</p><button class="btn">Crear cuenta</button></form>
  <p class="muted" id="msg" style="margin-top:12px;font-size:.9rem"></p>
</div>`;

const cambiar = (m) => {
    main.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('activa', b.dataset.m === m));
    $('#f-entrar').hidden = m !== 'entrar';
    $('#f-registro').hidden = m !== 'registro';
};
main.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => cambiar(b.dataset.m)));
cambiar(modo);

const errores = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.', 'auth/wrong-password': 'Email o contraseña incorrectos.', 'auth/user-not-found': 'Email o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ese email ya tiene cuenta.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-email': 'Email no válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un poco.',
};
const mostrarError = (e) => { $('#msg').innerHTML = `<span class="mal">${esc(errores[e.code] || 'Ha ocurrido un error. Inténtalo de nuevo.')}</span>`; };

$('#f-entrar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await entrar(f.get('email'), f.get('pass')); location.href = 'escuderia.html'; } catch (err) { mostrarError(err); }
});
$('#f-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await registrar(f.get('nombre').trim(), f.get('email'), f.get('pass')); location.href = 'escuderia.html'; } catch (err) { mostrarError(err); }
});
$('#olvido').addEventListener('click', async () => {
    const email = $('#f-entrar [name=email]').value;
    if (!email) return toast('Escribe tu email arriba', 'error');
    try { await recuperar(email); toast('Te hemos enviado un correo para cambiar la contraseña'); } catch (err) { mostrarError(err); }
});
