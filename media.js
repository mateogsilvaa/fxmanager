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
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('grid-media');
    if (!container) {
        console.error('Contenedor #grid-media no encontrado');
        return;
    }
    loadMedia();
});

async function loadMedia() {
    const container = document.getElementById('grid-media');
    if (!container) {
        console.error('Contenedor #grid-media no encontrado en loadMedia');
        return;
    }
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Cargando contenido...</p>';

    try {
        console.log('Intentando cargar media desde Firebase...');
        const mediaSnap = await getDocs(query(collection(db, "media"), orderBy("timestamp", "desc")));
        console.log('Documentos obtenidos:', mediaSnap.size);

        if (mediaSnap.empty) {
            console.log('No hay documentos en la colección media');
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px; font-size: 1.1rem;">Próximamente publicaremos noticias y contenido exclusivo.</p>';
            return;
        }

        container.innerHTML = ''; // Limpiar el contenedor
        let count = 0;
        mediaSnap.forEach(doc => {
            count++;
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'media-card';
            
            // Manejar timestamp robusto
            let fechaTexto = '';
            try {
                if (post.timestamp && typeof post.timestamp.toDate === 'function') {
                    fechaTexto = post.timestamp.toDate().toLocaleDateString('es-ES');
                } else if (post.timestamp && (post.timestamp instanceof Date)) {
                    fechaTexto = post.timestamp.toLocaleDateString('es-ES');
                } else if (post.timestamp) {
                    const t = new Date(post.timestamp);
                    if (!isNaN(t)) fechaTexto = t.toLocaleDateString('es-ES');
                }
            } catch (e) {
                console.warn('Error parsing timestamp:', e);
            }
            
            postElement.innerHTML = `
                ${post.imagenURL ? `<img src="${post.imagenURL}" alt="${post.titulo || 'Imagen'}" loading="lazy">` : ''}
                <div class="media-card-content">
                    <h3>${post.titulo || 'Sin título'}</h3>
                    <p>${post.resumen || post.contenido || ''}</p>
                    <div class="media-card-footer">
                        <span>Por: ${post.autor || 'F1 Manager'}</span>
                        <span>${fechaTexto}</span>
                    </div>
                </div>
            `;
            container.appendChild(postElement);
        });
        console.log('Se cargaron ' + count + ' publicaciones');

    } catch (error) {
        console.error("Error al cargar el contenido multimedia: ", error);
        const isPermissionError = error.code === 'permission-denied';
        const message = isPermissionError 
            ? 'Próximamente publicaremos noticias y contenido exclusivo.'
            : 'Error al cargar. Intenta de nuevo más tarde.';
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 40px; font-size: 1.1rem;">${message}</p>`;
    }
}
