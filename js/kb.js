/**
 * kb.js — Реестр разделов и операций базы знаний + клиентская «база данных»
 *
 * Единый источник правды для:
 *  - навигации по разделам (dashboard);
 *  - фильтрации контента по правам доступа пользователя;
 *  - реестра операций (для кнопки «Ознакомлен» и страницы мониторинга).
 *
 * Хранение отметок об ознакомлении и пользовательской базы — localStorage
 * (ключи KB_READ_KEY / KB_USERS_KEY). Это прототип: при переходе на бэкенд
 * функции API сохраняются, меняется только слой хранения.
 */

// === Роли ===
const ROLE_ADMIN   = 'Администратор';
const ROLE_WORKER  = 'Сотрудник производства';
const ROLE_GUEST   = 'Гость';

// === Ключи хранилища ===
const KB_DB_KEY    = 'kb_db_v1';     // { users: [...] }
const KB_READ_KEY  = 'kb_reads_v1';  // [{ userId, opId, version, timestamp }]

// === Разделы базы знаний ===
const KB_SECTIONS = [
    { id: 'preparation', num: '01', title: 'Заготовка',        img: 'assets/images/icons/section-1-zagotovka.svg', desc: 'Напил элементов каркаса, листового материала, отделочной доски и заготовка для сборки модуля', page: 'pages/preparation.html' },
    { id: 'panels',      num: '02', title: 'Сборка панелей',   img: 'assets/images/icons/section-2-panels.svg', desc: 'Изготовление панелей пола, крыши, внешних и внутренних стен модуля', page: 'pages/panels.html' },
    { id: 'module',      num: '03', title: 'Сборка модуля',    img: 'assets/images/icons/section-3-module.svg', desc: 'Сборка каркаса, кровельные работы, внутренний контур, инженерные системы', page: 'pages/module.html' },
    { id: 'options',     num: '04', title: 'Сборка опций',     img: 'assets/images/icons/section-4-options.svg', desc: 'Террасы, веранды, навесы и крыльца — дополнительные конструкции к модулю', page: 'pages/options.html' },
    { id: 'installation',num: '05', title: 'Монтаж',           img: 'assets/images/icons/section-5-installation.svg', desc: 'Доставка, установка и стыковка модулей на фундаменте заказчика', page: 'pages/installation.html' },
    { id: 'service',     num: '06', title: 'Сервис',           img: 'assets/images/icons/section-6-service.svg', desc: 'Сезонное обслуживание, гарантийный ремонт и диагностика систем', page: 'pages/service.html' }
];

// === Реестр операций ===
// section — id раздела из KB_SECTIONS; status: ready — страница существует, planned — в разработке.
const KB_OPERATIONS = [
    { id: '2.1.1',  section: 'panels', title: 'Сборка каркаса панели',            version: 1, status: 'ready',   url: 'pages/operations/2.1.1.html' },
    { id: '2.1.2',  section: 'panels', title: 'Монтаж листового материала на каркас',              version: 1, status: 'ready',   url: 'pages/operations/2.1.2.html' },
    { id: '2.1.3',  section: 'panels', title: 'Монтаж второго слоя листового материала',                         version: 1, status: 'ready',   url: 'pages/operations/2.1.3.html' },
    { id: '2.1.4',  section: 'panels', title: 'Монтаж трассы канализации',                          version: 1, status: 'ready',   url: 'pages/operations/2.1.4.html' },
    { id: '2.1.5',  section: 'panels', title: 'Прокладка электролиний и установка гильз',                          version: 1, status: 'ready',   url: 'pages/operations/2.1.5.html' },
    { id: '2.1.6',  section: 'panels', title: 'Утепление панели ППУ',                     version: 1, status: 'ready',   url: 'pages/operations/2.1.6.html' },
    { id: '2.1.7',  section: 'panels', title: 'Утепление панели мин.ватой',                        version: 1, status: 'ready',   url: 'pages/operations/2.1.7.html' },
    { id: '2.1.8',  section: 'panels', title: 'Укладка ветрозащиты',                 version: 1, status: 'ready',   url: 'pages/operations/2.1.8.html' },
    { id: '2.1.9',  section: 'panels', title: 'Укладка защитной сетки',      version: 1, status: 'ready',   url: 'pages/operations/2.1.9.html' },
    { id: '2.1.10', section: 'panels', title: 'Установка закладных элементов панели пола',      version: 1, status: 'ready',   url: 'pages/operations/2.1.10.html' },
    { id: '2.1.11', section: 'panels', title: 'Приёмка и маркировка готовой панели пола',       version: 1, status: 'ready',   url: 'pages/operations/2.1.11.html' },
    { id: '2.2.1',  section: 'panels', title: 'Сборка каркаса кровельной панели',                    version: 1, status: 'ready',   url: 'pages/operations/2.2.1.html' },
    { id: '2.2.2',  section: 'panels', title: 'Укладка листового материала на каркас панели',                      version: 1, status: 'ready',   url: 'pages/operations/2.2.2.html' },
    // Пример операции в статусе «в разработке» (страница появится позже):
    { id: '2.3.1',  section: 'panels', title: 'Каркас панели крыши (в разработке)',             version: 1, status: 'planned', url: '' }
];



