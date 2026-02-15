// calendario.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 1. CONFIGURACIÓN FIREBASE
// ==========================================
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
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 2. GESTIÓN DEL MENÚ SUPERIOR
    // ==========================================
    const navDashboard = document.getElementById("nav-dashboard");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (btnLogin) btnLogin.style.display = "none";
            if (btnLogout) btnLogout.style.display = "block";

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    if (userData.equipo && userData.equipo !== "" && navDashboard) navDashboard.style.display = "inline-block";
                }
            } catch (error) {
                console.error("Error cargando permisos:", error);
            }
        } else {
            if (btnLogin) btnLogin.style.display = "inline-block";
            if (btnLogout) btnLogout.style.display = "none";
        }
        
        // Cargamos las carreras sin importar si hay usuario o no (es público)
        cargarCalendario();
    });

    if (btnLogin) btnLogin.addEventListener("click", () => window.location.href = "login.html");
    if (btnLogout) btnLogout.addEventListener("click", async () => {
        await signOut(auth);
        window.location.reload();
    });
});

// ==========================================
// 3. OBTENER Y RENDERIZAR CARRERAS
// ==========================================
async function cargarCalendario() {
    const gridCalendario = document.getElementById("grid-calendario");
    
    try {
        // Pedimos a Firestore las carreras ordenadas por el campo "ronda" (1, 2, 3...)
        const carrerasRef = collection(db, "carreras");
        const q = query(carrerasRef, orderBy("ronda", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            gridCalendario.innerHTML = "<p style='text-align:center; color: var(--text-secondary);'>Aún no hay carreras programadas en el calendario.</p>";
            return;
        }

        gridCalendario.innerHTML = ""; // Limpiar mensaje de carga

        snapshot.forEach(docSnap => {
            const carrera = docSnap.data();
            
            // Verificamos si la carrera está completada (asegúrate de tener este campo en tu BD)
            const isCompletada = carrera.completada === true;
            const statusClass = isCompletada ? "status-completed" : "status-pending";
            const statusText = isCompletada ? "Completada" : "Pendiente";

            // Crear el HTML de la tarjeta
            const card = document.createElement("div");
            card.className = "race-card";
            card.innerHTML = `
                <div class="race-info">
                    <div class="race-round">R${carrera.ronda || '0'}</div>
                    <div class="race-details">
                        <h2>${carrera.nombre || 'Gran Premio Desconocido'}</h2>
                        <p>${carrera.circuito || 'Circuito por definir'} | ${carrera.fecha || 'Fecha por definir'}</p>
                    </div>
                </div>
                <div class="race-status ${statusClass}">
                    ${statusText}
                </div>
            `;

            gridCalendario.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando el calendario:", error);
        gridCalendario.innerHTML = "<p style='text-align:center; color: var(--danger);'>Hubo un error al cargar el calendario.</p>";
    }
}