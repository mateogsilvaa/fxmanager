// dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let currentTeamId = null;
let currentTeamData = null;
let userDocId = null;

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. VERIFICAR AUTENTICACIÓN Y PERMISOS
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "home.html"; // No logueado
            return;
        }

        userDocId = user.uid;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Si es Admin mostramos el botón del menú
            if (userData.isAdmin) document.getElementById("nav-admin").style.display = "inline-block";

            // Si NO tiene equipo, lo echamos de aquí
            if (!userData.equipo || userData.equipo === "") {
                alert("No tienes ninguna escudería asignada.");
                window.location.href = "equipos.html";
                return;
            }

            currentTeamId = userData.equipo;
            cargarDatosDashboard();
            escucharNotificaciones();
        }
    });

    // Evento Logout
    document.getElementById("btnLogout").addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "home.html";
    });
});

// 2. CARGAR DATOS DEL EQUIPO Y PILOTOS
async function cargarDatosDashboard() {
    try {
        // Cargar Equipo
        const equipoRef = doc(db, "equipos", currentTeamId);
        const equipoSnap = await getDoc(equipoRef);
        
        if (!equipoSnap.exists()) return;
        currentTeamData = equipoSnap.data();

        // Renderizar Info Base
        document.getElementById("dash-team-name").textContent = currentTeamData.nombre;
        document.getElementById("dash-team-name").style.color = currentTeamData.color;
        document.getElementById("dash-budget").textContent = `$${(currentTeamData.presupuesto || 0).toLocaleString()}`;
        
        if(currentTeamData.imagenCoche) {
            document.getElementById("dash-car-img").innerHTML = `<img src="${currentTeamData.imagenCoche}">`;
        } else {
            document.getElementById("dash-car-img").innerHTML = `<span style="color:var(--text-secondary)">Sin Imagen</span>`;
        }

        // Estadísticas del equipo (asumiendo que las guardas en el doc del equipo)
        document.getElementById("ts-carreras").textContent = currentTeamData.carreras || 0;
        document.getElementById("ts-victorias").textContent = currentTeamData.victorias || 0;
        document.getElementById("ts-puntos").textContent = currentTeamData.puntos || 0;
        document.getElementById("ts-podios").textContent = currentTeamData.podios || 0;
        document.getElementById("ts-poles").textContent = currentTeamData.poles || 0;
        document.getElementById("ts-dnfs").textContent = currentTeamData.dnfs || 0;
        document.getElementById("ts-mundiales").textContent = currentTeamData.mundiales || 0;

        // Cargar Pilotos del Equipo
        const pilotosQuery = query(collection(db, "pilotos"), where("equipoId", "==", currentTeamId));
        const pilotosSnap = await getDocs(pilotosQuery);
        
        const driversContainer = document.getElementById("dash-drivers-container");
        driversContainer.innerHTML = "";

        pilotosSnap.forEach(docSnap => {
            const p = docSnap.data();
            const pId = docSnap.id;
            
            driversContainer.innerHTML += `
                <div class="driver-dash-card">
                    <div class="driver-dash-header">
                        <div class="driver-dash-photo" style="overflow:hidden;">
                            ${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                        </div>
                        <div>
                            <h4 style="margin:0;">${p.nombre} <span style="color:${currentTeamData.color}">${p.apellido}</span></h4>
                            <span class="text-muted" style="font-size:0.8rem;">${p.pais} | Edad: ${p.edad || '--'} | #${p.numero}</span>
                        </div>
                    </div>
                    
                    <div class="driver-attributes">
                        <span>Ritmo: <strong>${p.ritmo || 0}</strong></span>
                        <span>Agresividad: <strong>${p.agresividad || 0}</strong></span>
                        <span>Moral: <strong>${p.moral || 'Media'}</strong></span>
                    </div>

                    <div class="driver-stats-mini">
                        <div class="stat-box"><span>Pts</span><strong>${p.puntos || 0}</strong></div>
                        <div class="stat-box"><span>Vic</span><strong>${p.victorias || 0}</strong></div>
                        <div class="stat-box"><span>Pod</span><strong>${p.podios || 0}</strong></div>
                    </div>

                    <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                        <label>Sueldo Actual: $${(p.sueldo || 0).toLocaleString()}</label>
                        <div style="display:flex; gap:10px;">
                            <input type="number" id="sueldo-${pId}" value="${p.sueldo || 0}" style="margin:0;">
                            <button class="btn-outline btn-update-salary" data-pid="${pId}">Actualizar</button>
                        </div>
                    </div>
                </div>
            `;
        });

        configurarBotonesAccion();

    } catch (error) {
        console.error("Error al cargar dashboard:", error);
    }
}

