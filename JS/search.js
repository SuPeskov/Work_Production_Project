/**
 * search.js — Поисковая система на базе Lunr.js
 * Работает в двух режимах:
 * 1. Dropdown — на обычных страницах (быстрый поиск)
 * 2. Full page — на странице search.html (полные результаты)
 */

class SearchEngine {
    constructor() {
        this.index = null;
        this.documents = [];
        this.isLoaded = false;
    }
    
    async loadIndex() {
        if (this.isLoaded) return true;
        
        try {
            const basePath = window.location.pathname.includes('/pages/') 
                ? '../js/search-index.json'
                : 'js/search-index.json';
            
            const response = await fetch(basePath);
            const data = await response.json();
            
            this.index = lunr.Index.load(data.index);
            this.documents = data.documents;
            this.isLoaded = true;
            
            console.log('✅ Поисковый индекс загружен, документов:', this.documents.length);
            return true;
        } catch (error) {
            console.error('❌ Ошибка загрузки поискового индекса:', error);
            return false;
        }
    }
    
    search(query) {
        if (!this.isLoaded || !query || query.trim().length === 0) {
            return [];
        }
        
        try {
            // Поиск с wildcard для частичного совпадения
            const results = this.index.search(query + '*');
            return this.mapResults(results);
        } catch (error) {
            // Если wildcard падает — пробуем обычный поиск
            try {
                const results = this.index.search(query);
                return this.mapResults(results);
            } catch (e) {
                console.error('Ошибка поиска:', e);
                return [];
            }
        }
    }
    
