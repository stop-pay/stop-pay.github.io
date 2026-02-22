let siteData = null;
let totalSavedUsd = 0;

const isGithub = window.location.hostname.includes('github.io');
const BASE_URL = isGithub ? '/stop_pay' : ''; 
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

// --- СИСТЕМНЕ ЗАВАНТАЖЕННЯ ---
async function loadData() {
    try {
        const path = window.location.pathname;
        const isRoot = path === BASE_URL + '/' || path === BASE_URL || path === '/';
        let savedLang = localStorage.getItem('user_lang');

        let langFromUrl = null;
        if (path.includes('/us/')) langFromUrl = 'us';
        else if (path.includes('/ua/')) langFromUrl = 'ua';
        else if (path.includes('/gb/')) langFromUrl = 'gb';

        if (isRoot && savedLang && savedLang !== 'ua') {
            window.location.replace(`${BASE_URL}/${savedLang}/`);
            return;
        }

        if (langFromUrl) {
            localStorage.setItem('user_lang', langFromUrl);
            localStorage.setItem('user_region_set', 'true');
        }

        const langCode = langFromUrl || savedLang || 'ua';
        const ts = Date.now();
        
        const servRes = await fetch(`${BASE_URL}/data.json?v=${ts}`).then(r => r.json());
        const uiRes = await fetch(`${BASE_URL}/i18n/${langCode}.json?v=${ts}`).then(r => r.json());

        siteData = {
            ui: uiRes,
            services: servRes.services || [],
            availableLanguages: servRes.available_languages || [langCode],
            currentLang: langCode
        };

        applyTheme();
        if (!savedLang) autoDetectRegion(); 
        await initDynamicMenu(); 
        fillStaticTranslations();
        
        if (document.getElementById('siteContent')) renderSite();
        
        // Підтягуємо глобальну суму з бекенду
        await syncGlobalCounter();
        setupFab();
        
    } catch (e) { 
        console.error("ERROR:", e); 
    }
}

function setupFab() {
    const fabBtn = document.getElementById('fabBtn');
    const fabIcon = document.getElementById('fabIcon');
    const isService = document.getElementById('isServicePage');

    if (isService) {
        // Ми на сторінці сервісу
        fabIcon.innerText = "?";
        // Можна змінити колір, якщо хочеш: fabBtn.style.background = "#ffa502"; 
    } else {
        // Ми на головній
        fabIcon.innerText = "+";
    }
}

// Нова функція кліку по FAB
function handleFabClick() {
    const isService = document.getElementById('isServicePage');
    const info = siteData.ui.ui;

    if (isService) {
        // Логіка для "Повідомити про помилку"
        const serviceId = isService.getAttribute('data-service-id');
        document.getElementById('modalTitle').innerText = info.report_error_title || "Помилка в інструкції?";
        document.getElementById('modalDesc').innerText = (info.report_error_desc || "Опишіть, що не так з сервісом") + `: ${serviceId}`;
        document.getElementById('aiServiceInput').placeholder = info.report_error_placeholder || "Наприклад: Кнопка 'Скасувати' змінила місце...";
        document.getElementById('modalBtn').onclick = () => sendReport('error', serviceId);
    } else {
        // Логіка для "Додати сервіс" (стара)
        document.getElementById('modalTitle').innerText = info.feedback_title;
        document.getElementById('modalDesc').innerText = info.feedback_desc;
        document.getElementById('aiServiceInput').placeholder = info.search_placeholder;
        document.getElementById('modalBtn').onclick = () => sendReport('new_service');
    }
    toggleModal();
}

// Універсальна функція відправки
async function sendReport(type, serviceId = "") {
    const input = document.getElementById('aiServiceInput');
    const text = input.value.trim();
    if (!text) return;

    const btn = document.getElementById('modalBtn');
    btn.disabled = true;

    // Формуємо повідомлення так, щоб твій скрипт на бекенді їх розрізняв
    // Наприклад, додаємо префікс [ERROR] або [NEW]
    const prefix = type === 'error' ? `[REPORT_ERROR: ${serviceId}] ` : `[ADD_SERVICE] `;
    const finalMessage = prefix + text;

    try {
        // Відправляємо на твій існуючий BRIDGE_URL
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(finalMessage)}`, { mode: 'no-cors' });
        alert(siteData.ui.ui?.ai_success || "Дякуємо! Повідомлення надіслано.");
        toggleModal();
        input.value = "";
    } catch (e) {
        alert("Помилка відправки");
    } finally {
        btn.disabled = false;
    }
}


// --- ЛІЧИЛЬНИК ТА МІСТОК ---

async function syncGlobalCounter(addUsd = 0) {
    try {
        let url = BRIDGE_URL;
        if (addUsd > 0) {
            url += `?amount=${addUsd}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.total_saved_usd !== undefined) {
            totalSavedUsd = data.total_saved_usd;
            updateCounterDisplay();
        }
    } catch (e) {
        console.error("Counter sync error:", e);
    }
}

