import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- CONFIGURACIÓN ---
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
let allEquipos = [];
let allPilotos = [];

// --- INICIALIZACIÓN ---
onAuthStateChanged(auth, user => {
    if (user) {
        // Aquí podrías añadir una comprobación de si el UID es de un admin
        loadInitialData();
        setupEventListeners();
        listenForSolicitudes();
    } else {
        window.location.href = 'index.html';
    }
});

async function loadInitialData() {
    const [equiposSnap, pilotosSnap] = await Promise.all([
        getDocs(collection(db, "equipos")),
        getDocs(collection(db, "pilotos"))
    ]);
    allEquipos = equiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allPilotos = pilotosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    populateComunicadosSelects();
}

function setupEventListeners() {
    document.getElementById('btnCerrarSesion').addEventListener('click', () => signOut(auth));
    document.getElementById('btnEnviarComunicado').addEventListener('click', enviarComunicado);
    // Setup de los tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-content.active, .tab-btn.active').forEach(el => el.classList.remove('active'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            btn.classList.add('active');
        });
    });
}

// --- SOLICITUDES ---
function listenForSolicitudes() {
    const container = document.getElementById('solicitudes-container');
    const q = query(collection(db, "solicitudes"), where("estado", "==", "pendiente"), orderBy("timestamp"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = '<p>No hay solicitudes pendientes.</p>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const solicitud = { id: doc.id, ...doc.data() };
            container.appendChild(createSolicitudCard(solicitud));
        });
    });
}

function createSolicitudCard(solicitud) {
    const card = document.createElement('div');
    card.className = 'solicitud-card';
    card.innerHTML = `
        <div class="solicitud-header">
            <span><strong>${solicitud.tipo.toUpperCase()}</strong> - ${solicitud.equipoNombre}</span>
            <span>${solicitud.timestamp?.toDate().toLocaleDateString() || 'Reciente'}</span>
        </div>
        <div class="solicitud-body">${renderSolicitudBody(solicitud)}</div>
        <div class="solicitud-actions">
            <button class="btn btn-success">Aprobar</button>
            <button class="btn btn-warning">Denegar</button>
        </div>
    `;
    
    const approveBtn = card.querySelector('.btn-success');
    const denyBtn = card.querySelector('.btn-warning');

    approveBtn.addEventListener('click', () => handleSolicitud(solicitud, 'aprobada'));
    denyBtn.addEventListener('click', () => handleSolicitud(solicitud, 'denegada'));
    
    return card;
}

function renderSolicitudBody(solicitud) {
    switch(solicitud.tipo) {
        case 'Mejora':
            return `Solicita mejorar <strong>${solicitud.detalle.pieza}</strong>. Coste: ${solicitud.coste.toLocaleString()}$`;
        case 'Investigación':
            return `Solicita investigar a <strong>${solicitud.detalle.pilotoNombre || solicitud.detalle.equipoNombre}</strong>.`;
        case 'Fichaje':
            return `Oferta de <strong>${solicitud.detalle.oferta.toLocaleString()}$</strong> por el piloto <strong>${solicitud.detalle.pilotoNombre}</strong>.`;
        default: return 'Solicitud no reconocida.';
    }
}

async function handleSolicitud(solicitud, nuevoEstado) {
    const outcome = nuevoEstado === 'aprobada' ? prompt('Describe el resultado (ej: \"La mejora ha sido un éxito\")') : 'Solicitud denegada por la FIA.';
    if (nuevoEstado === 'aprobada' && !outcome) return; // Si se cancela el prompt

    try {
        await updateDoc(doc(db, "solicitudes", solicitud.id), { estado: nuevoEstado, resultado: outcome });
        
        // Crear aviso para el equipo
        await addDoc(collection(db, "avisos"), {
            equipoId: solicitud.equipoId,
            remitente: "FIA",
            mensaje: `Tu solicitud de ${solicitud.tipo} (${renderSolicitudBody(solicitud)}) ha sido <strong>${nuevoEstado.toUpperCase()}</strong>. Resultado: ${outcome}`,
            timestamp: serverTimestamp()
        });

        // Aquí la lógica específica para cada tipo si es aprobada
        if (nuevoEstado === 'aprobada') {
            if(solicitud.tipo === 'Fichaje'){
                 // Notificar al equipo rival
                const piloto = allPilotos.find(p => p.id === solicitud.detalle.pilotoId);
                if(piloto){
                     await addDoc(collection(db, "avisos"), {
                        equipoId: piloto.equipo_id,
                        remitente: "FIA",
                        mensaje: `El equipo ${solicitud.equipoNombre} ha hecho una oferta por tu piloto ${piloto.nombre} ${piloto.apellido}.`,
                        timestamp: serverTimestamp()
                    });
                }
            }
        }

    } catch (error) {
        console.error("Error al manejar la solicitud:", error);
        alert('No se pudo procesar la solicitud.');
    }
}

// --- COMUNICADOS ---
function populateComunicadosSelects() {
    const remitenteSelect = document.getElementById('com-remitente');
    const destinatarioSelect = document.getElementById('com-destinatario');
    
    allPilotos.forEach(p => {
        remitenteSelect.innerHTML += `<option value="piloto_${p.id}">Piloto: ${p.nombre} ${p.apellido}</option>`;
    });
    allEquipos.forEach(e => {
        destinatarioSelect.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
}

async function enviarComunicado() {
    const remitente = document.getElementById('com-remitente').value;
    const destinatarioId = document.getElementById('com-destinatario').value;
    const mensaje = document.getElementById('com-mensaje').value;

    if (!mensaje) return alert('El mensaje no puede estar vacío.');

    let remitenteDisplay = "FIA";
    if(remitente.startsWith('piloto_')){
        const pilotoId = remitente.split('_')[1];
        const piloto = allPilotos.find(p => p.id === pilotoId);
        remitenteDisplay = `Piloto: ${piloto.nombre} ${piloto.apellido}`;
    }

    try {
        const promises = [];
        if (destinatarioId === 'todos') {
            allEquipos.forEach(equipo => {
                promises.push(addDoc(collection(db, "avisos"), {
                    equipoId: equipo.id,
                    remitente: remitenteDisplay,
                    mensaje: mensaje,
                    timestamp: serverTimestamp()
                }));
            });
        } else {
            promises.push(addDoc(collection(db, "avisos"), {
                equipoId: destinatarioId,
                remitente: remitenteDisplay,
                mensaje: mensaje,
                timestamp: serverTimestamp()
            }));
        }
        await Promise.all(promises);
        alert('Comunicado enviado correctamente.');
        document.getElementById('com-mensaje').value = '';
    } catch (error) {
        console.error("Error enviando comunicado:", error);
        alert('No se pudo enviar el comunicado.');
    }
}
