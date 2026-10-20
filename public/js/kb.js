/**
 * kb.js — Реестр разделов и операций базы знаний + клиентская логика
 * ИСПРАВЛЕНО: 
 * 1. Добавлена кнопка "Мониторинг" для ролей Гость и Сотрудник производства.
 * 2. Убраны пробелы в URL операций.
 * 3. Исправлен редирект при блокировке доступа (абсолютный путь).
 */

// === Роли ===
const ROLE_ADMIN   = 'Администратор';
const ROLE_WORKER  = 'Сотрудник производства';
const ROLE_GUEST   = 'Гость';

// === Ключи хранилища (используются для отметок ознакомления) ===
const KB_READ_KEY  = 'kb_reads_v1'; 
const KB_ARCHIVE_KEY = 'kb_reads_archive_v1';

// === Разделы базы знаний ===
const KB_SECTIONS = [
    { id: 'preparation', num: '01', title: 'Заготовка',        img: 'assets/images/icons/section-1-zagotovka.svg', desc: 'Напил элементов каркаса, листового материала, отделочной доски и заготовка для сборки модуля', page: 'pages/preparation.html' },
    { id: 'panels',      num: '02', title: 'Сборка панелей',   img: 'assets/images/icons/section-2-panels.svg', desc: 'Изготовление панелей пола, крыши, внешних и внутренних стен модуля', page: 'pages/panels.html' },
    { id: 'module',      num: '03', title: 'Сборка модуля',    img: 'assets/images/icons/section-3-module.svg', desc: 'Сборка каркаса, кровельные работы, внутренний контур, инженерные системы', page: 'pages/module.html' },
    { id: 'options',     num: '04', title: 'Сборка опций',     img: 'assets/images/icons/section-4-options.svg', desc: 'Террасы, веранды, навесы и крыльца — дополнительные конструкции к модулю', page: 'pages/options.html' },
    { id: 'installation',num: '05', title: 'Монтаж',           img: 'assets/images/icons/section-5-installation.svg', desc: 'Доставка, установка и стыковка модулей на фундаменте заказчика', page: 'pages/installation.html' },
    { id: 'service',     num: '06', title: 'Сервис',           img: 'assets/images/icons/section-6-service.svg', desc: 'Сезонное обслуживание, гарантийный ремонт и диагностика систем', page: 'pages/service.html' }
];

