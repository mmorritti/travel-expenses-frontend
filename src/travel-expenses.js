import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const travelId = params.get("travelId");

  if (!travelId) {
    const content = document.getElementById("tab-content");
    if (content) content.innerHTML = "<p class='text-center mt-10 text-gray-500'>Errore: viaggio non trovato.</p>";
    return;
  }

  // --- RIFERIMENTI DOM ---
  const backBtn = document.getElementById("back-btn");
  const travelNameEl = document.getElementById("travel-name");
  const travelDatesEl = document.getElementById("travel-dates");
  const tabContentEl = document.getElementById("tab-content");
  const navButtons = document.querySelectorAll(".nav-btn");

  // Elementi Header per i Totali
  const headerTotalSection = document.getElementById("header-total-section");
  const headerAmountEl = document.getElementById("header-total-amount");
  const headerCurrencyEl = document.getElementById("header-total-currency");
  const headerConvertedBox = document.getElementById("header-converted-box");
  const headerTotalHomeEl = document.getElementById("header-total-home");

  // --- STATO ---
  let currentExchangeRate = null; 
  let mainTravelCurrency = "";
  let editingExpenseId = null; 

  // --- 1. SETUP NAVIGAZIONE ---
  if (backBtn) {
    backBtn.addEventListener("click", () => window.location.href = "/index.html");
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });

  // --- 2. GESTIONE TAB ---
  async function renderTab(tab) {
    if (tab === "add") {
      editingExpenseId = null; 
      await renderAddExpense();
    } else if (tab === "list") {
      await renderExpensesList();
    } else if (tab === "chart") {
       tabContentEl.innerHTML = `<p class="text-center mt-10 text-gray-500 font-medium">Grafici in arrivo...</p>`;
    }
  }

  // --- 3. CARICAMENTO DATI VIAGGIO E TASSI ---
  async function loadTravelHeader() {
    try {
      const res = await fetch(`${API_BASE_URL}/Travels/${travelId}`);
      if (!res.ok) throw new Error("Errore caricamento viaggio");
      const trip = await res.json();

      travelNameEl.textContent = trip.name;
      
      // --- FIX DATE: Logica reinserita ---
      if (travelDatesEl) {
        if (trip.startDate && trip.endDate) {
            const start = new Date(trip.startDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short' });
            const end = new Date(trip.endDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year:'numeric' });
            travelDatesEl.textContent = `${start} - ${end}`;
        } else {
            travelDatesEl.textContent = ""; 
        }
      }

      // --- LOGICA TASSI ---
      mainTravelCurrency = trip.travelCurrencyCode || trip.TravelCurrencyCode || "EUR";
      currentExchangeRate = null;
      const rates = trip.travelCurrencyRates || trip.TravelCurrencyRates;
      
      if (rates && rates.length > 0) {
        const rateEntry = rates.find(r => {
          const from = r.fromCurrency || r.FromCurrency;
          return from === mainTravelCurrency;
        });
        if (rateEntry) {
           const val = rateEntry.rate !== undefined ? rateEntry.rate : rateEntry.Rate;
           if (val > 0) currentExchangeRate = val;
        }
      }

      if (!currentExchangeRate || currentExchangeRate === 0) {
        const fallbacks = { "USD": 0.95, "JPY": 0.00612, "MAD": 0.093, "GBP": 1.20 };
        currentExchangeRate = fallbacks[mainTravelCurrency] || 1;
      }

      renderExpensesList();
    } catch (err) {
      console.error(err);
    }
  }

  // --- 4. LISTA SPESE (Aggiornata con Data Completa e Icona Categoria) ---
  async function renderExpensesList() {
    editingExpenseId = null;

    tabContentEl.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin h-8 w-8 border-b-2 border-sky-500 rounded-full"></div></div>`;
    
    try {
      // 1. Scarichiamo SPESE e CATEGORIE insieme (per avere le icone)
      const [expRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`),
        fetch(`${API_BASE_URL}/Categories`)
      ]);

      const expenses = await expRes.json();
      const categories = await catRes.json();

      // Mappiamo le categorie per ID per trovare l'icona velocemente: { 'guid-id': '🍔', ... }
      const categoryMap = {};
      categories.forEach(c => {
        const id = c.categoryId || c.id;
        categoryMap[id] = c.icon || '🛒';
      });

      tabContentEl.innerHTML = '';
      let totalNormalized = 0;

      if (expenses.length > 0) {
        const listContainer = document.createElement("div");
        listContainer.className = "flex flex-col gap-3 pb-24";

        expenses.forEach((e) => {
          const currentId = e.expanseId; 
          const amt = e.amount;
          const curr = e.currencyCode;
          let amountInMainCurrency = amt;
          let subText = "";

          // Conversione
          if (curr === "EUR" && mainTravelCurrency !== "EUR" && currentExchangeRate) {
            amountInMainCurrency = amt / currentExchangeRate;
            subText = `≈ ${amountInMainCurrency.toFixed(2)} ${mainTravelCurrency}`;
          } else if (curr === mainTravelCurrency && mainTravelCurrency !== "EUR" && currentExchangeRate) {
            const valInEur = amt * currentExchangeRate;
            subText = `≈ ${valInEur.toFixed(2)} EUR`;
          }
          totalNormalized += amountInMainCurrency;

          // --- FORMATTAZIONE DATA (Giorno e Mese) ---
          const dateObj = new Date(e.expanseDate);
          const day = dateObj.getDate(); // es. 15
          // Ottiene mese abbreviato in italiano (es. "dic") e lo rende maiuscolo
          const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();

          // --- RECUPERO ICONA ---
          const icon = categoryMap[e.categoryId] || '🧾';

          // --- CREAZIONE CARD ---
          const card = document.createElement("div");
          card.className = "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex transition group";
          
          card.innerHTML = `
            <div class="edit-area flex-grow p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                <div class="flex items-center gap-4">
                  
                  <div class="bg-gray-50 rounded-lg w-12 h-12 flex flex-col items-center justify-center text-sky-600 border border-gray-100 shrink-0 leading-none">
                    <span class="text-lg font-bold">${day}</span>
                    <span class="text-[9px] font-bold uppercase mt-[2px]">${month}</span>
                  </div>

                  <div class="overflow-hidden">
                    <h3 class="font-bold text-gray-800 truncate text-base">
                        <span class="mr-1">${icon}</span> ${e.name}
                    </h3>
                    <p class="text-xs text-gray-500 truncate">${e.description || ""}</p>
                  </div>
                </div>
                
                <div class="text-right pl-2 shrink-0">
                  <span class="block font-bold text-gray-900 text-lg whitespace-nowrap">${amt.toFixed(2)} <span class="text-sm">${curr}</span></span>
                  <span class="block text-[10px] text-gray-400 font-medium whitespace-nowrap">${subText}</span>
                </div>
            </div>

            <div class="w-[1px] bg-gray-100 my-2"></div>

            <button class="delete-btn w-14 flex items-center justify-center !bg-transparent !border-0 !shadow-none hover:!bg-transparent focus:outline-none cursor-pointer shrink-0 group" title="Elimina">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-red-500 transition-transform duration-200 transform group-hover:scale-125">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
            </button>
          `;

          // Eventi
          const deleteBtn = card.querySelector(".delete-btn");
          deleteBtn.addEventListener("click", async (ev) => {
            ev.stopPropagation(); 
            if(confirm("Eliminare questa spesa?")) {
               await deleteExpense(currentId);
            }
          });

          const editArea = card.querySelector(".edit-area");
          editArea.addEventListener("click", () => {
             openEditForm(e);
          });

          listContainer.appendChild(card);
        });

        tabContentEl.appendChild(listContainer);

        // Aggiorna totali header
        headerAmountEl.textContent = totalNormalized.toFixed(2);
        headerCurrencyEl.textContent = mainTravelCurrency;
        headerTotalSection.classList.remove("hidden");
        
        if (currentExchangeRate && mainTravelCurrency !== "EUR") {
           headerTotalHomeEl.textContent = (totalNormalized * currentExchangeRate).toFixed(2);
           headerConvertedBox.classList.remove("hidden");
        }

      } else {
        headerAmountEl.textContent = "0.00";
        tabContentEl.innerHTML = `<div class="text-center mt-10 opacity-60">Nessuna spesa registrata.</div>`;
      }
    } catch (err) { console.error(err); }
  }

  // --- 5. LOGICA API DELETE ---
  async function deleteExpense(id) {
    if(!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/Expanses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        renderExpensesList();
      } else {
        alert("Errore eliminazione");
      }
    } catch (err) { console.error(err); }
  }

  // --- 6. PREPARAZIONE FORM MODIFICA ---
  async function openEditForm(expense) {
    editingExpenseId = expense.expanseId; 
    
    navButtons.forEach((b) => b.classList.remove("active"));
    document.querySelector('[data-tab="add"]').classList.add("active");

    await renderAddExpense(expense); 
  }

  // --- 7. FORM DINAMICO ---
  async function renderAddExpense(expenseToEdit = null) {
    tabContentEl.innerHTML = `<div class="p-10 text-center animate-pulse">Caricamento modulo...</div>`;
    
    try {
      const [catRes, travelRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Categories`),
        fetch(`${API_BASE_URL}/Travels/${travelId}`)
      ]);
      const categories = await catRes.json();
      const travel = await travelRes.json();

      const title = expenseToEdit ? "Modifica Spesa" : "Nuova Spesa";
      const btnText = expenseToEdit ? "Aggiorna Spesa" : "Salva Spesa";

      const defName = expenseToEdit ? expenseToEdit.name : "";
      const defAmount = expenseToEdit ? expenseToEdit.amount : "";
      const defCatId = expenseToEdit ? expenseToEdit.categoryId : "";
      const defCurr = expenseToEdit ? expenseToEdit.currencyCode : travel.travelCurrencyCode;

      tabContentEl.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-20">
          <h2 class="text-xl font-bold mb-6 text-gray-800">${title}</h2>
          <form id="expense-form" class="flex flex-col gap-5">
            
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cosa hai comprato?</label>
              <input name="name" value="${defName}" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400" required />
            </div>

            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Importo</label>
                <input type="number" step="0.01" name="amount" value="${defAmount}" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-lg" required />
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Valuta</label>
                <select name="currencyCode" class="w-full bg-white border border-gray-200 rounded-xl px-2 py-3 font-bold h-[52px]">
                  <option value="${travel.travelCurrencyCode}" ${defCurr === travel.travelCurrencyCode ? 'selected' : ''}>${travel.travelCurrencyCode}</option>
                  <option value="${travel.homeCurrencyCode}" ${defCurr === travel.homeCurrencyCode ? 'selected' : ''}>${travel.homeCurrencyCode}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
              <select name="categoryId" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3" required>
                <option value="" disabled ${!defCatId ? 'selected' : ''}>Seleziona...</option>
                ${categories.map(c => `
                    <option value="${c.categoryId || c.id}" ${defCatId === (c.categoryId || c.id) ? 'selected' : ''}>
                        ${c.icon || ''} ${c.name}
                    </option>`).join('')}
              </select>
            </div>

            <button type="submit" class="bg-sky-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 active:scale-95 transition">${btnText}</button>
            
            ${expenseToEdit ? `<button type="button" id="cancel-edit" class="text-gray-400 text-sm underline mt-2 w-full text-center">Annulla modifica</button>` : ''}
          </form>
        </div>`;

      document.getElementById("expense-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const payload = {
          travelId,
          categoryId: fd.get("categoryId"),
          expanseDate: new Date().toISOString(),
          name: fd.get("name"),
          amount: Number(fd.get("amount")),
          currencyCode: fd.get("currencyCode"),
          description: ""
        };

        let url = `${API_BASE_URL}/Expanses`;
        let method = "POST";

        if (editingExpenseId) {
            method = "PUT";
            url = `${API_BASE_URL}/Expanses/${editingExpenseId}`; 
            payload.expanseId = editingExpenseId;
        }

        const res = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          editingExpenseId = null; 
          document.querySelector('[data-tab="list"]').click(); 
        } else {
            console.error(await res.text());
            alert("Errore nel salvataggio");
        }
      });

      const cancelBtn = document.getElementById("cancel-edit");
      if(cancelBtn) {
          cancelBtn.addEventListener("click", () => {
              editingExpenseId = null;
              document.querySelector('[data-tab="list"]').click();
          });
      }

    } catch (err) { console.error(err); }
  }

  loadTravelHeader();
});