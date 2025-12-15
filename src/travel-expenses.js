import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const travelId = params.get("travelId");

  if (!travelId) {
    const content = document.getElementById("tab-content");
    if (content) content.innerHTML = "<p class='text-center mt-10 text-gray-500'>Errore: viaggio non trovato.</p>";
    return;
  }

  const backBtn = document.getElementById("back-btn");
  const travelNameEl = document.getElementById("travel-name");
  const travelDatesEl = document.getElementById("travel-dates");
  const tabContentEl = document.getElementById("tab-content");
  const navButtons = document.querySelectorAll(".nav-btn");

  // Elementi Header per i totali
  const headerTotalSection = document.getElementById("header-total-section");
  const headerAmountEl = document.getElementById("header-total-amount");
  const headerCurrencyEl = document.getElementById("header-total-currency");
  const headerConvertedBox = document.getElementById("header-converted-box");
  const headerTotalHomeEl = document.getElementById("header-total-home");

  let currentExchangeRate = 0.093; // Tasso MAD -> EUR da ExchangeRateService
  let mainTravelCurrency = "";

  // 1. TASTO INDIETRO (RIPRISTINATO)
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/index.html";
    });
  }

  // 2. NAVIGAZIONE TAB
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });

  async function renderTab(tab) {
    if (tab === "add") {
      renderAddExpense();
    } else if (tab === "list") {
      renderExpensesList();
    } else {
      tabContentEl.innerHTML = `<p class="text-center mt-10 text-gray-500 font-medium italic">Sezione ${tab} in arrivo...</p>`;
    }
  }

  // 3. CARICAMENTO HEADER
