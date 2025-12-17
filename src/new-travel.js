import { API_BASE_URL } from "./config.js";

const API_URL = `${API_BASE_URL}/Travels`;

const CURRENCIES = [
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Sterlina britannica', flag: '🇬🇧' },
  { code: 'CHF', name: 'Franco svizzero', flag: '🇨🇭' },
  { code: 'USD', name: 'Dollaro statunitense', flag: '🇺🇸' },
  { code: 'JPY', name: 'Yen giapponese', flag: '🇯🇵' },
  { code: 'MAD', name: 'Dirham Marocchino', flag: '🇲🇦' },
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

  const goHome = () => window.location.href = '/index.html';
  if(backBtn) backBtn.addEventListener('click', goHome);
  if(cancelBtn) cancelBtn.addEventListener('click', goHome);

  // === 📅 INIZIALIZZAZIONE CALENDARI (Corretta per non scrivere) ===
  
  // 1. Data Fine
  const endDatePicker = flatpickr("#endDate", {
    locale: "it",
    dateFormat: "Y-m-d",   
    altInput: true,        
    altFormat: "j M Y",    
    minDate: "today",
    disableMobile: true,    // IMPORTANTE: Forza l'uso di flatpickr anche su mobile
    allowInput: false,      // IMPORTANTE: Impedisce la scrittura manuale
    clickOpens: true
  });

  // 2. Data Inizio
  const startDatePicker = flatpickr("#startDate", {
    locale: "it",
    dateFormat: "Y-m-d",   
    altInput: true,        
    altFormat: "j M Y",    
    minDate: "today",
    disableMobile: true,    // IMPORTANTE
    allowInput: false,      // IMPORTANTE
    clickOpens: true,
    onChange: function(selectedDates, dateStr, instance) {
        endDatePicker.set('minDate', dateStr);
        const endDateVal = endDatePicker.selectedDates[0];
        if (endDateVal && endDateVal < selectedDates[0]) {
            endDatePicker.clear();
        }
        setTimeout(() => endDatePicker.open(), 100); 
    }
  });


  // === LIVE SEARCH VALUTA ===
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

  // === SUBMIT ===
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const name = document.getElementById('name').value.trim();
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