// Dashboard.js - NUEVO Dashboard completamente rediseñado y funcional
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, doc, getDoc, collection, query, where, getDocs, 
    updateDoc, addDoc, serverTimestamp, onSnapshot
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
    }

    // Pilotos
    const pilotosMiEquipo = allPilotos.filter(p => p.equipoId === currentTeamId);
    const driversContainer = document.getElementById("drivers-container");
    driversContainer.innerHTML = "";

    pilotosMiEquipo.forEach(piloto => {
        const card = document.createElement("div");
        card.className = "driver-card-modern";
        
        // Génerar barra de desempeño visual
        const ritmoWidth = (piloto.ritmo || 0);
        const agresividadWidth = (piloto.agresividad || 0);
        
        // Código de moral con emoji
        const moralEmoji = piloto.moral === "Alta" ? "😊" : (piloto.moral === "Baja" ? "😔" : "😐");
        const moralColor = piloto.moral === "Alta" ? "#4CAF50" : (piloto.moral === "Baja" ? "#f44336" : "#8888aa");
        
        card.innerHTML = `
            <div class="driver-header-modern" style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div class="driver-photo-modern" style="flex-shrink: 0;">
                    ${piloto.foto ? `<img src="${piloto.foto}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 2px solid ${currentTeamData.color};">` : '<div style="width: 80px; height: 80px; background: var(--bg-tertiary); border-radius: 8px; display: flex; align-items: center; justify-content: center;">👤</div>'}
                </div>
                <div style="flex: 1;">
                    <p class="driver-name-modern" style="margin: 0 0 4px 0; font-size: 1.2rem; font-weight: bold;">#${piloto.numero} ${piloto.nombre} <span style="color: ${currentTeamData.color}; font-weight: 600;">${piloto.apellido || ''}</span></p>
                    <p class="driver-number-modern" style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">${piloto.pais} • ${piloto.edad} años</p>
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


    // Niveles de mejoras
    const aeroLevel = currentTeamData.aeroLevel || 0;
    const motorLevel = currentTeamData.motorLevel || 0;
    document.getElementById("aero-level").textContent = aeroLevel;
    document.getElementById("motor-level").textContent = motorLevel;
    document.getElementById("aero-progress").style.width = (aeroLevel * 20) + "%";
    document.getElementById("motor-progress").style.width = (motorLevel * 20) + "%";

    // Poblar selectores de investigación
    poblarSelectores();
}

function poblarSelectores() {
    // Pilotos rivales
    const pilotosRivales = allPilotos.filter(p => p.equipoId !== currentTeamId);
    const selectPilot = document.getElementById("select-pilot-research");
    selectPilot.innerHTML = '<option value="">-- Seleccionar piloto --</option>';
    pilotosRivales.forEach(p => {
        selectPilot.innerHTML += `<option value="${p.id}">${p.nombre} ${p.apellido || ''} (#${p.numero})</option>`;
    });

    // Equipos rivales para mejoras
    const equiposRivales = allEquipos.filter(e => e.id !== currentTeamId);
    const selectTeamUpgrade = document.getElementById("select-team-upgrade");
    selectTeamUpgrade.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
    equiposRivales.forEach(e => {
        selectTeamUpgrade.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    // Equipos rivales para componentes
    const selectTeamComponent = document.getElementById("select-team-component");
    selectTeamComponent.innerHTML = '<option value="">-- Seleccionar equipo --</option>';
    equiposRivales.forEach(e => {
        selectTeamComponent.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
}

function setupListeners() {
    // Botones de mejoras
    document.getElementById("btn-aero").addEventListener("click", () => solicitarMejora("aerodinámica", 5000000));
    document.getElementById("btn-motor").addEventListener("click", () => solicitarMejora("motor", 7500000));

    // Botones de investigación
    document.getElementById("btn-research-pilot").addEventListener("click", investigarPiloto);
    document.getElementById("btn-research-upgrade").addEventListener("click", investigarMejora);
    document.getElementById("btn-research-component").addEventListener("click", investigarComponente);
    
    // Botón de sponsors
    document.getElementById("btn-sponsors").addEventListener("click", openSponsorModal);
    
    // --> AÑADE ESTA LÍNEA AQUÍ:
    document.getElementById("btn-buy-investigation").addEventListener("click", comprarInvestigacionExtra);
}

async function solicitarMejora(tipo, costo) {
    if (currentTeamData.presupuesto < costo) {
        alert("Presupuesto insuficiente");
        return;
    }

    const confirmar = confirm(`¿Invertir $${costo.toLocaleString()} en mejorar ${tipo}?`);
    if (!confirmar) return;

    try {
        // Restar presupuesto
        await updateDoc(doc(db, "equipos", currentTeamId), {
            presupuesto: currentTeamData.presupuesto - costo
        });

        // Crear solicitud al admin
        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Mejora de Componente",
            detalle: `Solicita mejora de ${tipo}. Costo: $${costo.toLocaleString()}`,
            estado: "Pendiente",
            fecha: serverTimestamp()
        });

        alert("Mejora solicitada al Admin. Te notificaremos del resultado.");
        cargarDatos();
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarPiloto() {
    // Verificar límite de investigaciones usando contador persistente en el documento del equipo
    const puede = await tryConsumeInvestigation();
    if (!puede) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const pilotoId = document.getElementById("select-pilot-research").value;
    if (!pilotoId) {
        alert("Selecciona un piloto");
        return;
    }

    const piloto = allPilotos.find(p => p.id === pilotoId);
    if (!piloto) return;

    try {
        await addDoc(collection(db, "solicitudes_admin"), {
            equipoId: currentTeamId,
            nombreEquipo: currentTeamData.nombre,
            tipo: "Investigación",
            detalle: `Investigar piloto: ${piloto.nombre} ${piloto.apellido || ''} - Ritmo: ${piloto.ritmo || 0}, Agresividad: ${piloto.agresividad || 0}`,
            estado: "Info",
            fecha: serverTimestamp()
        });

        // Enviar notificación directa
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `📊 Investigación completada: ${piloto.nombre} tiene ritmo ${piloto.ritmo || 0} y agresividad ${piloto.agresividad || 0}.`,
            fecha: serverTimestamp()
        });

        alert("Investigación completada. Revisa tu bandeja de avisos.");
        document.getElementById("select-pilot-research").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarMejora() {
    // Verificar límite de investigaciones usando contador persistente en el documento del equipo
    const puede = await tryConsumeInvestigation();
    if (!puede) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const equipoId = document.getElementById("select-team-upgrade").value;
    if (!equipoId) {
        alert("Selecciona un equipo");
        return;
    }

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const ultimaMejora = equipo.ultimaMejora || "Motor";
        
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `⚙️ Última mejora de ${equipo.nombre}: ${ultimaMejora}`,
            fecha: serverTimestamp()
        });

        alert("Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-upgrade").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function investigarComponente() {
    // Verificar límite de investigaciones usando contador persistente en el documento del equipo
    const puede = await tryConsumeInvestigation();
    if (!puede) {
        alert("Has alcanzado el límite de 3 investigaciones hoy. Intenta mañana.");
        return;
    }

    const equipoId = document.getElementById("select-team-component").value;
    const componente = document.getElementById("select-component-type").value;

    if (!equipoId) {
        alert("Selecciona un equipo");
        return;
    }

    const equipo = allEquipos.find(e => e.id === equipoId);
    if (!equipo) return;

    try {
        const nivelComponente = componente === "aero" ? (equipo.aeroLevel || 0) : (equipo.motorLevel || 0);
        const nombreComponente = componente === "aero" ? "Aerodinámica" : "Motor";
        
        await addDoc(collection(db, "notificaciones"), {
            equipoId: currentTeamId,
            remitente: "Sistema",
            texto: `🔩 Nivel de ${nombreComponente} en ${equipo.nombre}: ${nivelComponente}/5`,
            fecha: serverTimestamp()
        });

        alert("Información enviada a tu bandeja de avisos.");
        document.getElementById("select-team-component").value = "";
    } catch (error) {
        console.error("Error:", error);
    }
}

async function contarInvestigacionesHoy() {
    try {
        const ahora = new Date();
        const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

        const q = query(
            collection(db, "solicitudes_admin"),
            where("equipoId", "==", currentTeamId),
            where("tipo", "==", "Investigación"),
            where("fecha", ">=", hace24h)
        );

        const snap = await getDocs(q);
        return snap.size;
    } catch (error) {
        console.error("Error contando investigaciones:", error);
        return 0;
    }
}

// Persistente: intenta consumir 1 investigación del contador del equipo (resetea a diario)
async function tryConsumeInvestigation() {
    try {
        const teamRef = doc(db, "equipos", currentTeamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return true; // no hay equipo, permitir (fall-back)

        const team = teamSnap.data();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let count = team.investigacionesCount || 0;
        const resetTs = team.investigacionesReset ? (team.investigacionesReset.toDate ? team.investigacionesReset.toDate() : new Date(team.investigacionesReset)) : null;

        // Si no hay marca de reset o es anterior al inicio del día, reiniciamos el contador
        if (!resetTs || resetTs < todayStart) {
            count = 0;
            await updateDoc(teamRef, { investigacionesCount: 0, investigacionesReset: serverTimestamp() });
        }

        if (count >= 3) return false;

        await updateDoc(teamRef, { investigacionesCount: count + 1, investigacionesReset: serverTimestamp() });
        // Actualizar caché local si existe
        if (currentTeamData) currentTeamData.investigacionesCount = count + 1;
        return true;
    } catch (error) {
        console.error("Error consumiendo investigación:", error);
        return false;
    }
}

async function comprarInvestigacionExtra() {
    const costo = 1000000; // Precio de la investigación extra (1 Millón)
    
    // 1. Comprobar si hay dinero
    if (currentTeamData.presupuesto < costo) {
        alert("Presupuesto insuficiente para comprar una investigación extra.");
        return;
    }

    // 2. Comprobar si ya tiene el contador a tope (no tendría sentido que compre si aún no ha gastado las gratis)
    const teamRef = doc(db, "equipos", currentTeamId);
    const teamSnap = await getDoc(teamRef);
    const team = teamSnap.data();
    let currentCount = team.investigacionesCount || 0;

    if (currentCount === 0) {
        alert("Aún tienes todas tus investigaciones gratis disponibles hoy. ¡Úsalas primero!");
        return;
    }

    const confirmar = confirm(`¿Gastar $${costo.toLocaleString()} de tu presupuesto para obtener 1 investigación extra hoy?`);
    if (!confirmar) return;

    try {
        // 3. Restamos 1 al contador (sin dejar que baje de 0) para habilitar un hueco libre
        let newCount = currentCount > 0 ? currentCount - 1 : 0;

        // 4. Actualizamos la base de datos (dinero y contador)
        await updateDoc(teamRef, {
            presupuesto: currentTeamData.presupuesto - costo,
            investigacionesCount: newCount
        });

        alert("¡Has comprado una investigación extra con éxito! Ya puedes usarla.");
        
        // 5. Recargamos los datos para que el presupuesto se actualice visualmente en la pantalla
        await cargarDatos(); 
        
    } catch (error) {
        console.error("Error comprando investigación:", error);
        alert("Hubo un error al procesar la compra.");
    }
}

function escucharNotificaciones() {
    const q = query(collection(db, "notificaciones"), where("equipoId", "==", currentTeamId));
    const notificationsBox = document.getElementById("notifications-box");

    onSnapshot(q, (snapshot) => {
        notificationsBox.innerHTML = "";
        if (snapshot.empty) {
            notificationsBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Sin notificaciones</p>';
            return;
        }

        snapshot.forEach(doc => {
            const notif = doc.data();
            const notifEl = document.createElement("div");
            notifEl.style.cssText = "padding: 12px; border-left: 3px solid var(--accent); background-color: var(--bg-tertiary); margin-bottom: 10px; border-radius: 4px;";
            notifEl.innerHTML = `
                <strong style="color: var(--accent);">${notif.remitente || 'Sistema'}:</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.95rem;">${notif.texto}</p>
            `;
            notificationsBox.appendChild(notifEl);
        });
    });
}

// ============== SISTEMA DE SPONSORS ==============

async function openSponsorModal() {
    const modal = document.getElementById("sponsors-modal");
    modal.style.display = "flex";

    try {
        const teamRef = doc(db, "equipos", currentTeamId);
        const teamSnap = await getDoc(teamRef);
        const team = teamSnap.data() || {};

        const contract = team.sponsor_contract;
        const isUnlocked = team.sponsor_contract_unlocked || false;

        // Si no hay contrato o está desbloqueado, mostrar opciones
        if (!contract || isUnlocked) {
            mostrarSeccionOpcion();
            // Limpiar flag de desbloqueo si está activo
            if (isUnlocked && contract) {
                await updateDoc(teamRef, {
                    sponsor_contract_unlocked: false
                });
            }
        } else {
            // Mostrar contrato existente bloqueado
            mostrarSeccionContrato(contract);
        }
    } catch (error) {
        console.error("Error al abrir modal de sponsors:", error);
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
    updatePositionDisplay(5);
}

function mostrarSeccionContrato(contract) {
    document.getElementById("sponsors-choice-section").style.display = "none";
    document.getElementById("sponsors-expectations-section").style.display = "none";
    document.getElementById("sponsors-contract-section").style.display = "block";

    const contractDisplay = document.getElementById("sponsors-contract-section");
    const tipoTexto = contract.type === "fixed" ? "Dinero Garantizado" : "Dinero + Bonus";
    const totalTexto = contract.type === "fixed" 
        ? `$${contract.guaranteed.toLocaleString()}` 
        : `$${contract.base.toLocaleString()} - $${contract.max.toLocaleString()}`;

    contractDisplay.innerHTML = `
        <h3 style="margin-top: 0; color: var(--accent);">✅ Contrato Activo</h3>
        <div style="background-color: var(--bg-tertiary); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0;"><strong>Tipo:</strong> ${tipoTexto}</p>
            ${contract.type === "performance" ? `
                <p style="margin: 0 0 10px 0;"><strong>Base Garantizada:</strong> $${contract.base.toLocaleString()}</p>
                <p style="margin: 0 0 10px 0;"><strong>Bonus Máximo:</strong> $${contract.bonus.toLocaleString()}</p>
                <p style="margin: 0 0 10px 0;"><strong>Objetivo de Posición:</strong> Posición ${contract.targetPosition}</p>
                <p style="margin: 0 0 10px 0;"><strong>Total Máximo:</strong> $${contract.max.toLocaleString()}</p>
            ` : `
                <p style="margin: 0 0 10px 0;"><strong>Total Garantizado:</strong> $${contract.guaranteed.toLocaleString()}</p>
            `}
        </div>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">El bonus se calcula al final de la temporada según tu desempeño.</p>
    `;
}

window.selectSponsorOption = function(type) {
    if (type === "fixed") {
        // Contrato fijo de $45M
        saveFixedContract();
    } else if (type === "performance") {
        // Mostrar selector de posición
        mostrarSeccionExpectativas();
    }
};

async function saveFixedContract() {
    try {
        const contract = {
            type: "fixed",
            guaranteed: 45000000,
            savedAt: serverTimestamp()
        };

        await updateDoc(doc(db, "equipos", currentTeamId), {
            sponsor_contract: contract,
            presupuesto: currentTeamData.presupuesto + 45000000
        });

        currentTeamData.sponsor_contract = contract;
        currentTeamData.presupuesto += 45000000;
        mostrarSeccionContrato(contract);
        
        // Actualizar UI
        document.getElementById("team-budget").textContent = `$${currentTeamData.presupuesto.toLocaleString()}`;
    } catch (error) {
        console.error("Error al guardar contrato fijo:", error);
        alert("Error al guardar el contrato");
    }
}

// Tabla de presupuestos por posición objetivo
const sponsorBudgetTable = {
    1: 55000000,
    2: 53000000,
    3: 51000000,
    4: 50000000,
    5: 48000000,
    6: 46000000,
    7: 44000000,
    8: 42000000,
    9: 40000000,
    10: 40000000
};

window.updatePositionDisplay = function(value) {
    const slider = document.getElementById("position-slider");
    slider.value = value;

    const targetPosition = parseInt(value);
    const maxTotal = sponsorBudgetTable[targetPosition];
    const initialPayment = Math.round(maxTotal * 0.5);
    const maxBonus = maxTotal - initialPayment;

    // Actualizar display
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

    const contract = {
        type: "performance",
        base: initialPayment,
        bonus: maxBonus,
        max: maxTotal,
        targetPosition: targetPosition,
        savedAt: serverTimestamp()
    };

    savePerformanceContract(contract);
};

async function savePerformanceContract(contract) {
    try {
        await updateDoc(doc(db, "equipos", currentTeamId), {
            sponsor_contract: contract,
            presupuesto: currentTeamData.presupuesto + contract.base
        });

        currentTeamData.sponsor_contract = contract;
        currentTeamData.presupuesto += contract.base;
        mostrarSeccionContrato(contract);

        // Actualizar UI
        document.getElementById("team-budget").textContent = `$${currentTeamData.presupuesto.toLocaleString()}`;
    } catch (error) {
        console.error("Error al guardar contrato performance:", error);
        alert("Error al guardar el contrato");
    }
}

window.cancelSponsorOption = function() {
    mostrarSeccionOpcion();
};

window.closeSponsorModal = function() {
    document.getElementById("sponsors-modal").style.display = "none";
};

// Cerrar modal al hacer click fuera
document.addEventListener("click", function(event) {
    const modal = document.getElementById("sponsors-modal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

// Función para calcular el porcentaje de bonus según la diferencia de posiciones
function calculateBonusPercentage(finalPosition, targetPosition) {
    const difference = finalPosition - targetPosition;
    
    if (difference <= 0) {
        // Mejor o en la posición objetivo
        return 100;
    } else if (difference === 1) {
        // -1 puesto
        return 100;
    } else if (difference === 2) {
        // -2 puestos
        return 75;
    } else if (difference >= 3 && difference < 5) {
        // -3 a -4 puestos
        return 55;
    } else if (difference >= 5) {
        // -5 o más puestos
        return 40;
    }
    return 40; // Fallback
}

// Función para procesar al final de temporada (llamada por admin)
window.processSeasonSponsorBonus = async function(teamId, finalTeamPosition) {
    try {
        const teamRef = doc(db, "equipos", teamId);
        const teamSnap = await getDoc(teamRef);
        
        if (!teamSnap.exists()) return false;
        
        const team = teamSnap.data();
        const contract = team.sponsor_contract;
        
        if (!contract || contract.type !== "performance") {
            return false; // Solo procesa performance contracts
        }
        
        const bonusPercentage = calculateBonusPercentage(finalTeamPosition, contract.targetPosition);
        const bonusAmount = Math.floor((contract.bonus * bonusPercentage) / 100);
        const totalAmount = contract.base + bonusAmount;
        
        // Guardar resultado del bonus
        await updateDoc(teamRef, {
            sponsor_bonus_processed: {
                targetPosition: contract.targetPosition,
                finalPosition: finalTeamPosition,
                bonusPercentage: bonusPercentage,
                bonusAmount: bonusAmount,
                totalAmount: totalAmount,
                processedAt: serverTimestamp()
            }
        });
        
        return { bonusPercentage, bonusAmount, totalAmount };
    } catch (error) {
        console.error("Error procesando bonus:", error);
        return false;
    }
};

// Función para desbloquear contratos (llamada por admin)
window.unlockSponsorContracts = async function(teamId) {
    try {
        const teamRef = doc(db, "equipos", teamId);
        await updateDoc(teamRef, {
            sponsor_contract_unlocked: true
        });
        return true;
    } catch (error) {
        console.error("Error desbloqueando contratos:", error);
        return false;
    }
};

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
    
    if (nuevoSalario === null) return; // Usuario canceló
    
    const salarioNumerico = parseInt(nuevoSalario);
    if (isNaN(salarioNumerico) || salarioNumerico < 0) {
        alert("❌ Ingresa un número válido");
        return;
    }
    
    const diferencia = salarioNumerico - salarioActual;
    
    if (diferencia > 0 && currentTeamData.presupuesto < diferencia) {
        alert("❌ Presupuesto insuficiente para esta renegociación");
        return;
    }
    
    try {
        // Actualizar salario del piloto
        await updateDoc(doc(db, "pilotos", pilotoId), {
            salario: salarioNumerico
        });
        
        // Si hay diferencia positiva, restar del presupuesto
        if (diferencia > 0) {
            await updateDoc(doc(db, "equipos", currentTeamId), {
                presupuesto: currentTeamData.presupuesto - diferencia
            });
        }
        
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
        `Edad: ${piloto.edad} años\n\n` +
        `Desempeño:\n` +
        `• Ritmo: ${piloto.ritmo || 0}/100\n` +
        `• Agresividad: ${piloto.agresividad || 0}/100\n` +
        `• Moral: ${moralEmoji} ${piloto.moral || "Normal"}\n\n` +
        `💼 Salario: $${salario.toLocaleString()} por carrera\n\n` +
        `🏁 Carreras disputadas: 0\n` +
        `🥇 Victorias: 0\n` +
        `📊 Puntos: 0`);
    // TODO: Mostrar data real de carreras, victorias y puntos
};
