// Login.js 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAE1PLVdULmXqkscQb9jK8gAkXbjIBETbk",
    authDomain: "fxmanager-c5868.firebaseapp.com",
    projectId: "fxmanager-c5868",
    storageBucket: "fxmanager-c5868.appspot.com",
    messagingSenderId: "652487009924",
    appId: "1:652487009924:web:c976804d6b48c4dda004d1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorBox = document.getElementById("login-error");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Evita que la página recargue
        
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            // Intentamos iniciar sesión con Firebase
            await signInWithEmailAndPassword(auth, email, password);
            
            // Si el login es correcto, enviamos al usuario al inicio
            window.location.href = "index.html";

        } catch (error) {
            console.error("Error en login:", error.code);
            errorBox.style.display = "block";
            
            // Traducir los errores más comunes
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                errorBox.textContent = "Correo o contraseña incorrectos.";
            } else {
                errorBox.textContent = "Ha ocurrido un error. Inténtalo de nuevo.";
            }
        }
    });
});