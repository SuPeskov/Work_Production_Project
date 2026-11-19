/**
 * operation.js — Обработчик кнопки "Ознакомлен" на страницах операций
 * Отправляет данные на сервер вместо localStorage.
 */
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('confirmReadBtn');
    if (!btn) return;

    // 1. Определяем ID операции из URL
    // Пример URL: /pages/operations/2.1.1.html -> match[1] = "2.1.1"
    const match = window.location.pathname.match(/(\d+\.\d+\.\d+)\.html$/);
    if (!match) {
        console.error('Не удалось определить ID операции из URL');
        return;
    }
    const opId = match[1];

    // 2. Проверяем, не ознакомлен ли пользователь уже (опционально, можно запросить у сервера)
    // Для простоты пока просто вешаем обработчик. 
    // В идеале нужно делать GET /api/reads и проверять наличие записи, но это лишняя нагрузка.
    // Пусть сервер сам проверяет идемпотентность (он это умеет).

    btn.addEventListener('click', async function() {
        // Блокируем кнопку на время запроса
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const response = await fetch(`/api/read/${opId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Важно для передачи куки авторизации
                body: JSON.stringify({ version: '1' }) // Версия пока хардкодом, можно брать из data-атрибута
            });

            const data = await response.json();

            if (response.ok && data.ok) {
                // Успех
                btn.textContent = '✅ Ознакомлен';
                btn.style.backgroundColor = '#10b981'; // Зеленый цвет
                btn.style.color = '#fff';
                btn.style.borderColor = '#10b981';
                // Кнопка остается заблокированной
            } else {
                // Ошибка сервера (например, нет прав)
                alert('Ошибка: ' + (data.error || 'Не удалось сохранить отметку'));
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            console.error('Сетевая ошибка:', error);
            alert('Ошибка соединения с сервером. Попробуйте позже.');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
});