/**
 * readStatus.js — Кнопка "Ознакомлен" с версионностью
 * ИСПРАВЛЕНО: Теперь отправляет данные на сервер (/api/read/:opId),
 * а не только в localStorage. Это позволяет странице мониторинга видеть отметки.
 */
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('readBtn'); // В HTML кнопка имеет id="readBtn" или "confirmReadBtn"? Проверьте!
    // В предоставленном HTML 2.1.1.html кнопка имеет текст "Ознакомлен", но ID не виден в дампе.
    // Обычно в таких шаблонах ID либо 'readBtn', либо 'confirmReadBtn'.
    // Давайте искать оба варианта для надежности.
    const button = document.getElementById('readBtn') || document.getElementById('confirmReadBtn');
    
    if (!button) return;

    // Получаем ID операции и версию из data-атрибутов кнопки
    // Если их нет, пробуем вытащить из URL
    let opId = button.dataset.opId;
    let opVersion = parseInt(button.dataset.opVersion) || 1;

    if (!opId) {
        const match = window.location.pathname.match(/(\d+\.\d+\.\d+)\.html$/);
        if (match) opId = match[1];
    }

    if (!opId) {
        console.error('Не удалось определить ID операции');
        return;
    }

    const statusInfo = document.getElementById('readStatusInfo');

    // Получаем текущего пользователя
    let user = null;
    if (typeof kbGetCurrentUser === 'function') {
        user = kbGetCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
        user = getCurrentUser();
    }

    // Проверка прав: только Сотрудник производства может подтверждать
    const opRec = (typeof kbGetOperationById === 'function') ? kbGetOperationById(opId) : null;
    const isDraft = !!(opRec && opRec.status === 'draft');
    
    // Роль должна быть 'Сотрудник производства' (русская строка из сессии)
    const canConfirm = (!isDraft) && user && (user.role === 'Сотрудник производства' || user.role === 'worker');

    if (!canConfirm) {
        button.disabled = true;
        button.classList.add('is-disabled-guest');
        if (statusInfo) {
            if (isDraft) {
                statusInfo.textContent = 'Черновик операции: страница наполняется администратором.';
            } else if (!user) {
                statusInfo.textContent = 'Войдите в систему, чтобы подтвердить ознакомление.';
            } else {
                statusInfo.textContent = 'Отметка «Ознакомлен» доступна только сотрудникам производства.';
            }
        }
        return;
    }

    const userId = user.username;

// === Функция визуального обновления кнопки ===
function markAsRead(timestamp) {
    button.classList.add('is-read');
    button.disabled = true;
    const textSpan = button.querySelector('.btn-text') || button;
    if (textSpan) textSpan.textContent = 'Ознакомлен ✓';
    if (timestamp && statusInfo) {
        statusInfo.textContent = `Отметка поставлена: ${new Date(timestamp).toLocaleString('ru-RU')}`;
    }
}

function resetButton() {
    button.classList.remove('is-read');
    button.disabled = false;
    const textSpan = button.querySelector('.btn-text') || button;
    if (textSpan) textSpan.textContent = 'Ознакомлен';
    if (statusInfo) statusInfo.textContent = '';
}

// === ПРОВЕРКА СТАТУСА ПРИ ЗАГРУЗКЕ (СИНХРОНИЗАЦИЯ С СЕРВЕРОМ) ===
// === ПРОВЕРКА СТАТУСА ПРИ ЗАГРУЗКЕ (СИНХРОНИЗАЦИЯ С СЕРВЕРОМ) ===
async function checkStatus() {
    try {
        // Запрашиваем статус именно для этой операции у сервера
        const response = await fetch('/api/read-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ opIds: [opId] })
        });

        if (!response.ok) throw new Error('Ошибка сети');
        
        const statuses = await response.json();
        const statusObj = statuses[opId];
        
        // Если сервер подтверждает, что текущая версия прочитана — переключаем кнопку
        if (statusObj && statusObj.isRead) {
            markAsRead(statusObj.timestamp || new Date().toISOString());
            
            // Обновляем локальный кэш для надежности
            const storageKey = `read_${userId}_${opId}_v${opVersion}`;
            localStorage.setItem(storageKey, JSON.stringify({
                userId: userId, 
                opId: opId, 
                version: opVersion, 
                timestamp: statusObj.timestamp || new Date().toISOString()
            }));
        } else {
            // Если не прочитано — сбрасываем кнопку (даже если в localStorage был старый кэш)
            resetButton();
        }
    } catch (error) {  // <--- ЗДЕСЬ БЫЛА ОШИБКА: отсутствовала эта скобка или она была misplaced
        console.warn('Не удалось синхронизировать статус кнопки с сервером:', error);
        
        // Fallback: если сервер недоступен, пробуем проверить локальный кэш
        const storageKey = `read_${userId}_${opId}_v${opVersion}`;
        const readData = localStorage.getItem(storageKey);
        
        if (readData) {
            try {
                const data = JSON.parse(readData);
                if (data.version === opVersion) {
                    markAsRead(data.timestamp);
                    return;
                }
            } catch (e) {}
        }
        resetButton();
    }
}

// Обработчик клика (остается прежним, но добавляем синхронизацию после успеха)
button.addEventListener('click', async function() {
    if (button.classList.contains('is-read')) return;

    const now = new Date().toISOString();
    button.disabled = true;
    const textSpan = button.querySelector('.btn-text') || button;
    if (textSpan) textSpan.textContent = 'Отправка...';

    try {
        const response = await fetch(`/api/read/${opId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ version: String(opVersion) })
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            // Сохраняем в localStorage
            const storageKey = `read_${userId}_${opId}_v${opVersion}`;
            localStorage.setItem(storageKey, JSON.stringify({
                userId: userId, opId: opId, version: opVersion, timestamp: now
            }));
            
            // Дублируем в общий реестр kb.js
            if (typeof kbAddRead === 'function') {
                kbAddRead(userId, opId, opVersion);
            }
            
            markAsRead(now);
            showToast('✓ Вы отметили операцию как ознакомленную');
            
            // ⚡ ВАЖНО: Принудительно перекрашиваем фон в списке раздела
            // Это мгновенно убирает оранжевый фон без перезагрузки страницы
            try {
                await fetch('/api/read-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ opIds: [opId] })
                });
                // Триггерим событие для operation-status.js, если он слушает
                window.dispatchEvent(new CustomEvent('kb:operation-read', { detail: { opId, version: opVersion } }));
            } catch(e) {}
            
        } else {
            alert('Ошибка сохранения: ' + (data.error || 'Неизвестная ошибка'));
            resetButton();
        }
    } catch (error) {
        console.error('Сетевая ошибка:', error);
        alert('Ошибка соединения с сервером.');
        resetButton();
    }
});

// Запуск проверки при загрузке
checkStatus();
console.log(`✅ Кнопка "Ознакомлен" инициализирована: ${opId} v${opVersion}, пользователь ${userId}`);

// Toast уведомление
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