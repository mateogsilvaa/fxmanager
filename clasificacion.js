// Clasificacion.js
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
        
        // Cargar las clasificaciones (público)
        cargarClasificaciones();
    });

    if (btnLogin) btnLogin.addEventListener("click", () => window.location.href = "login.html");
    if (btnLogout) btnLogout.addEventListener("click", async () => {
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
        const equiposMap = {}; 

        equiposSnap.forEach(docSnap => {
            const data = docSnap.data();
            const equipo = { id: docSnap.id, ...data, puntos: data.puntos || 0 };
            equiposData.push(equipo);
            equiposMap[docSnap.id] = { nombre: equipo.nombre, color: equipo.color || "#8a8b98" };
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

        // ==========================================
        // 4. TABLA DE PILOTOS
        // ==========================================
        let htmlTablaPilotos = `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; margin-top: 15px;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background: rgba(255, 255, 255, 0.05);">
                        <th style="text-align:center; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; width:50px;">Pos</th>
                        <th style="text-align:left; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px;">Piloto</th>
                        <th style="text-align:right; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; width:80px;">Pts</th>
                    </tr>
                </thead>
                <tbody>`;

        const pilotosTop20 = pilotosData.slice(0, 20);

        pilotosTop20.forEach((piloto, index) => {
            const posicion = index + 1;
            const infoEquipo = equiposMap[piloto.equipoId] || { nombre: "Agente Libre", color: "#8a8b98" };
            
            let firstName = "";
            let lastName = "";
            
            if (piloto.apellido && piloto.apellido.trim() !== "") {
                firstName = piloto.nombre;
                lastName = piloto.apellido;
            } else {
                const nameParts = piloto.nombre.trim().split(' ');
                lastName = nameParts.length > 1 ? nameParts.pop() : piloto.nombre;
                firstName = nameParts.length > 0 ? nameParts.join(' ') : '';
            }

            htmlTablaPilotos += `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:15px; text-align:center; vertical-align:middle; font-weight:800; font-size:1.1rem; color:#ffffff;">${posicion}</td>
                    <td style="padding:15px; vertical-align:middle;">
                        <div style="display:flex; flex-direction:column; justify-content:center;">
                            <div style="font-size:1.05rem; letter-spacing:0.5px; line-height:1.2;">
                                <span style="color:#ffffff; font-weight:400;">${firstName}</span> 
                                <span style="color:${infoEquipo.color}; font-weight:800; text-transform:uppercase;">${lastName}</span>
                            </div>
                            <div style="color:#8a8b98; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; margin-top:2px; font-weight:600;">
                                ${infoEquipo.nombre}
                            </div>
                        </div>
                    </td>
                    <td style="padding:15px; vertical-align:middle; text-align:right; font-size:1.1rem; font-weight:700; color:#ffffff;">${piloto.puntos}</td>
                </tr>`;
        });

        htmlTablaPilotos += `</tbody></table></div>`;
        listaPilotos.innerHTML = htmlTablaPilotos;


        // ==========================================
        // 5. TABLA DE CONSTRUCTORES (EQUIPOS)
        // ==========================================
        let htmlTablaEquipos = `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; margin-top: 15px;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background: rgba(255, 255, 255, 0.05);">
                        <th style="text-align:center; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; width:50px;">Pos</th>
                        <th style="text-align:left; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px;">Equipo</th>
                        <th style="text-align:right; color:#8a8b98; padding:12px 15px; border-bottom:2px solid rgba(255, 255, 255, 0.1); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; width:80px;">Pts</th>
                    </tr>
                </thead>
                <tbody>`;

        const equiposTop20 = equiposData.slice(0, 20);

        equiposTop20.forEach((equipo, index) => {
            const posicion = index + 1;

            htmlTablaEquipos += `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:15px; text-align:center; vertical-align:middle; font-weight:800; font-size:1.1rem; color:#ffffff;">${posicion}</td>
                    <td style="padding:15px; vertical-align:middle;">
                        <span style="color:${equipo.color || '#ffffff'}; font-weight:800; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.5px;">
                            ${equipo.nombre}
                        </span>
                    </td>
                    <td style="padding:15px; vertical-align:middle; text-align:right; font-size:1.1rem; font-weight:700; color:#ffffff;">${equipo.puntos}</td>
                </tr>`;
        });

        htmlTablaEquipos += `</tbody></table></div>`;
        listaEquipos.innerHTML = htmlTablaEquipos;

        if (pilotosData.length === 0) listaPilotos.innerHTML = "<p class='text-muted'>No hay datos de pilotos.</p>";
        if (equiposData.length === 0) listaEquipos.innerHTML = "<p class='text-muted'>No hay datos de equipos.</p>";

    } catch (error) {
        console.error("Error cargando clasificaciones:", error);
        listaPilotos.innerHTML = "<p style='color: #ff4444;'>Error al cargar los datos.</p>";
        listaEquipos.innerHTML = "<p style='color: #ff4444;'>Error al cargar los datos.</p>";
    }
}