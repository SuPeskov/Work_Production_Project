/**
 * readStatus.js — Кнопка "Ознакомлен" с версионностью
 * - Пользователь не может снять отметку
 * - Кнопка сбрасывается при изменении версии операции
 * - Администратор может сбросить через отдельный интерфейс (пока заглушка)
 */

document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('readBtn');
    if (!btn) return;
    
    const opId = btn.dataset.opId;
    const opVersion = parseInt(btn.dataset.opVersion) || 1;
    const userId = btn.dataset.userId || 'demo_user';
    const statusInfo = document.getElementById('readStatusInfo');
    
    // Ключ в localStorage (включает версию)
    const storageKey = `read_${userId}_${opId}_v${opVersion}`;
    
    // Функция проверки статуса при загрузке
    function checkStatus() {
        const readData = localStorage.getItem(storageKey);
        
        if (readData) {
            const data = JSON.parse(readData);
            
            // Проверяем, совпадает ли версия
            if (data.version === opVersion) {
                // Версия совпадает — показываем как ознакомленную
                btn.classList.add('is-read');
                btn.disabled = true; // Блокируем кнопку
                btn.querySelector('.btn-text').textContent = 'Ознакомлен';
                statusInfo.textContent = `Отметка поставлена: ${new Date(data.timestamp).toLocaleString('ru-RU')}`;
            } else {
                // Версия не совпадает — сбрасываем
                localStorage.removeItem(storageKey);
                resetButton();
            }
        } else {
            // Нет отметки — показываем активную кнопку
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
        // Если уже ознакомлен — ничего не делаем
        if (btn.classList.contains('is-read')) {
            return;
        }
        
        // Ставим отметку
        const data = {
            userId: userId,
            opId: opId,
            version: opVersion,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(data));
        
        // Обновляем UI
        btn.classList.add('is-read');
        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = 'Ознакомлен';
        statusInfo.textContent = `Отметка поставлена: ${new Date().toLocaleString('ru-RU')}`;
        
        // Показываем уведомление
        showToast('✓ Вы отметили операцию как ознакомленную');
        
        console.log(`✅ Операция ${opId} v${opVersion} отмечена как ознакомленная`);
    });
    
    // Проверяем статус при загрузке
    checkStatus();
    
    console.log(`✅ Кнопка "Ознакомлен" инициализирована для операции ${opId} v${opVersion}`);
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