// 3. CONFIGURAR ACCIONES (Mejoras, Fichajes, Sueldos)
function configurarBotonesAccion() {
    
    // --- MEJORAS ---
    const botonesMejora = document.querySelectorAll(".btn-upgrade");
    botonesMejora.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const tipo = e.target.getAttribute("data-type");
            const costo = parseInt(e.target.getAttribute("data-cost"));

            if (currentTeamData.presupuesto < costo) {
                alert("Presupuesto insuficiente para esta mejora.");
                return;
            }

            if (confirm(`¿Invertir $${costo.toLocaleString()} en mejora de ${tipo}? El dinero se descontará inmediatamente.`)) {
                try {
                    // 1. Restar dinero
                    const nuevoPresupuesto = currentTeamData.presupuesto - costo;
                    await updateDoc(doc(db, "equipos", currentTeamId), {
                        presupuesto: nuevoPresupuesto
                    });

                    // 2. Crear solicitud para el admin en la colección "solicitudes_admin"
                    await addDoc(collection(db, "solicitudes_admin"), {
                        equipoId: currentTeamId,
                        nombreEquipo: currentTeamData.nombre,
                        tipo: "Mejora",
                        detalle: tipo,
                        costo: costo,
                        estado: "Pendiente",
                        fecha: serverTimestamp()
                    });

                    alert("Mejora solicitada. El Admin evaluará el resultado.");
                    cargarDatosDashboard(); // Recargar datos para ver el nuevo saldo

                } catch (error) {
                    console.error("Error al procesar mejora:", error);
                }
            }
        });
    });

    // --- ACTUALIZAR SUELDOS ---
    // --- ACTUALIZAR SUELDOS ---
    const botonesSueldo = document.querySelectorAll(".btn-update-salary");
    botonesSueldo.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const pId = e.target.getAttribute("data-pid");
            const nuevoSueldo = parseInt(document.getElementById(`sueldo-${pId}`).value);

            if(confirm(`¿Actualizar el sueldo de este piloto a $${nuevoSueldo.toLocaleString()}?`)) {
                await updateDoc(doc(db, "pilotos", pId), { sueldo: nuevoSueldo });
                
                // --- NUEVO: ENVIAR AVISO AL ADMIN ---
                await addDoc(collection(db, "solicitudes_admin"), {
                    equipoId: currentTeamId,
                    nombreEquipo: currentTeamData.nombre,
                    tipo: "Cambio de Sueldo",
                    detalle: `Nuevo sueldo establecido a $${nuevoSueldo.toLocaleString()}`,
                    estado: "Info", // 'Info' no pide aprobar ni denegar, solo informa.
                    fecha: serverTimestamp()
                });

                alert("Sueldo actualizado.");
                cargarDatosDashboard();
            }
        });
    });

    // --- FICHAJES Y OFERTAS A OTROS PILOTOS ---
    document.getElementById("btn-transfer").addEventListener("click", async () => {
        const pilotoTarget = document.getElementById("transfer-target").value;
        const oferta = document.getElementById("transfer-offer").value;
        
        if(!pilotoTarget || !oferta) return alert("Rellena los datos de la oferta.");

        // Formateamos el número para que se vea bonito con las comas en el panel de Admin
        const ofertaFormateada = parseInt(oferta).toLocaleString();

        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Mercado de Fichajes",
            detalle: `Desea fichar a ${pilotoTarget} por $${ofertaFormateada}`,
            estado: "Pendiente", // Al ser 'Pendiente', en tu Admin saldrán los botones de Aprobar/Denegar
            fecha: serverTimestamp()
        });
        
        alert("Oferta enviada a la Dirección de Carrera (Admin) para su tramitación.");
        document.getElementById("transfer-target").value = "";
        document.getElementById("transfer-offer").value = "";
    });

    // --- INVESTIGACIÓN DE RIVALES ---
    const btnResearch = document.getElementById("btn-research");
    if (btnResearch) {
        btnResearch.addEventListener("click", async () => {
            const target = document.getElementById("research-target").value;
            let detalleTexto = "";

            if (target === "piloto") detalleTexto = "Solicita conocer los atributos (Ritmo/Agresividad) de un piloto rival.";
            else if (target === "mejora") detalleTexto = "Solicita conocer cuál ha sido la última mejora de un equipo rival.";
            else if (target === "elemento") detalleTexto = "Solicita conocer el nivel de una pieza de un rival.";

            if(confirm(`¿Quieres gastar un uso de investigación en: ${target}?`)) {
                await addDoc(collection(db, "solicitudes_admin"), {
                    equipoId: currentTeamId,
                    nombreEquipo: currentTeamData.nombre,
                    tipo: "Investigación (Espionaje)",
                    detalle: detalleTexto,
                    estado: "Pendiente", // Al ser 'Pendiente', el admin decidirá si darle la info
                    fecha: serverTimestamp()
                });

                alert("Investigación solicitada. El Admin evaluará la petición y te enviará los datos por la Bandeja de Mensajes.");
            }
        });
    }
} // <-- Aquí termina la función configurarBotonesAccion()

// 4. ESCUCHAR AVISOS/MENSAJES EN TIEMPO REAL
function escucharNotificaciones() {
    const messagesContainer = document.getElementById("dash-messages");
    
    // Escuchamos la colección "notificaciones" donde el 'equipoId' sea el nuestro o sea "todos"
    const q = query(collection(db, "notificaciones"), where("equipoId", "in", [currentTeamId, "todos"]));
    
    onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = "";
        if(snapshot.empty) {
            messagesContainer.innerHTML = "<p class='text-muted'>No tienes mensajes nuevos.</p>";
            return;
        }

        let mensajesHTML = "";
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            mensajesHTML += `
                <div class="message-item">
                    <strong style="color:var(--text-primary);">${msg.remitente || 'Admin'}:</strong> 
                    <span style="color:var(--text-secondary);">${msg.texto}</span>
                </div>
            `;
        });
        messagesContainer.innerHTML = mensajesHTML;
    });
}
