let siteData = null;
let totalSavedUsd = 0;

// Визначаємо шлях для GitHub Pages
const isGithub = window.location.hostname.includes('github.io');
const BASE_URL = isGithub ? '/stop_pay' : ''; 

const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

const COUNTRIES = {
    "ua": { label: "Україна", short: "UA" },
    "us": { label: "United States", short: "US" }
};

// --- СИСТЕМНЕ ЗАВАНТАЖЕННЯ ---
async function loadData() {
    try {
        const path = window.location.pathname;
        let langCode = 'ua'; 
        
        if (path.includes('/us/')) langCode = 'us';
        else if (path.includes('/ua/')) langCode = 'ua';

        // Додаємо timestamp щоб GitHub не кешував старі дані
        const ts = Date.now();
        const [uiRes, servRes] = await Promise.all([
            fetch(`${BASE_URL}/i18n/${langCode}.json?v=${ts}`).then(r => r.json()),
            fetch(`${BASE_URL}/data.json?v=${ts}`).then(r => r.json())
        ]);

        // Перевіряємо чи є сервіси (якщо build.py ще не спрацював, ставимо пустий масив)
        const services = servRes.services || [];

        siteData = {
            ui: uiRes,
            services: services,
            currentLang: langCode
        };

        applySavedSettings();
        initCustomMenu();
        renderSite();
        syncGlobalCounter();
        
    } catch (e) { 
        console.error("КРИТИЧНА ПОМИЛКА:", e); 
        const cont = document.getElementById('siteContent');
        if (cont) cont.innerHTML = `<div style="text-align:center; padding:50px; color:#ff4757;">
            <h3>Помилка завантаження даних</h3>
            <p>${e.message}</p>
        </div>`;
    }
}

// --- РЕНДЕР САЙТУ ---
function renderSite() {
    const container = document.getElementById('siteContent');
    if (!container || !siteData || !siteData.ui) return;

    container.innerHTML = '';
    const info = siteData.ui;
    
    // Оновлюємо тексти з i18n файлу
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);
    
    // Тексти з вкладеного об'єкта UI (як у твоєму JSON)
    if (info.ui) {
        safeSet('donateTitle', info.ui.donate_t);
        safeSet('donateDesc', info.ui.donate_d);
        safeSet('donateBtn', info.ui.donate_b);
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = info.ui.search_placeholder;
    }
    
    const seoEl = document.getElementById('seoContent');
    if (seoEl) seoEl.innerHTML = info.seo_text || '';

    // Групування сервісів
    const groups = { 'local': [] };
    const currentCountry = siteData.currentLang.toLowerCase();

    if (Array.isArray(siteData.services)) {
        siteData.services.forEach(s => {
            const sType = (s.type || 'global').toLowerCase();
            if (sType === 'global' || sType === currentCountry) {
                const type = sType === currentCountry ? 'local' : (s.category || 'other');
                if (!groups[type]) groups[type] = [];
                groups[type].push(s);
            }
        });
    }

    // Рендер категорій
    Object.keys(groups).sort((a, b) => a === 'local' ? -1 : 1).forEach(key => {
        if (groups[key].length === 0) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = `category-wrapper ${key === 'local' ? 'active' : ''}`;
        const catTitle = (info.categories && info.categories[key]) ? info.categories[key] : key.toUpperCase();

        wrapper.innerHTML = `
            <div class="category-header" onclick="this.parentElement.classList.toggle('active')">
                <span>${catTitle} (${groups[key].length})</span>
                <span class="arrow-cat">▼</span>
            </div>
            <div class="category-content">
                ${groups[key].map(s => `
                    <div class="card" onclick="handleServiceClick('${s.id}')">
                        <div class="card-icon-wrapper">
                            <img src="${BASE_URL}/${s.img || s.icon}" onerror="this.src='${BASE_URL}/assets/icons/default.png'">
                        </div>
                        <div class="card-name">${s.name}</div>
                    </div>`).join('')}
            </div>`;
        container.appendChild(wrapper);
    });

    updateCounterDisplay();
}

function handleServiceClick(serviceId) {
    window.location.href = `${BASE_URL}/${siteData.currentLang}/${serviceId}/`;
}

// --- ПОШУК ---
function handleSearch(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.category-wrapper').forEach(wrapper => {
        let hasVisibleCards = false;
        wrapper.querySelectorAll('.card').forEach(card => {
            const name = card.querySelector('.card-name').innerText.toLowerCase();
            const visible = name.includes(q);
            card.style.display = visible ? 'flex' : 'none';
            if (visible) hasVisibleCards = true;
        });
        wrapper.style.display = hasVisibleCards ? 'block' : 'none';
    });
}

// --- ЛІЧИЛЬНИК ---
async function syncGlobalCounter() {
    try {
        const res = await fetch(BRIDGE_URL);
        const data = await res.json();
        if (data && data.total_saved_usd) {
            totalSavedUsd = data.total_saved_usd;
            updateCounterDisplay();
        }
    } catch (e) { console.log("Counter sync fail"); }
}

function updateCounterDisplay() {
    if (!siteData || !siteData.ui) return;
    const rate = siteData.exchange_rate || 1;
    const cEl = document.getElementById('moneyCounter');
    const curEl = document.getElementById('currency');
    if (cEl) cEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
    if (curEl) curEl.innerText = siteData.ui.currency_symbol || '$';
}

// --- МЕНЮ ТА ТЕМА ---
function initCustomMenu() {
    const list = document.getElementById('dropdownList');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(COUNTRIES).forEach(code => {
        const item = document.createElement('div');
        item.className = 'select-item';
        item.innerHTML = `<img src="${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png" class="flag-icon"><span>${COUNTRIES[code].label}</span>`;
        item.onclick = () => { window.location.href = `${BASE_URL}/${code.toLowerCase()}/`; };
        list.appendChild(item);
    });
    updateVisuals(siteData.currentLang);
}

function updateVisuals(code) {
    const f = document.getElementById('currentFlag');
    const s = document.getElementById('currentShort');
    if (f) f.src = `${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png`;
    if (s) s.innerText = code.toUpperCase();
}

function toggleMenu() { document.getElementById('dropdownList').classList.toggle('active'); }
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}
function applySavedSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

// --- AI МОДАЛКА ---
function toggleModal() { document.getElementById('feedbackModal').classList.toggle('active'); }
function closeModalOutside(e) { if (e.target.id === 'feedbackModal') toggleModal(); }

async function sendToAi() {
    const input = document.getElementById('aiServiceInput');
    const name = input.value.trim();
    if (!name) return;
    const btn = document.getElementById('modalBtn');
    btn.disabled = true; btn.innerText = "...";
    try {
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(name)}`, { mode: 'no-cors' });
        alert("Success!"); toggleModal(); input.value = "";
    } catch (e) { alert("Error"); }
    finally { btn.disabled = false; btn.innerText = siteData.ui.feedback_btn; }
}

// Старт
loadData();
