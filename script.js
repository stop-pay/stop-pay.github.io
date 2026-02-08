let siteData = null;

// Початкове значення лічильника (база) + випадкове число для "ефекту життя"
let totalSaved = parseInt(localStorage.getItem('totalSaved')) || 124500;

// --- ЗАВАНТАЖЕННЯ ---
async function loadData() {
    try {
        const response = await fetch('data.json');
        siteData = await response.json();
        
        // Ініціалізація
        updateCounter(0); 
        applySavedSettings();
        initCustomMenu();
        renderSite();
        registerServiceWorker(); // Для PWA
    } catch (e) { 
        console.error("Помилка завантаження даних:", e); 
    }
}

// --- ЛІЧИЛЬНИК ---
function updateCounter(add) {
    totalSaved += add;
    localStorage.setItem('totalSaved', totalSaved);
    
    const counterEl = document.getElementById('moneyCounter');
    if (counterEl) {
        // Анімоване оновлення цифр
        counterEl.innerText = totalSaved.toLocaleString();
    }
}

// --- РЕНДЕРИНГ (АКОРДЕОНИ ТА ГРУПУВАННЯ) ---
function renderSite() {
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang] || siteData.languages['UA'];
    const container = document.getElementById('siteContent');
    
    if (!container) return;
    container.innerHTML = '';

    // Оновлення текстового контенту
    updateStaticTexts(info);

    // 1. Групуємо сервіси за категоріями
    const groups = {};
    siteData.services.forEach(service => {
        // Якщо тип регіональний (наприклад 'UA') — ставимо в 'local', інакше в його категорію
        const catKey = (service.type === lang) ? 'local' : (service.category || 'other');
        
        if (!groups[catKey]) groups[catKey] = [];
        groups[catKey].push(service);
    });

    // 2. Сортуємо категорії (Local завжди перша)
    const sortedCategories = Object.keys(groups).sort((a, b) => {
        if (a === 'local') return -1;
        if (b === 'local') return 1;
        return a.localeCompare(b);
    });

    // 3. Створюємо акордеони
    sortedCategories.forEach(catKey => {
        const wrapper = document.createElement('div');
        // За замовчуванням розгорнута тільки перша категорія
        const isActive = catKey === 'local' ? 'active' : '';
        wrapper.className = `category-wrapper ${isActive}`;
        
        // Отримуємо назву категорії з JSON (наприклад info.cat_tv)
        const catTitle = info[`cat_${catKey}`] || info[`${catKey}_title`] || catKey.toUpperCase();

        wrapper.innerHTML = `
            <div class="category-header" onclick="toggleAccordion(this)">
                <span>${catTitle} (${groups[catKey].length})</span>
                <span class="arrow-cat">▼</span>
            </div>
            <div class="category-content">
                ${groups[catKey].map(s => createCardHTML(s)).join('')}
            </div>
        `;
        container.appendChild(wrapper);
    });
}

function updateStaticTexts(info) {
    document.getElementById('mainTitle').innerText = info.title;
    document.getElementById('mainDesc').innerText = info.desc;
    document.getElementById('searchInput').placeholder = info.search_placeholder || "Search...";
    document.getElementById('seoContent').innerHTML = info.seo_text || "";
    
    // Модалка
    document.getElementById('modalTitle').innerText = info.feedback_title || "Add Service";
    document.getElementById('modalDesc').innerText = info.feedback_desc || "";
    document.getElementById('modalBtn').innerText = info.feedback_btn || "Send";

    // Донат
    document.getElementById('donateTitle').innerText = info.donate_t;
    document.getElementById('donateDesc').innerText = info.donate_d;
    document.getElementById('donateBtn').innerText = info.donate_b;
}

function createCardHTML(s) {
    // При кліку додаємо ціну (з JSON) або 200 за замовчуванням до лічильника
    const price = s.price || 200;
    return `
        <a href="${s.url}" class="card" target="_blank" onclick="updateCounter(${price})">
            <img src="${s.img}" alt="${s.name} cancellation" loading="lazy" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1055/1055183.png'">
            <div>${s.name}</div>
        </a>
    `;
}

function toggleAccordion(element) {
    element.parentElement.classList.toggle('active');
}

// --- ПОШУК (БЕЗ АКОРДЕОНІВ ДЛЯ ЗРУЧНОСТІ) ---
function filterServices() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('siteContent');
    const lang = localStorage.getItem('lang') || 'UA';
    const info = siteData.languages[lang];

    if (!query) {
        renderSite();
        return;
    }

    container.innerHTML = '';
    const matches = siteData.services.filter(s => s.name.toLowerCase().includes(query));

    if (matches.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'grid'; // Використовуємо звичайну сітку для результатів пошуку
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
        grid.style.gap = '15px';
        grid.style.width = '100%';
        
        matches.forEach(s => {
            grid.innerHTML += createCardHTML(s);
        });
        
        const title = document.createElement('div');
        title.className = 'section-title';
        title.innerText = info.search_results || "Results";
        
        container.appendChild(title);
        container.appendChild(grid);
    } else {
        container.innerHTML = `<p style="opacity: 0.5; margin-top: 40px; text-align: center;">${info.search_not_found || "Nothing found"}</p>`;
    }
}

// --- МЕНЮ МОВ ---
function initCustomMenu() {
    const list = document.getElementById('dropdownList');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(siteData.languages).forEach(code => {
        const langData = siteData.languages[code];
        const item = document.createElement('div');
        item.className = 'select-item';
        item.setAttribute('translate', 'no');
        item.innerHTML = `<img src="flags/${code}.png" class="flag-icon"><span>${langData.label}</span>`;
        item.onclick = () => selectLanguage(code);
        list.appendChild(item);
    });
    updateVisuals(localStorage.getItem('lang') || 'UA');
}

function toggleMenu() {
    const dropdown = document.getElementById('dropdownList');
    const arrow = document.querySelector('.arrow');
    if (dropdown) dropdown.classList.toggle('active');
    if (arrow) arrow.style.transform = dropdown.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
}

function selectLanguage(code) {
    localStorage.setItem('lang', code);
    updateVisuals(code);
    renderSite();
    toggleMenu();
}

function updateVisuals(code) {
    const flagImg = document.getElementById('currentFlag');
    const shortText = document.getElementById('currentShort');
    if (flagImg) flagImg.src = `flags/${code}.png`;
    if (shortText) shortText.innerText = siteData.languages[code]?.short || code;
}

// --- ТЕМА ТА МОДАЛКА ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.innerText = next === 'dark' ? '☀️' : '🌙';
}

function applySavedSettings() {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.innerText = savedTheme === 'dark' ? '☀️' : '🌙';
}

function toggleModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.toggle('active');
}

function closeModalOutside(e) {
    if (e.target.id === 'feedbackModal') toggleModal();
}

// --- PWA SERVICE WORKER ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
        });
    }
}

// Клік поза меню закриває його
document.addEventListener('click', (e) => {
    const selector = document.getElementById('langSelector');
    if (selector && !selector.contains(e.target)) {
        const dropdown = document.getElementById('dropdownList');
        if (dropdown) dropdown.classList.remove('active');
        const arrow = document.querySelector('.arrow');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
});

loadData();
