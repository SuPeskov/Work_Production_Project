/**
 * monitoring.js — Логика страницы мониторинга ознакомления
 * Версия с группировкой по разделам и подразделам (Аккордеон в стиле dashboard)
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

        renderMatrixAccordion(reads);
        renderLog(reads);

    } catch (error) {
        console.error('Monitoring Error:', error);
        const matrixBody = document.getElementById('matrixBody');
        if (matrixBody) {
            matrixBody.innerHTML = `<div style="color:red; text-align:center; padding: 20px;">Ошибка: ${error.message}</div>`;
        }
    }

    // --- 3. Рендер Матрицы (Аккордеон) ---
    function renderMatrixAccordion(reads) {
        const container = document.getElementById('matrixBody');
        if (!container) return;
        container.innerHTML = '';

        // 1. Группируем данные в дерево: Section -> Subsection -> Operations
        // Структура: { sectionId: { title: "...", num: "01", subsections: { subId: { title: "...", ops: [...] } } } }
        const tree = {};

        // Заполняем всеми известными операциями из KB_OPERATIONS
        if (typeof KB_OPERATIONS !== 'undefined') {
            KB_OPERATIONS.forEach(op => {
                const parts = op.id.split('.'); // ['2', '1', '1']
                if (parts.length < 3) return;

                const secId = parts[0]; // '2'
                const subId = `${parts[0]}.${parts[1]}`; // '2.1'

                // Находим название раздела из KB_SECTIONS
                let secTitle = `Раздел ${secId}`;
                let secNum = secId.padStart(2, '0');
                if (typeof KB_SECTIONS !== 'undefined') {
                    const secObj = KB_SECTIONS.find(s => s.num === secNum || s.id === op.section);
                    if (secObj) {
                        secTitle = secObj.title;
                        secNum = secObj.num;
                    }
                }

                // Название подраздела (эвристика: берем из первой операции или генерируем)
                // В реальном проекте лучше иметь реестр подразделов. Пока используем ID.
                let subTitle = `Подраздел ${subId}`;
                // Попытка улучшить: если есть операция 2.1.1, можно попробовать вытащить контекст, 
                // но проще оставить заглушку или хардкод для известных подразделов.
                // Для универсальности оставим "Подраздел X.Y".

                if (!tree[secId]) {
                    tree[secId] = { title: secTitle, num: secNum, subsections: {} };
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
        const sortedSections = Object.keys(tree).sort((a, b) => Number(a) - Number(b));

        if (sortedSections.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Нет данных об операциях</div>';
            return;
        }

        sortedSections.forEach(secId => {
            const section = tree[secId];
            
            // --- Блок Раздела (Уровень 1) ---
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'accordion-section';
            sectionDiv.dataset.section = secId;
            sectionDiv.style.marginBottom = '15px';
            sectionDiv.style.border = '1px solid #e2e8f0';
            sectionDiv.style.borderRadius = '12px';
            sectionDiv.style.overflow = 'hidden';
            sectionDiv.style.background = '#fff';

            // Заголовок Раздела
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'accordion-header';
            sectionHeader.style.cssText = 'display: flex; align-items: center; padding: 16px 20px; cursor: pointer; background: #f8fafc; transition: background 0.2s;';
            sectionHeader.onmouseenter = () => sectionHeader.style.background = '#f1f5f9';
            sectionHeader.onmouseleave = () => sectionHeader.style.background = '#f8fafc';

            sectionHeader.innerHTML = `
                <div class="section-number" style="font-size: 20px; font-weight: 700; color: #6366f1; margin-right: 16px; min-width: 40px;">${section.num}</div>
                <div class="section-info" style="flex: 1;">
                    <h2 style="margin: 0; font-size: 18px; color: #1e293b;">${section.title}</h2>
                    <span class="subsection-count" style="font-size: 13px; color: #64748b;">${Object.keys(section.subsections).length} подразделов</span>
                </div>
                <div class="accordion-icon" style="transition: transform 0.3s; color: #64748b;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
            `;

            // Контент Раздела (скрыт)
            const sectionContent = document.createElement('div');
            sectionContent.className = 'accordion-content';
            sectionContent.style.display = 'none';
            sectionContent.style.padding = '10px 20px 20px 20px';
            sectionContent.style.background = '#fff';

            // Обработчик клика по разделу
            sectionHeader.onclick = () => {
                const isOpen = sectionContent.style.display === 'block';
                sectionContent.style.display = isOpen ? 'none' : 'block';
                const icon = sectionHeader.querySelector('.accordion-icon');
                icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            };

            // --- Подразделы (Уровень 2) ---
            const sortedSubsections = Object.keys(section.subsections).sort((a, b) => {
                return a.localeCompare(b, undefined, { numeric: true });
            });

            sortedSubsections.forEach(subId => {
                const subsection = section.subsections[subId];
                
                const subDiv = document.createElement('div');
                subDiv.className = 'accordion-section'; // Используем тот же класс для вложенности
                subDiv.style.marginBottom = '10px';
                subDiv.style.border = '1px solid #f1f5f9';
                subDiv.style.borderRadius = '8px';
                subDiv.style.overflow = 'hidden';

                const subHeader = document.createElement('div');
                subHeader.className = 'accordion-header';
                subHeader.style.cssText = 'display: flex; align-items: center; padding: 12px 16px; cursor: pointer; background: #f8fafc; transition: background 0.2s;';
                subHeader.onmouseenter = () => subHeader.style.background = '#f1f5f9';
                subHeader.onmouseleave = () => subHeader.style.background = '#f8fafc';

                subHeader.innerHTML = `
                    <div class="section-number" style="font-size: 16px; font-weight: 600; color: #475569; margin-right: 12px; min-width: 30px;">${subId}</div>
                    <div class="section-info" style="flex: 1;">
                        <h3 style="margin: 0; font-size: 15px; color: #334155;">${subsection.title}</h3>
                        <span style="font-size: 12px; color: #94a3b8;">${subsection.ops.length} операций</span>
                    </div>
                    <div class="accordion-icon" style="transition: transform 0.3s; color: #94a3b8;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                `;

                const subContent = document.createElement('div');
                subContent.className = 'accordion-content';
                subContent.style.display = 'none';
                subContent.style.padding = '10px 16px';
                subContent.style.background = '#fff';

                subHeader.onclick = (e) => {
                    e.stopPropagation();
                    const isOpen = subContent.style.display === 'block';
                    subContent.style.display = isOpen ? 'none' : 'block';
                    const icon = subHeader.querySelector('.accordion-icon');
                    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                };

                // Список операций
                const ul = document.createElement('ul');
                ul.className = 'operations-list';
                ul.style.listStyle = 'none';
                ul.style.padding = '0';
                ul.style.margin = '0';

                subsection.ops.forEach(op => {
                    const li = document.createElement('li');
                    li.style.padding = '8px 0';
                    li.style.borderBottom = '1px solid #f1f5f9';
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.alignItems = 'center';
                    li.style.flexWrap = 'wrap';
                    li.style.gap = '10px';

                    const usersList = Array.from(op.users).join(', ') || '—';
                    const usersColor = op.users.size > 0 ? '#16a34a' : '#94a3b8';

                    li.innerHTML = `
                        <div style="flex: 1; min-width: 200px;">
                            <strong style="color: #1e293b; margin-right: 8px;">${op.id}</strong>
                            <span style="color: #475569;">${op.title}</span>
                        </div>
                        <div style="font-size: 13px; color: ${usersColor}; font-weight: 500; text-align: right; max-width: 300px;">
                            ${usersList}
                        </div>
                    `;
                    ul.appendChild(li);
                });

                subContent.appendChild(ul);
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
                    btn.style.cssText = 'padding: 8px 16px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; margin: 0 2px;';
                    if (i === currentPage) {
                        btn.disabled = true;
                        btn.style.fontWeight = 'bold';
                        btn.style.background = '#f1f5f9';
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