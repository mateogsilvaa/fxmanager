
document.addEventListener("DOMContentLoaded", () => {
    const equiposContainer = document.getElementById("grid-equipos");
    const temporadaAbierta = true; // Cambiar a 'false' cuando la temporada esté cerrada
    let equipoDirigido = localStorage.getItem("equipoDirigido");

    // Datos de ejemplo (¡reemplázalos con tu fuente de datos!)
    const equipos = [
        {
            nombre: "Mercedes-AMG Petronas",
            coche_img: "https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/team%20logos/mercedes.png",
            color: "#6CD3BF",
            pilotos: [
                { nombre: "Lewis", apellido: "Hamilton", foto: "https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png", numero: 44, pais: "GB" },
                { nombre: "George", apellido: "Russell", foto: "https://www.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png", numero: 63, pais: "GB" },
            ],
        },
        {
            nombre: "Oracle Red Bull Racing",
            coche_img: "https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/team%20logos/red%20bull.png",
            color: "#1E5BC6",
            pilotos: [
                { nombre: "Max", apellido: "Verstappen", foto: "https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png", numero: 1, pais: "NL" },
                { nombre: "Sergio", apellido: "Pérez", foto: "https://www.formula1.com/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/1col/image.png", numero: 11, pais: "MX" },
            ],
        },
        // ... (Agrega los 8 equipos restantes aquí)
    ];

    function renderEquipos() {
        equiposContainer.innerHTML = ""; // Limpiar antes de renderizar
        equipos.forEach(equipo => {
            const equipoCard = document.createElement("div");
            equipoCard.classList.add("equipo-card");

            const equipoHeader = document.createElement("div");
            equipoHeader.classList.add("equipo-header");
            equipoHeader.style.backgroundImage = `url(${equipo.coche_img})`;
            equipoHeader.innerHTML = `<h3>${equipo.nombre}</h3>`;
            equipoHeader.addEventListener("click", () => {
                const dropdown = equipoCard.querySelector(".pilotos-dropdown");
                dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
            });

            const equipoInfo = document.createElement("div");
            equipoInfo.classList.add("equipo-info");
            
            // Botón para unirse
            if (temporadaAbierta) {
                const joinButton = document.createElement("button");
                joinButton.classList.add("btn");
                
                if (equipoDirigido && equipoDirigido === equipo.nombre) {
                    joinButton.textContent = "Dirigiendo Equipo";
                    joinButton.disabled = true;
                } else if (equipoDirigido && equipoDirigido !== equipo.nombre) {
                    joinButton.textContent = "No disponible";
                    joinButton.disabled = true;
                    joinButton.classList.add("btn-secondary");
                } else {
                    joinButton.textContent = "Unirse al Equipo";
                    joinButton.dataset.equipo = equipo.nombre;
                    joinButton.addEventListener("click", handleJoinTeam);
                }
                equipoInfo.appendChild(joinButton);
            }

            const pilotosDropdown = document.createElement("div");
            pilotosDropdown.classList.add("pilotos-dropdown");
            equipo.pilotos.forEach(piloto => {
                pilotosDropdown.innerHTML += `
                    <div class="piloto">
                        <img src="${piloto.foto}" alt="${piloto.nombre} ${piloto.apellido}">
                        <div class="piloto-info">
                            <span class="piloto-nombre" style="color: ${equipo.color};">${piloto.nombre} ${piloto.apellido}</span>
                            <span class="piloto-numero">#${piloto.numero}</span>
                            <span class="piloto-pais">${piloto.pais}</span>
                        </div>
                    </div>
                `;
            });

            equipoCard.appendChild(equipoHeader);
            equipoCard.appendChild(equipoInfo);
            equipoCard.appendChild(pilotosDropdown);
            equiposContainer.appendChild(equipoCard);
        });
    }

    function handleJoinTeam(event) {
        const equipoSeleccionado = event.target.dataset.equipo;
        if (!equipoDirigido) {
            localStorage.setItem("equipoDirigido", equipoSeleccionado);
            equipoDirigido = equipoSeleccionado;
            alert(`¡Te has unido a ${equipoSeleccionado}! Ahora puedes acceder al dashboard desde la página de inicio.`);
            renderEquipos(); // Volver a renderizar para actualizar los botones
        }
    }

    renderEquipos();
});
