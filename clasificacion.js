// clasificacion.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
            btnLogin.style.display = "none";
            btnLogout.style.display = "block";

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    if (userData.equipo && userData.equipo !== "") navDashboard.style.display = "inline-block";
                }
            } catch (error) {
                console.error("Error cargando permisos:", error);
            }
        } else {
            btnLogin.style.display = "inline-block";
            btnLogout.style.display = "none";
        }
        
        // Cargar las clasificaciones (público)
        cargarClasificaciones();
    });

    btnLogin.addEventListener("click", () => window.location.href = "login.html");
    btnLogout.addEventListener("click", async () => {
        await signOut(auth);
        window.location.reload();
    });
});

// ==========================================
// 3. DESCARGAR Y RENDERIZAR CLASIFICACIONES
// ==========================================
async function cargarClasificaciones() {
    const listaPilotos = document.getElementById("lista-pilotos");
    const listaEquipos = document.getElementById("lista-equipos");

    try {
        // 1. Obtener Equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        const equiposData = [];
        const equiposMap = {}; // Diccionario para buscar el color/nombre del equipo del piloto rápido

        equiposSnap.forEach(docSnap => {
            const data = docSnap.data();
            const equipo = { id: docSnap.id, ...data, puntos: data.puntos || 0 };
            equiposData.push(equipo);
            equiposMap[docSnap.id] = { nombre: equipo.nombre, color: equipo.color };
        });

        // 2. Obtener Pilotos
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        const pilotosData = [];

        pilotosSnap.forEach(docSnap => {
            const data = docSnap.data();
            pilotosData.push({ id: docSnap.id, ...data, puntos: data.puntos || 0 });
        });

        // 3. Ordenar de mayor a menor puntuación
        equiposData.sort((a, b) => b.puntos - a.puntos);
        pilotosData.sort((a, b) => b.puntos - a.puntos);

        // 4. Pintar Constructores (máximo 20)
        listaEquipos.innerHTML = "";
        const equiposTop20 = equiposData.slice(0, 20);
        equiposTop20.forEach((equipo, index) => {
            const posicion = index + 1;
            const topClass = posicion <= 3 ? "top-3" : "";
            const bordeColor = posicion <= 3 ? equipo.color : "var(--border-color)";

            listaEquipos.innerHTML += `
                <div class="standing-row ${topClass}" style="border-left-color: ${bordeColor};">
                    <div class="pos-number">${posicion}</div>
                    <div class="standing-info">
                        <div class="team-color-bar" style="background-color: ${equipo.color || '#fff'};"></div>
                        <div class="standing-name">
                            <strong>${equipo.nombre}</strong>
                        </div>
                    </div>
                    <div class="standing-pts">${equipo.puntos}</div>
                </div>
            `;
        });

        // 5. Pintar Pilotos (máximo 20)
        listaPilotos.innerHTML = "";
        const pilotosTop20 = pilotosData.slice(0, 20);
        pilotosTop20.forEach((piloto, index) => {
            const posicion = index + 1;
            // Buscar la info del equipo del piloto (si la tiene)
            const infoEquipo = equiposMap[piloto.equipoId] || { nombre: "Agente Libre", color: "#888888" };
            
            const topClass = posicion <= 3 ? "top-3" : "";
            const bordeColor = posicion <= 3 ? infoEquipo.color : "var(--border-color)";

            listaPilotos.innerHTML += `
                <div class="standing-row ${topClass}" style="border-left-color: ${bordeColor};">
                    <div class="pos-number">${posicion}</div>
                    <div class="standing-info">
                        <div class="team-color-bar" style="background-color: ${infoEquipo.color};"></div>
                        <div class="standing-name">
                            <strong>${piloto.nombre} ${piloto.apellido || ''}</strong>
                            <span>${infoEquipo.nombre}</span>
                        </div>
                    </div>
                    <div class="standing-pts">${piloto.puntos}</div>
                </div>
            `;
        });

        if (pilotosData.length === 0) listaPilotos.innerHTML = "<p class='text-muted'>No hay datos de pilotos.</p>";
        if (equiposData.length === 0) listaEquipos.innerHTML = "<p class='text-muted'>No hay datos de equipos.</p>";

    } catch (error) {
        console.error("Error cargando clasificaciones:", error);
        listaPilotos.innerHTML = "<p style='color: var(--danger);'>Error al cargar.</p>";
        listaEquipos.innerHTML = "<p style='color: var(--danger);'>Error al cargar.</p>";
    }
}
