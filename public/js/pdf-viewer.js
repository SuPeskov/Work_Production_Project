/**
 * pdf-viewer.js — Встроенный просмотрщик PDF с поддержкой Fullscreen
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

// Абсолютный путь к воркеру
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pageInfo = document.getElementById('pageInfo');
    const fullscreenBtn = document.getElementById('pdfFullscreen');

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
            // Вход в полный экран
            if (modal.requestFullscreen) {
                modal.requestFullscreen().catch(err => {
                    console.error(`Ошибка входа в полный экран: ${err.message}`);
                });
            } else if (modal.webkitRequestFullscreen) { /* Safari */
                modal.webkitRequestFullscreen();
            } else if (modal.msRequestFullscreen) { /* IE11 */
                modal.msRequestFullscreen();
            }
        } else {
            // Выход из полного экрана
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    }

    // Привязываем кнопку (если она есть в HTML)
    if (fullscreenBtn) {
        fullscreenBtn.onclick = toggleFullscreen;
    }

    // Автоматически подгоняем масштаб при входе/выходе из полного экрана
    document.addEventListener('fullscreenchange', () => {
        if (currentPdf && !modal.classList.contains('hidden')) {
            setTimeout(() => {
                adjustScaleForMobile();
                renderPage(currentPage);
            }, 300);
        }
    });

    // === АДАПТИВНЫЙ МАСШТАБ ===
    function adjustScaleForMobile() {
        if (!currentPdf) return;
        const container = document.querySelector('.pdf-container');
        if (!container) return;

        const availableWidth = container.clientWidth - 40; 
        
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
        // Если мы в полном экране, выходим из него перед закрытием
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
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

    // === НАВИГАЦИЯ (ТОЛЬКО СТРЕЛКИ) ===
    document.getElementById('prevPage').onclick = () => { 
        if (currentPage > 1) { currentPage--; renderPage(currentPage); } 
    };
    
    document.getElementById('nextPage').onclick = () => { 
        if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } 
    };
    
    document.getElementById('zoomIn').onclick = () => { scale += 0.25; renderPage(currentPage); };
    document.getElementById('zoomOut').onclick = () => { if (scale > 0.5) { scale -= 0.25; renderPage(currentPage); } };

    // === РЕНДЕР ===
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