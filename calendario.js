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

async function cargarCalendario() {
    const contenedor = document.getElementById('contenedor-carreras');
    contenedor.innerHTML = "";

    try {
        const carrerasSnap = await getDocs(collection(db, "carreras"));
        let carrerasArray = [];

        carrerasSnap.forEach(doc => {
            carrerasArray.push(doc.data());
        });

        // Ordenamos las carreras por la ronda (1, 2, 3...)
        carrerasArray.sort((a, b) => a.orden - b.orden);

        carrerasArray.forEach((carrera) => {
            const card = document.createElement('div');
            card.className = 'carrera-card';
            
            // Lógica visual dependiendo del estado
            let colorBorde = "#555";
            let badgeClase = "badge-pendiente";
            let badgeTexto = "PRÓXIMAMENTE";
            let infoExtra = `<p style="color: #666; font-size: 13px; margin: 0;">Pendiente de simulación</p>`;

            if (carrera.estado === "completada") {
                colorBorde = "#00C851"; // Verde F1
                badgeClase = "badge-completada";
                badgeTexto = "RESULTADOS FINALES";
                // Mostramos el podio si lo hay
                infoExtra = `<p class="podio-texto">${carrera.podio || "Resultados no disponibles"}</p>`;
            }

            card.style.borderLeftColor = colorBorde;

            card.innerHTML = `
                <div class="carrera-info">
                    <div class="ronda">R${carrera.orden}</div>
                    <div class="bandera">${carrera.bandera}</div>
                    <div class="detalles">
                        <h2>${carrera.nombre_gp}</h2>
                        <p>${carrera.circuito} | ${carrera.fecha}</p>
                    </div>
                </div>
                <div class="estado-box">
                    <span class="estado-badge ${badgeClase}">${badgeTexto}</span>
                    ${infoExtra}
                </div>
            `;
            
            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando el calendario: ", error);
        contenedor.innerHTML = "<p>Error al conectar con la FIA.</p>";
    }
}

cargarCalendario();