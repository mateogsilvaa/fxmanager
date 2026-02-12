import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- CONFIGURACIÓN DE FIREBASE ---
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

const contenedor = document.getElementById('contenedor-equipos');

onAuthStateChanged(auth, async (user) => {
    contenedor.innerHTML = `<p>Cargando información...</p>`;

    if (user) {
        // 1. Comprobar si el usuario ya tiene un equipo.
        const q = query(collection(db, "equipos"), where("owner_uid", "==", user.uid));
        const equipoUsuarioSnap = await getDocs(q);

        if (!equipoUsuarioSnap.empty) {
            // Si ya tiene equipo, redirigir al dashboard.
            window.location.href = 'dashboard.html';
            return; 
        }
    }
    
    // 2. Si no tiene equipo o no está logueado, cargar y mostrar la lista de equipos.
    loadAndDisplayTeams(user);
});

async function loadAndDisplayTeams(user) {
    try {
        const [equiposSnap, pilotosSnap, configSnap] = await Promise.all([
            getDocs(collection(db, "equipos")),
            getDocs(collection(db, "pilotos")),
            getDoc(doc(db, "configuracion", "campeonato"))
        ]);

        const equipos = equiposSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pilotos = pilotosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const campeonatoAbierto = configSnap.exists() && configSnap.data().estado === 'offseason';

        contenedor.innerHTML = ''; // Limpiar el contenedor

        equipos.forEach(equipo => {
            const equipoPilotos = pilotos.filter(p => p.equipo_id === equipo.id);
            const estaLibre = !equipo.owner_uid;
            const puedeElegir = user && estaLibre && campeonatoAbierto;

            const equipoCard = document.createElement('div');
            equipoCard.className = 'equipo-card';
            equipoCard.innerHTML = `
                <div class="equipo-header">
                    <h3>${equipo.nombre}</h3>
                    <span class="estado-equipo ${estaLibre ? 'libre' : 'ocupado'}">${estaLibre ? 'Disponible' : 'Dirigido'}</span>
                </div>
                <div class="equipo-body">
                    <img src="/assets/img/descarga.png" alt="Coche de ${equipo.nombre}" class="equipo-coche-img">
                    <div class="pilotos-preview">
                        ${equipoPilotos.map(p => `<div class="piloto-tag">${p.nombre.charAt(0)}. ${p.apellido}</div>`).join('') || '<div class="piloto-tag">Sin pilotos</div>'}
                    </div>
                </div>
                <div class="equipo-footer">
                    ${puedeElegir ? `<button class="btn btn-primary" data-equipo-id="${equipo.id}">Dirigir Equipo</button>` : ''}
                    ${!estaLibre ? `<p class="dirigido-texto">Este equipo ya tiene un director asignado.</p>` : ''}
                    ${user && estaLibre && !campeonatoAbierto ? `<p class="dirigido-texto">El campeonato está en curso, no se pueden elegir equipos.</p>` : ''}
                </div>
            `;

            contenedor.appendChild(equipoCard);
        });

        // Añadir event listeners a los botones
        document.querySelectorAll('.btn[data-equipo-id]').forEach(button => {
            button.addEventListener('click', async (e) => {
                const equipoId = e.target.dataset.equipoId;
                const equipoNombre = equipos.find(eq => eq.id === equipoId).nombre;
                if (confirm(`¿Confirmas que quieres tomar las riendas de ${equipoNombre}?`)) {
                    await assignTeamToUser(equipoId, user.uid);
                }
            });
        });

    } catch (error) {
        console.error("Error al cargar los equipos: ", error);
        contenedor.innerHTML = `<p style="color: var(--danger);">Error al cargar la información de los equipos.</p>`;
    }
}

async function assignTeamToUser(equipoId, userId) {
    try {
        const equipoRef = doc(db, "equipos", equipoId);
        await updateDoc(equipoRef, { owner_uid: userId });
        alert('¡Enhorabuena! Has sido asignado como director de equipo. Serás redirigido a tu nuevo dashboard.');
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error("Error al asignar equipo: ", error);
        alert('No se pudo procesar tu solicitud. Inténtalo de nuevo.');
    }
}
