import { API_BASE_URL } from "./config.js";


const API_URL = `${API_BASE_URL}/Travels`;


// Valute turistiche principali con bandierina emoji
const CURRENCIES = [
  // EUROPA
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'Sterlina britannica', flag: '🇬🇧' },
  { code: 'CHF', name: 'Franco svizzero', flag: '🇨🇭' },
  { code: 'DKK', name: 'Corona danese', flag: '🇩🇰' },
  { code: 'SEK', name: 'Corona svedese', flag: '🇸🇪' },
  { code: 'NOK', name: 'Corona norvegese', flag: '🇳🇴' },
  { code: 'PLN', name: 'Zloty polacco', flag: '🇵🇱' },
  { code: 'CZK', name: 'Corona ceca', flag: '🇨🇿' },
  { code: 'HUF', name: 'Fiorino ungherese', flag: '🇭🇺' },
  { code: 'RON', name: 'Leu rumeno', flag: '🇷🇴' },

  // AMERICHE
  { code: 'USD', name: 'Dollaro statunitense', flag: '🇺🇸' },
  { code: 'CAD', name: 'Dollaro canadese', flag: '🇨🇦' },
  { code: 'MXN', name: 'Peso messicano', flag: '🇲🇽' },
  { code: 'BRL', name: 'Real brasiliano', flag: '🇧🇷' },
  { code: 'ARS', name: 'Peso argentino', flag: '🇦🇷' },
  { code: 'CLP', name: 'Peso cileno', flag: '🇨🇱' },

  // AFRICA / MEDIO ORIENTE
  { code: 'MAD', name: 'Dirham marocchino', flag: '🇲🇦' },
  { code: 'EGP', name: 'Sterlina egiziana', flag: '🇪🇬' },
  { code: 'TND', name: 'Dinaro tunisino', flag: '🇹🇳' },
  { code: 'ZAR', name: 'Rand sudafricano', flag: '🇿🇦' },
  { code: 'AED', name: 'Dirham EAU', flag: '🇦🇪' },
  { code: 'SAR', name: 'Riyal saudita', flag: '🇸🇦' },
  { code: 'TRY', name: 'Lira turca', flag: '🇹🇷' },

  // ASIA / OCEANIA
  { code: 'JPY', name: 'Yen giapponese', flag: '🇯🇵' },
  { code: 'CNY', name: 'Yuan cinese', flag: '🇨🇳' },
  { code: 'HKD', name: 'Dollaro di Hong Kong', flag: '🇭🇰' },
  { code: 'SGD', name: 'Dollaro di Singapore', flag: '🇸🇬' },
  { code: 'THB', name: 'Baht thailandese', flag: '🇹🇭' },
  { code: 'IDR', name: 'Rupia indonesiana', flag: '🇮🇩' },
  { code: 'MYR', name: 'Ringgit malese', flag: '🇲🇾' },
  { code: 'VND', name: 'Dong vietnamita', flag: '🇻🇳' },
  { code: 'AUD', name: 'Dollaro australiano', flag: '🇦🇺' },
  { code: 'NZD', name: 'Dollaro neozelandese', flag: '🇳🇿' }
];

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('travel-form');
  const errorBox = document.getElementById('error-box');
  const backBtn = document.getElementById('back-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  const currencySearchInput = document.getElementById('travelCurrencySearch');
  const currencyCodeInput = document.getElementById('travelCurrencyCode');
  const currencyDropdown = document.getElementById('travelCurrencyDropdown');

  backBtn.addEventListener('click', () => {
    window.history.back();
  });

  cancelBtn.addEventListener('click', () => {
    window.history.back();
  });

  // === LIVE SEARCH VALUTA ===

  // mostra lista completa al focus
  currencySearchInput.addEventListener('focus', () => {
    renderCurrencyList('');
    showDropdown();
  });

  // filtra mentre digiti
  currencySearchInput.addEventListener('input', () => {
    const term = currencySearchInput.value.trim();
    renderCurrencyList(term);
    showDropdown();
    // azzero la selezione finché non scelgo
    currencyCodeInput.value = '';
  });

  // chiudi dropdown cliccando fuori
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
      currencyDropdown.innerHTML =
        '<div class="px-3 py-2 text-sm text-gray-500">Nessun risultato</div>';
      return;
    }

    currencyDropdown.innerHTML = '';

    filtered.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-sky-50';
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-lg">${c.flag}</span>
          <span>${c.name}</span>
        </div>
        <span class="text-xs text-gray-500 font-mono">${c.code}</span>
      `;

      btn.addEventListener('click', () => {
        currencySearchInput.value = `${c.flag} ${c.code} - ${c.name}`;
        currencyCodeInput.value = c.code;
        hideDropdown();
      });

      currencyDropdown.appendChild(btn);
    });
  }

  function showDropdown() {
    currencyDropdown.classList.remove('hidden');
  }

  function hideDropdown() {
    currencyDropdown.classList.add('hidden');
  }

  // === SUBMIT FORM ===
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const name = document.getElementById('name').value.trim();
    const countryCode = document.getElementById('countryCode').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const homeCurrencyCode = 'EUR'; // fisso per ora
    const travelCurrencyCode = currencyCodeInput.value; // viene dal live search

    // Validazione base lato client
    if (!name || !startDate || !endDate || !travelCurrencyCode) {
      showError(
        'Compila tutti i campi obbligatori e seleziona una valuta del viaggio.'
      );
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showError('La data di inizio non può essere successiva alla data di fine.');
      return;
    }

    const requestBody = {
      name: name,
      countryCode: countryCode || null,
      homeCurrencyCode: homeCurrencyCode,
      travelCurrencyCode: travelCurrencyCode,
      startDate: startDate, // "YYYY-MM-DD"
      endDate: endDate
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let message = 'Errore nella creazione del viaggio.';
        try {
          const errorData = await response.json();
          if (errorData && errorData.title) {
            message = errorData.title;
          }
        } catch {
          // ignore parse error
        }

        showError(message);
        return;
      }

      // al successo → torna alla home
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      showError(
        'Impossibile contattare il server. Controlla che le API siano avviate.'
      );
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
