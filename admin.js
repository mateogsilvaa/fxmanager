import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
const storage = getStorage(app);

// --- ESTADO GLOBAL ---
let allEquipos = [];
let allPilotos = [];
let currentMediaId = null; // Para editar

// --- INICIALIZACIÓN ---
onAuthStateChanged(auth, user => {
    if (user) {
        loadInitialData();
        setupEventListeners();
        listenForSolicitudes();
        listenForMedia();
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
    document.getElementById('btnNuevaPublicacion').addEventListener('click', openMediaModalForCreate);
    document.getElementById('btnGuardarMedia').addEventListener('click', saveMedia);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-content.active, .tab-btn.active').forEach(el => el.classList.remove('active'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            btn.classList.add('active');
        });
    });
}

// --- GESTIÓN DE MEDIA ---
function listenForMedia() {
    const container = document.getElementById('media-management-container');
    const q = query(collection(db, "media"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = snapshot.empty ? '<p>No hay publicaciones.</p>' : '';
        snapshot.forEach(doc => {
            container.appendChild(createMediaItem(doc.id, doc.data()));
        });
    });
}

function createMediaItem(id, data) {
    const item = document.createElement('div');
    item.className = 'media-item';
    item.innerHTML = `
        <div class="media-item-info">
            <strong>${data.titulo}</strong>
            <small>${data.timestamp?.toDate().toLocaleDateString() || 'Reciente'}</small>
        </div>
        <div class="media-item-actions">
            <button class="btn btn-secondary btn-sm">Editar</button>
            <button class="btn btn-danger btn-sm">Eliminar</button>
        </div>
    `;

    item.querySelector('.btn-secondary').addEventListener('click', () => openMediaModalForEdit(id, data));
    item.querySelector('.btn-danger').addEventListener('click', () => deleteMedia(id, data.imagenURL));

    return item;
}

function openMediaModalForCreate() {
    currentMediaId = null;
    document.getElementById('media-modal-title').innerText = 'Nueva Publicación';
    document.getElementById('media-id').value = '';
    document.getElementById('media-titulo').value = '';
    document.getElementById('media-resumen').value = '';
    document.getElementById('media-imagen-url').value = '';
    document.getElementById('media-autor').value = 'Admin';
    abrirModal('modalMedia');
}

function openMediaModalForEdit(id, data) {
    currentMediaId = id;
    document.getElementById('media-modal-title').innerText = 'Editar Publicación';
    document.getElementById('media-id').value = id;
    document.getElementById('media-titulo').value = data.titulo;
    document.getElementById('media-resumen').value = data.resumen;
    document.getElementById('media-imagen-url').value = data.imagenURL || '';
    document.getElementById('media-autor').value = data.autor || 'Admin';
    abrirModal('modalMedia');
}

async function saveMedia() {
    const titulo = document.getElementById('media-titulo').value;
    const resumen = document.getElementById('media-resumen').value;
    let imagenURL = document.getElementById('media-imagen-url').value;
    const autor = document.getElementById('media-autor').value;

    if (!titulo || !resumen) {
        return alert('El título y el resumen son obligatorios.');
    }

    const mediaData = {
        titulo,
        resumen,
        autor,
        imagenURL,
        timestamp: serverTimestamp()
    };

    try {
        if (currentMediaId) {
            await updateDoc(doc(db, "media", currentMediaId), mediaData);
        } else {
            await addDoc(collection(db, "media"), mediaData);
        }
        cerrarModal('modalMedia');
    } catch (error) {
        console.error("Error guardando publicación: ", error);
        alert('No se pudo guardar la publicación.');
    }
}

async function deleteMedia(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta publicación?')) return;

    try {
        await deleteDoc(doc(db, "media", id));
    } catch (error) {
        console.error("Error eliminando publicación: ", error);
        alert('No se pudo eliminar la publicación.');
    }
}

// --- SOLICITUDES (sin cambios) ---
function listenForSolicitudes() {
    const q = query(collection(db, "solicitudes"), where("estado", "==", "pendiente"), orderBy("timestamp"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('solicitudes-container');
        container.innerHTML = snapshot.empty ? '<p>No hay solicitudes pendientes.</p>' : '';
        snapshot.forEach(doc => {
            container.appendChild(createSolicitudCard({ id: doc.id, ...doc.data() }));
        });
    });
}