// Функція, яка викликається при кліку на кнопку "Скасувати" або на посилання 
async function handlePriceAdd(priceUsd, serviceId) {
    const price = parseFloat(priceUsd);
    if (!price || price <= 0) return;

    // Використовуємо localStorage замість sessionStorage
    // Тепер це збережеться навіть після перезавантаження комп'ютера
    const storageKey = `saved_forever_${serviceId}`;
    
    if (localStorage.getItem(storageKey)) {
        console.log(`Сервіс ${serviceId} вже був врахований раніше.`);
        return;
    }

    // 1. Оновлюємо візуально (миттєво)
    totalSavedUsd += price;
    updateCounterDisplay();

    // 2. Запам'ятовуємо назавжди (в межах цього браузера)
    localStorage.setItem(storageKey, "true");

    // 3. Відправляємо на бекенд
    await syncGlobalCounter(price);
}

function updateCounterDisplay() {
    if (!siteData || !siteData.ui) return;
    const rate = siteData.ui.exchange_rate || 1;
    const cEl = document.getElementById('moneyCounter');
    const curEl = document.getElementById('currency');
    if (cEl) cEl.innerText = Math.round(totalSavedUsd * rate).toLocaleString();
    if (curEl) curEl.innerText = siteData.ui.currency_symbol || '$';
}

// --- ПЕРЕКЛАДИ ТА UI ---

function fillStaticTranslations() {
    if (!siteData || !siteData.ui) return;
    const info = siteData.ui;
    
    const safeSet = (id, val) => { 
        const el = document.getElementById(id); 
        if (el && val) el.innerText = val; 
    };

    // Основні текстові блоки
    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);

    // Блок інтерфейсу (UI)
    if (info.ui) {
        safeSet('footerCreated', info.ui.footer_created);
        safeSet('footerSlogan', info.ui.footer_slogan);
        safeSet('donateTitle', info.ui.donate_t);
        safeSet('donateDesc', info.ui.donate_d);
        safeSet('donateBtn', info.ui.donate_b);
        safeSet('modalTitle', info.ui.feedback_title);
        safeSet('modalDesc', info.ui.feedback_desc);
        
        const mb = document.getElementById('modalBtn');
        if (mb) mb.innerText = info.ui.feedback_btn;

        // Налаштування пошуку
        const si = document.getElementById('searchInput');
        if (si) {
            // Встановлюємо переклад плейсхолдера
            si.placeholder = info.ui.search_placeholder || "Search...";
            
            // ПРИВ'ЯЗКА ГЛОБАЛЬНОГО ПОШУКУ
            // Використовуємо oninput, щоб миттєво реагувати на введення
            si.oninput = (e) => handleSearch(e.target.value);
        }
    }

    // SEO блок внизу сторінки
    const seoEl = document.getElementById('seoContent');
    if (seoEl && info.seo_text) {
        seoEl.innerHTML = info.seo_text;
    }
}

function renderSite() {
    const container = document.getElementById('siteContent');
    if (!container || !siteData || !siteData.ui) return;
    container.innerHTML = '';
    const info = siteData.ui;
    const groups = { 'local': [] };
    const curLang = siteData.currentLang.toLowerCase();

    siteData.services.forEach(s => {
        const sType = (s.type || 'global').toLowerCase();
        if (sType === 'global' || sType === curLang) {
            const type = sType === curLang ? 'local' : (s.category || 'other');
            if (!groups[type]) groups[type] = [];
            groups[type].push(s);
        }
    });

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
                            <img src="${BASE_URL}/assets/icons/${s.id}.png" onerror="this.src='${BASE_URL}/assets/icons/default.png'">
                        </div>
                        <div class="card-name">${s.name}</div>
                    </div>
                `).join('')}
            </div>`;
        container.appendChild(wrapper);
    });
    updateCounterDisplay();
}

function handleServiceClick(serviceId) { 
    window.location.href = `${BASE_URL}/${siteData.currentLang}/${serviceId}/`; 
}

