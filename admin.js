// admin.js
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

    document.getElementById("form-carrera").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Recoger las 20 posiciones
        const posiciones = [];
        for (let i = 1; i <= 20; i++) {
            posiciones.push(document.getElementById(`pos-${i}`).value);
        }

        const data = {
            ronda: parseInt(document.getElementById("car-ronda").value),
            nombre: document.getElementById("car-nombre").value,
            circuito: document.getElementById("car-circuito").value,
            fecha: document.getElementById("car-fecha").value,
            pole: document.getElementById("car-pole").value,
            vr: document.getElementById("car-vr").value,
            resultados_20: posiciones,
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
}

// ==========================================
// REGISTRO DE ACTIVIDAD (GRAN HERMANO)
// ==========================================
async function cargarActividad() {
    const contenedor = document.getElementById("lista-actividad");
    try {
        const q = query(collection(db, "solicitudes_admin"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);

        if(snapshot.empty) {
            contenedor.innerHTML = "<p class='text-muted'>No hay actividad reciente de los equipos.</p>";
            return;
        }

        contenedor.innerHTML = "";
        snapshot.forEach(docSnap => {
            const req = docSnap.data();
            const id = docSnap.id;
            
            let borderCol = "var(--border-color)";
            let badge = "";
            let botonesHTML = "";

            if (req.estado === "Pendiente") {
                borderCol = "var(--warning)";
                badge = `<span style="background:var(--warning); color:#000; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">REQUIERE ACCIÓN</span>`;
                botonesHTML = `
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button class="btn-solid" style="background:var(--success); border:none; padding:5px 15px; font-size:0.85rem;" onclick="resolverActividad('${id}', '${req.equipoId}', 'Aprobada')">Aprobar</button>
                        <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 15px; font-size:0.85rem;" onclick="resolverActividad('${id}', '${req.equipoId}', 'Denegada')">Denegar</button>
                    </div>
                `;
            } else if (req.estado === "Aprobada") {
                badge = `<span style="color:var(--success); font-size:0.8rem; font-weight:bold;">✓ APROBADA</span>`;
            } else if (req.estado === "Denegada") {
                badge = `<span style="color:var(--danger); font-size:0.8rem; font-weight:bold;">X DENEGADA</span>`;
            } else {
                badge = `<span style="color:var(--accent); font-size:0.8rem; font-weight:bold;">ℹ INFO</span>`;
            }

            const fechaFormat = req.fecha ? new Date(req.fecha.toDate()).toLocaleString() : "Reciente";

            contenedor.innerHTML += `
                <div style="background:var(--bg-secondary); border: 1px solid ${borderCol}; border-left: 4px solid ${borderCol}; padding:15px; border-radius:6px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong style="color:var(--text-primary); font-size:1.1rem;">${req.nombreEquipo || 'Equipo'}</strong> 
                            <span style="color:var(--text-secondary); font-size:0.9rem;"> - ${req.tipo}</span>
                            <p style="margin:5px 0; font-size:0.95rem; color:var(--text-primary);">${req.detalle}</p>
                            <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">${fechaFormat}</p>
                        </div>
                        <div>${badge}</div>
                    </div>
                    ${botonesHTML}
                </div>
            `;
        });
    } catch (error) {
        contenedor.innerHTML = `<div style="background:rgba(239,68,68,0.1); border:1px solid var(--danger); padding:15px; border-radius:6px;">
            <p style="color:var(--danger); margin:0;">Error: Si dice 'requires an index', abre la consola (F12) y haz clic en el enlace azul de Firebase.</p>
        </div>`;
    }
}

window.resolverActividad = async (id, equipoId, resolucion) => {
    if(confirm(`¿Marcar como ${resolucion}? Se avisará al equipo automáticamente.`)) {
        await updateDoc(doc(db, "solicitudes_admin", id), { estado: resolucion });
        await addDoc(collection(db, "notificaciones"), {
            equipoId: equipoId, remitente: "Dirección de Carrera", texto: `Tu solicitud ha sido: ${resolucion}.`, fecha: serverTimestamp()
        });
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

window.editarCarrera = (data) => {
    document.getElementById("car-id").value = data.id || "";
    document.getElementById("car-ronda").value = data.ronda || "";
    document.getElementById("car-nombre").value = data.nombre || "";
    document.getElementById("car-circuito").value = data.circuito || "";
    document.getElementById("car-fecha").value = data.fecha || "";
    document.getElementById("car-completada").checked = data.completada || false;
    
    const poleSelect = document.getElementById("car-pole");
    const vrSelect = document.getElementById("car-vr");
    const posicionesContainer = document.getElementById("carrera-posiciones");
    
    let opcionesPilotos = '<option value="">-- Seleccionar Piloto --</option>';
    pilotosList.forEach(p => { opcionesPilotos += `<option value="${p.id}">${p.nombre} #${p.numero}</option>`; });

    poleSelect.innerHTML = opcionesPilotos;
    vrSelect.innerHTML = opcionesPilotos;
    if(data.pole) poleSelect.value = data.pole;
    if(data.vr) vrSelect.value = data.vr;

    posicionesContainer.innerHTML = "";
    for (let i = 1; i <= 20; i++) {
        posicionesContainer.innerHTML += `
            <div style="display:flex; flex-direction:column;">
                <label style="font-size:0.8rem;">Posición ${i}º</label>
                <select id="pos-${i}" style="padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white;">
                    ${opcionesPilotos}
                </select>
            </div>
        `;
    }

    if (data.resultados_20 && data.resultados_20.length > 0) {
        for (let i = 1; i <= 20; i++) {
            if(data.resultados_20[i-1]) document.getElementById(`pos-${i}`).value = data.resultados_20[i-1];
        }
    }
    document.getElementById("modal-carrera").style.display = "flex";
}


function pintarTablaEquipos() {
    const tbody = document.getElementById("tabla-equipos");
    tbody.innerHTML = "";
    equiposList.forEach(eq => {
        tbody.innerHTML += `<tr>
            <td>${eq.logo ? `<img src="${eq.logo}" style="width:30px; border-radius:4px;">` : 'N/A'}</td>
            <td><strong>${eq.nombre}</strong></td>
            <td><div style="width:20px;height:20px;background:${eq.color};border-radius:4px;"></div></td>
            <td>
                <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarEquipo(${JSON.stringify(eq)})'>Editar</button>
                <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('equipos', '${eq.id}')">X</button>
            </td>
        </tr>`;
    });
}

function pintarTablaPilotos() {
    const tbody = document.getElementById("tabla-pilotos");
    tbody.innerHTML = "";
    pilotosList.forEach(p => {
        const eqInfo = equiposList.find(e => e.id === p.equipoId);
        const eqNombre = eqInfo ? eqInfo.nombre : "Agente Libre";
        tbody.innerHTML += `<tr>
            <td>#${p.numero || '0'}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.apellido || ''}</td>
            <td>${p.moral !== undefined ? p.moral : 'N/A'}</td>
            <td>${p.pais || 'N/A'} (${eqNombre})</td>
            <td>
                <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarPiloto(${JSON.stringify(p)})'>Editar</button>
                <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('pilotos', '${p.id}')">X</button>
            </td>
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
        const mData = { id: d.id, ...m };
        tbody.innerHTML += `<tr>
            <td style="text-transform:uppercase;">${m.tipo}</td>
            <td><strong>${m.titulo}</strong></td>
            <td>${m.fecha ? new Date(m.fecha.toDate()).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarMedia(${JSON.stringify(mData)})'>Editar</button>
                <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('publicaciones', '${d.id}')">X</button>
            </td>
        </tr>`;
    });
}

window.editarEquipo = (data) => {
    document.getElementById("eq-id").value = data.id;
    document.getElementById("eq-nombre").value = data.nombre || "";
    document.getElementById("eq-color").value = data.color || "#ffffff";
    document.getElementById("eq-coche").value = data.imagenCoche || "";
    document.getElementById("eq-logo").value = data.logo || "";
    document.getElementById("titulo-modal-equipo").textContent = "Editar Equipo";
    document.getElementById("modal-equipo").style.display = "flex";
}

window.editarPiloto = (data) => {
    document.getElementById("pil-id").value = data.id;
    document.getElementById("pil-nombre").value = data.nombre || "";
    document.getElementById("pil-apellido").value = data.apellido || "";
    document.getElementById("pil-numero").value = data.numero || "";
    document.getElementById("pil-pais").value = data.pais || "";
    document.getElementById("pil-edad").value = data.edad || "";
    document.getElementById("pil-ritmo").value = data.ritmo || "";
    document.getElementById("pil-agresividad").value = data.agresividad || "";
    document.getElementById("pil-moral").value = data.moral || "Normal";
    document.getElementById("pil-equipo").value = data.equipoId || "";
    document.getElementById("pil-foto").value = data.foto || "";
    document.getElementById("titulo-modal-piloto").textContent = "Editar Piloto";
    document.getElementById("modal-piloto").style.display = "flex";
}

window.editarMedia = (data) => {
    document.getElementById("med-id").value = data.id;
    document.getElementById("med-tipo").value = data.tipo || "articulo";
    document.getElementById("med-titulo").value = data.titulo || "";
    document.getElementById("med-url").value = data.url || "";
    document.getElementById("med-texto").value = data.texto || "";
    document.getElementById("titulo-modal-media").textContent = "Editar Publicación";
    document.getElementById("modal-media").style.display = "flex";
}


// ==========================================
// CÁLCULO DE PUNTOS AUTOMÁTICO
// ==========================================
async function recalcularClasificacion() {
    console.log("Recalculando puntos del campeonato...");
    
    // 1. Resetear contadores
    const pilotosMap = {};
    const equiposMap = {};
    
    equiposList.forEach(eq => { equiposMap[eq.id] = 0; });
    pilotosList.forEach(p => { pilotosMap[p.id] = { puntos: 0, equipoId: p.equipoId }; });

    // 2. Buscar todas las carreras marcadas como COMPLETADAS
    const q = query(collection(db, "carreras"), where("completada", "==", true));
    const carrerasSnap = await getDocs(q);

    // Sistema de puntos F1 real (Top 10)
    const puntosF1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    carrerasSnap.forEach(docSnap => {
        const carrera = docSnap.data();
        const resultados = carrera.resultados_20 || [];
        
        // Sumar puntos por posición a pilotos y sus equipos
        for (let i = 0; i < 10; i++) {
            const pilotoId = resultados[i];
            if (pilotoId && pilotosMap[pilotoId]) {
                const pts = puntosF1[i];
                pilotosMap[pilotoId].puntos += pts;
                
                const eqId = pilotosMap[pilotoId].equipoId;
                if (eqId && equiposMap[eqId] !== undefined) {
                    equiposMap[eqId] += pts;
                }
            }
        }
        
        // Sumar +1 punto por Vuelta Rápida (Solo si está en el Top 10)
        if (carrera.vr && pilotosMap[carrera.vr]) {
            const inTop10 = resultados.slice(0, 10).includes(carrera.vr);
            if (inTop10) {
                pilotosMap[carrera.vr].puntos += 1;
                const eqId = pilotosMap[carrera.vr].equipoId;
                if (eqId && equiposMap[eqId] !== undefined) {
                    equiposMap[eqId] += 1;
                }
            }
        }
    });

    // 3. Subir todos los puntos a Firebase
    const promesas = [];
    for (const pilotoId in pilotosMap) {
        promesas.push(updateDoc(doc(db, "pilotos", pilotoId), { puntos: pilotosMap[pilotoId].puntos }));
    }
    for (const equipoId in equiposMap) {
        promesas.push(updateDoc(doc(db, "equipos", equipoId), { puntos: equiposMap[equipoId] }));
    }

    await Promise.all(promesas); // Esperamos a que todo se guarde
    console.log("¡Clasificación actualizada con éxito!");
}


// ==========================================
// GUARDAR Y ELIMINAR (GENÉRICOS)
// ==========================================
async function guardarDoc(coleccion, id, data, modalId) {
    try {
        if (id) { await updateDoc(doc(db, coleccion, id), data); alert("Actualizado correctamente."); } 
        else { await addDoc(collection(db, coleccion), data); alert("Creado correctamente."); }
        
        // ¡LA MAGIA! Si acabamos de guardar o editar una carrera, recalculamos la clasificación
        if (coleccion === 'carreras') {
            await recalcularClasificacion();
            alert("La clasificación mundial ha sido recalculada con los nuevos resultados.");
        }

        cerrarModal(modalId); 
        refrescarDatosGlobales();
    } catch (error) { console.error(error); alert("Error al guardar."); }
}

window.eliminarDoc = async (coleccion, id) => {
    if(confirm("¿Estás seguro de que quieres eliminar esto? No se puede deshacer.")) {
        try { 
            await deleteDoc(doc(db, coleccion, id)); 
            
            // Si eliminamos una carrera, también hay que recalcular
            if (coleccion === 'carreras') {
                await recalcularClasificacion();
            }

            refrescarDatosGlobales(); 
        } 
        catch (error) { console.error(error); alert("Error al eliminar."); }
    }
}

window.abrirModal = (id) => {
    document.getElementById(id).querySelector('form').reset();
    document.getElementById(id).querySelector('input[type="hidden"]').value = ""; 
    document.getElementById(id).style.display = 'flex';
}
window.cerrarModal = (id) => { document.getElementById(id).style.display = 'none'; }