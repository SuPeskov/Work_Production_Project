/**
 * search.js — Поисковая система (упрощённая версия для отладки)
 */

console.log('🔍 search.js загружен');

// Проверка зависимостей
if (typeof lunr === 'undefined') {
    console.error('❌ Lunr.js не загружен! Проверьте подключение скриптов.');
} else {
    console.log('✅ Lunr.js загружен');
}

class SearchEngine {
    constructor() {
        this.index = null;
        this.documents = [];
        this.isLoaded = false;
    }
    
    async loadIndex() {
        if (this.isLoaded) return true;
        
        try {
            // Определяем путь к индексу в зависимости от текущей страницы
            const path = window.location.pathname;
            let basePath;
            
            if (path.includes('/operations/')) {
                basePath = '../../js/search-index.json';
            } else if (path.includes('/pages/')) {
                basePath = '../js/search-index.json';
            } else {
                basePath = 'js/search-index.json';
            }
            
            console.log('📂 Загрузка индекса из:', basePath);
            
            const response = await fetch(basePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ Индекс загружен, документов:', data.documents.length);
            
            this.index = lunr.Index.load(data.index);
            this.documents = data.documents;
            this.isLoaded = true;
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка загрузки индекса:', error);
            return false;
        }
    }
    
    search(query) {
        if (!this.isLoaded || !query || query.trim().length === 0) {
            return [];
        }
        
        try {
            const results = this.index.search(query + '*');
            return results.map(result => {
                const doc = this.documents.find(d => d.id === result.ref);
                if (!doc) return null;
                return { ...doc, score: result.score };
            }).filter(Boolean);
        } catch (error) {
            try {
                const results = this.index.search(query);
                return results.map(result => {
                    const doc = this.documents.find(d => d.id === result.ref);
                    if (!doc) return null;
                    return { ...doc, score: result.score };
                }).filter(Boolean);
            } catch (e) {
                console.error('Ошибка поиска:', e);
                return [];
            }
        }
    }
    
    highlightText(text, query) {
        if (!query || !text) return text || '';
        const words = query.split(/\s+/).filter(w => w.length > 2);
        let highlighted = text;
        words.forEach(word => {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        return highlighted;
    }
}

const searchEngine = new SearchEngine();

const TYPE_LABELS = {
    'section':    { label: 'Раздел',     color: '#1a5632' },
    'subsection': { label: 'Подраздел',  color: '#238347' },
    'operation':  { label: 'Операция',   color: '#d4a843' }
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM загружен, инициализация поиска...');
    
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput) {
        console.warn('⚠️  Элемент #searchInput не найден');
        return;
    }
    console.log('✅ Элемент #searchInput найден');
    
    if (!searchResults) {
        console.warn('⚠️  Элемент #searchResults не найден');
        return;
    }
    console.log('✅ Элемент #searchResults найден');
    
    // Загружаем индекс
    const loaded = await searchEngine.loadIndex();
    if (!loaded) {
        console.warn('⚠️  Индекс не загружен, поиск работать не будет');
        searchInput.placeholder = 'Поиск недоступен (индекс не загружен)';
        return;
    }
    
    console.log('✅ Поиск готов к работе');
    
    // Обработка ввода
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        console.log('🔎 Запрос:', query);
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            const results = searchEngine.search(query);
            console.log(`📊 Найдено результатов: ${results.length}`);
            renderDropdownResults(results, query);
        }, 300);
    });
    
    // Обработка Enter — переход на страницу поиска
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                const baseUrl = 'search.html?q=' + encodeURIComponent(query);
                console.log('🔀 Переход на:', baseUrl);
                window.location.href = baseUrl;
            }
        }
    });
    
    // Закрытие при клике вне
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
    
    function renderDropdownResults(results, query) {
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    <p>Ничего не найдено по запросу "<strong>${query}</strong>"</p>
                    <p class="search-hint">Нажмите Enter для полного поиска</p>
                </div>
            `;
            searchResults.classList.remove('hidden');
            return;
        }
        
        // Группируем по типу
        const grouped = {
            section: results.filter(r => r.type === 'section'),
            subsection: results.filter(r => r.type === 'subsection'),
            operation: results.filter(r => r.type === 'operation')
        };
        
        let html = `<div class="search-results-header">Найдено: <strong>${results.length}</strong> · Enter → полный поиск</div>`;
        
        if (grouped.section.length > 0) {
            html += `<div class="search-group-label">Разделы</div>`;
            html += grouped.section.slice(0, 3).map(r => renderItem(r, query)).join('');
        }
        if (grouped.subsection.length > 0) {
            html += `<div class="search-group-label">Подразделы</div>`;
            html += grouped.subsection.slice(0, 5).map(r => renderItem(r, query)).join('');
        }
        if (grouped.operation.length > 0) {
            html += `<div class="search-group-label">Операции</div>`;
            html += grouped.operation.slice(0, 7).map(r => renderItem(r, query)).join('');
        }
        
        searchResults.innerHTML = html;
        searchResults.classList.remove('hidden');
    }
    
    /**
 * Вычисляет правильный относительный URL к документу
 * в зависимости от расположения текущей страницы
 */
function buildUrl(result) {
    // Получаем целевой путь из результата
    let targetPath = result.url;
    
    // Убираем возможные префиксы './' или '../'
    targetPath = targetPath.replace(/^\.\.?\//, '');
    
    // Определяем текущий путь
    const currentPath = window.location.pathname;
    
    let url;
    
    // Если мы уже в папке pages
    if (currentPath.includes('/pages/')) {
        // Если целевой файл тоже в pages - используем только имя файла
        if (targetPath.startsWith('pages/')) {
            const fileName = targetPath.replace('pages/', '');
            url = fileName;
        } else {
            url = targetPath;
        }
    } 
    // Если мы в корне сайта
    else {
        // Если целевой файл в pages - добавляем pages/
        if (!targetPath.startsWith('pages/') && !targetPath.startsWith('./') && !targetPath.startsWith('../')) {
            url = 'pages/' + targetPath;
        } else {
            url = targetPath.replace(/^\.\.?\//, '');
        }
    }
    
    // Добавляем якорь для подразделов
    if (result.anchor) {
        url += '#' + result.anchor;
    }
    
    console.log('🔗 Формирую URL:', {
        currentPath: currentPath,
        targetPath: result.url,
        result: url
    });
    
    return url;
}

 function renderItem(result, query) {
    const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
    const highlightedTitle = searchEngine.highlightText(result.title, query);
    
    const url = buildUrl(result);
    
    return `
        <a href="${url}" class="search-result-item">
            <div class="search-result-header">
                <span class="search-result-type" style="background: ${typeInfo.color}">
                    ${typeInfo.label}
                </span>
                ${result.number ? `<span class="search-result-number">${result.number}</span>` : ''}
                <h3 class="search-result-title">${highlightedTitle}</h3>
            </div>
        </a>
    `;
}

function renderResultCard(result, query) {
    const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
    const highlightedTitle = searchEngine.highlightText(result.title, query);
    const excerpt = result.type === 'operation' 
        ? searchEngine.getExcerpt(result.content, query, 250)
        : '';
    
    const url = buildUrl(result);
    
    return `
        <a href="${url}" class="search-result-card">
            <div class="result-card-header">
                <span class="search-result-type" style="background: ${typeInfo.color}">
                    ${typeInfo.icon} ${typeInfo.label}
                </span>
                ${result.number ? `<span class="search-result-number">${result.number}</span>` : ''}
            </div>
            <h3 class="result-card-title">${highlightedTitle}</h3>
            ${excerpt ? `<p class="result-card-excerpt">${excerpt}</p>` : ''}
            <div class="result-card-footer">
                <span class="result-card-relevance">Релевантность: ${Math.round(result.score * 100)}%</span>
                <span class="result-card-arrow">→</span>
            </div>
        </a>
    `;
}

});