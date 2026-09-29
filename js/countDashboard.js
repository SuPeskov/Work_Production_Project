/**
 * countDashboard.js — Автоматический подсчёт статистики на дашборде
 * Считает разделы, подразделы и операции на основе реальных страниц
 */

document.addEventListener('DOMContentLoaded', async function() {
    
    // Функция склонения
    function getWord(count, one, few, many) {
        const lastTwo = count % 100;
        const last = count % 10;
        
        if (lastTwo >= 11 && lastTwo <= 19) return many;
        if (last === 1) return one;
        if (last >= 2 && last <= 4) return few;
        return many;
    }
    
    // Конфигурация разделов (пути к страницам)
    const sections = [
        { file: 'pages/preparation.html',  card: 0 },
        { file: 'pages/panels.html',       card: 1 },
        { file: 'pages/module.html',       card: 2 },
        { file: 'pages/options.html',      card: 3 },
        { file: 'pages/installation.html', card: 4 },
        { file: 'pages/service.html',      card: 5 }
    ];
    
    let totalSubsections = 0;
    let totalOperations = 0;
    const cards = document.querySelectorAll('.card.card-section');
    
    // Функция загрузки и парсинга страницы раздела
    async function loadSectionData(section) {
        try {
            const response = await fetch(section.file);
            const html = await response.text();
            
            // Парсим HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Считаем подразделы
            const subsections = doc.querySelectorAll('.accordion-section');
            const subsectionCount = subsections.length;
            
            // Считаем операции
            const operations = doc.querySelectorAll('.operations-list a');
            const operationCount = operations.length;
            
            return { subsectionCount, operationCount };
        } catch (error) {
            console.warn(`️ Не удалось загрузить ${section.file}:`, error.message);
            return { subsectionCount: 0, operationCount: 0 };
        }
    }
    
    // Загружаем данные по всем разделам
    for (const section of sections) {
        const data = await loadSectionData(section);
        
        totalSubsections += data.subsectionCount;
        totalOperations += data.operationCount;
        
        // Обновляем бейджи на карточке раздела
        if (cards[section.card]) {
            const badges = cards[section.card].querySelectorAll('.card-badge');
            if (badges.length >= 2) {
                badges[0].textContent = data.subsectionCount + ' ' + 
                    getWord(data.subsectionCount, 'подраздел', 'подраздела', 'подразделов');
                badges[1].textContent = '~' + data.operationCount + ' ' + 
                    getWord(data.operationCount, 'операция', 'операции', 'операций');
            }
        }
        
        console.log(`✅ ${section.file}: ${data.subsectionCount} подразделов, ${data.operationCount} операций`);
    }
    
    // Обновляем общую статистику внизу дашборда
    const statNumbers = document.querySelectorAll('.stat-number');
    
    // Количество разделов (считаем карточки)
    const sectionCount = cards.length;
    if (statNumbers[0]) {
        statNumbers[0].textContent = sectionCount;
    }
    
    // Количество подразделов
    if (statNumbers[1]) {
        statNumbers[1].textContent = totalSubsections;
    }
    
    // Количество операций (с тильдой ~)
    if (statNumbers[2]) {
        statNumbers[2].textContent = '~' + totalOperations;
    }
    
    console.log(` ИТОГО: ${sectionCount} разделов, ${totalSubsections} подразделов, ~${totalOperations} операций`);
});