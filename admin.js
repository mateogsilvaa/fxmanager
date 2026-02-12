import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, getDocs, addDoc, serverTimestamp, updateDoc, orderBy, onSnapshot, deleteDoc, writeBatch, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let allCarreras = [];
let campeonatoState = {};

// --- INICIALIZACIÓN Y AUTENTICACIÓN ---
onAuthStateChanged(auth, user => {
    if (user) {
        // En una app real, aquí validaríamos que el UID de user es un admin.
        loadInitialData();
    } else {
        window.location.href = 'index.html';
    }
});

// --- CARGA DE DATOS ---
async function loadInitialData() {
    const [equiposSnap, pilotosSnap, carrerasSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, "equipos"), orderBy("nombre"))),
        getDocs(query(collection(db, "pilotos"), orderBy("apellido"))),
        getDocs(query(collection(db, "carreras"), orderBy("fecha"))),
        getDoc(doc(db, "configuracion", "campeonato"))
    ]);

    allEquipos = equiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allPilotos = pilotosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allCarreras = carrerasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    campeonatoState = configSnap.exists() ? configSnap.data() : { estado: 'offseason' };

    renderAll();
    setupEventListeners();
    listenForSolicitudes(); 
    // listenForMedia(); // Se añadirá en un paso posterior
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('btnCerrarSesion').addEventListener('click', () => signOut(auth));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-content.active, .tab-btn.active').forEach(el => el.classList.remove('active'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            btn.classList.add('active');
        });
    });
    document.getElementById('btnNuevoEquipo').addEventListener('click', () => openModal('equipo'));
    document.getElementById('btnNuevoPiloto').addEventListener('click', () => openModal('piloto'));
    document.getElementById('btnNuevaCarrera').addEventListener('click', () => openModal('carrera'));
    // document.getElementById('btnNuevoMedia').addEventListener('click', () => openModal('media'));
    document.getElementById('btnToggleCampeonato').addEventListener('click', toggleCampeonato);
    document.getElementById('btnEnviarComunicado').addEventListener('click', enviarComunicado);
}

// --- RENDERIZADO GLOBAL ---
function renderAll() {
    renderConfiguracion();
    renderComunicados();
    renderEquipos();
    renderPilotos();
    renderCarreras();
}

function renderConfiguracion() {
    document.getElementById('estado-campeonato-texto').textContent = campeonatoState.estado.toUpperCase();
}

function renderComunicados() {
    const destinatario = document.getElementById('com-destinatario');
    destinatario.innerHTML = '<option value="todos">TODOS LOS EQUIPOS</option>' + allEquipos.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
}

function renderEquipos() {
    const container = document.getElementById('equipos-container');
    container.innerHTML = allEquipos.map(e => `
        <div class="list-item">
            <span>${e.nombre} (${e.owner_uid ? 'Dirigido' : 'Libre'})</span>
            <div>
                <button class="btn btn-secondary btn-sm" onclick="openModal('equipo', '${e.id}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('equipos', '${e.id}')">Eliminar</button>
            </div>
        </div>`).join('');
}

function renderPilotos() {
    const container = document.getElementById('pilotos-container');
    container.innerHTML = allPilotos.map(p => `
        <div class="list-item">
            <span>${p.nombre} ${p.apellido} (${allEquipos.find(e => e.id === p.equipo_id)?.nombre || 'Sin equipo'})</span>
            <div>
                <button class="btn btn-secondary btn-sm" onclick="openModal('piloto', '${p.id}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('pilotos', '${p.id}')">Eliminar</button>
            </div>
        </div>`).join('');
}

function renderCarreras() {
    const container = document.getElementById('carreras-container');
    container.innerHTML = allCarreras.map(c => `
        <div class="list-item">
            <span>${c.nombre}</span>
            <div>
                <button class="btn btn-secondary btn-sm" onclick="openModal('carrera', '${c.id}')">Editar</button>
                <button class="btn btn-info btn-sm" onclick="openModal('resultados', '${c.id}')">Resultados</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('carreras', '${c.id}')">Eliminar</button>
            </div>
        </div>`).join('');
}