// --- РЕГІОНИ ТА ТЕМИ ---

function autoDetectRegion() {
    const path = window.location.pathname;
    const isRoot = path === BASE_URL + '/' || path === BASE_URL || path === '/';
    if (!isRoot) return;
    if (localStorage.getItem('user_region_set')) return;

    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dL = 'ua';
        if (tz.includes('America')) dL = 'us';
        else if (tz.includes('London')) dL = 'gb';
        else if (tz.includes('Kyiv')) dL = 'ua';
        
        if (dL !== 'ua') {
            localStorage.setItem('user_region_set', 'true');
            window.location.href = `${BASE_URL}/${dL}/`;
        }
    } catch (e) { }
}

async function initDynamicMenu() {
    const list = document.getElementById('dropdownList');
    if (!list || !siteData.availableLanguages) return;
    
    list.innerHTML = '';
    for (const code of siteData.availableLanguages) {
        try {
            const res = await fetch(`${BASE_URL}/i18n/${code}.json`).then(r => r.json());
            const item = document.createElement('div');
            item.className = 'select-item';
            item.innerHTML = `
                <img src="${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png" 
                     onerror="this.src='${BASE_URL}/assets/icons/flags/UNKNOWN.png'" 
                     class="flag-icon">
                <span>${res.label || code.toUpperCase()}</span>
            `;
            
            item.onclick = () => {
                const newLang = code.toLowerCase();
                localStorage.setItem('user_region_set', 'true');
                localStorage.setItem('user_lang', newLang); 

                const currentPath = window.location.pathname;
                
                // Розбиваємо шлях на частини
                // Приклад: /stop_pay/ua/megogo/ -> ["", "stop_pay", "ua", "megogo", ""]
                let pathParts = currentPath.split('/');
                
                // Шукаємо, де в шляху стоїть стара мова (ua, us, gb)
                const langIndex = pathParts.findIndex(part => part === siteData.currentLang);
                
                if (langIndex !== -1) {
                    // Якщо знайшли — замінюємо тільки цей шматочок
                    pathParts[langIndex] = newLang;
                    window.location.href = pathParts.join('/');
                } else {
                    // Якщо чомусь не знайшли (наприклад, корінь) — просто йдемо в нову мовну папку
                    window.location.href = `${BASE_URL}/${newLang}/`;
                }
            };
            list.appendChild(item);

            if (code === siteData.currentLang) {
                const f = document.getElementById('currentFlag');
                const s = document.getElementById('currentShort');
                if (f) f.src = `${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png`;
                if (s) s.innerText = res.short || code.toUpperCase();
            }
        } catch (e) { }
    }
}

function applyTheme() {
    const t = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
}

function toggleTheme() {
    const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('theme', n);
}

function toggleMenu() { document.getElementById('dropdownList').classList.toggle('active'); }
function toggleModal() { document.getElementById('feedbackModal').classList.toggle('active'); }
function closeModalOutside(e) { if (e.target.id === 'feedbackModal') toggleModal(); }

function handleSearch(query) {
    const container = document.getElementById('siteContent');
    if (!container || !siteData) return;

    const q = query.toLowerCase().trim();

    // Якщо пошук порожній — повертаємо звичайний вигляд (категорії)
    if (q === "") {
        renderSite();
        return;
    }

    // Фільтруємо ВСІ сервіси, незалежно від регіону
    const filtered = siteData.services.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.id.toLowerCase().includes(q)
    );

    // Очищуємо контейнер і створюємо блок результатів
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'category-wrapper active';
    
    // Заголовок для результатів пошуку (можна взяти з i18n або просто текст)
    const searchTitle = siteData.ui.ui?.search_results || "SEARCH RESULTS";

    wrapper.innerHTML = `
        <div class="category-header">
            <span>${searchTitle} (${filtered.length})</span>
        </div>
        <div class="category-content" style="display: grid;">
            ${filtered.map(s => `
                <div class="card" onclick="handleServiceClick('${s.id}')">
                    <div class="card-icon-wrapper">
                        <img src="${BASE_URL}/assets/icons/${s.id}.png" onerror="this.src='${BASE_URL}/assets/icons/default.png'">
                    </div>
                    <div class="card-name">${s.name}</div>
                </div>
            `).join('')}
        </div>`;
    
    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.6; margin-top:20px;">${siteData.ui.ui?.no_results || 'No results found'}</p>`;
    } else {
        container.appendChild(wrapper);
    }
}


loadData();
            
