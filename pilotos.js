
document.addEventListener("DOMContentLoaded", () => {
    const pilotosContainer = document.getElementById("grid-pilotos");

    // Datos de ejemplo (los mismos que en equipos.js)
    const equipos = [
        {
            nombre: "Mercedes-AMG Petronas",
            color: "#6CD3BF",
            pilotos: [
                { nombre: "Lewis", apellido: "Hamilton", foto: "https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png", numero: 44, pais: "GB" },
                { nombre: "George", apellido: "Russell", foto: "https://www.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png", numero: 63, pais: "GB" },
            ],
        },
        {
            nombre: "Oracle Red Bull Racing",
            color: "#1E5BC6",
            pilotos: [
                { nombre: "Max", apellido: "Verstappen", foto: "https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png", numero: 1, pais: "NL" },
                { nombre: "Sergio", apellido: "Pérez", foto: "https://www.formula1.com/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/1col/image.png", numero: 11, pais: "MX" },
            ],
        },
        // ... (Agrega los 8 equipos restantes aquí)
    ];

    // Extraer todos los pilotos en una sola lista
    const todosLosPilotos = equipos.flatMap(equipo => 
        equipo.pilotos.map(piloto => ({ ...piloto, colorEquipo: equipo.color }))
    );

    function renderPilotos() {
        pilotosContainer.innerHTML = ""; // Limpiar
        todosLosPilotos.forEach(piloto => {
            const pilotoCard = document.createElement("div");
            pilotoCard.classList.add("equipo-card"); // Reutilizamos el estilo

            pilotoCard.innerHTML = `
                <div class="piloto" style="padding: 16px;">
                    <img src="${piloto.foto}" alt="${piloto.nombre} ${piloto.apellido}">
                    <div class="piloto-info">
                        <span class="piloto-nombre" style="color: ${piloto.colorEquipo};">${piloto.nombre} ${piloto.apellido}</span>
                        <span class="piloto-numero">#${piloto.numero}</span>
                        <span class="piloto-pais">${piloto.pais}</span>
                    </div>
                </div>
            `;
            pilotosContainer.appendChild(pilotoCard);
        });
    }

    renderPilotos();
});
