import { API_BASE_URL } from "./config.js";

const API_URL = `${API_BASE_URL}/Travels/summaries`;

document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const emptyStateEl = document.getElementById('empty-state');
  const tripsListEl = document.getElementById('trips-list');
  const addTripBtn = document.getElementById('add-trip-btn');

  // evento click sul +
  addTripBtn.addEventListener('click', () => {
    window.location.href = '/new-travel.html';
  });

  // carica i viaggi all’avvio
  loadTrips();

  async function loadTrips() {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error('Errore nella chiamata API');
      }

      const data = await response.json();

      // tolgo il messaggio di loading
      loadingEl.classList.add('hidden');

      if (!data || data.length === 0) {
        emptyStateEl.classList.remove('hidden');
        return;
      }

      // per ogni viaggio creo una card
      data.forEach((trip) => {
        const card = createTripCard(trip);
        tripsListEl.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Errore nel caricamento dei viaggi.';
    }
  }

  function createTripCard(trip) {
    const dateRange = formatDateRange(trip.startDate, trip.endDate);

    const totalHomeText = formatTotal(
      trip.totalInHomeCurrency,
      trip.homeCurrencyCode
    );

    const totalTravelText = formatTotal(
      trip.totalInTravelCurrency,
      trip.travelCurrencyCode
    );

    // wrapper che gestisce sfondo rosso + card che scorre
    const wrapper = document.createElement('div');
    wrapper.className = 'relative overflow-hidden mb-3 px-4';
    wrapper.dataset.travelId = trip.travelId; // id per la DELETE

    wrapper.innerHTML = `
      <!-- sfondo rosso con cestino -->
      <div
        class="absolute inset-y-0 left-4 right-4 bg-red-500 rounded-2xl flex items-center justify-start pl-6"
        data-role="delete-bg"
      >
        <div class="flex items-center gap-2 text-white font-semibold text-sm">
          🗑️ <span>Elimina</span>
        </div>
      </div>

      <!-- card "vera" che può scorrere -->
      <div
        class="relative bg-white rounded-2xl shadow-md px-4 py-3 flex justify-between items-center transform transition-transform duration-200 trip-card-clickable"
        data-role="card"
        style="cursor: pointer;"
      >
        <div class="flex flex-col text-left">
          <span class="text-lg font-bold">${trip.name}</span>
          <span class="text-xs text-gray-500 mt-1">${dateRange}</span>
        </div>
        <div class="flex flex-col items-end text-right">
          <span class="text-base font-bold">${totalHomeText}</span>
          <span class="text-xs text-gray-500 mt-1">≈ ${totalTravelText}</span>
        </div>
      </div>
    `;

    const card = wrapper.querySelector('[data-role="card"]');

    // 👉 swipe + click senza conflitto
    attachSwipeToDelete(wrapper, trip.travelId, () => {
      window.location.href = `/travel-expenses.html?travelId=${trip.travelId}`;
    });

    return wrapper;
  }

  // chiamata DELETE al backend
  async function deleteTravel(travelId) {
    const response = await fetch(`${API_BASE_URL}/Travels/${travelId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error("Errore durante l'eliminazione del viaggio");
    }
  }

  /**
   * swipe da sinistra verso destra con soglia di eliminazione
   * + click che funziona solo se NON abbiamo trascinato
   */
  function attachSwipeToDelete(wrapper, travelId, onClick) {
    const card = wrapper.querySelector('[data-role="card"]');
    if (!card) return;

    let startX = 0;
    let currentX = 0;
    let dragging = false;
    let moved = false; // se la card si è mossa, non consideriamo il click

    const maxTranslate = 160; // quanto può “slittare” la card
    const threshold = 120;    // oltre questo valore → tentativo di delete
    const clickTolerance = 5; // pixel entro cui consideriamo "click" e non swipe

    const onStart = (clientX) => {
      dragging = true;
      moved = false;
      startX = clientX;
      currentX = 0;
      card.style.transition = 'none';
    };

    const onMove = (clientX) => {
      if (!dragging) return;
      const deltaX = clientX - startX;

      if (Math.abs(deltaX) > clickTolerance) {
        moved = true;
      }

      // solo swipe da SINISTRA verso destra
      if (deltaX <= 0) {
        currentX = 0;
        card.style.transform = 'translateX(0)';
        return;
      }

      currentX = Math.min(deltaX, maxTranslate);
      card.style.transform = `translateX(${currentX}px)`;
    };

    const onEnd = async () => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = 'transform 0.2s ease-out';

      if (currentX > threshold) {
        const ok = window.confirm('Vuoi eliminare questo viaggio?');
        if (!ok) {
          card.style.transform = 'translateX(0)';
          return;
        }

        try {
          card.style.transform = 'translateX(100%)';
          await deleteTravel(travelId);
          wrapper.remove();
        } catch (err) {
          console.error(err);
          alert("Errore nell'eliminazione del viaggio.");
          card.style.transform = 'translateX(0)';
        }
      } else {
        card.style.transform = 'translateX(0)';
      }

      // dopo il rilascio, se non si è mosso abbastanza, il click normale funzionerà
    };

    // click: parte solo se NON abbiamo fatto swipe
    card.addEventListener('click', (e) => {
      if (moved) {
        // era uno swipe, non un click
        return;
      }
      if (typeof onClick === 'function') {
        onClick();
      }
    });

    // mouse events
    card.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    // touch events (mobile)
    card.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      if (touch) onStart(touch.clientX);
    });

    card.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (touch) onMove(touch.clientX);
    });

    card.addEventListener('touchend', onEnd);
  }

  function formatDateRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);

    const optionsShort = { day: '2-digit', month: 'short' };
    const optionsLong = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };

    const sText = s.toLocaleDateString('it-IT', optionsShort);
    const eText = e.toLocaleDateString('it-IT', optionsLong);

    return `${sText} – ${eText}`;
  }

  function formatTotal(amount, currencyCode) {
    const value = Number(amount ?? 0);
    const code = currencyCode || '€';
    return `${value.toFixed(2)} ${code}`;
  }
});
