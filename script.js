let siteData = null;
let totalSavedUsd = 0;

// Місток для майбутнього Python + AI та лічильника
// Поки що залиш порожнім або встав посилання на Apps Script
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbz6Eo2IAi-Vu7urkrFNNKtAh31GFbi9sOWxPf8UUzZRlFTR63cAOo6ZlYDlXGhrh6hh/exec"; 

// --- ЛІЧИЛЬНИК ---

async function syncGlobalCounter(amountUsd = 0) {
    if (!BRIDGE_URL) return parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
    
    // Якщо amountUsd > 0 — це ЗАПИС, якщо 0 — це ЧИТАННЯ
    const method = amountUsd > 0 ? 'POST' : 'GET';
    const options = {
        method: method,
        mode: 'no-cors' // Це дозволить відправити дані без помилок безпеки
    };

    if (amountUsd > 0) {
        options.body = JSON.stringify({ action: 'counter', amount: amountUsd });
    }

    try {
        // Якщо ми просто читаємо (GET)
        if (method === 'GET') {
            const response = await fetch(BRIDGE_URL);
            const data = await response.json();
            localStorage.setItem('cachedTotalSaved', data.total_saved_usd);
            return data.total_saved_usd;
        } 
        
        // Якщо ми записуємо (POST)
        // 'no-cors' не дає прочитати відповідь, тому ми просто шлемо і віримо в успіх
        fetch(BRIDGE_URL, options); 
        return totalSavedUsd; 

    } catch (e) {
        console.error("Counter error:", e);
        return parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
    }
}

async function updateCounter(addUsd = 0) {
    if (!siteData) return;
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    
    totalSavedUsd += addUsd;
    localStorage.setItem('cachedTotalSaved', totalSavedUsd);

    const rate = info.exchange_rate || 1;
    const displayValue = Math.round(totalSavedUsd * rate);
    
    const counterEl = document.getElementById('moneyCounter');
    const currencyEl = document.getElementById('currency');
    
    if (counterEl) counterEl.innerText = displayValue.toLocaleString();
    if (currencyEl) currencyEl.innerText = info.currency_symbol;

    if (addUsd > 0 && BRIDGE_URL) syncGlobalCounter(addUsd);
}

// --- РЕНДЕРИНГ (НОВА ЛОГІКА КАТЕГОРІЙ) ---

function renderSite() {
    if (!siteData) return;
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    const container = document.getElementById('siteContent');
    if (!container) return;
    container.innerHTML = '';

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    safeSet('mainTitle', info.title);
    safeSet('mainDesc', info.desc);
    safeSet('donateTitle', info.donate_t);
    safeSet('donateDesc', info.donate_d);
    safeSet('donateBtn', info.donate_b);
    safeSet('modalTitle', info.feedback_title);
    safeSet('modalDesc', info.feedback_desc);
    safeSet('modalBtn', info.feedback_btn);
    if (document.getElementById('searchInput')) document.getElementById('searchInput').placeholder = info.search_placeholder;
    if (document.getElementById('seoContent')) document.getElementById('seoContent').innerHTML = info.seo_text;

    updateCounter(0);

    // Групування
    const groups = { 'local': [] };
    
    siteData.services.forEach(s => {
        if (s.type === lang) {
            // Якщо тип збігається з мовою (наприклад UA) -> в локальну категорію
            groups['local'].push(s);
        } else if (s.type === 'global') {
            // Якщо глобальний -> в його рідну категорію (tv, phone і т.д.)
            const cat = s.category || 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        }
    });

    // Сортування: Локальна завжди перша, потім решта
    const sortedKeys = Object.keys(groups).sort((a, b) => a === 'local' ? -1 : 1);

    sortedKeys.forEach(key => {
        if (groups[key].length === 0) return; // Не малюємо порожні категорії

        const wrapper = document.createElement('div');
        wrapper.className = `category-wrapper ${key === 'local' ? 'active' : ''}`;
        const catTitle = info[`cat_${key}`] || key.toUpperCase();

        wrapper.innerHTML = `
            <div class="category-header" onclick="this.parentElement.classList.toggle('active')">
                <span>${catTitle} (${groups[key].length})</span>
                <span class="arrow-cat">▼</span>
            </div>
            <div class="category-content">
                ${groups[key].map(s => `
                    <a href="${s.url}" class="card" target="_blank" onclick="updateCounter(${s.price})">
                        <img src="${s.img}" alt="${s.name}" onerror="this.src='icons/default.png'">
                        <div class="card-name">${s.name}</div>
                    </a>`).join('')}
            </div>
        `;
        container.appendChild(wrapper);
    });
}

// --- СИСТЕМНІ ФУНКЦІЇ ---

async function loadData() {
    try {
        const response = await fetch('data.json');
        siteData = await response.json();
        totalSavedUsd = parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
        
        applySavedSettings();
        initCustomMenu();
        renderSite();

        if (BRIDGE_URL) {
            totalSavedUsd = await syncGlobalCounter(0);
            renderSite();
        }
    } catch (e) { console.error(e); }
}

function filterServices() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('siteContent');
    if (!query) { renderSite(); return; }

    const matches = siteData.services.filter(s => s.name.toLowerCase().includes(query));
    container.innerHTML = '<div class="category-content" style="display:grid"></div>';
    const grid = container.querySelector('.category-content');

    matches.forEach(s => {
        grid.innerHTML += `<a href="${s.url}" class="card" target="_blank" onclick="updateCounter(${s.price})">
            <img src="${s.img}" alt="${s.name}"><div class="card-name">${s.name}</div></a>`;
    });
}

function initCustomMenu() {
    const list = document.getElementById('dropdownList');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(siteData.languages).forEach(code => {
        const item = document.createElement('div');
        item.className = 'select-item';
        item.innerHTML = `<img src="flags/${code}.png" class="flag-icon"><span>${siteData.languages[code].label}</span>`;
        item.onclick = () => {
            localStorage.setItem('lang', code);
            updateVisuals(code);
            renderSite();
            list.classList.remove('active');
        };
        list.appendChild(item);
    });
    updateVisuals(localStorage.getItem('lang') || 'UA');
}

function updateVisuals(code) {
    const flag = document.getElementById('currentFlag');
    const short = document.getElementById('currentShort');
    if (flag) flag.src = `flags/${code}.png`;
    if (short) short.innerText = siteData.languages[code]?.short || code;
}

function toggleMenu() { document.getElementById('dropdownList').classList.toggle('active'); }
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeBtn').innerText = next === 'dark' ? '☀️' : '🌙';
}
function applySavedSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (document.getElementById('themeBtn')) document.getElementById('themeBtn').innerText = theme === 'dark' ? '☀️' : '🌙';
}
function toggleModal() { document.getElementById('feedbackModal').classList.toggle('active'); }
function closeModalOutside(e) { if (e.target.id === 'feedbackModal') toggleModal(); }

document.addEventListener('click', (e) => {
    if (document.getElementById('langSelector') && !document.getElementById('langSelector').contains(e.target)) {
        document.getElementById('dropdownList').classList.remove('active');
    }
});

loadData();
