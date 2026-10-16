/**
 * monitoring.js — Логика страницы мониторинга ознакомления
 * Версия с группировкой по разделам и подразделам (Аккордеон)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // --- Константы ---
    const LOG_PAGE_SIZE = 30;
    let currentPage = 1;

    // --- 1. Инициализация шапки и проверка авторизации ---
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

        renderMatrixAccordion(reads); // Новая функция отрисовки
        renderLog(reads);

    } catch (error) {
        console.error('Monitoring Error:', error);
        const matrixBody = document.getElementById('matrixBody');
        if (matrixBody) {
            matrixBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center; padding: 20px;">Ошибка: ${error.message}</td></tr>`;
        }
    }

    // --- 3. Рендер Матрицы (Аккордеон) ---
    function renderMatrixAccordion(reads) {
        const container = document.getElementById('matrixBody');
        if (!container) return;
        container.innerHTML = '';

        // 1. Группируем данные
        // Структура: { sectionId: { title: "...", subsections: { subId: { title: "...", ops: [...] } } } }
        const tree = {};

        // Сначала заполняем всеми известными операциями из KB_OPERATIONS
        if (typeof KB_OPERATIONS !== 'undefined') {
            KB_OPERATIONS.forEach(op => {
                const parts = op.id.split('.'); // ['2', '1', '1']
                if (parts.length < 3) return;

                const secId = parts[0]; // '2'
                const subId = `${parts[0]}.${parts[1]}`; // '2.1'
                
                // Находим название раздела из KB_SECTIONS
                let secTitle = `Раздел ${secId}`;
                if (typeof KB_SECTIONS !== 'undefined') {
                    const secObj = KB_SECTIONS.find(s => s.id === op.section);
                    if (secObj) secTitle = `${secObj.num}. ${secObj.title}`;
                }

                // Название подраздела (берем из первой операции или генерируем)
                // В реальном проекте лучше иметь реестр подразделов, но пока возьмем из title операции
                // Упростим: "2.1 Сборка панели пола" (берем часть title до первого слова или хардкодим, если нужно)
                // Для универсальности просто используем ID подраздела как заголовок, если нет другого источника
                let subTitle = `Подраздел ${subId}`;
                // Попытка вытащить название подраздела из title операции (эвристика)
                // Например "Сборка каркаса панели" -> не дает названия подраздела.
                // Оставим заглушку, которую можно улучшить позже, если добавить массив KB_SUBSECTIONS в kb.js
                // Пока просто ID.

                if (!tree[secId]) {
                    tree[secId] = { title: secTitle, subsections: {} };
                }
                if (!tree[secId].subsections[subId]) {
                    tree[secId].subsections[subId] = { title: subTitle, ops: [] };
                }

                tree[secId].subsections[subId].ops.push({
                    id: op.id,
                    title: op.title,
                    version: op.version || '1',
                    users: new Set()
                });
            });
        }

        // Накладываем данные о прочтениях
        reads.forEach(r => {
            const parts = r.op_id.split('.');
            if (parts.length < 3) return;
            const secId = parts[0];
            const subId = `${parts[0]}.${parts[1]}`;

            if (tree[secId] && tree[secId].subsections[subId]) {
                const opObj = tree[secId].subsections[subId].ops.find(o => o.id === r.op_id);
                if (opObj) {
                    opObj.users.add(r.full_name || r.username);
                }
            }
        });

        // 2. Отрисовка HTML
        // Сортируем разделы по ID
        const sortedSections = Object.keys(tree).sort((a, b) => Number(a) - Number(b));

        if (sortedSections.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Нет данных об операциях</div>';
            return;
        }

        sortedSections.forEach(secId => {
            const section = tree[secId];
            
            // Блок Раздела
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'monitor-section';
            sectionDiv.style.marginBottom = '10px';
            sectionDiv.style.border = '1px solid #e2e8f0';
            sectionDiv.style.borderRadius = '8px';
            sectionDiv.style.overflow = 'hidden';

            // Заголовок Раздела (кнопка)
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'monitor-header';
            sectionHeader.style.cssText = 'background: #f8fafc; padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: #1e293b;';
            sectionHeader.innerHTML = `<span>${section.title}</span> <span class="arrow">▼</span>`;
            
            // Контент Раздела (скрыт по умолчанию)
            const sectionContent = document.createElement('div');
            sectionContent.className = 'monitor-content';
            sectionContent.style.display = 'none';
            sectionContent.style.padding = '10px';
            sectionContent.style.background = '#fff';

            // Обработчик клика по разделу
            sectionHeader.onclick = () => {
                const isOpen = sectionContent.style.display === 'block';
                sectionContent.style.display = isOpen ? 'none' : 'block';
                sectionHeader.querySelector('.arrow').textContent = isOpen ? '▼' : '▲';
            };

            // Подразделы
            const sortedSubsections = Object.keys(section.subsections).sort((a, b) => {
                return a.localeCompare(b, undefined, { numeric: true });
            });

            sortedSubsections.forEach(subId => {
                const subsection = section.subsections[subId];
                
                const subDiv = document.createElement('div');
                subDiv.className = 'monitor-subsection';
                subDiv.style.marginBottom = '8px';
                subDiv.style.border = '1px solid #f1f5f9';
                subDiv.style.borderRadius = '6px';

                const subHeader = document.createElement('div');
                subHeader.className = 'monitor-subheader';
                subHeader.style.cssText = 'background: #f1f5f9; padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 500; color: #475569;';
                subHeader.innerHTML = `<span>${subsection.title}</span> <span class="arrow">▼</span>`;

                const subContent = document.createElement('div');
                subContent.className = 'monitor-subcontent';
                subContent.style.display = 'none';
                subContent.style.padding = '8px';

                subHeader.onclick = (e) => {
                    e.stopPropagation(); // Чтобы не срабатывал клик по родителю
                    const isOpen = subContent.style.display === 'block';
                    subContent.style.display = isOpen ? 'none' : 'block';
                    subHeader.querySelector('.arrow').textContent = isOpen ? '▼' : '▲';
                };

                // Таблица операций внутри подраздела
                const table = document.createElement('table');
                table.className = 'matrix-table'; // Используем существующие стили
                table.style.width = '100%';
                table.style.fontSize = '13px';
                
                const thead = document.createElement('thead');
                thead.innerHTML = `<tr><th style="width: 100px;">Операция</th><th>Название</th><th style="width: 80px;">Версия</th><th>Ознакомились</th></tr>`;
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                subsection.ops.forEach(op => {
                    const tr = document.createElement('tr');
                    const usersList = Array.from(op.users).join(', ') || '—';
                    tr.innerHTML = `
                        <td><strong>${op.id}</strong></td>
                        <td>${op.title}</td>
                        <td>v${op.version}</td>
                        <td class="user-cell">${usersList}</td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                subContent.appendChild(table);

                subDiv.appendChild(subHeader);
                subDiv.appendChild(subContent);
                sectionContent.appendChild(subDiv);
            });

            sectionDiv.appendChild(sectionHeader);
            sectionDiv.appendChild(sectionContent);
            container.appendChild(sectionDiv);
        });
    }

    // --- 4. Рендер Журнала (хронология) с пагинацией ---
    function renderLog(reads) {
        const tbody = document.getElementById('logBody');
        const pagination = document.getElementById('paginationControls');
        if (!tbody) return;
        
        tbody.innerHTML = '';

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
                        renderLog(reads);
                    };
                    pagination.appendChild(btn);
                }
            }
        }
    }
});