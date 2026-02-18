// Admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

let equiposList = [];
let pilotosList = [];

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. SEGURIDAD ADMIN
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "home.html"; return; }
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (!userSnap.exists() || userSnap.data().isAdmin !== true) {
            alert("No tienes permisos de Administrador.");
            window.location.href = "home.html";
            return;
        }
        await refrescarDatosGlobales();
        cargarActividad(); 
    });

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) btnLogout.addEventListener("click", () => signOut(auth));

    // 2. NAVEGACIÓN PESTAÑAS
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const panels = document.querySelectorAll(".admin-panel");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.getAttribute("data-target")).classList.add("active");
        });
    });

    // 3. LISTENERS FORMULARIOS
    document.getElementById("form-mensaje").addEventListener("submit", async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "notificaciones"), {
            remitente: document.getElementById("msg-remitente").value,
            equipoId: document.getElementById("msg-destinatario").value,
            texto: document.getElementById("msg-texto").value,
            fecha: serverTimestamp()
        });
        alert("Comunicado enviado."); e.target.reset();
    });

    document.getElementById("form-equipo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            nombre: document.getElementById("eq-nombre").value,
            color: document.getElementById("eq-color").value,
            imagenCoche: document.getElementById("eq-coche").value,
            logo: document.getElementById("eq-logo").value
        };
        await guardarDoc('equipos', document.getElementById("eq-id").value, data, 'modal-equipo');
    });

    document.getElementById("form-piloto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            nombre: document.getElementById("pil-nombre").value,
            apellido: document.getElementById("pil-apellido").value || '',
            numero: parseInt(document.getElementById("pil-numero").value),
            pais: document.getElementById("pil-pais").value,
            edad: parseInt(document.getElementById("pil-edad").value) || 0,
            ritmo: parseInt(document.getElementById("pil-ritmo").value) || 0,
            agresividad: parseInt(document.getElementById("pil-agresividad").value) || 0,
            moral: document.getElementById("pil-moral").value || "Normal",
            equipoId: document.getElementById("pil-equipo").value,
            foto: document.getElementById("pil-foto").value
        };
        await guardarDoc('pilotos', document.getElementById("pil-id").value, data, 'modal-piloto');
    });

    // FORMULARIO CARRERA ACTUALIZADO
    document.getElementById("form-carrera").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Función auxiliar para recoger 20 inputs
        const recogerPosiciones = (prefijo) => {
            const arr = [];
            for (let i = 1; i <= 20; i++) {
                arr.push(document.getElementById(`${prefijo}-${i}`).value);
            }
            return arr;
        };

        const data = {
            ronda: parseInt(document.getElementById("car-ronda").value),
            nombre: document.getElementById("car-nombre").value,
            circuito: document.getElementById("car-circuito").value,
            fecha: document.getElementById("car-fecha").value,
            pole: document.getElementById("car-pole").value,
            vr: document.getElementById("car-vr").value,
            entrenamientos: recogerPosiciones('pos-prac'), // Nuevo
            clasificacion: recogerPosiciones('pos-qual'), // Nuevo
            resultados_20: recogerPosiciones('pos-race'), // Carrera (mantiene nombre legacy para compatibilidad)
            completada: document.getElementById("car-completada").checked
        };
        await guardarDoc('carreras', document.getElementById("car-id").value, data, 'modal-carrera');
    });

    document.getElementById("form-media").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            tipo: document.getElementById("med-tipo").value,
            titulo: document.getElementById("med-titulo").value,
            url: document.getElementById("med-url").value,
            texto: document.getElementById("med-texto").value,
            fecha: serverTimestamp()
        };
        await guardarDoc('publicaciones', document.getElementById("med-id").value, data, 'modal-media');
    });
});

// ==========================================
// CARGAR DATOS GLOBALES
// ==========================================
async function refrescarDatosGlobales() {
    const eqSnap = await getDocs(collection(db, "equipos"));
    equiposList = [];
    eqSnap.forEach(doc => equiposList.push({ id: doc.id, ...doc.data() }));
    
    const pilSnap = await getDocs(collection(db, "pilotos"));
    pilotosList = [];
    pilSnap.forEach(doc => pilotosList.push({ id: doc.id, ...doc.data() }));

    const selectMsg = document.getElementById("msg-destinatario");
    const selectPil = document.getElementById("pil-equipo");
    selectMsg.innerHTML = '<option value="todos">A todos los equipos</option>';
    selectPil.innerHTML = '<option value="">Ninguno (Agente Libre)</option>';
    
    equiposList.forEach(eq => {
        selectMsg.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        selectPil.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
    });

    pintarTablaEquipos();
    pintarTablaPilotos();
    pintarTablaCarreras();
    pintarTablaMedia();
    pintarTablaSponsors();
}

