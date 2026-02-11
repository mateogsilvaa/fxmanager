import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Fíjate que he añadido addDoc y getDocs aquí arriba:
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const CORREO_ADMIN = "mateogonsilva@gmail.com"; // <--- PON TU CORREO AQUÍ

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

function iniciarPanelAdmin() {
    leerEstadoCampeonato();
    cargarEquiposEnSelects(); // Cargamos las listas desplegables
}

// --- 2. CONTROL DEL CAMPEONATO ---
let estadoActual = "abierto";

async function leerEstadoCampeonato() {
    const docRef = doc(db, "configuracion", "campeonato");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        estadoActual = docSnap.data().estado;
        actualizarTextoEstado();
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
});

// --- 3. CARGAR EQUIPOS EN LOS DESPLEGABLES ---
async function cargarEquiposEnSelects() {
    const selectEditar = document.getElementById('select-equipo-editar');
    const selectPiloto = document.getElementById('p-equipo');
    
    selectEditar.innerHTML = "<option value=''>Elige una escudería...</option>";
    selectPiloto.innerHTML = "<option value=''>Elige una escudería...</option>";

    const querySnapshot = await getDocs(collection(db, "equipos"));
    
    querySnapshot.forEach((documento) => {
        const id = documento.id;
        const nombre = documento.data().nombre;
        
        const option1 = document.createElement("option");
        option1.value = id; option1.text = nombre;
        selectEditar.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = id; option2.text = nombre;
        selectPiloto.appendChild(option2);
    });
}

// --- 4. ACTUALIZAR EQUIPO (FOTOS Y COLOR) ---
document.getElementById('btnActualizarEquipo').addEventListener('click', async () => {
    const idEquipo = document.getElementById('select-equipo-editar').value;
    const color = document.getElementById('input-color-equipo').value;
    const urlCoche = document.getElementById('input-foto-coche').value;

    if (!idEquipo) { alert("Selecciona un equipo primero."); return; }

    try {
        const equipoRef = doc(db, "equipos", idEquipo);
        await updateDoc(equipoRef, {
            color: color,
            coche_url: urlCoche
        });
        alert("¡Diseño de escudería guardado! Ve a la página de Equipos para verlo.");
    } catch (error) {
        console.error("Error actualizando equipo: ", error);
        alert("Error al actualizar la base de datos.");
    }
});

// --- 5. FICHAR PILOTO ---
document.getElementById('btnGuardarPiloto').addEventListener('click', async () => {
    const nombre = document.getElementById('p-nombre').value;
    const apellido = document.getElementById('p-apellido').value.toUpperCase(); // Siempre en mayúsculas
    const numero = document.getElementById('p-numero').value;
    const bandera = document.getElementById('p-bandera').value;
    const equipoId = document.getElementById('p-equipo').value;
    const foto = document.getElementById('p-foto').value;

    if (!nombre || !apellido || !numero || !equipoId) {
        alert("Faltan datos obligatorios del piloto.");
        return;
    }

    try {
        // En lugar de updateDoc, usamos addDoc para crear un documento NUEVO en la colección pilotos
        await addDoc(collection(db, "pilotos"), {
            nombre: nombre,
            apellido: apellido,
            numero: parseInt(numero), // Guardarlo como número
            bandera: bandera,
            equipo_id: equipoId,
            foto_url: foto
        });

        alert(`¡${apellido} fichado correctamente!`);
        
        // Limpiamos el formulario para meter el siguiente rápido
        document.getElementById('p-nombre').value = "";
        document.getElementById('p-apellido').value = "";
        document.getElementById('p-numero').value = "";
        document.getElementById('p-foto').value = "";

    } catch (error) {
        console.error("Error fichando piloto: ", error);
        alert("Error al intentar fichar al piloto.");
    }
});

// --- 6. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});