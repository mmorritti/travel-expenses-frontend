// src/auth.js
import { GOOGLE_CLIENT_ID } from "./config.js";

export function initGoogleAuth() {
    if (!window.google) {
        console.error("Google script not loaded");
        return;
    }

    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    window.google.accounts.id.renderButton(
        document.getElementById("google-button-container"),
        { theme: "outline", size: "large" }  // personalizzazione pulsante
    );
}

function handleCredentialResponse(response) {
    // 1. Riceviamo il JWT (JSON Web Token) da Google
    const token = response.credential;
    
    // 2. Lo salviamo nel LocalStorage per usarlo nelle chiamate API future
    localStorage.setItem("google_token", token);
    
    console.log("Token Google salvato:", token);
    
    // 3. Opzionale: Nascondiamo il pulsante o mostriamo un messaggio di benvenuto
    // Per ora ci limitiamo a stampare in console per verificare che funzioni.
    document.getElementById("google-button-container").style.display = "none";
    
    const userInfoDiv = document.getElementById("user-info");
    userInfoDiv.style.display = "block";
    userInfoDiv.innerText = "Utente autenticato (Token acquisito)";
}