// ... (Funciones de Actividad igual que antes) ...
async function cargarActividad() {
    const contenedor = document.getElementById("lista-actividad");
    try {
        const q = query(collection(db, "solicitudes_admin"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        if(snapshot.empty) { contenedor.innerHTML = "<p class='text-muted'>No hay actividad reciente.</p>"; return; }
        contenedor.innerHTML = "";
        snapshot.forEach(docSnap => {
            const req = docSnap.data();
            const id = docSnap.id;
            let badge = req.estado === "Pendiente" ? "REQUIERE ACCIÓN" : req.estado;
            let btns = req.estado === "Pendiente" ? `<button onclick="resolverActividad('${id}', '${req.equipoId}', 'Aprobada')">OK</button><button onclick="resolverActividad('${id}', '${req.equipoId}', 'Denegada')">NO</button>` : "";
            contenedor.innerHTML += `<div style="padding:10px; border:1px solid #333; margin-bottom:5px;"><strong>${req.nombreEquipo}</strong>: ${req.detalle} [${badge}] ${btns}</div>`;
        });
    } catch (e) { console.log(e); }
}
window.resolverActividad = async (id, eqId, res) => {
    if(confirm("¿Confirmar?")) {
        await updateDoc(doc(db, "solicitudes_admin", id), { estado: res });
        await addDoc(collection(db, "notificaciones"), { equipoId: eqId, remitente: "Admin", texto: `Solicitud ${res}`, fecha: serverTimestamp() });
        cargarActividad();
    }
}

// ==========================================
// FUNCIONES DE TABLAS Y EDICIÓN
// ==========================================
async function pintarTablaCarreras() {
    const tbody = document.getElementById("tabla-carreras");
    const q = query(collection(db, "carreras"), orderBy("ronda", "asc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(d => {
        const c = d.data();
        const cData = { id: d.id, ...c };
        const status = c.completada ? '<span style="color:var(--success);">Completada</span>' : '<span style="color:var(--warning);">Pendiente</span>';
        
        tbody.innerHTML += `
            <tr>
                <td>R${c.ronda}</td>
                <td><strong>${c.nombre}</strong></td>
                <td>${status}</td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarCarrera(${JSON.stringify(cData)})'>Editar Resultados</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('carreras', '${d.id}')">X</button>
                </td>
            </tr>`;
    });
}

// FUNCIÓN DE EDICIÓN ACTUALIZADA PARA 3 PESTAÑAS
window.editarCarrera = (data) => {
    document.getElementById("car-id").value = data.id || "";
    document.getElementById("car-ronda").value = data.ronda || "";
    document.getElementById("car-nombre").value = data.nombre || "";
    document.getElementById("car-circuito").value = data.circuito || "";
    document.getElementById("car-fecha").value = data.fecha || "";
    document.getElementById("car-completada").checked = data.completada || false;
    
    const poleSelect = document.getElementById("car-pole");
    const vrSelect = document.getElementById("car-vr");
    let opcionesPilotos = '<option value="">-- Seleccionar Piloto --</option>';
    pilotosList.forEach(p => { opcionesPilotos += `<option value="${p.id}">${p.nombre} ${p.apellido || ''} (#${p.numero})</option>`; });

    poleSelect.innerHTML = opcionesPilotos;
    vrSelect.innerHTML = opcionesPilotos;
    if(data.pole) poleSelect.value = data.pole;
    if(data.vr) vrSelect.value = data.vr;

    // Generar 20 selects para cada pestaña
    const generarSelects = (containerId, prefijo, datosGuardados) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        for (let i = 1; i <= 20; i++) {
            container.innerHTML += `
                <div style="display:flex; flex-direction:column;">
                    <label style="font-size:0.8rem;">P${i}</label>
                    <select id="${prefijo}-${i}" style="padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white;">
                        ${opcionesPilotos}
                    </select>
                </div>`;
            // Rellenar si hay datos
            if (datosGuardados && datosGuardados[i-1]) {
                // Hay que esperar a que el DOM se pinte, pero en síncrono funciona en el innerHTML
                // Asignación de valor post-renderizado
            }
        }
    };

    generarSelects("container-practica", "pos-prac", data.entrenamientos);
    generarSelects("container-clasificacion", "pos-qual", data.clasificacion);
    generarSelects("container-carrera", "pos-race", data.resultados_20);

    // Asignar valores después de generar el HTML
    for (let i = 1; i <= 20; i++) {
        if(data.entrenamientos && data.entrenamientos[i-1]) document.getElementById(`pos-prac-${i}`).value = data.entrenamientos[i-1];
        if(data.clasificacion && data.clasificacion[i-1]) document.getElementById(`pos-qual-${i}`).value = data.clasificacion[i-1];
        if(data.resultados_20 && data.resultados_20[i-1]) document.getElementById(`pos-race-${i}`).value = data.resultados_20[i-1];
    }

    document.getElementById("modal-carrera").style.display = "flex";
}

// ... (Resto de funciones pintarTablaEquipos, Pilotos, Media, etc. igual que antes) ...
function pintarTablaEquipos() {
    const tbody = document.getElementById("tabla-equipos");
    tbody.innerHTML = "";
    equiposList.forEach(eq => {
        tbody.innerHTML += `<tr>
            <td>${eq.logo ? `<img src="${eq.logo}" style="width:30px;">` : ''}</td>
            <td>${eq.nombre}</td>
            <td><div style="width:20px;height:20px;background:${eq.color};"></div></td>
            <td><button onclick='editarEquipo(${JSON.stringify(eq)})'>Editar</button><button onclick="eliminarDoc('equipos','${eq.id}')">X</button></td>
        </tr>`;
    });
}
function pintarTablaPilotos() {
    const tbody = document.getElementById("tabla-pilotos");
    tbody.innerHTML = "";
    pilotosList.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>#${p.numero}</td>
            <td>${p.nombre}</td>
            <td>${p.apellido}</td>
            <td>${p.moral}</td>
            <td>${p.pais}</td>
            <td><button onclick='editarPiloto(${JSON.stringify(p)})'>Editar</button><button onclick="eliminarDoc('pilotos','${p.id}')">X</button></td>
        </tr>`;
    });
}
async function pintarTablaMedia() {
    const tbody = document.getElementById("tabla-media");
    const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(d => {
        const m = d.data();
        tbody.innerHTML += `<tr><td>${m.tipo}</td><td>${m.titulo}</td><td>${m.fecha?new Date(m.fecha.toDate()).toLocaleDateString():''}</td><td><button onclick="eliminarDoc('publicaciones','${d.id}')">X</button></td></tr>`;
    });
}
window.editarEquipo = (data) => {
    document.getElementById("eq-id").value = data.id; document.getElementById("eq-nombre").value = data.nombre; document.getElementById("eq-color").value = data.color; document.getElementById("eq-coche").value = data.imagenCoche||""; document.getElementById("eq-logo").value = data.logo||"";
    document.getElementById("modal-equipo").style.display = "flex";
}
window.editarPiloto = (data) => {
    document.getElementById("pil-id").value = data.id; document.getElementById("pil-nombre").value = data.nombre; document.getElementById("pil-apellido").value = data.apellido; document.getElementById("pil-numero").value = data.numero; document.getElementById("pil-pais").value = data.pais; document.getElementById("pil-edad").value = data.edad; document.getElementById("pil-ritmo").value = data.ritmo; document.getElementById("pil-agresividad").value = data.agresividad; document.getElementById("pil-moral").value = data.moral; document.getElementById("pil-equipo").value = data.equipoId; document.getElementById("pil-foto").value = data.foto;
    document.getElementById("modal-piloto").style.display = "flex";
}
window.editarMedia = (data) => { alert("Usa borrar y crear nuevo."); } // Simplificado

async function recalcularClasificacion() {
    console.log("Recalculando...");
    const pilotosMap = {}; const equiposMap = {};
    equiposList.forEach(eq => { equiposMap[eq.id] = 0; });
    pilotosList.forEach(p => { pilotosMap[p.id] = { puntos: 0, equipoId: p.equipoId }; });
    const q = query(collection(db, "carreras"), where("completada", "==", true));
    const carrerasSnap = await getDocs(q);
    const puntosF1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    carrerasSnap.forEach(docSnap => {
        const carrera = docSnap.data();
        const resultados = carrera.resultados_20 || [];
        for (let i = 0; i < 10; i++) {
            const pilotoId = resultados[i];
            if (pilotoId && pilotosMap[pilotoId]) {
                const pts = puntosF1[i];
                pilotosMap[pilotoId].puntos += pts;
                const eqId = pilotosMap[pilotoId].equipoId;
                if (eqId && equiposMap[eqId] !== undefined) equiposMap[eqId] += pts;
            }
        }
        if (carrera.vr && pilotosMap[carrera.vr]) {
            const inTop10 = resultados.slice(0, 10).includes(carrera.vr);
            if (inTop10) {
                pilotosMap[carrera.vr].puntos += 1;
                const eqId = pilotosMap[carrera.vr].equipoId;
                if (eqId && equiposMap[eqId] !== undefined) equiposMap[eqId] += 1;
            }
        }
    });
    const promesas = [];
    for (const pilotoId in pilotosMap) promesas.push(updateDoc(doc(db, "pilotos", pilotoId), { puntos: pilotosMap[pilotoId].puntos }));
    for (const equipoId in equiposMap) promesas.push(updateDoc(doc(db, "equipos", equipoId), { puntos: equiposMap[equipoId] }));
    await Promise.all(promesas);
}

// ============== SISTEMAS DE SPONSORS ==============

async function pintarTablaSponsors() {
    const tbody = document.getElementById("tabla-sponsors");
    tbody.innerHTML = "";
    
    for (const eq of equiposList) {
        const teamRef = doc(db, "equipos", eq.id);
        const teamSnap = await getDoc(teamRef);
        const team = teamSnap.data() || {};
        const contract = team.sponsor_contract;
        
        let tipoTexto = "Sin contrato";
        let estadoTexto = "Disponible";
        let detallesTexto = "-";
        let botonesHTML = `<button onclick="unlockSponsorModalAdmin('${eq.id}')" class="btn-outline" style="padding: 5px 10px; font-size: 0.8rem;">Desbloquear</button>`;
        
        if (contract) {
            tipoTexto = contract.type === "fixed" ? "Dinero Garantizado" : "Performance";
            detallesTexto = contract.type === "fixed" 
                ? `$${contract.guaranteed.toLocaleString()}`
                : `Base: $${contract.base.toLocaleString()} | Bonus: $${contract.bonus.toLocaleString()} | Objetivo: Top ${contract.targetPosition}`;
            
            if (team.sponsor_contract_unlocked) {
                estadoTexto = "Desbloqueado";
                botonesHTML = `<span style="color: var(--warning);">⚠️ Desbloqueado</span>`;
            } else {
                estadoTexto = "Bloqueado";
                botonesHTML = `<button onclick="unlockSponsorModalAdmin('${eq.id}')" class="btn-solid" style="padding: 5px 10px; font-size: 0.8rem;">Desbloquear</button>`;
            }
        }
        
        tbody.innerHTML += `
            <tr>
                <td>${eq.nombre}</td>
                <td>${tipoTexto}</td>
                <td>${estadoTexto}</td>
                <td style="font-size: 0.9rem;">${detallesTexto}</td>
                <td>${botonesHTML}</td>
            </tr>
        `;
    }
}

window.unlockSponsorModalAdmin = async function(teamId) {
    if (confirm("¿Desbloquear el contrato de sponsors para que el equipo pueda elegir de nuevo?")) {
        try {
            await updateDoc(doc(db, "equipos", teamId), {
                sponsor_contract_unlocked: true
            });
            
            // Enviar notificación
            await addDoc(collection(db, "notificaciones"), {
                equipoId: teamId,
                remitente: "Admin",
                texto: "🔓 Tu contrato de patrocinadores ha sido desbloqueado. Puedes elegir un nuevo patrocinio.",
                fecha: serverTimestamp()
            });
            
            alert("Contrato desbloqueado exitosamente.");
            pintarTablaSponsors();
        } catch (error) {
            console.error("Error desbloqueando contrato:", error);
            alert("Error al desbloquear el contrato");
        }
    }
};

async function guardarDoc(coleccion, id, data, modalId) {
    try {
        if (id) await updateDoc(doc(db, coleccion, id), data);
        else await addDoc(collection(db, coleccion), data);
        if (coleccion === 'carreras') { await recalcularClasificacion(); alert("Clasificación recalculada."); }
        else alert("Guardado.");
        cerrarModal(modalId); refrescarDatosGlobales();
    } catch (e) { console.error(e); alert("Error"); }
}
window.eliminarDoc = async (coleccion, id) => {
    if(confirm("¿Borrar?")) { await deleteDoc(doc(db, coleccion, id)); if(coleccion==='carreras') await recalcularClasificacion(); refrescarDatosGlobales(); }
}
window.abrirModal = (id) => { document.getElementById(id).querySelector('form').reset(); document.getElementById(id).querySelector('input[type="hidden"]').value = ""; document.getElementById(id).style.display = 'flex'; }
window.cerrarModal = (id) => { document.getElementById(id).style.display = 'none'; }