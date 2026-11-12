/**
 * highlight-search.js — Подсветка найденного текста (ЖЕЛТЫЙ ЦВЕТ)
 */
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightQuery = urlParams.get('highlight');

    if (!highlightQuery) return;

    // Добавляем стили (Желтая тема)
    if (!document.getElementById('search-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'search-highlight-styles';
        style.textContent = `
            mark.search-highlight {
                background-color: #fef3c7 !important; /* Желтый фон (#fef3c7) */
                color: #1a1a2e !important;            /* Темный текст */
                padding: 2px 4px;
                border-radius: 3px;
                font-weight: 600;
                box-shadow: 0 0 0 2px rgba(250, 188, 27, 0.4); /* Золотистая рамка */
            }
            @keyframes highlight-pulse-yellow {
                0% { background-color: #fde68a; box-shadow: 0 0 0 4px rgba(250, 188, 27, 0.6); }
                50% { background-color: #fef3c7; box-shadow: 0 0 0 2px rgba(250, 188, 27, 0.4); }
                100% { background-color: #fde68a; box-shadow: 0 0 0 4px rgba(250, 188, 27, 0.6); }
            }
            mark.search-highlight.first-match {
                animation: highlight-pulse-yellow 1.5s ease-in-out 3;
            }
        `;
        document.head.appendChild(style);
    }

    // Функция обхода DOM
    function highlightTextNodes(node, regex) {
        if (node.nodeType === 3) { // Текстовый узел
            const match = node.nodeValue.match(regex);
            if (match) {
                const span = document.createElement('span');
                span.innerHTML = node.nodeValue.replace(regex, '<mark class="search-highlight">$&</mark>');
                node.parentNode.replaceChild(span, node);
                return true;
            }
        } else if (node.nodeType === 1 && node.childNodes && 
                   !/(script|style|textarea|input|mark)/i.test(node.tagName)) {
            for (let i = 0; i < node.childNodes.length; i++) {
                highlightTextNodes(node.childNodes[i], regex);
            }
        }
        return false;
    }

    const escapedQuery = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    // Ищем контейнер с контентом
    const contentContainer = document.querySelector('.operation-main') || document.body;
    
    if (contentContainer) {
        highlightTextNodes(contentContainer, regex);

        const firstMatch = contentContainer.querySelector('mark.search-highlight');
        if (firstMatch) {
            firstMatch.classList.add('first-match');
            setTimeout(() => {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
});