import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- CONFIGURACIÓN E INICIALIZACIÓN ---
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

// --- ESTADO GLOBAL ---
let currentEquipo = null;
let allPilotos = [];
let allEquipos = [];
let campeonatoState = { estado: "offseason", investigaciones: 2 };

// --- ARRANQUE ---
onAuthStateChanged(auth, user => {
    if (user) {
        setupDashboard(user);
    } else {
        window.location.href = 'index.html';
    }
});

async function setupDashboard(user) {
    const mainContainer = document.getElementById('dashboard-container');
    mainContainer.innerHTML = `<p>Cargando dashboard...</p>`;
    try {
        const [equipoSnap, allEquiposSnap, allPilotosSnap, campeonatoDoc] = await Promise.all([
            getDocs(query(collection(db, "equipos"), where("owner_uid", "==", user.uid))),
            getDocs(collection(db, "equipos")),
            getDocs(collection(db, "pilotos")),
            getDoc(doc(db, "configuracion", "campeonato"))
        ]);

        if (equipoSnap.empty) {
            window.location.href = 'equipos.html';
            return;
        }

        currentEquipo = { id: equipoSnap.docs[0].id, ...equipoSnap.docs[0].data() };
        allEquipos = allEquiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allPilotos = allPilotosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (campeonatoDoc.exists()) campeonatoState = campeonatoDoc.data();

        const pilotosDelEquipo = allPilotos.filter(p => p.equipo_id === currentEquipo.id);

        renderDashboard(pilotosDelEquipo);
        setupInteractiveElements();

    } catch (error) {
        console.error("Error al montar el dashboard:", error);
        mainContainer.innerHTML = `<p style="color: var(--danger);">Error crítico al cargar tus datos.</p>`;
    }
}

// --- RENDERIZADO HTML ---
function renderDashboard(pilotosDelEquipo) {
    const template = document.getElementById('template-dashboard').innerHTML;
    document.getElementById('dashboard-container').innerHTML = template;
    document.getElementById('team-name').textContent = currentEquipo.nombre;
    document.getElementById('team-budget').textContent = `${(currentEquipo.presupuesto || 0).toLocaleString()}$`;

    renderTeamStats(document.getElementById('team-stats'));
    if (pilotosDelEquipo[0]) renderPilotStats(document.getElementById('pilot-1'), pilotosDelEquipo[0]);
    if (pilotosDelEquipo[1]) renderPilotStats(document.getElementById('pilot-2'), pilotosDelEquipo[1]);
    
    document.getElementById('btnCerrarSesion').addEventListener('click', () => signOut(auth));
}

function renderTeamStats(container) {
    container.innerHTML = `
        <h3>Estadísticas del Equipo</h3>
        <div class="stat-item"><span>Victorias</span> <strong>${currentEquipo.victorias || 0}</strong></div>
        <div class="stat-item"><span>Podios</span> <strong>${currentEquipo.podios || 0}</strong></div>
        <div class="stat-item"><span>Poles</span> <strong>${currentEquipo.poles || 0}</strong></div>
        <div class="stat-item"><span>Puntos</span> <strong>${currentEquipo.puntos || 0}</strong></div>
        <div class="stat-item"><span>DNFs</span> <strong>${currentEquipo.dnfs || 0}</strong></div>
        <div class="stat-item"><span>Campeonatos</span> <strong>${currentEquipo.campeonatos || 0}</strong></div>
    `;
}

function renderPilotStats(container, piloto) {
     container.innerHTML = `
        <h3>${piloto.nombre} ${piloto.apellido}</h3>
        <p>${piloto.bandera || ''} Edad: ${piloto.edad || 'N/A'}</p>
        <div class="stat-item"><span>Ritmo</span> <strong>${piloto.ritmo || '??'}</strong></div>
        <div class="stat-item"><span>Agresividad</span> <strong>${piloto.agresividad || '??'}</strong></div>
        <div class="stat-item"><span>Moral</span> <strong>${piloto.moral || 75}/100</strong></div>
        <div class="stat-item"><span>Sueldo</span> <span id="sueldo-piloto-${piloto.id}">${(piloto.sueldo || 1000000).toLocaleString()}$</span></div>
        <input type="range" class="salary-bar" data-piloto-id="${piloto.id}" min="500000" max="10000000" step="100000" value="${piloto.sueldo || 1000000}">
    `;
}

