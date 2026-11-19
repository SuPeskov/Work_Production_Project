/**
 * pdf-viewer.js — Просмотрщик PDF с Pinch-to-Zoom и Pan (перемещением)
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdfjs/build/pdf.worker.min.mjs';

let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;

// Переменные для панорамирования (перемещения)
let translateX = 0;
let translateY = 0;

// Переменные для жестов
let initialDistance = 0;
let initialScale = 0;
let isPinching = false;

// Переменные для перетаскивания
let startX = 0;
let startY = 0;
let startTranslateX = 0;
let startTranslateY = 0;
let isPanning = false;

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
                
                // Сброс состояния при открытии нового файла
                scale = 1.0;
                translateX = 0;
                translateY = 0;
                updateCanvasTransform();
                
                adjustScaleForMobile(true);
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
            adjustScaleForMobile(true);
            renderPage(currentPage);
        } else {
            toolbar.style.display = 'flex';
            controls.style.display = 'flex';
            removeFloatingControls();
            // При выходе из полного экрана сбрасываем позицию в центр
            translateX = 0; 
            translateY = 0;
            updateCanvasTransform();
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

    // === АДАПТИВНЫЙ МАСШТАБ ===
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
            
            if (forceFit || Math.abs(scale - newScale) > 0.1) {
                scale = newScale;
                // При подгонке под экран сбрасываем смещение
                translateX = 0;
                translateY = 0;
                updateCanvasTransform();
            }
        });
    }

    // === ОБРАБОТЧИКИ КАСАНИЙ (ZOOM + PAN) ===
    const container = document.querySelector('.pdf-container');
    if (container) {
        container.style.touchAction = 'none'; // Блокируем стандартные жесты браузера
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Начало зума
                isPinching = true;
                isPanning = false;
                initialDistance = getDistance(e.touches[0], e.touches[1]);
                initialScale = scale;
            } else if (e.touches.length === 1 && !isPinching) {
                // Начало перетаскивания (только если документ больше экрана)
                // Проверяем, есть ли куда двигать
                const canvasRect = canvas.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                if (canvasRect.width > containerRect.width || canvasRect.height > containerRect.height) {
                    isPanning = true;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    startTranslateX = translateX;
                    startTranslateY = translateY;
                }
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Всегда предотвращаем скролл страницы
            
            if (isPinching && e.touches.length === 2) {
                // Логика зума
                const currentDistance = getDistance(e.touches[0], e.touches[1]);
                const delta = currentDistance / initialDistance;
                let newScale = initialScale * delta;
                newScale = Math.max(0.5, Math.min(newScale, 4.0));
                
                if (Math.abs(scale - newScale) > 0.01) {
                    scale = newScale;
                    renderPage(currentPage);
                }
            } else if (isPanning && e.touches.length === 1) {
                // Логика перемещения
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                
                translateX = startTranslateX + dx;
                translateY = startTranslateY + dy;
                
                // Ограничиваем перемещение границами (опционально, можно убрать для свободного движения)
                // Но лучше оставить, чтобы не улететь в бесконечность
                constrainTranslation();
                updateCanvasTransform();
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            isPinching = false;
            isPanning = false;
        });
    }

    // Функция ограничения смещения (чтобы не утащить картинку за пределы видимости слишком далеко)
    function constrainTranslation() {
        if (!canvas.parentElement) return;
        const containerW = canvas.parentElement.clientWidth;
        const containerH = canvas.parentElement.clientHeight;
        const canvasW = canvas.width * scale; // Примерная ширина после трансформации
        const canvasH = canvas.height * scale;
        
        // Разрешаем двигать только если контент больше контейнера
        const maxTX = Math.max(0, (canvasW - containerW) / 2);
        const maxTY = Math.max(0, (canvasH - containerH) / 2);
        
        translateX = Math.max(-maxTX, Math.min(maxTX, translateX));
        translateY = Math.max(-maxTY, Math.min(maxTY, translateY));
    }

    // Применение трансформации к canvas
    function updateCanvasTransform() {
        canvas.style.transform = `translate(${translateX}px, ${translateY}px)`;
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

    // Кнопки навигации
    document.getElementById('prevPage').onclick = () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } };
    document.getElementById('nextPage').onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(currentPage); } };
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
        
        // После рендера обновляем трансформацию (на случай изменения масштаба)
        updateCanvasTransform();
    }
});