// nav.js
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');

    if (!hamburgerBtn || !navLinks) return;

    // Accesibilidad: Estado inicial
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    navLinks.setAttribute('aria-hidden', 'true');

    function closeMenu() {
        hamburgerBtn.classList.remove('active');
        navLinks.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        navLinks.setAttribute('aria-hidden', 'true');
    }

    function openMenu() {
        hamburgerBtn.classList.add('active');
        navLinks.classList.add('active');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        navLinks.setAttribute('aria-hidden', 'false');
    }

    function toggleMenu(event) {
        // Evita que el clic en el botón se propague al document y cierre el menú al instante
        event.stopPropagation(); 
        
        const isOpen = hamburgerBtn.classList.contains('active');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // evento para abrir/cerrar desde el botón
    hamburgerBtn.addEventListener('click', toggleMenu);

    // Cierra el menú cuando se hace clic en un enlace
    navLinks.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            closeMenu();
        }
    });

    // Cierra el menú al hacer clic en cualquier parte fuera de él
    document.addEventListener('click', (event) => {
        const isOpen = hamburgerBtn.classList.contains('active');
        // Solo ejecuta el cierre si está abierto y el clic no fue dentro del menú
        if (isOpen && !navLinks.contains(event.target) && !hamburgerBtn.contains(event.target)) {
            closeMenu();
        }
    });
});