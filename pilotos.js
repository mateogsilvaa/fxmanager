// pilotos.js (Página de Media?)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 1. CONFIGURACIÓN FIREBASE
// ==========================================
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

// Variable global para guardar todas las publicaciones
let allMediaData = [];

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 2. GESTIÓN DEL MENÚ SUPERIOR
    // ==========================================
    const navDashboard = document.getElementById("nav-dashboard");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (btnLogin) btnLogin.style.display = "none";
            if (btnLogout) btnLogout.style.display = "block";
            try {
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    if (userData.equipo && navDashboard) navDashboard.style.display = "inline-block";
                }
            } catch (error) { console.error(error); }
        } else {
            if (btnLogin) btnLogin.style.display = "inline-block";
            if (btnLogout) btnLogout.style.display = "none";
        }
        
        cargarPublicaciones();
    });

    if (btnLogin) btnLogin.addEventListener("click", () => window.location.href = "login.html");
    if (btnLogout) btnLogout.addEventListener("click", async () => { await signOut(auth); window.location.reload(); });

    // ==========================================
    // 3. LÓGICA DE FILTROS
    // ==========================================
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            // Quitar clase active a todos y ponersela al clickeado
            filterBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            
            // Renderizar según el filtro
            const tipoFiltro = e.target.getAttribute("data-filter");
            renderizarMedia(tipoFiltro);
        });
    });
});

// ==========================================
// 4. DESCARGAR Y RENDERIZAR MEDIA
// ==========================================
async function cargarPublicaciones() {
    const gridMedia = document.getElementById("grid-media");
    
    try {
        // Asumo que tu colección en Firebase se llamará "publicaciones"
        const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);

        allMediaData = [];
        snapshot.forEach(docSnap => {
            allMediaData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (allMediaData.length === 0) {
            gridMedia.innerHTML = "<p class='text-muted' style='text-align:center; width:100%;'>No hay contenido multimedia publicado.</p>";
            return;
        }

        renderizarMedia("todos");

    } catch (error) {
        console.error("Error cargando media:", error);
        gridMedia.innerHTML = "<p style='color: var(--danger); text-align:center; width:100%;'>Hubo un error al cargar las noticias.</p>";
    }
}

function renderizarMedia(filtro) {
    const gridMedia = document.getElementById("grid-media");
    gridMedia.innerHTML = "";

    // Filtrar el array
    const mediaFiltrada = filtro === "todos" 
        ? allMediaData 
        : allMediaData.filter(item => item.tipo === filtro);

    if (mediaFiltrada.length === 0) {
        gridMedia.innerHTML = `<p class='text-muted' style='text-align:center; width:100%;'>No hay contenido de tipo '${filtro}'.</p>`;
        return;
    }

    mediaFiltrada.forEach(item => {
        const card = document.createElement("div");
        card.className = "media-card";

        // Formatear la fecha (Si usas Timestamp de Firebase)
        let fechaFormat = "Fecha desconocida";
        if (item.fecha && item.fecha.toDate) {
            fechaFormat = item.fecha.toDate().toLocaleDateString("es-ES", { year: 'numeric', month: 'short', day: 'numeric' });
        }

        // Construir el HTML dependiendo del TIPO de publicación
        let htmlContenido = "";
        let tagTexto = "NOTICIA";

        if (item.tipo === "foto") {
            tagTexto = "FOTOGRAFÍA";
            htmlContenido = `
                <div class="media-image-container">
                    <img src="${item.url}" alt="${item.titulo}">
                </div>
            `;
        } 
        else if (item.tipo === "video") {
            tagTexto = "VÍDEO";
            // Lógica simple para detectar YouTube o MP4 normal
            if (item.url && item.url.includes("youtube.com") || item.url.includes("youtu.be")) {
                // Convertir link normal de youtube a link de embed
                const videoId = item.url.split('v=')[1]?.split('&')[0] || item.url.split('youtu.be/')[1];
                htmlContenido = `
                    <div class="media-video-container">
                        <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
                    </div>
                `;
            } else {
                htmlContenido = `
                    <div class="media-video-container">
                        <video controls>
                            <source src="${item.url}" type="video/mp4">
                            Tu navegador no soporta el formato de vídeo.
                        </video>
                    </div>
                `;
            }
        } 
        else {
            // Por defecto es "articulo"
            tagTexto = "COMUNICADO";
            htmlContenido = `
                <div class="media-content">
                    <p>${item.texto ? item.texto.substring(0, 150) + '...' : 'Sin contenido'}</p>
                </div>
            `;
        }

        // Ensamblar la tarjeta final
        card.innerHTML = `
            ${item.tipo === "foto" || item.tipo === "video" ? htmlContenido : ''}
            <div class="media-header">
                <span class="media-tag">${tagTexto}</span>
                <h3 class="media-title">${item.titulo || 'Sin título'}</h3>
                <span class="media-date">${fechaFormat} | FIA Prensa</span>
            </div>
            ${item.tipo === "articulo" ? htmlContenido : ''}
        `;

        gridMedia.appendChild(card);
    });
}