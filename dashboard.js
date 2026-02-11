import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, onSnapshot, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let usuarioActual = null;
let miEquipoId = null;
let datosEquipo = null;

// --- 1. COMPROBAR SESIÓN Y BUSCAR MI EQUIPO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActual = user;
        buscarMiEquipo();
    } else {
        window.location.href = "index.html";
    }
});

async function buscarMiEquipo() {
    // Buscamos en la colección 'equipos' cuál tiene mi UID
    const q = query(collection(db, "equipos"), where("owner_uid", "==", usuarioActual.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        // Si no tiene equipo asignado, lo mandamos a elegir uno
        window.location.href = "seleccion.html";
    } else {
        // ¡Encontramos su equipo!
        miEquipoId = querySnapshot.docs[0].id; // ej: "ferrari"
        cargarPilotosDelEquipo();
        escucharCambiosDelEquipo(); // Conectamos en tiempo real
    }
}

// --- 2. ESCUCHAR EL EQUIPO EN TIEMPO REAL ---
// Esto hace que si tú (Admin) le das dinero, su pantalla se actualice sola sin recargar
function escucharCambiosDelEquipo() {
    const equipoRef = doc(db, "equipos", miEquipoId);
    
    onSnapshot(equipoRef, (docSnap) => {
        datosEquipo = docSnap.data();
        
        // Valores por defecto si la base de datos está vacía
        if(!datosEquipo.nivel_motor) datosEquipo.nivel_motor = 1;
        if(!datosEquipo.nivel_chasis) datosEquipo.nivel_chasis = 1;

        pintarInterfaz();
    });
}

function pintarInterfaz() {
    document.getElementById('header-equipo').style.display = "flex";
    document.getElementById('header-equipo').style.borderLeftColor = datosEquipo.color || "#555";
    document.getElementById('ui-nombre-equipo').innerText = datosEquipo.nombre;
    document.getElementById('ui-nombre-equipo').style.color = datosEquipo.color || "#fff";
    
    // Formatear dinero bonito (ej: 150,000)
    document.getElementById('ui-presupuesto').innerText = "$" + (datosEquipo.presupuesto || 0).toLocaleString();
    
    document.getElementById('ui-foto-coche').src = datosEquipo.coche_url || "https://media.formula1.com/d_default_fallback_car.png/content/dam/fom-website/teams/2024/mercedes.png.transform/4col/image.png";

    actualizarTienda();
}

// --- 3. CARGAR PILOTOS DE ESTE EQUIPO ---
async function cargarPilotosDelEquipo() {
    const q = query(collection(db, "pilotos"), where("equipo_id", "==", miEquipoId));
    const querySnapshot = await getDocs(q);
    
    const uiPilotos = document.getElementById('ui-pilotos');
    uiPilotos.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
        let p = docSnap.data();
        let foto = p.foto_url || "https://media.formula1.com/d_default_fallback_profile.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/2col/image.png";
        
        uiPilotos.innerHTML += `
            <div class="piloto-mini">
                <img src="${foto}" alt="${p.apellido}">
                <div>
                    <span style="font-size:12px; color:#aaa; display:block;">${p.numero} ${p.bandera}</span>
                    <strong style="text-transform:uppercase;">${p.apellido}</strong>
                </div>
            </div>
        `;
    });
}

// --- 4. LA TIENDA DE MEJORAS ---
function actualizarTienda() {
    // Calculamos el coste de la próxima mejora (Sube 50k por nivel de motor, 40k por chasis)
    const costeMotor = datosEquipo.nivel_motor * 50000;
    const costeChasis = datosEquipo.nivel_chasis * 40000;

    // Pintamos los textos
    document.getElementById('motor-titulo').innerText = `Unidad de Potencia (Nivel ${datosEquipo.nivel_motor})`;
    document.getElementById('chasis-titulo').innerText = `Chasis y Peso (Nivel ${datosEquipo.nivel_chasis})`;

    const btnMotor = document.getElementById('btnMejoraMotor');
    const btnChasis = document.getElementById('btnMejoraChasis');

    btnMotor.innerText = `Comprar: $${costeMotor.toLocaleString()}`;
    btnChasis.innerText = `Comprar: $${costeChasis.toLocaleString()}`;

    // Bloqueamos los botones si son pobres
    btnMotor.disabled = (datosEquipo.presupuesto < costeMotor);
    btnChasis.disabled = (datosEquipo.presupuesto < costeChasis);
}

// Función maestra para comprar
window.comprarMejora = async function(tipoMejora) {
    let coste = 0;
    let nuevoNivel = 0;
    let campoEnBD = "";
    let nombreAmigable = "";

    if (tipoMejora === 'motor') {
        coste = datosEquipo.nivel_motor * 50000;
        nuevoNivel = datosEquipo.nivel_motor + 1;
        campoEnBD = "nivel_motor";
        nombreAmigable = "Unidad de Potencia";
    } else if (tipoMejora === 'chasis') {
        coste = datosEquipo.nivel_chasis * 40000;
        nuevoNivel = datosEquipo.nivel_chasis + 1;
        campoEnBD = "nivel_chasis";
        nombreAmigable = "Chasis y Peso";
    }

    // Doble check de seguridad por si acaso
    if (datosEquipo.presupuesto < coste) {
        alert("¡No hay suficiente presupuesto en la fábrica!");
        return;
    }

    const confirmar = confirm(`¿Autorizas gastar $${coste.toLocaleString()} en I+D para mejorar el ${nombreAmigable} al Nivel ${nuevoNivel}?`);
    if(!confirmar) return;

    try {
        const equipoRef = doc(db, "equipos", miEquipoId);
        
        // 1. Restar dinero y sumar nivel al coche
        await updateDoc(equipoRef, {
            presupuesto: datosEquipo.presupuesto - coste,
            [campoEnBD]: nuevoNivel
        });

        // 2. ENVIAR NOTIFICACIÓN A LA FIA (Al Admin)
        await addDoc(collection(db, "registro_cambios"), {
            equipo_id: miEquipoId,
            equipo_nombre: datosEquipo.nombre,
            mejora: nombreAmigable,
            nuevo_nivel: nuevoNivel,
            fecha: new Date().toLocaleString(),
            aplicado_en_ac: false // Para que tú sepas si ya lo has configurado en el juego
        });

        alert("¡Mejora fabricada! La FIA ha sido notificada para Assetto Corsa.");

    } catch (error) {
        console.error("Error comprando mejora: ", error);
        alert("Error de comunicación con la fábrica.");
    }
}

// Conectamos los botones a la función maestra
document.getElementById('btnMejoraMotor').addEventListener('click', () => window.comprarMejora('motor'));
document.getElementById('btnMejoraChasis').addEventListener('click', () => window.comprarMejora('chasis'));

// --- 5. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});