// === Операции, доступные гостям с назначенным доступом к разделу ===
// undefined (нет ограничения) => все готовые операции раздела;
// список id => только перечисленные операции раздела.
const PUBLIC_OP_IDS = undefined;

/** Может ли пользователь подтверждать ознакомление (кнопка «Ознакомлен») */
function kbUserCanConfirmRead(user) {
    // По ТЗ: только Сотрудник производства; Гость и Администратор — нет
    return !!user && user.role === ROLE_WORKER;
}

// ============================================================
// Клиентская база данных (localStorage)
// ============================================================

function kbLoadDb() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KB_DB_KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.users)) {
        // Инициализация из демо-базы users.js (пароли в прототипе открытые)
        const seed = (typeof USERS_DB !== 'undefined') ? USERS_DB : [];
        db = { users: seed.map(u => ({ ...u })) };
        kbSaveDb(db);
    }
    return db;
}

function kbSaveDb(db) {
    localStorage.setItem(KB_DB_KEY, JSON.stringify(db));
}

/** Все пользователи (демо-база + созданные администратором) */
function kbGetUsers() {
    const byName = {};
    ((typeof USERS_DB !== 'undefined') ? USERS_DB : []).forEach(u => { byName[u.username] = u; });
    kbLoadDb().users.forEach(u => { byName[u.username] = u; });
    return Object.values(byName);
}

function kbFindUser(username) {
    return kbGetUsers().find(u => u.username === username) || null;
}

function kbAddUser(data) {
    if (!data.username || !data.password || !data.name || !data.role) {
        throw new Error('Заполните все поля: ФИО, логин, пароль, роль');
    }
    const db = kbLoadDb();
    if (kbFindUser(data.username)) throw new Error('Пользователь с таким логином уже существует');
    db.users.push({
        username: data.username.trim(),
        password: data.password,
        name: data.name.trim(),
        role: data.role,
        access: data.access || []
    });
    kbSaveDb(db);
}

function kbDeleteUser(username) {
    const db = kbLoadDb();
    db.users = db.users.filter(u => u.username !== username);
    kbSaveDb(db);
}

function kbSetPassword(username, newPassword) {
    if (!newPassword) throw new Error('Пароль не может быть пустым');
    const db = kbLoadDb();
    const u = db.users.find(x => x.username === username);
    if (!u) throw new Error('Пользователь не найден');
    u.password = newPassword;
    kbSaveDb(db);
}

function kbSetAccess(username, accessList) {
    const db = kbLoadDb();
    const u = db.users.find(x => x.username === username);
    if (!u) throw new Error('Пользователь не найден');
    u.access = Array.isArray(accessList) ? [...accessList] : [];
    kbSaveDb(db);
}

// ============================================================
// Отметки «Ознакомлен»
// ============================================================

