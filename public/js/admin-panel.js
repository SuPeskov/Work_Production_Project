/**
 * admin-panel.js — Управление пользователями через реальный API сервера
 */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('addUserForm');
    const tableBody = document.getElementById('usersTableBody');
    const errorDiv = document.getElementById('formError');
    const roleSelect = document.getElementById('userRoleSelect');
    const sectionsBlock = document.getElementById('sectionsBlock');

    if (!form || !tableBody) {
        console.error('❌ Форма или таблица не найдены');
        return;
    }

    // --- Логика скрытия блока разделов при выборе роли ---
    if (roleSelect && sectionsBlock) {
        roleSelect.addEventListener('change', function() {
            // Показываем блок разделов только для Сотрудника производства
            sectionsBlock.style.display = (this.value === 'worker') ? 'block' : 'none';
        });
        roleSelect.dispatchEvent(new Event('change')); // Инициализация при загрузке
    }

    // --- Функции действий ---
    async function deleteUser(userId, username) {
        if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) return;
        try {
            const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
            const data = await response.json();
            if (response.ok && data.ok) {
                alert('Пользователь удален');
                await loadUsers();
            } else {
                alert('Ошибка: ' + (data.error || 'Не удалось удалить'));
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    async function changePassword(userId, username) {
        const newPassword = prompt(`Введите новый пароль для "${username}":`);
        if (!newPassword) return;
        if (newPassword.length < 6) {
            alert('Пароль должен быть минимум 6 символов');
            return;
        }
        try {
            const response = await fetch(`/api/admin/users/${userId}/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: newPassword })
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                alert('Пароль изменен');
            } else {
                alert('Ошибка: ' + (data.error || 'Не удалось изменить пароль'));
            }
        } catch (error) {
            console.error('Ошибка смены пароля:', error);
            alert('Ошибка соединения');
        }
    }

    // --- Логика Модального Окна Доступа ---
    const accessModal = document.getElementById('accessModal');
    const closeAccessModalBtn = document.getElementById('closeAccessModal');
    const cancelAccessModalBtn = document.getElementById('cancelAccessModal');
    const saveAccessModalBtn = document.getElementById('saveAccessModal');
    const modalUserName = document.getElementById('modalUserName');
    const modalCheckboxes = document.querySelectorAll('input[name="modal_sections"]');
    let currentEditingUserId = null;

    function openAccessModal(userId, username, currentSections) {
        currentEditingUserId = userId;
        modalUserName.textContent = username;
        modalCheckboxes.forEach(cb => {
            cb.checked = currentSections && currentSections.includes(cb.value);
        });
        accessModal.style.display = 'flex';
    }

    function closeAccessModal() {
        accessModal.style.display = 'none';
        currentEditingUserId = null;
    }

    async function saveAccessChanges() {
        if (!currentEditingUserId) return;
        const selectedSections = Array.from(modalCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        try {
            const response = await fetch(`/api/admin/users/${currentEditingUserId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sections: selectedSections })
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                closeAccessModal();
                await loadUsers();
            } else {
                alert('Ошибка: ' + (data.error || 'Не удалось сохранить'));
            }
        } catch (error) {
            console.error('Ошибка сохранения доступа:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    if (closeAccessModalBtn) closeAccessModalBtn.onclick = closeAccessModal;
    if (cancelAccessModalBtn) cancelAccessModalBtn.onclick = closeAccessModal;
    if (saveAccessModalBtn) saveAccessModalBtn.onclick = saveAccessChanges;
    window.onclick = function(event) { if (event.target == accessModal) closeAccessModal(); }

    // --- Отрисовка таблицы ---
    function renderUsers(users) {
        tableBody.innerHTML = '';
        const sectionNames = {
            'preparation': 'Заготовка', 'panels': 'Сборка панелей', 'module': 'Сборка модуля',
            'options': 'Сборка опций', 'installation': 'Монтаж', 'service': 'Сервис'
        };
        const sectionOrder = ['preparation', 'panels', 'module', 'options', 'installation', 'service'];

        users.forEach(user => {
            const tr = document.createElement('tr');
            
            // ФИО
            const tdName = document.createElement('td');
            tdName.textContent = user.name;
            tr.appendChild(tdName);
            
            // Логин
            const tdLogin = document.createElement('td');
            tdLogin.textContent = user.username;
            tr.appendChild(tdLogin);
            
            // Роль
            const tdRole = document.createElement('td');
            const roleLabels = { admin: 'Администратор', worker: 'Сотрудник производства', guest: 'Гость' };
            tdRole.textContent = roleLabels[user.role] || user.role;
            tr.appendChild(tdRole);
            
            // Доступ
            const tdAccess = document.createElement('td');
            if (user.role === 'admin' || user.role === 'guest') {
                tdAccess.textContent = 'все разделы';
            } else if (user.sections && user.sections.length > 0) {
                const sortedSections = user.sections.sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b));
                tdAccess.textContent = sortedSections.map(id => sectionNames[id] || id).join(', ');
            } else {
                tdAccess.textContent = '—';
            }
            tr.appendChild(tdAccess);

            // === НОВАЯ КОЛОНКА: В системе (чек-бокс) ===
            const tdActive = document.createElement('td');
            tdActive.style.textAlign = 'center';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = user.is_active_session === 1;
            checkbox.disabled = (user.role === 'admin'); // Админа нельзя выключить
            
            checkbox.addEventListener('change', async function() {
                if (!this.checked) {
                    if (confirm(`Принудительно завершить сессию пользователя "${user.username}"?`)) {
                        try {
                            const response = await fetch(`/api/admin/users/${user.id}/force-logout`, {
                                method: 'POST',
                                credentials: 'include'
                            });
                            const data = await response.json();
                            if (response.ok && data.ok) {
                                alert(`Пользователь "${user.username}" принудительно выведен из системы`);
                                await loadUsers();
                            } else {
                                alert('Ошибка: ' + (data.error || 'Не удалось завершить сессию'));
                                this.checked = true; // Возврат в исходное состояние
                            }
                        } catch (error) {
                            console.error('Ошибка принудительного выхода:', error);
                            alert('Ошибка соединения с сервером');
                            this.checked = true;
                        }
                    } else {
                        this.checked = true; // Пользователь отменил действие
                    }
                }
            });
            
            tdActive.appendChild(checkbox);
            tr.appendChild(tdActive);
            
            // Действия
            const tdActions = document.createElement('td');
            
            const btnPass = document.createElement('button');
            btnPass.textContent = 'Пароль...';
            btnPass.className = 'btn-action';
            btnPass.onclick = () => changePassword(user.id, user.username);
            tdActions.appendChild(btnPass);
            
            // Кнопка "Доступ" ТОЛЬКО для Сотрудника производства
            if (user.role === 'worker') {
                const btnAccess = document.createElement('button');
                btnAccess.textContent = 'Доступ...';
                btnAccess.className = 'btn-action';
                btnAccess.onclick = () => openAccessModal(user.id, user.username, user.sections);
                tdActions.appendChild(btnAccess);
            }
            
            // Кнопка "Удалить" для Гостя и Сотрудника (Админа удалять нельзя через эту кнопку)
            if (user.role !== 'admin') {
                const btnDel = document.createElement('button');
                btnDel.textContent = 'Удалить';
                btnDel.className = 'btn-action btn-delete';
                btnDel.onclick = () => deleteUser(user.id, user.username);
                tdActions.appendChild(btnDel);
            }
            
            tr.appendChild(tdActions);
            tableBody.appendChild(tr);
        });
    }

    // --- Загрузка пользователей ---
    async function loadUsers() {
        try {
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            if (!response.ok) throw new Error('Ошибка загрузки');
            const users = await response.json();
            renderUsers(users);
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            showError('Не удалось загрузить список пользователей');
        }
    }

    // --- Обработка формы создания ---
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (errorDiv) errorDiv.style.display = 'none';
        
        const nameInput = document.getElementById('userNameInput');
        const loginInput = document.getElementById('userLoginInput');
        const passInput = document.getElementById('userPasswordInput');
        const roleInput = document.getElementById('userRoleSelect');
        
        const name = nameInput.value.trim();
        const username = loginInput.value.trim().toLowerCase();
        const password = passInput.value;
        const role = roleInput.value;
        
        // Для worker берем из чекбоксов, для guest/admin сервер сам проставит все, но передадим пустой или полный массив для чистоты
        let sections = [];
        if (role === 'worker') {
            sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(cb => cb.value);
        } else {
            sections = ['preparation', 'panels', 'module', 'options', 'installation', 'service'];
        }
        
        if (!name || !username || !password || !role) {
            showError('Заполните все обязательные поля');
            return;
        }
        if (password.length < 6) {
            showError('Пароль минимум 6 символов');
            return;
        }
        
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Добавление...';
        
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, name, role, password, sections })
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                form.reset();
                roleInput.dispatchEvent(new Event('change')); // Скрыть чекбоксы после сброса
                await loadUsers();
                alert('Пользователь создан!');
            } else {
                showError(data.error || 'Ошибка создания');
            }
        } catch (error) {
            console.error('Ошибка создания:', error);
            showError('Ошибка соединения с сервером');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    // Запуск при загрузке
    loadUsers();
});