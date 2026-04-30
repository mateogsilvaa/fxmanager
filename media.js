// media.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Variables globales para la media
let todasLasPublicaciones = [];

document.addEventListener('DOMContentLoaded', async () => {
    
    // Configurar menú si está logueado
    const navDashboard = document.getElementById("nav-dashboard");
    onAuthStateChanged(auth, (user) => {
        if (user && navDashboard) {
            navDashboard.style.display = "inline-block";
        }
    });

    const gridMedia = document.getElementById('grid-media');

    try {
        // 1. Consultar Firebase: Colección "publicaciones" ordenada por fecha
        const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);

        // Limpiar el texto de "Cargando..."
        if (gridMedia) gridMedia.innerHTML = '';

        if (snapshot.empty) {
            if (gridMedia) gridMedia.innerHTML = '<p style="color:var(--text-secondary); text-align:center; width:100%;">No hay publicaciones disponibles.</p>';
            return;
        }

        // 2. Guardar en memoria para poder filtrar luego
        snapshot.forEach(docSnap => {
            todasLasPublicaciones.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 3. Pintar todas por defecto
        pintarMedia("todos");

        // 4. Configurar los botones de filtro
        const filterBtns = document.querySelectorAll(".filter-btn");
        filterBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                // Quitar clase active a todos
                filterBtns.forEach(b => b.classList.remove("active"));
                // Poner active al pulsado
                e.target.classList.add("active");
                // Pintar filtrando por el data-filter
                pintarMedia(e.target.getAttribute("data-filter"));
            });
        });

    } catch (error) {
        console.error('Error al cargar la media desde Firebase:', error);
        if (gridMedia) gridMedia.innerHTML = '<p style="color: #ff4444; text-align:center; width:100%;">Error al cargar las noticias. Revisa tu conexión.</p>';
    }
});

function pintarMedia(filtro) {
    const gridMedia = document.getElementById('grid-media');
    if (!gridMedia) return;

    gridMedia.innerHTML = ''; // Limpiar grid

    // Filtrar publicaciones
    const pubsFiltradas = filtro === "todos" 
        ? todasLasPublicaciones 
        : todasLasPublicaciones.filter(p => p.tipo === filtro);

    if (pubsFiltradas.length === 0) {
        gridMedia.innerHTML = `<p style="color:var(--text-secondary); text-align:center; width:100%;">No hay publicaciones de tipo "${filtro}".</p>`;
        return;
    }

    // Dibujar cada publicación
    pubsFiltradas.forEach(pub => {
        const fechaFormateada = pub.fecha ? new Date(pub.fecha.toDate()).toLocaleDateString() : 'Reciente';

        const elemento = document.createElement('div');
        elemento.style.cssText = "background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s;";
        
        // Efecto hover sutil
        elemento.onmouseover = () => elemento.style.transform = "translateY(-5px)";
        elemento.onmouseout = () => elemento.style.transform = "translateY(0)";

        let contenidoMultimedia = '';

        if (pub.tipo === 'video' && pub.url) {
            // Iframe responsivo para YouTube o vídeos
            contenidoMultimedia = `
                <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; background:#000;">
                    <iframe src="${pub.url}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allowfullscreen></iframe>
                </div>`;
        } else if (pub.url) {
            // Imagen
            contenidoMultimedia = `
                <div style="width: 100%; padding-top: 125%; position: relative; background: #000; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <img src="${pub.url}" alt="${pub.titulo}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;">
                </div>`;
        }

        // Tipo de badge
        let badgeColor = "#3b82f6"; // Azul por defecto (Noticia)
        if (pub.tipo === "foto") badgeColor = "#eab308"; // Amarillo
        if (pub.tipo === "video") badgeColor = "#ef4444"; // Rojo

        // Texto completo (reemplazando saltos de línea por <br> para respetar los párrafos)
        const textoCompleto = (pub.texto || '').replace(/\n/g, '<br>');

        elemento.innerHTML = `
            ${contenidoMultimedia}
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="background: ${badgeColor}30; color: ${badgeColor}; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; border: 1px solid ${badgeColor}50;">
                        ${pub.tipo || 'Noticia'}
                    </span>
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">${fechaFormateada}</span>
                </div>
                <h2 style="margin: 0 0 10px 0; font-size: 1.3rem; line-height: 1.3;">${pub.titulo}</h2>
                
                <div class="texto-publicacion">
                    <p class="texto-corto" style="color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                        ${pub.texto || ''}
                    </p>
                    <p class="texto-largo" style="color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem; margin: 0; display: none;">
                        ${textoCompleto}
                    </p>
                </div>
                ${pub.texto && pub.texto.length > 150 ? `
                    <button class="btn-leer-mas" style="background:none; border:none; color:var(--accent); padding:10px 0 0 0; cursor:pointer; font-weight:bold; font-size:0.9rem;">Leer artículo completo ↓</button>
                ` : ''}
            </div>
        `;

        gridMedia.appendChild(elemento);

        // Darle vida al botón "Leer más"
        const btnLeerMas = elemento.querySelector('.btn-leer-mas');
        if (btnLeerMas) {
            btnLeerMas.addEventListener('click', function() {
                const txtCorto = elemento.querySelector('.texto-corto');
                const txtLargo = elemento.querySelector('.texto-largo');
                
                if (txtCorto.style.display !== 'none') {
                    txtCorto.style.display = 'none';
                    txtLargo.style.display = 'block';
                    this.textContent = 'Ocultar ↑';
                } else {
                    txtCorto.style.display = '-webkit-box';
                    txtLargo.style.display = 'none';
                    this.textContent = 'Leer artículo completo ↓';
                }
            });
        }
    });
}
