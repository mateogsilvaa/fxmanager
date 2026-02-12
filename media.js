import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', loadMedia);

async function loadMedia() {
    const container = document.getElementById('media-container');
    container.innerHTML = '<p>Cargando publicaciones...</p>';

    try {
        const mediaSnap = await getDocs(query(collection(db, "media"), orderBy("timestamp", "desc")));

        if (mediaSnap.empty) {
            container.innerHTML = '<p>No hay publicaciones disponibles en este momento.</p>';
            return;
        }

        container.innerHTML = ''; // Limpiar el contenedor
        mediaSnap.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'media-card';
            postElement.innerHTML = `
                ${post.imagenURL ? `<img src="${post.imagenURL}" alt="${post.titulo}">` : ''}
                <div class="media-card-content">
                    <h3>${post.titulo}</h3>
                    <p>${post.resumen}</p>
                    <div class="media-card-footer">
                        <span>Por: ${post.autor || 'Admin'}</span>
                        <span>${post.timestamp?.toDate().toLocaleDateString() || ''}</span>
                    </div>
                </div>
            `;
            container.appendChild(postElement);
        });

    } catch (error) {
        console.error("Error al cargar el contenido multimedia: ", error);
        container.innerHTML = '<p style="color: var(--danger);">No se pudo cargar el contenido. Inténtalo de nuevo más tarde.</p>';
    }
}