// === Реестр операций (ИСПРАВЛЕНО: убраны лишние пробелы в url и title) ===
const KB_OPERATIONS = [
    { id: '2.1.1',  section: 'panels', title: 'Сборка каркаса панели',            version: 1, status: 'ready',   url: 'pages/operations/2.1.1.html' },
    { id: '2.1.2',  section: 'panels', title: 'Монтаж листового материала на каркас',              version: 1, status: 'ready',   url: 'pages/operations/2.1.2.html' },
    { id: '2.1.3',  section: 'panels', title: 'Монтаж второго слоя листового материала',                         version: 1, status: 'ready',   url: 'pages/operations/2.1.3.html' },
    { id: '2.1.4',  section: 'panels', title: 'Монтаж трассы канализации',                          version: 1, status: 'ready',   url: 'pages/operations/2.1.4.html' },
    { id: '2.1.5',  section: 'panels', title: 'Прокладка электролиний',                          version: 1, status: 'ready',   url: 'pages/operations/2.1.5.html' },
    { id: '2.1.6',  section: 'panels', title: 'Монтаж гильз под коммуникации',                     version: 1, status: 'ready',   url: 'pages/operations/2.1.6.html' },
    { id: '2.1.7',  section: 'panels', title: 'Утепление панели ППУ',                        version: 1, status: 'ready',   url: 'pages/operations/2.1.7.html' },
    { id: '2.1.8',  section: 'panels', title: 'Утепление панели мин.ватой',                 version: 1, status: 'ready',   url: 'pages/operations/2.1.8.html' },
    { id: '2.1.9',  section: 'panels', title: 'Монтаж ветрозащиты, монтаж уплотнительных манжет / проклейка гильз пароизоляционным скотчем',      version: 1, status: 'ready',   url: 'pages/operations/2.1.9.html' },
    { id: '2.1.10', section: 'panels', title: 'Монтаж защитной сетки',      version: 1, status: 'ready',   url: 'pages/operations/2.1.10.html' },
    { id: '2.1.11', section: 'panels', title: 'Монтаж лежней',       version: 1, status: 'ready',   url: 'pages/operations/2.1.11.html' },
    { id: '2.1.12', section: 'panels', title: 'Контроль качества панели. Маркировка',       version: 1, status: 'ready',   url: 'pages/operations/2.1.12.html' },
    { id: '2.2.1',  section: 'panels', title: 'Сборка каркаса кровельной панели',                    version: 1, status: 'ready',   url: 'pages/operations/2.2.1.html' },
    { id: '2.2.2',  section: 'panels', title: 'Укладка листового материала на каркас панели',                      version: 1, status: 'ready',   url: 'pages/operations/2.2.2.html' },
    { id: '2.2.3',  section: 'panels', title: 'Монтаж финишной отделки',                      version: 1, status: 'ready',   url: 'pages/operations/2.2.3.html' },
    // Подраздел 2.3
    { id: '2.3.1',  section: 'panels', title: 'Сборка каркаса внешней стены',                version: 1, status: 'draft',   url: 'pages/operations/2.3.1.html' },
    { id: '2.3.2',  section: 'panels', title: 'Установка оконных и дверных проёмов',         version: 1, status: 'draft',   url: 'pages/operations/2.3.2.html' },
    { id: '2.3.3',  section: 'panels', title: 'Монтаж плит с внешней стороны',               version: 1, status: 'draft',   url: 'pages/operations/2.3.3.html' },
    // Подраздел 2.4
    { id: '2.4.1',  section: 'panels', title: 'Сборка каркаса внутренней стены',             version: 1, status: 'draft',   url: 'pages/operations/2.4.1.html' },
    { id: '2.4.2',  section: 'panels', title: 'Установка дверных проёмов',                   version: 1, status: 'draft',   url: 'pages/operations/2.4.2.html' },
    { id: '2.4.3',  section: 'panels', title: 'Монтаж ГВЛ/ОСБ',                              version: 1, status: 'draft',   url: 'pages/operations/2.4.3.html' }
];

const PUBLIC_OP_IDS = undefined;

/** Может ли пользователь подтверждать ознакомление */
function kbUserCanConfirmRead(user) {
    return !!user && user.role === ROLE_WORKER;
}

/**
 * Актуальный профиль текущего пользователя.
 * Читает ТОЛЬКО из sessionStorage (обновляется access-guard.js).
 */
function kbGetCurrentUser() {
    try {
        const data = sessionStorage.getItem('modular_house_session');
        if (!data) return null;
        
        const user = JSON.parse(data);
        if (!user.role) return null;
        
        // Нормализуем роль для проверки прав
        if (user.role === 'admin') user.role = 'Администратор';
        else if (user.role === 'worker') user.role = 'Сотрудник производства';
        else if (user.role === 'guest') user.role = 'Гость';

        return user;
    } catch (e) {
        console.error('Ошибка чтения сессии:', e);
        return null;
    }
}

