document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');

    if (!hamburgerBtn || !navLinks) return;

    // Accessibility initial state
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

    function toggleMenu() {
        const isOpen = hamburgerBtn.classList.contains('active');
        if (isOpen) closeMenu(); else openMenu();
    }

    hamburgerBtn.addEventListener('click', toggleMenu);

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            closeMenu();
        });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && hamburgerBtn.classList.contains('active')) {
            closeMenu();
        }
    });

    // Close when clicking outside (mobile only)
    document.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;
        if (!navLinks.contains(e.target) && !hamburgerBtn.contains(e.target) && navLinks.classList.contains('active')) {
            closeMenu();
        }
    }, { capture: true });
});
