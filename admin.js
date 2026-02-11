import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// NUEVO: Importamos Storage
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
const storage = getStorage(app); // NUEVO: Encendemos el disco duro

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
    const archivoCoche = document.getElementById('input-foto-coche').files[0]; // Capturamos el archivo

    if (!idEquipo) { alert("Selecciona un equipo primero."); return; }

    try {
        const equipoRef = doc(db, "equipos", idEquipo);
        let datosAActualizar = { color: color };

        // Si el admin ha seleccionado una foto...
        if (archivoCoche) {
            alert("Subiendo diseño a la FIA, espera un momento...");
            // Creamos la ruta en el Storage (ej: coches/ferrari.png)
            const storageRef = ref(storage, 'coches/' + idEquipo + '_' + archivoCoche.name);
            // Subimos el archivo
            await uploadBytes(storageRef, archivoCoche);
            // Obtenemos la URL pública de la foto
            const urlDescarga = await getDownloadURL(storageRef);
            // La añadimos a los datos que vamos a guardar
            datosAActualizar.coche_url = urlDescarga; 
        }

        // Guardamos en la base de datos
        await updateDoc(equipoRef, datosAActualizar);
        alert("¡Diseño guardado correctamente!");
        document.getElementById('input-foto-coche').value = ""; // Limpiamos el input
        
    } catch (error) {
        console.error("Error actualizando equipo: ", error);
        alert("Hubo un error al subir la foto.");
    }
});

// --- 5. FICHAR PILOTO ---
document.getElementById('btnGuardarPiloto').addEventListener('click', async () => {
    const nombre = document.getElementById('p-nombre').value;
    const apellido = document.getElementById('p-apellido').value.toUpperCase();
    const numero = document.getElementById('p-numero').value;
    const bandera = document.getElementById('p-bandera').value;
    const equipoId = document.getElementById('p-equipo').value;
    const archivoFoto = document.getElementById('p-foto').files[0]; // Capturamos el archivo

    if (!nombre || !apellido || !numero || !equipoId) {
        alert("Faltan datos obligatorios del piloto.");
        return;
    }

    try {
        let urlFotoFinal = "https://media.formula1.com/d_default_fallback_profile.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/2col/image.png"; // Foto por defecto

        // Si has subido una foto...
        if (archivoFoto) {
            alert("Subiendo la foto del piloto...");
            const storageRef = ref(storage, 'pilotos/' + apellido + '_' + archivoFoto.name);
            await uploadBytes(storageRef, archivoFoto);
            urlFotoFinal = await getDownloadURL(storageRef);
        }

        // Guardamos todo en Firestore
        await addDoc(collection(db, "pilotos"), {
            nombre: nombre,
            apellido: apellido,
            numero: parseInt(numero),
            bandera: bandera,
            equipo_id: equipoId,
            foto_url: urlFotoFinal
        });

        alert(`¡${apellido} fichado correctamente!`);
        
        // Limpiamos
        document.getElementById('p-nombre').value = "";
        document.getElementById('p-apellido').value = "";
        document.getElementById('p-numero').value = "";
        document.getElementById('p-foto').value = "";

    } catch (error) {
        console.error("Error fichando piloto: ", error);
        alert("Error al intentar subir la foto.");
    }
});

// --- 6. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// Añade esta llamada dentro de iniciarPanelAdmin()
// iniciarPanelAdmin() { ... cargarPilotosEnSelect(); }

async function cargarPilotosEnSelect() {
    const selectPiloto = document.getElementById('select-piloto');
    selectPiloto.innerHTML = "<option value=''>Elige un piloto...</option>";

    const querySnapshot = await getDocs(collection(db, "pilotos"));
    
    querySnapshot.forEach((documento) => {
        const id = documento.id;
        const apellido = documento.data().apellido;
        const option = document.createElement("option");
        option.value = id; 
        option.text = apellido;
        selectPiloto.appendChild(option);
    });
}

// --- 6. SUBIR RESULTADOS DE CARRERA Y PAGAR PREMIOS ---

// Diccionario oficial de puntos de la FIA
const PUNTOS_F1 = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8,  7: 6,  8: 4,  9: 2,  10: 1
};

document.getElementById('btnSubirResultado').addEventListener('click', async () => {
    const idPiloto = document.getElementById('select-piloto').value;
    const posicion = parseInt(document.getElementById('input-posicion').value);
    const premio = parseFloat(document.getElementById('input-premio').value);

    if (!idPiloto || isNaN(posicion) || isNaN(premio)) {
        alert("Faltan datos en la torre de control. Rellena piloto, posición y premio.");
        return;
    }

    try {
        alert("Procesando telemetría y enviando transferencias...");

        // 1. Leer los datos actuales del piloto
        const pilotoRef = doc(db, "pilotos", idPiloto);
        const pilotoSnap = await getDoc(pilotoRef);
        const pilotoData = pilotoSnap.data();

        // 2. Calcular los nuevos puntos del piloto
        // Si quedó entre los 10 primeros, coge los puntos, si no, 0.
        const puntosGanados = PUNTOS_F1[posicion] || 0; 
        const puntosActuales = pilotoData.puntos || 0;
        const nuevosPuntos = puntosActuales + puntosGanados;

        // 3. Leer los datos actuales del equipo al que pertenece
        const equipoRef = doc(db, "equipos", pilotoData.equipo_id);
        const equipoSnap = await getDoc(equipoRef);
        const equipoData = equipoSnap.data();

        // 4. Calcular el nuevo presupuesto del equipo
        const presupuestoActual = equipoData.presupuesto || 0;
        const nuevoPresupuesto = presupuestoActual + premio;

        // 5. ¡Guardar todo en la base de datos a la vez!
        await updateDoc(pilotoRef, { puntos: nuevosPuntos });
        await updateDoc(equipoRef, { presupuesto: nuevoPresupuesto });

        alert(`¡Bandera a cuadros! \n${pilotoData.apellido} suma ${puntosGanados} puntos.\nSu equipo recibe $${premio}.`);

        // Limpiamos los inputs numéricos, pero dejamos el piloto por si quieres cambiar algo
        document.getElementById('input-posicion').value = "";
        document.getElementById('input-premio').value = "";

    } catch (error) {
        console.error("Error subiendo el resultado: ", error);
        alert("Hubo un error al procesar el resultado de la carrera.");
    }
});