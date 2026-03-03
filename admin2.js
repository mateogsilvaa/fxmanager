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
let esTestCarrera = false; // indica si la carrera es sólo de prueba (solo práctica, no puntos)

document.addEventListener("DOMContentLoaded", () => {
    console.log("=== ADMIN.JS CARGADO ===");
    
    // 1. SEGURIDAD ADMIN
    onAuthStateChanged(auth, async (user) => {
        console.log("Auth state changed. User:", user?.email);
        if (!user) { window.location.href = "home.html"; return; }
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (!userSnap.exists() || userSnap.data().isAdmin !== true) {
            alert("No tienes permisos de Administrador.");
            window.location.href = "home.html";
            return;
        }
        console.log("✅ Usuario admin confirmado");
        await refrescarDatosGlobales();
        console.log("✅ Datos globales cargados, llamando cargarActividad()");
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
            logo: document.getElementById("eq-logo").value,
            tokens: parseInt(document.getElementById("eq-tokens").value) || 0
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

        
        // Función auxiliar para recoger 20 inputs más tiempo/vueltas
        const recogerPosiciones = (prefijo) => {
            // si se ha marcado como test, sólo devolvemos datos para prácticas (y vaciamos tiempos/vueltas)
            const pilotos = [];
            const tiempos = [];
            const vueltas = [];
            for (let i = 1; i <= 20; i++) {
                pilotos.push(document.getElementById(`${prefijo}-${i}`).value);
                tiempos.push(document.getElementById(`${prefijo}-${i}-tiempo`) ? document.getElementById(`${prefijo}-${i}-tiempo`).value : '');
                vueltas.push(document.getElementById(`${prefijo}-${i}-vueltas`) ? document.getElementById(`${prefijo}-${i}-vueltas`).value : '');
            }
            if (esTestCarrera && prefijo !== 'pos-prac') {
                return { pilotos: [], tiempos: [], vueltas: [] };
            }
            return { pilotos, tiempos, vueltas };
        };

        const ent = recogerPosiciones('pos-prac');
        const qual = recogerPosiciones('pos-qual');
        const race = recogerPosiciones('pos-race');

        const data = {
            ronda: parseInt(document.getElementById("car-ronda").value),
            nombre: document.getElementById("car-nombre").value,
            circuito: document.getElementById("car-circuito").value,
            fecha: document.getElementById("car-fecha").value,
            pole: document.getElementById("car-pole").value,
            vr: document.getElementById("car-vr").value,
            entrenamientos: ent.pilotos,
            entrenamientos_tiempo: ent.tiempos,
            entrenamientos_vueltas: ent.vueltas,
            clasificacion: qual.pilotos,
            clasificacion_tiempo: qual.tiempos,
            clasificacion_vueltas: qual.vueltas,
            resultados_20: race.pilotos,
            resultados_tiempo: race.tiempos,
            resultados_vueltas: race.vueltas,
            completada: document.getElementById("car-completada").checked,
            test: esTestCarrera
        };
        await guardarDoc('carreras', document.getElementById("car-id").value, data, 'modal-carrera');
    });

    // listener para botón de test (se puede pulsar en cualquier momento antes de guardar)
    const btnTest = document.getElementById("car-btn-test");
    if (btnTest) btnTest.addEventListener("click", marcarCarreraTest);


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
    
    if (selectFiltroActividad) {
        selectFiltroActividad.innerHTML = '<option value="">-- Todos los equipos --</option>';
    }
    
    equiposList.forEach(eq => {
        selectMsg.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        selectPil.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        if (selectFiltroActividad) {
            selectFiltroActividad.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        }
    });
    
    // Agregar listener al selector de filtro de actividad
    if (selectFiltroActividad) {
        selectFiltroActividad.addEventListener("change", () => {
            cargarActividad();
        });
    }

    pintarTablaEquipos();
    pintarTablaPilotos();
    pintarTablaCarreras();
    pintarTablaMedia();
    pintarTablaSponsors();
    pintarTablaEstrategias(); // Nueva función S2
}

// ... Funciones de Actividad ...
async function cargarActividad() {
    const contenedor = document.getElementById("lista-actividad");
    if (!contenedor) {
        console.error("Elemento lista-actividad no encontrado en el DOM");
        return;
    }
    
    const filtroElement = document.getElementById("filtro-equipo-actividad");
    const filtroEquipo = filtroElement ? filtroElement.value : "";
    
    console.log("=== CARGANDO ACTIVIDAD ===");
    console.log("Filtro equipo:", filtroEquipo || "(Sin filtro)");
    
    try {
        const actividadSnap = await getDocs(collection(db, "actividad_equipos"));
        console.log("📊 Documentos en actividad_equipos:", actividadSnap.size);
        
        const notifsSnap = await getDocs(collection(db, "notificaciones"));
        const notifsSet = new Set();
        notifsSnap.forEach(n => notifsSet.add(n.id));
        
        const solicitudesSnap = await getDocs(collection(db, "solicitudes_admin"));
        
        const todas = [];
        
        actividadSnap.forEach(doc => {
            const actividad = doc.data();
            if (actividad.notificacionId && !notifsSet.has(actividad.notificacionId)) {
                return;
            }
            if (filtroEquipo && actividad.equipoId !== filtroEquipo) {
                return;
            }
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
            if (filtroEquipo && solicitud.equipoId !== filtroEquipo) {
                return;
            }
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
        
        todas.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : (a.fecha instanceof Date ? a.fecha : new Date(a.fecha || 0));
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : (b.fecha instanceof Date ? b.fecha : new Date(b.fecha || 0));
            return fechaB.getTime() - fechaA.getTime();
        });
        
        if(todas.length === 0) { 
            contenedor.innerHTML = "<p class='text-muted'>No hay actividad reciente.</p>"; 
            return; 
        }
        
        contenedor.innerHTML = "";
        todas.forEach(item => {
            const equipo = equiposList.find(e => e.id === item.equipoId);
            const colorEquipo = equipo?.color || "var(--accent)";
            
            const getItemHTML = () => {
                const estiloBase = `
                    padding: 16px;
                    margin-bottom: 12px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
                    border-left: 4px solid ${colorEquipo};
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                `;
                
                if (item.tipo === "solicitud") {
                    const badge = item.estado === "Pendiente" ? "REQUIERE ACCIÓN" : item.estado;
                    const btns = item.estado === "Pendiente" ? `<div style="margin-top:12px; display: flex; gap: 8px;"><button class="btn-solid" style="flex: 1; padding: 6px 12px; font-size: 0.8rem;" onclick="resolverActividad('${item.id}', '${item.equipoId}', 'Aprobada')">✓ OK</button><button class="btn-outline" style="flex: 1; padding: 6px 12px; font-size: 0.8rem;" onclick="resolverActividad('${item.id}', '${item.equipoId}', 'Denegada')">✕ NO</button></div>` : "";
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">📋 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p><span style="display: inline-block; margin-top: 8px; padding: 4px 10px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.8rem; color: var(--text-secondary);">[${badge}]</span>${btns}</div>`;
                } else if (item.tipoActividad === "compra_investigacion") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">💰 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "mejora") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">⚡ ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "investigacion") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">🔍 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "nego_salario") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">💼 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "oferta_fichaje") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">🚀 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "contrato_sponsor") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">💎 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                } else if (item.tipoActividad === "estrategia") {
                    return `<div style="${estiloBase}"><strong style="color: ${colorEquipo}; font-size: 1.1rem;">🏁 ${item.nombreEquipo}</strong><p style="margin: 8px 0 0 0; color: var(--text-secondary); line-height: 1.5;">${item.detalle}</p></div>`;
                }
                return "";
            };
            
            contenedor.innerHTML += getItemHTML();
        });
    } catch (e) { 
        console.error("Error cargando actividad:", e);
        contenedor.innerHTML = `<p class='text-muted'>Error cargando actividad: ${e.message}</p>`;
    }
}
window.resolverActividad = async (id, eqId, res) => {
    if(confirm("¿Confirmar?")) {
        await updateDoc(doc(db, "solicitudes_admin", id), { estado: res });
        await addDoc(collection(db, "notificaciones"), { equipoId: eqId, remitente: "Admin", texto: `Solicitud ${res}`, fecha: serverTimestamp() });
        cargarActividad();
    }
}
// ==========================================
// FUNCIÓN PARA COBRAR SUELDOS DE PILOTOS
// ==========================================
window.cobrarSueldosPilotos = async function() {
    if (!confirm("¿Estás seguro de que quieres cobrar los sueldos de TODOS los pilotos a sus respectivos equipos? Esta acción restará el dinero del presupuesto de cada equipo.")) {
        return;
    }

    console.log("Iniciando cobro de sueldos...");
    
    const gastosPorEquipo = {};
    equiposList.forEach(eq => {
        gastosPorEquipo[eq.id] = {
            nombre: eq.nombre,
            presupuestoActual: eq.presupuesto || 0,
            totalASumar: 0,
            pilotos: [] 
        };
    });

    pilotosList.forEach(piloto => {
        if (piloto.equipoId && piloto.salario > 0 && gastosPorEquipo[piloto.equipoId]) {
            gastosPorEquipo[piloto.equipoId].totalASumar += piloto.salario;
            gastosPorEquipo[piloto.equipoId].pilotos.push(`${piloto.nombre} ($${piloto.salario.toLocaleString()})`);
        }
    });

    let equiposAfectados = 0;
    const promesas = [];

    for (const eqId in gastosPorEquipo) {
        const info = gastosPorEquipo[eqId];
        if (info.totalASumar > 0) {
            equiposAfectados++;
            const nuevoPresupuesto = info.presupuestoActual - info.totalASumar;
            
            promesas.push(updateDoc(doc(db, "equipos", eqId), { presupuesto: nuevoPresupuesto }));
            promesas.push(addDoc(collection(db, "actividad_equipos"), {
                equipoId: eqId,
                nombreEquipo: info.nombre,
                tipo: "pago_sueldos",
                detalle: `Pago de sueldos de pilotos por carrera: -$${info.totalASumar.toLocaleString()} (${info.pilotos.join(", ")})`,
                fecha: serverTimestamp()
            }));
            promesas.push(addDoc(collection(db, "notificaciones"), {
                equipoId: eqId,
                remitente: "Sistema Financiero",
                texto: `💸 Se ha deducido el sueldo de tus pilotos por carrera: -$${info.totalASumar.toLocaleString()}.`,
                fecha: serverTimestamp()
            }));
            console.log(`Equipo ${info.nombre}: -$${info.totalASumar} (Nuevo pres: ${nuevoPresupuesto})`);
        }
    }

    if (equiposAfectados === 0) {
        alert("Ningún piloto tiene asignado un equipo o un salario mayor a 0. No se ha cobrado nada.");
        return;
    }

    try {
        await Promise.all(promesas); 
        alert(`Sueldos cobrados con éxito. Se actualizó el presupuesto de ${equiposAfectados} equipos.`);
        await refrescarDatosGlobales(); 
    } catch (error) {
        console.error("Error al cobrar sueldos:", error);
        alert("Ocurrió un error al intentar cobrar los sueldos. Revisa la consola.");
    }
};

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
        const status = c.test ? '<span style="color:var(--info);">TEST</span>' : (c.completada ? '<span style="color:var(--success);">Completada</span>' : '<span style="color:var(--warning);">Pendiente</span>');
        
        tbody.innerHTML += `
            <tr>
                <td>R${c.ronda}</td>
                <td><strong>${c.nombre}</strong></td>
                <td>${status}</td>
                <td>
                    <button class="btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='editarCarrera(${JSON.stringify(cData).replace(/'/g, "&#39;")})'>Editar Resultados</button>
                    <button class="btn-solid" style="background:var(--danger); border:none; padding:5px 10px; font-size:0.8rem;" onclick="eliminarDoc('carreras', '${d.id}')">X</button>
                </td>
            </tr>`;
    });
}

