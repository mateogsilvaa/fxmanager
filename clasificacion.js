import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAE1PLVdULmXqkscQb9jK8gAkXbjIBETbk",
  authDomain: "fxmanager-c5868.firebaseapp.com",
  projectId: "fxmanager-c5868",
  storageBucket: "fxmanager-c5868.firebasestorage.app",
  messagingSenderId: "652487009924",
  appId: "1:652487009924:web:c976804d6b48c4dda004d1",
  measurementId: "G-XK03CWHZEK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cargarClasificaciones() {
    const tbodyPilotos = document.getElementById('tabla-pilotos');
    const tbodyEquipos = document.getElementById('tabla-equipos');
    
    tbodyPilotos.innerHTML = "";
    tbodyEquipos.innerHTML = "";

    try {
        // 1. Descargar Equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        let equiposDatos = {}; 
        
        equiposSnap.forEach(doc => {
            let eq = doc.data();
            equiposDatos[doc.id] = {
                nombre: eq.nombre,
                color: eq.color || "#ffffff",
                puntosCalculados: 0 // Empezamos a contar desde 0
            };
        });

        // 2. Descargar Pilotos
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        let pilotosArray = [];

        pilotosSnap.forEach(doc => {
            let p = doc.data();
            p.id = doc.id;
            p.puntos = p.puntos || 0; // Si el piloto es nuevo y no tiene puntos, le ponemos 0
            
            pilotosArray.push(p);

            // Sumamos los puntos del piloto a su equipo
            if(equiposDatos[p.equipo_id]) {
                equiposDatos[p.equipo_id].puntosCalculados += p.puntos;
            }
        });

        // 3. Ordenar Pilotos (de mayor a menor puntuación)
        pilotosArray.sort((a, b) => b.puntos - a.puntos);

        // 4. Pintar Tabla de Pilotos
        pilotosArray.forEach((p, index) => {
            let infoEquipo = equiposDatos[p.equipo_id] || { nombre: "Sin equipo", color: "#fff" };
            
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="posicion">${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <span class="color-bar" style="background-color: ${infoEquipo.color};"></span>
                        <div>
                            <div class="piloto-nombre">${p.apellido} <span style="font-size:12px; font-weight:normal; color:#aaa;">${p.nombre}</span></div>
                            <div class="equipo-nombre">${infoEquipo.nombre}</div>
                        </div>
                    </div>
                </td>
                <td class="puntos">${p.puntos}</td>
            `;
            tbodyPilotos.appendChild(tr);
        });

        // 5. Preparar y Ordenar Equipos
        let equiposArray = Object.keys(equiposDatos).map(key => {
            return { id: key, ...equiposDatos[key] };
        });
        equiposArray.sort((a, b) => b.puntosCalculados - a.puntosCalculados);

        // 6. Pintar Tabla de Constructores
        equiposArray.forEach((eq, index) => {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="posicion">${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <span class="color-bar" style="background-color: ${eq.color};"></span>
                        <div class="piloto-nombre" style="font-size: 14px;">${eq.nombre}</div>
                    </div>
                </td>
                <td class="puntos">${eq.puntosCalculados}</td>
            `;
            tbodyEquipos.appendChild(tr);
        });

    } catch (error) {
        console.error("Error cargando clasificaciones: ", error);
        tbodyPilotos.innerHTML = "<tr><td colspan='3'>Error al conectar con la FIA.</td></tr>";
    }
}

cargarClasificaciones();