const fs = require('fs');
const path = require('path');
const lunr = require('lunr');
const cheerio = require('cheerio');

require('lunr-languages/lunr.stemmer.support')(lunr);
require('lunr-languages/lunr.ru')(lunr);

const pagesDir = './pages';
const operationsDir = './pages/operations';
const outputFile = './js/search-index.json';

// === НОВАЯ СТРУКТУРА: 6 РАЗДЕЛОВ ===
const sectionPages = [
    { file: 'preparation.html',  title: 'Заготовка',        icon: '' },
    { file: 'panels.html',       title: 'Сборка панелей',   icon: '🧱' },
    { file: 'module.html',       title: 'Сборка модуля',    icon: '🏠' },
    { file: 'options.html',      title: 'Сборка опций',     icon: '🏗️' },
    { file: 'installation.html', title: 'Монтаж',           icon: '🚜' },
    { file: 'service.html',      title: 'Сервис',           icon: '🛡️' }
];

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

function extractOperation(filePath) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    const title = $('.operation-header h1').text().trim() || $('title').text().replace(' — Скаут Хаус', '').trim();
    const operationNumber = $('.operation-number').text().trim() || path.basename(filePath, '.html');
    
    const sections = [];
    $('.operation-section').each((i, elem) => {
        const sectionTitle = $(elem).find('h2').text().trim();
        const sectionContent = $(elem).find('.section-content').text().trim();
        if (sectionContent) sections.push(`${sectionTitle} ${sectionContent}`);
    });
    
    return {
        id: `op_${operationNumber}`,
        type: 'operation',
        title: title,
        number: operationNumber,
        content: sections.join(' '),
        url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/')
    };
}

function extractSectionsFromFile(filePath, sectionTitle, icon) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    const documents = [];
    
    // 1. Сам раздел
    documents.push({
        id: `section_${path.basename(filePath, '.html')}`,
        type: 'section',
        title: sectionTitle,
        number: '',
        icon: icon,
        content: $('.section-header p').text().trim() + ' ' + sectionTitle,
        url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/'),
        anchor: 'section-1' 
    });
    
    // 2. Подразделы (аккордеон)
    const subsections = $('.accordion-section');
    console.log(`    🔍 Найдено элементов .accordion-section в HTML: ${subsections.length}`);
    
    subsections.each((i, elem) => {
        const subsectionNumber = $(elem).find('.section-number').text().trim();
        const subsectionTitle = $(elem).find('.section-info h2').text().trim();
        
        const operationsText = [];
        $(elem).find('.operations-list a').each((j, link) => {
            operationsText.push($(link).text().trim());
        });
        
        if (subsectionNumber && subsectionTitle) {
            console.log(`      ↳ Индексирую подраздел: ${subsectionNumber} - ${subsectionTitle}`);
            documents.push({
                id: `sub_${subsectionNumber}`,
                type: 'subsection',
                title: subsectionTitle,
                number: subsectionNumber,
                content: `${sectionTitle} ${subsectionTitle} ${operationsText.join(' ')}`,
                url: filePath.replace('./pages/', 'pages/').replace(/\\/g, '/'),
                anchor: `section-${subsectionNumber}`
            });
        }
    });
    
    return documents;
}

function buildSearchIndex() {
    console.log('🔍 Начинаю генерацию поискового индекса...\n');
    const documents = [];
    
    console.log('📂 1. Индексация разделов и подразделов:');
    for (const section of sectionPages) {
        const filePath = path.join(pagesDir, section.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`  ⚠️ Файл ${section.file} еще не создан, пропускаем`);
            continue;
        }
        console.log(`  📄 Читаю: ${section.file}`);
        const sectionDocs = extractSectionsFromFile(filePath, section.title, section.icon);
        documents.push(...sectionDocs);
        console.log(`  ✅ Добавлено документов из раздела: ${sectionDocs.length}\n`);
    }
    
    console.log('📄 2. Индексация операций:');
    const operationFiles = getAllHtmlFiles(operationsDir);
    console.log(`  Найдено файлов операций: ${operationFiles.length}`);
    
    for (const file of operationFiles) {
        try {
            const doc = extractOperation(file);
            documents.push(doc);
            console.log(`  ✓ ${doc.number}: ${doc.title}`);
        } catch (error) {
            console.error(`   Ошибка в ${file}:`, error.message);
        }
    }
    
    console.log(`\n📊 ИТОГО документов в индексе: ${documents.length}\n`);
    
    const idx = lunr(function() {
        this.use(lunr.ru);
        this.ref('id');
        this.field('type', { boost: 2 });
        this.field('number', { boost: 10 });
        this.field('title', { boost: 15 });
        this.field('content');
        
        documents.forEach(function(doc) {
            this.add(doc);
        }, this);
    });
    
    if (!fs.existsSync('./js')) fs.mkdirSync('./js');
    fs.writeFileSync(outputFile, JSON.stringify({ index: idx, documents: documents }, null, 2));
    
    console.log(`✅ Индекс успешно сохранён в ${outputFile}`);
    console.log(`📦 Размер: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);
}

buildSearchIndex();