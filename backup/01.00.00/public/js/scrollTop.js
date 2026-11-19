/**
 * scrollTop.js — Кнопка "Вернуться наверх"
 * Автоматически создаёт плавающую кнопку при прокрутке страницы
 */

document.addEventListener('DOMContentLoaded', function() {
    // Создаём кнопку программно
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'btn-scroll-top';
    scrollBtn.setAttribute('aria-label', 'Вернуться наверх');
    scrollBtn.title = 'Вернуться наверх';
    scrollBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
        </svg>
    `;
    
    document.body.appendChild(scrollBtn);
    
    // Показываем/скрываем кнопку при прокрутке
    const SCROLL_THRESHOLD = 400; // px — после скольких пикселей показывать
    
    function handleScroll() {
        if (window.scrollY > SCROLL_THRESHOLD) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    }
    
    // Плавная прокрутка наверх
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    // Слушатели событий
    window.addEventListener('scroll', handleScroll, { passive: true });
    scrollBtn.addEventListener('click', scrollToTop);
    
    // Проверяем начальное положение (если страница загружена с якорем)
    handleScroll();
    
    console.log('✅ Кнопка "Вернуться наверх" инициализирована');
});