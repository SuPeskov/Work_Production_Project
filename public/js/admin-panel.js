/**
 * admin-panel.js — Управление пользователями через реальный API сервера
 */

// Глобальная функция для диагностики
async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    try {
        const response = await fetch('/api/admin/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Ошибка загрузки');
        const users = await response.json();
        renderUsers(users);
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Не удалось загрузить список пользователей');
    }
}

function renderUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.textContent = user.name;
        tr.appendChild(tdName);

        const tdLogin = document.createElement('td');
        tdLogin.textContent = user.username;
        tr.appendChild(tdLogin);

        const tdRole = document.createElement('td');
        const roleLabel = { admin: 'Администратор', worker: 'Сотрудник производства', guest: 'Гость' }[user.role] || user.role;
        tdRole.textContent = roleLabel;
        tr.appendChild(tdRole);

        const tdAccess = document.createElement('td');
        if (user.role === 'admin') {
            tdAccess.textContent = 'все разделы';
        } else if (user.sections && user.sections.length > 0) {
            tdAccess.textContent = user.sections.join(', ');
        } else {
            tdAccess.textContent = '—';
        }
        tr.appendChild(tdAccess);

        const tdActions = document.createElement('td');
        
        const btnPassword = document.createElement('button');
        btnPassword.textContent = 'Пароль...';
        btnPassword.className = 'btn-action';
        btnPassword.onclick = () => changePassword(user.id, user.username);
        tdActions.appendChild(btnPassword);

        if (user.role !== 'admin') {
            const btnAccess = document.createElement('button');
            btnAccess.textContent = 'Доступ...';
            btnAccess.className = 'btn-action';
            btnAccess.onclick = () => changeAccess(user.id, user.username, user.sections);
            tdActions.appendChild(btnAccess);

            const btnDelete = document.createElement('button');
            btnDelete.textContent = 'Удалить';
            btnDelete.className = 'btn-action btn-delete';
            btnDelete.onclick = () => deleteUser(user.id, user.username);
            tdActions.appendChild(btnDelete);
        }

        tr.appendChild(tdActions);
        tableBody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('addUserForm');
    const errorDiv = document.getElementById('formError');

    if (!form) {
        console.error('❌ Форма addUserForm не найдена!');
        return;
    }

    console.log('✅ admin-panel.js загружен, форма найдена');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        hideError();

        // ИСПОЛЬЗУЕМ НОВЫЕ ID (без конфликта с шапкой)
        const nameInput = document.getElementById('userNameInput');
        const loginInput = document.getElementById('userLoginInput');
        const passInput = document.getElementById('userPasswordInput');
        const roleInput = document.getElementById('userRoleSelect');

        const name = nameInput.value.trim();
        const username = loginInput.value.trim().toLowerCase();
        const password = passInput.value;
        const role = roleInput.value;
        const sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(cb => cb.value);

        console.log('📤 Отправка:', { username, name, role, password: '***', sections });

        if (!name || !username || !password || !role) {
            showError('Заполните все обязательные поля');
            return;
        }

        if (password.length < 6) {
            showError('Пароль должен содержать минимум 6 символов');
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
            console.log('📥 Ответ сервера:', response.status, data);

            if (response.ok && data.ok) {
                form.reset();
                await loadUsers();
                alert('✅ Пользователь успешно создан!');
            } else {
                showError(data.error || 'Ошибка создания пользователя');
            }
        } catch (error) {
            console.error('💥 Ошибка:', error);
            showError('Ошибка соединения с сервером: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    async function deleteUser(userId, username) {
        if (!confirm(`Удалить пользователя "${username}"?`)) return;
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                await loadUsers();
                alert('Пользователь удалён');
            } else {
                alert(data.error || 'Ошибка удаления');
            }
        } catch (error) {
            alert('Ошибка соединения');
        }
    }

    async function changePassword(userId, username) {
        const newPassword = prompt(`Новый пароль для "${username}":`);
        if (!newPassword || newPassword.length < 6) {
            if (newPassword) alert('Минимум 6 символов');
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
            if (response.ok && data.ok) alert('Пароль изменён');
            else alert(data.error || 'Ошибка');
        } catch (error) {
            alert('Ошибка соединения');
        }
    }

    async function changeAccess(userId, username, currentSections) {
        const sections = prompt(
            `ID разделов через запятую для "${username}":\n(preparation, panels, module, options, installation, service)\n\nТекущий: ${currentSections ? currentSections.join(', ') : 'нет'}`,
            currentSections ? currentSections.join(', ') : ''
        );
        if (sections === null) return;
        const sectionsList = sections.split(',').map(s => s.trim()).filter(s => s);
        try {
            const response = await fetch(`/api/admin/users/${userId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sections: sectionsList })
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                await loadUsers();
                alert('Доступ обновлён');
            } else {
                alert(data.error || 'Ошибка');
            }
        } catch (error) {
            alert('Ошибка соединения');
        }
    }

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    function hideError() {
        if (errorDiv) errorDiv.style.display = 'none';
    }

    // Загружаем пользователей при открытии страницы
    loadUsers();
});