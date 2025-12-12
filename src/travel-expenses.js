import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const travelId = params.get("travelId");

  if (!travelId) {
    document.getElementById("tab-content").innerHTML =
      "<p class='text-center mt-10 text-gray-500'>Errore: viaggio non trovato.</p>";
    return;
  }

  const backBtn = document.getElementById("back-btn");
  const travelNameEl = document.getElementById("travel-name");
  const travelDatesEl = document.getElementById("travel-dates");
  const tabContentEl = document.getElementById("tab-content");
  const navButtons = document.querySelectorAll(".nav-btn");

  // Riferimenti Header per i totali
  const headerTotalSection = document.getElementById("header-total-section");
  const headerAmountEl = document.getElementById("header-total-amount");
  const headerCurrencyEl = document.getElementById("header-total-currency");
  const headerConvertedBox = document.getElementById("header-converted-box");
  const headerTotalHomeEl = document.getElementById("header-total-home");

  let currentExchangeRate = null; 
  let mainTravelCurrency = "";

  backBtn.addEventListener("click", () => {
    window.location.href = "/index.html";
  });

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });

  loadTravelHeader();
  
  const startTab = document.querySelector('[data-tab="list"]');
  if(startTab) startTab.classList.add("active");

  async function loadTravelHeader() {
    try {
      const res = await fetch(`${API_BASE_URL}/Travels/${travelId}`);
      if (!res.ok) throw new Error("Errore viaggio");
      const trip = await res.json();

      travelNameEl.textContent = trip.name;
      mainTravelCurrency = trip.travelCurrencyCode || "MAD";

      if (trip.startDate && trip.endDate) {
        const start = new Date(trip.startDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short' });
        const end = new Date(trip.endDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year: '2-digit' });
        travelDatesEl.textContent = `${start} - ${end}`;
      }

      /** * NOTA: Il tuo TravelDto attuale NON include i tassi. 
       * Usiamo il valore di fallback dal tuo ExchangeRateService (MAD -> EUR = 0.093).
       */
      if (mainTravelCurrency === "MAD") {
          currentExchangeRate = 0.093; 
      }

      renderExpensesList();
    } catch (err) {
      console.error(err);
    }
  }

  async function renderTab(tab) {
    if (tab === "list") return renderExpensesList();
    if (tab === "add") return renderAddExpense();
  }

  async function renderExpensesList() {
    tabContentEl.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div></div>`;

    try {
      const res = await fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`);
      const expenses = await res.json();
      tabContentEl.innerHTML = '';

      let totalInTravelCurrency = 0;

      if (expenses.length > 0) {
        let html = `<div class="flex flex-col gap-3 pb-24">`;
        
        expenses.forEach((e) => {
          const amt = e.amount;
          const curr = e.currencyCode;
          
          let amountConvertedToTravel = amt;
          let subText = "";

          // LOGICA DI CONVERSIONE RIGA PER RIGA
          if (curr === "EUR" && mainTravelCurrency !== "EUR" && currentExchangeRate) {
              // Se la spesa è in EUR, la convertiamo in valuta locale (es. MAD) per il totale
              // Se 1 MAD = 0.093 EUR, allora 1 EUR = 1 / 0.093 MAD
              amountConvertedToTravel = amt / currentExchangeRate;
              subText = `≈ ${amountConvertedToTravel.toFixed(2)} ${mainTravelCurrency}`;
          } else if (curr === mainTravelCurrency && mainTravelCurrency !== "EUR" && currentExchangeRate) {
              // Se la spesa è in MAD, mostriamo il valore in EUR in piccolo
              const amtInEur = amt * currentExchangeRate;
              subText = `≈ ${amtInEur.toFixed(2)} EUR`;
          }

          totalInTravelCurrency += amountConvertedToTravel;

          const dateObj = new Date(e.expanseDate);
          const day = dateObj.toLocaleDateString("it-IT", { day: '2-digit' });
          const month = dateObj.toLocaleDateString("it-IT", { month: 'short' });

          html += `
            <div class="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-50">
              <div class="flex items-center gap-4">
                <div class="bg-gray-50 rounded-lg w-12 h-12 flex flex-col items-center justify-center flex-shrink-0 text-gray-500 border border-gray-100">
                  <span class="text-[10px] font-bold uppercase leading-none opacity-70">${month}</span>
                  <span class="text-lg font-bold leading-none text-sky-600">${day}</span>
                </div>
                <div>
                  <h3 class="font-bold text-gray-800 text-base leading-snug">
                     ${e.name}
                  </h3>
                  <p class="text-xs text-gray-500 mt-0.5">${e.description || ""}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="block font-bold text-gray-900 text-lg">${amt.toFixed(2)} ${curr}</span>
                <span class="block text-[10px] text-gray-400 font-medium">${subText}</span>
              </div>
            </div>`;
        });

        html += `</div>`;
        tabContentEl.innerHTML = html;

        // AGGIORNAMENTO HEADER: Totale normalizzato in valuta locale
        headerAmountEl.textContent = totalInTravelCurrency.toFixed(2);
        headerCurrencyEl.textContent = mainTravelCurrency;
        headerTotalSection.classList.remove("hidden");

        // Conversione complessiva in Euro nell'header
        if (currentExchangeRate && mainTravelCurrency !== "EUR") {
            const totalInEuro = totalInTravelCurrency * currentExchangeRate;
            headerTotalHomeEl.textContent = totalInEuro.toFixed(2);
            headerConvertedBox.classList.remove("hidden");
        }
      } else {
        headerAmountEl.textContent = "0.00";
        headerTotalSection.classList.remove("hidden");
        tabContentEl.innerHTML = `<div class="text-center mt-10 opacity-60">Nessuna spesa.</div>`;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- Funzione Aggiunta Spesa (Invariata) ---
  async function renderAddExpense() {
    // ... (Logica renderAddExpense già esistente)
  }
});