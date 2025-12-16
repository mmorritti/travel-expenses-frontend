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
  const fabAddBtn = document.getElementById("fab-add-expense");

  // Elementi Header Totali
  const headerTotalSection = document.getElementById("header-total-section");
  const headerAmountEl = document.getElementById("header-total-amount");
  const headerCurrencyEl = document.getElementById("header-total-currency");
  const headerConvertedBox = document.getElementById("header-converted-box");
  const headerTotalHomeEl = document.getElementById("header-total-home");

  // --- STATO ---
  let currentExchangeRate = null; 
  let mainTravelCurrency = "";
  let editingExpenseId = null; 
  
  // STATO PER SWIPE
  let currentTab = "list"; // Teniamo traccia del tab attivo
  const tabOrder = ["list", "chart", "fx"]; // Ordine logico delle schermate

  // --- 1. SETUP NAVIGAZIONE ---
  if (backBtn) {
    backBtn.addEventListener("click", () => window.location.href = "/index.html");
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  if (fabAddBtn) {
    fabAddBtn.addEventListener("click", () => {
        switchTab("add");
    });
  }

  // Funzione Helper per cambiare tab e aggiornare UI
  function switchTab(newTab) {
    // Aggiorna variabile stato
    currentTab = newTab;

    // Aggiorna bottoni navbar (rimuove active da tutti, aggiunge a quello giusto)
    navButtons.forEach((b) => {
        b.classList.remove("active");
        if (b.dataset.tab === newTab) b.classList.add("active");
    });

    // Lancia render
    renderTab(newTab);
  }

  // --- 2. GESTIONE TAB ---
  async function renderTab(tab) {
    // Gestione visibilità FAB
    if (fabAddBtn) {
        if (tab === "add") fabAddBtn.classList.add("hidden");
        else fabAddBtn.classList.remove("hidden");
    }

    // Rimuovi vecchie classi di animazione per poterle riapplicare
    tabContentEl.classList.remove("animate-slide-right", "animate-slide-left", "animate-fade-in");
    
    // Piccola animazione fade di default
    void tabContentEl.offsetWidth; // Trigger reflow
    tabContentEl.classList.add("animate-fade-in");

    if (tab === "add") {
      editingExpenseId = null; 
      await renderAddExpense();
    } else if (tab === "list") {
      await renderExpensesList();
    } else if (tab === "chart") {
       await renderChart();
    } else if (tab === "fx") {
       renderFxPage(); // Nuova funzione placeholder
    }
  }

  // --- NUOVA: Placeholder per pagina FX ---
  function renderFxPage() {
      tabContentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center mt-20 opacity-60 text-center px-6">
            <span class="text-5xl mb-4">💱</span>
            <h3 class="text-xl font-bold text-gray-700">Calcolatrice Cambio</h3>
            <p class="mt-2 text-sm text-gray-500">Inserisci importo in valuta locale per vedere il corrispettivo in EUR.</p>
            <div class="mt-8 p-4 bg-sky-50 text-sky-700 rounded-xl w-full max-w-xs font-mono text-sm">
                In arrivo nel prossimo aggiornamento!
            </div>
        </div>`;
  }

  // --- 3. CARICAMENTO DATI ---
  async function loadTravelHeader() {
    try {
      const res = await fetch(`${API_BASE_URL}/Travels/${travelId}`);
      if (!res.ok) throw new Error("Errore caricamento viaggio");
      const trip = await res.json();

      travelNameEl.textContent = trip.name;
      if (travelDatesEl) {
        if (trip.startDate && trip.endDate) {
            const start = new Date(trip.startDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short' });
            const end = new Date(trip.endDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year:'numeric' });
            travelDatesEl.textContent = `${start} - ${end}`;
        } else {
            travelDatesEl.textContent = ""; 
        }
      }

      mainTravelCurrency = trip.travelCurrencyCode || "EUR";
      currentExchangeRate = null;
      const rates = trip.travelCurrencyRates;
      if (rates && rates.length > 0) {
        const rateEntry = rates.find(r => r.fromCurrency === mainTravelCurrency);
        if (rateEntry && rateEntry.rate > 0) currentExchangeRate = rateEntry.rate;
      }
      if (!currentExchangeRate) {
        const fallbacks = { "USD": 0.95, "JPY": 0.00612, "MAD": 0.093, "GBP": 1.20 };
        currentExchangeRate = fallbacks[mainTravelCurrency] || 1;
      }

      renderExpensesList();
    } catch (err) { console.error(err); }
  }

  // --- 4. LISTA SPESE (Ordinata per Data) ---
  async function renderExpensesList() {
    editingExpenseId = null;
    tabContentEl.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin h-8 w-8 border-b-2 border-sky-500 rounded-full"></div></div>`;
    
    try {
      const [expRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`),
        fetch(`${API_BASE_URL}/Categories`)
      ]);
      const expenses = await expRes.json();
      const categories = await catRes.json();

      const categoryMap = {};
      categories.forEach(c => {
        const id = c.categoryId || c.id;
        categoryMap[id] = c.icon || '🛒';
      });

      tabContentEl.innerHTML = '';
      let totalNormalized = 0;

      if (expenses.length > 0) {
        
        // --- NUOVO: ORDINAMENTO PER DATA (Dal più recente al più vecchio) ---
        expenses.sort((a, b) => new Date(b.expanseDate) - new Date(a.expanseDate));

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

          // Date Formatting
          const dateObj = new Date(e.expanseDate);
          const day = dateObj.getDate();
          const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();

          const icon = categoryMap[e.categoryId] || '🧾';

          // Card HTML
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

          // Eventi Card
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

  async function deleteExpense(id) {
    if(!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/Expanses/${id}`, { method: 'DELETE' });
      if (res.ok) renderExpensesList();
      else alert("Errore eliminazione");
    } catch (err) { console.error(err); }
  }

  async function openEditForm(expense) {
    editingExpenseId = expense.expanseId; 
    if (fabAddBtn) fabAddBtn.classList.add("hidden");
    // Simuliamo cambio tab senza triggerare navigazione swipe
    navButtons.forEach((b) => b.classList.remove("active"));
    currentTab = "add"; 
    await renderAddExpense(expense); 
  }

// --- 7. FORM DINAMICO (Aggiungi/Modifica con DATA) ---
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

      // Valori di Default
      const defName = expenseToEdit ? expenseToEdit.name : "";
      const defAmount = expenseToEdit ? expenseToEdit.amount : "";
      const defCatId = expenseToEdit ? expenseToEdit.categoryId : "";
      const defCurr = expenseToEdit ? expenseToEdit.currencyCode : travel.travelCurrencyCode;
      
      // Data di default
      const defDate = expenseToEdit ? expenseToEdit.expanseDate : new Date().toISOString();

      tabContentEl.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-20 animate-fade-in">
          <h2 class="text-xl font-bold mb-6 text-gray-800">${title}</h2>
          <form id="expense-form" class="flex flex-col gap-5">
            
            <div>
               <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
               <div class="relative">
                 <input id="expense-date" name="expanseDate" type="text" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer" placeholder="Seleziona data..." required />
                 <div class="absolute right-4 top-3.5 pointer-events-none text-gray-400">📅</div>
               </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cosa hai comprato?</label>
              <input name="name" value="${defName}" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800" placeholder="Es. Cena, Taxi..." required />
            </div>

            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Importo</label>
                <input type="number" step="0.01" name="amount" value="${defAmount}" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold text-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400" placeholder="0.00" required />
              </div>
              
              <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Valuta</label>
                <select name="currencyCode" class="w-full bg-white border border-gray-200 rounded-xl px-2 py-3 font-bold h-[54px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <option value="${travel.travelCurrencyCode}" ${defCurr === travel.travelCurrencyCode ? 'selected' : ''}>${travel.travelCurrencyCode}</option>
                  <option value="${travel.homeCurrencyCode}" ${defCurr === travel.homeCurrencyCode ? 'selected' : ''}>${travel.homeCurrencyCode}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
              <select name="categoryId" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400" required>
                <option value="" disabled ${!defCatId ? 'selected' : ''}>Seleziona...</option>
                ${categories.map(c => `
                    <option value="${c.categoryId || c.id}" ${defCatId === (c.categoryId || c.id) ? 'selected' : ''}>
                        ${c.icon || ''} ${c.name}
                    </option>`).join('')}
              </select>
            </div>

            <button type="submit" class="bg-sky-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 active:scale-95 transition hover:bg-sky-600">${btnText}</button>
            
            <button type="button" id="cancel-edit" class="bg-transparent border-0 text-gray-500 font-bold py-4 rounded-xl mt-2 hover:bg-gray-100 transition active:scale-95">Annulla</button>
          </form>
        </div>`;

      // INIZIALIZZAZIONE CALENDARIO
      flatpickr("#expense-date", {
         locale: "it",
         dateFormat: "Y-m-d",
         altInput: true,
         altFormat: "j F Y",
         defaultDate: defDate,
         disableMobile: "true",
         allowInput: true
      });

      // LOGICA SUBMIT
      document.getElementById("expense-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const dateStr = fd.get("expanseDate");

        const payload = {
          travelId,
          categoryId: fd.get("categoryId"),
          expanseDate: new Date(dateStr).toISOString(),
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
          const listTab = document.querySelector('[data-tab="list"]');
          if (listTab) listTab.click();
        } else {
            console.error(await res.text());
            alert("Errore nel salvataggio");
        }
      });

      // LOGICA ANNULLA
      const cancelBtn = document.getElementById("cancel-edit");
      if(cancelBtn) {
          cancelBtn.addEventListener("click", () => {
              editingExpenseId = null;
              const listTab = document.querySelector('[data-tab="list"]');
              if (listTab) listTab.click();
          });
      }

    } catch (err) { console.error(err); }
  }
  async function renderChart() {
    tabContentEl.innerHTML = `<div class="flex justify-center mt-10"><div class="animate-spin h-8 w-8 border-b-2 border-sky-500 rounded-full"></div></div>`;
    try {
      const [expRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`),
        fetch(`${API_BASE_URL}/Categories`)
      ]);
      const expenses = await expRes.json();
      const categories = await catRes.json();

      if (expenses.length === 0) {
        tabContentEl.innerHTML = `<div class="text-center mt-20 opacity-60"><div class="text-6xl">🍩</div><p>Nessun dato.</p></div>`;
        return;
      }

      const fixedColors = { "Cibo e bevande": "#f97316", "Trasporti locali": "#06b6d4", "Alloggio": "#8b5cf6", "Voli": "#1d4ed8", "Souvenir e shopping": "#ec4899", "Altro": "#9ca3af" };
      const fallbackPalette = ["#eab308", "#10b981", "#6366f1", "#f43f5e"];
      const catMap = {};
      let fallbackIndex = 0;
      categories.forEach(c => {
         const name = c.name || c.Name || "Unknown";
         let color = fixedColors[name] || fallbackPalette[fallbackIndex++ % fallbackPalette.length];
         catMap[c.categoryId || c.id] = { name, color, icon: c.icon || "📦" };
      });

      const groupedData = {};
      let total = 0;
      const safeRate = (currentExchangeRate > 0) ? currentExchangeRate : 1;
      
      expenses.forEach(e => {
         const cat = catMap[e.categoryId] || { name: "Altro", color: "#ccc", icon: "?" };
         let val = Number(e.amount) || 0;
         if (e.currencyCode === "EUR" && mainTravelCurrency !== "EUR") val /= safeRate;
         if (!groupedData[cat.name]) groupedData[cat.name] = { amount: 0, color: cat.color, icon: cat.icon };
         groupedData[cat.name].amount += val;
         total += val;
      });

      const labels = Object.keys(groupedData).sort((a,b) => groupedData[b].amount - groupedData[a].amount);
      const dataValues = labels.map(k => groupedData[k].amount);
      const colors = labels.map(k => groupedData[k].color);

      tabContentEl.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-24 border border-gray-100">
            <h2 class="text-lg font-bold text-center mb-6">Spese (${mainTravelCurrency})</h2>
            <div class="relative w-full max-w-[250px] mx-auto aspect-square mb-6">
                <canvas id="expenseChart"></canvas>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span class="text-xs text-gray-400 font-semibold uppercase">Totale</span>
                    <span class="text-xl font-black text-gray-800">${total.toLocaleString('it-IT', {maximumFractionDigits:0})}</span>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                ${labels.map(l => {
                    const item = groupedData[l];
                    const pct = total > 0 ? ((item.amount/total)*100).toFixed(1) : 0;
                    return `<div class="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                        <div class="flex items-center gap-2">
                            <span style="color:${item.color}">${item.icon}</span>
                            <span class="text-sm font-bold text-gray-700">${l}</span>
                        </div>
                        <div class="text-right">
                             <span class="block text-sm font-bold">${item.amount.toLocaleString('it-IT',{maximumFractionDigits:0})}</span>
                             <span class="text-[10px] text-gray-400">${pct}%</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;

      const ctx = document.getElementById('expenseChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: dataValues, backgroundColor: colors, borderWidth:0, cutout:'75%', borderRadius:15 }] },
        options: { responsive:true, plugins:{ legend:{display:false} } }
      });
    } catch (err) { console.error(err); }
  }

  // === 5. GESTIONE SWIPE (Touch & Mouse) ===
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  // Mouse e Touch Events
  const container = document.body; // Ascoltiamo su tutto il body per sicurezza

  // Touch Starts
  container.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
  }, {passive: true});

  // Mouse Down (per simulare swipe col mouse)
  container.addEventListener('mousedown', e => {
      touchStartX = e.screenX;
      touchStartY = e.screenY;
  });

  // Touch Ends
  container.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipeGesture();
  }, {passive: true});

  // Mouse Up
  container.addEventListener('mouseup', e => {
      touchEndX = e.screenX;
      touchEndY = e.screenY;
      handleSwipeGesture();
  });

  function handleSwipeGesture() {
      // 1. BLOCCHI ECCEZIONALI
      // Non swipare se siamo nel tab "add" (form)
      if (currentTab === "add") return;
      
      // Calcolo differenze
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // 2. LOGICA: È uno swipe orizzontale o uno scroll verticale?
      // Se lo spostamento verticale è maggiore di quello orizzontale, è uno scroll. Ignora.
      if (Math.abs(diffX) < Math.abs(diffY)) return;

      // 3. SOGLIA MINIMA: Il movimento deve essere almeno di 50px per contare
      if (Math.abs(diffX) < 50) return;

      // 4. DIREZIONE
      if (diffX > 0) {
          // Swipe verso DESTRA (->) : Vai al tab precedente
          navigateTabs("prev");
      } else {
          // Swipe verso SINISTRA (<-) : Vai al tab successivo
          navigateTabs("next");
      }
  }

  function navigateTabs(direction) {
      const currentIndex = tabOrder.indexOf(currentTab);
      if (currentIndex === -1) return; // Tab corrente non è nella lista swipeable

      let newIndex = currentIndex;
      if (direction === "next") {
          newIndex = currentIndex + 1;
      } else {
          newIndex = currentIndex - 1;
      }

      // Controllo limiti (non andare oltre l'ultimo o prima del primo)
      if (newIndex >= 0 && newIndex < tabOrder.length) {
          const newTab = tabOrder[newIndex];
          
          // Aggiungiamo classe animazione in base alla direzione
          if (direction === "next") {
             tabContentEl.classList.add("animate-slide-left");
          } else {
             tabContentEl.classList.add("animate-slide-right");
          }
          
          switchTab(newTab);
      }
  }

  loadTravelHeader();
});