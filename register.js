// register.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("register-form");
    const errorBox = document.getElementById("reg-error");

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;

        try {
            // 1. Crear el usuario en la autenticación de Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. IMPORTANTE: Crear el perfil en la base de datos Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nombre: name,
                email: email,
                isAdmin: false,  // Por defecto nadie es admin
                equipo: null     // Por defecto nadie tiene equipo
            });

            // 3. Redirigir al inicio una vez completado el registro
            window.location.href = "home.html";

        } catch (error) {
            console.error("Error en registro:", error.code);
            errorBox.style.display = "block";
            
            if (error.code === 'auth/email-already-in-use') {
                errorBox.textContent = "Este correo electrónico ya está registrado.";
            } else if (error.code === 'auth/weak-password') {
                errorBox.textContent = "La contraseña debe tener al menos 6 caracteres.";
            } else {
                errorBox.textContent = "Error al crear la cuenta. Revisa los datos.";
            }
        }
    });
});