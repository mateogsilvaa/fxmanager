import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', loadClasificaciones);

async function loadClasificaciones() {
    const pilotosBody = document.querySelector("#tabla-clasificacion-pilotos tbody");
    const equiposBody = document.querySelector("#tabla-clasificacion-equipos tbody");
    pilotosBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    equiposBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    try {
        const [pilotosSnap, equiposSnap] = await Promise.all([
            getDocs(query(collection(db, "pilotos"), orderBy("puntos", "desc"))),
            getDocs(query(collection(db, "equipos"), orderBy("puntos", "desc")))
        ]);

        const pilotos = pilotosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const equipos = equiposSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Crear un mapa de equipos para buscar sus colores fácilmenete
        const equiposMap = new Map(equipos.map(e => [e.id, e]));

        renderClasificacionPilotos(pilotos, equiposMap, pilotosBody);
        renderClasificacionEquipos(equipos, equiposBody);

    } catch (error) {
        console.error("Error al cargar las clasificaciones: ", error);
        pilotosBody.innerHTML = '<tr><td colspan="4" style="color: var(--danger);">Error al cargar datos.</td></tr>';
        equiposBody.innerHTML = '<tr><td colspan="4" style="color: var(--danger);">Error al cargar datos.</td></tr>';
    }
}

function renderClasificacionPilotos(pilotos, equiposMap, container) {
    container.innerHTML = ''; // Limpiar la tabla
    if (pilotos.length === 0) {
        container.innerHTML = '<tr><td colspan="4">No hay datos de pilotos.</td></tr>';
        return;
    }

    pilotos.forEach((piloto, index) => {
        const equipo = equiposMap.get(piloto.equipo_id) || { color: '#ffffff', nombre: 'Sin equipo' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="team-color-cell" style="background-color: ${equipo.color};"></td>
            <td>
                <div class="pilot-cell">
                    <span class="flag">${piloto.bandera || '🏳️'}</span>
                    <div>
                        <strong>${piloto.nombre} ${piloto.apellido}</strong>
                        <small style="color:var(--text-secondary)">${equipo.nombre}</small>
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
            <td class="team-color-cell" style="background-color: ${equipo.color};"></td>
            <td><strong>${equipo.nombre}</strong></td>
            <td class="points">${equipo.puntos || 0}</td>
        `;
        container.appendChild(tr);
    });
}