    mapResults(results) {
        return results.map(result => {
            const doc = this.documents.find(d => d.id === result.ref);
            if (!doc) return null;
            return { ...doc, score: result.score };
        }).filter(Boolean);
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
    'section':    { label: 'Раздел',     color: '#1a5632', icon: '📂' },
    'subsection': { label: 'Подраздел',  color: '#238347', icon: '📁' },
    'operation':  { label: 'Операция',   color: '#d4a843', icon: '📄' }
};

document.addEventListener('DOMContentLoaded', async function() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    // Загружаем индекс
    await searchEngine.loadIndex();
    
    // Определяем режим работы
    const isSearchPage = window.location.pathname.includes('search.html');
    
    if (isSearchPage) {
        initSearchPage();
    } else {
        initDropdownMode();
    }
    
    // === РЕЖИМ 1: Dropdown (на обычных страницах) ===
    function initDropdownMode() {
        const searchResults = document.getElementById('searchResults');
        const searchOverlay = document.getElementById('searchOverlay');
        if (!searchResults || !searchOverlay) return;
        
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
                const results = searchEngine.search(query);
                renderDropdownResults(results, query, searchResults, searchOverlay);
            }, 300);
        });
        
        // Enter → переход на страницу поиска
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query.length >= 2) {
                    const basePath = window.location.pathname.includes('/pages/') 
                        ? '' : 'pages/';
                    window.location.href = `${basePath}search.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchOverlay.classList.add('hidden');
            }
        });
    }
    
    // === РЕЖИМ 2: Полная страница результатов ===
    function initSearchPage() {
        const resultsContainer = document.getElementById('searchResultsContainer');
        const queryInfo = document.getElementById('searchQueryInfo');
        const clearBtn = document.getElementById('clearSearch');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const exampleChips = document.querySelectorAll('.example-chip');
        
        let currentFilter = 'all';
        let currentQuery = '';
        let currentResults = [];
        
        // Читаем запрос из URL
        const urlParams = new URLSearchParams(window.location.search);
        const initialQuery = urlParams.get('q') || '';
        
        if (initialQuery) {
            searchInput.value = initialQuery;
            performSearch(initialQuery);
        }
        
        // Ввод в поисковую строку
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            // Показ/скрытие кнопки очистки
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', query.length === 0);
            }
            
            if (query.length < 2) {
                showEmptyState();
                return;
            }
            
            searchTimeout = setTimeout(() => performSearch(query), 300);
        });
        
        // Enter → обновить URL
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query.length >= 2) {
                    const newUrl = `search.html?q=${encodeURIComponent(query)}`;
                    window.history.pushState({}, '', newUrl);
                    performSearch(query);
                }
            }
        });
        
        // Кнопка очистки
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                searchInput.value = '';
                clearBtn.classList.add('hidden');
                showEmptyState();
                searchInput.focus();
            });
        }
        
        // Фильтры
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderResults(currentResults, currentQuery);
            });
        });
        
        // Примеры запросов
        exampleChips.forEach(chip => {
            chip.addEventListener('click', function() {
                const query = this.dataset.query;
                searchInput.value = query;
                if (clearBtn) clearBtn.classList.remove('hidden');
                performSearch(query);
            });
        });
        
        function performSearch(query) {
            currentQuery = query;
            currentResults = searchEngine.search(query);
            
            // Обновляем URL
            const newUrl = `search.html?q=${encodeURIComponent(query)}`;
            window.history.replaceState({}, '', newUrl);
            
            // Обновляем заголовок
            queryInfo.innerHTML = `По запросу "<strong>${query}</strong>" найдено: <strong>${currentResults.length}</strong>`;
            document.title = `${query} — Поиск — Скаут Хаус`;
            
            // Обновляем счётчики
            updateCounts(currentResults);
            
            // Рендерим
            renderResults(currentResults, query);
        }
        
        function updateCounts(results) {
            const counts = { all: results.length, section: 0, subsection: 0, operation: 0 };
            results.forEach(r => { if (counts[r.type] !== undefined) counts[r.type]++; });
            
            document.getElementById('countAll').textContent = counts.all;
            document.getElementById('countSection').textContent = counts.section;
            document.getElementById('countSubsection').textContent = counts.subsection;
            document.getElementById('countOperation').textContent = counts.operation;
        }
        
        function renderResults(results, query) {
            if (!query || query.length < 2) {
                showEmptyState();
                return;
            }
            
            if (results.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="search-empty-state">
                        <div class="empty-icon">😕</div>
                        <h3>Ничего не найдено</h3>
                        <p>По запросу "<strong>${query}</strong>" результатов нет</p>
                        <p class="search-hint">Попробуйте:</p>
                        <ul class="search-hint-list">
                            <li>Использовать другие ключевые слова</li>
                            <li>Проверить номер операции (например, 2.1.1)</li>
                            <li>Уменьшить количество слов в запросе</li>
                        </ul>
                    </div>
                `;
                return;
            }
            
            // Фильтрация
            const filtered = currentFilter === 'all' 
                ? results 
                : results.filter(r => r.type === currentFilter);
            
            if (filtered.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="search-empty-state">
                        <div class="empty-icon">🔎</div>
                        <h3>В этой категории ничего нет</h3>
                        <p>Попробуйте выбрать другой фильтр или сбросить его</p>
                    </div>
                `;
                return;
            }
            
            // Группируем по типу
            const grouped = {
                section: filtered.filter(r => r.type === 'section'),
                subsection: filtered.filter(r => r.type === 'subsection'),
                operation: filtered.filter(r => r.type === 'operation')
            };
            
            let html = '';
            
            if (currentFilter === 'all' || currentFilter === 'section') {
                if (grouped.section.length > 0) {
                    html += `<div class="search-group-label">📂 Разделы (${grouped.section.length})</div>`;
                    html += `<div class="search-results-group">${grouped.section.map(r => renderResultCard(r, query)).join('')}</div>`;
                }
            }
            
            if (currentFilter === 'all' || currentFilter === 'subsection') {
                if (grouped.subsection.length > 0) {
                    html += `<div class="search-group-label">📁 Подразделы (${grouped.subsection.length})</div>`;
                    html += `<div class="search-results-group">${grouped.subsection.map(r => renderResultCard(r, query)).join('')}</div>`;
                }
            }
            
            if (currentFilter === 'all' || currentFilter === 'operation') {
                if (grouped.operation.length > 0) {
                    html += `<div class="search-group-label">📄 Операции (${grouped.operation.length})</div>`;
                    html += `<div class="search-results-group">${grouped.operation.map(r => renderResultCard(r, query)).join('')}</div>`;
                }
            }
            
            resultsContainer.innerHTML = html;
        }
        
        function renderResultCard(result, query) {
            const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
            const highlightedTitle = searchEngine.highlightText(result.title, query);
            const excerpt = result.type === 'operation' 
                ? searchEngine.getExcerpt(result.content, query, 250)
                : '';
            
            let url = '../' + result.url;
            if (result.anchor) url += '#' + result.anchor;
            
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
        
        function showEmptyState() {
            queryInfo.textContent = 'Введите запрос в строку поиска выше';
            document.title = 'Результаты поиска — Скаут Хаус';
            ['countAll', 'countSection', 'countSubsection', 'countOperation'].forEach(id => {
                document.getElementById(id).textContent = '0';
            });
            
            resultsContainer.innerHTML = `
                <div class="search-empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Начните поиск</h3>
                    <p>Введите ключевые слова, номер операции или название раздела</p>
                    <div class="search-examples">
                        <p class="examples-title">Примеры запросов:</p>
                        <div class="example-chips">
                            <span class="example-chip" data-query="Заготовка">Заготовка</span>
                            <span class="example-chip" data-query="Сборка панели пола">Сборка панели пола</span>
                            <span class="example-chip" data-query="2.1.1">2.1.1</span>
                            <span class="example-chip" data-query="ППУ">ППУ</span>
                            <span class="example-chip" data-query="канализация">канализация</span>
                            <span class="example-chip" data-query="электрика">электрика</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Переинициализируем обработчики для новых chips
            document.querySelectorAll('.example-chip').forEach(chip => {
                chip.addEventListener('click', function() {
                    const query = this.dataset.query;
                    searchInput.value = query;
                    if (clearBtn) clearBtn.classList.remove('hidden');
                    performSearch(query);
                });
            });
        }
    }
    
    // === Общий рендер для dropdown ===
    function renderDropdownResults(results, query, container, overlay) {
        if (results.length === 0) {
            container.innerHTML = `
                <div class="search-no-results">
                    <p>Ничего не найдено по запросу "<strong>${query}</strong>"</p>
                    <p class="search-hint">Нажмите Enter для полного поиска</p>
                </div>
            `;
            overlay.classList.remove('hidden');
            return;
        }
        
        const grouped = {
            section: results.filter(r => r.type === 'section'),
            subsection: results.filter(r => r.type === 'subsection'),
            operation: results.filter(r => r.type === 'operation')
        };
        
        let html = `<div class="search-results-header">Найдено: <strong>${results.length}</strong> · Нажмите Enter для полного поиска</div>`;
        
        if (grouped.section.length > 0) {
            html += `<div class="search-group-label">Разделы</div>`;
            html += grouped.section.slice(0, 3).map(r => renderDropdownItem(r, query)).join('');
        }
        if (grouped.subsection.length > 0) {
            html += `<div class="search-group-label">Подразделы</div>`;
            html += grouped.subsection.slice(0, 5).map(r => renderDropdownItem(r, query)).join('');
        }
        if (grouped.operation.length > 0) {
            html += `<div class="search-group-label">Операции</div>`;
            html += grouped.operation.slice(0, 7).map(r => renderDropdownItem(r, query)).join('');
        }
        
        container.innerHTML = html;
        overlay.classList.remove('hidden');
    }
    
    function renderDropdownItem(result, query) {
        const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
        const highlightedTitle = searchEngine.highlightText(result.title, query);
        
        let url = '../' + result.url;
        if (result.anchor) url += '#' + result.anchor;
        
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
});