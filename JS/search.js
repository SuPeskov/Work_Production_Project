/**
 * search.js — Поисковая система на базе Lunr.js
 */

class SearchEngine {
    constructor() {
        this.index = null;
        this.documents = [];
        this.isLoaded = false;
    }
    
    async loadIndex() {
        if (this.isLoaded) return;
        
        try {
            // Путь зависит от расположения страницы
            const basePath = window.location.pathname.includes('/operations/') 
                ? '../../js/search-index.json'
                : window.location.pathname.includes('/pages/')
                    ? '../js/search-index.json'
                    : 'js/search-index.json';
            
            const response = await fetch(basePath);
            const data = await response.json();
            
            this.index = lunr.Index.load(data.index);
            this.documents = data.documents;
            this.isLoaded = true;
            
            console.log('✅ Поисковый индекс загружен, документов:', this.documents.length);
        } catch (error) {
            console.error('❌ Ошибка загрузки поискового индекса:', error);
        }
    }
    
    search(query) {
        if (!this.isLoaded || !query || query.trim().length === 0) {
            return [];
        }
        
        try {
            // Поиск с wildcard для частичного совпадения
            const results = this.index.search(query + '*');
            
            return results.map(result => {
                const doc = this.documents.find(d => d.id === result.ref);
                if (!doc) return null;
                return { ...doc, score: result.score };
            }).filter(Boolean);
        } catch (error) {
            // Если wildcard-поиск падает (например, из-за спецсимволов), 
            // пробуем обычный поиск
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
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        return highlighted;
    }
    
    getExcerpt(content, query, maxLength = 180) {
        if (!content) return '';
        const lowerContent = content.toLowerCase();
        const words = query.toLowerCase().split(/\s+/);
        
        let position = -1;
        for (const word of words) {
            if (word.length < 2) continue;
            const pos = lowerContent.indexOf(word);
            if (pos !== -1) { position = pos; break; }
        }
        
        if (position === -1) {
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }
        
        const start = Math.max(0, position - 40);
        const end = Math.min(content.length, position + maxLength);
        let excerpt = content.substring(start, end);
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return this.highlightText(excerpt, query);
    }
}

const searchEngine = new SearchEngine();

// Метки типов документов
const TYPE_LABELS = {
    'section':    { label: 'Раздел',     color: '#1a5632' },
    'subsection': { label: 'Подраздел',  color: '#238347' },
    'operation':  { label: 'Операция',   color: '#d4a843' }
};

document.addEventListener('DOMContentLoaded', async function() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchOverlay = document.getElementById('searchOverlay');
    
    if (!searchInput || !searchResults) return;
    
    await searchEngine.loadIndex();
    
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchOverlay.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(() => performSearch(query), 300);
    });
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query.length >= 2) {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchOverlay.classList.add('hidden');
        }
    });
    
    function performSearch(query) {
        const results = searchEngine.search(query);
        
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    <p>Ничего не найдено по запросу "<strong>${query}</strong>"</p>
                    <p class="search-hint">Попробуйте изменить запрос или использовать ключевые слова</p>
                </div>
            `;
            searchOverlay.classList.remove('hidden');
            return;
        }
        
        // Группируем результаты по типу
        const grouped = {
            section: results.filter(r => r.type === 'section'),
            subsection: results.filter(r => r.type === 'subsection'),
            operation: results.filter(r => r.type === 'operation')
        };
        
        let html = `<div class="search-results-header">Найдено: <strong>${results.length}</strong></div>`;
        
        // Разделы
        if (grouped.section.length > 0) {
            html += `<div class="search-group-label">Разделы</div>`;
            html += grouped.section.slice(0, 3).map(r => renderResult(r, query)).join('');
        }
        
        // Подразделы
        if (grouped.subsection.length > 0) {
            html += `<div class="search-group-label">Подразделы</div>`;
            html += grouped.subsection.slice(0, 5).map(r => renderResult(r, query)).join('');
        }
        
        // Операции
        if (grouped.operation.length > 0) {
            html += `<div class="search-group-label">Операции</div>`;
            html += grouped.operation.slice(0, 7).map(r => renderResult(r, query)).join('');
        }
        
        searchResults.innerHTML = html;
        searchOverlay.classList.remove('hidden');
    }
    
    function renderResult(result, query) {
        const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
        const highlightedTitle = searchEngine.highlightText(result.title, query);
        const excerpt = result.type === 'operation' 
            ? searchEngine.getExcerpt(result.content, query)
            : '';
        
        // Формируем ссылку с якорем для подразделов
        let url = '../' + result.url;
        if (result.anchor) {
            url += '#' + result.anchor;
        }
        
        return `
            <a href="${url}" class="search-result-item">
                <div class="search-result-header">
                    <span class="search-result-type" style="background: ${typeInfo.color}">
                        ${typeInfo.label}
                    </span>
                    ${result.number ? `<span class="search-result-number">${result.number}</span>` : ''}
                    <h3 class="search-result-title">${highlightedTitle}</h3>
                </div>
                ${excerpt ? `<p class="search-result-excerpt">${excerpt}</p>` : ''}
            </a>
        `;
    }
});