// --- GESTIÓN DE SOLICITUDES ---
function listenForSolicitudes() {
    const q = query(collection(db, "solicitudes"), where("estado", "==", "pendiente"), orderBy("timestamp"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('solicitudes-container');
        if (snapshot.empty) {
            container.innerHTML = '<p>No hay solicitudes pendientes.</p>';
            return;
        }
        container.innerHTML = snapshot.docs.map(doc => createSolicitudCard({id: doc.id, ...doc.data()})).join('');
    });
}

function createSolicitudCard(solicitud) {
    return `
        <div class="solicitud-card">
            <div class="solicitud-header">
                <span><strong>${solicitud.tipo.toUpperCase()}</strong> - ${solicitud.equipoNombre}</span>
                <span>${solicitud.timestamp?.toDate().toLocaleDateString() || 'Reciente'}</span>
            </div>
            <div class="solicitud-body">${renderSolicitudBody(solicitud)}</div>
            <div class="solicitud-actions">
                <button class="btn btn-success btn-sm" onclick="handleSolicitud('${solicitud.id}', 'aprobada')">Aprobar</button>
                <button class="btn btn-warning btn-sm" onclick="handleSolicitud('${solicitud.id}', 'denegada')">Denegar</button>
            </div>
        </div>`;
}

function renderSolicitudBody(solicitud) {
    const detalle = solicitud.detalle;
    switch(solicitud.tipo) {
        case 'Mejora': return `Solicita mejorar <strong>${detalle.pieza}</strong>. Coste: ${solicitud.coste.toLocaleString()}$`;
        case 'Investigación': return `Solicita investigar a <strong>${detalle.pilotoNombre || detalle.equipoNombre}</strong>.`;
        case 'Fichaje': return `Oferta de <strong>${detalle.oferta.toLocaleString()}$</strong> por el piloto <strong>${detalle.pilotoNombre}</strong>.`;
        default: return 'Solicitud no reconocida.';
    }
}

window.handleSolicitud = async function(solicitudId, nuevoEstado) {
    const solicitudRef = doc(db, "solicitudes", solicitudId);
    try {
        await runTransaction(db, async (transaction) => {
            const solicitudSnap = await transaction.get(solicitudRef);
            if (!solicitudSnap.exists()) throw "Solicitud no encontrada.";
            const solicitud = solicitudSnap.data();

            let outcome = nuevoEstado === 'denegada' ? 'Solicitud denegada por la FIA.' : '';
            
            if (nuevoEstado === 'aprobada') {
                const equipoRef = doc(db, "equipos", solicitud.equipoId);
                const equipoSnap = await transaction.get(equipoRef);
                const equipo = equipoSnap.data();

                if (solicitud.coste > 0 && equipo.presupuesto < solicitud.coste) {
                    outcome = 'Solicitud denegada por falta de presupuesto.';
                    nuevoEstado = 'denegada'; // Forzar denegación
                } else {
                    // Lógica de aprobación
                    if (solicitud.coste > 0) {
                        transaction.update(equipoRef, { presupuesto: equipo.presupuesto - solicitud.coste });
                    }
                    outcome = prompt(`Aprobando solicitud de ${solicitud.tipo}. Describe el resultado (ej: \"La mejora fue un éxito\"):`, "Resultado positivo.");
                    if (!outcome) throw "Operación cancelada por el usuario.";
                }
            }
            
            transaction.update(solicitudRef, { estado: nuevoEstado, resultado: outcome });

            const avisoRef = doc(collection(db, "avisos"));
            transaction.set(avisoRef, {
                equipoId: solicitud.equipoId,
                remitente: "FIA",
                mensaje: `Tu solicitud de ${solicitud.tipo} ha sido <strong>${nuevoEstado.toUpperCase()}</strong>. Resultado: ${outcome}`,
                timestamp: serverTimestamp(),
                leido: false
            });
        });

        alert(`Solicitud ${nuevoEstado}.`);
    } catch (error) {
        console.error("Error al manejar la solicitud:", error);
        alert(`Error: ${error}`);
    }
};


