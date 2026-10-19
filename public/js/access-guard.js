/**
 * access-guard.js — Живая проверка прав доступа при каждом переходе
 * ИСПРАВЛЕНО: Синтаксис регулярных выражений и логика обновления сессии.
 */
document.addEventListener('DOMContentLoaded', async function() {
    const path = window.location.pathname;

    // 1. Страницы, где проверка не нужна (логин, дашборд, корень, статика, админка, мониторинг)
    const skipPaths = ['/', '/index.html', '/dashboard.html', '/admin-panel.html', '/monitoring.html'];
    
    // Проверяем точное совпадение или если путь заканчивается на один из skipPaths
    if (skipPaths.some(p => path === p || path.endsWith(p))) return;

    let currentSectionId = null;

    // 2. Определяем ID раздела из URL
    // ИСПРАВЛЕНО: Добавлены слэши /.../ для регулярных выражений
    const fileMatch = path.match(/\/pages\/([\w-]+)\.html$/);
    if (fileMatch) {
        const fileName = fileMatch[1] + '.html';
        if (typeof KB_SECTIONS !== 'undefined') {
            const sec = KB_SECTIONS.find(s => s.page.endsWith(fileName));
            if (sec) currentSectionId = sec.id;
        }
    }

    // Если не нашли, пробуем найти по ID операции (для страниц операций)
    if (!currentSectionId) {
        const opMatch = path.match(/\/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch && typeof KB_OPERATIONS !== 'undefined') {
            const op = KB_OPERATIONS.find(o => o.id === opMatch[1]);
            if (op) currentSectionId = op.section;
        }
    }

    // Если не смогли определить раздел (например, служебная страница), пропускаем проверку
    if (!currentSectionId) return;

    console.log(`🔒 Access Guard: Проверка доступа к разделу "${currentSectionId}" для пути ${path}`);

    // 3. Запрашиваем актуальные права у сервера
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Access Guard: Пользователь не авторизован (401). Редирект на логин.');
                window.location.href = '/index.html';
                return;
            }
            // При других ошибках (500, сеть) не блокируем, чтобы не ломать сайт при проблемах с API
            console.error('Access Guard: Ошибка сервера', response.status);
            return; 
        }

        const data = await response.json();
        
        if (!data.user) {
            console.warn('Access Guard: Сессия не найдена на сервере. Редирект на логин.');
            window.location.href = '/index.html';
            return;
        }

        // 4. Проверяем права
        // Администратор имеет доступ ко всему
        if (data.user.role === 'admin') {
            console.log('Access Guard: Администратор — доступ разрешен.');
            return;
        }

        const allowedSections = data.sections; // Массив ID или '*'
        
        // Если пришел '*', значит все разрешено (хотя для не-админов сервер должен слать массив)
        if (allowedSections === '*') return;

        if (Array.isArray(allowedSections) && !allowedSections.includes(currentSectionId)) {
            // ДОСТУПА НЕТ!
            console.warn(`Access Guard: Доступ к разделу "${currentSectionId}" ЗАКРЫТ. Редирект на дашборд.`);
            
            // Показываем уведомление
            alert('⚠️ Администратор изменил ваши права доступа.\nЭтот раздел больше недоступен.');
            
            // Принудительный редирект на дашборд
            window.location.href = '/dashboard.html';
        } else {
            // Доступ есть. Обновляем sessionStorage актуальными данными с сервера
            // Это критически важно, чтобы kb.js видел новые права без перезахода
            try {
                const sessionData = JSON.parse(sessionStorage.getItem('modular_house_session') || '{}');
                
                // Нормализуем роль для kb.js (он ждет русские названия)
                let roleLabel = data.user.role;
                if (roleLabel === 'admin') roleLabel = 'Администратор';
                else if (roleLabel === 'worker') roleLabel = 'Сотрудник производства';
                else if (roleLabel === 'guest') roleLabel = 'Гость';

                sessionData.role = roleLabel;
                // Сохраняем актуальный список разделов с сервера
                sessionData.access = Array.isArray(allowedSections) ? allowedSections : [];
                
                sessionStorage.setItem('modular_house_session', JSON.stringify(sessionData));
                console.log('Access Guard: Сессия обновлена актуальными правами:', sessionData.access);
            } catch (e) {
                console.error('Access Guard: Ошибка обновления сессии:', e);
            }
        }

    } catch (error) {
        console.error('Access Guard: Критическая ошибка проверки прав:', error);
        // При ошибке сети не блокируем пользователя
    }
});