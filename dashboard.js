// dashboard.js - NUEVO Dashboard completamente rediseñado y funcional
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, doc, getDoc, collection, query, where, getDocs, 
    updateDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let currentUser = null;
let currentTeamId = null;
let currentTeamData = null;
let allPilotos = [];
let allEquipos = [];

// Costes de mejoras dinámicos (Nivel 0->1 hasta Nivel 6->7)
const COSTOS_AERO = [3000000, 5000000, 8000000, 12000000, 17000000, 20000000, 25000000];
const COSTOS_MOTOR = [5000000, 8000000, 12000000, 17000000, 20000000, 25000000, 30000000];
const MAX_LEVEL = 7;
const TOTAL_CARRERAS = 10; // Para el contrato por rendimiento

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        currentUser = user;
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || !userSnap.data().equipo) {
            alert("No tienes equipo asignado");
            window.location.href = "equipos.html";
            return;
        }

        currentTeamId = userSnap.data().equipo;
        await cargarDatos();
        escucharNotificaciones();
    });
});

async function cargarDatos() {
    try {
        // Cargar equipo actual
        const teamRef = doc(db, "equipos", currentTeamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;
        currentTeamData = teamSnap.data();

        // Cargar todos los pilotos
        const pilotosSnap = await getDocs(collection(db, "pilotos"));
        allPilotos = [];
        pilotosSnap.forEach(doc => allPilotos.push({ id: doc.id, ...doc.data() }));

        // Cargar todos los equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        allEquipos = [];
        equiposSnap.forEach(doc => allEquipos.push({ id: doc.id, ...doc.data() }));

        renderUI();
        setupListeners();
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function renderUI() {
    // Información del equipo
    document.getElementById("team-name").textContent = currentTeamData.nombre;
    document.getElementById("team-name").style.color = currentTeamData.color;
    document.getElementById("team-budget").textContent = `$${(currentTeamData.presupuesto || 0).toLocaleString()}`;
    document.getElementById("team-points").textContent = currentTeamData.puntos || 0;
    document.getElementById("team-wins").textContent = currentTeamData.victorias || 0;
    document.getElementById("team-championships").textContent = currentTeamData.mundiales || 0;

    // Coche del equipo
    const carDisplay = document.getElementById("team-car-display");
    if (currentTeamData.imagenCoche) {
        carDisplay.innerHTML = `<img src="${currentTeamData.imagenCoche}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else {
        carDisplay.innerHTML = `<span style="color: var(--text-secondary);">Sin coche asignado</span>`;
    }

    // Pilotos
    const pilotosMiEquipo = allPilotos.filter(p => p.equipoId === currentTeamId);
    const driversContainer = document.getElementById("drivers-container");
    driversContainer.innerHTML = "";

    if (pilotosMiEquipo.length === 0) {
        driversContainer.innerHTML = `<p style="text-align:center; color: var(--text-secondary); width: 100%;">No tienes pilotos contratados.</p>`;
    }

    pilotosMiEquipo.forEach(piloto => {
        const card = document.createElement("div");
        card.className = "driver-card-modern";
        
        const ritmoWidth = (piloto.ritmo || 0);
        const agresividadWidth = (piloto.agresividad || 0);
        const moralEmoji = piloto.moral === "Alta" ? "😊" : (piloto.moral === "Baja" ? "😔" : "😐");
        const moralColor = piloto.moral === "Alta" ? "#4CAF50" : (piloto.moral === "Baja" ? "#f44336" : "#8888aa");
        
        card.innerHTML = `
            <div class="driver-header-modern" style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div class="driver-photo-modern" style="flex-shrink: 0;">
                    ${piloto.foto ? `<img src="${piloto.foto}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 2px solid ${currentTeamData.color};">` : '<div style="width: 80px; height: 80px; background: var(--bg-tertiary); border-radius: 8px; display: flex; align-items: center; justify-content: center;">👤</div>'}
                </div>
                <div style="flex: 1;">
                    <p class="driver-name-modern" style="margin: 0 0 4px 0; font-size: 1.2rem; font-weight: bold;">#${piloto.numero} ${piloto.nombre} <span style="color: ${currentTeamData.color}; font-weight: 600;">${piloto.apellido || ''}</span></p>
                    <p class="driver-number-modern" style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">${piloto.pais} • ${piloto.edad || '?'} años</p>
                    <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
                        <span style="background: rgba(255,255,255,0.1); color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Activo ✓</span>
                    </div>
                </div>
            </div>
            
            <div class="driver-stats-section" style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Desempeño</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">Ritmo</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">${piloto.ritmo || 0}/100</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${ritmoWidth}%; height: 100%; background: linear-gradient(90deg, #ffffff, #e8e8e8); border-radius: 3px;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">Agresividad</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #FF6B6B;">${piloto.agresividad || 0}/100</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${agresividadWidth}%; height: 100%; background: linear-gradient(90deg, #FF6B6B, #ff1744); border-radius: 3px;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="driver-moral-section" style="background: rgba(255,107,53,0.08); padding: 10px; border-radius: 6px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; border-left: 3px solid ${moralColor};">
                <span style="font-size: 1.5rem;">${moralEmoji}</span>
                <div>
                    <p style="margin: 0 0 2px 0; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Moral</p>
                    <p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: ${moralColor};">${piloto.moral || 'Normal'}</p>
                </div>
            </div>
            
            <div class="driver-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn-outline" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; min-width: 100px;" onclick="negociarSalario('${piloto.id}')">💰 Renegociar</button>
                <button class="btn-outline" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; min-width: 100px;" onclick="verDetalles('${piloto.id}')">ℹ️ Detalles</button>
            </div>
        `;
        driversContainer.appendChild(card);
    });

    // Niveles de mejoras (Adaptado a nivel máximo 7)
    const aeroLevel = currentTeamData.aeroLevel || 0;
    const motorLevel = currentTeamData.motorLevel || 0;
    document.getElementById("aero-level").textContent = aeroLevel;
    document.getElementById("motor-level").textContent = motorLevel;
    document.getElementById("aero-progress").style.width = (aeroLevel * (100 / MAX_LEVEL)) + "%";
    document.getElementById("motor-progress").style.width = (motorLevel * (100 / MAX_LEVEL)) + "%";

    // ACTUALIZAR TEXTOS DE LOS BOTONES AUTOMÁTICAMENTE
    const btnAero = document.getElementById("btn-aero");
    if (btnAero) {
        if (aeroLevel >= MAX_LEVEL) {
            btnAero.textContent = "AL MÁXIMO";
            btnAero.disabled = true;
            btnAero.style.opacity = "0.5";
        } else {
            btnAero.textContent = `Mejorar Aero ($${COSTOS_AERO[aeroLevel] / 1000000}M)`;
            btnAero.disabled = false;
            btnAero.style.opacity = "1";
        }
    }

    const btnMotor = document.getElementById("btn-motor");
    if (btnMotor) {
        if (motorLevel >= MAX_LEVEL) {
            btnMotor.textContent = "AL MÁXIMO";
            btnMotor.disabled = true;
            btnMotor.style.opacity = "0.5";
        } else {
            btnMotor.textContent = `Mejorar Motor ($${COSTOS_MOTOR[motorLevel] / 1000000}M)`;
            btnMotor.disabled = false;
            btnMotor.style.opacity = "1";
        }
    }

    const btnBuyInv = document.getElementById("btn-buy-investigation");
    if (btnBuyInv) {
        btnBuyInv.textContent = "Comprar Extra ($3M)";
    }

    poblarSelectores();
}

function poblarSelectores() {
    const pilotosRivales = allPilotos.filter(p => p.equipoId !== currentTeamId);
    const selectPilot = document.getElementById("select-pilot-research");
    if (selectPilot) {
        selectPilot.innerHTML = '<option value="">-- Seleccionar piloto --</option>';
        pilotosRivales.forEach(p => {
            selectPilot.innerHTML += `<option value="${p.id}">${p.nombre} ${p.apellido || ''} (#${p.numero})</option>`;
        });
    }

    const equiposRivales = allEquipos.filter(e => e.id !== currentTeamId);
    const selectTeamUpgrade = document.getElementById("select-team-upgrade");
    if (selectTeamUpgrade) {
        selectTeamUpgrade.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
        equiposRivales.forEach(e => {
            selectTeamUpgrade.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }

    const selectTeamComponent = document.getElementById("select-team-component");
    if (selectTeamComponent) {
        selectTeamComponent.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
        equiposRivales.forEach(e => {
            selectTeamComponent.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }
}

// Limpiar event listeners anteriores mediante clonación de nodos a prueba de fallos
function setupListeners() {
    // Botones de mejoras dinámicos
    const btnAero = document.getElementById("btn-aero");
    if (btnAero) {
        const newBtnAero = btnAero.cloneNode(true);
        btnAero.parentNode.replaceChild(newBtnAero, btnAero);
        newBtnAero.addEventListener("click", () => {
            const currentLevel = currentTeamData.aeroLevel || 0;
            if (currentLevel >= MAX_LEVEL) return alert("El Chasis/Aerodinámica ya está al nivel máximo permitido.");
            solicitarMejora("Chasis y Aerodinámica", COSTOS_AERO[currentLevel], "aeroLevel", currentLevel);
        });
    }

    const btnMotor = document.getElementById("btn-motor");
    if (btnMotor) {
        const newBtnMotor = btnMotor.cloneNode(true);
        btnMotor.parentNode.replaceChild(newBtnMotor, btnMotor);
        newBtnMotor.addEventListener("click", () => {
            const currentLevel = currentTeamData.motorLevel || 0;
            if (currentLevel >= MAX_LEVEL) return alert("El Motor ya está al nivel máximo permitido.");
            solicitarMejora("Motor", COSTOS_MOTOR[currentLevel], "motorLevel", currentLevel);
        });
    }

    // Botones de investigación
    const btnRPilot = document.getElementById("btn-research-pilot");
    if (btnRPilot) {
        const newBtnRPilot = btnRPilot.cloneNode(true);
        btnRPilot.parentNode.replaceChild(newBtnRPilot, btnRPilot);
        newBtnRPilot.addEventListener("click", investigarPiloto);
    }

    const btnRUp = document.getElementById("btn-research-upgrade");
    if (btnRUp) {
        const newBtnRUp = btnRUp.cloneNode(true);
        btnRUp.parentNode.replaceChild(newBtnRUp, btnRUp);
        newBtnRUp.addEventListener("click", investigarMejora);
    }

    const btnRComp = document.getElementById("btn-research-component");
    if (btnRComp) {
        const newBtnRComp = btnRComp.cloneNode(true);
        btnRComp.parentNode.replaceChild(newBtnRComp, btnRComp);
        newBtnRComp.addEventListener("click", investigarComponente);
    }
    
    // Botón de sponsors (Si existe en el HTML)
    const btnSponsor = document.getElementById("btn-sponsors");
    if (btnSponsor) {
        const newBtnSponsor = btnSponsor.cloneNode(true);
        btnSponsor.parentNode.replaceChild(newBtnSponsor, btnSponsor);
        newBtnSponsor.addEventListener("click", openSponsorModal);
    }
    
    // Formulario de ofertas (Si existe)
    const formOferta = document.getElementById("form-oferta");
    if (formOferta) {
        const newFormOferta = formOferta.cloneNode(true);
        formOferta.parentNode.replaceChild(newFormOferta, formOferta);
        newFormOferta.addEventListener("submit", async (e) => {
            e.preventDefault();
            await enviarOferta();
        });
    }
    
    // Botón de comprar investigación extra
    const btnBuyInv = document.getElementById("btn-buy-investigation");
    if(btnBuyInv) {
        const newBtnBuyInv = btnBuyInv.cloneNode(true);
        btnBuyInv.parentNode.replaceChild(newBtnBuyInv, btnBuyInv);
        newBtnBuyInv.addEventListener("click", comprarInvestigacionExtra);
    }
}

async function solicitarMejora(tipo, costo, campoNivel, nivelActual) {
    if (currentTeamData.presupuesto < costo) {
        alert(`Presupuesto insuficiente. Se requieren $${costo.toLocaleString()} para mejorar al siguiente nivel.`);
        return;
    }

    const confirmar = confirm(`¿Invertir $${costo.toLocaleString()} en mejorar ${tipo}?`);
    if (!confirmar) return;

    try {
        const datosActualizar = {
            presupuesto: currentTeamData.presupuesto - costo
        };
        datosActualizar[campoNivel] = nivelActual + 1; // Aquí se sube el nivel directamente

        await updateDoc(doc(db, "equipos", currentTeamId), datosActualizar);

        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Mejora de Componente",
            detalle: `Ha comprado la mejora de ${tipo} al Nivel ${nivelActual + 1}. Costo: $${costo.toLocaleString()}`,
            estado: "Pendiente",
            fecha: serverTimestamp()
        });

        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "mejora",
            detalle: `Ha mejorado ${tipo} al Nivel ${nivelActual + 1}. Costo: $${costo.toLocaleString()}`,
            fecha: serverTimestamp()
        });

        alert(`¡Mejora completada! Nivel subido a ${nivelActual + 1}. La FIA ha sido notificada.`);
        await cargarDatos(); 
        
    } catch (error) {
        console.error("Error comprando mejora:", error);
        alert("Hubo un error de conexión al comprar la mejora.");
    }
}

async function investigarPiloto() {
    const puede = await tryConsumeInvestigation();
    if (!puede) {
        alert("Has alcanzado el límite de 3 investigaciones diarias gratuitas.");
        return;
    }

    const pilotoId = document.getElementById("select-pilot-research").value;
    if (!pilotoId) return alert("Selecciona un piloto");

    const piloto = allPilotos.find(p => p.id === pilotoId);
    if (!piloto) return;

    const salarioReal = piloto.salario || 0;
    let rangoSueldo = "Desconocido";
    
    if (salarioReal > 0) {
        const min = Math.round((salarioReal * 0.85) / 100000) * 100000;
        const max = Math.round((salarioReal * 1.15) / 100000) * 100000;
        rangoSueldo = `$${min.toLocaleString()} y $${max.toLocaleString()}`;
    } else {
        rangoSueldo = "Sin contrato / $0";
    }

    const edadTexto = piloto.edad ? `${piloto.edad} años` : "Desconocida";
    const moralTexto = piloto.moral || "Normal";

    try {
        // registrar solicitud y actividad normal
        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Investigación",
            detalle: `Investigar piloto: ${piloto.nombre} ${piloto.apellido || ''} - Ritmo: ${piloto.ritmo || 0}, Agresividad: ${piloto.agresividad || 0}, Moral: ${moralTexto}, Edad: ${edadTexto}`,
            estado: "Info",
            fecha: serverTimestamp()
        });

        // generamos la notificación y guardamos su id para enlazar
        const notifRef = await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema de Scouting",
            texto: `📊 Investigación completada: ${piloto.nombre} tiene ritmo ${piloto.ritmo || 0} y agresividad ${piloto.agresividad || 0}. Su edad es: ${edadTexto}.`,
            fecha: serverTimestamp()
        });

        // actividad con referencia a la notificación para poder filtrar más tarde
        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "investigacion",
            detalle: `Ha ojeado al piloto: ${piloto.nombre} ${piloto.apellido || ''}`,
            fecha: serverTimestamp(),
            notificacionId: notifRef.id
        });

        alert("Investigación completada. Revisa tu bandeja de avisos.");
        document.getElementById("select-pilot-research").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarMejora() {
    const puede = await tryConsumeInvestigation();
    if (!puede) return alert("Has alcanzado el límite de 3 investigaciones diarias gratuitas.");

    const equipoId = document.getElementById("select-team-upgrade").value;
    if (!equipoId) return alert("Selecciona un equipo");

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const ultimaMejora = equipo.ultimaMejora || "Motor";
        const notifRef = await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `⚙️ Última mejora de ${equipo.nombre}: ${ultimaMejora}`,
            fecha: serverTimestamp()
        });

        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "investigacion",
            detalle: `Investiga mejora: ${equipo.nombre} - Última mejora: ${ultimaMejora}`,
            fecha: serverTimestamp(),
            notificacionId: notifRef.id
        });

        alert("✅ Investigación completada. Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-upgrade").value = "";
    } catch (error) {
        console.error("ERROR:", error);
        alert("❌ Error en investigación: " + error.message);
    }
}

