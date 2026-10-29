/**
 * kb.js — Реестр разделов и операций базы знаний + клиентская логика
 * ИСПРАВЛЕНО: 
 * 1. Восстановлена константа KB_ARCHIVE_KEY
 * 2. Исправлены синтаксические ошибки в KB_OPERATIONS (пробелы в ключах)
 * 3. Убраны дубликаты функций isAuthenticated/logout
 * 4. Вся логика Guard переведена в единый async блок
 */

// === Роли ===
const ROLE_ADMIN   = 'Администратор';
const ROLE_WORKER  = 'Сотрудник производства';
const ROLE_GUEST   = 'Гость';

// === Ключи хранилища (используются для отметок ознакомления) ===
const KB_READ_KEY      = 'kb_reads_v1';
const KB_ARCHIVE_KEY   = 'kb_reads_archive_v1'; // ВОССТАНОВЛЕНО

// === Разделы базы знаний ===
const KB_SECTIONS = [
    { id: 'preparation', num: '01', title: 'Заготовка',        img: 'assets/images/icons/section-1-zagotovka.svg', desc: 'Напил элементов каркаса, листового материала, отделочной доски и заготовка для сборки модуля', page: 'pages/preparation.html' },
    { id: 'panels',      num: '02', title: 'Сборка панелей',   img: 'assets/images/icons/section-2-panels.svg', desc: 'Изготовление панелей пола, крыши, внешних и внутренних стен модуля', page: 'pages/panels.html' },
    { id: 'module',      num: '03', title: 'Сборка модуля',    img: 'assets/images/icons/section-3-module.svg', desc: 'Сборка каркаса, кровельные работы, внутренний контур, инженерные системы', page: 'pages/module.html' },
    { id: 'options',     num: '04', title: 'Сборка опций',     img: 'assets/images/icons/section-4-options.svg', desc: 'Террасы, веранды, навесы и крыльца — дополнительные конструкции к модулю', page: 'pages/options.html' },
    { id: 'installation',num: '05', title: 'Монтаж',           img: 'assets/images/icons/section-5-installation.svg', desc: 'Доставка, установка и стыковка модулей на фундаменте заказчика', page: 'pages/installation.html' },
    { id: 'service',     num: '06', title: 'Сервис',           img: 'assets/images/icons/section-6-service.svg', desc: 'Сезонное обслуживание, гарантийный ремонт и диагностика систем', page: 'pages/service.html' },
    { id: 'standards',   num: '07', title: 'Стандарты',        img: 'assets/images/icons/section-6-service.svg', desc: 'Регламенты, руководства, инструкции', page: 'pages/standards.html' }
];

// === Реестр операций (ИСПРАВЛЕНО: убраны лишние пробелы в ключах version, status, section, url) ===
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
    // Подраздел 2.2
    { id: '2.2.1',  section: 'panels', title: 'Сборка каркаса кровельной панели',                    version: 1, status: 'ready',   url: 'pages/operations/2.2.1.html' },
    { id: '2.2.2',  section: 'panels', title: 'Укладка листового материала на каркас панели',                      version: 1, status: 'ready',   url: 'pages/operations/2.2.2.html' },
    { id: '2.2.3',  section: 'panels', title: 'Монтаж финишной отделки',                      version: 1, status: 'ready',   url: 'pages/operations/2.2.3.html' },
    // Подраздел 2.3
    { id: '2.3.1',  section: 'panels', title: 'Сборка каркаса внешней стены',                version: 1, status: 'ready',    url: 'pages/operations/2.3.1.html' },
    { id: '2.3.2',  section: 'panels', title: 'Установка оконных и дверных проёмов',         version: 1, status: 'ready',   url: 'pages/operations/2.3.2.html' },
    // Подраздел 2.4
    { id: '2.4.1',  section: 'panels', title: 'Сборка каркаса внутренней стены',             version: 1, status: 'draft',   url: 'pages/operations/2.4.1.html' },
    { id: '2.4.2',  section: 'panels', title: 'Установка дверных проёмов',                   version: 1, status: 'draft',   url: 'pages/operations/2.4.2.html' },
];

const PUBLIC_OP_IDS = undefined;

/** Может ли пользователь подтверждать ознакомление */
function kbUserCanConfirmRead(user) {
    return !!user && user.role === ROLE_WORKER;
}

/**
 * Актуальный профиль текущего пользователя.
 * Читает ТОЛЬКО с сервера (/api/me).
 */
let _currentUserCache = null;