window.editarCarrera = (data) => {
    esTestCarrera = false;
    const btn = document.getElementById('car-btn-test');
    if (btn) btn.textContent = 'Test';
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.style.display = 'inline-block');
    document.querySelectorAll('.session-content').forEach(c => c.style.display = 'block');

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

    const generarSelects = (containerId, prefijo, datosGuardados, tiemposGuardados, vueltasGuardados) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        for (let i = 1; i <= 20; i++) {
            container.innerHTML += `
                <div style="display:flex; flex-direction:column; gap:4px; margin-bottom: 8px;">
                    <label style="font-size:0.8rem; color: var(--accent); font-weight: bold;">Posición ${i}º</label>
                    <select id="${prefijo}-${i}" style="padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white;">
                        ${opcionesPilotos}
                    </select>
                    <div style="display: flex; gap: 5px;">
                        <input type="text" inputmode="text" id="${prefijo}-${i}-tiempo" placeholder="Ej: 1:20.450" style="flex: 2; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white; font-family: monospace;" />
                        <input type="number" id="${prefijo}-${i}-vueltas" placeholder="Vueltas" min="0" style="flex: 1; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white;" />
                    </div>
                </div>`;
        }
    };

    generarSelects("container-practica", "pos-prac", data.entrenamientos, data.entrenamientos_tiempo, data.entrenamientos_vueltas);
    generarSelects("container-clasificacion", "pos-qual", data.clasificacion, data.clasificacion_tiempo, data.clasificacion_vueltas);
    generarSelects("container-carrera", "pos-race", data.resultados_20, data.resultados_tiempo, data.resultados_vueltas);

    if (data.test || (!data.completada && (!data.clasificacion || data.clasificacion.every(v=>!v)) && (!data.resultados_20 || data.resultados_20.every(v=>!v)))) {
        esTestCarrera = true;
        marcarCarreraTest();
    }

    for (let i = 1; i <= 20; i++) {
        if(data.entrenamientos && data.entrenamientos[i-1]) document.getElementById(`pos-prac-${i}`).value = data.entrenamientos[i-1];
        if(data.entrenamientos_tiempo && data.entrenamientos_tiempo[i-1]) document.getElementById(`pos-prac-${i}-tiempo`).value = data.entrenamientos_tiempo[i-1];
        if(data.entrenamientos_vueltas && data.entrenamientos_vueltas[i-1]) document.getElementById(`pos-prac-${i}-vueltas`).value = data.entrenamientos_vueltas[i-1];
        if(data.clasificacion && data.clasificacion[i-1]) document.getElementById(`pos-qual-${i}`).value = data.clasificacion[i-1];
        if(data.clasificacion_tiempo && data.clasificacion_tiempo[i-1]) document.getElementById(`pos-qual-${i}-tiempo`).value = data.clasificacion_tiempo[i-1];
        if(data.clasificacion_vueltas && data.clasificacion_vueltas[i-1]) document.getElementById(`pos-qual-${i}-vueltas`).value = data.clasificacion_vueltas[i-1];
        if(data.resultados_20 && data.resultados_20[i-1]) document.getElementById(`pos-race-${i}`).value = data.resultados_20[i-1];
        if(data.resultados_tiempo && data.resultados_tiempo[i-1]) document.getElementById(`pos-race-${i}-tiempo`).value = data.resultados_tiempo[i-1];
        if(data.resultados_vueltas && data.resultados_vueltas[i-1]) document.getElementById(`pos-race-${i}-vueltas`).value = data.resultados_vueltas[i-1];
    }

    document.getElementById("modal-carrera").style.display = "flex";
}

