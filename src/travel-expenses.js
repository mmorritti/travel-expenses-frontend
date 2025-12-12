import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const travelId = params.get("travelId");

  if (!travelId) {
    console.error("Missing travelId");
    document.getElementById("tab-content").innerHTML =
      "<p>Errore: viaggio non trovato.</p>";
    return;
  }

  // ---- DOM REFS ----
  const backBtn = document.getElementById("back-btn");
  const travelNameEl = document.getElementById("travel-name");
  const travelDatesEl = document.getElementById("travel-dates");
  const tabContentEl = document.getElementById("tab-content");
  const tabButtons = document.querySelectorAll(".exp-tab-btn");

  // ---- BACK BUTTON ----
  backBtn.addEventListener("click", () => {
    window.location.href = "/index.html";
  });

  // ---- HEADER ----
  async function loadTravelHeader() {
    try {
      const res = await fetch(`${API_BASE_URL}/Travels/${travelId}`);
      if (!res.ok) throw new Error("GET travel failed");

      const trip = await res.json();

      travelNameEl.textContent = trip.name;

      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);

      travelDatesEl.textContent =
        `${start.toLocaleDateString("it-IT")} – ${end.toLocaleDateString("it-IT")}`;
    } catch (err) {
      console.error(err);
      travelNameEl.textContent = "Viaggio";
      travelDatesEl.textContent = "";
    }
  }

  loadTravelHeader();

  // ---- TABS ----
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("exp-tab-btn-active"));
      btn.classList.add("exp-tab-btn-active");
      renderTab(btn.dataset.tab);
    });
  });

  renderTab("list"); // default tab

  async function renderTab(tab) {
    if (tab === "list") return renderExpensesList();
    if (tab === "add") return renderAddExpense();
    if (tab === "chart") return renderChart();
    if (tab === "fx") return renderFx();
  }

  // ---- LISTA SPESE ----
  async function renderExpensesList() {
    tabContentEl.innerHTML = "<p>Caricamento spese...</p>";

    try {
      const res = await fetch(`${API_BASE_URL}/Expanses?travelId=${travelId}`);
      if (!res.ok) throw new Error("GET expanses failed");

      const expenses = await res.json();

      if (!expenses.length) {
        tabContentEl.innerHTML = "<p>Nessuna spesa per questo viaggio.</p>";
        return;
      }

      let total = 0;
      let currency = expenses[0].currencyCode ?? "";

      const cards = expenses
        .map((e) => {
          total += e.amount;

          return `
            <div class="expense-card">
              <div>
                <div class="font-semibold text-base">${e.name}</div>
                <div class="text-xs text-gray-500 mt-1">
                  ${new Date(e.expanseDate).toLocaleDateString("it-IT")}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Categoria: ${e.categoryId}
                </div>
                ${e.description ? `<div class="text-xs text-gray-600 mt-1">${e.description}</div>` : ""}
              </div>

              <div class="font-bold text-right">
                ${e.amount.toFixed(2)} ${e.currencyCode}
              </div>
            </div>
          `;
        })
        .join("");

      const totalRow = `
        <div class="expense-total-row">
          <span>Totale</span>
          <span>${total.toFixed(2)} ${currency}</span>
        </div>
      `;

      tabContentEl.innerHTML = cards + totalRow;
    } catch (err) {
      console.error(err);
      tabContentEl.innerHTML = "<p>Errore nel caricamento delle spese.</p>";
    }
  }

  // ---- AGGIUNGI SPESA ----
  function renderAddExpense() {
    tabContentEl.innerHTML = `
      <form id="add-expense-form" class="flex flex-col gap-3">

        <label>
          Nome spesa
          <input class="border w-full p-2 rounded" name="name" required />
        </label>

        <label>
          Data
          <input type="date" class="border w-full p-2 rounded" name="date" required />
        </label>

        <label>
          Importo
          <input type="number" step="0.01" class="border w-full p-2 rounded" name="amount" required />
        </label>

        <label>
          Valuta (es. EUR)
          <input class="border w-full p-2 rounded" name="currency" maxlength="3" value="EUR" required />
        </label>

        <label>
          Categoria ID (GUID)
          <input class="border w-full p-2 rounded" name="categoryId" required />
        </label>

        <label>
          Descrizione (opzionale)
          <textarea class="border w-full p-2 rounded" name="description"></textarea>
        </label>

        <button class="bg-sky-500 text-white p-2 rounded">Salva spesa</button>
      </form>

      <p id="add-expense-msg" class="mt-3 text-sm"></p>
    `;

    const form = document.getElementById("add-expense-form");
    const msg = document.getElementById("add-expense-msg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "Salvataggio in corso...";

      const fd = new FormData(form);

      const body = {
        travelId,
        categoryId: fd.get("categoryId"),
        expanseDate: fd.get("date"),
        name: fd.get("name"),
        amount: Number(fd.get("amount")),
        currencyCode: fd.get("currency"),
        description: fd.get("description")
      };

      try {
        const res = await fetch(`${API_BASE_URL}/Expanses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          msg.textContent = "Errore durante il salvataggio.";
          return;
        }

        msg.textContent = "Spesa salvata!";
        await renderExpensesList();

        tabButtons.forEach((b) => b.classList.remove("exp-tab-btn-active"));
        document.querySelector('[data-tab="list"]').classList.add("exp-tab-btn-active");

      } catch (err) {
        console.error(err);
        msg.textContent = "Errore durante il salvataggio.";
      }
    });
  }

  // ---- GRAFICO ----
  function renderChart() {
    tabContentEl.innerHTML = `<p>Qui in futuro mettiamo il grafico.</p>`;
  }

  // ---- CAMBIO VALUTA ----
  function renderFx() {
    tabContentEl.innerHTML = `<p>Qui in futuro mettiamo il cambio valuta.</p>`;
  }
});
