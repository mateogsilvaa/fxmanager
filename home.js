
document.addEventListener("DOMContentLoaded", () => {
    // --- Lógica del Contador ---
    const proximaCarrera = new Date("2024-08-25T14:00:00Z"); // Fecha de ejemplo, ¡cámbiala!

    const diasEl = document.getElementById("dias");
    const horasEl = document.getElementById("horas");
    const minutosEl = document.getElementById("minutos");
    const segundosEl = document.getElementById("segundos");

    function actualizarContador() {
        const ahora = new Date();
        const diferencia = proximaCarrera - ahora;

        if (diferencia > 0) {
            const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
            const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);

            diasEl.textContent = dias.toString().padStart(2, "0");
            horasEl.textContent = horas.toString().padStart(2, "0");
            minutosEl.textContent = minutos.toString().padStart(2, "0");
            segundosEl.textContent = segundos.toString().padStart(2, "0");
        } else {
            // Cuando la carrera ha comenzado o pasado
            diasEl.textContent = "00";
            horasEl.textContent = "00";
            minutosEl.textContent = "00";
            segundosEl.textContent = "00";
        }
    }

    setInterval(actualizarContador, 1000);
    actualizarContador();

    // --- Lógica del Botón del Dashboard ---
    const equipoDirigido = localStorage.getItem("equipoDirigido"); // Asumimos que guardas el equipo en localStorage
    const dashboardLinkContainer = document.getElementById("dashboard-link-container");

    if (equipoDirigido) {
        const dashboardButton = document.createElement("a");
        dashboardButton.href = "dashboard.html";
        dashboardButton.textContent = "Ir al Dashboard";
        dashboardButton.classList.add("btn");
        dashboardLinkContainer.appendChild(dashboardButton);
    }
});