function marcarCarreraTest() {
    const btn = document.getElementById('car-btn-test');
    const hideExtras = (hide) => {
        const tabs = document.querySelectorAll('.modal-tab-btn');
        const sessions = document.querySelectorAll('.session-content');
        tabs.forEach((b, idx) => {
            if (idx > 0) b.style.display = hide ? 'none' : 'inline-block';
        });
        sessions.forEach((c, idx) => {
            if (idx > 0) c.style.display = hide ? 'none' : 'block';
        });
    };

    if (esTestCarrera) {
        esTestCarrera = false;
        hideExtras(false);
        if (btn) btn.textContent = 'Test';
        alert('Modo TEST desactivado. Puedes volver a introducir qualy/carrera.');
        return;
    }

    esTestCarrera = true;
    if (btn) btn.textContent = 'Test (activo)';
    for (let i = 1; i <= 20; i++) {
        const q = document.getElementById(`pos-qual-${i}`);
        const r = document.getElementById(`pos-race-${i}`);
        if (q) q.value = '';
        if (r) r.value = '';
        ['qual','race'].forEach(pref => {
            ['tiempo','vueltas'].forEach(suf => {
                const el = document.getElementById(`pos-${pref}-${i}-${suf}`);
                if (el) el.value = '';
            });
        });
    }
    document.getElementById('car-completada').checked = false;
    hideExtras(true);
    cambiarPestanaSesion('practica');
    alert('Carrera marcada como TEST: sólo prácticas y no contará para puntos.');
}

