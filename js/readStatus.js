/**
 * readStatus.js — Кнопка "Ознакомлен" с версионностью
 * - Пользователь берётся из реальной сессии (auth.js/kb.js)
 * - Отметки пишутся в единый реестр kb_reads_v1 (для страницы мониторинга)
 * - Пользователь не может снять отметку
 * - Кнопка сбрасывается при изменении версии операции
 * - Гость кнопку подтвердить не может
 */

document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('readBtn');
    if (!btn) return;

    const opId = btn.dataset.opId;
    const opVersion = parseInt(btn.dataset.opVersion) || 1;
    const statusInfo = document.getElementById('readStatusInfo');

    // Реальный пользователь из сессии
    const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

    // Подтверждать ознакомление может только Сотрудник производства.
    // Гость и Администратор — кнопка неактивна.
    const canConfirm = (typeof kbUserCanConfirmRead === 'function')
        ? kbUserCanConfirmRead(user)
        : (!!user && user.role !== ROLE_GUEST);
    if (!canConfirm) {
        btn.disabled = true;
        btn.classList.add('is-disabled-guest');
        if (statusInfo) {
            statusInfo.textContent = (user && user.role === ROLE_ADMIN)
                ? 'Отметка «Ознакомлен» доступна только сотрудникам производства'
                : 'Гостевой доступ: просмотр без подтверждения ознакомления';
        }
        return;
    }

    const userId = user ? user.username : 'anonymous';
    // Ключ в localStorage (включает версию)
    const storageKey = `read_${userId}_${opId}_v${opVersion}`;

    function markAsRead(timestamp) {
        btn.classList.add('is-read');
        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = 'Ознакомлен ✓';
        if (timestamp && statusInfo) {
            statusInfo.textContent = `Отметка поставлена: ${new Date(timestamp).toLocaleString('ru-RU')}`;
        }
    }

    // Функция проверки статуса при загрузке
    function checkStatus() {
        // Единый реестр отметок (используется страницей мониторинга)
        if (typeof kbHasRead === 'function' && kbHasRead(userId, opId, opVersion)) {
            const rec = kbGetReads().find(r => r.userId === userId && r.opId === opId && r.version === opVersion);
            markAsRead(rec && rec.timestamp);
            return;
        }

        const readData = localStorage.getItem(storageKey);

        if (readData) {
            const data = JSON.parse(readData);

            if (data.version === opVersion) {
                // Миграция старой одиночной отметки в единый реестр
                if (typeof kbAddRead === 'function') kbAddRead(userId, opId, opVersion);
                markAsRead(data.timestamp);
            } else {
                // Версия не совпадает — сбрасываем
                localStorage.removeItem(storageKey);
                resetButton();
            }
        } else {
            resetButton();
        }
    }

    // Сброс кнопки в исходное состояние
    function resetButton() {
        btn.classList.remove('is-read');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Ознакомлен';
        statusInfo.textContent = '';
    }

    // Обработчик клика
    btn.addEventListener('click', function() {
        if (btn.classList.contains('is-read')) return;

        const now = new Date().toISOString();

        // Единый реестр для мониторинга
        if (typeof kbAddRead === 'function') kbAddRead(userId, opId, opVersion);
        // Совместимость со старым ключом
        localStorage.setItem(storageKey, JSON.stringify({
            userId: userId, opId: opId, version: opVersion, timestamp: now
        }));

        markAsRead(now);
        showToast('✓ Вы отметили операцию как ознакомленную');
        console.log(`✅ Операция ${opId} v${opVersion} отмечена как ознакомленная (${userId})`);
    });

    // Проверяем статус при загрузке
    checkStatus();

    console.log(`✅ Кнопка "Ознакомлен" инициализирована: ${opId} v${opVersion}, пользователь ${userId}`);
});

// Простой toast (если ещё нет)
function showToast(message) {
    let toast = document.getElementById('readToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'readToast';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#16a34a;color:white;padding:14px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;font-family:Inter,sans-serif;font-weight:500;transition:all 0.3s;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}