// ============================================================
// Отметки «Ознакомлен» (локальный реестр для совместимости)
// ============================================================
function kbGetReads() {
    try {
        const arr = JSON.parse(localStorage.getItem(KB_READ_KEY));
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

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
    
    if (!Array.isArray(user.access) || user.access.length === 0) return false;
    return user.access.includes(sectionId);
}

function kbUserCanViewOperation(user, op) {
    if (!user) return false;
    if (user.role === ROLE_ADMIN) return true;
    if (!kbUserCanViewSection(user, op.section)) return false;
    
    if (user.role === ROLE_GUEST && Array.isArray(PUBLIC_OP_IDS)) {
        return PUBLIC_OP_IDS.includes(op.id);
    }
    return true;
}

function kbCanViewPageByFile(user, fileName) {
    const opMatch = fileName.match(/^(\d+\.\d+\.\d+)\.html$/);
    if (opMatch) {
        const op = kbGetOperationById(opMatch[1]);
        if (op && op.status === 'draft' && user.role !== ROLE_ADMIN) return false;
    }
    const sec = KB_SECTIONS.find(s => s.page.endsWith(fileName));
    if (!sec) return true; 
    return kbUserCanViewSection(user, sec.id);
}

function kbGetSectionById(id) {
    return KB_SECTIONS.find(s => s.id === id) || null;
}

function kbGetOperationById(id) {
    return KB_OPERATIONS.find(o => o.id === id) || null;
}

// ============================================================
// Служебное
// ============================================================
function kbRootPrefix() {
    return window.location.pathname.includes('/pages/') ? '../' : './';
}

// ============================================================
// Guard — защита страниц и навигации
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    const prefix = kbRootPrefix();

    // --- Защита контентных страниц ---
    const isContentPage = window.location.pathname.includes('/pages/');
    const isPublicPage  = /search\.html$/.test(window.location.pathname);

    if (isContentPage && !isPublicPage) {
        const user = (typeof kbGetCurrentUser === 'function') ? kbGetCurrentUser() : null;
        
        if (!user) {
            if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
                 window.location.href = prefix + 'index.html';
                 return;
            }
        }

        if (user) {
            const file = window.location.pathname.split('/').pop();
            if (file !== 'dashboard.html' && !kbCanViewPageByFile(user, file)) {
                blockPage(user);
                return;
            }
            
            const opMatch = window.location.pathname.match(/operations\/(\d+\.\d+\.\d+)\.html$/);
            if (opMatch) {
                const op = kbGetOperationById(opMatch[1]);
                if (op && !kbUserCanViewOperation(user, op)) { blockPage(user); return; }
            }
        }
    }

    function blockPage(user) {
        const main = document.querySelector('main') || document.body;
        // ИСПРАВЛЕНО: Абсолютный путь /dashboard.html
        main.innerHTML = `
            <div style="max-width:560px;margin:120px auto;text-align:center;font-family:Inter,sans-serif;padding:0 20px;">
                <div style="font-size:56px;">🔒</div>
                <h1 style="font-size:24px;margin:16px 0 8px;">Нет доступа к разделу</h1>
                <p style="color:#64748b;line-height:1.6;">Пользователю «${user.name}» (${user.role}) не назначен доступ к этому разделу базы знаний. Обратитесь к администратору.</p>
                <a href="/dashboard.html" style="display:inline-block;margin-top:24px;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Вернуться в базу знаний</a>
            </div>`;
    }

    // --- Панель пользователя в шапке + выход ---
    let userNameEl = document.getElementById('currentUserName') || document.getElementById('userName');
    if (userNameEl && typeof isAuthenticated === 'function' && isAuthenticated()) {
        const user = kbGetCurrentUser();
        if (user) {
            const roleEl = document.getElementById('currentUserRole') || document.getElementById('userRole');
            const avatarEl = document.getElementById('userAvatar');
            
            if (roleEl) roleEl.textContent = user.role || 'Пользователь';
            if (avatarEl) avatarEl.textContent = (user.name || user.username || '?').charAt(0).toUpperCase();
            if (userNameEl) userNameEl.textContent = user.name || user.username;
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = function (e) {
                    e.preventDefault();
                    if (typeof logout === 'function') logout();
                    else window.location.href = prefix + 'index.html';
                };
            }
        }
    }

    // --- Кнопки в шапке по ролям ---
    if (typeof isAuthenticated === 'function' && isAuthenticated()) {
        const user = kbGetCurrentUser();
        const right = document.querySelector('.top-bar-right');
        if (right && user) {
            const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>';
            const ICON_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
            const ICON_CHART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
            
            const mkBtn = (cls, href, title, html) => {
                const a = document.createElement('a');
                a.className = cls;
                a.href = prefix + href;
                a.title = title;
                a.innerHTML = html;
                right.insertBefore(a, right.firstChild);
                return a;
            };

            // 1. Логика для АДМИНИСТРАТОРА и ГОСТЯ (Контролера)
            if (user.role === ROLE_ADMIN || user.role === ROLE_GUEST) {
                const onMonitoring = /monitoring\.html/.test(window.location.pathname);
                const onAdminPanel = /admin-panel\.html/.test(window.location.pathname);
                const isDashboard = window.location.pathname.endsWith('dashboard.html') || window.location.pathname === '/';

                // Кнопка "Мониторинг" (если мы не на самой странице мониторинга)
                if (!onMonitoring && !right.querySelector('.btn-monitoring')) {
                    mkBtn('btn-admin btn-monitoring', 'monitoring.html', 'Мониторинг ознакомления', ICON_CHART + '<span>Мониторинг</span>');
                }

                // Кнопка "Управление" (ТОЛЬКО для Админа, если мы не в панели управления)
                if (user.role === ROLE_ADMIN && !onAdminPanel && !right.querySelector('.btn-manage')) {
                    mkBtn('btn-admin btn-manage', 'admin-panel.html', 'Панель управления', ICON_GEAR + '<span>Управление</span>');
                }
                
                // Кнопка "В базу знаний" (если мы не на дашборде)
                if (!isDashboard && !right.querySelector('.btn-back-kb')) {
                    mkBtn('btn-admin btn-back-kb', 'dashboard.html', 'Вернуться к разделам базы знаний', ICON_BACK + '<span>В базу знаний</span>');
                }
            } 
            // 2. Логика ТОЛЬКО для СОТРУДНИКА производства
            else if (user.role === ROLE_WORKER) {
                const isDashboard = window.location.pathname.endsWith('dashboard.html') || window.location.pathname === '/';
                
                // Сотруднику показываем ТОЛЬКО кнопку "В базу знаний" (и то, если он не на дашборде)
                // Кнопки "Мониторинг" и "Управление" для него НЕ создаются.
                if (!isDashboard && !right.querySelector('.btn-back-kb')) {
                    mkBtn('btn-admin btn-back-kb', 'dashboard.html', 'Вернуться к разделам базы знаний', ICON_BACK + '<span>В базу знаний</span>');
                }
            }
        }
    }

    // --- Dashboard: карточки разделов ---
    const grid = document.getElementById('cardsGrid');
    if (grid && typeof isAuthenticated === 'function' && isAuthenticated()) {
        const user = kbGetCurrentUser();
        if (user) {
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
                        ${!allowed ? '<span class="card-badge card-badge-lock">🔒 Нет доступа</span>' : ''}
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
    }

    // --- Страницы раздела: скрыть ссылки на операции без права ---
    if (isContentPage && typeof isAuthenticated === 'function' && isAuthenticated()) {
        const user = kbGetCurrentUser();
        if (user) {
            document.querySelectorAll('a[href*="operations/"]').forEach(link => {
                const m = link.getAttribute('href').match(/(\d+\.\d+\.\d+)\.html/);
                if (!m) return;
                const op = kbGetOperationById(m[1]);
                if (op && !kbUserCanViewOperation(user, op)) {
                    const li = link.closest('li');
                    if (li) li.remove(); else link.remove();
                    return;
                }
                if (op && op.status === 'draft' && user.role !== ROLE_ADMIN) {
                    const li = link.closest('li');
                    if (li) li.remove(); else link.remove();
                    return;
                }
                if (op && op.status === 'draft' && user.role === ROLE_ADMIN && !link.querySelector('.op-draft-badge')) {
                    const b = document.createElement('span');
                    b.className = 'op-draft-badge';
                    b.textContent = ' ✎ черновик';
                    b.style.cssText = 'font-size:11px;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:6px;margin-left:6px;white-space:nowrap;';
                    link.appendChild(b);
                }
            });
        }
    }
});