function pintarTablaEquipos() {
    const tbody = document.getElementById("tabla-equipos");
    tbody.innerHTML = "";
    equiposList.forEach(eq => {
        tbody.innerHTML += `<tr>
            <td>${eq.logo ? `<img src="${eq.logo}" style="width:30px;">` : ''}</td>
            <td>${eq.nombre}</td>
            <td style="font-weight: bold; color: var(--accent);">${eq.tokens || 0}</td>
            <td><div style="width:20px;height:20px;background:${eq.color};"></div></td>
            <td><button onclick='editarEquipo(${JSON.stringify(eq).replace(/'/g, "&#39;")})'>Editar</button><button onclick="eliminarDoc('equipos','${eq.id}')">X</button></td>
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
            <td><button onclick='editarPiloto(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Editar</button><button onclick="eliminarDoc('pilotos','${p.id}')">X</button></td>
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

// Nueva función para pintar las estrategias S2
function pintarTablaEstrategias() {
    const tbody = document.getElementById("tabla-estrategias");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    equiposList.forEach(eq => {
        const est = eq.estrategia || { paradas: 'No definida', motor: 'No definida', ordenes: 'No definida' };
        tbody.innerHTML += `<tr>
            <td style="color: ${eq.color}; font-weight: bold;">${eq.nombre}</td>
            <td><span style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${est.paradas.toUpperCase()}</span></td>
            <td><span style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${est.motor.toUpperCase()}</span></td>
            <td><span style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${est.ordenes.toUpperCase()}</span></td>
        </tr>`;
    });
}

window.editarEquipo = (data) => {
    document.getElementById("eq-id").value = data.id; 
    document.getElementById("eq-nombre").value = data.nombre; 
    document.getElementById("eq-color").value = data.color; 
    document.getElementById("eq-coche").value = data.imagenCoche||""; 
    document.getElementById("eq-logo").value = data.logo||"";
    document.getElementById("eq-tokens").value = data.tokens || 0;
    document.getElementById("modal-equipo").style.display = "flex";
}
window.editarPiloto = (data) => {
    document.getElementById("pil-id").value = data.id; document.getElementById("pil-nombre").value = data.nombre; document.getElementById("pil-apellido").value = data.apellido; document.getElementById("pil-numero").value = data.numero; document.getElementById("pil-pais").value = data.pais; document.getElementById("pil-edad").value = data.edad; document.getElementById("pil-ritmo").value = data.ritmo; document.getElementById("pil-agresividad").value = data.agresividad; document.getElementById("pil-moral").value = data.moral; document.getElementById("pil-equipo").value = data.equipoId; document.getElementById("pil-foto").value = data.foto;
    document.getElementById("modal-piloto").style.display = "flex";
}
window.editarMedia = (data) => { alert("Usa borrar y crear nuevo."); } 

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
        if (carrera.test) return;
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
        selectDestino.innerHTML = '<option value="todos">A todos los equipos</option>';
        equiposList.forEach(eq => {
            selectDestino.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
        });
    } else {
        selectDestino.innerHTML = '<option value="">Selecciona primero un piloto</option>';
    }
    
    if (tipo === "piloto") {
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
    
    const selectDestino = document.getElementById("msg-destinatario");
    selectDestino.innerHTML = '<option value="">Selecciona el equipo destinatario</option>';
    equiposList.forEach(eq => {
        selectDestino.innerHTML += `<option value="${eq.id}">${eq.nombre}</option>`;
    });
};

async function cargarOfertasAdmin() {
    const contenedor = document.getElementById("lista-ofertas-admin");
    try {
        const snapshot = await getDocs(collection(db, "ofertas"));
        
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
            
            await updateDoc(doc(db, "pilotos", oferta.pilotoDestinoId), {
                equipoId: oferta.equipoOrigenId,
                salario: oferta.sueldo
            });
            
            const equipoOferente = await getDoc(doc(db, "equipos", oferta.equipoOrigenId));
            const nuevoPresupuesto = (equipoOferente.data().presupuesto || 0) - (oferta.compensacion * 1000000 + oferta.sueldo);
            await updateDoc(doc(db, "equipos", oferta.equipoOrigenId), {
                presupuesto: nuevoPresupuesto
            });
            
            const equipoDestino = await getDoc(doc(db, "equipos", oferta.equipoDestinoId));
            const presupuestoDestino = (equipoDestino.data().presupuesto || 0) + (oferta.compensacion * 1000000);
            await updateDoc(doc(db, "equipos", oferta.equipoDestinoId), {
                presupuesto: presupuestoDestino
            });
            
            await updateDoc(doc(db, "ofertas", ofertaId), {
                estado: "Aceptada"
            });
            
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

// ==========================================
// FUNCIONES DEL MERCADO DE AGENTES S2 (ADMIN)
// ==========================================

window.generarMercadoDiario = async function() {
    if (!confirm("¿Generar un nuevo mercado? Esto borrará cualquier agente que esté actualmente sin vender.")) return;
    
    // 1. Limpiar mercado actual
    const mercadoSnap = await getDocs(collection(db, "mercado_agentes"));
    for (const docSnap of mercadoSnap.docs) {
        await deleteDoc(doc(db, "mercado_agentes", docSnap.id));
    }

    // 2. Nombres falsos aleatorios para darle inmersión
    const nombresPilotos = ["M. Dubois", "A. Silva", "K. Tanaka", "J. Rossi", "L. Weber"];
    const nombresJuniors = ["T. Rookie", "S. Veloce", "N. Promesa", "E. Fast", "O. Talent"];
    const nombresIngenieros = ["Dr. Aero", "H. Motor", "G. Setup", "V. Chasis", "B. Pista"];

    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // 3. Crear 2 Pilotos, 2 Juniors y 2 Ingenieros
    const agentesNuevos = [
        { tipo: "piloto", nombre: getRandom(nombresPilotos) + " (Piloto Libre)", stats: "Ritmo: 75 | Agresividad: 80", precioBase: 2000000 },
        { tipo: "piloto", nombre: getRandom(nombresPilotos) + " (Piloto Libre)", stats: "Ritmo: 82 | Agresividad: 60", precioBase: 3000000 },
        { tipo: "junior", nombre: getRandom(nombresJuniors) + " (Junior F2)", stats: "Potencial Alto | Sueldo Anual", precioBase: 1000000 },
        { tipo: "junior", nombre: getRandom(nombresJuniors) + " (Junior F3)", stats: "Diamante en bruto", precioBase: 500000 },
        { tipo: "ingeniero", nombre: getRandom(nombresIngenieros) + " (Ing. Pista)", stats: "Mejora ritmo + Moral", precioBase: 1500000 },
        { tipo: "ingeniero", nombre: getRandom(nombresIngenieros) + " (Ing. Mesa)", stats: "Mejora curva de fallos", precioBase: 2500000 }
    ];

    try {
        for (const agente of agentesNuevos) {
            await addDoc(collection(db, "mercado_agentes"), {
                ...agente,
                pujaActual: 0,
                mejorPostorId: null,
                mejorPostorNombre: null,
                fechaCreacion: serverTimestamp()
            });
        }
        
        // Notificar a todos los equipos que el mercado abrió
        for (const eq of equiposList) {
            await addDoc(collection(db, "notificaciones"), {
                equipoId: eq.id,
                remitente: "FIA",
                texto: `🛒 ¡El Mercado de Agentes ha abierto! Tienes 24h para pujar por pilotos e ingenieros libres.`,
                fecha: serverTimestamp()
            });
        }
        
        alert("✅ Mercado generado. Los equipos ya pueden pujar.");
    } catch (e) {
        console.error(e);
        alert("Error generando mercado.");
    }
};

window.cerrarMercadoDiario = async function() {
    if (!confirm("¿Cerrar el mercado? Se asignarán los derechos a los ganadores y se vaciará la lista.")) return;

    try {
        const mercadoSnap = await getDocs(collection(db, "mercado_agentes"));
        
        for (const docSnap of mercadoSnap.docs) {
            const agente = docSnap.data();
            
            // Si alguien ganó la puja
            if (agente.mejorPostorId) {
                // Notificar al ganador
                await addDoc(collection(db, "notificaciones"), {
                    equipoId: agente.mejorPostorId,
                    remitente: "Mercado FIA",
                    texto: `🏆 ¡Has ganado la subasta por ${agente.nombre} (Por $${agente.pujaActual.toLocaleString()})! Tienes los derechos para negociar su contrato.`,
                    fecha: serverTimestamp()
                });
                
                // Registrar en actividad
                await addDoc(collection(db, "actividad_equipos"), {
                    equipoId: agente.mejorPostorId,
                    nombreEquipo: agente.mejorPostorNombre,
                    tipo: "mercado",
                    detalle: `Ganó la subasta por ${agente.nombre} pagando $${agente.pujaActual.toLocaleString()}`,
                    fecha: serverTimestamp()
                });
            }
            
            // Borrar el agente del mercado
            await deleteDoc(doc(db, "mercado_agentes", docSnap.id));
        }

        alert("🛑 Mercado cerrado correctamente. Ganadores notificados.");
    } catch (e) {
        console.error(e);
        alert("Error cerrando mercado.");
    }
};
