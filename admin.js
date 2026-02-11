import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// --- 1. SEGURIDAD: VERIFICAR QUE ERES TÚ ---
// Cambia esto por tu correo real con el que te registraste en Firebase
const CORREO_ADMIN = "mateogonsilva@gmail.com"; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email !== CORREO_ADMIN) {
            alert("¡Acceso denegado! No eres la FIA.");
            window.location.href = "dashboard.html";
        } else {
            iniciarPanelAdmin();
        }
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. INICIAR EL PANEL ---
function iniciarPanelAdmin() {
    leerEstadoCampeonato();
    escucharCambiosEquipos(); // Para tu buzón de Assetto Corsa
}

// --- 3. CONTROL DEL SEMÁFORO (ABIERTO/CERRADO) ---
let estadoActual = "abierto";

async function leerEstadoCampeonato() {
    // Necesitas crear un documento en Firebase llamado "campeonato" dentro de una colección "configuracion"
    const docRef = doc(db, "configuracion", "campeonato");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        estadoActual = docSnap.data().estado;
        actualizarTextoEstado();
    } else {
        document.getElementById('estado-texto').innerText = "Falta crear config en Firebase";
    }
}

function actualizarTextoEstado() {
    const texto = document.getElementById('estado-texto');
    const boton = document.getElementById('btnToggleCampeonato');
    
    if (estadoActual === "abierto") {
        texto.innerText = "MERCADO ABIERTO (Verde)";
        texto.style.color = "#00C851";
        boton.innerText = "Cerrar Mercado para Carrera";
        boton.style.backgroundColor = "#ff4444";
    } else {
        texto.innerText = "MERCADO CERRADO (Rojo)";
        texto.style.color = "#ff4444";
        boton.innerText = "Abrir Mercado";
        boton.style.backgroundColor = "#00C851";
    }
}

document.getElementById('btnToggleCampeonato').addEventListener('click', async () => {
    const nuevoEstado = estadoActual === "abierto" ? "cerrado" : "abierto";
    const docRef = doc(db, "configuracion", "campeonato");
    
    await updateDoc(docRef, { estado: nuevoEstado });
    estadoActual = nuevoEstado;
    actualizarTextoEstado();
    alert("Estado actualizado. Los jugadores ya lo verán reflejado.");
});

// --- 4. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// Nota: Las funciones de "Subir Resultado" y "Log de cambios" las conectaremos en el siguiente paso
// cuando creemos la estructura de "Pilotos".