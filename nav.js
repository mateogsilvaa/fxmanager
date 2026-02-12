import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const NAV_TEMPLATE = `
    <div class="container main-nav-content">
        <a href="index.html" class="logo">F1Manager</a>
        <div class="nav-links">
            <a href="clasificacion.html">Clasificación</a>
            <a href="calendario.html">Calendario</a>
            <!-- Enlaces dinámicos aquí -->
        </div>
        <div class="nav-auth">
            <!-- Botones de Auth aquí -->
        </div>
    </div>
`;

const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    const navElement = document.querySelector('nav.main-nav');
    if (!navElement) return;

    navElement.innerHTML = NAV_TEMPLATE;
    const navLinksContainer = navElement.querySelector('.nav-links');
    const navAuthContainer = navElement.querySelector('.nav-auth');

    onAuthStateChanged(auth, (user) => {
        // Limpiamos los enlaces específicos de estado
        navLinksContainer.querySelectorAll('.dynamic-link').forEach(el => el.remove());
        navAuthContainer.innerHTML = '';

        if (user) {
            // Usuario Logueado
            const dashboardLink = document.createElement('a');
            dashboardLink.href = 'dashboard.html';
            dashboardLink.textContent = 'Mi Equipo';
            dashboardLink.className = 'dynamic-link';
            navLinksContainer.appendChild(dashboardLink);

            const signOutButton = document.createElement('button');
            signOutButton.className = 'btn btn-secondary';
            signOutButton.textContent = 'Cerrar Sesión';
            signOutButton.onclick = () => signOut(auth).then(() => window.location.href = 'index.html');
            navAuthContainer.appendChild(signOutButton);

        } else {
            // Usuario No Logueado
            const loginButton = document.createElement('a');
            loginButton.href = 'login.html';
            loginButton.className = 'btn btn-secondary';
            loginButton.textContent = 'Login';
            navAuthContainer.appendChild(loginButton);

            const registerButton = document.createElement('a');
            registerButton.href = 'register.html';
            registerButton.className = 'btn btn-primary';
            registerButton.textContent = 'Registro';
            navAuthContainer.appendChild(registerButton);
        }
    });
});