// --- MODALES (Crear/Editar) ---
window.openModal = function(type, id = null) {
    const modal = document.getElementById(`modal-${type}`);
    const content = modal.querySelector('.modal-content');
    content.innerHTML = getModalContent(type, id);
    
    const form = content.querySelector('form');
    if(form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            save(type, id, form);
        };
    }
    
    modal.style.display = 'flex';
}

window.closeModal = (type) => document.getElementById(`modal-${type}`).style.display = 'none';

function getModalContent(type, id) {
    let data, title;
    // ... (el resto del código de modales se mantiene igual)
    switch (type) {
        case 'equipo':
            data = id ? allEquipos.find(e => e.id === id) : {};
            title = id ? 'Editar Equipo' : 'Nuevo Equipo';
            return `
                <header class="card-header"><h2>${title}</h2><button class="close-modal" onclick="closeModal('equipo')">×</button></header>
                <form>
                    <input type="text" name="nombre" placeholder="Nombre" value="${data.nombre || ''}" required>
                    <input type="number" name="presupuesto" placeholder="Presupuesto" value="${data.presupuesto || 50000000}">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>`;
        case 'piloto':
            data = id ? allPilotos.find(p => p.id === id) : {};
            title = id ? 'Editar Piloto' : 'Nuevo Piloto';
            const equipoOptions = allEquipos.map(e => `<option value="${e.id}" ${data.equipo_id === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('');
            return `
                <header class="card-header"><h2>${title}</h2><button class="close-modal" onclick="closeModal('piloto')">×</button></header>
                <form>
                    <input type="text" name="nombre" placeholder="Nombre" value="${data.nombre || ''}" required>
                    <input type="text" name="apellido" placeholder="Apellido" value="${data.apellido || ''}" required>
                    <select name="equipo_id"><option value="">Sin Equipo</option>${equipoOptions}</select>
                    <input type="number" name="sueldo" placeholder="Sueldo" value="${data.sueldo || 1000000}">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>`;
        case 'carrera':
            data = id ? allCarreras.find(c => c.id === id) : {};
            title = id ? 'Editar Carrera' : 'Nueva Carrera';
            return `
                 <header class="card-header"><h2>${title}</h2><button class="close-modal" onclick="closeModal('carrera')">×</button></header>
                 <form>
                    <input type="text" name="nombre" placeholder="Nombre del GP" value="${data.nombre || ''}" required>
                    <input type="date" name="fecha" value="${data.fecha || ''}" required>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>`;
        case 'resultados':
            const carrera = allCarreras.find(c => c.id === id);
            const pilotosInputs = allPilotos.map(p => {
                const res = carrera.resultados ? carrera.resultados[p.id] : {};
                return `
                    <tr>
                        <td>${p.nombre} ${p.apellido}</td>
                        <td><input type="number" name="posicion_${p.id}" min="1" max="${allPilotos.length}" value="${res.posicion || ''}"></td>
                        <td><input type="checkbox" name="pole_${p.id}" ${res.pole ? 'checked' : ''}></td>
                        <td><input type="checkbox" name="vuelta_rapida_${p.id}" ${res.vueltaRapida ? 'checked' : ''}></td>
                    </tr>`;
            }).join('');
            return `
                <header class="card-header"><h2>Resultados de ${carrera.nombre}</h2><button class="close-modal" onclick="closeModal('resultados')">×</button></header>
                <form id="form-resultados">
                    <table class="results-table">
                        <thead><tr><th>Piloto</th><th>Posición</th><th>Pole</th><th>VR</th></tr></thead>
                        <tbody>${pilotosInputs}</tbody>
                    </table>
                    <button type="submit" class="btn btn-primary">Guardar Resultados</button>
                </form>`;
    }
    return '';
}

// --- LÓGICA DE GUARDADO Y BORRADO ---
async function save(type, id, form) {
    if (type === 'resultados') {
        return saveResults(id, form);
    }
    const data = Object.fromEntries(new FormData(form));
    const collectionName = type.endsWith('s') ? type : type + 's';
    
    if(data.presupuesto) data.presupuesto = Number(data.presupuesto);
    if(data.sueldo) data.sueldo = Number(data.sueldo);

    try {
        const docId = id || doc(collection(db, collectionName)).id;
        await setDoc(doc(db, collectionName, docId), data, { merge: true });
        closeModal(type);
        loadInitialData(); 
    } catch (error) {
        console.error(`Error guardando ${type}:`, error);
        alert(`Error al guardar: ${error.message}`);
    }
}

const PUNTOS_POR_POSICION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

async function saveResults(carreraId, form) {
    const formData = new FormData(form);
    const resultados = {};
    let poleId = null;
    let vueltaRapidaId = null;

    allPilotos.forEach(p => {
        const posicion = formData.get(`posicion_${p.id}`);
        if (posicion) {
            resultados[p.id] = { 
                posicion: parseInt(posicion),
                puntos: PUNTOS_POR_POSICION[posicion - 1] || 0 
            };
        }
        if (formData.has(`pole_${p.id}`)) poleId = p.id;
        if (formData.has(`vuelta_rapida_${p.id}`)) vueltaRapidaId = p.id;
    });

    if (vueltaRapidaId && resultados[vueltaRapidaId]?.posicion <= 10) {
        resultados[vueltaRapidaId].puntos++;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const carreraRef = doc(db, "carreras", carreraId);
            transaction.update(carreraRef, { resultados });

            for (const pilotoId in resultados) {
                const pilotoRef = doc(db, "pilotos", pilotoId);
                const pilotoSnap = await transaction.get(pilotoRef);
                const newPuntos = (pilotoSnap.data().puntos || 0) + resultados[pilotoId].puntos;
                transaction.update(pilotoRef, { puntos: newPuntos });
            }
        });

        closeModal('resultados');
        loadInitialData(); 
        alert("Resultados guardados y puntos actualizados.");

    } catch (error) {
        console.error("Error al guardar resultados: ", error);
        alert("Error transaccional al guardar resultados.");
    }
}

window.deleteItem = async function(collectionName, id) {
    if (confirm(`¿Seguro que quieres eliminar este elemento?`)) {
        try {
            await deleteDoc(doc(db, collectionName, id));
            loadInitialData();
        } catch (error) {
            console.error(`Error eliminando de ${collectionName}:`, error);
            alert(`Error al eliminar: ${error.message}`);
        }
    }
}

// --- OTRAS FUNCIONALIDADES ---
async function toggleCampeonato() {
    const nuevoEstado = campeonatoState.estado === 'offseason' ? 'en curso' : 'offseason';
    if (confirm(`¿Seguro que quieres cambiar el estado a "${nuevoEstado.toUpperCase()}"?`)) {
        await setDoc(doc(db, "configuracion", "campeonato"), { estado: nuevoEstado }, { merge: true });
        campeonatoState.estado = nuevoEstado;
        renderConfiguracion();
    }
}

async function enviarComunicado() {
    const remitente = "FIA";
    const destinatarioId = document.getElementById('com-destinatario').value;
    const mensaje = document.getElementById('com-mensaje').value;
    if (!mensaje) return alert('El mensaje no puede estar vacío.');

    const targets = destinatarioId === 'todos' ? allEquipos.map(e => e.id) : [destinatarioId];
    const batch = writeBatch(db);
    targets.forEach(equipoId => {
        const avisoRef = doc(collection(db, "avisos"));
        batch.set(avisoRef, { equipoId, remitente, mensaje, timestamp: serverTimestamp(), leido: false });
    });
    await batch.commit();
    alert('Comunicado(s) enviado(s).');
    document.getElementById('com-mensaje').value = '';
}

function listenForMedia() {
    // Implementado en la versión anterior, se puede añadir aquí si se desea.
}
