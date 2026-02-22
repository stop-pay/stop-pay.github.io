let siteData = null;
let totalSavedUsd = 0;

const isGithub = window.location.hostname.includes('github.io');
const BASE_URL = isGithub ? '/stop_pay' : ''; 
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbywfH00K-KVqfhkPQwWy4P2Knaa0hS1KP1TD6zDfn2K9Bd31Td1pPRxGRj5t1Xt7j1voQ/exec"; 

// --- 1. ІНІЦІАЛІЗАЦІЯ ПРИ ЗАВАНТАЖЕННІ ---

// Викликаємо setupFab миттєво для іконки
setupFab();

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
        
        await syncGlobalCounter();
        setupFab(); // Повторний виклик після завантаження даних для впевненості
        
    } catch (e) { 
        console.error("ERROR:", e); 
    }
}

// --- 2. ЛОГІКА FAB (КНОПКА ЗВОРОТНОГО ЗВ'ЯЗКУ) ---

function setupFab() {
    const fabIcon = document.getElementById('fabIcon');
    const isService = document.getElementById('isServicePage');
    if (!fabIcon) return;
    fabIcon.innerText = isService ? "?" : "+";
}

async function handleFabClick() {
    if (!siteData || !siteData.ui) { toggleModal(); return; }
    
    const isService = document.getElementById('isServicePage');
    const ui = siteData.ui.ui;
    const mTitle = document.getElementById('modalTitle');
    const mDesc = document.getElementById('modalDesc');
    const mInput = document.getElementById('aiServiceInput');
    const mBtn = document.getElementById('modalBtn');

    if (isService) {
        const serviceId = isService.getAttribute('data-service-id');
        mTitle.innerText = ui.report_error_title || "Error?";
        mDesc.innerText = `${ui.report_error_desc || "Report issue for"} ${serviceId.toUpperCase()}`;
        mInput.placeholder = ui.report_error_placeholder || "...";
        mBtn.onclick = () => sendReport('error', serviceId);
    } else {
        mTitle.innerText = ui.feedback_title;
        mDesc.innerText = ui.feedback_desc;
        mInput.placeholder = ui.search_placeholder;
        mBtn.onclick = () => sendReport('new_service');
    }

    mBtn.innerText = ui.feedback_btn;
    toggleModal();
}

async function sendReport(type, serviceId = "") {
    const input = document.getElementById('aiServiceInput');
    const text = input.value.trim();
    
    // Перевірка, чи завантажені дані мови
    if (!siteData || !siteData.ui || !siteData.ui.ui) return;
    const ui = siteData.ui.ui;
    
    if (!text) return;

    const btn = document.getElementById('modalBtn');
    const originalText = btn.innerText;

    // Візуальний фідбек: блокуємо кнопку
    btn.disabled = true;
    btn.innerText = ui.ai_sending || "...";

    // Формуємо префікс для розрізнення типів заявок на бекенді
    const prefix = type === 'error' ? `[REPORT_ERROR: ${serviceId}] ` : `[ADD_SERVICE] `;
    const finalMessage = prefix + text;

    try {
        // Відправка даних на Google Script
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(finalMessage)}`, { 
            mode: 'no-cors' 
        });
        
        // Вибір повідомлення залежно від контексту (помилка чи новий сервіс)
        const successMsg = type === 'error' 
            ? (ui.report_success || "Дякуємо! Ми перевіримо цю інструкцію.") 
            : (ui.ai_success || "Запит прийнято! Сервіс буде додано.");
            
        alert(successMsg);

        // Очищення та закриття
        toggleModal();
        input.value = "";
    } catch (e) {
        console.error("Send error:", e);
        alert(ui.ai_error || "Помилка при відправці. Спробуйте пізніше.");
    } finally {
        // Повертаємо кнопку в початковий стан
        btn.disabled = false;
        btn.innerText = originalText;
    }
}


// --- 3. ПОШУК ТА ПЕРЕКЛАДИ ---

function handleSearch(query) {
    const container = document.getElementById('siteContent');
    if (!container || !siteData) return;
    const q = query.toLowerCase().trim();

    if (q === "") { renderSite(); return; }

    const filtered = siteData.services.filter(s => 
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'category-wrapper active';
    const searchTitle = siteData.ui.ui?.search_results || "SEARCH RESULTS";

    wrapper.innerHTML = `
        <div class="category-header"><span>${searchTitle} (${filtered.length})</span></div>
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
        container.innerHTML = `<p style="text-align:center; opacity:0.6; margin-top:20px;">${siteData.ui.ui?.search_not_found || 'Not found'}</p>`;
    } else {
        container.appendChild(wrapper);
    }
}

