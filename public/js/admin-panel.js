/**
 * admin-panel.js — Управление пользователями через реальный API сервера
 */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('addUserForm');
    const tableBody = document.getElementById('usersTableBody');
    const errorDiv = document.getElementById('formError');

    if (!form || !tableBody) return;

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

    function renderUsers(users) {
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
            }

            if (user.role !== 'admin') {
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

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        hideError();

        const name = document.getElementById('userName').value.trim();
        const username = document.getElementById('userLogin').value.trim().toLowerCase();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map(cb => cb.value);

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

            if (response.ok && data.ok) {
                form.reset();
                await loadUsers();
                alert('Пользователь успешно создан!');
            } else {
                showError(data.error || 'Ошибка создания пользователя');
            }
        } catch (error) {
            console.error('Ошибка создания пользователя:', error);
            showError('Ошибка соединения с сервером');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    async function deleteUser(userId, username) {
        if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) return;

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
            console.error('Ошибка удаления:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    async function changePassword(userId, username) {
        const newPassword = prompt(`Введите новый пароль для пользователя "${username}":`);
        if (!newPassword) return;

        if (newPassword.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
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
                alert('Пароль изменён');
            } else {
                alert(data.error || 'Ошибка изменения пароля');
            }
        } catch (error) {
            console.error('Ошибка изменения пароля:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    async function changeAccess(userId, username, currentSections) {
        const sections = prompt(
            `Введите ID разделов через запятую для пользователя "${username}":\n(preparation, panels, module, options, installation, service)\n\nТекущий доступ: ${currentSections ? currentSections.join(', ') : 'нет'}`,
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
                alert(data.error || 'Ошибка обновления доступа');
            }
        } catch (error) {
            console.error('Ошибка обновления доступа:', error);
            alert('Ошибка соединения с сервером');
        }
    }

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    function hideError() {
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    loadUsers();
});