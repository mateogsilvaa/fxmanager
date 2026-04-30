// Equipos.js - Renderiza la página de equipos con diseño moderno
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

let currentUserData = null;
let equiposData = [];
let campeonatoEstado = null; // guarda el estado actual (offseason/inseason) del campeonato

document.addEventListener("DOMContentLoaded", () => {
    const gridEquipos = document.getElementById("grid-equipos");
    gridEquipos.innerHTML = "<p style='text-align:center; color: var(--text-secondary); width:100%; padding: 40px;'>Cargando equipos...</p>";

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                currentUserData = { uid: user.uid, ...userSnap.data() };
            } else {
                currentUserData = { uid: user.uid, equipo: null };
            }
            
            // Mostrar/ocultar nav-dashboard según si tiene equipo
            const navDashboard = document.getElementById("nav-dashboard");
            if (currentUserData.equipo) {
                navDashboard.style.display = "inline-block";
            }
        } else {
            currentUserData = null;
        }

        cargarEquipos();
    });
});

async function cargarEquipos() {
    equiposData = [];
    try {
        // obtener estado del campeonato para saber si estamos en offseason
        const cfgSnap = await getDoc(doc(db, "configuracion", "campeonato"));
        campeonatoEstado = cfgSnap.exists() ? cfgSnap.data().estado : null;

        const equiposSnap = await getDocs(collection(db, "equipos"));
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        const todosLosPilotos = [];
        
        pilotosSnap.forEach(doc => todosLosPilotos.push({ id: doc.id, ...doc.data() }));

        equiposSnap.forEach((equipoDoc) => {
            const dataEquipo = equipoDoc.data();
            const pilotosDelEquipo = todosLosPilotos.filter(p => p.equipoId === equipoDoc.id);

            equiposData.push({
                id: equipoDoc.id,
                nombre: dataEquipo.nombre || "Equipo",
                color: dataEquipo.color || "#ff2e3f",
                ownerId: dataEquipo.ownerId || null,
                imagenCoche: dataEquipo.imagenCoche || "",
                logo: dataEquipo.logo || "",
                presupuesto: dataEquipo.presupuesto || 0,
                pilotos: pilotosDelEquipo
            });
        });

        renderEquipos();

    } catch (error) {
        console.error("Error cargando equipos:", error);
        document.getElementById("grid-equipos").innerHTML = "<p style='text-align:center; color: var(--danger);'>Error al cargar los equipos.</p>";
    }
}

function renderEquipos() {
    const gridEquipos = document.getElementById("grid-equipos");
    gridEquipos.innerHTML = "";

    equiposData.forEach(equipo => {
        const card = document.createElement("div");
        card.className = "equipo-card-modern";

        const isLibre = !equipo.ownerId || equipo.ownerId === "";
        const usuarioLogueado = currentUserData !== null;
        const usuarioSinEquipo = usuarioLogueado && (!currentUserData.equipo || currentUserData.equipo === "");
        // sólo asignable durante el offseason
        const puedeAsignarse = isLibre && usuarioLogueado && usuarioSinEquipo && campeonatoEstado === 'offseason';

        let htmlPilotos = "";
        if (equipo.pilotos.length > 0) {
            htmlPilotos = equipo.pilotos.map(p => `
                <div class="piloto-row-moderno">
                    <div class="piloto-foto-moderno">
                        ${p.foto ? `<img src="${p.foto}" alt="${p.nombre}">` : ''}
                    </div>
                    <div class="piloto-info-moderno">
                        <p class="piloto-nombre-moderno">${p.nombre} <span style="color: ${equipo.color};">${p.apellido || ''}</span></p>
                        <p class="piloto-datos-moderno">${p.pais || 'N/A'} | #${p.numero || '00'}</p>
                    </div>
                </div>
            `).join('');
        } else {
            htmlPilotos = '<p style="text-align:center; color: var(--text-secondary); padding: 10px 0;">Sin pilotos confirmados</p>';
        }

        card.style.setProperty('--team-color', equipo.color);
        card.innerHTML = `
            <div class="equipo-header-modern">
                <div class="coche-display-modern">
                    ${equipo.imagenCoche ? `<img src="${equipo.imagenCoche}" alt="${equipo.nombre}">` : '<span style="color: var(--text-secondary);">Foto Coche</span>'}
                </div>
                <h2 class="equipo-nombre-moderno" style="color: ${equipo.color};">${equipo.nombre}</h2>
                <button class="toggle-pilotos-btn" onclick="togglePilotos(this)">▼</button>
            </div>

            <div class="equipo-pilotos-container">
                <div style="margin-bottom: 15px;">
                    ${htmlPilotos}
                </div>
                <div class="equipo-acciones">
                    ${puedeAsignarse ? `
                        <button class="btn-dirigir-moderno btn-asignar" data-team-id="${equipo.id}">Dirigir Equipo</button>
                    ` : !isLibre ? `
                        <div class="estado-equipo">Equipo Ocupado</div>
                    ` : ``}
                </div>
            </div>
        `;

        gridEquipos.appendChild(card);
    });

    agregarEventos();
}

function togglePilotos(btn) {
    const card = btn.closest(".equipo-card-modern");
    card.classList.toggle("expanded");
}

function agregarEventos() {
    const botonesAsignar = document.querySelectorAll(".btn-asignar");
    botonesAsignar.forEach(boton => {
        boton.addEventListener("click", async (e) => {
            e.stopPropagation();
            const teamId = e.target.getAttribute("data-team-id");
            const equipo = equiposData.find(e => e.id === teamId);
            
            const confirmar = confirm(`¿Confirmas que quieres dirigir a ${equipo.nombre}?\n\nRecuerda que solo puedes dirigir un equipo a la vez.`);
            
            if (confirmar) {
                try {
                    await updateDoc(doc(db, "equipos", teamId), { ownerId: currentUserData.uid });
                    await updateDoc(doc(db, "usuarios", currentUserData.uid), { equipo: teamId });

                    alert("¡Bienvenido a " + equipo.nombre + "! Redirigiendo a tu Dashboard...");
                    window.location.href = "dashboard.html";

                } catch (error) {
                    console.error("Error:", error);
                    alert("Error al asignar equipo. Intenta de nuevo.");
                }
            }
        });
    });
}

window.togglePilotos = togglePilotos;