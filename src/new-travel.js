import { API_BASE_URL } from "./config.js";
import { checkAuth, fetchWithAuth } from "./auth.js";

// IMPORT FLATPICKR
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Italian } from "flatpickr/dist/l10n/it.js";

// Check Auth immediato
checkAuth();

console.log("Script new-travel.js caricato. API URL:", API_BASE_URL);

// --- 1. DEFINIZIONE VALUTE ---
const CURRENCIES = [
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Sterlina britannica', flag: '🇬🇧' },
  { code: 'CHF', name: 'Franco svizzero', flag: '🇨🇭' },
  { code: 'USD', name: 'Dollaro USA', flag: '🇺🇸' },
  { code: 'JPY', name: 'Yen giapponese', flag: '🇯🇵' },
  { code: 'MAD', name: 'Dirham Marocchino', flag: '🇲🇦' },
  { code: 'AUD', name: 'Dollaro australiano', flag: '🇦🇺' }
];

// --- 2. LOGICA CALENDARI ---
// Eseguiamo immediatamente
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");

if (startInput && endInput) {
    const commonConfig = {
        locale: Italian,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j M Y",
        minDate: "today",
        disableMobile: true,
        allowInput: false
    };

    const endDatePicker = flatpickr(endInput, commonConfig);
    
    flatpickr(startInput, {
        ...commonConfig,
        onChange: function(selectedDates, dateStr) {
            // Aggiorna la data minima di fine quando cambi l'inizio
            endDatePicker.set('minDate', dateStr);
            setTimeout(() => endDatePicker.open(), 100);
        }
    });
}

// --- 3. LOGICA VALUTE (Dropdown) ---
const currencySearchInput = document.getElementById('travelCurrencySearch');
const currencyDropdown = document.getElementById('travelCurrencyDropdown');
const currencyCodeInput = document.getElementById('travelCurrencyCode');

function renderCurrencyList(term = '') {
    if (!currencyDropdown) return;
    
    // Pulisce e prepara
    currencyDropdown.innerHTML = '';
    
    const lowerTerm = term.toLowerCase();
    const filtered = CURRENCIES.filter(c => 
        c.code.toLowerCase().includes(lowerTerm) || 
        c.name.toLowerCase().includes(lowerTerm)
    );

    if (filtered.length === 0) {
        currencyDropdown.innerHTML = `<div class="p-3 text-sm text-gray-500">Nessuna valuta trovata</div>`;
        return;
    }

    filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = "flex items-center justify-between p-3 hover:bg-sky-50 cursor-pointer border-b border-gray-50 last:border-0";
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xl">${c.flag}</span>
                <span class="text-sm font-medium text-gray-700">${c.name}</span>
            </div>
            <span class="text-xs font-bold text-sky-600 bg-sky-100 px-2 py-1 rounded">${c.code}</span>
        `;
        
        // Evento Mousedown (meglio di click per evitare conflitti col blur)
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); 
            currencySearchInput.value = `${c.flag} ${c.code} - ${c.name}`;
            currencyCodeInput.value = c.code; 
            currencyDropdown.classList.add('hidden');
        });
        
        currencyDropdown.appendChild(item);
    });

    currencyDropdown.classList.remove('hidden');
}

// Event Listeners Valuta
if (currencySearchInput) {
    currencySearchInput.addEventListener('input', (e) => renderCurrencyList(e.target.value));
    currencySearchInput.addEventListener('focus', () => renderCurrencyList(currencySearchInput.value));
    
    // Chiudi se clicchi fuori
    document.addEventListener('click', (e) => {
        if (!currencySearchInput.contains(e.target) && !currencyDropdown.contains(e.target)) {
            currencyDropdown.classList.add('hidden');
        }
    });
}

// --- 4. LOGICA SUBMIT (CREAZIONE VIAGGIO) ---
const form = document.getElementById('travel-form');
const errorBox = document.getElementById('error-box');

// Gestione pulsanti "Indietro" e "Annulla"
const backBtn = document.getElementById('back-btn');
const cancelBtn = document.getElementById('cancel-btn');
const goHome = () => window.location.href = '/index.html';
if(backBtn) backBtn.addEventListener('click', goHome);
if(cancelBtn) cancelBtn.addEventListener('click', goHome);


if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // BLOCCA IL RICARICAMENTO
        
        console.log(">>> INVIO FORM...");
        if(errorBox) errorBox.classList.add('hidden');

        // 1. Recupera Dati
        const nameInput = document.getElementById('name');
        const name = nameInput ? nameInput.value.trim() : "";
        
        // I valori di data li prendiamo dagli input, flatpickr li aggiorna automaticamente
        const startDate = startInput ? startInput.value : "";
        const endDate = endInput ? endInput.value : "";

        // Gestione valuta: usa il codice nascosto, oppure prova a indovinare dalla ricerca
        let travelCode = currencyCodeInput ? currencyCodeInput.value : "";
        if (!travelCode && currencySearchInput && currencySearchInput.value.length >= 3) {
             travelCode = currencySearchInput.value.substring(0,3).toUpperCase();
        }
        // Fallback estremo
        if (!travelCode) travelCode = 'EUR';

        // 2. Validazione
        if (!name || !startDate || !endDate) {
            alert("Compila tutti i campi!");
            return;
        }

        // 3. Preparazione Payload
        const payload = {
            name: name,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            homeCurrencyCode: "EUR", // Hardcoded per ora
            travelCurrencyCode: travelCode,
            countryCode: "IT" 
        };

        console.log("Payload:", payload);

        try {
            // 4. Invio al Backend
            const API_URL = `${API_BASE_URL}/Travels`;
            
            const response = await fetchWithAuth(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Se l'auth fallisce, response è null
            if (!response) {
                console.error("Auth fallita.");
                return; 
            }

            if (response.ok) {
                // SUCCESSO
                alert("Viaggio creato con successo!");
                window.location.href = '/index.html';
            } else {
                // ERRORE DAL SERVER
                const errorText = await response.text();
                console.error("Errore Backend:", errorText);
                
                let message = `Errore: ${response.status}`;
                try {
                    // Proviamo a parsare l'errore JSON se c'è
                    const jsonError = JSON.parse(errorText);
                    if(jsonError.title) message = jsonError.title;
                    if(jsonError.errors) message = JSON.stringify(jsonError.errors);
                } catch(e) {}

                if(errorBox) {
                    errorBox.textContent = message;
                    errorBox.classList.remove('hidden');
                }
                alert("Errore salvataggio: " + message);
            }

        } catch (err) {
            console.error("Eccezione JS:", err);
            alert("Errore di connessione: " + err.message);
        }
    });
} else {
    console.error("Form non trovato! Controlla l'ID 'travel-form'.");
}

// --- 5. CONTATORE CARATTERI ---
const nameInput = document.getElementById('name');
const charCount = document.getElementById('char-count');
if(nameInput && charCount) {
    nameInput.addEventListener('input', () => {
        const len = nameInput.value.length;
        charCount.textContent = `${len}/50`;
        if(len >= 45) charCount.classList.add('text-orange-500');
        else charCount.classList.remove('text-orange-500');
    });
}