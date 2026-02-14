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
        
    } catch (e) { 
        console.error("ERROR:", e); 
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

    safeSet('counterLabel', info.total_saved);
    safeSet('mainDesc', info.desc);

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

        const si = document.getElementById('searchInput');
        if (si) si.placeholder = info.ui.search_placeholder;
    }

    const seoEl = document.getElementById('seoContent');
    if (seoEl && info.seo_text) seoEl.innerHTML = info.seo_text;
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
                            <img src="${BASE_URL}/${s.img || s.icon}" onerror="this.src='${BASE_URL}/assets/icons/default.png'">
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
            item.innerHTML = `<img src="${BASE_URL}/assets/icons/flags/${code.toUpperCase()}.png" class="flag-icon"><span>${res.label || code.toUpperCase()}</span>`;
            item.onclick = () => {
                localStorage.setItem('user_lang', code.toLowerCase());
                window.location.href = `${BASE_URL}/${code.toLowerCase()}/`;
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

async function sendToAi() {
    const input = document.getElementById('aiServiceInput');
    const name = input.value.trim();
    if (!name) return;
    const btn = document.getElementById('modalBtn');
    btn.disabled = true; btn.innerText = "...";
    try {
        await fetch(`${BRIDGE_URL}?service=${encodeURIComponent(name)}`, { mode: 'no-cors' });
        alert(siteData.ui.ui?.ai_success || "Sent!"); 
        toggleModal(); input.value = "";
    } catch (e) { alert("Error"); }
    finally { btn.disabled = false; btn.innerText = siteData.ui.ui?.feedback_btn || "Send"; }
}

loadData();
            
