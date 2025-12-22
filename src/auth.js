import { GOOGLE_CLIENT_ID } from "./config.js";

const TOKEN_KEY = "google_token_data";
const EXPIRATION_DAYS = 30;
const EXPIRATION_MS = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export function checkAuth() {
    const tokenData = getStoredToken();

    if (tokenData && isTokenValid(tokenData)) {
        showAppView();
    } else {
        showLoginView();
        initGoogleButton();
    }
}

function handleCredentialResponse(response) {
    const token = response.credential;
    const dataToStore = {
        token: token,
        timestamp: new Date().getTime()
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(dataToStore));
    showAppView();
}

function initGoogleButton() {
    if (!window.google) {
        // Riprova tra poco se lo script non è ancora carico
        setTimeout(initGoogleButton, 500); 
        return;
    }
    
    // Evitiamo warning se già inizializzato
    try {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });

        window.google.accounts.id.renderButton(
            document.getElementById("google-button-container"),
            { theme: "outline", size: "large", width: "250" }
        );
    } catch (e) {
        console.log("Google Auth Init:", e);
    }
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    location.reload(); 
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

// GESTIONE UI (Usa le classi 'hidden' di Tailwind)
function showAppView() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    
    const logoutBtn = document.getElementById("logout-btn");
    if(logoutBtn) logoutBtn.onclick = logout;
}

function showLoginView() {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
}

export function getAuthToken() {
    const data = getStoredToken();
    return data && isTokenValid(data) ? data.token : null;
}