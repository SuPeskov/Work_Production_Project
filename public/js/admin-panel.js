/**
 * admin-panel.js — Управление пользователями через реальный API сервера
 * Исправленная версия: все функции доступны в нужной области видимости
 */

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('addUserForm');
    const tableBody = document.getElementById('usersTableBody');
    const errorDiv = document.getElementById('formError');

    if (!form || !tableBody) {
        console.error('❌ Форма или таблица не найдены');
        return;
    }

    console.log('✅ admin-panel.js загружен, форма найдена');

    // --- Функции действий (объявлены здесь, чтобы быть доступными для renderUsers) ---

    async function deleteUser(userId, username) {
        if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) return;
        
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            
            if (response.ok && data.ok) {
                alert('Пользователь удален');
                await loadUsers(); // Перезагружаем список
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

    // Открытие модалки
    function openAccessModal(userId, username, currentSections) {
        currentEditingUserId = userId;
        modalUserName.textContent = username;
        
        // Сбрасываем и устанавливаем галочки
        modalCheckboxes.forEach(cb => {
            cb.checked = currentSections && currentSections.includes(cb.value);
        });

        accessModal.style.display = 'flex';
    }

    // Закрытие модалки
    function closeAccessModal() {
        accessModal.style.display = 'none';
        currentEditingUserId = null;
    }

    // Сохранение изменений
    async function saveAccessChanges() {
        if (!currentEditingUserId) return;

        const selectedSections = Array.from(modalCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        try {
            const response = await fetch(`/api/admin/users/${currentEditingUserId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sections: selectedSections })
            });

            const data = await response.json();
            if (response.ok && data.ok) {
                alert('Доступ успешно обновлен');
                closeAccessModal();
                await loadUsers(); // Обновляем таблицу
            } else {
                alert('Ошибка: ' + (data.error || 'Не удалось сохранить'));
            }
        } catch (error) {
            console.error('Ошибка сохранения доступа:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    // Обработчики событий для модалки
    if (closeAccessModalBtn) closeAccessModalBtn.onclick = closeAccessModal;
    if (cancelAccessModalBtn) cancelAccessModalBtn.onclick = closeAccessModal;
    if (saveAccessModalBtn) saveAccessModalBtn.onclick = saveAccessChanges;
    
    // Закрытие по клику вне окна
    window.onclick = function(event) {
        if (event.target == accessModal) {
            closeAccessModal();
        }
    }

    // --- ЗАМЕНА СТАРОЙ ФУНКЦИИ changeAccess ---
    // Теперь она просто открывает модалку
    async function changeAccess(userId, username, currentSections) {
        openAccessModal(userId, username, currentSections);
    }
    // --- Отрисовка таблицы ---

    function renderUsers(users) {
        tableBody.innerHTML = '';
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
            if (user.role === 'admin') {
                tdAccess.textContent = 'все разделы';
            } else if (user.sections && user.sections.length > 0) {
                tdAccess.textContent = user.sections.join(', ');
            } else {
                tdAccess.textContent = '—';
            }
            tr.appendChild(tdAccess);

            // Действия
            const tdActions = document.createElement('td');
            
            // Кнопка Пароль
            const btnPass = document.createElement('button');
            btnPass.textContent = 'Пароль...';
            btnPass.className = 'btn-action';
            btnPass.onclick = () => changePassword(user.id, user.username);
            tdActions.appendChild(btnPass);

            // Кнопки для не-админов
            if (user.role !== 'admin') {
                const btnAccess = document.createElement('button');
                btnAccess.textContent = 'Доступ...';
                btnAccess.className = 'btn-action';
                btnAccess.onclick = () => changeAccess(user.id, user.username, user.sections);
                tdActions.appendChild(btnAccess);

                const btnDel = document.createElement('button');
                btnDel.textContent = 'Удалить';
                btnDel.className = 'btn-action btn-delete';
                // Теперь deleteUser доступна, так как объявлена в той же области видимости
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
        hideError();

        const nameInput = document.getElementById('userNameInput');
        const loginInput = document.getElementById('userLoginInput');
        const passInput = document.getElementById('userPasswordInput');
        const roleInput = document.getElementById('userRoleSelect');

        if (!nameInput || !loginInput || !passInput || !roleInput) {
            showError('Поля формы не найдены');
            return;
        }

        const name = nameInput.value.trim();
        const username = loginInput.value.trim().toLowerCase();
        const password = passInput.value;
        const role = roleInput.value;
        const sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(cb => cb.value);

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

    // --- Вспомогательные функции UI ---

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    function hideError() {
        if (errorDiv) errorDiv.style.display = 'none';
    }

    // Запуск при загрузке
    loadUsers();
});