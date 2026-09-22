const fs = require('fs');
const path = require('path');
const lunr = require('lunr');
const cheerio = require('cheerio');

// === Подключение русского языка для Lunr ===
require('lunr-languages/lunr.stemmer.support')(lunr);
require('lunr-languages/lunr.ru')(lunr);

// Папки для сканирования
const pagesDir = './pages';
const operationsDir = './pages/operations';
const outputFile = './js/search-index.json';

// Список страниц разделов (добавляйте сюда новые разделы по мере создания)
const sectionPages = [
    { file: 'production.html', title: 'Производство', icon: '🏭' },
    // Будущие разделы — раскомментируйте, когда создадите страницы:
    // { file: 'assembly.html',    title: 'Сборка модулей',     icon: '🔩' },
    // { file: 'installation.html',title: 'Монтаж на объекте',  icon: '🏗️' },
    // { file: 'engineering.html', title: 'Инженерные системы', icon: '📐' },
    // { file: 'finishing.html',   title: 'Отделочные работы',  icon: '🎨' },
    // { file: 'maintenance.html', title: 'Обслуживание',       icon: '🛡️' },
];

// === Сбор всех HTML-файлов из папки ===
function getAllHtmlFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(getAllHtmlFiles(fullPath));
        } else if (item.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

// === Извлечение операции из HTML-файла ===
function extractOperation(filePath) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    const title = $('.operation-header h1').text().trim() || 
                  $('title').text().replace(' — Скаут Хаус', '').trim();
    
    const operationNumber = $('.operation-number').text().trim() || 
                           path.basename(filePath, '.html');
    
    const sections = [];
    $('.operation-section').each((i, elem) => {
        const sectionTitle = $(elem).find('h2').text().trim();
        const sectionContent = $(elem).find('.section-content').text().trim();
        if (sectionContent) {
            sections.push(`${sectionTitle} ${sectionContent}`);
        }
    });
    
return {
    id: `op_${operationNumber}`,
    type: 'operation',
    title: title,
    number: operationNumber,
    content: sections.join(' '),
    url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/')  // ← нормализуем слэши
};
}

// === Извлечение разделов и подразделов из страницы раздела ===
function extractSectionsFromFile(filePath, sectionTitle, icon) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    const documents = [];
    
    // Добавляем сам раздел (страницу) как документ
documents.push({
    id: `section_${path.basename(filePath, '.html')}`,
    type: 'section',
    title: sectionTitle,
    number: '',
    icon: icon,
    content: $('.section-header p').text().trim() + ' ' + sectionTitle,
    url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/')  // ← нормализуем
});
    
    // Извлекаем подразделы из аккордеона
    $('.subsection-item').each((i, elem) => {
        const subsectionNumber = $(elem).find('.subsection-number').text().trim();
        const subsectionTitle = $(elem).find('.subsection-title').text().trim();
        
        // Собираем названия операций внутри подраздела (для поиска)
        const operationsText = [];
        $(elem).find('.operations-list a').each((j, link) => {
            operationsText.push($(link).text().trim());
        });
        
        if (subsectionTitle) {
    // Определяем номер раздела из HTML-атрибута data-section
    const sectionNumber = $('.accordion-section').first().attr('data-section') || '1';

    // Добавляем сам раздел (страницу) как документ с якорем
    documents.push({
        id: `section_${path.basename(filePath, '.html')}`,
        type: 'section',
        title: sectionTitle,
        number: `Раздел ${sectionNumber}`,
        icon: icon,
        content: $('.section-header p').text().trim() + ' ' + sectionTitle,
        url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/'),
        anchor: `section-${sectionNumber}` // <-- ДОБАВЛЕН ЯКОРЬ
    });
        }
    });
    
    return documents;
}

// === Главная функция сборки индекса ===
function buildSearchIndex() {
    console.log('🔍 Генерация поискового индекса...\n');
    
    const documents = [];
    
    // 1. Индексация страниц разделов и их подразделов
    console.log('📂 Индексация разделов и подразделов:');
    for (const section of sectionPages) {
        const filePath = path.join(pagesDir, section.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`  ⚠️  Файл ${section.file} не найден, пропускаем`);
            continue;
        }
        
        const sectionDocs = extractSectionsFromFile(filePath, section.title, section.icon);
        documents.push(...sectionDocs);
        console.log(`  ✓ ${section.title}: ${sectionDocs.length - 1} подразделов`);
    }
    
    // 2. Индексация операций
    console.log('\n📄 Индексация операций:');
    const operationFiles = getAllHtmlFiles(operationsDir);
    console.log(`  Найдено файлов: ${operationFiles.length}`);
    
    for (const file of operationFiles) {
        try {
            const doc = extractOperation(file);
            documents.push(doc);
            console.log(`  ✓ ${doc.number}: ${doc.title}`);
        } catch (error) {
            console.error(`  ✗ Ошибка: ${file} — ${error.message}`);
        }
    }
    
    console.log(`\n📊 Всего документов в индексе: ${documents.length}\n`);
    
    // 3. Создание индекса Lunr
    const idx = lunr(function() {
        this.use(lunr.ru);
        
        this.ref('id');
        this.field('type', { boost: 2 });        // тип документа
        this.field('number', { boost: 10 });     // номер операции/подраздела
        this.field('title', { boost: 15 });      // заголовок — самый важный
        this.field('content');                   // содержимое
        
        documents.forEach(function(doc) {
            this.add(doc);
        }, this);
    });
    
    // 4. Сохранение
    const searchData = {
        index: idx,
        documents: documents
    };
    
    if (!fs.existsSync('./js')) {
        fs.mkdirSync('./js');
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(searchData, null, 2));
    
    const sizeKB = (fs.statSync(outputFile).size / 1024).toFixed(2);
    console.log(`✅ Индекс сохранён в ${outputFile}`);
    console.log(`📦 Размер: ${sizeKB} KB\n`);
}

buildSearchIndex();