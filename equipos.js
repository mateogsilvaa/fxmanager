// equipos.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// ==========================================
// 2. ESTADO GLOBAL
// ==========================================
let currentUserData = null; 
let isOffseason = true; // PON ESTO EN FALSE CUANDO EMPIECE LA TEMPORADA
let equiposData = [];

document.addEventListener("DOMContentLoaded", () => {
    const gridEquipos = document.getElementById("grid-equipos");
    gridEquipos.innerHTML = "<p style='text-align:center; color: var(--text-secondary);'>Conectando con la base de datos...</p>";

    // ==========================================
    // 3. AUTENTICACIÓN Y CARGA INICIAL
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Buscamos si el usuario ya tiene un equipo guardado en la colección "usuarios"
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                currentUserData = { uid: user.uid, ...userSnap.data() };
            } else {
                currentUserData = { uid: user.uid, equipo: null }; // Asumimos que el campo se llama "equipo"
            }
        } else {
            currentUserData = null;
        }

        // Una vez sabemos quién es, descargamos los datos
        cargarDatosF1();
    });
});

// ==========================================
// 4. OBTENER DATOS DE FIRESTORE
// ==========================================
async function cargarDatosF1() {
    equiposData = [];
    try {
        // 1. Obtener todos los equipos de la colección "equipos"
        const equiposSnap = await getDocs(collection(db, "equipos"));
        
        // 2. Obtener todos los pilotos de la colección "pilotos"
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        const todosLosPilotos = [];
        pilotosSnap.forEach(doc => todosLosPilotos.push({ id: doc.id, ...doc.data() }));

        equiposSnap.forEach((equipoDoc) => {
            const dataEquipo = equipoDoc.data();
            
            // Filtramos los pilotos que pertenecen a este equipo (Asumiendo que los pilotos tienen un campo "equipoId")
            // Si en tu BD los pilotos están guardados de otra forma, dímelo y lo ajustamos.
            const pilotosDelEquipo = todosLosPilotos.filter(p => p.equipoId === equipoDoc.id);

            equiposData.push({
                id: equipoDoc.id,
                nombre: dataEquipo.nombre || "Equipo Desconocido",
                color: dataEquipo.color || "#ffffff",
                ownerId: dataEquipo.ownerId || null, // Si es null, está libre
                imagenCoche: dataEquipo.imagenCoche || "",
                pilotos: pilotosDelEquipo
            });
        });

        renderEquipos();

    } catch (error) {
        console.error("Error cargando la base de datos:", error);
        document.getElementById("grid-equipos").innerHTML = "<p style='text-align:center; color: var(--danger);'>Error al cargar los equipos. Revisa la consola.</p>";
    }
}

