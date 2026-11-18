/**
 * scripts/build-search-index.js
 * Генерирует поисковый индекс Lunr.js из реестра операций kb.js и HTML-файлов.
 * Запуск: node scripts/build-search-index.js
 */

const fs = require('fs');
const path = require('path');
const lunr = require('lunr');

// Настройки путей
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const KB_JS_PATH = path.join(PUBLIC_DIR, 'js', 'kb.js');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'js', 'search-index.json');

// Функция парсинга массива из JS-файла (копия логики из app.js)
function extractLiteral(src, name) {
    const start = src.indexOf(`const ${name} = [`);
    if (start === -1) return [];
    const from = src.indexOf('[', start);
    let depth = 0, end = -1;
    for (let i = from; i < src.length; i++) {
        const c = src[i];
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return [];
    try { return Function(`"use strict"; return (${src.slice(from, end + 1)});`)(); }
    catch (e) { console.error(`Ошибка парсинга ${name}:`, e.message); return []; }
}

// Очистка HTML от тегов для индексации контента
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

console.log(' Генерация поискового индекса...');

try {
    // 1. Читаем реестр операций
    const kbSrc = fs.readFileSync(KB_JS_PATH, 'utf8');
    const operations = extractLiteral(kbSrc, 'KB_OPERATIONS');
    const sections = extractLiteral(kbSrc, 'KB_SECTIONS');

    if (!operations.length) throw new Error('Реестр операций пуст!');

    // 2. Формируем документы для Lunr
    const documents = [];

    // Добавляем разделы
    sections.forEach(sec => {
        documents.push({
            id: sec.id,
            type: 'section',
            number: sec.num || '',
            title: sec.title,
            content: `${sec.title} ${sec.desc}`,
            url: sec.page,
            anchor: ''
        });
    });

    // Добавляем операции с реальным контентом из HTML
    operations.forEach(op => {
        // Пропускаем черновики, если нужно
        if (op.status === 'draft') return;

        let content = '';
        try {
            const htmlPath = path.join(PUBLIC_DIR, op.url);
            if (fs.existsSync(htmlPath)) {
                const html = fs.readFileSync(htmlPath, 'utf8');
                content = stripHtml(html);
            } else {
                console.warn(`⚠️  HTML файл не найден: ${op.url}`);
            }
        } catch (e) {
            console.warn(`️  Ошибка чтения ${op.url}:`, e.message);
        }

        documents.push({
            id: op.id,
            type: 'operation',
            number: op.id,
            title: op.title,
            content: `${op.title} ${content}`,
            url: op.url,
            anchor: ''
        });
    });

    // 3. Строим индекс Lunr
    const idx = lunr(function () {
        this.ref('id');
        this.field('title', { boost: 10 }); // Название важнее контента
        this.field('number', { boost: 5 }); // Номер операции тоже важен
        this.field('type');
        this.field('content');

        // Подключаем русский стеммер (если установлен lunr-languages)
        try {
            require('lunr-languages/lunr.stemmer.support')(lunr);
            require('lunr-languages/lunr.ru')(lunr);
            this.use(lunr.ru);
            console.log('✅ Русский стеммер подключен');
        } catch (e) {
            console.warn('⚠️  lunr-languages не установлен, используется базовый поиск');
        }

        documents.forEach(doc => this.add(doc));
    });

    // 4. Сохраняем результат
    const outputData = {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        index: idx.toJSON(),
        documents: documents
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData), 'utf8');
    
    console.log(`✅ Индекс успешно создан!`);
    console.log(`   📄 Документов: ${documents.length}`);
    console.log(`   💾 Размер файла: ${(Buffer.byteLength(JSON.stringify(outputData)) / 1024).toFixed(1)} KB`);
    console.log(`   📁 Путь: ${OUTPUT_PATH}`);

} catch (error) {
    console.error('❌ Ошибка генерации индекса:', error);
    process.exit(1);
}