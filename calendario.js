// calendario.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// Caché de datos
let pilotosMap = {};
let equiposMap = {};

document.addEventListener("DOMContentLoaded", async () => {
    // Nav logic
    const navDashboard = document.getElementById("nav-dashboard");
    onAuthStateChanged(auth, (user) => {
        if (user && navDashboard) navDashboard.style.display = "inline-block";
    });

    await cargarDatosBase();
    cargarCalendario();
});

async function cargarDatosBase() {
    // Cargar Pilotos
    const pSnap = await getDocs(collection(db, "pilotos"));
    pSnap.forEach(d => {
        const p = d.data();
        pilotosMap[d.id] = { nombre: p.nombre, apellido: p.apellido || '', equipoId: p.equipoId };
    });

    // Cargar Equipos
    const eSnap = await getDocs(collection(db, "equipos"));
    eSnap.forEach(d => {
        const e = d.data();
        equiposMap[d.id] = { nombre: e.nombre, color: e.color || '#fff' };
    });
}

async function cargarCalendario() {
    const grid = document.getElementById("grid-calendario");
    try {
        const q = query(collection(db, "carreras"), orderBy("ronda", "asc"));
        const snapshot = await getDocs(q);

        grid.innerHTML = "";
        
        if(snapshot.empty) {
            grid.innerHTML = "<p class='text-muted' style='text-align:center;'>No hay carreras programadas.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const c = docSnap.data();
            const fecha = new Date(c.fecha).toLocaleDateString("es-ES", { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
            
            let estadoHTML = `<span class="race-status status-pending">📅 Pendiente</span>`;
            let botonHTML = `<button class="btn-outline" disabled style="opacity:0.5; cursor:not-allowed;">Esperando resultados</button>`;

            if (c.completada || c.test) {
                if (c.test) {
                    estadoHTML = `<span class="race-status" style="background: var(--info); color: #000; padding: 5px 15px; border-radius: 4px; font-weight: bold;">TEST</span>`;
                } else {
                    let nombreGanador = "Desconocido";
                    let colorGanador = "var(--border-color)";
                    let infoExtra = "";

                    const ganadorId = c.resultados_20 ? c.resultados_20[0] : null;
                    if (ganadorId && pilotosMap[ganadorId]) {
                        const p = pilotosMap[ganadorId];
                        nombreGanador = `${p.nombre} ${p.apellido}`;
                        const eq = equiposMap[p.equipoId];
                        if(eq) colorGanador = eq.color;
                        const idx = c.resultados_20.indexOf(ganadorId);
                        const t = c.resultados_tiempo && c.resultados_tiempo[idx];
                        const v = c.resultados_vueltas && c.resultados_vueltas[idx];
                        if (t) infoExtra += `${t}`;
                        if (v) infoExtra += (infoExtra? ' / ' : '') + `${v}v`;
                    }

                    estadoHTML = `
                        <div style="text-align:right;">
                            <span style="display:block; font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase;">Ganador</span>
                            <strong style="color:${colorGanador}; font-size:1.1rem;">🏆 ${nombreGanador}</strong>
                            ${infoExtra ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">⏱️ ${infoExtra}</div>` : ''}
                        </div>
                    `;
                }

                const dataString = encodeURIComponent(JSON.stringify(c));
                botonHTML = `<button class="btn-solid" onclick="abrirDetalles('${dataString}')">Ver Resultados</button>`;
            }

            grid.innerHTML += `
                <div class="race-card">
                    <div class="race-info">
                        <div class="race-round">${c.ronda}</div>
                        <div class="race-details">
                            <h2>${c.nombre}</h2>
                            <p>${c.circuito} • ${fecha}</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:20px;">
                        ${estadoHTML}
                        ${botonHTML}
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        grid.innerHTML = "<p>Error al cargar el calendario.</p>";
    }
}

window.abrirDetalles = (dataEncoded) => {
    const data = JSON.parse(decodeURIComponent(dataEncoded));
    
    document.getElementById("modal-titulo").textContent = `${data.nombre} - Resultados`;
    
    const extraInfoBlock = document.querySelector(".info-extra");
    const btnRace = document.getElementById("btn-tab-race");
    const btnQual = document.getElementById("btn-tab-qual");
    const btnPrac = document.getElementById("btn-tab-prac");

    // Lógica para separar vistas si es TEST o NORMAL
    if (data.test) {
        if(btnRace) btnRace.style.display = "none";
        if(btnQual) btnQual.style.display = "none";
        if(btnPrac) btnPrac.textContent = "Resultados del Test";
        if(extraInfoBlock) extraInfoBlock.style.display = "none"; // Ocultamos pole/VR en test
        
        window.verPestana('prac'); // Forzamos abrir la pestaña de práctica
    } else {
        if(btnRace) btnRace.style.display = "inline-block";
        if(btnQual) btnQual.style.display = "inline-block";
        if(btnPrac) btnPrac.textContent = "Práctica";
        if(extraInfoBlock) extraInfoBlock.style.display = "flex";
        
        window.verPestana('race'); // Por defecto abrimos carrera
        
        // Info Pole y VR
        const divPole = document.getElementById("info-pole");
        const divVr = document.getElementById("info-vr");
        
        const getPilotoHTML = (pid) => {
            if(!pid || !pilotosMap[pid]) return "N/A";
            const p = pilotosMap[pid];
            const e = equiposMap[p.equipoId] || {color:'#fff'};
            return `<span style="font-weight:bold; color:${e.color}">${p.nombre} ${p.apellido}</span>`;
        };

        if(divPole) divPole.innerHTML = `<span style="color:var(--text-secondary); font-size:0.8rem; text-transform:uppercase;">Pole Position</span><br>${getPilotoHTML(data.pole)}`;
        if(divVr) divVr.innerHTML = `<span style="color:var(--text-secondary); font-size:0.8rem; text-transform:uppercase;">Vuelta Rápida</span><br>${getPilotoHTML(data.vr)}`;
    }

    // Rellenamos las 3 tablas pasándole ahora los 3 arrays (pilotos, tiempos, vueltas)
    llenarTabla("table-race-body", data.resultados_20, data.resultados_tiempo, data.resultados_vueltas);
    llenarTabla("table-qual-body", data.clasificacion, data.clasificacion_tiempo, data.clasificacion_vueltas);
    llenarTabla("table-prac-body", data.entrenamientos, data.entrenamientos_tiempo, data.entrenamientos_vueltas);

    document.getElementById("modal-detalles").style.display = "flex";
};

// Función actualizada para leer tiempos y vueltas, y actualizar los encabezados de la tabla
function llenarTabla(elementId, idList, tiemposList = [], vueltasList = []) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    
    // Forzar la cabecera de la tabla padre para que muestre las nuevas columnas
    const thead = tbody.parentElement.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
            <th>Pos</th>
            <th>Piloto</th>
            <th>Equipo</th>
            <th style="text-align:center;">Tiempo</th>
            <th style="text-align:center;">Vueltas</th>
        `;
    }

    tbody.innerHTML = "";
    
    if (!idList || idList.length === 0 || (idList.length === 1 && idList[0] === "")) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:var(--text-secondary);'>Sin datos registrados en esta sesión.</td></tr>";
        return;
    }

    idList.forEach((pid, index) => {
        if (!pid) return;
        const p = pilotosMap[pid];
        const e = p ? equiposMap[p.equipoId] : null;
        
        const nombre = p ? `${p.nombre} <strong>${p.apellido || ''}</strong>` : "Desconocido";
        const equipoNombre = e ? e.nombre : "Agente Libre";
        const equipoColor = e ? e.color : "#aaa";
        
        // Extraemos los datos o mostramos un guión si el admin los dejó vacíos
        const tiempo = (tiemposList && tiemposList[index]) ? tiemposList[index] : "-";
        const vueltas = (vueltasList && vueltasList[index]) ? vueltasList[index] : "-";

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding:12px; font-weight:bold; color:var(--text-secondary);">${index + 1}</td>
                <td style="padding:12px; font-size: 1.05rem;">${nombre}</td>
                <td style="padding:12px; color:${equipoColor}; font-weight:600;">${equipoNombre}</td>
                <td style="padding:12px; text-align:center; font-family:monospace; color:var(--accent);">${tiempo}</td>
                <td style="padding:12px; text-align:center; font-weight:bold;">${vueltas}</td>
            </tr>
        `;
    });
}