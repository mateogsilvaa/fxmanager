// dashboard.js - NUEVO Dashboard completamente rediseñado y funcional
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, doc, getDoc, collection, query, where, getDocs, 
    updateDoc, addDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

let currentUser = null;
let currentTeamId = null;
let currentTeamData = null;
let allPilotos = [];
let allEquipos = [];

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        currentUser = user;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || !userSnap.data().equipo) {
            alert("No tienes equipo asignado");
            window.location.href = "equipos.html";
            return;
        }

        currentTeamId = userSnap.data().equipo;
        await cargarDatos();
        escucharNotificaciones();
    });
});

async function cargarDatos() {
    try {
        // Cargar equipo actual
        const teamRef = doc(db, "equipos", currentTeamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;
        currentTeamData = teamSnap.data();

        // Cargar todos los pilotos
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        allPilotos = [];
        pilotosSnap.forEach(doc => allPilotos.push({ id: doc.id, ...doc.data() }));

        // Cargar todos los equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        allEquipos = [];
        equiposSnap.forEach(doc => allEquipos.push({ id: doc.id, ...doc.data() }));

        renderUI();
        setupListeners();
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function renderUI() {
    // Información del equipo
    document.getElementById("team-name").textContent = currentTeamData.nombre;
    document.getElementById("team-name").style.color = currentTeamData.color;
    document.getElementById("team-budget").textContent = `$${(currentTeamData.presupuesto || 0).toLocaleString()}`;
    document.getElementById("team-points").textContent = currentTeamData.puntos || 0;
    document.getElementById("team-wins").textContent = currentTeamData.victorias || 0;
    document.getElementById("team-championships").textContent = currentTeamData.mundiales || 0;

    // Coche del equipo
    const carDisplay = document.getElementById("team-car-display");
    if (currentTeamData.imagenCoche) {
        carDisplay.innerHTML = `<img src="${currentTeamData.imagenCoche}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    }

    // Pilotos
    const pilotosMiEquipo = allPilotos.filter(p => p.equipoId === currentTeamId);
    const driversContainer = document.getElementById("drivers-container");
    driversContainer.innerHTML = "";

    pilotosMiEquipo.forEach(piloto => {
        const card = document.createElement("div");
        card.className = "driver-card-modern";
        card.innerHTML = `
            <div class="driver-header-modern">
                <div class="driver-photo-modern">
                    ${piloto.foto ? `<img src="${piloto.foto}">` : ''}
                </div>
                <div>
                    <p class="driver-name-modern">${piloto.nombre} <span style="color: ${currentTeamData.color};">${piloto.apellido || ''}</span></p>
                    <p class="driver-number-modern">#${piloto.numero} • ${piloto.pais}</p>
                </div>
            </div>
            <div class="driver-stats-modern">
                <div class="driver-stat-modern">
                    <div class="driver-stat-label">Edad</div>
                    <div class="driver-stat-value">${piloto.edad || '-'}</div>
                </div>
                <div class="driver-stat-modern">
                    <div class="driver-stat-label">Ritmo</div>
                    <div class="driver-stat-value">${piloto.ritmo || 0}</div>
                </div>
                <div class="driver-stat-modern">
                    <div class="driver-stat-label">Agresividad</div>
                    <div class="driver-stat-value">${piloto.agresividad || 0}</div>
                </div>
                <div class="driver-stat-modern">
                    <div class="driver-stat-label">Moral</div>
                    <div class="driver-stat-value">${piloto.moral || 'N/A'}</div>
                </div>
            </div>
        `;
        driversContainer.appendChild(card);
    });

    // Niveles de mejoras
    const aeroLevel = currentTeamData.aeroLevel || 0;
    const motorLevel = currentTeamData.motorLevel || 0;
    document.getElementById("aero-level").textContent = aeroLevel;
    document.getElementById("motor-level").textContent = motorLevel;
    document.getElementById("aero-progress").style.width = (aeroLevel * 20) + "%";
    document.getElementById("motor-progress").style.width = (motorLevel * 20) + "%";

    // Poblar selectores de investigación
    poblarSelectores();
}

function poblarSelectores() {
    // Pilotos rivales
    const pilotosRivales = allPilotos.filter(p => p.equipoId !== currentTeamId);
    const selectPilot = document.getElementById("select-pilot-research");
    selectPilot.innerHTML = '<option value="">-- Seleccionar piloto --</option>';
    pilotosRivales.forEach(p => {
        selectPilot.innerHTML += `<option value="${p.id}">${p.nombre} ${p.apellido || ''} (#${p.numero})</option>`;
    });

    // Equipos rivales para mejoras
    const equiposRivales = allEquipos.filter(e => e.id !== currentTeamId);
    const selectTeamUpgrade = document.getElementById("select-team-upgrade");
    selectTeamUpgrade.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
    equiposRivales.forEach(e => {
        selectTeamUpgrade.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    // Equipos rivales para componentes
    const selectTeamComponent = document.getElementById("select-team-component");
    selectTeamComponent.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
    equiposRivales.forEach(e => {
        selectTeamComponent.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
}

function setupListeners() {
    // Botones de mejoras
    document.getElementById("btn-aero").addEventListener("click", () => solicitarMejora("aerodinámica", 5000000));
    document.getElementById("btn-motor").addEventListener("click", () => solicitarMejora("motor", 7500000));

    // Botones de investigación
    document.getElementById("btn-research-pilot").addEventListener("click", investigarPiloto);
    document.getElementById("btn-research-upgrade").addEventListener("click", investigarMejora);
    document.getElementById("btn-research-component").addEventListener("click", investigarComponente);
}

async function solicitarMejora(tipo, costo) {
    if (currentTeamData.presupuesto < costo) {
        alert("Presupuesto insuficiente");
        return;
    }

    const confirmar = confirm(`¿Invertir $${costo.toLocaleString()} en mejorar ${tipo}?`);
    if (!confirmar) return;

    try {
        // Restar presupuesto
        await updateDoc(doc(db, "equipos", currentTeamId), {
            presupuesto: currentTeamData.presupuesto - costo
        });

        // Crear solicitud al admin
        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Mejora de Componente",
            detalle: `Solicita mejora de ${tipo}. Costo: $${costo.toLocaleString()}`,
            estado: "Pendiente",
            fecha: serverTimestamp()
        });

        alert("Mejora solicitada al Admin. Te notificaremos del resultado.");
        cargarDatos();
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarPiloto() {
    // Verificar límite de investigaciones
    const investigacionesHoy = await contarInvestigacionesHoy();
    if (investigacionesHoy >= 3) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const pilotoId = document.getElementById("select-pilot-research").value;
    if (!pilotoId) {
        alert("Selecciona un piloto");
        return;
    }

    const piloto = allPilotos.find(p => p.id === pilotoId);
    if (!piloto) return;

    try {
        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Investigación",
            detalle: `Investigar piloto: ${piloto.nombre} ${piloto.apellido || ''} - Ritmo: ${piloto.ritmo || 0}, Agresividad: ${piloto.agresividad || 0}`,
            estado: "Info",
            fecha: serverTimestamp()
        });

        // Enviar notificación directa
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `📊 Investigación completada: ${piloto.nombre} tiene ritmo ${piloto.ritmo || 0} y agresividad ${piloto.agresividad || 0}.`,
            fecha: serverTimestamp()
        });

        alert("Investigación completada. Revisa tu bandeja de avisos.");
        document.getElementById("select-pilot-research").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarMejora() {
    // Verificar límite de investigaciones
    const investigacionesHoy = await contarInvestigacionesHoy();
    if (investigacionesHoy >= 3) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const equipoId = document.getElementById("select-team-upgrade").value;
    if (!equipoId) {
        alert("Selecciona un equipo");
        return;
    }

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const ultimaMejora = equipo.ultimaMejora || "Motor";
        
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `⚙️ Última mejora de ${equipo.nombre}: ${ultimaMejora}`,
            fecha: serverTimestamp()
        });

        alert("Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-upgrade").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarComponente() {
    // Verificar límite de investigaciones
    const investigacionesHoy = await contarInvestigacionesHoy();
    if (investigacionesHoy >= 3) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const equipoId = document.getElementById("select-team-component").value;
    const componente = document.getElementById("select-component-type").value;

    if (!equipoId) {
        alert("Selecciona un equipo");
        return;
    }

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const nivelComponente = componente === "aero" ? (equipo.aeroLevel || 0) : (equipo.motorLevel || 0);
        const nombreComponente = componente === "aero" ? "Aerodinámica" : "Motor";
        
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `🔩 Nivel de ${nombreComponente} en ${equipo.nombre}: ${nivelComponente}/5`,
            fecha: serverTimestamp()
        });

        alert("Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-component").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function contarInvestigacionesHoy() {
    try {
        const ahora = new Date();
        const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

        const q = query(
            collection(db, "solicitudes_admin"),
            where("equipoId", "==", currentTeamId),
            where("tipo", "==", "Investigación"),
            where("fecha", ">=", hace24h)
        );

        const snap = await getDocs(q);
        return snap.size;
    } catch (error) {
        console.error("Error contando investigaciones:", error);
        return 0;
    }
}

function escucharNotificaciones() {
    const q = query(collection(db, "notificaciones"), where("equipoId", "==", currentTeamId));
    const notificationsBox = document.getElementById("notifications-box");

    onSnapshot(q, (snapshot) => {
        notificationsBox.innerHTML = "";
        if (snapshot.empty) {
            notificationsBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Sin notificaciones</p>';
            return;
        }

        snapshot.forEach(doc => {
            const notif = doc.data();
            const notifEl = document.createElement("div");
            notifEl.style.cssText = "padding: 12px; border-left: 3px solid var(--accent); background-color: var(--bg-tertiary); margin-bottom: 10px; border-radius: 4px;";
            notifEl.innerHTML = `
                <strong style="color: var(--accent);">${notif.remitente || 'Sistema'}:</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.95rem;">${notif.texto}</p>
            `;
            notificationsBox.appendChild(notifEl);
        });
    });
}