// --- LÓGICA INTERACTIVA ---
function setupInteractiveElements() {
    setupTabs();
    setupMejoras();
    setupInvestigacion();
    setupFichajes();
    loadAvisos();

    document.querySelectorAll('.salary-bar').forEach(bar => {
        bar.addEventListener('input', (e) => {
            const sueldo = e.target.value;
            const pilotoId = e.target.dataset.pilotoId;
            document.getElementById(`sueldo-piloto-${pilotoId}`).textContent = `${parseInt(sueldo).toLocaleString()}$`;
        });
         bar.addEventListener('change', async (e) => {
            const sueldo = parseInt(e.target.value);
            const pilotoId = e.target.dataset.pilotoId;
            await updateDoc(doc(db, "pilotos", pilotoId), { sueldo: sueldo });
            alert("Sueldo actualizado.");
        });
    });
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabContents.forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

async function sendRequest(tipo, detalle, coste = 0) {
    if (coste > 0 && currentEquipo.presupuesto < coste) {
        return alert('Presupuesto insuficiente para esta operación.');
    }
    try {
        await addDoc(collection(db, "solicitudes"), {
            equipoId: currentEquipo.id,
            equipoNombre: currentEquipo.nombre,
            tipo: tipo,
            detalle: detalle,
            coste: coste,
            estado: 'pendiente',
            timestamp: serverTimestamp()
        });

        if (coste > 0) {
            const newBudget = currentEquipo.presupuesto - coste;
            await updateDoc(doc(db, "equipos", currentEquipo.id), { presupuesto: newBudget });
            currentEquipo.presupuesto = newBudget;
            document.getElementById('team-budget').textContent = `${newBudget.toLocaleString()}$`;
        }
        alert(`Solicitud de ${tipo} enviada al administrador para su revisión.`);
        
    } catch (error) {
        console.error(`Error enviando solicitud de ${tipo}:`, error);
        alert('Hubo un error al procesar la solicitud.');
    }
}

function setupMejoras() {
    document.querySelectorAll('[data-mejora]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tipoMejora = btn.dataset.mejora;
            const coste = tipoMejora === 'chasis' ? 1000000 : 1500000; // Costes de ejemplo
            if (confirm(`Se invertirá ${coste.toLocaleString()}$ en la mejora de ${tipoMejora}. El dinero se descontará inmediatamente. ¿Continuar?`)) {
                sendRequest('Mejora', { pieza: tipoMejora }, coste);
            }
        });
    });
}

function setupInvestigacion() {
    const selectSujeto = document.getElementById('investigacion-sujeto');
    const btnInvestigar = document.getElementById('btn-investigar');
    const restantesEl = document.getElementById('investigaciones-restantes');
    
    restantesEl.textContent = campeonatoState.investigaciones || 0;

    // Llenar el select con pilotos y equipos rivales
    allPilotos.filter(p => p.equipo_id !== currentEquipo.id).forEach(p => {
        selectSujeto.innerHTML += `<option value="piloto_${p.id}">Piloto: ${p.nombre} ${p.apellido}</option>`;
    });
    allEquipos.filter(e => e.id !== currentEquipo.id).forEach(e => {
        selectSujeto.innerHTML += `<option value="equipo_${e.id}">Equipo: ${e.nombre}</option>`;
    });

    btnInvestigar.addEventListener('click', () => {
        if (campeonatoState.estado !== 'en curso') {
            return alert('Solo se puede investigar durante la temporada.');
        }
        if ((campeonatoState.investigaciones || 0) <= 0) {
            return alert('No te quedan investigaciones esta temporada.');
        }
        const sujeto = selectSujeto.value;
        if (!sujeto) return alert('Selecciona un sujeto para investigar.');

        if (confirm('¿Confirmas que quieres usar una de tus investigaciones en este sujeto?')) {
            const [tipo, id] = sujeto.split('_');
            const detalle = tipo === 'piloto' ? 
                { tipo: 'Piloto', pilotoId: id, pilotoNombre: allPilotos.find(p=>p.id===id).nombre + ' ' + allPilotos.find(p=>p.id===id).apellido } : 
                { tipo: 'Equipo', equipoId: id, equipoNombre: allEquipos.find(e=>e.id===id).nombre };
            sendRequest('Investigación', detalle);
            // Esto debería ser manejado por el admin, pero lo simulamos aquí
            campeonatoState.investigaciones--;
            restantesEl.textContent = campeonatoState.investigaciones;
        }
    });
}

function setupFichajes() {
    const selectPiloto = document.getElementById('fichaje-piloto');
    const inputOferta = document.getElementById('fichaje-oferta');
    const btnFichar = document.getElementById('btn-fichar');

    allPilotos.filter(p => p.equipo_id !== currentEquipo.id).forEach(p => {
        selectPiloto.innerHTML += `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`;
    });

    btnFichar.addEventListener('click', () => {
        const pilotoId = selectPiloto.value;
        const oferta = parseInt(inputOferta.value);
        if (!pilotoId) return alert('Selecciona un piloto.');
        if (!oferta || oferta <= 0) return alert('Introduce una oferta válida.');

        const piloto = allPilotos.find(p => p.id === pilotoId);
        if (confirm(`¿Realizar una oferta de ${oferta.toLocaleString()}$ a ${piloto.nombre} ${piloto.apellido}?`)) {
            sendRequest('Fichaje', { pilotoId: pilotoId, pilotoNombre: `${piloto.nombre} ${piloto.apellido}`, oferta: oferta }, oferta);
        }
    });
}

function loadAvisos() {
    const container = document.getElementById('avisos-container');
    const q = query(collection(db, "avisos"), where("equipoId", "==", currentEquipo.id), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = '<p>No tienes nuevos avisos.</p>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const aviso = doc.data();
            const date = aviso.timestamp?.toDate().toLocaleDateString() || 'Reciente';
            container.innerHTML += `
                <div class="aviso">
                    <p class="aviso-header"><strong>${aviso.remitente}</strong> - ${date}</p>
                    <p>${aviso.mensaje}</p>
                </div>
            `;
        });
    });
}
