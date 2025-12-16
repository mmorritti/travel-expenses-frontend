import { API_BASE_URL } from "./config.js";

const API_URL = `${API_BASE_URL}/Travels`;

// Valute (Stessa lista di prima...)
const CURRENCIES = [
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Sterlina britannica', flag: '🇬🇧' },
  { code: 'CHF', name: 'Franco svizzero', flag: '🇨🇭' },
  { code: 'USD', name: 'Dollaro statunitense', flag: '🇺🇸' },
  { code: 'JPY', name: 'Yen giapponese', flag: '🇯🇵' },
  { code: 'MAD', name: 'Dirham marocchino', flag: '🇲🇦' },
  // ... (Tieni pure la tua lista completa qui) ...
  { code: 'AUD', name: 'Dollaro australiano', flag: '🇦🇺' }
];

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('travel-form');
  const errorBox = document.getElementById('error-box');
  const backBtn = document.getElementById('back-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  const currencySearchInput = document.getElementById('travelCurrencySearch');
  const currencyCodeInput = document.getElementById('travelCurrencyCode');
  const currencyDropdown = document.getElementById('travelCurrencyDropdown');

  // Gestione tasti indietro
  const goHome = () => window.location.href = '/index.html';
  if(backBtn) backBtn.addEventListener('click', goHome);
  if(cancelBtn) cancelBtn.addEventListener('click', goHome);

  // === 📅 INIZIALIZZAZIONE DATEPICKER (Flatpickr) ===
  
  // 1. Inizializza Data Fine (disabilitata all'inizio o libera)
  const endDatePicker = flatpickr("#endDate", {
    locale: "it",
    dateFormat: "Y-m-d",   // Questo è il valore che viene salvato (es. 2024-08-15)
    altInput: true,        // Attiva la visualizzazione "alternativa"
    altFormat: "j F Y",    // Questo è quello che vede l'utente (es. 15 Agosto 2024)
    minDate: "today",
    disableMobile: "true",
    allowInput: true       // Permette di aprire il calendario cliccando
  });

  // 2. Inizializza Data Inizio con logica di collegamento
 const startDatePicker = flatpickr("#startDate", {
    locale: "it",
    dateFormat: "Y-m-d",   
    altInput: true,        
    altFormat: "j F Y",    // Visualizza: 15 Agosto 2024
    minDate: "today",
    disableMobile: "true",
    allowInput: true,
    onChange: function(selectedDates, dateStr, instance) {
        // Appena scelgo la data inizio:
        
        // 1. Imposta la data minima per la fine
        endDatePicker.set('minDate', dateStr);
        
        // 2. Se la data fine era precedente, puliscila
        const endDateVal = endDatePicker.selectedDates[0];
        if (endDateVal && endDateVal < selectedDates[0]) {
            endDatePicker.clear();
        }
        
        // 3. Apre automaticamente il calendario di fine (User Experience Top!)
        setTimeout(() => endDatePicker.open(), 100); 
    }
  });


  // === LIVE SEARCH VALUTA (Codice identico a prima) ===
  currencySearchInput.addEventListener('focus', () => {
    renderCurrencyList('');
    showDropdown();
  });

  currencySearchInput.addEventListener('input', () => {
    const term = currencySearchInput.value.trim();
    renderCurrencyList(term);
    showDropdown();
    currencyCodeInput.value = '';
  });

  document.addEventListener('click', (event) => {
    const isClickInside =
      currencySearchInput.contains(event.target) ||
      currencyDropdown.contains(event.target);

    if (!isClickInside) {
      hideDropdown();
    }
  });

  function renderCurrencyList(filterText) {
    const term = filterText.toLowerCase();
    const filtered = CURRENCIES.filter((c) => {
      if (!term) return true;
      return (
        c.code.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term)
      );
    });

    if (filtered.length === 0) {
      currencyDropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">Nessun risultato</div>';
      return;
    }

    currencyDropdown.innerHTML = '';
    filtered.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-sky-50 text-left';
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-lg">${c.flag}</span>
          <span>${c.name}</span>
        </div>
        <span class="text-xs text-gray-500 font-mono font-bold">${c.code}</span>
      `;
      btn.addEventListener('click', () => {
        currencySearchInput.value = `${c.flag} ${c.code} - ${c.name}`;
        currencyCodeInput.value = c.code;
        hideDropdown();
      });
      currencyDropdown.appendChild(btn);
    });
  }

  function showDropdown() { currencyDropdown.classList.remove('hidden'); }
  function hideDropdown() { currencyDropdown.classList.add('hidden'); }


  // === SUBMIT FORM ===
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const name = document.getElementById('name').value.trim();
    
    // Recuperiamo i valori direttamente da Flatpickr o dagli input (sono sincronizzati)
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    const homeCurrencyCode = 'EUR'; 
    
    let travelCurrencyCode = currencyCodeInput.value;
    if (!travelCurrencyCode && currencySearchInput.value.length === 3) {
        travelCurrencyCode = currencySearchInput.value.toUpperCase();
    }

    if (!name || !startDate || !endDate || !travelCurrencyCode) {
      showError('Compila tutti i campi obbligatori.');
      return;
    }

    // Flatpickr gestisce già il controllo date, ma un check extra non fa male
    if (new Date(startDate) > new Date(endDate)) {
      showError('La data di fine non valida.');
      return;
    }

    const requestBody = {
      name: name,
      countryCode: "NA",
      homeCurrencyCode: homeCurrencyCode,
      travelCurrencyCode: travelCurrencyCode,
      startDate: new Date(startDate).toISOString(), 
      endDate: new Date(endDate).toISOString()
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let message = 'Errore creazione viaggio.';
        try {
          const errorData = await response.json();
          if (errorData.errors) message = Object.values(errorData.errors).flat().join(", ");
          else if (errorData.title) message = errorData.title;
        } catch {}
        showError(message);
        return;
      }

      window.location.href = '/index.html';
      
    } catch (err) {
      console.error(err);
      showError('Errore di connessione.');
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }
});