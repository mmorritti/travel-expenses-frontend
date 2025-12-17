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
  let currentTab = "list"; 
  const tabOrder = ["list", "chart", "fx"]; 

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

  function switchTab(newTab) {
    currentTab = newTab;
    navButtons.forEach((b) => {
        b.classList.remove("active");
        if (b.dataset.tab === newTab) b.classList.add("active");
    });
    renderTab(newTab);
  }

  // --- 2. GESTIONE TAB ---
  async function renderTab(tab) {
    // --- FIX VISIBILITÀ TASTO + (FAB) ---
    // Deve essere visibile SOLO nella lista ("list")
    if (fabAddBtn) {
        if (tab === "list") {
            fabAddBtn.classList.remove("hidden");
        } else {
            fabAddBtn.classList.add("hidden");
        }
    }

    // Reset animazioni
    tabContentEl.classList.remove("animate-slide-right", "animate-slide-left", "animate-fade-in");
    void tabContentEl.offsetWidth; 
    tabContentEl.classList.add("animate-fade-in");

    if (tab === "add") {
      editingExpenseId = null; 
      await renderAddExpense();
    } else if (tab === "list") {
      await renderExpensesList();
    } else if (tab === "chart") {
       await renderChart();
    } else if (tab === "fx") {
       renderFxPage(); 
    }
  }

  // --- 3. PAGINA CAMBIO (FX) - MINIMALISTA ---
  function renderFxPage() {
      // 1. RECUPERO IL TASSO
      let rate = currentExchangeRate; 
      if (!rate || rate <= 0) rate = 1;

      console.log(`FX Debug -> Rate: ${rate}`);

      // 2. CSS PER RIMUOVERE FRECCE (Spinners)
      const noSpinnerStyle = `
        <style>
            .no-spinner::-webkit-inner-spin-button, 
            .no-spinner::-webkit-outer-spin-button { 
                -webkit-appearance: none; 
                margin: 0; 
            }
            .no-spinner { 
                -moz-appearance: textfield; 
            }
        </style>
      `;

      tabContentEl.innerHTML = `
        ${noSpinnerStyle}
        <div class="p-6 animate-fade-in max-w-md mx-auto">
            <h2 class="text-lg font-bold text-gray-800 mb-8 text-center">Convertitore Rapido</h2>
            
            <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                
                <div class="p-6 border-b border-gray-100 bg-sky-50 transition-colors">
                    <label class="block text-xs font-bold text-sky-800 uppercase mb-2">
                        ${mainTravelCurrency} (Locale)
                    </label>
                    <div class="flex items-center">
                        <input type="number" id="inp-local" inputmode="decimal" placeholder="0" 
                               class="no-spinner w-full bg-transparent text-3xl font-black text-sky-900 placeholder-sky-300 focus:outline-none" />
                        <span class="text-sky-900 font-bold ml-2">${mainTravelCurrency}</span>
                    </div>
                </div>

                <div class="p-6 bg-white transition-colors">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-2">
                        EUR (Casa)
                    </label>
                    <div class="flex items-center">
                        <input type="number" id="inp-home" inputmode="decimal" placeholder="0"
                               class="no-spinner w-full bg-transparent text-3xl font-black text-gray-800 placeholder-gray-200 focus:outline-none" />
                        <span class="text-gray-400 font-bold ml-2">EUR</span>
                    </div>
                </div>
            </div>

            <div class="text-center mt-6">
                 <p class="text-xs text-gray-400 font-mono bg-gray-50 inline-block px-3 py-1 rounded-full">
                    Tasso: 1 EUR ≈ ${(1/rate).toFixed(2)} ${mainTravelCurrency}
                 </p>
            </div>
        </div>
      `;

      const elLocal = document.getElementById("inp-local");
      const elHome = document.getElementById("inp-home");

      // Scrivo LOCALE -> Calcola EURO
      elLocal.addEventListener("input", () => {
          const val = parseFloat(elLocal.value);
          if (isNaN(val)) { elHome.value = ""; return; }
          elHome.value = (val * rate).toFixed(2);
      });

      // Scrivo EURO -> Calcola LOCALE
      elHome.addEventListener("input", () => {
          const val = parseFloat(elHome.value);
          if (isNaN(val)) { elLocal.value = ""; return; }
          elLocal.value = (val / rate).toFixed(2);
      });

      // Blocca tasti negativi
      const blockNegativeKeys = (e) => {
          if (["-", "e", "E", "+"].includes(e.key)) e.preventDefault();
      };
      elLocal.addEventListener("keydown", blockNegativeKeys);
      elHome.addEventListener("keydown", blockNegativeKeys);

      setTimeout(() => elLocal.focus(), 200);
  }

  // --- 4. CARICAMENTO DATI VIAGGIO ---
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

  // --- 5. LISTA SPESE ---
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

          const dateObj = new Date(e.expanseDate);
          const day = dateObj.getDate();
          const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();
          const icon = categoryMap[e.categoryId] || '🧾';

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
            <button class="delete-btn w-14 flex items-center justify-center !bg-transparent !border-0 !shadow-none hover:!bg-transparent focus:outline-none cursor-pointer shrink-0 group">
               <span class="text-red-500 text-xl font-bold">🗑️</span>
            </button>
          `;

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

  // --- 6. DELETE ---
  async function deleteExpense(id) {
    if(!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/Expanses/${id}`, { method: 'DELETE' });
      if (res.ok) renderExpensesList();
      else alert("Errore eliminazione");
    } catch (err) { console.error(err); }
  }

  // --- 7. EDIT/ADD FORM ---
  async function openEditForm(expense) {
    editingExpenseId = expense.expanseId; 
    
    // Reset navbar
    navButtons.forEach((b) => b.classList.remove("active"));
    
    currentTab = "add"; 
    await renderAddExpense(expense); 
  }

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
      
      const defDate = expenseToEdit ? expenseToEdit.expanseDate : new Date().toISOString();

      tabContentEl.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-20 animate-fade-in">
          <h2 class="text-xl font-bold mb-6 text-gray-800">${title}</h2>
          <form id="expense-form" class="flex flex-col gap-5">
            
            <div>
               <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
               <div class="relative">
                 <input id="expense-date" name="expanseDate" type="text" class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer caret-transparent" placeholder="Seleziona data..." required />
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

      flatpickr("#expense-date", {
         locale: "it",
         dateFormat: "Y-m-d",
         altInput: true,
         altFormat: "j M Y",
         defaultDate: defDate,
         disableMobile: true,
         allowInput: false, 
         clickOpens: true
      });

      document.getElementById("expense-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const dateStr = fd.get("expanseDate");
        const payload = {
          travelId, categoryId: fd.get("categoryId"), expanseDate: new Date(dateStr).toISOString(),
          name: fd.get("name"), amount: Number(fd.get("amount")), currencyCode: fd.get("currencyCode"), description: ""
        };

        let url = `${API_BASE_URL}/Expanses`;
        let method = "POST";
        if (editingExpenseId) { method = "PUT"; url += `/${editingExpenseId}`; payload.expanseId = editingExpenseId; }

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) {
          editingExpenseId = null; 
          const listTab = document.querySelector('[data-tab="list"]');
          if (listTab) listTab.click();
        } else {
            console.error(await res.text());
            alert("Errore nel salvataggio");
        }
      });

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

  // --- 8. GRAFICO ---
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

  // === 9. SWIPE LOGIC ===
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const container = document.body; 

  container.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
  }, {passive: true});

  container.addEventListener('mousedown', e => {
      touchStartX = e.screenX;
      touchStartY = e.screenY;
  });

  container.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipeGesture();
  }, {passive: true});

  container.addEventListener('mouseup', e => {
      touchEndX = e.screenX;
      touchEndY = e.screenY;
      handleSwipeGesture();
  });

  function handleSwipeGesture() {
      if (currentTab === "add") return;
      
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      if (Math.abs(diffX) < Math.abs(diffY)) return;
      if (Math.abs(diffX) < 50) return;

      if (diffX > 0) navigateTabs("prev");
      else navigateTabs("next");
  }

  function navigateTabs(direction) {
      const currentIndex = tabOrder.indexOf(currentTab);
      if (currentIndex === -1) return;

      let newIndex = currentIndex;
      if (direction === "next") newIndex = currentIndex + 1;
      else newIndex = currentIndex - 1;

      if (newIndex >= 0 && newIndex < tabOrder.length) {
          const newTab = tabOrder[newIndex];
          if (direction === "next") tabContentEl.classList.add("animate-slide-left");
          else tabContentEl.classList.add("animate-slide-right");
          switchTab(newTab);
      }
  }

  loadTravelHeader();
});