async function investigarComponente() {
    const puede = await tryConsumeInvestigation();
    if (!puede) return alert("Has alcanzado el límite de 3 investigaciones diarias gratuitas.");

    const equipoId = document.getElementById("select-team-component").value;
    const componente = document.getElementById("select-component-type").value;
    if (!equipoId) return alert("Selecciona un equipo");

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const nivelComponente = componente === "aero" ? (equipo.aeroLevel || 0) : (equipo.motorLevel || 0);
        const nombreComponente = componente === "aero" ? "Aerodinámica" : "Motor";
        
        const notifRef = await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `🔩 Nivel de ${nombreComponente} en ${equipo.nombre}: ${nivelComponente}/${MAX_LEVEL}`,
            fecha: serverTimestamp()
        });

        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "investigacion",
            detalle: `Investiga nivel de ${nombreComponente}: ${equipo.nombre} - Nivel: ${nivelComponente}/${MAX_LEVEL}`,
            fecha: serverTimestamp(),
            notificacionId: notifRef.id
        });

        alert("✅ Investigación completada. Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-component").value = "";
    } catch (error) {
        console.error("ERROR:", error);
        alert("❌ Error en investigación: " + error.message);
    }
}

async function tryConsumeInvestigation() {
    try {
        const teamRef = doc(db, "equipos", currentTeamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return true;

        const team = teamSnap.data();
        let count = team.investigacionesCount || 0;

        if (count >= 3) return false;

        await updateDoc(teamRef, { investigacionesCount: count + 1 });
        if (currentTeamData) currentTeamData.investigacionesCount = count + 1;
        return true;
    } catch (error) {
        console.error("Error consumiendo investigación:", error);
        return false;
    }
}

async function comprarInvestigacionExtra() {
    const costo = 3000000; 
    
    if (currentTeamData.presupuesto < costo) {
        alert(`Presupuesto insuficiente para comprar una investigación extra (Costo: $${costo.toLocaleString()}).`);
        return;
    }

    const teamRef = doc(db, "equipos", currentTeamId);
    const teamSnap = await getDoc(teamRef);
    const team = teamSnap.data();
    let currentCount = team.investigacionesCount || 0;

    if (currentCount === 0) {
        alert("Aún tienes todas tus investigaciones gratis disponibles. ¡Úsalas primero!");
        return;
    }

    const confirmar = confirm(`¿Gastar $${costo.toLocaleString()} de tu presupuesto para obtener 1 investigación extra hoy?`);
    if (!confirmar) return;

    try {
        let newCount = currentCount > 0 ? currentCount - 1 : 0;

        await updateDoc(teamRef, {
            presupuesto: currentTeamData.presupuesto - costo,
            investigacionesCount: newCount
        });

        alert("¡Has comprado una investigación extra con éxito! Ya puedes usarla.");
        
        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "compra_investigacion",
            detalle: `Ha comprado una investigación extra. Costo: $${costo.toLocaleString()}`,
            fecha: serverTimestamp()
        });
        
        await cargarDatos(); 
        
    } catch (error) {
        console.error("Error comprando investigación:", error);
        alert("Hubo un error al procesar la compra.");
    }
}