async function loadTravelHeader() {
  try {
    const res = await fetch(`${API_BASE_URL}/Travels/${travelId}`);
    if (!res.ok) throw new Error("Errore caricamento viaggio");
    const trip = await res.json();

    console.log("Dati viaggio ricevuti:", trip); // <--- CONTROLLA QUESTO IN CONSOLE

    travelNameEl.textContent = trip.name;
    // Gestiamo sia travelCurrencyCode che TravelCurrencyCode
    mainTravelCurrency = trip.travelCurrencyCode || trip.TravelCurrencyCode || "EUR";

    currentExchangeRate = null;

    // Recupero del tasso dal database
    // Verifichiamo sia travelCurrencyRates che TravelCurrencyRates
    const rates = trip.travelCurrencyRates || trip.TravelCurrencyRates;
    
    if (rates && rates.length > 0) {
      // Cerchiamo il tasso che ha come FromCurrency la valuta del viaggio
      const rateEntry = rates.find(r => {
        const from = r.fromCurrency || r.FromCurrency;
        return from === mainTravelCurrency;
      });

      if (rateEntry) {
        // Prendiamo il valore Rate o rate
        currentExchangeRate = rateEntry.rate !== undefined ? rateEntry.rate : rateEntry.Rate;
        console.log(`Tasso trovato per ${mainTravelCurrency}:`, currentExchangeRate);
      }
    }

    // Se il tasso è ancora nullo o 0 (nonostante il DB dica 0.95), forziamo il fallback
    if (!currentExchangeRate || currentExchangeRate === 0) {
      const fallbacks = { "USD": 0.95, "JPY": 0.00612, "MAD": 0.093, "GBP": 1.20 };
      currentExchangeRate = fallbacks[mainTravelCurrency] || 1;
      console.warn("Usato fallback manuale perché il tasso dal DB era:", currentExchangeRate);
    }

    renderExpensesList();
  } catch (err) {
    console.error("Errore in loadTravelHeader:", err);
  }
}


  // 4. LISTA SPESE CON CONVERSIONI E TOTALI
  async function renderExpensesList() {
    tabContentEl.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin h-8 w-8 border-b-2 border-sky-500 rounded-full"></div></div>`;
    try {
      const res = await fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`);
      const expenses = await res.json();
      tabContentEl.innerHTML = '';

      let totalNormalized = 0;

      if (expenses.length > 0) {
        let html = `<div class="flex flex-col gap-3 pb-24">`;
        expenses.forEach((e) => {
          const amt = e.amount;
          const curr = e.currencyCode;
          let amountInMainCurrency = amt;
          let subText = "";

          // Conversione riga per riga
          if (curr === "EUR" && mainTravelCurrency !== "EUR") {
            amountInMainCurrency = amt / currentExchangeRate;
            subText = `≈ ${amountInMainCurrency.toFixed(2)} ${mainTravelCurrency}`;
          } else if (curr === mainTravelCurrency && mainTravelCurrency !== "EUR") {
            subText = `≈ ${(amt * currentExchangeRate).toFixed(2)} EUR`;
          }

          totalNormalized += amountInMainCurrency;

          html += `
            <div class="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-50">
              <div class="flex items-center gap-4">
                <div class="bg-gray-50 rounded-lg w-12 h-12 flex flex-col items-center justify-center font-bold text-sky-600 border border-gray-100">
                  ${new Date(e.expanseDate).getDate()}
                </div>
                <div>
                  <h3 class="font-bold text-gray-800">${e.name}</h3>
                  <p class="text-xs text-gray-500">${e.description || ""}</p>
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
        
        // Update Header Totals
        headerAmountEl.textContent = totalNormalized.toFixed(2);
        headerCurrencyEl.textContent = mainTravelCurrency;
        headerTotalSection.classList.remove("hidden");

        if (mainTravelCurrency !== "EUR") {
          headerTotalHomeEl.textContent = (totalNormalized * currentExchangeRate).toFixed(2);
          headerConvertedBox.classList.remove("hidden");
        }
      } else {
        headerAmountEl.textContent = "0.00";
        headerTotalSection.classList.remove("hidden");
        tabContentEl.innerHTML = `<div class="text-center mt-10 opacity-60">Nessuna spesa.</div>`;
      }
    } catch (err) { console.error(err); }
  }

  // 5. FORM NUOVA SPESA
  async function renderAddExpense() {
    tabContentEl.innerHTML = `<div class="p-10 text-center animate-pulse">Caricamento modulo...</div>`;
    try {
      const [catRes, travelRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Categories`),
        fetch(`${API_BASE_URL}/Travels/${travelId}`)
      ]);
      const categories = await catRes.json();
      const travel = await travelRes.json();

      tabContentEl.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-20">
          <h2 class="text-xl font-bold mb-6 text-gray-800">Nuova Spesa</h2>
          <form id="add-expense-form" class="flex flex-col gap-5">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cosa hai comprato?</label>
              <input name="name" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400" required />
            </div>
            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Importo</label>
                <input type="number" step="0.01" name="amount" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-lg" required />
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Valuta</label>
                <select name="currencyCode" class="w-full bg-white border border-gray-200 rounded-xl px-2 py-3 font-bold h-[52px]">
                  <option value="${travel.travelCurrencyCode}">${travel.travelCurrencyCode}</option>
                  <option value="${travel.homeCurrencyCode}">${travel.homeCurrencyCode}</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
              <select name="categoryId" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3" required>
                <option value="" disabled selected>Seleziona...</option>
                ${categories.map(c => `<option value="${c.categoryId || c.id}">${c.icon || ''} ${c.name}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="bg-sky-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 active:scale-95 transition">Salva Spesa</button>
          </form>
        </div>`;

      document.getElementById("add-expense-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = {
          travelId,
          categoryId: fd.get("categoryId"),
          expanseDate: new Date().toISOString(),
          name: fd.get("name"),
          amount: Number(fd.get("amount")),
          currencyCode: fd.get("currencyCode")
        };

        const postRes = await fetch(`${API_BASE_URL}/Expanses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (postRes.ok) {
          document.querySelector('[data-tab="list"]').click(); 
        }
      });
    } catch (err) { console.error(err); }
  }

  loadTravelHeader();
});