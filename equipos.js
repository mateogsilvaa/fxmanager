import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

async function cargarTodo() {
    onAuthStateChanged(auth, async (user) => {
        try {
            contenedor.innerHTML = `<p>Cargando información de la FIA...</p>`;
            
            // Cargar datos en paralelo
            const [campeonatoDoc, equiposSnap, pilotosSnap] = await Promise.all([
                getDoc(doc(db, "configuracion", "campeonato")),
                getDocs(collection(db, "equipos")),
                getDocs(collection(db, "pilotos"))
            ]);

            const estadoCampeonato = campeonatoDoc.exists() ? campeonatoDoc.data().estado : "offseason";

            // Procesar equipos y pilotos
            const equipos = {};
            equiposSnap.forEach(d => {
                equipos[d.id] = { id: d.id, ...d.data(), pilotos: [] };
            });
            pilotosSnap.forEach(d => {
                const piloto = { id: d.id, ...d.data() };
                if (piloto.equipo_id && equipos[piloto.equipo_id]) {
                    equipos[piloto.equipo_id].pilotos.push(piloto);
                }
            });
            
            // Comprobar si el usuario ya tiene equipo
            let usuarioTieneEquipo = false;
            if(user){
                const equiposArray = Object.values(equipos);
                const equipoDelUsuario = equiposArray.find(eq => eq.owner_uid === user.uid);
                if(equipoDelUsuario) {
                    usuarioTieneEquipo = true;
                }
            }

            // Renderizar
            renderizarEquipos(Object.values(equipos), user, estadoCampeonato, usuarioTieneEquipo);

        } catch (error) {
            console.error("Error al cargar datos:", error);
            contenedor.innerHTML = `<p style="color: var(--danger);">Error al cargar la información.</p>`;
        }
    });
}

function renderizarEquipos(equipos, user, estadoCampeonato, usuarioTieneEquipo) {
    contenedor.innerHTML = '';
    equipos.forEach(equipo => {
        const equipoCard = document.createElement('div');
        equipoCard.className = 'equipo-card';

        const puedeElegir = user && !equipo.owner_uid && estadoCampeonato === 'offseason' && !usuarioTieneEquipo;

        equipoCard.innerHTML = `
            <div class="equipo-header">
                <img src="assets/img/descarga.png" alt="Coche de ${equipo.nombre}" class="equipo-coche-img">
                <h3 style="color: ${equipo.color || 'var(--accent)'};">${equipo.nombre}</h3>
                <button class="deploy-arrow">▼</button>
            </div>
            <div class="pilotos-container collapsed">
                ${renderizarPilotos(equipo.pilotos, equipo.color)}
                ${puedeElegir ? `<button class="btn btn-primary btn-elegir-equipo" data-equipo-id="${equipo.id}">Dirigir ${equipo.nombre}</button>` : ''}
                ${equipo.owner_uid ? '<p class="equipo-asignado">Equipo ya dirigido</p>' : ''}
            </div>
        `;

        const btn = equipoCard.querySelector('.deploy-arrow');
        const pilotosContainer = equipoCard.querySelector('.pilotos-container');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            pilotosContainer.classList.toggle('collapsed');
            btn.textContent = pilotosContainer.classList.contains('collapsed') ? '▼' : '▲';
        });

        contenedor.appendChild(equipoCard);
    });

    // Añadir listeners a los botones de elegir
    document.querySelectorAll('.btn-elegir-equipo').forEach(button => {
        button.addEventListener('click', async (e) => {
            const equipoId = e.target.dataset.equipoId;
            if (confirm(`¿Estás seguro que quieres tomar las riendas de ${equipos.find(eq => eq.id === equipoId).nombre}?`)) {
                await elegirEquipo(equipoId, user.uid);
            }
        });
    });
}

function renderizarPilotos(pilotos, colorEquipo) {
    if (pilotos.length === 0) return '<p class="no-pilotos">Sin pilotos asignados.</p>';
    return pilotos.map(p => `
        <div class="piloto-card">
            <img src="assets/img/descarga.png" alt="Foto de ${p.nombre}" class="piloto-foto">
            <div class="piloto-info">
                <p class="piloto-nombre"><span>${p.nombre}</span> <strong style="color: ${colorEquipo || 'var(--accent)'};">${p.apellido}</strong></p>
                <p class="piloto-detalle">${p.bandera || ''} #${p.numero}</p>
            </div>
        </div>
    `).join('');
}

async function elegirEquipo(equipoId, userId) {
    try {
        const equipoRef = doc(db, "equipos", equipoId);
        await updateDoc(equipoRef, { owner_uid: userId });
        alert('¡Felicidades! Ahora eres el jefe de equipo. ¡Mucha suerte en la temporada!');
        window.location.href = 'dashboard.html'; 
    } catch (error) {
        console.error("Error al elegir equipo:", error);
        alert('Hubo un error al procesar tu solicitud. Inténtalo de nuevo.');
    }
}

document.addEventListener('DOMContentLoaded', cargarTodo);
