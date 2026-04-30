// mercado.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

let currentTeamId = null;
let currentTeamData = null;

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (userSnap.exists() && userSnap.data().equipo) {
                currentTeamId = userSnap.data().equipo;
                await cargarMiPresupuesto();
            }
        }
        escucharMercado(); // Cargamos el mercado incluso si no está logueado para que lo vean (pero no podrán pujar)
    });
});

async function cargarMiPresupuesto() {
    if (!currentTeamId) return;
    const teamSnap = await getDoc(doc(db, "equipos", currentTeamId));
    if (teamSnap.exists()) {
        currentTeamData = teamSnap.data();
        document.getElementById("mi-presupuesto").textContent = `$${(currentTeamData.presupuesto || 0).toLocaleString()}`;
    }
}

function escucharMercado() {
    const grid = document.getElementById("mercado-grid");
    
    onSnapshot(collection(db, "mercado_agentes"), (snapshot) => {
        grid.innerHTML = "";
        
        if (snapshot.empty) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; background: var(--bg-tertiary); border-radius: 12px;">
                <h2 style="color: var(--text-secondary);">Mercado Cerrado</h2>
                <p>No hay agentes disponibles en este momento. El Admin abrirá el mercado pronto.</p>
            </div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const agente = docSnap.data();
            const id = docSnap.id;
            
            // Iconos y colores según tipo
            let icono = "👤"; let color = "#4CAF50"; // Piloto
            if (agente.tipo === "junior") { icono = "🎓"; color = "#2196F3"; }
            if (agente.tipo === "ingeniero") { icono = "👨‍🔧"; color = "#FF9800"; }

            // Lógica de quién va ganando
            const yoVoyGanando = currentTeamId && agente.mejorPostorId === currentTeamId;
            const pujaMinima = (agente.pujaActual || agente.precioBase) + 500000; // Incrementos de 500k
            
            const card = document.createElement("div");
            card.style.cssText = `background: var(--bg-tertiary); border-radius: 12px; overflow: hidden; border: 1px solid ${yoVoyGanando ? '#4CAF50' : 'var(--border-color)'}; transition: transform 0.2s; position: relative;`;
            
            card.innerHTML = `
                ${yoVoyGanando ? `<div style="position: absolute; top: 0; right: 0; background: #4CAF50; color: white; padding: 4px 12px; font-size: 0.8rem; font-weight: bold; border-bottom-left-radius: 8px;">Vas Ganando</div>` : ''}
                
                <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 15px;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; border: 2px solid ${color};">
                        ${icono}
                    </div>
                    <div>
                        <span style="color: ${color}; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">${agente.tipo}</span>
                        <h3 style="margin: 2px 0 0 0; font-size: 1.3rem;">${agente.nombre}</h3>
                        <p style="margin: 2px 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">${agente.stats}</p>
                    </div>
                </div>
                
                <div style="padding: 20px; background: rgba(0,0,0,0.2);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">Puja Actual:</span>
                        <strong style="color: #ffffff; font-size: 1.2rem;">$${(agente.pujaActual || agente.precioBase).toLocaleString()}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.85rem;">
                        <span style="color: var(--text-secondary);">Mejor Postor:</span>
                        <span style="color: ${yoVoyGanando ? '#4CAF50' : 'var(--accent)'}; font-weight: bold;">${agente.mejorPostorNombre || 'Nadie (Precio Base)'}</span>
                    </div>
                    
                    <button class="btn-solid" style="width: 100%; background: ${yoVoyGanando ? 'var(--bg-secondary)' : 'var(--accent)'}; color: ${yoVoyGanando ? 'var(--text-secondary)' : 'white'};" 
                            onclick="pujar('${id}', ${pujaMinima})" 
                            ${yoVoyGanando ? 'disabled' : ''}>
                        ${yoVoyGanando ? 'Eres el mejor postor' : `Pujar Mínimo ($${pujaMinima.toLocaleString()})`}
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

window.pujar = async function(agenteId, pujaMinima) {
    if (!currentTeamId) return alert("Debes tener un equipo asignado para pujar.");
    
    // Recargar presupuesto por si acaso
    await cargarMiPresupuesto();

    const input = prompt(`La puja mínima es $${pujaMinima.toLocaleString()}.\n\nTu presupuesto: $${currentTeamData.presupuesto.toLocaleString()}\n\nIngresa la cantidad a pujar (solo números):`, pujaMinima);
    if (!input) return;

    const oferta = parseInt(input);
    if (isNaN(oferta) || oferta < pujaMinima) return alert(`❌ Tu puja debe ser de al menos $${pujaMinima.toLocaleString()}`);
    if (oferta > currentTeamData.presupuesto) return alert("❌ No tienes suficiente presupuesto para esta puja.");

    try {
        const agenteRef = doc(db, "mercado_agentes", agenteId);
        const agenteSnap = await getDoc(agenteRef);
        const agenteData = agenteSnap.data();

        // Validar si alguien pujó más alto en los últimos segundos
        if (agenteData.pujaActual >= oferta) {
            return alert("❌ Alguien acaba de hacer una puja mayor. Vuelve a intentarlo.");
        }

        // Si había un postor anterior, devolverle su dinero
        if (agenteData.mejorPostorId) {
            const equipoAnteriorRef = doc(db, "equipos", agenteData.mejorPostorId);
            const equipoAnteriorSnap = await getDoc(equipoAnteriorRef);
            if (equipoAnteriorSnap.exists()) {
                const presuRecuperado = (equipoAnteriorSnap.data().presupuesto || 0) + agenteData.pujaActual;
                await updateDoc(equipoAnteriorRef, { presupuesto: presuRecuperado });
                
                // Notificarle que le han superado
                await addDoc(collection(db, "notificaciones"), {
                    equipoId: agenteData.mejorPostorId,
                    remitente: "Mercado",
                    texto: `📉 Te han superado en la puja por ${agenteData.nombre}. Tus $${agenteData.pujaActual.toLocaleString()} han sido devueltos a tu presupuesto.`,
                    fecha: serverTimestamp()
                });
            }
        }

        // Restar dinero a nuestro equipo
        await updateDoc(doc(db, "equipos", currentTeamId), {
            presupuesto: currentTeamData.presupuesto - oferta
        });

        // Actualizar el agente con nuestra puja
        await updateDoc(agenteRef, {
            pujaActual: oferta,
            mejorPostorId: currentTeamId,
            mejorPostorNombre: currentTeamData.nombre
        });

        alert("✅ ¡Puja realizada con éxito! Revisa si alguien te supera.");
        await cargarMiPresupuesto(); // Actualizar nuestro dinero en pantalla

    } catch (error) {
        console.error("Error al pujar:", error);
        alert("Hubo un error procesando la puja.");
    }
}
