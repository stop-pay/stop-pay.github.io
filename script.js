let siteData = null;

// Завантаження даних
async function loadData() {
    try {
        const response = await fetch('data.json');
        siteData = await response.json();
        applySavedSettings();
        initCustomMenu();
        renderSite();
    } catch (e) { console.error(e); }
}

// Фільтрація сервісів (Пошук)
function filterServices() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('siteContent');
    const lang = localStorage.getItem('lang') || 'EN';
    const info = siteData.languages[lang];

    if (!query) {
        renderSite();
        return;
    }

    container.innerHTML = '';
    const matches = siteData.services.filter(s => s.name.toLowerCase().includes(query));

    if (matches.length > 0) {
        const title = document.createElement('div');
        title.className = 'section-title';
        title.innerText = info.search_results || "Results"; 
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'grid';
        
        matches.forEach(s => {
            grid.innerHTML += createCardHTML(s);
        });
        container.appendChild(grid);
    } else {
        container.innerHTML = `<p style="opacity: 0.5; margin-top: 40px; text-align: center;">${info.search_not_found || "Nothing found"}</p>`;
    }
}

function createCardHTML(s) {
    return `
        <a href="${s.url}" class="card" target="_blank">
            <img src="${s.img}" alt="${s.name}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1055/1055183.png'">
            <div>${s.name}</div>
        </a>
    `;
}

// Модальне вікно (Зворотній зв'язок)
function toggleModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.toggle('active');
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('feedbackModal')) {
        toggleModal();
    }
}

// Логіка кастомного меню вибору мови
function initCustomMenu() {
    const list = document.getElementById('dropdownList');
    list.innerHTML = '';
    Object.keys(siteData.languages).forEach(code => {
        const langData = siteData.languages[code];
        const item = document.createElement('div');
        item.className = 'select-item';
        // Забороняємо Google Translate втручатися в меню
        item.setAttribute('translate', 'no');
        item.innerHTML = `<img src="flags/${code}.png" class="flag-icon"><span>${langData.label}</span>`;
        item.onclick = () => selectLanguage(code);
        list.appendChild(item);
    });
    const saved = localStorage.getItem('lang') || 'EN';
    updateVisuals(saved);
}

function toggleMenu() {
    const dropdown = document.getElementById('dropdownList');
    const arrow = document.querySelector('.arrow');
    dropdown.classList.toggle('active');
    arrow.style.transform = dropdown.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
}

function selectLanguage(code) {
    localStorage.setItem('lang', code);
    updateVisuals(code);
    renderSite();
    toggleMenu();
}

function updateVisuals(code) {
    document.getElementById('currentFlag').src = `flags/${code}.png`;
    document.getElementById('currentShort').innerText = siteData.languages[code].short || code;
}

// Закриття меню при кліку зовні
document.addEventListener('click', function(e) {
    const selector = document.getElementById('langSelector');
    if (selector && !selector.contains(e.target)) {
        document.getElementById('dropdownList').classList.remove('active');
        document.querySelector('.arrow').style.transform = 'rotate(0deg)';
    }
});

// Рендеринг всього контенту
function renderSite() {
    const lang = localStorage.getItem('lang') || 'EN';
    const info = siteData.languages[lang] || siteData.languages['EN'];
    
    document.getElementById('mainTitle').innerText = info.title;
    document.getElementById('mainDesc').innerText = info.desc;
    document.getElementById('searchInput').placeholder = info.search_placeholder || "Search...";
    document.getElementById('seoContent').innerHTML = info.seo_text || "";
    document.getElementById('modalTitle').innerText = info.feedback_title || "Feedback";
    document.getElementById('modalDesc').innerText = info.feedback_desc || "";
    document.getElementById('modalBtn').innerText = info.feedback_btn || "Send";
    document.getElementById('donateTitle').innerText = info.donate_t;
    document.getElementById('donateDesc').innerText = info.donate_d;
    document.getElementById('donateBtn').innerText = info.donate_b;

    const container = document.getElementById('siteContent');
    container.innerHTML = '';

    const types = ['global', lang]; 
    types.forEach(type => {
        const services = siteData.services.filter(s => s.type === type);
        if (services.length > 0) {
            const title = document.createElement('div');
            title.className = 'section-title';
            title.innerText = type === 'global' ? info.global_title : info.local_title;
            container.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'grid';
            services.forEach(s => {
                grid.innerHTML += createCardHTML(s);
            });
            container.appendChild(grid);
        }
    });
}

// Тема оформлення
function applySavedSettings() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) { 
        document.body.setAttribute('data-theme', savedTheme); 
        document.getElementById('themeBtn').innerText = savedTheme === 'dark' ? '☀️' : '🌙'; 
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) { 
        document.body.setAttribute('data-theme', 'dark'); 
        document.getElementById('themeBtn').innerText = '☀️'; 
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    document.getElementById('themeBtn').innerText = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', newTheme);
}

// Старт завантаження
loadData();
