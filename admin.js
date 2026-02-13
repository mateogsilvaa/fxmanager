// admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// Variables globales para almacenar datos y evitar recargas
let equiposList = [];

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. SEGURIDAD ADMIN ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "home.html"; return; }
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (!userSnap.exists() || userSnap.data().isAdmin !== true) {
            alert("No tienes permisos de Administrador.");
            window.location.href = "home.html";
            return;
        }
        
        // Si es Admin, inicializamos todos los paneles
        await refrescarDatosGlobales();
    });

    document.getElementById("btnLogout").addEventListener("click", () => signOut(auth));

    // --- 2. NAVEGACIÓN PESTAÑAS ---
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const panels = document.querySelectorAll(".admin-panel");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.getAttribute("data-target")).classList.add("active");
        });
    });

    // --- 3. LISTENERS DE FORMULARIOS (CRUD) ---
    
    // Formulario Mensajes
    document.getElementById("form-mensaje").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "notificaciones"), {
                remitente: document.getElementById("msg-remitente").value,
                equipoId: document.getElementById("msg-destinatario").value,
                texto: document.getElementById("msg-texto").value,
                fecha: serverTimestamp()
            });
            alert("Comunicado enviado.");
            e.target.reset();
        } catch(err) { console.error(err); alert("Error al enviar."); }
    });

    // Formulario Equipos
    document.getElementById("form-equipo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("eq-id").value;
        const data = {
            nombre: document.getElementById("eq-nombre").value,
            color: document.getElementById("eq-color").value,
            imagenCoche: document.getElementById("eq-coche").value,
            logo: document.getElementById("eq-logo").value
        };
        await guardarDoc('equipos', id, data, 'modal-equipo');
    });

    // Formulario Pilotos
    document.getElementById("form-piloto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("pil-id").value;
        const data = {
            nombre: document.getElementById("pil-nombre").value,
            numero: parseInt(document.getElementById("pil-numero").value),
            pais: document.getElementById("pil-pais").value,
            equipoId: document.getElementById("pil-equipo").value,
            foto: document.getElementById("pil-foto").value
        };
        await guardarDoc('pilotos', id, data, 'modal-piloto');
    });

    // Formulario Carreras
    document.getElementById("form-carrera").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("car-id").value;
        const data = {
            ronda: parseInt(document.getElementById("car-ronda").value),
            nombre: document.getElementById("car-nombre").value,
            circuito: document.getElementById("car-circuito").value,
            fecha: document.getElementById("car-fecha").value, // datetime-local format
            pole: document.getElementById("car-pole").value,
            vr: document.getElementById("car-vr").value,
            qualy: document.getElementById("car-qualy").value,
            podio: document.getElementById("car-podio").value,
            completada: document.getElementById("car-completada").checked
        };
        await guardarDoc('carreras', id, data, 'modal-carrera');
    });

    // Formulario Media
    document.getElementById("form-media").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("med-id").value;
        const data = {
            tipo: document.getElementById("med-tipo").value,
            titulo: document.getElementById("med-titulo").value,
            url: document.getElementById("med-url").value,
            texto: document.getElementById("med-texto").value,
            fecha: serverTimestamp() // Siempre actualizamos la fecha al publicar
        };
        await guardarDoc('publicaciones', id, data, 'modal-media');
    });
});

// ==========================================
// LÓGICA CORE: CARGAR Y PINTAR DATOS
// ==========================================

async function refrescarDatosGlobales() {
    // 1. Cargar equipos (se usa en varias tablas y selects)
    const eqSnap = await getDocs(collection(db, "equipos"));
    equiposList = [];
    eqSnap.forEach(doc => equiposList.push({ id: doc.id, ...doc.data() }));
    
    // Rellenar Selects
    const selectMsg = document.getElementById("msg-destinatario");
    const selectPil = document.getElementById("pil-equipo");
    
    selectMsg.innerHTML = '<option value="todos">A todos los equipos</option>';
    selectPil.innerHTML = '<option value="">Ninguno (Agente Libre)</option>';
    
    equiposList.forEach(eq => {
        selectMsg.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        selectPil.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
    });

    // 2. Pintar Tablas
    pintarTablaEquipos();
    pintarTablaPilotos();
    pintarTablaCarreras();
    pintarTablaMedia();
}

// Pintar Equipos
function pintarTablaEquipos() {
    const tbody = document.getElementById("tabla-equipos");
    tbody.innerHTML = "";
    equiposList.forEach(eq => {
        tbody.innerHTML += `
            <tr>
                <td>${eq.logo ? `<img src="${eq.logo}" style="width:30px; border-radius:4px;">` : 'N/A'}</td>
                <td><strong>${eq.nombre}</strong></td>
                <td><div style="width:20px;height:20px;background:${eq.color};border-radius:4px;"></div></td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarEquipo(${JSON.stringify(eq)})'>Editar</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('equipos', '${eq.id}')">X</button>
                </td>
            </tr>`;
    });
}

