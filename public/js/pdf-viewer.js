/**
 * pdf-viewer.js — Встроенный просмотрщик PDF с поддержкой Fullscreen и Pinch-to-Zoom
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

// Абсолютный путь к воркеру
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5; // Базовый масштаб для десктопа

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pageInfo = document.getElementById('pageInfo');
    const fullscreenBtn = document.getElementById('pdfFullscreen');
    
    // Элементы интерфейса, которые будем скрывать в полном экране
    const toolbar = document.querySelector('.pdf-toolbar');
    const controls = document.querySelector('.pdf-controls');
    const titleEl = document.getElementById('pdfTitle');

    // === ОТКРЫТИЕ PDF ===
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
                
                adjustScaleForMobile();
                renderPage(currentPage);
            } catch (err) {
                alert('Ошибка загрузки PDF: ' + err.message);
                closeModal();
            }
        });
    });

    // === ФУНКЦИЯ ПОЛНОЭКРАННОГО РЕЖИМА ===
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            modal.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    }

    if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;

    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ ПОЛНОЭКРАННОГО РЕЖИМА ===
    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        
        // Скрываем/показываем элементы интерфейса
        if (isFs) {
            toolbar.style.display = 'none';      // Скрываем заголовок и кнопку закрытия
            controls.style.display = 'none';     // Скрываем панель навигации
            modal.style.background = '#000';     // Черный фон в полном экране
            
            // Добавляем плавающие кнопки поверх изображения
            addFloatingControls();
        } else {
            toolbar.style.display = 'flex';
            controls.style.display = 'flex';
            modal.style.background = '';
            removeFloatingControls();
        }
        
        // Пересчитываем масштаб под новый размер экрана
        setTimeout(() => {
            adjustScaleForMobile();
            renderPage(currentPage);
        }, 300);
    });

    // === ПЛАВАЮЩИЕ КНОПКИ ДЛЯ ПОЛНОГО ЭКРАНА ===
    let floatingContainer = null;
    
    function addFloatingControls() {
        if (floatingContainer) return;
        
        floatingContainer = document.createElement('div');
        floatingContainer.id = 'pdf-floating-controls';
        floatingContainer.innerHTML = `
            <button id="fs-close" class="float-btn"></button>
            <button id="fs-prev" class="float-btn">←</button>
            <button id="fs-next" class="float-btn">→</button>
        `;
        modal.appendChild(floatingContainer);
        
        // Привязываем события
        document.getElementById('fs-close').onclick = closeModal;
        document.getElementById('fs-prev').onclick = () => { 
            if (currentPage > 1) { currentPage--; renderPage(currentPage); } 
        };
        document.getElementById('fs-next').onclick = () => { 
            if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } 
        };
    }

    function removeFloatingControls() {
        if (floatingContainer) {
            floatingContainer.remove();
            floatingContainer = null;
        }
    }

    // === АДАПТИВНЫЙ МАСШТАБ ===
    function adjustScaleForMobile() {
        if (!currentPdf) return;
        const container = document.querySelector('.pdf-container');
        if (!container) return;

        // В полном экране контейнер может быть другим, берем window.innerWidth
        const isFs = !!document.fullscreenElement;
        const availableWidth = isFs ? window.innerWidth - 40 : container.clientWidth - 40; 
        
        currentPdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const originalWidth = viewport.width;
            let newScale = availableWidth / originalWidth;
            newScale = Math.max(0.5, Math.min(newScale, 2.0));
            
            if (Math.abs(scale - newScale) > 0.1) {
                scale = newScale;
            }
        });
    }

    // Обработчик поворота экрана
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (currentPdf && !modal.classList.contains('hidden')) {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                adjustScaleForMobile();
                renderPage(currentPage);
            }, 150);
        }
    });

    // === ЗАКРЫТИЕ ===
    function closeModal() {
        if (document.fullscreenElement) document.exitFullscreen();
        modal.classList.add('hidden');
        if (currentPdf) {
            currentPdf.destroy();
            currentPdf = null;
        }
    }

    document.getElementById('pdfClose').onclick = closeModal;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // === НАВИГАЦИЯ И ЗУМ (ДЛЯ ДЕСКТОПА) ===
    document.getElementById('prevPage').onclick = () => { 
        if (currentPage > 1) { currentPage--; renderPage(currentPage); } 
    };
    document.getElementById('nextPage').onclick = () => { 
        if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } 
    };
    document.getElementById('zoomIn').onclick = () => { scale += 0.25; renderPage(currentPage); };
    document.getElementById('zoomOut').onclick = () => { if (scale > 0.5) { scale -= 0.25; renderPage(currentPage); } };

    // === РЕНДЕР СТРАНИЦЫ ===
    async function renderPage(num) {
        if (!currentPdf) return;
        const page = await currentPdf.getPage(num);
        const viewport = page.getViewport({ scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageInfo.textContent = `${num} из ${totalPages}`;
    }
});