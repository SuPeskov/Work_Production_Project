/**
 * countOperations.js — Автоматический подсчёт операций в подразделах
 * Подключается на страницах разделов (panels.html, preparation.html и т.д.)
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // Функция склонения слова "операция"
    function getOperationWord(count) {
        const lastTwoDigits = count % 100;
        const lastDigit = count % 10;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
            return 'операций';
        }
        
        if (lastDigit === 1) {
            return 'операция';
        }
        
        if (lastDigit >= 2 && lastDigit <= 4) {
            return 'операции';
        }
        
        return 'операций';
    }
    
    // Находим все подразделы на странице
    const accordionSections = document.querySelectorAll('.accordion-section');
    
    accordionSections.forEach(section => {
        // Считаем количество ссылок внутри .operations-list
        const links = section.querySelectorAll('.operations-list a');
        const count = links.length;
        
        // Находим элемент с количеством
        const countElement = section.querySelector('.subsection-count');
        
        if (countElement && count > 0) {
            countElement.textContent = count + ' ' + getOperationWord(count);
        } else if (countElement && count === 0) {
            countElement.textContent = '0 операций';
        }
    });
    
    console.log('✅ Подсчёт операций завершён');
});