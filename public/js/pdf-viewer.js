/**
 * pdf-viewer.js — Встроенный просмотрщик PDF для базы знаний Скаут Хаус
 * ИСПРАВЛЕНО: Адаптивность для мобильных устройств
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

// Указываем путь к воркеру (ОБЯЗАТЕЛЬНО)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5; // Базовый масштаб

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pageInfo = document.getElementById('pageInfo');

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
                
                // Сбрасываем масштаб при открытии нового документа
                // На мобильных сразу подстраиваем под ширину экрана
                adjustScaleForMobile();
                renderPage(currentPage);
            } catch (err) {
                alert('Ошибка загрузки PDF: ' + err.message);
                closeModal();
            }
        });
    });

    // Функция адаптивного масштаба
    function adjustScaleForMobile() {
        const containerWidth = document.querySelector('.pdf-container').clientWidth;
        // Отступы контейнера (padding)
        const padding = 40; 
        const availableWidth = containerWidth - padding;
        
        // Получаем ширину первой страницы без масштаба (scale=1)
        currentPdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const originalWidth = viewport.width;
            
            // Рассчитываем масштаб так, чтобы страница занимала доступную ширину
            // Ограничиваем минимальный масштаб 0.5 и максимальный 2.0 для удобства
            let newScale = availableWidth / originalWidth;
            newScale = Math.max(0.5, Math.min(newScale, 2.0));
            
            scale = newScale;
        });
    }

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
    
    // Зум с пересчетом
    document.getElementById('zoomIn').onclick = () => { 
        scale += 0.25; renderPage(currentPage); 
    };
    document.getElementById('zoomOut').onclick = () => { 
        if (scale > 0.5) { scale -= 0.25; renderPage(currentPage); } 
    };

    // Рендер страницы
    async function renderPage(num) {
        if (!currentPdf) return;
        
        const page = await currentPdf.getPage(num);
        
        // ВАЖНО: Пересчитываем viewport с текущим масштабом
        const viewport = page.getViewport({ scale });
        
        // Устанавливаем размеры канваса точно под viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Рисуем страницу
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        // Обновляем счетчик страниц
        pageInfo.textContent = `Страница ${num} из ${totalPages}`;
    }
    
    // Обработка поворота экрана или ресайза окна
    window.addEventListener('resize', () => {
        if (currentPdf && !modal.classList.contains('hidden')) {
            // Небольшая задержка, чтобы браузер успел пересчитать ширину
            setTimeout(() => {
                adjustScaleForMobile();
                renderPage(currentPage);
            }, 100);
        }
    });
});