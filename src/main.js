import { API_BASE_URL } from "./config.js";
import { checkAuth, getAuthToken } from "./auth.js";


document.addEventListener("DOMContentLoaded", () => {

  // 1. Controllo Accesso
  checkAuth();

  // Se non c'è il token, ci fermiamo qui (l'UI di login è già visibile)
  const token = getAuthToken();
  if (!token) return;

  console.log("App avviata con token valido.");
  const travelList = document.getElementById('travels-list');
  if (!travelList) {
    console.error("ERRORE: Elemento 'travels-list' non trovato.");
    return;
  }

  loadTravels();

  async function loadTravels() {
    try {
      const response = await fetch(`${API_BASE_URL}/Travels/summaries`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const rawData = await response.json();
      travelList.innerHTML = ''; 

      if (!rawData || rawData.length === 0) {
        travelList.innerHTML = `
          <div class="text-center mt-10 opacity-60">
            <span class="text-4xl block mb-2">🌍</span>
            <p>Nessun viaggio trovato.</p>
            <p class="text-sm">Usa il tasto + per aggiungerne uno.</p>
          </div>`;
        return;
      }

      // Normalizzazione dati
      const travels = rawData.map(item => ({
        id: item.travelId || item.TravelId || item.id || item.Id,
        name: item.name || item.Name || "Senza Nome",
        startDate: item.startDate || item.StartDate,
        endDate: item.endDate || item.EndDate
      }));

      travels.forEach(travel => {
        if (!travel.id) return;
        const tripEl = createSwipeableCard(travel);
        travelList.appendChild(tripEl);
      });

    } catch (error) {
      console.error(error);
      travelList.innerHTML = `<div class="text-red-500 text-center mt-5">Errore caricamento: ${error.message}</div>`;
    }
  }

  function createSwipeableCard(travel) {
    // 1. Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = "relative overflow-hidden mb-3 select-none"; 
    
    // 2. Sfondo Rosso
    const deleteBg = document.createElement('div');
    deleteBg.className = "absolute inset-0 bg-red-500 rounded-xl flex items-center justify-start pl-6 text-white font-bold opacity-0 transition-opacity duration-200";
    deleteBg.innerHTML = `
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
        Elimina
      </div>
    `;

    // 3. Card
    const card = document.createElement('div');
    card.className = "bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex justify-between items-center relative z-10 bg-white cursor-pointer"; // Aggiunto cursor-pointer
    
    let dateStr = "--";
    try {
        const s = new Date(travel.startDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short' });
        const e = new Date(travel.endDate).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year: '2-digit' });
        dateStr = `${s} - ${e}`;
    } catch(e){}

    card.innerHTML = `
      <div class="flex items-center gap-4 pointer-events-none">
        <div class="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xl">✈️</div>
        <div>
          <h3 class="font-bold text-gray-800 text-lg leading-tight">${travel.name}</h3>
          <p class="text-xs text-gray-500 font-medium mt-1">${dateStr}</p>
        </div>
      </div>
      <div class="text-gray-300 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </div>
    `;

    // --- LOGICA UNIFICATA MOUSE + TOUCH ---
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let isSwiped = false; 

    // Funzioni helper per gestire sia Mouse che Touch
    const getX = (e) => e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;

    const startDrag = (e) => {
      startX = getX(e);
      isDragging = true;
      isSwiped = false;
      card.style.transition = 'none';
    };

    const moveDrag = (e) => {
      if (!isDragging) return;
      
      const x = getX(e);
      const diff = x - startX;

      // Swipe solo verso destra
      if (diff > 0) {
        currentX = diff; // Salviamo la differenza
        card.style.transform = `translateX(${diff}px)`;
        
        if(diff > 20) deleteBg.classList.remove('opacity-0');
        if (diff > 5) isSwiped = true; // Soglia minima per considerare movimento
      }
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      card.style.transition = 'transform 0.3s ease-out';
      
      if (currentX > 150) {
        // Conferma eliminazione
        card.style.transform = `translateX(120%)`; // Vai fuori schermo
        performDelete(travel.id, wrapper);
      } else {
        // Torna indietro
        card.style.transform = `translateX(0)`;
        setTimeout(() => deleteBg.classList.add('opacity-0'), 200);
      }
      currentX = 0;
    };

    // Event Listeners (Touch)
    card.addEventListener('touchstart', startDrag, {passive: true});
    card.addEventListener('touchmove', moveDrag, {passive: true});
    card.addEventListener('touchend', endDrag);

    // Event Listeners (Mouse)
    card.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag); // Window per non perdere il drag se esci dalla card
    window.addEventListener('mouseup', endDrag);

    // Click (Navigazione)
    card.addEventListener('click', (e) => {
      // Se non stiamo trascinando e non abbiamo fatto uno swipe significativo
      if (!isSwiped) {
         window.location.href = `/travel-expenses.html?travelId=${travel.id}`;
      }
    });

    wrapper.appendChild(deleteBg);
    wrapper.appendChild(card);
    return wrapper;
  }

  async function performDelete(id, element) {
    // Piccolo ritardo per far vedere l'animazione swipe completa
    await new Promise(r => setTimeout(r, 100));

    if(!confirm("Vuoi davvero eliminare questo viaggio?")) {
        loadTravels(); // Ricarica per resettare la posizione
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/Travels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Collasso animato
        element.style.height = `${element.offsetHeight}px`;
        element.style.transition = 'height 0.3s ease, margin 0.3s ease';
        requestAnimationFrame(() => {
            element.style.height = '0';
            element.style.marginTop = '0';
            element.style.marginBottom = '0';
        });
        setTimeout(() => element.remove(), 300);
      } else {
        alert("Errore durante l'eliminazione.");
        loadTravels(); 
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione.");
      loadTravels();
    }
  }
});