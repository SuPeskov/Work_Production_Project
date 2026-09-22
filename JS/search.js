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
            const response = await fetch('../js/search-index.json');
            const data = await response.json();
            
            this.index = lunr.Index.load(data.index);
            this.documents = data.documents;
            this.isLoaded = true;
            
            console.log('✅ Поисковый индекс загружен');
        } catch (error) {
            console.error('❌ Ошибка загрузки поискового индекса:', error);
        }
    }
    
    search(query) {
        if (!this.isLoaded) {
            console.warn('Поисковый индекс ещё не загружен');
            return [];
        }
        
        if (!query || query.trim().length === 0) {
            return [];
        }
        
        try {
            // Поиск с поддержкой wildcard
            const results = this.index.search(query + '*');
            
            return results.map(result => {
                const doc = this.documents.find(d => d.id === result.ref);
                return {
                    ...doc,
                    score: result.score
                };
            });
        } catch (error) {
            console.error('Ошибка поиска:', error);
            return [];
        };
    }
    
    highlightText(text, query) {
        if (!query) return text;
        
        const words = query.split(/\s+/).filter(w => w.length > 2);
        let highlighted = text;
        
        words.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }
    
    getExcerpt(content, query, maxLength = 200) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const words = lowerQuery.split(/\s+/);
        
        // Найти позицию первого совпадения
        let position = -1;
        for (const word of words) {
            const pos = lowerContent.indexOf(word);
            if (pos !== -1) {
                position = pos;
                break;
            }
        }
        
        if (position === -1) {
            return content.substring(0, maxLength) + '...';
        }
        
        // Извлечь контекст вокруг совпадения
        const start = Math.max(0, position - 50);
        const end = Math.min(content.length, position + maxLength);
        let excerpt = content.substring(start, end);
        
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return this.highlightText(excerpt, query);
    }
}

// Глобальный экземпляр поискового движка
const searchEngine = new SearchEngine();

// Инициализация поиска на странице
document.addEventListener('DOMContentLoaded', async function() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchOverlay = document.getElementById('searchOverlay');
    
    if (!searchInput || !searchResults) return;
    
    // Загрузить индекс
    await searchEngine.loadIndex();
    
    // Обработка ввода
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchOverlay.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    // Поиск по Enter
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query.length >= 2) {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
    
    // Закрытие результатов при клике вне
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
                    <p class="search-hint">Попробуйте изменить запрос или используйте ключевые слова из документации</p>
                </div>
            `;
            searchOverlay.classList.remove('hidden');
            return;
        }
        
        const resultsHtml = results.slice(0, 10).map(result => {
            const excerpt = searchEngine.getExcerpt(result.content, query);
            const highlightedTitle = searchEngine.highlightText(result.title, query);
            
            return `
                <a href="../${result.url}" class="search-result-item">
                    <div class="search-result-header">
                        <span class="search-result-number">${result.number}</span>
                        <h3 class="search-result-title">${highlightedTitle}</h3>
                    </div>
                    <p class="search-result-excerpt">${excerpt}</p>
                    <div class="search-result-score">
                        Релевантность: ${Math.round(result.score * 100)}%
                    </div>
                </a>
            `;
        }).join('');
        
        searchResults.innerHTML = `
            <div class="search-results-header">
                Найдено результатов: <strong>${results.length}</strong>
            </div>
            ${resultsHtml}
        `;
        
        searchOverlay.classList.remove('hidden');
    }
});