let siteData = null;
let totalSavedUsd = 0;
const BASE_URL = "/stop_pay"; 
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

// Список доступних країн
const COUNTRIES = {
    "ua": { label: "Україна", short: "UA" },
    "us": { label: "United States", short: "US" }
};

// --- СИСТЕМНЕ ЗАВАНТАЖЕННЯ ДАНИХ ---
async function loadData() {
    try {
        const pathParts = window.location.pathname.split('/');
        let langCode = 'ua';
        if (pathParts.includes('us')) langCode = 'us';

        console.log("Завантаження даних для мови:", langCode);

        // Завантажуємо переклади та базу сервісів паралельно
        const [uiRes, servRes] = await Promise.all([
            fetch(`${BASE_URL}/i18n/${langCode}.json`),
            fetch(`${BASE_URL}/data.json`)
        ]);

        const uiData = await uiRes.json();
        const allData = await servRes.json();

        siteData = {
            ui: uiData,
            services: allData.services,
            currentLang: langCode
        };

        // Запускаємо все
        applySavedSettings();
        initCustomMenu();
        renderSite();
        syncGlobalCounter();
        
    } catch (e) { 
        console.error("КРИТИЧНА ПОМИЛКА:", e); 
        const cont = document.getElementById('siteContent');
        if (cont) cont.innerHTML = `<p style="text-align:center; padding:50px;">Помилка завантаження даних. Перевірте консоль (F12).</p>`;
    }
}

// --- МАЛЮЄМО КАТЕГОРІЇ ТА КАРТКИ ---
function renderSite() {
    const container = document.getElementById('siteContent');
    if (!container || !siteData || !siteData.ui) return;

    container.innerHTML = '';
    const info = siteData.ui;
    
    // Оновлюємо тексти інтерфейсу (шапка, донати)
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);
    safeSet('donateTitle', info.ui.donate_t);
    safeSet('donateDesc', info.ui.donate_d);
    safeSet('donateBtn', info.ui.donate_b);
    
    const seoEl = document.getElementById('seoContent');
    if (seoEl) seoEl.innerHTML = info.seo_text || '';
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = info.ui.search_placeholder;

    // Фільтрація та групування сервісів
    const groups = { 'local': [] };
    const currentCountry = siteData.currentLang.toLowerCase();

    siteData.services.forEach(s => {
        const sType = s.type.toLowerCase();
        if (sType === 'global' || sType === currentCountry) {
            const type = sType === currentCountry ? 'local' : (s.category || 'other');
            if (!groups[type]) groups[type] = [];
            groups[type].push(s);
        }
    });

    // Рендеримо блоки категорій
    Object.keys(groups).sort((a, b) => a === 'local' ? -1 : 1).forEach(key => {
        if (groups[key].length === 0) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = `category-wrapper ${key === 'local' ? 'active' : ''}`;
        const catTitle = info.categories[key] || key.toUpperCase();

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

// Перехід на сторінку інструкції
function handleServiceClick(serviceId) {
    window.location.href = `${BASE_URL}/${siteData.currentLang}/${serviceId}/`;
}

// --- ПОШУК ---
function handleSearch(query) {
    const q = query.toLowerCase().trim();
    const categories = document.querySelectorAll('.category-wrapper');
    
    categories.forEach(wrapper => {
        let hasVisibleCards = false;
        const cards = wrapper.querySelectorAll('.card');
        
        cards.forEach(card => {
            const name = card.querySelector('.card-name').innerText.toLowerCase();
            if (name.includes(q)) {
                card.style.display = 'flex';
                hasVisibleCards = true;
            } else {
                card.style.display = 'none';
            }
        });
        wrapper.style.display = hasVisibleCards ? 'block' : 'none';
    });
}

// --- ЛІЧИЛЬНИК ---
async function syncGlobalCounter() {
    if (!BRIDGE_URL) return;
    try {
        const response = await fetch(BRIDGE_URL);
        const data = await response.json();
        if (data && data.total_saved_usd !== undefined) {
            totalSavedUsd = data.total_saved_usd;
            localStorage.setItem('cachedTotalSaved', totalSavedUsd);
            updateCounterDisplay();
        }
    } catch (e) {
        totalSavedUsd = parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
        updateCounterDisplay();
    }
}

function updateCounterDisplay() {
    if (!siteData || !siteData.ui) return;
    const rate = siteData.ui.exchange_rate || 1;
    const counterEl = document.getElementById('moneyCounter');
    const currencyEl = document.getElementById('currency');
    if (counterEl) counterEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
    if (currencyEl) currencyEl.innerText = siteData.ui.currency_symbol;
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
    const flag = document.getElementById('currentFlag');
    const short = document.getElementById('currentShort');
    if (flag) flag.src = `${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png`;
    if (short) short.innerText = code.toUpperCase();
}

function toggleMenu() { document.getElementById('dropdownList').classList.toggle('active'); }

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function applySavedSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

// --- МОДАЛКА (AI Додавання) ---
function toggleModal() { document.getElementById('feedbackModal').classList.toggle('active'); }

function closeModalOutside(e) { if (e.target.id === 'feedbackModal') toggleModal(); }

async function sendToAi() {
    const input = document.getElementById('aiServiceInput');
    const serviceName = input.value.trim();
    if (!serviceName || !BRIDGE_URL) return;

    const btn = document.getElementById('modalBtn');
    btn.disabled = true;
    btn.innerText = "⌛...";

    try {
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(serviceName)}`, { mode: 'no-cors' });
        alert(siteData.ui.ai_success || "Надіслано!");
        input.value = "";
        toggleModal();
    } catch (e) {
        alert("Помилка відправки");
    } finally {
        btn.disabled = false;
        btn.innerText = siteData.ui.feedback_btn || "Надіслати";
    }
}

// Закриття меню при кліку поза ним
document.addEventListener('click', (e) => {
    const selector = document.getElementById('langSelector');
    if (selector && !selector.contains(e.target)) {
        document.getElementById('dropdownList').classList.remove('active');
    }
});

// СТАРТ
loadData();
