/**
 * pdf-viewer.js — Встроенный просмотрщик PDF с ПРОГРАММНЫМ pinch-to-zoom
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5; // Текущий масштаб

// Переменные для отслеживания жеста pinch
let initialDistance = 0;
let initialScale = 0;
let isPinching = false;

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const pageInfo = document.getElementById('pageInfo');
    const fullscreenBtn = document.getElementById('pdfFullscreen');
    
    const toolbar = document.querySelector('.pdf-toolbar');
    const controls = document.querySelector('.pdf-controls');

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
                
                // Сбрасываем масштаб при открытии нового файла
                scale = 1.0; 
                adjustScaleForMobile();
                renderPage(currentPage);
            } catch (err) {
                alert('Ошибка загрузки PDF: ' + err.message);
                closeModal();
            }
        });
    });

    // === ПОЛНОЭКРАННЫЙ РЕЖИМ ===
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            modal.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    }
    if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;

    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        if (isFs) {
            toolbar.style.display = 'none';
            controls.style.display = 'none';
            addFloatingControls();
            // В полном экране сразу подгоняем под ширину
            adjustScaleForMobile(true);
            renderPage(currentPage);
        } else {
            toolbar.style.display = 'flex';
            controls.style.display = 'flex';
            removeFloatingControls();
            adjustScaleForMobile(false);
            renderPage(currentPage);
        }
    });

    // Плавающие кнопки
    let floatingContainer = null;
    function addFloatingControls() {
        if (floatingContainer) return;
        floatingContainer = document.createElement('div');
        floatingContainer.id = 'pdf-floating-controls';
        floatingContainer.innerHTML = `
            <button id="fs-close" class="float-btn">✕</button>
            <button id="fs-prev" class="float-btn">←</button>
            <button id="fs-next" class="float-btn">→</button>
        `;
        modal.appendChild(floatingContainer);
        
        document.getElementById('fs-close').onclick = closeModal;
        document.getElementById('fs-prev').onclick = () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } };
        document.getElementById('fs-next').onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } };
    }
    function removeFloatingControls() {
        if (floatingContainer) { floatingContainer.remove(); floatingContainer = null; }
    }

    // === АДАПТИВНЫЙ МАСШТАБ (ТОЛЬКО ДЛЯ НАЧАЛЬНОЙ ОТРИСОВКИ) ===
    function adjustScaleForMobile(forceFit = false) {
        if (!currentPdf) return;
        const container = document.querySelector('.pdf-container');
        if (!container) return;

        const isFs = !!document.fullscreenElement;
        const availableWidth = isFs ? window.innerWidth - 40 : container.clientWidth - 40; 
        
        currentPdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const originalWidth = viewport.width;
            let newScale = availableWidth / originalWidth;
            
            // Если forceFit (вход в FS или открытие), всегда подгоняем
            // Иначе обновляем только если разница существенна и мы не в процессе зума
            if (forceFit || Math.abs(scale - newScale) > 0.1) {
                scale = newScale;
            }
        });
    }

    // === ПРОГРАММНЫЙ PINCH-TO-ZOOM ===
    // Отключаем стандартное поведение браузера для контейнера
    const container = document.querySelector('.pdf-container');
    if (container) {
        container.style.touchAction = 'none'; // Блокируем скролл/зум браузера, берем управление на себя
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                isPinching = true;
                initialDistance = getDistance(e.touches[0], e.touches[1]);
                initialScale = scale;
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault(); // Предотвращаем зум всей страницы
                const currentDistance = getDistance(e.touches[0], e.touches[1]);
                const delta = currentDistance / initialDistance;
                
                // Ограничиваем зум от 0.5x до 4.0x
                let newScale = initialScale * delta;
                newScale = Math.max(0.5, Math.min(newScale, 4.0));
                
                scale = newScale;
                renderPage(currentPage);
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            isPinching = false;
        });
    }

    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Обработчик поворота экрана
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (currentPdf && !modal.classList.contains('hidden')) {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                adjustScaleForMobile(!!document.fullscreenElement);
                renderPage(currentPage);
            }, 150);
        }
    });

    // === ЗАКРЫТИЕ ===
    function closeModal() {
        if (document.fullscreenElement) document.exitFullscreen();
        modal.classList.add('hidden');
        if (currentPdf) { currentPdf.destroy(); currentPdf = null; }
    }
    document.getElementById('pdfClose').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Кнопки зума для десктопа
    document.getElementById('prevPage').onclick = () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } };
    document.getElementById('nextPage').onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } };
    document.getElementById('zoomIn').onclick = () => { scale += 0.25; renderPage(currentPage); };
    document.getElementById('zoomOut').onclick = () => { if (scale > 0.5) { scale -= 0.25; renderPage(currentPage); } };

    // === РЕНДЕР СТРАНИЦЫ ===
    async function renderPage(num) {
        if (!currentPdf) return;
        const page = await currentPdf.getPage(num);
        const viewport = page.getViewport({ scale });
        
        // Устанавливаем реальные пиксельные размеры canvas
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageInfo.textContent = `${num} из ${totalPages}`;
    }
});