function fillStaticTranslations() {
    if (!siteData || !siteData.ui) return;
    const info = siteData.ui;
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el && val) el.innerText = val; };

    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);

    if (info.ui) {
        safeSet('footerCreated', info.ui.footer_created);
        safeSet('footerSlogan', info.ui.footer_slogan);
        safeSet('donateTitle', info.ui.donate_t);
        safeSet('donateDesc', info.ui.donate_d);
        safeSet('donateBtn', info.ui.donate_b);
        
        const si = document.getElementById('searchInput');
        if (si) {
            si.placeholder = info.ui.search_placeholder || "Search...";
            si.oninput = (e) => handleSearch(e.target.value);
        }
    }

    const seoEl = document.getElementById('seoContent');
    if (seoEl && info.seo_text) seoEl.innerHTML = info.seo_text;
}

// --- 4. РЕНДЕР ТА КЕРУВАННЯ КОШТАМИ ---

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
                <span>${catTitle} (${groups[key].length})</span><span class="arrow-cat">▼</span>
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

async function syncGlobalCounter(addUsd = 0) {
    try {
        let url = addUsd > 0 ? `${BRIDGE_URL}?amount=${addUsd}` : BRIDGE_URL;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.total_saved_usd !== undefined) {
            totalSavedUsd = data.total_saved_usd;
            updateCounterDisplay();
        }
    } catch (e) { console.error("Counter sync error:", e); }
}

async function handlePriceAdd(priceUsd, serviceId) {
    const price = parseFloat(priceUsd);
    if (!price || price <= 0) return;
    const storageKey = `saved_forever_${serviceId}`;
    if (localStorage.getItem(storageKey)) return;

    totalSavedUsd += price;
    updateCounterDisplay();
    localStorage.setItem(storageKey, "true");
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

// --- 5. ДОПОМІЖНІ ФУНКЦІЇ ---

function handleServiceClick(serviceId) { 
    window.location.href = `${BASE_URL}/${siteData.currentLang}/${serviceId}/`; 
}

function autoDetectRegion() {
    const path = window.location.pathname;
    if (path !== BASE_URL + '/' && path !== BASE_URL && path !== '/') return;
    if (localStorage.getItem('user_region_set')) return;
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dL = tz.includes('America') ? 'us' : (tz.includes('London') ? 'gb' : 'ua');
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
            item.innerHTML = `<img src="${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png" onerror="this.src='${BASE_URL}/assets/icons/flags/UNKNOWN.png'" class="flag-icon"><span>${res.label || code.toUpperCase()}</span>`;
            item.onclick = () => {
                localStorage.setItem('user_region_set', 'true');
                localStorage.setItem('user_lang', code.toLowerCase());
                let pathParts = window.location.pathname.split('/');
                const langIndex = pathParts.findIndex(part => part === siteData.currentLang);
                if (langIndex !== -1) { pathParts[langIndex] = code.toLowerCase(); window.location.href = pathParts.join('/'); }
                else { window.location.href = `${BASE_URL}/${code.toLowerCase()}/`; }
            };
            list.appendChild(item);
            if (code === siteData.currentLang) {
                document.getElementById('currentFlag').src = `${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png`;
                document.getElementById('currentShort').innerText = res.short || code.toUpperCase();
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

loadData();
        
