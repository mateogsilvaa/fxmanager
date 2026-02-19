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
            const targetId = btn.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
            
            // Cargar ofertas si se abre esa pestaña
            if (targetId === "panel-ofertas-admin") {
                cargarOfertasAdmin();
            }
            if (targetId === "panel-respuestas") {
                cargarRespuestas();
            }
            if (targetId === "panel-actividad") {
                cargarActividad();
            }
        });
    });

    // 3. LISTENERS FORMULARIOS
    document.getElementById("form-mensaje").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        try {
            console.log("Enviando comunicado");
            const tipo = document.getElementById("msg-tipo").value;
            const requiereAprobacion = document.getElementById("msg-requiere-aprobacion").checked;
            const mensaje = document.getElementById("msg-texto").value;
            console.log("Tipo:", tipo, "Requiere aprobación:", requiereAprobacion);
            
            // Validación manual
            if (!tipo) {
                alert("Por favor selecciona un tipo de comunicado.");
                return;
            }
            if (!mensaje.trim()) {
                alert("Por favor escribe un mensaje.");
                return;
            }
            
            if (tipo === "oficial" && !document.getElementById("msg-remitente").value) {
                alert("Por favor selecciona quién envía el mensaje.");
                return;
            }
            
            if (tipo === "piloto") {
                const equipoId = document.getElementById("msg-equipo-piloto").value;
                const pilotoId = document.getElementById("msg-piloto-remitente").value;
                const destinatario = document.getElementById("msg-destinatario").value;
                
                if (!equipoId) {
                    alert("Por favor selecciona un equipo.");
                    return;
                }
                if (!pilotoId) {
                    alert("Por favor selecciona un piloto.");
                    return;
                }
                if (!destinatario) {
                    alert("Por favor selecciona un equipo destinatario.");
                    return;
                }
            }
            
            if (requiereAprobacion) {
                console.log("Enviando mensaje con aprobación");
                // Mensaje que requiere aprobación - enviar a todos los equipos
                const mensajeRef = await addDoc(collection(db, "mensajes_aprobacion"), {
                    remitente: tipo === "oficial" ? document.getElementById("msg-remitente").value : "Sistema",
                    texto: mensaje,
                    fecha: serverTimestamp()
                });
                
                // Enviar notificación a todos los equipos
                for (const eq of equiposList) {
                    await addDoc(collection(db, "notificaciones"), {
                        remitente: "Admin",
                        equipoId: eq.id,
                        texto: `📋 Mensaje que requiere aprobación: "${mensaje}"`,
                        fecha: serverTimestamp(),
                        tipo: "mensaje_aprobacion",
                        mensajeId: mensajeRef.id
                    });
                }
            } else {
                console.log("Enviando mensaje normal");
                // Mensaje normal
                if (tipo === "oficial") {
                    console.log("Tipo oficial");
                    const destinatario = document.getElementById("msg-destinatario").value;
                    if (destinatario === "todos") {
                        console.log("Enviando a todos");
                        // Enviar a todos los equipos
                        for (const eq of equiposList) {
                            await addDoc(collection(db, "notificaciones"), {
                                remitente: document.getElementById("msg-remitente").value,
                                equipoId: eq.id,
                                texto: mensaje,
                                fecha: serverTimestamp()
                            });
                        }
                    } else {
                        console.log("Enviando a equipo específico:", destinatario);
                        // Comunicado oficial a un equipo específico
                        await addDoc(collection(db, "notificaciones"), {
                            remitente: document.getElementById("msg-remitente").value,
                            equipoId: destinatario,
                            texto: mensaje,
                            fecha: serverTimestamp()
                        });
                    }
                } else {
                    console.log("Tipo piloto");
                    // Comunicado de piloto a equipo
                    const pilotoData = document.getElementById("msg-piloto-remitente").value.split("|");
                    const pilotoId = pilotoData[0];
                    const pilotoNombre = pilotoData[1];
                    const equipoDestinoId = document.getElementById("msg-destinatario").value;
                    const equipoOrigenId = document.getElementById("msg-equipo-piloto").value;
                    
                    // Guardar comunicado en la colección "comunicados"
                    await addDoc(collection(db, "comunicados"), {
                        tipo: "piloto_equipo",
                        pilotoId: pilotoId,
                        pilotoNombre: pilotoNombre,
                        equipoOrigenId: equipoOrigenId,
                        equipoDestinoId: equipoDestinoId,
                        texto: mensaje,
                        leido: false,
                        fecha: serverTimestamp()
                    });
                    
                    // Enviar notificación al equipo destinatario
                    await addDoc(collection(db, "notificaciones"), {
                        remitente: `Piloto: ${pilotoNombre}`,
                        equipoId: equipoDestinoId,
                        texto: `📨 Mensaje de ${pilotoNombre}: "${mensaje}"`,
                        fecha: serverTimestamp(),
                        tipo: "comunicado_piloto",
                        pilotoId: pilotoId,
                        equipoOrigenId: equipoOrigenId
                    });
                }
            }
            
            console.log("Comunicado enviado exitosamente");
            alert("Comunicado enviado."); 
            e.target.reset();
        } catch (error) {
            console.error("Error enviando comunicado:", error);
            alert("Error al enviar el comunicado: " + error.message);
        }
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
    const selectFiltroActividad = document.getElementById("filtro-equipo-actividad");
    
    selectMsg.innerHTML = '<option value="todos">A todos los equipos</option>';
    selectPil.innerHTML = '<option value="">Ninguno (Agente Libre)</option>';
    selectFiltroActividad.innerHTML = '<option value="">-- Todos los equipos --</option>';
    
    equiposList.forEach(eq => {
        selectMsg.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        selectPil.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        selectFiltroActividad.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
    });
    
    // Agregar listener al selector de filtro de actividad
    selectFiltroActividad.addEventListener("change", () => {
        cargarActividad();
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
    const filtroEquipo = document.getElementById("filtro-equipo-actividad").value;
    
    try {
        // Cargar actividades de equipos
        let actividadQuery;
        if (filtroEquipo) {
            actividadQuery = query(
                collection(db, "actividad_equipos"), 
                where("equipoId", "==", filtroEquipo),
                orderBy("fecha", "desc")
            );
        } else {
            actividadQuery = query(collection(db, "actividad_equipos"), orderBy("fecha", "desc"));
        }
        const actividadSnap = await getDocs(actividadQuery);
        
        // Cargar solicitudes admin
        let solicitudesQuery;
        if (filtroEquipo) {
            solicitudesQuery = query(
                collection(db, "solicitudes_admin"), 
                where("equipoId", "==", filtroEquipo),
                orderBy("fecha", "desc")
            );
        } else {
            solicitudesQuery = query(collection(db, "solicitudes_admin"), orderBy("fecha", "desc"));
        }
        const solicitudesSnap = await getDocs(solicitudesQuery);
        
        // Combinar ambas listas
        const todas = [];
        
        actividadSnap.forEach(doc => {
            const actividad = doc.data();
            todas.push({
                id: doc.id,
                tipo: "actividad",
                nombreEquipo: actividad.nombreEquipo,
                detalle: actividad.detalle,
                tipoActividad: actividad.tipo,
                fecha: actividad.fecha,
                equipoId: actividad.equipoId
            });
        });
        
        solicitudesSnap.forEach(doc => {
            const solicitud = doc.data();
            todas.push({
                id: doc.id,
                tipo: "solicitud",
                nombreEquipo: solicitud.nombreEquipo,
                detalle: solicitud.detalle,
                estado: solicitud.estado,
                fecha: solicitud.fecha,
                equipoId: solicitud.equipoId
            });
        });
        
        // Ordenar por fecha descendente
        todas.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));
        
        if(todas.length === 0) { 
            contenedor.innerHTML = "<p class='text-muted'>No hay actividad reciente.</p>"; 
            return; 
        }
        
        contenedor.innerHTML = "";
        todas.forEach(item => {
            if (item.tipo === "solicitud") {
                // Solicitudes de mejoras
                const badge = item.estado === "Pendiente" ? "REQUIERE ACCIÓN" : item.estado;
                const btns = item.estado === "Pendiente" ? `<button style="margin-top:10px; margin-right:5px;" onclick="resolverActividad('${item.id}', '${item.equipoId}', 'Aprobada')">OK</button><button style="margin-top:10px;" onclick="resolverActividad('${item.id}', '${item.equipoId}', 'Denegada')">NO</button>` : "";
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: var(--accent);">📋 ${item.nombreEquipo}</strong>: ${item.detalle} <span style="color: var(--text-secondary); font-size: 0.85rem;">[${badge}]</span> ${btns}</div>`;
            } else if (item.tipoActividad === "compra_investigacion") {
                // Compra de investigación (solo admin)
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: #FFD700;">💰 ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            } else if (item.tipoActividad === "mejora") {
                // Mejoras
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: var(--accent);">⚡ ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            } else if (item.tipoActividad === "investigacion") {
                // Investigaciones
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: #00D4FF;">🔍 ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            } else if (item.tipoActividad === "nego_salario") {
                // Negociación de salarios
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: #FF6B9D;">💼 ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            } else if (item.tipoActividad === "oferta_fichaje") {
                // Ofertas de fichaje
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: #00D9FF;">🚀 ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            } else if (item.tipoActividad === "contrato_sponsor") {
                // Contratos de patrocinio
                contenedor.innerHTML += `<div style="padding:12px; border:1px solid #333; margin-bottom:8px; background: rgba(255,255,255,0.02); border-radius:4px;"><strong style="color: #FFD700;">💎 ${item.nombreEquipo}</strong>: ${item.detalle}</div>`;
            }
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
            tipoTexto = contract.type === "fixed" ? "Dinero Garantizado" : "Performance-Based";
            if (contract.type === "fixed") {
                detallesTexto = `Garantizado: $${contract.guaranteed.toLocaleString()}`;
            } else {
                const posText = contract.targetPosition === 1 ? "1º" : (contract.targetPosition === 2 ? "2º" : (contract.targetPosition === 3 ? "3º" : contract.targetPosition + "º"));
                detallesTexto = `Objetivo: Top ${posText} | Max: $${contract.max.toLocaleString()} | Inicial: $${contract.base.toLocaleString()}`;
            }
            
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

// ==========================================
// FUNCIONES DE COMUNICADOS Y OFERTAS
// ==========================================
window.cambiarTipoComunicado = () => {
    const tipo = document.getElementById("msg-tipo").value;
    document.getElementById("div-remitente-oficial").style.display = tipo === "oficial" ? "block" : "none";
    document.getElementById("div-remitente-piloto").style.display = tipo === "piloto" ? "block" : "none";
    
    const selectDestino = document.getElementById("msg-destinatario");
    
    if (tipo === "oficial") {
        // Mostrar todos los equipos
        selectDestino.innerHTML = '<option value="todos">A todos los equipos</option>';
        equiposList.forEach(eq => {
            selectDestino.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        });
    } else {
        // Tipo piloto - será actualizado cuando se seleccione un piloto
        selectDestino.innerHTML = '<option value="">Selecciona primero un piloto</option>';
    }
    
    if (tipo === "piloto") {
        // Cargar equipos en el select
        document.getElementById("msg-equipo-piloto").innerHTML = '<option value="">Selecciona un equipo</option>';
        equiposList.forEach(eq => {
            document.getElementById("msg-equipo-piloto").innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        });
    }
};

window.actualizarPilotosPorEquipo = () => {
    const equipoId = document.getElementById("msg-equipo-piloto").value;
    const pilotos = pilotosList.filter(p => p.equipoId === equipoId);
    document.getElementById("msg-piloto-remitente").innerHTML = '<option value="">Selecciona un piloto</option>';
    pilotos.forEach(p => {
        document.getElementById("msg-piloto-remitente").innerHTML += `<option value="${p.id}|${p.nombre} ${p.apellido}">${p.nombre} ${p.apellido || ''}</option>`;
    });
    
    // Actualizar el select de destinatario para mostrar todos los equipos, incluyendo el propio
    const selectDestino = document.getElementById("msg-destinatario");
    selectDestino.innerHTML = '<option value="">Selecciona el equipo destinatario</option>';
    equiposList.forEach(eq => {
        selectDestino.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
    });
};

// ==========================================
// CARGAR OFERTAS EN ADMIN
// ==========================================
async function cargarOfertasAdmin() {
    const contenedor = document.getElementById("lista-ofertas-admin");
    try {
        // Obtener todas las ofertas
        const snapshot = await getDocs(collection(db, "ofertas"));
        
        // Filtrar solo las pendientes
        const ofertasPendientes = Array.from(snapshot.docs)
            .filter(doc => doc.data().estado === "Pendiente")
            .map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log("Ofertas encontradas:", ofertasPendientes.length);
        
        if(ofertasPendientes.length === 0) { 
            contenedor.innerHTML = "<p class='text-muted'>No hay ofertas pendientes.</p>"; 
            return; 
        }
        
        contenedor.innerHTML = "";
        ofertasPendientes.forEach(oferta => {
            const id = oferta.id;
            
            // Buscar nombres de pilotos y equipos
            const equipoOrigen = equiposList.find(e => e.id === oferta.equipoOrigenId);
            const equipoDestino = equiposList.find(e => e.id === oferta.equipoDestinoId);
            const pilotoDestino = pilotosList.find(p => p.id === oferta.pilotoDestinoId);
            
            const html = `
                <div style="padding: 15px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.02);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Oferente</p>
                            <p style="margin: 0; font-weight: 600;">${equipoOrigen?.nombre || 'Equipo'}</p>
                            <p style="margin: 0; font-size: 0.9rem; color: #4CAF50;">💵 Compensación: $${oferta.compensacion}M</p>
                            <p style="margin: 0; font-size: 0.9rem; color: #2196F3;">💰 Sueldo: $${oferta.sueldo.toLocaleString()}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Piloto Objetivo</p>
                            <p style="margin: 0; font-weight: 600;">#${pilotoDestino?.numero} ${pilotoDestino?.nombre} ${pilotoDestino?.apellido || ''}</p>
                            <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">De: ${equipoDestino?.nombre || 'Equipo'}</p>
                        </div>
                    </div>
                    <p style="margin: 0 0 15px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.9rem;">"${oferta.mensaje || 'Oferta de transferencia'}"</p>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="aceptarOferta('${id}')" style="flex: 1; padding: 8px; background: #4CAF50; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 600;">✓ Aceptar</button>
                        <button onclick="rechazarOferta('${id}')" style="flex: 1; padding: 8px; background: #f44336; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 600;">✗ Rechazar</button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += html;
        });
    } catch (e) { 
        console.error("Error cargando ofertas:", e);
        contenedor.innerHTML = "<p class='text-muted'>Error al cargar ofertas: " + e.message + "</p>";
    }
}

window.aceptarOferta = async (ofertaId) => {
    if(confirm("¿Aceptar esta oferta?")) {
        try {
            const ofertaDoc = await getDoc(doc(db, "ofertas", ofertaId));
            const oferta = ofertaDoc.data();
            
            // Actualizar piloto: cambiar de equipo
            await updateDoc(doc(db, "pilotos", oferta.pilotoDestinoId), {
                equipoId: oferta.equipoOrigenId,
                salario: oferta.sueldo
            });
            
            // Restar presupuesto del equipo oferente (compensación + sueldo)
            const equipoOferente = await getDoc(doc(db, "equipos", oferta.equipoOrigenId));
            const nuevoPresupuesto = (equipoOferente.data().presupuesto || 0) - (oferta.compensacion * 1000000 + oferta.sueldo);
            await updateDoc(doc(db, "equipos", oferta.equipoOrigenId), {
                presupuesto: nuevoPresupuesto
            });
            
            // Sumar presupuesto al equipo que pierde al piloto
            const equipoDestino = await getDoc(doc(db, "equipos", oferta.equipoDestinoId));
            const presupuestoDestino = (equipoDestino.data().presupuesto || 0) + (oferta.compensacion * 1000000);
            await updateDoc(doc(db, "equipos", oferta.equipoDestinoId), {
                presupuesto: presupuestoDestino
            });
            
            // Marcar oferta como aceptada
            await updateDoc(doc(db, "ofertas", ofertaId), {
                estado: "Aceptada"
            });
            
            // Notificar a ambos equipos
            await addDoc(collection(db, "notificaciones"), {
                equipoId: oferta.equipoOrigenId,
                remitente: "Admin",
                texto: `✓ Tu oferta por ${pilotosList.find(p => p.id === oferta.pilotoDestinoId)?.nombre} ha sido ACEPTADA.`,
                fecha: serverTimestamp()
            });
            
            alert("Oferta aceptada. Transferencia completada.");
            cargarOfertasAdmin();
        } catch(e) {
            console.error("Error aceptando oferta:", e);
            alert("Error al aceptar la oferta");
        }
    }
};

window.rechazarOferta = async (ofertaId) => {
    if(confirm("¿Rechazar esta oferta?")) {
        try {
            await updateDoc(doc(db, "ofertas", ofertaId), {
                estado: "Rechazada"
            });
            
            // Notificar al equipo oferente
            const ofertaDoc = await getDoc(doc(db, "ofertas", ofertaId));
            const oferta = ofertaDoc.data();
            
            await addDoc(collection(db, "notificaciones"), {
                equipoId: oferta.equipoOrigenId,
                remitente: "Admin",
                texto: `✗ Tu oferta por el piloto ha sido RECHAZADA.`,
                fecha: serverTimestamp()
            });
            
            alert("Oferta rechazada.");
            cargarOfertasAdmin();
        } catch(e) {
            console.error("Error rechazando oferta:", e);
            alert("Error al rechazar la oferta");
        }
    }
};

async function cargarRespuestas() {
    const listaRespuestas = document.getElementById("lista-respuestas");
    listaRespuestas.innerHTML = "<p>Cargando respuestas...</p>";
    
    try {
        const mensajesSnap = await getDocs(collection(db, "mensajes_aprobacion"));
        listaRespuestas.innerHTML = "";
        
        if (mensajesSnap.empty) {
            listaRespuestas.innerHTML = "<p>No hay mensajes de aprobación enviados.</p>";
            return;
        }
        
        for (const msgDoc of mensajesSnap.docs) {
            const mensaje = msgDoc.data();
            const msgEl = document.createElement("div");
            msgEl.className = "card";
            msgEl.innerHTML = `
                <h3>Mensaje enviado: "${mensaje.texto}"</h3>
                <p><strong>Fecha:</strong> ${mensaje.fecha?.toDate().toLocaleString() || 'N/A'}</p>
                <div id="respuestas-${msgDoc.id}" style="margin-top: 15px;">
                    <p>Cargando respuestas...</p>
                </div>
            `;
            listaRespuestas.appendChild(msgEl);
            
            // Cargar respuestas para este mensaje
            const respuestasSnap = await getDocs(query(collection(db, "respuestas_mensajes"), where("mensajeId", "==", msgDoc.id)));
            const respuestasDiv = document.getElementById(`respuestas-${msgDoc.id}`);
            respuestasDiv.innerHTML = "";
            
            if (respuestasSnap.empty) {
                respuestasDiv.innerHTML = "<p style='color: var(--text-secondary);'>Ningún equipo ha respondido aún.</p>";
            } else {
                respuestasSnap.forEach(async (respDoc) => {
                    const resp = respDoc.data();
                    const equipoSnap = await getDoc(doc(db, "equipos", resp.equipoId));
                    const equipoNombre = equipoSnap.exists() ? equipoSnap.data().nombre : "Equipo desconocido";
                    
                    const respEl = document.createElement("div");
                    respEl.style.cssText = "padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 5px;";
                    respEl.innerHTML = `
                        <strong>${equipoNombre}:</strong> ${resp.estado} 
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">(${resp.fecha?.toDate().toLocaleString() || 'N/A'})</span>
                    `;
                    respuestasDiv.appendChild(respEl);
                });
            }
        }
    } catch (error) {
        console.error("Error cargando respuestas:", error);
        listaRespuestas.innerHTML = "<p>Error al cargar las respuestas.</p>";
    }
}