function createSolicitudCard(solicitud) {
    const card = document.createElement('div');
    card.className = 'solicitud-card';
    card.innerHTML = `
        <div class="solicitud-header"><span><strong>${solicitud.tipo.toUpperCase()}</strong> - ${solicitud.equipoNombre}</span><span>${solicitud.timestamp?.toDate().toLocaleDateString() || 'Reciente'}</span></div>
        <div class="solicitud-body">${renderSolicitudBody(solicitud)}</div>
        <div class="solicitud-actions"><button class="btn btn-success">Aprobar</button><button class="btn btn-warning">Denegar</button></div>
    `;
    card.querySelector('.btn-success').addEventListener('click', () => handleSolicitud(solicitud, 'aprobada'));
    card.querySelector('.btn-warning').addEventListener('click', () => handleSolicitud(solicitud, 'denegada'));
    return card;
}

function renderSolicitudBody(solicitud) {
    switch(solicitud.tipo) {
        case 'Mejora': return `Solicita mejorar <strong>${solicitud.detalle.pieza}</strong>. Coste: ${solicitud.coste.toLocaleString()}$`;
        case 'Investigación': return `Solicita investigar a <strong>${solicitud.detalle.pilotoNombre || solicitud.detalle.equipoNombre}</strong>.`;
        case 'Fichaje': return `Oferta de <strong>${solicitud.detalle.oferta.toLocaleString()}$</strong> por el piloto <strong>${solicitud.detalle.pilotoNombre}</strong>.`;
        default: return 'Solicitud no reconocida.';
    }
}

async function handleSolicitud(solicitud, nuevoEstado) {
    const outcome = nuevoEstado === 'aprobada' ? prompt('Describe el resultado (ej: \"La mejora ha sido un éxito\")') : 'Solicitud denegada por la FIA.';
    if (nuevoEstado === 'aprobada' && !outcome) return;

    try {
        await updateDoc(doc(db, "solicitudes", solicitud.id), { estado: nuevoEstado, resultado: outcome });
        await addDoc(collection(db, "avisos"), { equipoId: solicitud.equipoId, remitente: "FIA", mensaje: `Tu solicitud de ${solicitud.tipo} ha sido <strong>${nuevoEstado.toUpperCase()}</strong>. Resultado: ${outcome}`, timestamp: serverTimestamp() });
        if (nuevoEstado === 'aprobada' && solicitud.tipo === 'Fichaje'){
             const piloto = allPilotos.find(p => p.id === solicitud.detalle.pilotoId);
             if(piloto){ await addDoc(collection(db, "avisos"), { equipoId: piloto.equipo_id, remitente: "FIA", mensaje: `El equipo ${solicitud.equipoNombre} ha hecho una oferta por tu piloto ${piloto.nombre} ${piloto.apellido}.`, timestamp: serverTimestamp() }); }
        }
    } catch (error) {
        console.error("Error al manejar la solicitud:", error);
    }
}

// --- COMUNICADOS (sin cambios) ---
function populateComunicadosSelects() {
    const remitenteSelect = document.getElementById('com-remitente');
    const destinatarioSelect = document.getElementById('com-destinatario');
    allPilotos.forEach(p => { remitenteSelect.innerHTML += `<option value="piloto_${p.id}">Piloto: ${p.nombre} ${p.apellido}</option>`; });
    allEquipos.forEach(e => { destinatarioSelect.innerHTML += `<option value="${e.id}">${e.nombre}</option>`; });
}

async function enviarComunicado() {
    const remitente = document.getElementById('com-remitente').value;
    const destinatarioId = document.getElementById('com-destinatario').value;
    const mensaje = document.getElementById('com-mensaje').value;
    if (!mensaje) return alert('El mensaje no puede estar vacío.');

    let remitenteDisplay = remitente.startsWith('piloto_') ? `Piloto: ${allPilotos.find(p => p.id === remitente.split('_')[1]).nombre} ${allPilotos.find(p => p.id === remitente.split('_')[1]).apellido}` : "FIA";
    
    try {
        const promises = destinatarioId === 'todos' ? allEquipos.map(equipo => addDoc(collection(db, "avisos"), { equipoId: equipo.id, remitente: remitenteDisplay, mensaje, timestamp: serverTimestamp() })) : [addDoc(collection(db, "avisos"), { equipoId: destinatarioId, remitente: remitenteDisplay, mensaje, timestamp: serverTimestamp() })];
        await Promise.all(promises);
        alert('Comunicado enviado.');
        document.getElementById('com-mensaje').value = '';
    } catch (error) {
        console.error("Error enviando comunicado:", error);
    }
}
