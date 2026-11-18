/**
 * highlight.js — подсветка слов запроса на странице документа.
 * Поддерживает переход к конкретному совпадению: ?highlight=слово&match=3
 */
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightQuery = (urlParams.get('highlight') || '').trim();
    const matchParam = urlParams.get('match');

    if (!highlightQuery) return;

    if (!document.getElementById('search-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'search-highlight-styles';
        style.textContent = `
            mark.search-highlight {
                background-color: #fde68a !important;
                color: #1a1a2e !important;
                padding: 2px 4px;
                border-radius: 3px;
                font-weight: 600;
                box-shadow: 0 0 0 2px rgba(250, 188, 27, 0.4);
            }
            @keyframes highlight-pulse-yellow {
                0% { background-color: #fde68a; box-shadow: 0 0 0 4px rgba(250, 188, 27, 0.6); }
                50% { background-color: #fef3c7; box-shadow: 0 0 0 2px rgba(250, 188, 27, 0.4); }
                100% { background-color: #fde68a; box-shadow: 0 0 0 4px rgba(250, 188, 27, 0.6); }
            }
            mark.search-highlight.target-match {
                animation: highlight-pulse-yellow 1.5s ease-in-out 3;
            }
        `;
        document.head.appendChild(style);
    }

    const WORD_RE = /[\p{L}\p{N}]+(?:[.\-_/][\p{L}\p{N}]+)*/gu;

    function stem(word) {
        return String(word || '')
            .toLowerCase()
            .replace(/(иями|ями|ами|ией|ей|ий|ый|ой|ая|ое|ые|ыми|ими|ов|ев|ах|ях|ам|ям|ом|ем|у|ю|ы|и|а|я|е|о|ь)$/u, '')
            .replace(/(.)\1$/u, '$1');
    }

    const terms = highlightQuery
        .split(/\s+/)
        .map(word => word.replace(/[.,!?;:()«»"'`]/g, ''))
        .filter(word => word.length >= 2)
        .map(word => ({ lower: word.toLowerCase(), stem: stem(word) }));

    if (terms.length === 0) return;

    function matches(word) {
        const lower = String(word).toLowerCase();
        for (const term of terms) {
            if (term.lower === lower) return true;
            const wordStem = stem(word);
            if (wordStem === term.stem) return true;
            if (term.stem.length >= 3 && wordStem.length >= 3) {
                if (wordStem.indexOf(term.stem) === 0 || term.stem.indexOf(wordStem) === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function highlightTextNode(node) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return false;

        WORD_RE.lastIndex = 0;
        const pieces = [];
        let lastIndex = 0;
        let match;
        let changed = false;

        while ((match = WORD_RE.exec(text)) !== null) {
            if (!matches(match[0])) continue;

            if (match.index > lastIndex) {
                pieces.push(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.textContent = match[0];
            pieces.push(mark);

            lastIndex = match.index + match[0].length;
            changed = true;
        }

        if (!changed) return false;

        if (lastIndex < text.length) {
            pieces.push(document.createTextNode(text.slice(lastIndex)));
        }

        const fragment = document.createDocumentFragment();
        pieces.forEach(piece => fragment.appendChild(piece));
        node.parentNode.replaceChild(fragment, node);
        return true;
    }

    function walk(node) {
        if (node.nodeType === 3) {
            highlightTextNode(node);
            return;
        }
        if (node.nodeType !== 1) return;
        if (/^(script|style|textarea|input|mark|noscript|template)$/i.test(node.tagName)) return;

        Array.from(node.childNodes).forEach(walk);
    }

    const contentContainer =
        document.querySelector('.operation-main') ||
        document.querySelector('.section-main') ||
        document.querySelector('main') ||
        document.body;

    if (!contentContainer) return;

    walk(contentContainer);

    const marks = Array.from(contentContainer.querySelectorAll('mark.search-highlight'));
    if (marks.length === 0) return;

    let targetIndex = 0;
    if (matchParam !== null && matchParam !== '') {
        const parsed = parseInt(matchParam, 10);
        if (isFinite(parsed) && parsed >= 0) {
            targetIndex = Math.min(parsed, marks.length - 1);
        }
    }

    const target = marks[targetIndex] || marks[0];
    target.classList.add('target-match');

    // Если совпадение находится в свёрнутом аккордеоне раздела — раскрываем его.
    const accordion = target.closest('.accordion-section');
    if (accordion && !accordion.classList.contains('active')) {
        const header = accordion.querySelector('.accordion-header');
        if (header) header.click();
    }

    setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
});
