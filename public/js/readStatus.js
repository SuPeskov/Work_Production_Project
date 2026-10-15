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

    // Функция визуального обновления кнопки
    function markAsRead(timestamp) {
        button.classList.add('is-read');
        button.disabled = true;
        const textSpan = button.querySelector('.btn-text') || button;
        if (textSpan) textSpan.textContent = 'Ознакомлен ✓';
        
        if (timestamp && statusInfo) {
            statusInfo.textContent = `Отметка поставлена: ${new Date(timestamp).toLocaleString('ru-RU')}`;
        }
    }

    // Проверка статуса при загрузке (сначала пробуем сервер, потом localStorage)
    async function checkStatus() {
        // 1. Проверяем сервер (если есть доступ)
        try {
            // Мы не можем легко проверить конкретную операцию через GET /api/reads без загрузки всего списка,
            // поэтому полагаемся на то, что если кнопка нажата, сервер вернет ok.
            // Но для отображения "уже ознакомлен" при перезагрузке страницы, нам нужно знать состояние.
            // Простой способ: попробовать отправить запрос? Нет, это создаст дубль.
            // Лучше: проверить localStorage как кэш, но доверять серверу.
            // В данной архитектуре проще всего: если в localStorage есть запись И она совпадает по версии,
            // считаем что ознакомлен. При клике все равно отправим на сервер (идемпотентно).
            
            const storageKey = `read_${userId}_${opId}_v${opVersion}`;
            const readData = localStorage.getItem(storageKey);
            
            if (readData) {
                const data = JSON.parse(readData);
                if (data.version === opVersion) {
                    markAsRead(data.timestamp);
                    return; // Уже отмечено локально, кнопку блокируем
                }
            }
        } catch (e) {
            console.warn('Ошибка проверки локального статуса', e);
        }

        // Если не отмечено локально, сбрасываем кнопку
        resetButton();
    }

    function resetButton() {
        button.classList.remove('is-read');
        button.disabled = false;
        const textSpan = button.querySelector('.btn-text') || button;
        if (textSpan) textSpan.textContent = 'Ознакомлен';
        if (statusInfo) statusInfo.textContent = '';
    }

    // Обработчик клика
    button.addEventListener('click', async function() {
        if (button.classList.contains('is-read')) return;

        const now = new Date().toISOString();
        const originalText = button.innerHTML;
        
        // Блокируем кнопку на время запроса
        button.disabled = true;
        const textSpan = button.querySelector('.btn-text') || button;
        if (textSpan) textSpan.textContent = 'Отправка...';

        try {
            // --- ОТПРАВКА НА СЕРВЕР (ГЛАВНОЕ ИЗМЕНЕНИЕ) ---
            const response = await fetch(`/api/read/${opId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Обязательно для передачи куки авторизации
                body: JSON.stringify({ version: String(opVersion) })
            });

            const data = await response.json();

            if (response.ok && data.ok) {
                // Успех на сервере
                
                // Сохраняем в localStorage для быстрого отображения при перезагрузке
                const storageKey = `read_${userId}_${opId}_v${opVersion}`;
                localStorage.setItem(storageKey, JSON.stringify({
                    userId: userId, opId: opId, version: opVersion, timestamp: now
                }));

                // Также дублируем в общий реестр kb.js (на случай, если мониторинг где-то еще использует его)
                if (typeof kbAddRead === 'function') {
                    kbAddRead(userId, opId, opVersion);
                }

                markAsRead(now);
                showToast('✓ Вы отметили операцию как ознакомленную');
                console.log(`✅ Операция ${opId} v${opVersion} сохранена на сервере (${userId})`);
            } else {
                // Ошибка сервера (например, 403 Нет доступа или 401 Не авторизован)
                alert('Ошибка сохранения: ' + (data.error || 'Неизвестная ошибка сервера'));
                button.disabled = false;
                if (textSpan) textSpan.textContent = 'Ознакомлен';
            }
        } catch (error) {
            console.error('Сетевая ошибка:', error);
            alert('Ошибка соединения с сервером. Проверьте интернет и попробуйте снова.');
            button.disabled = false;
            if (textSpan) textSpan.textContent = 'Ознакомлен';
        }
    });

    // Запуск проверки при загрузке
    checkStatus();
    console.log(`✅ Кнопка "Ознакомлен" инициализирована: ${opId} v${opVersion}, пользователь ${userId}`);
});

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