// 1. importamos Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. Tu configuración de FX Manager
const firebaseConfig = {
  apiKey: "AIzaSyAE1PLVdULmXqkscQb9jK8gAkXbjIBETbk",
  authDomain: "fxmanager-c5868.firebaseapp.com",
  projectId: "fxmanager-c5868",
  storageBucket: "fxmanager-c5868.firebasestorage.app",
  messagingSenderId: "652487009924",
  appId: "1:652487009924:web:c976804d6b48c4dda004d1",
  measurementId: "G-XK03CWHZEK"
};

// 3. Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 4. Lógica del botón de Login
const btnLogin = document.getElementById('btnLogin');
const mensaje = document.getElementById('mensaje');

if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if(!email || !password) {
            mensaje.style.color = "#ff4444";
            mensaje.innerText = "Faltan datos en boxes. Rellena todo.";
            return;
        }
        mensaje.style.color = "#e6b800";
        mensaje.innerText = "Conectando con la FIA...";

        // Intentar iniciar sesión
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                mensaje.style.color = "#00C851";
                mensaje.innerText = "¡Acceso concedido! Entrando...";
                
                // Redirigir al dashboard tras 1 segundo
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1000);
            })
            .catch((error) => {
                mensaje.style.color = "#ff4444";
                if (error.code === 'auth/invalid-credential') {
                    mensaje.innerText = "Correo o contraseña incorrectos.";
                } else {
                    mensaje.innerText = "Error de conexión: " + error.code;
                }
            });
    });
}

// 5. Truco: Si ya han iniciado sesión antes, los mandamos directo a HOME
onAuthStateChanged(auth, (user) => {
    if (user && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
        window.location.href = "index.html";
    }
});