function escucharNotificaciones() {
    // Le quitamos el orderBy a Firebase para que no pida crear el índice
    const q = query(
        collection(db, "notificaciones"), 
        where("equipoId", "==", currentTeamId)
    );
    
    const notificationsBox = document.getElementById("notifications-box");

    onSnapshot(q, (snapshot) => {
        notificationsBox.innerHTML = "";
        
        if (snapshot.empty) {
            notificationsBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Sin notificaciones</p>';
            return;
        }

        // 1. Metemos todos los mensajes en un array
        let notificaciones = [];
        snapshot.forEach(doc => {
            notificaciones.push({ id: doc.id, ...doc.data() });
        });

        // 2. LOS ORDENAMOS AQUÍ CON JAVASCRIPT (Del más nuevo al más viejo)
        notificaciones.sort((a, b) => {
            const tiempoA = a.fecha && a.fecha.toMillis ? a.fecha.toMillis() : 0;
            const tiempoB = b.fecha && b.fecha.toMillis ? b.fecha.toMillis() : 0;
            return tiempoB - tiempoA; // De mayor (nuevo) a menor (viejo)
        });

        // 3. Ahora sí, los pintamos en la pantalla ordenados
        notificaciones.forEach(notif => {
            let fechaTexto = "";
            if (notif.fecha && notif.fecha.toDate) {
                fechaTexto = notif.fecha.toDate().toLocaleString();
            }

            const notifEl = document.createElement("div");
            notifEl.style.cssText = "padding: 12px; border-left: 3px solid var(--accent); background-color: var(--bg-tertiary); margin-bottom: 10px; border-radius: 4px;";
            
            let buttons = '';
            if (notif.tipo === "mensaje_aprobacion") {
                buttons = `
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="btn-solid" onclick="aprobarMensaje('${notif.id}', '${notif.mensajeId}')">Aprobar</button>
                        <button class="btn-outline" onclick="denegarMensaje('${notif.id}', '${notif.mensajeId}')">Denegar</button>
                    </div>
                `;
            }
            
            notifEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color: var(--accent);">${notif.remitente || 'Sistema'}:</strong>
                    <span style="color: var(--text-secondary); font-size:0.75rem;">${fechaTexto}</span>
                </div>
                <p style="margin: 0; font-size: 0.95rem;">${notif.texto}</p>
                ${buttons}
            `;
            notificationsBox.appendChild(notifEl);
        });
    }, (error) => {
        console.error("Error cargando avisos:", error);
        notificationsBox.innerHTML = '<p style="color:orange; text-align:center;">Error de conexión cargando los avisos.</p>';
    });
}


// ============== SISTEMA DE SPONSORS ==============
async function openSponsorModal() {
    const modal = document.getElementById("sponsors-modal");
    if(modal) modal.style.display = "flex";

    // si ya tenemos un contrato guardado, mostramos directamente la sección de contrato
    if (currentTeamData && currentTeamData.sponsor_contract) {
        mostrarSeccionContrato(currentTeamData.sponsor_contract);
    } else {
        mostrarSeccionOpcion();
    }
}

function mostrarSeccionOpcion() {
    document.getElementById("sponsors-choice-section").style.display = "flex";
    document.getElementById("sponsors-expectations-section").style.display = "none";
    document.getElementById("sponsors-contract-section").style.display = "none";
}

function mostrarSeccionExpectativas() {
    document.getElementById("sponsors-choice-section").style.display = "none";
    document.getElementById("sponsors-expectations-section").style.display = "block";
    document.getElementById("sponsors-contract-section").style.display = "none";
    if(window.updatePositionDisplay) window.updatePositionDisplay(5);
}

function mostrarSeccionContrato(contract) {
    document.getElementById("sponsors-choice-section").style.display = "none";
    document.getElementById("sponsors-expectations-section").style.display = "none";
    document.getElementById("sponsors-contract-section").style.display = "block";

    const contractDisplay = document.getElementById("sponsors-contract-section");
    const tipoTexto = contract.type === "fixed" ? "Dinero Garantizado" : "Dinero + Bonus por Carrera";

    contractDisplay.innerHTML = `
        <h3 style="margin-top: 0; color: var(--accent);">✅ Contrato Activo</h3>
        <div style="background-color: var(--bg-tertiary); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0;"><strong>Tipo:</strong> ${tipoTexto}</p>
            ${contract.type === "performance" ? `
                <p style="margin: 0 0 10px 0;"><strong>Base Garantizada:</strong> $${contract.base.toLocaleString()}</p>
                <p style="margin: 0 0 10px 0;"><strong>Objetivo de Posición:</strong> Posición ${contract.targetPosition}</p>
                <p style="margin: 0 0 10px 0;"><strong>Bonus por Carrera (Max):</strong> $${(contract.perRaceBonus || 0).toLocaleString()} <span style="font-size: 0.8em; color: var(--text-secondary);">(${contract.racesProcessed || 0}/${TOTAL_CARRERAS} carreras)</span></p>
                <p style="margin: 0 0 10px 0;"><strong>Total Máximo:</strong> $${contract.max.toLocaleString()}</p>
            ` : `
                <p style="margin: 0 0 10px 0;"><strong>Total Garantizado:</strong> $${contract.guaranteed.toLocaleString()}</p>
            `}
        </div>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">El bonus se evalúa tras cada Gran Premio.</p>
    `;
}

window.selectSponsorOption = function(type) {
    if (type === "fixed") saveFixedContract();
    else if (type === "performance") mostrarSeccionExpectativas();
};

async function saveFixedContract() {
    // contrato fijo: recibes cantidad garantizada inmediatamente
    const amount = 45000000;
    const contract = {
        type: "fixed",
        guaranteed: amount,
        savedAt: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, "equipos", currentTeamId), {
            sponsor_contract: contract,
            sponsor_contract_unlocked: false,
            presupuesto: (currentTeamData.presupuesto || 0) + amount
        });

        const notifRef = await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `💎 Contrato de patrocinio fijo firmado. Recibiste $${amount.toLocaleString()}.`,
            fecha: serverTimestamp()
        });

        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "contrato_sponsor",
            detalle: `Firma contrato fijo con garantía de $${amount.toLocaleString()}`,
            fecha: serverTimestamp(),
            notificacionId: notifRef.id
        });

        // actualizar datos locales y refrescar UI
        currentTeamData.sponsor_contract = contract;
        currentTeamData.presupuesto = (currentTeamData.presupuesto || 0) + amount;

        mostrarSeccionContrato(contract);
        alert("Contrato guardado correctamente.");
        await cargarDatos();
    } catch (error) {
        console.error("Error guardando contrato fijo:", error);
        alert("No se pudo guardar el contrato de patrocinio. Reintenta más tarde.");
    }
}

const sponsorBudgetTable = {
    1: 55000000, 2: 53000000, 3: 51000000, 4: 50000000, 5: 48000000,
    6: 46000000, 7: 44000000, 8: 42000000, 9: 40000000, 10: 40000000
};

window.updatePositionDisplay = function(value) {
    const slider = document.getElementById("position-slider");
    if(slider) slider.value = value;

    const targetPosition = parseInt(value);
    const maxTotal = sponsorBudgetTable[targetPosition];
    const initialPayment = Math.round(maxTotal * 0.5);
    const maxBonus = maxTotal - initialPayment;

    const positionText = targetPosition === 1 ? "1º" : (targetPosition === 2 ? "2º" : (targetPosition === 3 ? "3º" : targetPosition + "º"));
    document.getElementById("expected-position").textContent = positionText;
    document.getElementById("estimated-base").textContent = `$${initialPayment.toLocaleString()}`;
    document.getElementById("estimated-bonus").textContent = `+$${maxBonus.toLocaleString()}`;
    document.getElementById("estimated-total").textContent = `$${maxTotal.toLocaleString()}`;
};

window.confirmSponsorExpectations = function() {
    const targetPosition = parseInt(document.getElementById("position-slider").value);
    const maxTotal = sponsorBudgetTable[targetPosition];
    const initialPayment = Math.round(maxTotal * 0.5);
    const maxBonus = maxTotal - initialPayment;
    const perRaceBonus = Math.floor(maxBonus / TOTAL_CARRERAS); 

    const contract = {
        type: "performance",
        base: initialPayment,
        bonus: maxBonus,
        perRaceBonus: perRaceBonus,
        max: maxTotal,
        targetPosition: targetPosition,
        racesProcessed: 0,
        savedAt: serverTimestamp()
    };

    savePerformanceContract(contract);
};

async function savePerformanceContract(contract) {
    try {
        // añadimos el contrato y damos el dinero base inmediato
        await updateDoc(doc(db, "equipos", currentTeamId), {
            sponsor_contract: contract,
            sponsor_contract_unlocked: false,
            presupuesto: (currentTeamData.presupuesto || 0) + (contract.base || 0)
        });

        const notifRef = await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `💎 Contrato de patrocinio por rendimiento firmado. Base: $${(contract.base || 0).toLocaleString()}, objetivo: posición ${contract.targetPosition}.`,
            fecha: serverTimestamp()
        });

        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "contrato_sponsor",
            detalle: `Firma contrato por rendimiento con base de $${(contract.base || 0).toLocaleString()} y objetivo top ${contract.targetPosition}`,
            fecha: serverTimestamp(),
            notificacionId: notifRef.id
        });

        currentTeamData.sponsor_contract = contract;
        currentTeamData.presupuesto = (currentTeamData.presupuesto || 0) + (contract.base || 0);

        mostrarSeccionContrato(contract);
        alert("Contrato guardado correctamente.");
        await cargarDatos();
        await cargarDatos();
    } catch (error) {
        console.error("Error guardando contrato por rendimiento:", error);
        alert("No se pudo guardar el contrato por rendimiento. Reintenta más tarde.");
    }
}

window.cancelSponsorOption = function() { mostrarSeccionOpcion(); };
window.closeSponsorModal = function() { 
    const modal = document.getElementById("sponsors-modal");
    if(modal) modal.style.display = "none"; 
};

document.addEventListener("click", function(event) {
    const modal = document.getElementById("sponsors-modal");
    if (modal && event.target === modal) {
        modal.style.display = "none";
    }
});

// ============== FUNCIONES DE PILOTOS ==============

window.negociarSalario = async function(pilotoId) {
    const piloto = allPilotos.find(p => p.id === pilotoId);
    if (!piloto) return;
    
    const moralEmoji = piloto.moral === "Alta" ? "😊" : (piloto.moral === "Baja" ? "😔" : "😐");
    const salarioActual = piloto.salario || 0;
    
    const nuevoSalario = prompt(
        `${moralEmoji} Renegociación de Salario\n\n` +
        `Piloto: ${piloto.nombre} ${piloto.apellido || ""}\n` +
        `Salario actual: $${salarioActual.toLocaleString()} por carrera\n\n` +
        `Presupuesto disponible: $${currentTeamData.presupuesto.toLocaleString()}\n\n` +
        `Ingresa el nuevo salario por carrera (números solo):`,
        salarioActual.toString()
    );
    
    if (nuevoSalario === null) return; 
    
    const salarioNumerico = parseInt(nuevoSalario);
    if (isNaN(salarioNumerico) || salarioNumerico < 0) return alert("❌ Ingresa un número válido");
    
    const diferencia = salarioNumerico - salarioActual;
    
    if (diferencia > 0 && currentTeamData.presupuesto < diferencia) {
        return alert("❌ Presupuesto insuficiente para esta renegociación");
    }
    
    try {
        await updateDoc(doc(db, "pilotos", pilotoId), { salario: salarioNumerico });
        
        if (diferencia > 0) {
            await updateDoc(doc(db, "equipos", currentTeamId), {
                presupuesto: currentTeamData.presupuesto - diferencia
            });
        }
        
        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "nego_salario",
            detalle: `Renegocia salario de ${piloto.nombre}: de $${salarioActual.toLocaleString()} a $${salarioNumerico.toLocaleString()} (Cambio: $${(diferencia > 0 ? '+' : '')}${diferencia.toLocaleString()})`,
            fecha: serverTimestamp()
        });
        
        alert(`✅ Salario actualizado a $${salarioNumerico.toLocaleString()} por carrera`);
        cargarDatos();
    } catch (error) {
        console.error("Error actualizando salario:", error);
        alert("❌ Error al actualizar el salario");
    }
};

window.verDetalles = function(pilotoId) {
    const piloto = allPilotos.find(p => p.id === pilotoId);
    if (!piloto) return;
    
    const moralEmoji = piloto.moral === "Alta" ? "😊" : (piloto.moral === "Baja" ? "😔" : "😐");
    const salario = piloto.salario || 0;
    
    alert(`📋 DETALLES DEL PILOTO\n\n` +
        `Nombre: ${piloto.nombre} ${piloto.apellido || ""}\n` +
        `Dorsal: #${piloto.numero}\n` +
        `País: ${piloto.pais}\n` +
        `Edad: ${piloto.edad || '?'} años\n\n` +
        `Desempeño:\n` +
        `• Ritmo: ${piloto.ritmo || 0}/100\n` +
        `• Agresividad: ${piloto.agresividad || 0}/100\n` +
        `• Moral: ${moralEmoji} ${piloto.moral || "Normal"}\n\n` +
        `💼 Salario: $${salario.toLocaleString()} por carrera\n\n` +
        `🏁 Carreras disputadas: 0\n` +
        `🥇 Victorias: 0\n` +
        `📊 Puntos: 0`);
};

// ==========================================
// MERCADO DE PILOTOS Y OFERTAS
// ==========================================
window.abrirModalSeleccionarPiloto = function() {
    const pilotosRivales = allPilotos.filter(p => p.equipoId !== currentTeamId);
    if (pilotosRivales.length === 0) return alert("No hay pilotos rivales disponibles");
    
    const selectPiloto = document.getElementById("oferta-piloto-select");
    if(selectPiloto) {
        selectPiloto.innerHTML = '<option value="">-- Selecciona un piloto --</option>';
        pilotosRivales.forEach(piloto => {
            const equipo = allEquipos.find(e => e.id === piloto.equipoId);
            const texto = `#${piloto.numero} ${piloto.nombre} ${piloto.apellido || ''} (${equipo?.nombre || 'Equipo'})`;
            selectPiloto.innerHTML += `<option value="${piloto.id}">${texto}</option>`;
        });
    }
    
    document.getElementById("modal-oferta").style.display = "flex";
    if(document.getElementById("form-oferta")) document.getElementById("form-oferta").reset();
    if(document.getElementById("oferta-piloto-info")) document.getElementById("oferta-piloto-info").style.display = "none";
};

window.cerrarModalOferta = function() {
    if(document.getElementById("modal-oferta")) document.getElementById("modal-oferta").style.display = "none";
};

async function enviarOferta() {
    const pilotoId = document.getElementById("oferta-piloto-select").value;
    if (!pilotoId) return alert("❌ Selecciona un piloto primero");
    
    const compensacion = parseInt(document.getElementById("oferta-compensacion").value);
    const sueldo = parseInt(document.getElementById("oferta-sueldo").value);
    const mensaje = document.getElementById("oferta-mensaje").value || "Oferta de fichaje";
    
    const piloto = allPilotos.find(p => p.id === pilotoId);
    const equipoOrigen = allEquipos.find(e => e.id === currentTeamId);
    const equipoDestino = allEquipos.find(e => e.id === piloto.equipoId);
    
    const costoTotal = (compensacion * 1000000) + sueldo;
    if ((equipoOrigen.presupuesto || 0) < costoTotal) {
        return alert("❌ No tienes presupuesto suficiente para esta oferta.");
    }
    
    try {
        const ofertaId = await addDoc(collection(db, "ofertas"), {
            equipoOrigenId: currentTeamId,
            equipoDestinoId: piloto.equipoId,
            pilotoId: pilotoId,
            pilotoDestinoId: pilotoId,
            compensacion: compensacion,
            sueldo: sueldo,
            mensaje: mensaje,
            estado: "Pendiente",
            fecha: serverTimestamp()
        });
        
        await addDoc(collection(db, "actividad_equipos"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "oferta_fichaje",
            detalle: `Envía oferta de fichaje a #${piloto.numero} ${piloto.nombre} (${equipoDestino?.nombre}). Compensación: $${compensacion}M, Sueldo: $${sueldo.toLocaleString()}`,
            fecha: serverTimestamp()
        });
        
        await addDoc(collection(db, "notificaciones"), {
            equipoId: "admin",
            remitente: equipoOrigen.nombre,
            texto: `📞 OFERTA DE FICHAJE: ${equipoOrigen.nombre} quiere fichar a #${piloto.numero} ${piloto.nombre} de ${equipoDestino?.nombre}. Compensación: $${compensacion}M, Sueldo: $${sueldo.toLocaleString()}`,
            tipo: "oferta_piloto",
            ofertaId: ofertaId.id,
            fecha: serverTimestamp()
        });
        
        alert("✓ Oferta enviada correctamente. El admin será notificado.");
        cerrarModalOferta();
        
    } catch (error) {
        console.error("Error enviando oferta:", error);
        alert("❌ Error al enviar la oferta");
    }
}

async function aprobarMensaje(notifId, mensajeId) {
    try {
        await addDoc(collection(db, "respuestas_mensajes"), {
            mensajeId: mensajeId,
            equipoId: currentTeamId,
            estado: "aprobado",
            fecha: serverTimestamp()
        });
        await deleteDoc(doc(db, "notificaciones", notifId));
        alert("Mensaje aprobado.");
    } catch (error) {
        console.error("Error aprobando mensaje:", error);
        alert("Error al aprobar el mensaje.");
    }
}

async function denegarMensaje(notifId, mensajeId) {
    try {
        await addDoc(collection(db, "respuestas_mensajes"), {
            mensajeId: mensajeId,
            equipoId: currentTeamId,
            estado: "denegado",
            fecha: serverTimestamp()
        });
        await deleteDoc(doc(db, "notificaciones", notifId));
        alert("Mensaje denegado.");
    } catch (error) {
        console.error("Error denegando mensaje:", error);
        alert("Error al denegar el mensaje.");
    }
}

window.aprobarMensaje = aprobarMensaje;
window.denegarMensaje = denegarMensaje;
