import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAE1PLVdULmXqkscQb9jK8gAkXbjIBETbk",
  authDomain: "fxmanager-c5868.firebaseapp.com",
  projectId: "fxmanager-c5868",
  storageBucket: "fxmanager-c5868.appspot.com",
  messagingSenderId: "652487009924",
  appId: "1:652487009924:web:c976804d6b48c4dda004d1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ELEMENTOS DEL DOM ---
const pilotosBody = document.querySelector("#tabla-clasificacion-pilotos tbody");
const equiposBody = document.querySelector("#tabla-clasificacion-equipos tbody");

// --- INICIALIZACIÓN ---
pilotosBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
equiposBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

// Escuchamos pilotos y equipos en tiempo real
onSnapshot(query(collection(db, "pilotos")), (pilotosSnap) => {
    onSnapshot(query(collection(db, "equipos")), (equiposSnap) => {
        
        const pilotos = pilotosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let equipos = equiposSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 1. Reiniciar puntos de equipos para recalcular
        const equiposMap = new Map(equipos.map(e => [e.id, {...e, puntos: 0}]));

        // 2. Sumar puntos de los pilotos a sus equipos
        pilotos.forEach(piloto => {
            if (piloto.equipo_id && equiposMap.has(piloto.equipo_id)) {
                const equipo = equiposMap.get(piloto.equipo_id);
                equipo.puntos += piloto.puntos || 0;
            }
        });

        // 3. Ordenar ambas listas por puntos
        pilotos.sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
        equipos = Array.from(equiposMap.values()).sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

        // 4. Renderizar las tablas
        renderClasificacionPilotos(pilotos, equiposMap, pilotosBody);
        renderClasificacionEquipos(equipos, equiposBody);

    }, (error) => {
        console.error("Error al cargar equipos: ", error);
        equiposBody.innerHTML = '<tr><td colspan="4" class="error">Error al cargar datos de equipos.</td></tr>';
    });
}, (error) => {
    console.error("Error al cargar pilotos: ", error);
    pilotosBody.innerHTML = '<tr><td colspan="4" class="error">Error al cargar datos de pilotos.</td></tr>';
});


function renderClasificacionPilotos(pilotos, equiposMap, container) {
    container.innerHTML = ''; // Limpiar la tabla
    if (pilotos.length === 0) {
        container.innerHTML = '<tr><td colspan="4">No hay datos de pilotos.</td></tr>';
        return;
    }

    pilotos.forEach((piloto, index) => {
        const equipo = equiposMap.get(piloto.equipo_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="team-color-cell" style="background-color: ${equipo?.color || '#888'};"></td>
            <td>
                <div class="pilot-cell">
                    <div>
                        <strong>${piloto.nombre} ${piloto.apellido}</strong>
                        <small>${equipo?.nombre || 'Sin equipo'}</small>
                    </div>
                </div>
            </td>
            <td class="points">${piloto.puntos || 0}</td>
        `;
        container.appendChild(tr);
    });
}

function renderClasificacionEquipos(equipos, container) {
    container.innerHTML = ''; // Limpiar la tabla
    if (equipos.length === 0) {
        container.innerHTML = '<tr><td colspan="4">No hay datos de equipos.</td></tr>';
        return;
    }

    equipos.forEach((equipo, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="team-color-cell" style="background-color: ${equipo.color || '#888'};"></td>
            <td><strong>${equipo.nombre}</strong></td>
            <td class="points">${equipo.puntos || 0}</td>
        `;
        container.appendChild(tr);
    });
}