function kbGetReads() {
    try {
        const arr = JSON.parse(localStorage.getItem(KB_READ_KEY));
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

/** Есть ли у пользователя подтверждённая отметка текущей версии операции */
function kbHasRead(userId, opId, version) {
    return kbGetReads().some(r => r.userId === userId && r.opId === opId && r.version === version);
}

function kbAddRead(userId, opId, version) {
    if (kbHasRead(userId, opId, version)) return false;
    const reads = kbGetReads();
    reads.push({ userId, opId, version, timestamp: new Date().toISOString() });
    localStorage.setItem(KB_READ_KEY, JSON.stringify(reads));
    return true;
}

// ============================================================
// Права доступа
// ============================================================

function kbUserCanViewSection(user, sectionId) {
    if (!user) return false;
    if (user.role === ROLE_ADMIN) return true;
    // Гость и Сотрудник производства — только по назначенному списку разделов
    return Array.isArray(user.access) && user.access.includes(sectionId);
}

function kbUserCanViewOperation(user, op) {
    if (!user) return false;
    if (user.role === ROLE_ADMIN) return true;
    if (!kbUserCanViewSection(user, op.section)) return false;
    // Дополнительное ограничение для гостя: конкретные операции (если задано)
    if (user.role === ROLE_GUEST && Array.isArray(PUBLIC_OP_IDS)) {
        return PUBLIC_OP_IDS.includes(op.id);
    }
    return true;
}

/** Доступен ли раздел по URL-имени файла страницы (preparation.html → preparation) */
function kbCanViewPageByFile(user, fileName) {
    const sec = KB_SECTIONS.find(s => s.page.endsWith(fileName));
    if (!sec) return true; // неизвестная страница — не блокируем
    return kbUserCanViewSection(user, sec.id);
}

function kbGetSectionById(id) {
    return KB_SECTIONS.find(s => s.id === id) || null;
}

function kbGetOperationById(id) {
    return KB_OPERATIONS.find(o => o.id === id) || null;
}

// ============================================================
// Служебное: относительный путь к корню
// ============================================================

function kbRootPrefix() {
    return window.location.pathname.includes('/pages/') ? '../' : './';
}

// ============================================================
// Guard — защита страниц и навигации (подключается вместо auth.js)
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    const prefix = kbRootPrefix();

    // --- Защита контентных страниц ---
    const isContentPage = window.location.pathname.includes('/pages/');
    const isPublicPage  = /search\.html$/.test(window.location.pathname); // поиск доступен всем
    if (isContentPage && !isPublicPage) {
        if (!isAuthenticated()) {
            window.location.href = prefix + 'index.html';
            return;
        }
        const user = getCurrentUser();
        const file = window.location.pathname.split('/').pop();
        if (file !== 'dashboard.html' && !kbCanViewPageByFile(user, file)) {
            blockPage(user);
            return;
        }
        // Страницы операций: дополнительная проверка по реестру (гость — только разрешённые операции)
        const opMatch = window.location.pathname.match(/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch) {
            const op = kbGetOperationById(opMatch[1]);
            if (op && !kbUserCanViewOperation(user, op)) { blockPage(user); return; }
        }
    }

    function blockPage(user) {
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `
            <div style="max-width:560px;margin:120px auto;text-align:center;font-family:Inter,sans-serif;padding:0 20px;">
                <div style="font-size:56px;">🔒</div>
                <h1 style="font-size:24px;margin:16px 0 8px;">Нет доступа к разделу</h1>
                <p style="color:#64748b;line-height:1.6;">Пользователю «${user.name}» (${user.role}) не назначен доступ к этому разделу базы знаний. Обратитесь к администратору.</p>
                <a href="${prefix}dashboard.html" style="display:inline-block;margin-top:24px;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Вернуться на главную</a>
            </div>`;
    }

    // --- Панель пользователя в шапке + выход ---
    const userNameEl = document.getElementById('userName');
    if (userNameEl && isAuthenticated()) {
        const user = getCurrentUser();
        const roleEl = document.getElementById('userRole');
        const avatarEl = document.getElementById('userAvatar');
        if (roleEl) roleEl.textContent = user.role;
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
        if (user.name) userNameEl.textContent = user.name;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = function (e) {
                e.preventDefault();
                logout();
                window.location.href = prefix + 'index.html';
            };
        }
    }

    // --- Администратор: ссылка на панель управления ---
    if (isAuthenticated() && getCurrentUser().role === ROLE_ADMIN) {
        const right = document.querySelector('.top-bar-right');
        if (right && !right.querySelector('.btn-admin')) {
            const a = document.createElement('a');
            a.className = 'btn-admin';
            a.href = prefix + 'admin-panel.html';
            a.title = 'Панель управления';
            a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Управление</span>';
            right.insertBefore(a, right.firstChild);
        }
    }

    // --- Dashboard: карточки разделов из реестра с фильтром по правам ---
    const grid = document.getElementById('cardsGrid');
    if (grid && isAuthenticated()) {
        const user = getCurrentUser();
        grid.innerHTML = '';
        let visible = 0;
        KB_SECTIONS.forEach(sec => {
            const allowed = kbUserCanViewSection(user, sec.id);
            if (allowed) visible++;
            const card = document.createElement(allowed ? 'a' : 'div');
            card.className = 'card card-section' + (allowed ? '' : ' card-disabled');
            if (allowed) card.href = prefix + sec.page;
            const opsTotal = KB_OPERATIONS.filter(o => o.section === sec.id).length;
            card.innerHTML = `
                <div class="card-number">${sec.num}</div>
                <div class="card-icon"><img src="${sec.img}" alt=""></div>
                <h3>${sec.title}</h3>
                <p>${sec.desc}</p>
                <div class="card-stats">
                    <span class="card-badge">${opsTotal ? opsTotal + ' операций' : 'в разработке'}</span>
                    ${allowed ? '' : '<span class="card-badge card-badge-lock">🔒 Нет доступа</span>'}
                </div>`;
            grid.appendChild(card);
        });
        const statSec = document.getElementById('stat-sections');
        if (statSec) statSec.textContent = String(visible);
        const statOps = document.getElementById('stat-operations');
        if (statOps) {
            const n = KB_OPERATIONS.filter(o => o.status === 'ready' && kbUserCanViewOperation(user, o)).length;
            statOps.textContent = String(n);
        }
    }

    // --- Страницы раздела: скрыть ссылки на операции без права ---
    if (isContentPage && isAuthenticated()) {
        const user = getCurrentUser();
        document.querySelectorAll('a[href*="operations/"]').forEach(link => {
            const m = link.getAttribute('href').match(/(\d+\.\d+\.\d+)\.html/);
            if (!m) return;
            const op = kbGetOperationById(m[1]);
            if (op && !kbUserCanViewOperation(user, op)) {
                const li = link.closest('li');
                if (li) li.remove(); else link.remove();
            }
        });
    }
});
