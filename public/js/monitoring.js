/**
 * monitoring.js — Логика страницы мониторинга ознакомления
 * Работает с серверным API (/api/reads), а не с localStorage.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // --- Константы (объявлены в начале, чтобы избежать ошибок инициализации) ---
    const LOG_PAGE_SIZE = 30;
    let currentPage = 1;

    // --- 1. Инициализация шапки и проверка авторизации ---
    // Используем функции из auth.js и kb.js
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    const user = (typeof kbGetCurrentUser === 'function') ? kbGetCurrentUser() : null;
    
    if (user) {
        const userNameEl = document.getElementById('userName');
        const userRoleEl = document.getElementById('userRole');
        const userAvatarEl = document.getElementById('userAvatar');
        const logoutBtn = document.getElementById('logoutBtn');

        if (userNameEl) userNameEl.textContent = user.name || user.username;
        if (userRoleEl) userRoleEl.textContent = user.role;
        if (userAvatarEl) userAvatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
        
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                if (typeof logout === 'function') logout();
                else window.location.href = 'index.html';
            };
        }
    }

    // --- 2. Загрузка данных с СЕРВЕРА ---
    try {
        const response = await fetch('/api/reads', { credentials: 'include' });
        if (!response.ok) throw new Error('Ошибка загрузки данных с сервера');
        const reads = await response.json();

        renderMatrix(reads);
        renderLog(reads);

    } catch (error) {
        console.error('Monitoring Error:', error);
        const matrixBody = document.getElementById('matrixBody');
        if (matrixBody) {
            matrixBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center; padding: 20px;">Ошибка: ${error.message}</td></tr>`;
        }
    }

    // --- 3. Рендер Матрицы ознакомления ---
    function renderMatrix(reads) {
        const tbody = document.getElementById('matrixBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Группируем данные по операциям
        const opsMap = {};
        
        // Берем список всех операций из kb.js (глобальная переменная KB_OPERATIONS)
        if (typeof KB_OPERATIONS !== 'undefined') {
            KB_OPERATIONS.forEach(op => {
                opsMap[op.id] = {
                    title: op.title,
                    section: op.section,
                    version: op.version || '1',
                    users: new Set()
                };
            });
        }

        // Накладываем данные о прочтениях с сервера
        reads.forEach(r => {
            if (!opsMap[r.op_id]) {
                // Если операция есть в логах, но нет в реестре (редкий случай)
                opsMap[r.op_id] = {
                    title: r.op_title || r.op_id,
                    section: r.section_id,
                    version: r.version,
                    users: new Set()
                };
            }
            // Добавляем имя пользователя в набор (Set гарантирует уникальность)
            opsMap[r.op_id].users.add(r.full_name || r.username);
        });

        // Сортируем по ID операции (1.1.1, 1.1.2...)
        const sortedOps = Object.entries(opsMap).sort((a, b) => {
            return a[0].localeCompare(b[0], undefined, { numeric: true });
        });

        if (sortedOps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Нет данных об операциях</td></tr>';
            return;
        }

        sortedOps.forEach(([opId, data]) => {
            const tr = document.createElement('tr');
            
            // Получаем читаемое название раздела из KB_SECTIONS
            let sectionTitle = data.section;
            if (typeof KB_SECTIONS !== 'undefined') {
                const sec = KB_SECTIONS.find(s => s.id === data.section);
                if (sec) sectionTitle = sec.title;
            }

            const usersList = Array.from(data.users).join(', ') || '—';

            tr.innerHTML = `
                <td>${sectionTitle}</td>
                <td><strong>${opId}</strong> ${data.title}</td>
                <td>v${data.version}</td>
                <td class="user-cell">${usersList}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 4. Рендер Журнала (хронология) с пагинацией ---
    function renderLog(reads) {
        const tbody = document.getElementById('logBody');
        const pagination = document.getElementById('paginationControls');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        // Сортировка: новые сверху
        const sortedReads = [...reads].sort((a, b) => new Date(b.read_at) - new Date(a.read_at));
        
        const totalPages = Math.ceil(sortedReads.length / LOG_PAGE_SIZE);
        const start = (currentPage - 1) * LOG_PAGE_SIZE;
        const pageData = sortedReads.slice(start, start + LOG_PAGE_SIZE);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Журнал пуст</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        pageData.forEach(r => {
            const tr = document.createElement('tr');
            const date = new Date(r.read_at).toLocaleString('ru-RU');
            tr.innerHTML = `
                <td>${date}</td>
                <td>${r.full_name || r.username}</td>
                <td>${r.op_title || r.op_id}</td>
                <td>v${r.version}</td>
            `;
            tbody.appendChild(tr);
        });

        // Отрисовка кнопок пагинации
        if (pagination) {
            pagination.innerHTML = '';
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement('button');
                    btn.textContent = i;
                    btn.className = 'btn-page';
                    if (i === currentPage) {
                        btn.disabled = true;
                        btn.style.fontWeight = 'bold';
                    }
                    btn.onclick = () => {
                        currentPage = i;
                        renderLog(reads); // Перерисовываем таблицу
                    };
                    pagination.appendChild(btn);
                }
            }
        }
    }
});