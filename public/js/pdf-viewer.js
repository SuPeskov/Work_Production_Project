/**
 * pdf-viewer.js — Встроенный просмотрщик PDF для базы знаний Скаут Хаус
 */
import * as pdfjsLib from '/pdfjs/build/pdf.min.mjs';

// Указываем путь к воркеру (ОБЯЗАТЕЛЬНО для работы библиотеки)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;

    // Обработчик клика по ссылкам PDF
    document.querySelectorAll('.pdf-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            const title = link.getAttribute('data-title') || link.textContent.trim() || 'Документ';
            
            document.getElementById('pdfTitle').textContent = title;
            modal.classList.remove('hidden');
            
            try {
                const loadingTask = pdfjsLib.getDocument(url);
                currentPdf = await loadingTask.promise;
                totalPages = currentPdf.numPages;
                currentPage = 1;
                scale = 1.5;
                renderPage(currentPage);
            } catch (err) {
                alert('Ошибка загрузки PDF: ' + err.message);
                closeModal();
            }
        });
    });

    // Закрытие модального окна
    function closeModal() {
        modal.classList.add('hidden');
        if (currentPdf) {
            currentPdf.destroy();
            currentPdf = null;
        }
    }

    document.getElementById('pdfClose').onclick = closeModal;
    
    // Закрытие по клику вне контента
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Навигация
    document.getElementById('prevPage').onclick = () => { 
        if (currentPage > 1) renderPage(--currentPage); 
    };
    document.getElementById('nextPage').onclick = () => { 
        if (currentPage < totalPages) renderPage(++currentPage); 
    };
    document.getElementById('zoomIn').onclick = () => { 
        scale += 0.25; renderPage(currentPage); 
    };
    document.getElementById('zoomOut').onclick = () => { 
        if (scale > 0.5) { scale -= 0.25; renderPage(currentPage); } 
    };

    // Рендер страницы
    async function renderPage(num) {
        const page = await currentPdf.getPage(num);
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        document.getElementById('pageInfo').textContent = `Страница ${num} из ${totalPages}`;
    }
});