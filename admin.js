// admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// Estado global de la BD
let isOffseason = true;

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. SEGURIDAD: VERIFICAR SI ES ADMIN
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "home.html"; return; }
        
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.isAdmin !== true) {
                alert("Acceso denegado. No eres administrador.");
                window.location.href = "home.html";
                return;
            }
            // Inicializar panel
            cargarConfiguracionGlobal();
            cargarSolicitudesPendientes();
            cargarEquiposEnSelect();
            listarEquipos(); // Cargar tabla de equipos
        }
    });

    document.getElementById("btnLogout").addEventListener("click", async () => {
        await signOut(auth); window.location.href = "home.html";
    });

    // ==========================================
    // 2. NAVEGACIÓN POR PESTAÑAS (SIDEBAR)
    // ==========================================
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const panels = document.querySelectorAll(".admin-panel");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            // Quitar clase active
            tabBtns.forEach(b => b.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            // Poner clase active al pulsado
            btn.classList.add("active");
            document.getElementById(btn.getAttribute("data-target")).classList.add("active");
        });
    });

    // ==========================================
    // 3. ESTADO DEL CAMPEONATO (Offseason)
    // ==========================================
    async function cargarConfiguracionGlobal() {
        const configRef = doc(db, "configuracion", "global");
        const configSnap = await getDoc(configRef);
        
        if(configSnap.exists()) {
            isOffseason = configSnap.data().isOffseason;
        } else {
            // Crear el documento si no existe
            await setDoc(configRef, { isOffseason: true });
            isOffseason = true;
        }
        actualizarTextoEstado();
    }

    function actualizarTextoEstado() {
        const textEl = document.getElementById("admin-status-text");
        textEl.textContent = isOffseason ? "OFFSEASON (Mercado Abierto)" : "TEMPORADA EN CURSO";
        textEl.style.color = isOffseason ? "var(--warning)" : "var(--success)";
    }

    document.getElementById("btn-toggle-status").addEventListener("click", async () => {
        const nuevoEstado = !isOffseason;
        if(confirm(`¿Seguro que quieres cambiar el estado a ${nuevoEstado ? 'OFFSEASON' : 'EN CURSO'}?`)) {
            await updateDoc(doc(db, "configuracion", "global"), { isOffseason: nuevoEstado });
            isOffseason = nuevoEstado;
            actualizarTextoEstado();
        }
    });

    // ==========================================
    // 4. GESTIÓN DE SOLICITUDES (Mejoras/Fichajes)
    // ==========================================
    async function cargarSolicitudesPendientes() {
        const contenedor = document.getElementById("admin-solicitudes");
        const q = query(collection(db, "solicitudes_admin"), where("estado", "==", "Pendiente"));
        const snapshot = await getDocs(q);

        if(snapshot.empty) {
            contenedor.innerHTML = "<p class='text-muted'>No hay solicitudes pendientes.</p>";
            return;
        }

        contenedor.innerHTML = "";
        snapshot.forEach(docSnap => {
            const sol = docSnap.data();
            const id = docSnap.id;

            contenedor.innerHTML += `
                <div class="solicitud-item" id="sol-${id}">
                    <div>
                        <strong style="color:var(--text-primary);">${sol.nombreEquipo}</strong> - <span style="color:var(--text-secondary);">${sol.tipo}</span>
                        <p style="margin:5px 0 0 0; font-size:0.9rem;">${sol.detalle} (Costo: $${(sol.costo||0).toLocaleString()})</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-solid" style="background-color:var(--success); border:none;" onclick="resolverSolicitud('${id}', '${sol.equipoId}', 'Aprobada')">Aprobar</button>
                        <button class="btn-solid" style="background-color:var(--danger); border:none;" onclick="resolverSolicitud('${id}', '${sol.equipoId}', 'Denegada')">Denegar</button>
                    </div>
                </div>
            `;
        });
    }

    // Función global para resolver
    window.resolverSolicitud = async (solicitudId, equipoId, resolucion) => {
        if(!confirm(`¿Marcar esta solicitud como ${resolucion}?`)) return;
        
        try {
            // Actualizar solicitud
            await updateDoc(doc(db, "solicitudes_admin", solicitudId), { estado: resolucion });
            
            // Mandar aviso al equipo
            await addDoc(collection(db, "notificaciones"), {
                equipoId: equipoId,
                remitente: "FIA (Dirección)",
                texto: `Tu solicitud ha sido: ${resolucion}.`,
                fecha: serverTimestamp()
            });

            document.getElementById(`sol-${solicitudId}`).remove();
        } catch (error) { console.error(error); }
    };

    // ==========================================
    // 5. MENSAJERÍA OFICIAL (Enviar a Equipos)
    // ==========================================
    async function cargarEquiposEnSelect() {
        const select = document.getElementById("msg-destinatario");
        const snapshot = await getDocs(collection(db, "equipos"));
        snapshot.forEach(docSnap => {
            const op = document.createElement("option");
            op.value = docSnap.id;
            op.textContent = docSnap.data().nombre;
            select.appendChild(op);
        });
    }

    document.getElementById("form-mensaje").addEventListener("submit", async (e) => {
        e.preventDefault();
        const remitente = document.getElementById("msg-remitente").value;
        const destinatario = document.getElementById("msg-destinatario").value;
        const texto = document.getElementById("msg-texto").value;

        try {
            await addDoc(collection(db, "notificaciones"), {
                equipoId: destinatario,
                remitente: remitente,
                texto: texto,
                fecha: serverTimestamp()
            });
            alert("Mensaje enviado con éxito.");
            document.getElementById("form-mensaje").reset();
        } catch (error) { console.error(error); alert("Error al enviar."); }
    });

    // ==========================================
    // 6. CRUD EQUIPOS (Ejemplo base de añadir datos)
    // ==========================================
    async function listarEquipos() {
        const tbody = document.getElementById("tabla-equipos");
        const snapshot = await getDocs(collection(db, "equipos"));
        tbody.innerHTML = "";
        snapshot.forEach(docSnap => {
            const eq = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td><strong>${eq.nombre}</strong></td>
                    <td><div style="width:20px; height:20px; background-color:${eq.color}; border-radius:3px;"></div></td>
                    <td>$${(eq.presupuesto||0).toLocaleString()}</td>
                    <td>
                        <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('equipos', '${docSnap.id}')">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById("form-equipo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("eq-nombre").value;
        const color = document.getElementById("eq-color").value;
        const presupuesto = parseInt(document.getElementById("eq-presupuesto").value);
        
        try {
            await addDoc(collection(db, "equipos"), {
                nombre: nombre, color: color, presupuesto: presupuesto, ownerId: null
            });
            alert("Equipo guardado.");
            document.getElementById("modal-equipo").style.display = "none";
            listarEquipos();
        } catch(error) { console.error(error); }
    });

    window.eliminarDoc = async (coleccion, id) => {
        if(confirm("¿Eliminar este registro permanentemente?")) {
            await deleteDoc(doc(db, coleccion, id));
            if(coleccion === 'equipos') listarEquipos();
            // Aquí puedes añadir los if para refrescar las otras tablas
        }
    };
});