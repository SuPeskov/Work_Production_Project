const fs = require('fs');
const path = require('path');
const lunr = require('lunr');
const cheerio = require('cheerio');
require('lunr-languages/lunr.ru')(lunr);

// Путь к папке с операциями
const operationsDir = './pages/operations';
const outputFile = './js/search-index.json';

// Сбор всех HTML-файлов операций
function getAllHtmlFiles(dir) {
    let files = [];
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

// Извлечение текста из HTML
function extractTextFromHtml(filePath) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    // Извлекаем заголовок операции
    const title = $('.operation-header h1').text().trim() || 
                  $('title').text().replace(' — Скаут Хаус', '').trim();
    
    // Извлекаем номер операции
    const operationNumber = $('.operation-number').text().trim() || 
                           path.basename(filePath, '.html');
    
    // Извлекаем контент из секций
    const sections = [];
    
    $('.operation-section').each((i, elem) => {
        const sectionTitle = $(elem).find('h2').text().trim();
        const sectionContent = $(elem).find('.section-content').text().trim();
        
        if (sectionContent) {
            sections.push({
                title: sectionTitle,
                content: sectionContent
            });
        }
    });
    
    // Объединяем весь текст
    const fullText = sections.map(s => `${s.title} ${s.content}`).join(' ');
    
    return {
        id: operationNumber,
        title: title,
        number: operationNumber,
        content: fullText,
        url: filePath.replace('./pages/', 'pages/')
    };
}

// Генерация поискового индекса
function buildSearchIndex() {
    console.log('🔍 Генерация поискового индекса...\n');
    
    const htmlFiles = getAllHtmlFiles(operationsDir);
    console.log(`Найдено ${htmlFiles.length} файлов операций\n`);
    
    const documents = [];
    
    for (const file of htmlFiles) {
        try {
            const doc = extractTextFromHtml(file);
            documents.push(doc);
            console.log(`✓ ${doc.number}: ${doc.title}`);
        } catch (error) {
            console.error(`✗ Ошибка при обработке ${file}:`, error.message);
        }
    }
    
    console.log(`\n📊 Обработано ${documents.length} документов\n`);
    
    // Создаём индекс Lunr
    const idx = lunr(function() {
        this.use(lunr.ru);
        
        this.ref('id');
        this.field('title', { boost: 10 });
        this.field('number', { boost: 5 });
        this.field('content');
        
        documents.forEach(function(doc) {
            this.add(doc);
        }, this);
    });
    
    // Сохраняем индекс и документы
    const searchData = {
        index: idx,
        documents: documents
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(searchData, null, 2));
    
    console.log(`✅ Поисковый индекс сохранён в ${outputFile}`);
    console.log(`📦 Размер файла: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);
}

buildSearchIndex();