// home.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del menú en home.html
    const navDashboard = document.getElementById("nav-dashboard");
    const navAdmin = document.getElementById("nav-admin");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    // ==========================================
    // 2. ESCUCHAR ESTADO DE SESIÓN
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // -- EL USUARIO HA INICIADO SESIÓN --
            btnLogin.style.display = "none";
            btnLogout.style.display = "block";

            try {
                // Buscar los datos del usuario en la base de datos
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    
                    // Comprobamos si es Admin (asegúrate de que en tu BD haya un campo 'isAdmin': true)
                    const isAdmin = userData.isAdmin === true; 
                    
                    // Comprobamos si tiene equipo (el campo 'equipo' tiene algún ID guardado)
                    const hasTeam = userData.equipo && userData.equipo !== "";

                    // Mostrar enlaces restringidos según sus permisos
                    if (isAdmin) {
                        navAdmin.style.display = "inline-block";
                    } else {
                        navAdmin.style.display = "none";
                    }

                    if (hasTeam) {
                        navDashboard.style.display = "inline-block";
                    } else {
                        navDashboard.style.display = "none";
                    }
                }
            } catch (error) {
                console.error("Error al obtener los datos del usuario:", error);
            }

        } else {
            // -- NO HAY NADIE LOGUEADO (Invitado) --
            btnLogin.style.display = "inline-block";
            btnLogout.style.display = "none";
            navAdmin.style.display = "none";
            navDashboard.style.display = "none";
        }
    });

    // ==========================================
    // 3. BOTONES DE LOGIN / LOGOUT
    // ==========================================
    btnLogin.addEventListener("click", () => {
        // Como me dijiste al principio que tenías un "register.html", lo mandamos ahí.
        // Si tienes un "login.html", cambia esta ruta:
        window.location.href = "login.html"; 
    });

    btnLogout.addEventListener("click", async () => {
        try {
            await signOut(auth);
            console.log("Sesión cerrada correctamente");
            // Recargamos la página para limpiar el menú de forma segura
            window.location.reload();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });
});
