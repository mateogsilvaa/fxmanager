// 1. Importaciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Tu configuración exacta
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

// 3. Verificar quién está logueado
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioActual = user;
        cargarEquipos(); // Si está logueado, cargamos los coches
    } else {
        window.location.href = "index.html"; // Si no, patada al login
    }
});

// 4. Función para descargar los equipos de la Base de Datos
async function cargarEquipos() {
    const contenedor = document.getElementById('equipos-container');
    contenedor.innerHTML = ""; // Limpiamos el texto de "Cargando..."

    try {
        const querySnapshot = await getDocs(collection(db, "equipos"));
        
        querySnapshot.forEach((documento) => {
            const equipo = documento.data();
            const idEquipo = documento.id; // ej: "ferrari"
            const estaOcupado = equipo.owner_uid && equipo.owner_uid !== "";

            // Creamos la tarjeta del coche
            const card = document.createElement('div');
            card.className = 'equipo-card';
            
            // Decidimos qué botón mostrar (Verde de elegir o Gris de ocupado)
            let botonHTML = "";
            if (estaOcupado) {
                // Si el dueño es el propio usuario actual
                if (equipo.owner_uid === usuarioActual.uid) {
                    botonHTML = `<button class="btn-elegir" style="background-color: #33b5e5;" onclick="irAlDashboard()">Tu Equipo (Ir al Box)</button>`;
                } else {
                    botonHTML = `<button class="btn-elegir btn-ocupado" disabled>Equipo Ocupado</button>`;
                    card.style.borderColor = "#ff4444"; // Borde rojo
                }
            } else {
                // Si está libre
                botonHTML = `<button class="btn-elegir" onclick="elegirEquipo('${idEquipo}')">Firmar Contrato</button>`;
            }

            card.innerHTML = `
                <h2>${equipo.nombre}</h2>
                <p>Presupuesto inicial: $${equipo.presupuesto}</p>
                ${botonHTML}
            `;
            
            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando equipos: ", error);
        document.getElementById('mensaje-estado').innerText = "Error de conexión con la FIA.";
    }
}

// 5. Función que se ejecuta al pulsar "Firmar Contrato"
window.elegirEquipo = async function(idEquipo) {
    const confirmacion = confirm(`¿Estás seguro de que quieres dirigir ${idEquipo.toUpperCase()}? Esta decisión es final.`);
    
    if (confirmacion) {
        try {
            // Actualizamos el documento en Firebase
            const equipoRef = doc(db, "equipos", idEquipo);
            await updateDoc(equipoRef, {
                owner_uid: usuarioActual.uid // Escribimos el ID del usuario en el coche
            });

            alert("¡Contrato firmado! Bienvenido al paddock.");
            window.location.href = "dashboard.html"; // Lo mandamos a su panel

        } catch (error) {
            alert("Error al firmar: Alguien podría habérselo llevado un segundo antes.");
            console.error(error);
        }
    }
};

// Función auxiliar
window.irAlDashboard = function() {
    window.location.href = "dashboard.html";
};