// ==========================================
// 5. RENDERIZAR INTERFAZ (HTML)
// ==========================================
function renderEquipos() {
    const gridEquipos = document.getElementById("grid-equipos");
    gridEquipos.innerHTML = ""; // Limpiamos el grid

    equiposData.forEach(equipo => {
        const card = document.createElement("div");
        card.className = "equipo-card";

        // Lógica del botón de dirigir
        const isLibre = !equipo.ownerId || equipo.ownerId === "";
        const usuarioLogueado = currentUserData !== null;
        const usuarioSinEquipo = usuarioLogueado && (!currentUserData.equipo || currentUserData.equipo === "");
        
        const mostrarBotonDirigir = isOffseason && isLibre && usuarioLogueado && usuarioSinEquipo;

        // Construir HTML de los pilotos
        let htmlPilotos = "";
        if (equipo.pilotos.length > 0) {
            htmlPilotos = equipo.pilotos.map(p => `
                <div class="piloto-card">
                    <div class="piloto-foto" style="width: 50px; height: 50px; border-radius: 50%; background-color: var(--bg-tertiary); border: 2px solid var(--border-color); overflow: hidden;">
                        ${p.foto ? `<img src="${p.foto}" alt="${p.nombre}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                    </div>
                    <div class="piloto-info">
                        <p class="piloto-nombre">${p.nombre || 'Piloto'} <strong style="color: ${equipo.color};">${p.apellido || ''}</strong></p>
                        <p class="piloto-datos">${p.pais || 'N/A'} | #${p.numero || '00'}</p>
                    </div>
                </div>
            `).join('');
        } else {
            htmlPilotos = `<p class="piloto-datos" style="text-align:center; padding: 10px 0;">No hay pilotos confirmados</p>`;
        }

        // Construir Tarjeta del equipo
        card.innerHTML = `
            <div class="equipo-header">
                <div class="coche-placeholder" style="height: 150px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center;">
                    ${equipo.imagenCoche ? `<img src="${equipo.imagenCoche}" alt="Coche ${equipo.nombre}" style="width: 100%; height: 100%; object-fit: contain; transform: scale(1.3); filter: drop-shadow(0px 10px 15px rgba(0,0,0,0.6));">` : '<span style="color: var(--text-secondary);">Foto Coche</span>'}
                </div>
                
                <h2 style="color: ${equipo.color}; margin-bottom: 5px; font-size: 1.5rem; position: relative; z-index: 2;">${equipo.nombre}</h2>
                <button class="deploy-arrow" style="position: relative; z-index: 2;">▼</button>
            </div>
            
            <div class="pilotos-container" style="display: none;">
                <div class="pilotos-lista">
                    ${htmlPilotos}
                </div>
                
                ${mostrarBotonDirigir ? `
                    <div class="accion-equipo" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color); text-align: center;">
                        <button class="btn-solid btn-dirigir" data-team-id="${equipo.id}" style="width: 100%; background-color: var(--text-primary); color: var(--bg-primary);">Dirigir Equipo</button>
                    </div>
                ` : ''}
                
                ${(!isLibre && usuarioLogueado) ? `
                    <div style="margin-top: 15px; text-align: center;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); padding: 5px 10px; border: 1px solid var(--border-color); border-radius: 4px;">Equipo Ocupado</span>
                    </div>
                ` : ''}
            </div>
        `;

        gridEquipos.appendChild(card);
    });

    agregarEventos();
}

// ==========================================
// 6. EVENTOS (Acordeón y Base de Datos)
// ==========================================
function agregarEventos() {
    // 1. Desplegar/Contraer Pilotos
    const headers = document.querySelectorAll(".equipo-header");
    headers.forEach(header => {
        header.addEventListener("click", (e) => {
            if(e.target.classList.contains('btn-dirigir')) return;

            const container = header.nextElementSibling;
            const flecha = header.querySelector(".deploy-arrow");
            
            if (container.style.display === "none") {
                container.style.display = "block";
                flecha.style.transform = "rotate(180deg)";
            } else {
                container.style.display = "none";
                flecha.style.transform = "rotate(0deg)";
            }
        });
    });

    // 2. Botón Dirigir Equipo (Guardar en Firebase)
    const botonesDirigir = document.querySelectorAll(".btn-dirigir");
    botonesDirigir.forEach(boton => {
        boton.addEventListener("click", async (e) => {
            e.stopPropagation();
            const teamId = e.target.getAttribute("data-team-id");
            
            const confirmar = confirm(`¿Confirmas que quieres ser el jefe de equipo de esta escudería?`);
            
            if (confirmar) {
                try {
                    // Actualizamos el equipo en Firestore para ponerle el ID del dueño
                    const equipoRef = doc(db, "equipos", teamId);
                    await updateDoc(equipoRef, {
                        ownerId: currentUserData.uid
                    });

                    // Actualizamos el usuario en Firestore para asignarle el ID del equipo
                    const usuarioRef = doc(db, "usuarios", currentUserData.uid);
                    await updateDoc(usuarioRef, {
                        equipo: teamId
                    });

                    alert("¡Contrato firmado! Redirigiendo a tu Dashboard...");
                    window.location.href = "dashboard.html";

                } catch (error) {
                    console.error("Error al asignar equipo:", error);
                    alert("Hubo un error al firmar el contrato. Inténtalo de nuevo.");
                }
            }
        });
    });
}