// home.js - Maneja la navegación y autenticación en index.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
    const navDashboard = document.getElementById("nav-dashboard");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            btnLogin.style.display = "none";
            btnLogout.style.display = "inline-block";

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    
                    if (userData.equipo && userData.equipo !== "") {
                        navDashboard.style.display = "inline-block";
                    }
                }
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
            }

        } else {
            btnLogin.style.display = "inline-block";
            btnLogout.style.display = "none";
            navDashboard.style.display = "none";
        }
    });

    btnLogout.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });
});