// Pintar Pilotos
async function pintarTablaPilotos() {
    const tbody = document.getElementById("tabla-pilotos");
    const snap = await getDocs(collection(db, "pilotos"));
    tbody.innerHTML = "";
    snap.forEach(d => {
        const p = d.data();
        const eqInfo = equiposList.find(e => e.id === p.equipoId);
        const eqNombre = eqInfo ? eqInfo.nombre : "Agente Libre";
        
        // Creamos un objeto seguro para inyectar en onclick
        const pData = { id: d.id, ...p };
        
        tbody.innerHTML += `
            <tr>
                <td>#${p.numero || '0'}</td>
                <td><strong>${p.nombre}</strong></td>
                <td>${p.pais || 'N/A'} (${eqNombre})</td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarPiloto(${JSON.stringify(pData)})'>Editar</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('pilotos', '${d.id}')">X</button>
                </td>
            </tr>`;
    });
}

// Pintar Carreras
async function pintarTablaCarreras() {
    const tbody = document.getElementById("tabla-carreras");
    const q = query(collection(db, "carreras"), orderBy("ronda", "asc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(d => {
        const c = d.data();
        const cData = { id: d.id, ...c };
        
        tbody.innerHTML += `
            <tr>
                <td>R${c.ronda}</td>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Sin fecha'}</td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarCarrera(${JSON.stringify(cData)})'>Editar/Resultados</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('carreras', '${d.id}')">X</button>
                </td>
            </tr>`;
    });
}

// Pintar Media
async function pintarTablaMedia() {
    const tbody = document.getElementById("tabla-media");
    const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(d => {
        const m = d.data();
        const mData = { id: d.id, ...m };
        
        tbody.innerHTML += `
            <tr>
                <td style="text-transform:uppercase;">${m.tipo}</td>
                <td><strong>${m.titulo}</strong></td>
                <td>${m.fecha ? new Date(m.fecha.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarMedia(${JSON.stringify(mData)})'>Editar</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('publicaciones', '${d.id}')">X</button>
                </td>
            </tr>`;
    });
}

// ==========================================
// FUNCIONES GLOBALES (Modales, Guardar, Eliminar)
// ==========================================

// Guardar/Actualizar Genérico
async function guardarDoc(coleccion, id, data, modalId) {
    try {
        if (id) {
            await updateDoc(doc(db, coleccion, id), data);
            alert("Actualizado correctamente.");
        } else {
            await addDoc(collection(db, coleccion), data);
            alert("Creado correctamente.");
        }
        cerrarModal(modalId);
        refrescarDatosGlobales();
    } catch (error) { console.error(error); alert("Error al guardar."); }
}

// Eliminar Genérico
window.eliminarDoc = async (coleccion, id) => {
    if(confirm("¿Estás seguro de que quieres eliminar esto? No se puede deshacer.")) {
        try {
            await deleteDoc(doc(db, coleccion, id));
            refrescarDatosGlobales();
        } catch (error) { console.error(error); alert("Error al eliminar."); }
    }
}

// Control de Modales Base
window.abrirModal = (id) => {
    document.getElementById(id).querySelector('form').reset();
    document.getElementById(id).querySelector('input[type="hidden"]').value = ""; // Limpiar ID
    document.getElementById(id).style.display = 'flex';
}

window.cerrarModal = (id) => {
    document.getElementById(id).style.display = 'none';
}

// ==========================================
// FUNCIONES DE EDICIÓN (Rellenar Formularios)
// ==========================================

window.editarEquipo = (data) => {
    document.getElementById("eq-id").value = data.id;
    document.getElementById("eq-nombre").value = data.nombre || "";
    document.getElementById("eq-color").value = data.color || "#ffffff";
    document.getElementById("eq-coche").value = data.imagenCoche || "";
    document.getElementById("eq-logo").value = data.logo || "";
    document.getElementById("titulo-modal-equipo").textContent = "Editar Equipo";
    document.getElementById("modal-equipo").style.display = "flex";
}

window.editarPiloto = (data) => {
    document.getElementById("pil-id").value = data.id;
    document.getElementById("pil-nombre").value = data.nombre || "";
    document.getElementById("pil-numero").value = data.numero || "";
    document.getElementById("pil-pais").value = data.pais || "";
    document.getElementById("pil-equipo").value = data.equipoId || "";
    document.getElementById("pil-foto").value = data.foto || "";
    document.getElementById("titulo-modal-piloto").textContent = "Editar Piloto";
    document.getElementById("modal-piloto").style.display = "flex";
}

window.editarCarrera = (data) => {
    document.getElementById("car-id").value = data.id;
    document.getElementById("car-ronda").value = data.ronda || "";
    document.getElementById("car-nombre").value = data.nombre || "";
    document.getElementById("car-circuito").value = data.circuito || "";
    document.getElementById("car-fecha").value = data.fecha || "";
    document.getElementById("car-pole").value = data.pole || "";
    document.getElementById("car-vr").value = data.vr || "";
    document.getElementById("car-qualy").value = data.qualy || "";
    document.getElementById("car-podio").value = data.podio || "";
    document.getElementById("car-completada").checked = data.completada || false;
    document.getElementById("titulo-modal-carrera").textContent = "Editar Carrera / Resultados";
    document.getElementById("modal-carrera").style.display = "flex";
}

window.editarMedia = (data) => {
    document.getElementById("med-id").value = data.id;
    document.getElementById("med-tipo").value = data.tipo || "articulo";
    document.getElementById("med-titulo").value = data.titulo || "";
    document.getElementById("med-url").value = data.url || "";
    document.getElementById("med-texto").value = data.texto || "";
    document.getElementById("titulo-modal-media").textContent = "Editar Publicación";
    document.getElementById("modal-media").style.display = "flex";
}