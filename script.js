let siteData = null;
let totalSavedUsd = 0;

// Місток для майього Python + AI та лічильника
// Поки що залиш порожнім або встав посилання на Apps Script
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

// --- ЛІЧИЛЬНИК ---

async function syncGlobalCounter(amountUsd = 0) {
    if (!BRIDGE_URL) return totalSavedUsd;
    
    // Формуємо URL
    const url = new URL(BRIDGE_URL);
    if (amountUsd > 0) url.searchParams.set('amount', amountUsd);

    try {
        // Використовуємо звичайний fetch, але обробляємо можливі редиректи Google
        const response = await fetch(url);
        
        // Якщо Google Script повернув JSON
        const data = await response.json();
        
        if (data && data.total_saved_usd !== undefined) {
            totalSavedUsd = data.total_saved_usd;
            localStorage.setItem('cachedTotalSaved', totalSavedUsd);
            
            // Оновлюємо цифри на сторінці відразу після отримання даних
            const lang = localStorage.getItem('lang') || 'UA';
            const info = siteData.languages[lang] || siteData.languages['UA'];
            const rate = info.exchange_rate || 1;
            const counterEl = document.getElementById('moneyCounter');
            if (counterEl) counterEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
        }
        return totalSavedUsd;
    } catch (e) {
        console.error("Помилка синхронізації:", e);
        return parseFloat(localStorage.getItem('cachedTotalSaved')) || 0;
    }
}

async function updateCounter(addUsd = 0) {
    if (!siteData) return;
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    
    // 1. Спочатку оновлюємо візуально (для швидкості)
    totalSavedUsd += addUsd;
    const rate = info.exchange_rate || 1;
    const counterEl = document.getElementById('moneyCounter');
    const currencyEl = document.getElementById('currency');
    
    if (counterEl) counterEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
    if (currencyEl) currencyEl.innerText = info.currency_symbol;

    // 2. Потім відправляємо на сервер
    if (addUsd > 0 && BRIDGE_URL) {
        await syncGlobalCounter(addUsd);
    }
}

// --- РЕНДЕРИНГ (НОВА ЛОГІКА КАТЕГОРІЙ) ---

function renderSite() {
    if (!siteData) return;
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    document.title = info.title + " — " + info.desc;
    const container = document.getElementById('siteContent');
    if (!container) return;
    container.innerHTML = '';
    const aiInput = document.getElementById('aiServiceInput');
    if (aiInput) aiInput.placeholder = info.feedback_placeholder;

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    safeSet('footerCreated', info.footer_created);
    safeSet('footerSlogan', info.footer_slogan);
    safeSet('counterLabel', info.total_saved);
    //safeSet('mainTitle', info.title);
    
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

async function sendToAi() {
    const input = document.getElementById('aiServiceInput');
    const serviceName = input.value.trim();
    
    // 1. Перевірку на пустий рядок краще робити на самому початку
    if (!serviceName) return;

    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];

    const btn = document.getElementById('modalBtn');
    const originalText = btn.innerText;
    btn.innerText = info.ai_sending || "⌛...";
    btn.disabled = true;

    try {
        // 2. Відправляємо ТІЛЬКИ назву сервісу. ШІ на бекенді сам знає, що з нею робити.
        // Режим 'no-cors' використовується для Google Apps Script, щоб уникнути помилок доступу.
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(serviceName)}`, { mode: 'no-cors' });
        
        alert(info.ai_success);
        input.value = "";
        toggleModal();
    } catch (e) {
        console.error(e);
        alert(info.ai_error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

loadData();
