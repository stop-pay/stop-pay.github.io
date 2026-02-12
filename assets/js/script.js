let siteData = null;
let totalSavedUsd = 0;

// Константа для шляху репозиторію на GitHub Pages
const BASE_URL = "/stop_pay"; 
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

// --- ЛІЧИЛЬНИК ---

async function syncGlobalCounter(amountUsd = 0) {
    if (!BRIDGE_URL) return totalSavedUsd;
    
    const url = new URL(BRIDGE_URL);
    if (amountUsd > 0) url.searchParams.set('amount', amountUsd);

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.total_saved_usd !== undefined) {
            totalSavedUsd = data.total_saved_usd;
            localStorage.setItem('cachedTotalSaved', totalSavedUsd);
            updateCounterDisplay();
        }
        return totalSavedUsd;
    } catch (e) {
        console.error("Помилка синхронізації:", e);
        return parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
    }
}

function updateCounterDisplay() {
    if (!siteData) return;
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    const rate = info.exchange_rate || 1;
    
    const counterEl = document.getElementById('moneyCounter');
    const currencyEl = document.getElementById('currency');
    
    if (counterEl) counterEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
    if (currencyEl) currencyEl.innerText = info.currency_symbol;
}

// Функція, яка викликається ПРИ КЛІКУ на сервіс
function handleServiceClick(price, serviceId) {
    // Зберігаємо ціну останнього клікнутого сервісу, щоб додати її на сторінці інструкції
    localStorage.setItem('pendingPrice', price);
    // Перенаправляємо на сторінку інструкції
    const lang = (localStorage.getItem('lang') || 'UA').toLowerCase();
    window.location.href = `${BASE_URL}/${lang}/${serviceId}/`;
}

// --- РЕНДЕРИНГ ---

function renderSite() {
    if (!siteData || !siteData.ui) return;
    
    // В новій системі дані інтерфейсу лежать в siteData.ui
    const info = siteData.ui;
    const currentLang = (localStorage.getItem('lang') || 'UA').toUpperCase();
    const currentLangLower = currentLang.toLowerCase();
    
    const container = document.getElementById('siteContent');
    if (!container) return; // Якщо ми на сторінці інструкції
    
    container.innerHTML = '';

    // 1. Оновлення текстів інтерфейсу (використовуємо секцію ui з json)
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);
    safeSet('donateTitle', info.ui.donate_t);
    safeSet('donateDesc', info.ui.donate_d);
    safeSet('donateBtn', info.ui.donate_b);
    
    // SEO текст підставляємо в блок (якщо є на головній)
    const seoEl = document.getElementById('seoContent');
    if (seoEl) seoEl.innerHTML = info.seo_text || '';
    
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').placeholder = info.ui.search_placeholder;
    }

    updateCounterDisplay();

    // 2. Фільтрація та групування за категоріями
    const groups = { 'local': [] };
    
    siteData.services.forEach(s => {
        // Логіка: показуємо тільки сервіси своєї країни + GLOBAL
        if (s.type === 'global' || s.type === currentLangLower) {
            const type = s.type === currentLangLower ? 'local' : (s.category || 'other');
            
            if (!groups[type]) groups[type] = [];
            groups[type].push(s);
        }
    });

    // Сортуємо: спочатку локальні, потім решта
    const sortedKeys = Object.keys(groups).sort((a, b) => a === 'local' ? -1 : 1);

    sortedKeys.forEach(key => {
        if (groups[key].length === 0) return;

        const wrapper = document.createElement('div');
        wrapper.className = `category-wrapper ${key === 'local' ? 'active' : ''}`;
        
        // Назва категорії береться з секції categories у файлі i18n
        const catTitle = info.categories[key] || key.toUpperCase();

        wrapper.innerHTML = `
            <div class="category-header" onclick="this.parentElement.classList.toggle('active')">
                <span>${catTitle} (${groups[key].length})</span>
                <span class="arrow-cat">▼</span>
            </div>
            <div class="category-content">
                ${groups[key].map(s => `
                    <div class="card" onclick="handleServiceClick(${s.price || 0}, '${s.id}')">
                        <img src="${BASE_URL}/${s.img || s.icon}" alt="${s.name}" onerror="this.src='${BASE_URL}/assets/icons/default.png'">
                        <div class="card-name">${s.name}</div>
                    </div>`).join('')}
            </div>
        `;
        container.appendChild(wrapper);
    });
}

// --- СИСТЕМНІ ФУНКЦІЇ ---

async function loadData() {
    try {
        // 1. Визначаємо країну з URL (напр. "ua" або "us")
        const pathParts = window.location.pathname.split('/');
        // Якщо сайт в папці /stop_pay/, то код мови буде в 3-й частині
        const currentLang = pathParts.includes('stop_pay') ? pathParts[pathParts.indexOf('stop_pay') + 1] : pathParts[1];
        const langCode = (currentLang || 'ua').toLowerCase();

        // 2. Завантажуємо ТІЛЬКИ файл цієї країни
        const response = await fetch(`${BASE_URL}/i18n/${langCode}.json`);
        const langData = await response.json();
        
        // 3. Завантажуємо спільний список сервісів (data.json або services.json)
        const servicesResponse = await fetch(`${BASE_URL}/data.json`);
        const allData = await servicesResponse.json();

        // Об'єднуємо дані для рендеру
        siteData = {
            ui: langData, // Тексти інтерфейсу
            services: allData.services, // Всі сервіси
            currentLang: langCode.toUpperCase()
        };

        renderSite();
    } catch (e) { console.error("Error loading data:", e); }
}

function initCustomMenu() {
    const list = document.getElementById('dropdownList');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(siteData.languages).forEach(code => {
        const item = document.createElement('div');
        item.className = 'select-item';
        // ЗМІНЕНО: шлях веде в assets/icons/flags/
        item.innerHTML = `<img src="${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png" class="flag-icon"><span>${siteData.languages[code].label}</span>`;
        item.onclick = () => {
            localStorage.setItem('lang', code);
            window.location.href = `${BASE_URL}/${code.toLowerCase()}/`;
        };
        list.appendChild(item);
    });
    updateVisuals(localStorage.getItem('lang') || 'UA');
}

function updateVisuals(code) {
    const flag = document.getElementById('currentFlag');
    const short = document.getElementById('currentShort');
    // ЗМІНЕНО: шлях веде в assets/icons/flags/
    if (flag) flag.src = `${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png`;
    if (short) short.innerText = siteData.languages[code]?.short || code;
}

// Тема та модалки (лишаємо без змін)
function toggleMenu() { document.getElementById('dropdownList').classList.toggle('active'); }
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerText = next === 'dark' ? '☀️' : '🌙';
}
function applySavedSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerText = theme === 'dark' ? '☀️' : '🌙';
}
function toggleModal() { document.getElementById('feedbackModal').classList.toggle('active'); }
function closeModalOutside(e) { if (e.target.id === 'feedbackModal') toggleModal(); }

async function sendToAi() {
    const input = document.getElementById('aiServiceInput');
    const serviceName = input.value.trim();
    if (!serviceName) return;

    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    const btn = document.getElementById('modalBtn');
    
    const originalText = btn.innerText;
    btn.innerText = info.ai_sending || "⌛...";
    btn.disabled = true;

    try {
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(serviceName)}`, { mode: 'no-cors' });
        alert(info.ai_success);
        input.value = "";
        toggleModal();
    } catch (e) {
        alert(info.ai_error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Запуск
loadData();
                       
