/**
 * pdf-viewer.js — Встроенный просмотрщик PDF для базы знаний Скаут Хаус
 * ИСПРАВЛЕНО: 
 * 1. Добавлен обработчик resize для мобильных устройств
 * 2. Адаптирован интерфейс (стрелки в кружках, сокращенный текст)
 * 3. Исправлен путь к воркеру (абсолютный)
 */
import * as pdfjsLib from './pdfjs/build/pdf.min.mjs';

// ⚠️ ВАЖНО: Абсолютный путь от корня сайта
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

    // === ОБРАБОТЧИК КЛИКА ПО ССЫЛКАМ PDF ===
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
                
                // Сразу адаптируем масштаб под текущий экран
                adjustScaleForMobile();
                renderPage(currentPage);
            } catch (err) {
                alert('Ошибка загрузки PDF: ' + err.message);
                closeModal();
            }
        });
    });

    // === ФУНКЦИЯ АДАПТИВНОГО МАСШТАБА ===
    function adjustScaleForMobile() {
        if (!currentPdf) return;
        
        const container = document.querySelector('.pdf-container');
        if (!container) return;

        // Учитываем padding контейнера (обычно 40px)
        const availableWidth = container.clientWidth - 40; 
        
        // Получаем реальную ширину первой страницы при масштабе 1.0
        currentPdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const originalWidth = viewport.width;
            
            // Рассчитываем масштаб так, чтобы страница заняла всю доступную ширину
            let newScale = availableWidth / originalWidth;
            
            // Ограничиваем разумными пределами (не меньше 0.5, не больше 2.0)
            newScale = Math.max(0.5, Math.min(newScale, 2.0));
            
            // Если новый масштаб сильно отличается от текущего — обновляем
            if (Math.abs(scale - newScale) > 0.1) {
                scale = newScale;
                renderPage(currentPage);
            }
        });
    }

    // === ОБРАБОТЧИК RESIZE (КЛЮЧЕВОЕ ИЗМЕНЕНИЕ) ===
    // Используем debounce, чтобы не перерисовывать слишком часто при ресайзе
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (currentPdf && !modal.classList.contains('hidden')) {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                adjustScaleForMobile();
                updateMobileUI(); // Обновляем видимость элементов интерфейса
            }, 150);
        }
    });

    // === ФУНКЦИЯ ОБНОВЛЕНИЯ ИНТЕРФЕЙСА ДЛЯ МОБИЛЬНЫХ ===
    function updateMobileUI() {
        const isMobile = window.innerWidth < 600;
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (isMobile) {
            // На мобильных: только стрелки, убираем текст "Назад"/"Вперед"
            prevBtn.innerHTML = '←';
            nextBtn.innerHTML = '→';
            prevBtn.style.padding = '8px 12px';
            nextBtn.style.padding = '8px 12px';
        } else {
            // На десктопе: возвращаем полный текст
            prevBtn.innerHTML = '← Назад';
            nextBtn.innerHTML = 'Вперед →';
            prevBtn.style.padding = '8px 16px';
            nextBtn.style.padding = '8px 16px';
        }
        
        // Всегда показываем сокращенный формат "X из Y"
        if (pageInfo) {
            pageInfo.textContent = `${currentPage} из ${totalPages}`;
        }
    }

    // === ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ===
    function closeModal() {
        modal.classList.add('hidden');
        if (currentPdf) {
            currentPdf.destroy();
            currentPdf = null;
        }
    }

    document.getElementById('pdfClose').onclick = closeModal;
    
    // Закрытие по клику на затемненный фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // === НАВИГАЦИЯ И ЗУМ ===
    document.getElementById('prevPage').onclick = () => { 
        if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
            updateMobileUI();
        } 
    };
    
    document.getElementById('nextPage').onclick = () => { 
        if (currentPage < totalPages) {
            currentPage++;
            renderPage(currentPage);
            updateMobileUI();
        } 
    };
    
    document.getElementById('zoomIn').onclick = () => { 
        scale += 0.25; 
        renderPage(currentPage); 
    };
    
    document.getElementById('zoomOut').onclick = () => { 
        if (scale > 0.5) { 
            scale -= 0.25; 
            renderPage(currentPage); 
        } 
    };

    // === РЕНДЕР СТРАНИЦЫ ===
    async function renderPage(num) {
        if (!currentPdf) return;
        
        const page = await currentPdf.getPage(num);
        
        // Пересчитываем viewport с учетом текущего масштаба
        const viewport = page.getViewport({ scale });
        
        // Устанавливаем размеры канваса точно под viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Рисуем страницу
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        // Обновляем счетчик страниц (сокращенный формат)
        if (pageInfo) {
            pageInfo.textContent = `${num} из ${totalPages}`;
        }
    }
    
    // Инициализация UI при загрузке
    updateMobileUI();
});