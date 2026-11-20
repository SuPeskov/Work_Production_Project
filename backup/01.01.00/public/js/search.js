/**
 * search.js — Поиск по базе знаний.
 *
 * 1. На всех страницах с #searchResults работает компактный выпадающий список.
 * 2. На странице результатов (#searchResultsContainer) строится дерево:
 *      раздел (страница) → операция → фразы из трёх слов.
 *    В каждой фразе слово, совпавшее с запросом, стоит в середине и выделено фоном.
 */

(function (root) {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    const isNodeModule = typeof module !== 'undefined' && module.exports;

    // Lunr берём из браузера либо подключаем в Node (для проверок и тестов).
    let lunrLib = null;
    if (typeof lunr !== 'undefined') {
        lunrLib = lunr;
    } else if (typeof require === 'function') {
        try {
            lunrLib = require('lunr');
            if (lunrLib && !lunrLib.ru) {
                require('lunr-languages/lunr.stemmer.support')(lunrLib);
                require('lunr-languages/lunr.ru')(lunrLib);
            }
        } catch (e) {
            lunrLib = null;
        }
    }

    const TYPE_LABELS = {
        section: { label: 'Раздел', color: '#1a5632' },
        subsection: { label: 'Подраздел', color: '#238347' },
        operation: { label: 'Операция', color: '#d4a843' }
    };

    const STOP_WORDS = new Set([
        'а', 'без', 'более', 'бы', 'был', 'была', 'были', 'было', 'быть', 'в', 'вам',
        'вас', 'весь', 'во', 'вот', 'все', 'всего', 'вы', 'где', 'да', 'даже', 'для',
        'до', 'его', 'ее', 'если', 'есть', 'еще', 'же', 'за', 'здесь', 'и', 'из',
        'или', 'им', 'их', 'к', 'как', 'ко', 'когда', 'кто', 'ли', 'либо', 'мне',
        'может', 'мы', 'на', 'над', 'надо', 'наш', 'не', 'него', 'нее', 'нет', 'ни',
        'них', 'но', 'ну', 'о', 'об', 'однако', 'он', 'она', 'они', 'оно', 'от',
        'по', 'под', 'при', 'с', 'со', 'так', 'также', 'такой', 'там', 'те', 'тем',
        'то', 'того', 'тоже', 'той', 'только', 'том', 'ты', 'у', 'уже', 'хотя',
        'чего', 'чей', 'чем', 'через', 'что', 'чтобы', 'чье', 'эта', 'эти', 'это',
        'этот', 'я'
    ]);

    const DEFAULT_VISIBLE_PHRASES = 8;
    const MAX_PHRASES_PER_DOCUMENT = 250;

    // Слово может содержать дефис, точку и слэш: 2.1.4, ПВХ-воронки, 6х80.
    const WORD_RE = /[\p{L}\p{N}]+(?:[.\-_/][\p{L}\p{N}]+)*/gu;

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function tokenize(text) {
        const tokens = [];
        const source = String(text == null ? '' : text);
        WORD_RE.lastIndex = 0;
        let match;
        while ((match = WORD_RE.exec(source)) !== null) {
            tokens.push({
                word: match[0],
                lower: match[0].toLowerCase(),
                start: match.index,
                end: match.index + match[0].length
            });
        }
        return tokens;
    }

    function stem(word) {
        const lower = String(word == null ? '' : word).toLowerCase();
        if (lunrLib && lunrLib.ru && typeof lunrLib.ru.stemmer === 'function') {
            try {
                return lunrLib.ru.stemmer(lower);
            } catch (e) {
                // Ниже — запасной вариант для браузеров без русского стеммера.
            }
        }
        return lower
            .replace(/(иями|ями|ами|ией|ей|ий|ый|ой|ая|ое|ые|ыми|ими|ов|ев|ах|ях|ам|ям|ом|ем|у|ю|ы|и|а|я|е|о|ь)$/u, '')
            .replace(/(.)\1$/u, '$1');
    }

    function getQueryTerms(query) {
        const raw = tokenize(query).map(function (token) { return token.word; });
        let words = raw.filter(function (word) {
            return word.length >= 2 && !STOP_WORDS.has(word.toLowerCase());
        });

        if (words.length === 0) {
            words = raw.filter(function (word) { return word.length >= 1; });
        }

        const seen = new Set();
        return words
            .map(function (word) {
                return { word: word, lower: word.toLowerCase(), stem: stem(word) };
            })
            .filter(function (term) {
                const key = term.lower;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    function tokenMatches(word, terms) {
        if (!word || !terms || terms.length === 0) return false;
        const lower = String(word).toLowerCase();

        for (let i = 0; i < terms.length; i++) {
            const term = terms[i];
            if (term.lower === lower) return true;

            const wordStem = stem(word);
            if (wordStem === term.stem) return true;

            // Частичное слово: «монт» находит «монтаж», «электрик» — «электрика».
            if (term.stem.length >= 3 && wordStem.length >= 3) {
                if (wordStem.indexOf(term.stem) === 0 || term.stem.indexOf(wordStem) === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function highlightText(text, query) {
        const source = String(text == null ? '' : text);
        const terms = getQueryTerms(query);
        if (terms.length === 0) return escapeHtml(source);

        let html = '';
        let lastIndex = 0;
        WORD_RE.lastIndex = 0;
        let match;

        while ((match = WORD_RE.exec(source)) !== null) {
            html += escapeHtml(source.slice(lastIndex, match.index));
            html += tokenMatches(match[0], terms)
                ? '<mark class="search-mark">' + escapeHtml(match[0]) + '</mark>'
                : escapeHtml(match[0]);
            lastIndex = match.index + match[0].length;
        }
        html += escapeHtml(source.slice(lastIndex));
        return html;
    }

    function normalizePhrase(text) {
        return String(text == null ? '' : text)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    function plural(n, one, few, many) {
        const abs = Math.abs(Number(n) || 0);
        const n10 = abs % 10;
        const n100 = abs % 100;
        if (n10 === 1 && n100 !== 11) return one;
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
        return many;
    }

    function formatMatches(n) {
        return n + ' ' + plural(n, 'совпадение', 'совпадения', 'совпадений');
    }

    function formatOperations(n) {
        return n + ' ' + plural(n, 'операция', 'операции', 'операций');
    }

    function splitIntoSegments(text) {
        const segments = [];
        const sentenceEnd = /[.!?…]+(?=\s|$)/g;

        String(text == null ? '' : text).split(/\n+/).forEach(function (line) {
            let start = 0;
            let match;
            sentenceEnd.lastIndex = 0;

            while ((match = sentenceEnd.exec(line)) !== null) {
                const end = match.index + match[0].length;
                const part = line.slice(start, end).trim();
                if (part) segments.push(part);
                start = end;
            }

            const tail = line.slice(start).trim();
            if (tail) segments.push(tail);
        });

        return segments;
    }

    function compareOperationIds(a, b) {
        const pa = String(a == null ? '' : a).split('.').map(function (part) { return parseInt(part, 10) || 0; });
        const pb = String(b == null ? '' : b).split('.').map(function (part) { return parseInt(part, 10) || 0; });
        const length = Math.max(pa.length, pb.length);
        for (let i = 0; i < length; i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
        }
        return String(a).localeCompare(String(b), 'ru');
    }

    /**
     * Возвращает фразы из трёх слов, в середине которых стоит совпадение.
     * Если совпадение оказалось в самом начале/конце текста, фраза всё равно
     * составляется из трёх слов, чтобы место было видно.
     */
    function extractPhrasesFromDocument(doc, query) {
        const terms = getQueryTerms(query);
        const text = doc && doc.content ? String(doc.content) : (doc && doc.title ? String(doc.title) : '');
        const result = { phrases: [], count: 0 };

        if (!terms.length || !text) return result;

        // Делим текст на строки и предложения: фраза не должна перескакивать
        // из заголовка в следующий абзац.
        const segments = splitIntoSegments(text);

        const seen = new Set();
        let collectPhrases = true;

        segments.forEach(function (segment) {
            const tokens = tokenize(segment);

            for (let i = 0; i < tokens.length; i++) {
                if (!tokenMatches(tokens[i].word, terms)) continue;

                result.count++;
                if (!collectPhrases) continue;

                let phraseTokens;
                if (i > 0 && i < tokens.length - 1) {
                    phraseTokens = [tokens[i - 1], tokens[i], tokens[i + 1]];
                } else if (tokens.length >= 3) {
                    phraseTokens = i === 0
                        ? [tokens[0], tokens[1], tokens[2]]
                        : [tokens[i - 2], tokens[i - 1], tokens[i]];
                } else {
                    phraseTokens = tokens.slice();
                }

                const phraseText = phraseTokens.map(function (token) { return token.word; }).join(' ');
                const key = normalizePhrase(phraseText);
                if (!key || seen.has(key)) continue;
                seen.add(key);

                result.phrases.push({
                    text: phraseText,
                    html: highlightText(phraseText, query),
                    matchIndex: result.count - 1,
                    isMiddle: phraseTokens.length === 3 && phraseTokens[1] === tokens[i]
                });

                if (result.phrases.length >= MAX_PHRASES_PER_DOCUMENT) {
                    // Совпадения продолжаем считать, но DOM не раздуваем.
                    collectPhrases = false;
                }
            }
        });

        return result;
    }

    function buildUrl(result, query, matchIndex) {
        if (!result || !result.url) return '#';

        let targetPath = String(result.url).replace(/^\.?\//, '');
        const currentPath = (isBrowser && window.location.pathname) || '';
        let finalUrl;

        if (currentPath.indexOf('/pages/operations/') !== -1) {
            finalUrl = '../../' + targetPath;
        } else if (currentPath.indexOf('/pages/') !== -1) {
            finalUrl = targetPath.replace(/^pages\//, '');
        } else {
            finalUrl = targetPath;
        }

        let hash = '';
        const hashIndex = finalUrl.indexOf('#');
        if (hashIndex !== -1) {
            hash = finalUrl.slice(hashIndex);
            finalUrl = finalUrl.slice(0, hashIndex);
        }

        if (result.anchor) {
            hash = '#' + result.anchor;
        }

        if (query && String(query).trim()) {
            finalUrl += (finalUrl.indexOf('?') === -1 ? '?' : '&') + 'highlight=' + encodeURIComponent(String(query).trim());
            if (typeof matchIndex === 'number' && isFinite(matchIndex) && matchIndex >= 0) {
                finalUrl += '&match=' + Math.floor(matchIndex);
            }
        }

        return finalUrl + hash;
    }

    class SearchEngine {
        constructor() {
            this.index = null;
            this.documents = [];
            this.isLoaded = false;
            this.loadingPromise = null;
            this.phraseCache = new Map();
        }

        async loadIndex() {
            if (this.isLoaded) return true;
            if (this.loadingPromise) return this.loadingPromise;

            this.loadingPromise = (async () => {
                try {
                    const path = window.location.pathname;
                    let basePath;

                    if (path.indexOf('/operations/') !== -1) {
                        basePath = '../../js/search-index.json';
                    } else if (path.indexOf('/pages/') !== -1) {
                        basePath = '../js/search-index.json';
                    } else {
                        basePath = 'js/search-index.json';
                    }

                    const response = await fetch(basePath);
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }

                    const data = await response.json();
                    this.setIndexData(data);
                    return true;
                } catch (error) {
                    console.error('Ошибка загрузки поискового индекса:', error);
                    return false;
                } finally {
                    this.loadingPromise = null;
                }
            })();

            return this.loadingPromise;
        }

        setIndexData(data) {
            if (!data || !data.index || !Array.isArray(data.documents)) {
                throw new Error('Некорректный формат поискового индекса');
            }
            if (!lunrLib) throw new Error('Lunr не загружен');

            this.index = lunrLib.Index.load(data.index);
            this.documents = data.documents;
            this.isLoaded = true;
            this.phraseCache.clear();
        }

        findDocument(id) {
            return this.documents.find(function (doc) { return doc.id === id; }) || null;
        }

        search(query) {
            const text = String(query == null ? '' : query).trim();
            if (!this.isLoaded || !text || !this.index) return [];

            const terms = getQueryTerms(text);
            const merged = new Map();

            const addResults = (searchQuery) => {
                if (!searchQuery) return;
                try {
                    this.index.search(searchQuery).forEach(function (result) {
                        if (!merged.has(result.ref)) merged.set(result.ref, result);
                    });
                } catch (e) {
                    // Некорректный пользовательский запрос — пробуем следующий вариант.
                }
            };

            if (terms.length > 1) {
                // Несколько слов: сначала требуем все слова сразу (AND).
                addResults(terms.map(function (term) { return '+' + term.stem; }).join(' '));

                // Если точных словоформ нет — разрешаем префиксы основ.
                if (merged.size === 0) {
                    addResults(terms.map(function (term) { return '+' + term.stem + '*'; }).join(' '));
                }

                // Совсем нет результатов — обычный поиск Lunr (OR).
                if (merged.size === 0) {
                    addResults(sanitizeLunrQuery(text));
                }
            } else {
                // Одно слово: точная словоформа + префикс основы.
                addResults(sanitizeLunrQuery(text));
                if (terms.length) {
                    addResults(terms[0].stem + '*');
                }
                addResults(sanitizeLunrQuery(text) + '*');
            }

            let results = Array.from(merged.values()).map((result) => {
                const doc = this.documents.find(function (item) { return item.id === result.ref; });
                if (!doc) return null;
                return Object.assign({}, doc, { score: result.score });
            }).filter(Boolean);

            // 4. Если Lunr не справился (опечатка, часть слова), ищем по тексту.
            if (results.length === 0 && terms.length) {
                results = this.linearSearch(terms);
            }

            return results;
        }

        linearSearch(terms) {
            const matchesDocument = function (doc, requireAll) {
                const text = String(doc.title || '') + '\n' + String(doc.content || '');
                const tokens = tokenize(text);
                const check = function (termsToCheck) {
                    return tokens.some(function (token) { return tokenMatches(token.word, termsToCheck); });
                };

                if (requireAll && terms.length > 1) {
                    return terms.every(function (term) { return check([term]); });
                }
                return check(terms);
            };

            let found = this.documents.filter(function (doc) { return matchesDocument(doc, true); });
            if (found.length === 0) {
                found = this.documents.filter(function (doc) { return matchesDocument(doc, false); });
            }

            return found.map(function (doc) {
                return Object.assign({}, doc, { score: 0 });
            });
        }

        getPhrases(doc, query) {
            if (!doc) return { phrases: [], count: 0 };
            const key = String(doc.id || doc.title || '') + '|' + String(query || '').trim().toLowerCase();
            if (this.phraseCache.has(key)) return this.phraseCache.get(key);

            const info = extractPhrasesFromDocument(doc, query);
            this.phraseCache.set(key, info);
            return info;
        }

        findSectionForOperation(operation) {
            if (!operation) return null;

            if (operation.section) {
                const byId = this.documents.find(function (doc) {
                    return doc.type === 'section' && doc.id === operation.section;
                });
                if (byId) return byId;
            }

            if (typeof KB_OPERATIONS !== 'undefined') {
                const op = KB_OPERATIONS.find(function (item) { return item.id === operation.id; });
                if (op) {
                    const section = this.documents.find(function (doc) {
                        return doc.type === 'section' && doc.id === op.section;
                    });
                    if (section) return section;
                }
            }

            return null;
        }

        buildGroups(results, query) {
            const groups = new Map();
            const self = this;

            const ensureGroup = (section) => {
                const id = section ? section.id : '__other__';
                if (!groups.has(id)) {
                    groups.set(id, {
                        id: id,
                        section: section || {
                            id: '__other__',
                            type: 'section',
                            num: '',
                            title: 'Другие операции',
                            content: '',
                            url: ''
                        },
                        operations: [],
                        isDirect: false,
                        directPhrases: [],
                        directCount: 0,
                        operationCount: 0,
                        matchCount: 0
                    });
                }
                return groups.get(id);
            };

            // Сначала заводим все известные разделы — так сохраняется порядок базы.
            this.documents
                .filter(function (doc) { return doc.type === 'section'; })
                .forEach(function (section) { ensureGroup(section); });

            results.forEach(function (result) {
                if (result.type === 'section') {
                    const group = ensureGroup(result);
                    group.isDirect = true;
                    const direct = self.getPhrases(result, query);
                    group.directPhrases = direct.phrases;
                    group.directCount = direct.count;
                } else if (result.type === 'operation') {
                    const section = self.findSectionForOperation(result);
                    const group = ensureGroup(section);
                    group.operations.push(result);
                }
            });

            const list = Array.from(groups.values()).filter(function (group) {
                return group.isDirect || group.operations.length > 0;
            });

            list.forEach(function (group) {
                group.operations.sort(function (a, b) { return compareOperationIds(a.id, b.id); });
                group.operationCount = group.operations.length;
                group.matchCount = group.directCount;
                group.operations.forEach(function (operation) {
                    group.matchCount += self.getPhrases(operation, query).count;
                });
            });

            return list;
        }
    }

    function sanitizeLunrQuery(query) {
        return String(query == null ? '' : query)
            .replace(/[+\-~^:(){}[\]\\"*?]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const searchEngine = new SearchEngine();

    // ============================================================
    // Компактный выпадающий список
    // ============================================================

    function initDropdown(input, dropdown) {
        let timeout = null;

        searchEngine.loadIndex().then(function (loaded) {
            if (!loaded) {
                input.placeholder = 'Поиск недоступен (индекс не загружен)';
                return;
            }

            input.addEventListener('input', function () {
                clearTimeout(timeout);
                const query = input.value.trim();

                if (query.length < 2) {
                    dropdown.innerHTML = '';
                    dropdown.classList.add('hidden');
                    return;
                }

                timeout = setTimeout(function () {
                    const results = searchEngine.search(query);
                    renderDropdownResults(results, query, dropdown);
                }, 250);
            });

            input.addEventListener('keypress', function (event) {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const query = input.value.trim();
                if (query.length >= 2) {
                    const baseUrl = window.location.pathname.indexOf('/pages/') !== -1
                        ? 'search.html'
                        : 'pages/search.html';
                    window.location.href = baseUrl + '?q=' + encodeURIComponent(query);
                }
            });

            document.addEventListener('click', function (event) {
                if (!input.contains(event.target) && !dropdown.contains(event.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        });
    }

    function renderDropdownResults(results, query, dropdown) {
        if (!results.length) {
            dropdown.innerHTML =
                '<div class="search-no-results">' +
                    '<p>Ничего не найдено по запросу «<strong>' + escapeHtml(query) + '</strong>»</p>' +
                    '<p class="search-hint">Проверьте написание или нажмите Enter для полного поиска</p>' +
                '</div>';
            dropdown.classList.remove('hidden');
            return;
        }

        const grouped = {
            section: results.filter(function (result) { return result.type === 'section'; }),
            subsection: results.filter(function (result) { return result.type === 'subsection'; }),
            operation: results.filter(function (result) { return result.type === 'operation'; })
        };

        const renderItem = function (result) {
            const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.operation;
            const phrases = searchEngine.getPhrases(result, query);
            const firstPhrase = phrases.phrases[0];
            const url = buildUrl(result, query, firstPhrase ? firstPhrase.matchIndex : undefined);

            return (
                '<a href="' + escapeHtml(url) + '" class="search-result-item">' +
                    '<div class="search-result-header">' +
                        '<span class="search-result-type" style="background: ' + typeInfo.color + '">' + typeInfo.label + '</span>' +
                        (result.number ? '<span class="search-result-number">' + escapeHtml(result.number) + '</span>' : '') +
                        '<h3 class="search-result-title">' + highlightText(result.title, query) + '</h3>' +
                    '</div>' +
                    (firstPhrase
                        ? '<div class="search-result-excerpt">' + firstPhrase.html + '</div>'
                        : '') +
                '</a>'
            );
        };

        let html = '<div class="search-results-header">Найдено: <strong>' + results.length + '</strong> · Enter → все места совпадений</div>';

        if (grouped.section.length > 0) {
            html += '<div class="search-group-label">Разделы</div>';
            html += grouped.section.slice(0, 3).map(renderItem).join('');
        }
        if (grouped.subsection.length > 0) {
            html += '<div class="search-group-label">Подразделы</div>';
            html += grouped.subsection.slice(0, 5).map(renderItem).join('');
        }
        if (grouped.operation.length > 0) {
            html += '<div class="search-group-label">Операции</div>';
            html += grouped.operation.slice(0, 7).map(renderItem).join('');
        }

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }

    // ============================================================
    // Страница результатов: раздел → операция → фразы
    // ============================================================

    function initResultsPage(input, container) {
        const queryInfo = document.getElementById('searchQueryInfo');
        const clearButton = document.getElementById('clearSearch');
        const initialHtml = container.innerHTML;
        const filterBar = document.querySelector('.search-filters');
        let timeout = null;

        const counts = {
            all: document.getElementById('countAll'),
            section: document.getElementById('countSection'),
            subsection: document.getElementById('countSubsection'),
            operation: document.getElementById('countOperation')
        };

        const setQueryParam = function (query) {
            if (!isBrowser || !window.history || !window.history.replaceState) return;
            const url = new URL(window.location.href);
            if (query) {
                url.searchParams.set('q', query);
            } else {
                url.searchParams.delete('q');
            }
            window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        };

        const updateClearButton = function () {
            if (!clearButton) return;
            clearButton.classList.toggle('hidden', input.value.trim().length === 0);
        };

        const setFilter = function (filter) {
            container.classList.remove('filter-all', 'filter-section', 'filter-operation');
            container.classList.add('filter-' + filter);

            if (filterBar) {
                filterBar.querySelectorAll('.filter-btn').forEach(function (button) {
                    const active = button.getAttribute('data-filter') === filter;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
            }

            if (filter === 'section') {
                container.querySelectorAll('.search-acc-section.has-direct').forEach(function (section) {
                    section.classList.add('open');
                    const header = section.querySelector('.search-acc-header');
                    if (header) header.setAttribute('aria-expanded', 'true');
                });
            }
        };

        const restoreInitialState = function () {
            container.className = 'search-results-container';
            container.innerHTML = initialHtml;
            if (queryInfo) {
                queryInfo.textContent = 'Введите запрос в строку поиска выше';
            }
            Object.keys(counts).forEach(function (key) {
                if (counts[key]) counts[key].textContent = '0';
            });
            setFilter('all');
        };

        const render = function (query) {
            if (!query || query.trim().length < 2) {
                restoreInitialState();
                return;
            }

            if (!searchEngine.isLoaded) {
                container.innerHTML = '<div class="search-empty-state"><div class="empty-icon">⏳</div><h3>Загружаем поисковый индекс…</h3></div>';
                return;
            }

            const results = searchEngine.search(query);
            const groups = searchEngine.buildGroups(results, query);
            const totalOperations = groups.reduce(function (sum, group) { return sum + group.operationCount; }, 0);
            const directSections = groups.filter(function (group) { return group.isDirect; }).length;
            const totalMatches = groups.reduce(function (sum, group) { return sum + group.matchCount; }, 0);

            if (counts.all) counts.all.textContent = String(totalOperations + directSections);
            if (counts.section) counts.section.textContent = String(directSections);
            if (counts.subsection) counts.subsection.textContent = '0';
            if (counts.operation) counts.operation.textContent = String(totalOperations);

            if (queryInfo) {
                queryInfo.innerHTML = totalOperations + ' ' +
                    plural(totalOperations, 'операция', 'операции', 'операций') +
                    ' в ' + groups.length + ' ' +
                    plural(groups.length, 'разделе', 'разделах', 'разделах') +
                    ' · ' + totalMatches + ' ' +
                    plural(totalMatches, 'совпадение', 'совпадения', 'совпадений') +
                    ' по запросу <strong>«' + escapeHtml(query) + '»</strong>';
            }

            if (!groups.length) {
                container.className = 'search-results-container';
                container.innerHTML =
                    '<div class="search-empty-state">' +
                        '<div class="empty-icon">🔍</div>' +
                        '<h3>Ничего не найдено</h3>' +
                        '<p>По запросу «<strong>' + escapeHtml(query) + '</strong>» совпадений нет.</p>' +
                        '<p class="search-hint">Попробуйте другое слово, номер операции или часть названия.</p>' +
                    '</div>';
                setFilter('all');
                return;
            }

            container.className = 'search-results-container filter-all';
            let html =
                '<div class="search-results-summary">' +
                    'Найдено <strong>' + totalMatches + '</strong> ' +
                    plural(totalMatches, 'совпадение', 'совпадения', 'совпадений') +
                    ' в <strong>' + totalOperations + '</strong> ' +
                    plural(totalOperations, 'операции', 'операциях', 'операциях') +
                    '. Нажмите на раздел или операцию, чтобы раскрыть места совпадений.' +
                '</div>' +
                '<div class="search-filter-empty hidden">В названиях разделов совпадений нет — переключитесь на «Все» или «Операции».</div>';

            groups.forEach(function (group, groupIndex) {
                html += renderSectionGroup(group, query, groupIndex === 0);
            });

            container.innerHTML = html;
            setFilter('all');
        };

        const runSearch = function (immediate) {
            clearTimeout(timeout);
            const query = input.value.trim();

            if (immediate) {
                setQueryParam(query);
                render(query);
                return;
            }

            timeout = setTimeout(function () {
                setQueryParam(query);
                render(query);
            }, 250);
        };

        input.addEventListener('input', function () {
            updateClearButton();
            runSearch(false);
        });

        input.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                runSearch(true);
            }
        });

        if (clearButton) {
            clearButton.addEventListener('click', function () {
                input.value = '';
                updateClearButton();
                setQueryParam('');
                restoreInitialState();
                input.focus();
            });
        }

        if (filterBar) {
            filterBar.addEventListener('click', function (event) {
                const button = event.target.closest('.filter-btn');
                if (!button) return;
                const filter = button.getAttribute('data-filter');
                if (!filter) return;
                setFilter(filter);

                const empty = container.querySelector('.search-filter-empty');
                if (empty) {
                    const hasDirect = container.querySelector('.search-acc-section.has-direct');
                    empty.classList.toggle('hidden', filter !== 'section' || !!hasDirect);
                }
            });
        }

        // Раскрытие/закрытие аккордеонов и кнопки «Показать ещё».
        container.addEventListener('click', function (event) {
            const moreButton = event.target.closest('.search-phrase-more');
            if (moreButton) {
                const list = moreButton.closest('.search-acc-body');
                if (!list) return;
                const hiddenPhrases = list.querySelectorAll('.search-phrase.is-hidden');
                const expand = hiddenPhrases.length > 0;
                hiddenPhrases.forEach(function (phrase) { phrase.classList.remove('is-hidden'); });
                if (!expand) {
                    const extra = list.querySelectorAll('.search-phrase[data-extra="true"]');
                    extra.forEach(function (phrase) { phrase.classList.add('is-hidden'); });
                }
                moreButton.textContent = expand ? 'Свернуть' : moreButton.getAttribute('data-label');
                return;
            }

            const header = event.target.closest('.search-acc-header');
            if (!header) return;

            const accordion = header.closest('.search-acc');
            if (!accordion) return;

            const isSection = accordion.classList.contains('search-acc-section');
            const willOpen = !accordion.classList.contains('open');

            if (isSection && willOpen) {
                container.querySelectorAll('.search-acc-section.open').forEach(function (other) {
                    if (other === accordion) return;
                    other.classList.remove('open');
                    const otherHeader = other.querySelector('.search-acc-header');
                    if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
                });
            }

            accordion.classList.toggle('open', willOpen);
            header.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        // Клик по примеру запроса.
        container.addEventListener('click', function (event) {
            const chip = event.target.closest('.example-chip');
            if (!chip) return;
            const query = chip.getAttribute('data-query') || chip.textContent.trim();
            if (!query) return;
            input.value = query;
            updateClearButton();
            setQueryParam(query);
            render(query);
        });

        // Кнопка «Назад/Вперёд» в браузере.
        window.addEventListener('popstate', function () {
            const query = new URLSearchParams(window.location.search).get('q') || '';
            input.value = query;
            updateClearButton();
            render(query);
        });

        searchEngine.loadIndex().then(function (loaded) {
            if (!loaded) {
                container.innerHTML =
                    '<div class="search-empty-state">' +
                        '<div class="empty-icon">⚠️</div>' +
                        '<h3>Поиск недоступен</h3>' +
                        '<p>Не удалось загрузить поисковый индекс.</p>' +
                    '</div>';
                return;
            }

            const initialQuery = input.value.trim() || new URLSearchParams(window.location.search).get('q') || '';
            if (initialQuery) {
                input.value = initialQuery;
                updateClearButton();
                render(initialQuery);
            } else {
                updateClearButton();
            }
        });
    }

    function renderSectionGroup(group, query, openByDefault) {
        const section = group.section || {};
        const sectionTitle = section.title || 'Раздел';
        const sectionNumberValue = section.num || section.number || '';
        const sectionNumber = sectionNumberValue
            ? '<span class="search-acc-number">' + highlightText(sectionNumberValue, query) + '</span>'
            : '';
        const sectionUrl = section.url ? buildUrl(section, query) : '#';
        const openClass = openByDefault ? ' open' : '';
        const hasDirectClass = group.isDirect ? ' has-direct' : '';
        const metaParts = [];
        if (group.operationCount > 0) metaParts.push(formatOperations(group.operationCount));
        if (group.matchCount > 0) metaParts.push(formatMatches(group.matchCount));
        const sectionMeta = metaParts.length > 0 ? metaParts.join(' · ') : 'Нет совпадений';

        let html =
            '<section class="search-acc search-acc-section' + openClass + hasDirectClass + '" data-section-id="' + escapeHtml(group.id) + '">' +
                '<button type="button" class="search-acc-header search-acc-header-section" aria-expanded="' + (openByDefault ? 'true' : 'false') + '">' +
                    '<span class="search-acc-chevron" aria-hidden="true">›</span>' +
                    sectionNumber +
                    '<span class="search-acc-heading">' +
                        '<span class="search-acc-kicker">Страница раздела</span>' +
                        '<span class="search-acc-title">' + highlightText(sectionTitle, query) + '</span>' +
                    '</span>' +
                    '<span class="search-acc-meta">' + sectionMeta + '</span>' +
                '</button>' +
                '<div class="search-acc-body">';

        if (group.isDirect) {
            html += renderDirectSectionMatch(group, query, sectionUrl);
        }

        if (group.operations.length > 0) {
            html +=
                '<div class="search-acc-subheading search-acc-subheading-operations">Операции с совпадениями</div>' +
                '<div class="search-accordion-list search-accordion-list-nested">';

            group.operations.forEach(function (operation, index) {
                html += renderOperationAccordion(operation, query, openByDefault && index === 0);
            });

            html += '</div>';
        } else {
            html += '<div class="search-acc-empty">В этом разделе совпадений в операциях нет.</div>';
        }

        html += '</div></section>';
        return html;
    }

    function renderDirectSectionMatch(group, query, sectionUrl) {
        const phrases = group.directPhrases || [];
        let html = '<div class="search-direct-block">' +
            '<div class="search-acc-subheading">Совпадение на странице раздела</div>';

        if (phrases.length > 0) {
            html += '<div class="search-phrase-list">';
            phrases.slice(0, DEFAULT_VISIBLE_PHRASES).forEach(function (phrase) {
                html += renderPhraseLink(phrase, sectionUrl);
            });
            html += '</div>';
            if (phrases.length > DEFAULT_VISIBLE_PHRASES) {
                html += '<div class="search-acc-empty">Показаны первые ' + DEFAULT_VISIBLE_PHRASES + ' совпадений.</div>';
            }
        } else {
            html += '<a class="search-phrase" href="' + escapeHtml(sectionUrl) + '">' +
                '<span class="search-phrase-text">' + highlightText(group.section && group.section.title ? group.section.title : 'Открыть раздел', query) + '</span>' +
                '<span class="search-phrase-arrow" aria-hidden="true">→</span>' +
            '</a>';
        }

        return html + '</div>';
    }

    function renderOperationAccordion(operation, query, openByDefault) {
        const info = searchEngine.getPhrases(operation, query);
        const phrases = info.phrases || [];
        const openClass = openByDefault ? ' open' : '';
        const matchesLabel = info.count > 0 ? formatMatches(info.count) : 'Совпадение в операции';

        let html =
            '<section class="search-acc search-acc-operation' + openClass + '" data-op-id="' + escapeHtml(operation.id) + '">' +
                '<button type="button" class="search-acc-header search-acc-header-operation" aria-expanded="' + (openByDefault ? 'true' : 'false') + '">' +
                    '<span class="search-acc-chevron" aria-hidden="true">›</span>' +
                    '<span class="search-acc-number">' + highlightText(operation.number || operation.id || '', query) + '</span>' +
                    '<span class="search-acc-heading">' +
                        '<span class="search-acc-kicker">Операция</span>' +
                        '<span class="search-acc-title">' + highlightText(operation.title, query) + '</span>' +
                    '</span>' +
                    '<span class="search-acc-meta">' + matchesLabel + '</span>' +
                '</button>' +
                '<div class="search-acc-body">';

        if (phrases.length > 0) {
            const operationUrl = buildUrl(operation, query);
            html += '<div class="search-phrase-list">';
            phrases.forEach(function (phrase, index) {
                const hidden = index >= DEFAULT_VISIBLE_PHRASES;
                html += renderPhraseLink(phrase, operationUrl, hidden);
            });
            html += '</div>';

            if (phrases.length > DEFAULT_VISIBLE_PHRASES) {
                html += '<button type="button" class="search-phrase-more" data-label="Показать ещё ' +
                    (phrases.length - DEFAULT_VISIBLE_PHRASES) + '">' +
                    'Показать ещё ' + (phrases.length - DEFAULT_VISIBLE_PHRASES) +
                '</button>';
            }
        } else {
            html += '<div class="search-acc-empty">Совпадение найдено в названии операции. ' +
                'Откройте страницу операции, чтобы увидеть её полностью.</div>';
            html += '<a class="search-phrase" href="' + escapeHtml(buildUrl(operation, query)) + '">' +
                '<span class="search-phrase-text">' + highlightText(operation.title, query) + '</span>' +
                '<span class="search-phrase-arrow" aria-hidden="true">→</span>' +
            '</a>';
        }

        return html + '</div></section>';
    }

    function renderPhraseLink(phrase, baseUrl, hidden) {
        // baseUrl уже содержит ?highlight=...; добавляем только номер совпадения.
        const href = baseUrl === '#' ? '#' : addMatchToUrl(baseUrl, phrase.matchIndex);

        return '<a class="search-phrase' + (hidden ? ' is-hidden' : '') + '" data-extra="' + (hidden ? 'true' : 'false') + '" href="' + escapeHtml(href) + '">' +
            '<span class="search-phrase-text">' + phrase.html + '</span>' +
            '<span class="search-phrase-arrow" aria-hidden="true">→</span>' +
        '</a>';
    }

    function addMatchToUrl(url, matchIndex) {
        if (typeof matchIndex !== 'number' || !isFinite(matchIndex)) return url;
        const hashIndex = url.indexOf('#');
        let base = hashIndex === -1 ? url : url.slice(0, hashIndex);
        const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
        base += (base.indexOf('?') === -1 ? '?' : '&') + 'match=' + Math.floor(matchIndex);
        return base + hash;
    }

    // ============================================================
    // Запуск
    // ============================================================

    function init() {
        const input = document.getElementById('searchInput');
        if (!input) return;

        const dropdown = document.getElementById('searchResults');
        const resultsContainer = document.getElementById('searchResultsContainer');

        if (dropdown) {
            initDropdown(input, dropdown);
        }
        if (resultsContainer) {
            initResultsPage(input, resultsContainer);
        }
    }

    if (isBrowser) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    const api = {
        SearchEngine: SearchEngine,
        searchEngine: searchEngine,
        tokenize: tokenize,
        stem: stem,
        getQueryTerms: getQueryTerms,
        highlightText: highlightText,
        extractPhrasesFromDocument: extractPhrasesFromDocument,
        buildUrl: buildUrl,
        compareOperationIds: compareOperationIds
    };

    if (isBrowser) {
        window.SearchEngine = SearchEngine;
        window.searchEngine = searchEngine;
    }
    if (isNodeModule) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
