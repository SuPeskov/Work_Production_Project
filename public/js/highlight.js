/**
 * highlight-search.js — Подсветка найденного текста по параметру URL
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Получаем параметр из URL
    const urlParams = new URLSearchParams(window.location.search);
    const highlightQuery = urlParams.get('highlight');

    if (!highlightQuery) return; // Если параметра нет — выходим

    console.log(`🔍 Подсветка поиска: "${highlightQuery}"`);

    // 2. Добавляем CSS стили для подсветки (если их еще нет)
    if (!document.getElementById('search-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'search-highlight-styles';
        style.textContent = `
            mark.search-highlight {
                background-color: #ffedd5 !important; /* Светло-оранжевый фон */
                color: #9a3412 !important;           /* Темно-оранжевый текст */
                padding: 2px 4px;
                border-radius: 4px;
                font-weight: 600;
                box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3); /* Легкое свечение */
            }
            /* Анимация пульсации для привлечения внимания */
            @keyframes highlight-pulse {
                0% { background-color: #fdba74; }
                50% { background-color: #ffedd5; }
                100% { background-color: #fdba74; }
            }
            mark.search-highlight.first-match {
                animation: highlight-pulse 1.5s ease-in-out 3; /* Пульсирует 3 раза */
            }
        `;
        document.head.appendChild(style);
    }

    // 3. Функция рекурсивного обхода текстовых узлов
    function highlightTextNodes(node, regex) {
        if (node.nodeType === 3) { // Текстовый узел
            const match = node.nodeValue.match(regex);
            if (match) {
                const span = document.createElement('span');
                // Заменяем найденное слово на <mark>
                span.innerHTML = node.nodeValue.replace(regex, '<mark class="search-highlight">$&</mark>');
                node.parentNode.replaceChild(span, node);
                return true; // Найдено совпадение
            }
        } else if (node.nodeType === 1 && node.childNodes && 
                   !/(script|style|textarea|input|mark)/i.test(node.tagName)) {
            // Элементный узел (пропускаем скрипты, стили и уже помеченные элементы)
            for (let i = 0; i < node.childNodes.length; i++) {
                if (highlightTextNodes(node.childNodes[i], regex)) {
                    // Если нужно подсветить только первое вхождение, можно вернуть true здесь
                }
            }
        }
        return false;
    }

    // 4. Подготовка регулярного выражения
    // Экранируем спецсимволы в запросе
    const escapedQuery = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Флаг 'gi' — глобальный поиск, без учета регистра
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    // 5. Запуск подсветки внутри основного контента
    // Ищем контейнер с контентом операции (адаптируйте селектор под вашу верстку)
    const contentContainer = document.querySelector('.operation-main') || document.body;
    
    if (contentContainer) {
        highlightTextNodes(contentContainer, regex);

        // 6. Прокрутка к первому найденному элементу
        const firstMatch = contentContainer.querySelector('mark.search-highlight');
        if (firstMatch) {
            firstMatch.classList.add('first-match'); // Добавляем класс для анимации
            
            // Плавная прокрутка к элементу
            setTimeout(() => {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
});