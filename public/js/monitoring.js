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
    // Загружаем данные для матрицы (только активные)
    const matrixResponse = await fetch('/api/matrix', { credentials: 'include' });
    if (!matrixResponse.ok) throw new Error('Ошибка загрузки матрицы');
    const matrixReads = await matrixResponse.json();

    // Загружаем данные для журнала (все, включая удаленных)
    const logResponse = await fetch('/api/reads', { credentials: 'include' });
    if (!logResponse.ok) throw new Error('Ошибка загрузки журнала');
    const logReads = await logResponse.json();

    // Рендерим матрицу отфильтрованными данными
    renderMatrixAccordion(matrixReads);
    // Рендерим журнал полными данными
    renderLog(logReads);
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
        
        // Принудительно сбрасываем overflow у родителей, чтобы карточка не резала контент
        let parent = container.parentElement;
        while (parent && parent.tagName !== 'BODY') {
            parent.style.overflow = 'visible';
            parent = parent.parentElement;
        }

        // 1. Группируем данные
        const tree = {};
        if (typeof KB_OPERATIONS !== 'undefined') {
            KB_OPERATIONS.forEach(op => {
                const parts = op.id.split('.');
                if (parts.length < 3) return;
                const secId = parts[0];
                const subId = `${parts[0]}.${parts[1]}`;
                
                let secTitle = `Раздел ${secId}`;
                let secNum = secId.padStart(2, '0');
                if (typeof KB_SECTIONS !== 'undefined') {
                    const secObj = KB_SECTIONS.find(s => s.num === secNum || s.id === op.section);
                    if (secObj) { secTitle = secObj.title; secNum = secObj.num; }
                }
                
                // Название подраздела (берем из первой операции или генерируем заглушку)
                let subTitle = `Подраздел ${subId}`;
                // Можно улучшить, если добавить реестр подразделов в kb.js
                
                if (!tree[secId]) tree[secId] = { title: secTitle, num: secNum, subsections: {} };
                if (!tree[secId].subsections[subId]) tree[secId].subsections[subId] = { title: subTitle, ops: [] };
                
                tree[secId].subsections[subId].ops.push({
                    id: op.id, title: op.title, version: op.version || '1', users: new Set()
                });
            });
        }

        reads.forEach(r => {
            const parts = r.op_id.split('.');
            if (parts.length < 3) return;
            const secId = parts[0];
            const subId = `${parts[0]}.${parts[1]}`;
            if (tree[secId] && tree[secId].subsections[subId]) {
                const opObj = tree[secId].subsections[subId].ops.find(o => o.id === r.op_id);
                if (opObj) opObj.users.add(r.full_name || r.username);
            }
        });

        const sortedSections = Object.keys(tree).sort((a, b) => Number(a) - Number(b));
        if (sortedSections.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Нет данных</div>';
            return;
        }

        // Создаем общий контейнер аккордеона (как в примере)
        const accordionContainer = document.createElement('div');
        accordionContainer.className = 'accordion-container';
        // Убираем overflow:hidden у контейнера, если он есть в стилях
        accordionContainer.style.overflow = 'visible'; 

        sortedSections.forEach(secId => {
            const section = tree[secId];
            
            // --- Блок Раздела (Уровень 1) ---
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'accordion-section'; // Используем класс из style.css
            sectionDiv.style.borderBottom = '1px solid var(--border)';
            
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'accordion-header';
            // Зеленый фон для номера, как в примере
            sectionHeader.innerHTML = `
                <div class="section-number" style="background: #16a34a; color: white;">${section.num}</div>
                <div class="section-info">
                    <h2>${section.title}</h2>
                    <span class="subsection-count">${Object.keys(section.subsections).length} подразделов</span>
                </div>
                <div class="accordion-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            `;

            const sectionContent = document.createElement('div');
            sectionContent.className = 'accordion-content'; // Класс из style.css (max-height: 0)
            
            // Обработчик клика: переключаем класс .active
            sectionHeader.onclick = () => {
                sectionDiv.classList.toggle('active');
            };

            // --- Подразделы (Уровень 2) ---
            const subListContainer = document.createElement('div');
            subListContainer.style.padding = '16px 24px'; // Отступы как в .subsections-list
            
            const sortedSubsections = Object.keys(section.subsections).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            
            sortedSubsections.forEach(subId => {
                const subsection = section.subsections[subId];
                
                const subItem = document.createElement('div');
                subItem.className = 'subsection-item'; // Класс из style.css
                subItem.style.marginBottom = '12px';
                
                const subHeader = document.createElement('div');
                subHeader.className = 'subsection-header';
                subHeader.innerHTML = `
                    <div class="subsection-number">${subId}</div>
                    <div class="subsection-title">${subsection.title}</div>
                    <div class="subsection-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                `;
                
                const subContent = document.createElement('div');
                subContent.className = 'subsection-content'; // Класс из style.css
                
                subHeader.onclick = (e) => {
                    e.stopPropagation();
                    subItem.classList.toggle('active');
                };

                // Список операций
                const ul = document.createElement('ul');
                ul.className = 'operations-list';
                
                subsection.ops.forEach(op => {
                    const li = document.createElement('li');
                    const usersList = Array.from(op.users).join(', ') || '—';
                    const usersColor = op.users.size > 0 ? '#16a34a' : '#94a3b8';
                    
                    // Используем структуру ссылки, но добавляем span для пользователей
                    li.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 6px 0;">
                            <span><strong>${op.id}</strong> — ${op.title}</span>
                            <span style="font-size: 0.85rem; color: ${usersColor}; font-weight: 500; margin-left: 10px;">${usersList}</span>
                        </div>
                    `;
                    ul.appendChild(li);
                });
                
                subContent.appendChild(ul);
                subItem.appendChild(subHeader);
                subItem.appendChild(subContent);
                subListContainer.appendChild(subItem);
            });

            sectionContent.appendChild(subListContainer);
            sectionDiv.appendChild(sectionHeader);
            sectionDiv.appendChild(sectionContent);
            accordionContainer.appendChild(sectionDiv);
        });

        container.appendChild(accordionContainer);
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
                <td><strong>${r.op_id}</strong> ${r.op_title || ''}</td>
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