async function kbGetCurrentUser() {
    if (_currentUserCache) return _currentUserCache;
    
    console.log('[KB] Начало загрузки профиля...');
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        console.log('[KB] Статус ответа /api/me:', response.status);
        
        if (!response.ok) {
            console.error('[KB] Ошибка ответа /api/me:', response.statusText);
            throw new Error('Not authenticated');
        }
        
        const data = await response.json();
        console.log('[KB] Данные /api/me:', data);
        
        if (data.user) {
            const roleMap = { 
                'admin': 'Администратор', 
                'worker': 'Сотрудник производства', 
                'guest': 'Гость' 
            };
            _currentUserCache = {
                username: data.user.username,
                name: data.user.name,
                role: roleMap[data.user.role] || data.user.role,
                access: data.sections || []
            };
            console.log('[KB] Профиль успешно загружен:', _currentUserCache);
            return _currentUserCache;
        } else {
            console.warn('[KB] В ответе нет поля user');
        }
    } catch (e) {
        console.error('[KB] Исключение при загрузке профиля:', e);
    }
    console.warn('[KB] Возвращаем null (пользователь не авторизован)');
    return null;
}

// Вспомогательная функция проверки авторизации
function isAuthenticated() {
    return !!_currentUserCache;
}

// Функция выхода через API
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch(e) {}
    _currentUserCache = null;
    sessionStorage.removeItem('modular_house_session');
    window.location.href = '/index.html';
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
    if (user.role === 'Администратор' || user.role === 'Гость') return true;
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
    const opMatch = fileName.match(/^(\d+.\d+.\d+).html$/);
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
// Guard — защита страниц и навигации (ЕДИНАЯ АСИНХРОННАЯ ТОЧКА ВХОДА)
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
    const prefix = kbRootPrefix();
    
    // 1. СРАЗУ ЗАГРУЖАЕМ ПРОФИЛЬ С СЕРВЕРА
    // Это гарантирует, что _currentUserCache будет заполнен ДО любых проверок
    const user = await kbGetCurrentUser(); 
    
    // --- ЛОГИКА ШАПКИ САЙТА ---
    if (user) {
        const nameEl = document.getElementById('currentUserName') || document.getElementById('userName');
        const roleEl = document.getElementById('currentUserRole') || document.getElementById('userRole');
        const avatarEl = document.getElementById('userAvatar');
        
        if (nameEl) nameEl.textContent = user.name || user.username;
        if (roleEl) roleEl.textContent = user.role || 'Пользователь';
        if (avatarEl) avatarEl.textContent = (user.name || user.username || '?').charAt(0).toUpperCase();
        
        const logoutBtn = document.getElementById('logoutBtn') || 
                          document.querySelector('button[class*="logout"]') ||
                          document.querySelector('a[href*="logout"]');
                          
        if (logoutBtn) {
            logoutBtn.onclick = function (e) {
                e.preventDefault();
                logout();
            };
        }

        // --- КНОПКИ НАВИГАЦИИ ПО РОЛЯМ ---
        const right = document.querySelector('.top-bar-right');
        if (right) {
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

            const onMonitoring = /monitoring\.html/.test(window.location.pathname);
            const onAdminPanel = /admin-panel\.html/.test(window.location.pathname);
            const isDashboard = window.location.pathname.endsWith('dashboard.html') || window.location.pathname === '/';

            if (user.role === ROLE_ADMIN || user.role === ROLE_GUEST) {
                if (!onMonitoring && !right.querySelector('.btn-monitoring')) {
                    mkBtn('btn-admin btn-monitoring', 'monitoring.html', 'Мониторинг ознакомления', ICON_CHART + '<span>Мониторинг</span>');
                }
                if (user.role === ROLE_ADMIN && !onAdminPanel && !right.querySelector('.btn-manage')) {
                    mkBtn('btn-admin btn-manage', 'admin-panel.html', 'Панель управления', ICON_GEAR + '<span>Управление</span>');
                }
                if (!isDashboard && !right.querySelector('.btn-back-kb')) {
                    mkBtn('btn-admin btn-back-kb', 'dashboard.html', 'Вернуться к разделам базы знаний', ICON_BACK + '<span>В базу знаний</span>');
                }
            } else if (user.role === ROLE_WORKER) {
                if (!isDashboard && !right.querySelector('.btn-back-kb')) {
                    mkBtn('btn-admin btn-back-kb', 'dashboard.html', 'Вернуться к разделам базы знаний', ICON_BACK + '<span>В базу знаний</span>');
                }
            }
        }
 } else {
     console.log('[KB] Guard: user is null. Проверка пути...');
     // Если пользователь не авторизован и находится на защищенной странице
     if (window.location.pathname.includes('/pages/') || window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin-panel')) {
         console.log('[KB] Guard: Редирект на /index.html');
         sessionStorage.removeItem('modular_house_session');
         window.location.href = '/index.html?need_login=1';
         return;
     }
 }

    // --- ЗАЩИТА КОНТЕНТНЫХ СТРАНИЦ (Выполняется ТОЛЬКО если user существует) ---
    const isContentPage = window.location.pathname.includes('/pages/');
    const isPublicPage  = /search\.html$/.test(window.location.pathname);
    
    if (isContentPage && !isPublicPage && user) {
        const file = window.location.pathname.split('/').pop();
        if (file !== 'dashboard.html' && !kbCanViewPageByFile(user, file)) {
            blockPage(user);
            return;
        }
        
        const opMatch = window.location.pathname.match(/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch) {
            const op = kbGetOperationById(opMatch[1]);
            if (op && !kbUserCanViewOperation(user, op)) { 
                blockPage(user); 
                return; 
            }
        }
    }

    function blockPage(user) {
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `
            <div style="max-width:560px;margin:120px auto;text-align:center;font-family:Inter,sans-serif;padding:0 20px;">
                <div style="font-size:56px;">🔒</div>
                <h1 style="font-size:24px;margin:16px 0 8px;">Нет доступа к разделу</h1>
                <p style="color:#64748b;line-height:1.6;">Пользователю «${user.name}» (${user.role}) не назначен доступ к этому разделу.</p>
                <a href="/dashboard.html" style="display:inline-block;margin-top:24px;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Вернуться в базу знаний</a>
            </div>`;
    }

    // --- DASHBOARD: КАРТОЧКИ РАЗДЕЛОВ ---
    const grid = document.getElementById('cardsGrid');
    if (grid && user) {
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

    // --- СТРАНИЦЫ РАЗДЕЛА: СКРЫТИЕ ССЫЛОК ---
    if (isContentPage && user) {
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
});

