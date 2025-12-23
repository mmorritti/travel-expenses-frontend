import { GOOGLE_CLIENT_ID } from "./config.js";

const TOKEN_KEY = "google_token_data";
const EXPIRATION_DAYS = 30;
const EXPIRATION_MS = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export function checkAuth() {
    const tokenData = getStoredToken();
    const isValid = tokenData && isTokenValid(tokenData);

    // Elementi DOM chiave (potrebbero non esistere su tutte le pagine)
    const loginView = document.getElementById("login-view");

    if (isValid) {
        // Utente loggato: mostra l'app
        showAppView();
    } else {
        // Utente NON loggato
        if (loginView) {
            // Siamo sulla Home: mostriamo il login
            showLoginView();
            initGoogleButton();
        } else {
            // Siamo su una pagina interna (es. new-travel.html) ma senza token:
            // Redirect forzato alla home per fare il login
            console.warn("Utente non autenticato su pagina protetta. Redirect...");
            window.location.href = "/index.html";
        }
    }
}

function handleCredentialResponse(response) {
    const token = response.credential;
    const dataToStore = {
        token: token,
        timestamp: new Date().getTime()
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(dataToStore));
    
    console.log("Login effettuato. Ricarico la pagina...");
    
    // MODIFICA: Invece di chiamare solo showAppView(), ricarichiamo la pagina.
    // Questo risolve i problemi di stato e gli errori COOP/COEP.
    window.location.reload();
}

function initGoogleButton() {
    // Se siamo su una pagina senza container per il bottone, usciamo
    const btnContainer = document.getElementById("google-button-container");
    if (!btnContainer) return;

    if (!window.google) {
        setTimeout(initGoogleButton, 500); 
        return;
    }
    
    try {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });

        window.google.accounts.id.renderButton(
            btnContainer,
            { 
                theme: "filled_blue", 
                size: "large", 
                shape: "pill",
                text: "signin_with",
                width: "280"
            }
        );
    } catch (e) {
        console.error("Google Auth Init Error:", e);
    }
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    // Ricarica la pagina corrente o vai alla home
    window.location.href = "/index.html"; 
}

function getStoredToken() {
    const item = localStorage.getItem(TOKEN_KEY);
    if (!item) return null;
    try { return JSON.parse(item); } catch { return null; }
}

function isTokenValid(tokenData) {
    if (!tokenData.timestamp) return false;
    return (new Date().getTime() - tokenData.timestamp) < EXPIRATION_MS;
}

// --- GESTIONE UI SICURA (Non crasha se mancano gli ID) ---

function showAppView() {
    const loginView = document.getElementById("login-view");
    const appView = document.getElementById("app");
    const logoutBtn = document.getElementById("logout-btn");
    const userDisplay = document.getElementById("user-display");

    // Nascondi Login se esiste
    if (loginView) loginView.classList.add("hidden");
    
    // Mostra App se esiste
    if (appView) appView.classList.remove("hidden");
    
    // Collega Logout se esiste
    if (logoutBtn) logoutBtn.onclick = logout;

    // (Opzionale) Mostra nome utente se hai salvato i dati del profilo
    if (userDisplay) {
        // Qui potresti decodificare il JWT per prendere il nome, 
        // per ora lo rendiamo solo visibile se c'è logica extra
        userDisplay.classList.remove("hidden");
    }
}

function showLoginView() {
    const loginView = document.getElementById("login-view");
    const appView = document.getElementById("app");
    const userDisplay = document.getElementById("user-display");

    if (appView) appView.classList.add("hidden");
    if (userDisplay) userDisplay.classList.add("hidden");
    if (loginView) loginView.classList.remove("hidden");
}

// --- FETCH WRAPPER ---

export async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();

    // Se non ho il token, logout immediato
    if (!token) {
        console.warn("Token mancante. Logout forzato.");
        logout();
        return null;
    }

    const headers = {
        ...options.headers,
        "Authorization": `Bearer ${token}`
    };

    const newOptions = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, newOptions);

        if (response.status === 401) {
            console.error("Sessione scaduta (401).");
            logout();
            return null;
        }

        return response;
    } catch (error) {
        console.error("Errore di rete fetchWithAuth:", error);
        throw error;
    }
}

export function getAuthToken() {
    const data = getStoredToken();
    return data && isTokenValid(data) ? data.token : null;
}