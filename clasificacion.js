
document.addEventListener("DOMContentLoaded", () => {
    const tablaBody = document.querySelector("#tabla-clasificacion tbody");

    // Datos de ejemplo de la clasificación (¡reemplazar con datos reales!)
    const clasificacion = [
        { pos: 1, piloto: "Max Verstappen", equipo: "Red Bull Racing", puntos: 265 },
        { pos: 2, piloto: "Lando Norris", equipo: "McLaren", puntos: 189 },
        { pos: 3, piloto: "Charles Leclerc", equipo: "Ferrari", puntos: 162 },
        { pos: 4, piloto: "Oscar Piastri", equipo: "McLaren", puntos: 149 },
        { pos: 5, piloto: "Carlos Sainz", equipo: "Ferrari", puntos: 146 },
        { pos: 6, piloto: "Lewis Hamilton", equipo: "Mercedes", puntos: 125 },
        { pos: 7, piloto: "Sergio Pérez", equipo: "Red Bull Racing", puntos: 124 },
        { pos: 8, piloto: "George Russell", equipo: "Mercedes", puntos: 111 },
        // ... (y así sucesivamente)
    ];

    function renderClasificacion() {
        tablaBody.innerHTML = ""; // Limpiar la tabla
        clasificacion.forEach(item => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${item.pos}</td>
                <td>${item.piloto}</td>
                <td>${item.equipo}</td>
                <td>${item.puntos}</td>
            `;

            // Aquí añadiremos la lógica para mostrar más estadísticas al hacer clic
            fila.addEventListener("click", () => {
                // Próximamente: Mostrar un modal o una sección con estadísticas detalladas
                alert(`Mostrando estadísticas de ${item.piloto}...`);
            });

            tablaBody.appendChild(fila);
        });
    }

    renderClasificacion();
});