/**
 * operation-status.js — Визуальная индикация статуса ознакомления
 */
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;
    
    const opLinks = document.querySelectorAll('a[href*="operations/"]');
    if (opLinks.length === 0) return;
    
    const opIds = [];
    const linkMap = {};
    
    opLinks.forEach(link => {
        // Исправлено: экранирование точек в regex
        const match = link.getAttribute('href').match(/(\d+\.\d+\.\d+)\.html/);
        if (match) {
            opIds.push(match[1]);
            linkMap[match[1]] = link;
        }
    });
    
    if (opIds.length === 0) return;
    
    try {
        const response = await fetch('/api/read-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ opIds })
        });
        
        if (!response.ok) throw new Error(`Ошибка загрузки статусов: ${response.status}`);
        const statuses = await response.json();
        
        // Добавляем стили только один раз
        if (!document.getElementById('dynamic-op-status-styles')) {
            const style = document.createElement('style');
            style.id = 'dynamic-op-status-styles';
            style.textContent = `
                .unread-operation { 
                    background-color: #fff7ed !important; 
                    border-left: 4px solid #f97316 !important; 
                }
                .unread-operation a { 
                    color: #c2410c !important; 
                    font-weight: 600; 
                }
                .read-operation { 
                    background-color: #ffffff !important; 
                    border-left: 4px solid transparent !important; 
                }
                li, .operation-item { 
                    transition: background-color 0.3s ease, border-color 0.3s ease; 
                }
            `;
            document.head.appendChild(style);
        }
        
        Object.entries(statuses).forEach(([id, statusObj]) => {
            const link = linkMap[id];
            if (!link) return;
            
            // Исправлено: проверка на null + поддержка обоих селекторов
            const parentItem = link.closest('li') || link.closest('.operation-item');
            if (!parentItem) return;
            
            if (statusObj.isRead) {
                parentItem.classList.remove('unread-operation');
                parentItem.classList.add('read-operation');
            } else {
                parentItem.classList.remove('read-operation');
                parentItem.classList.add('unread-operation');
            }
        });
        
    } catch (error) {
        console.error('Не удалось загрузить статусы ознакомления:', error);
    }
});

/**
 * auto-check-read-btn.js — Автоматическая синхронизация кнопки "Ознакомлен"
 */
document.addEventListener('DOMContentLoaded', async () => {
    const readBtn = document.getElementById('readBtn');
    if (!readBtn) return;
    if (!window.location.pathname.includes('/operations/')) return;
    if (typeof isAuthenticated !== 'function' || !isAuthenticated()) return;
    
    const opId = readBtn.dataset.opId;
    const opVersion = readBtn.dataset.opVersion;
    
    if (!opId || !opVersion) {
        console.warn('Отсутствуют data-op-id или data-op-version у кнопки');
        return;
    }
    
    try {
        const response = await fetch('/api/read-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ opIds: [opId] })
        });
        
        if (!response.ok) throw new Error(`Ошибка загрузки статуса: ${response.status}`);
        const statuses = await response.json();
        const statusObj = statuses[opId];
        
        if (statusObj && statusObj.isRead) {
            readBtn.classList.add('read');
            
            const iconUnread = readBtn.querySelector('.icon-unread');
            const iconRead = readBtn.querySelector('.icon-read');
            const btnText = readBtn.querySelector('.btn-text');
            
            if (iconUnread) iconUnread.style.display = 'none';
            if (iconRead) iconRead.style.display = 'inline-block';
            if (btnText) btnText.textContent = 'Ознакомлен';
            
            readBtn.disabled = true;
            readBtn.style.opacity = '0.7';
            readBtn.style.cursor = 'default';
            readBtn.setAttribute('aria-disabled', 'true');
        }
        
    } catch (error) {
        console.error('Не удалось проверить статус кнопки:', error);
    }
});