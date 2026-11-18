        // === АВТОМАТИЧЕСКОЕ СКРЫТИЕ ПУСТЫХ БЛОКОВ С ФОТО ===
        document.addEventListener('DOMContentLoaded', function() {
            
            // 1. Обработка чек-листа контрольных параметров
            const qs = document.getElementById('qualitySection');
            if (qs) {
                const cbs = qs.querySelectorAll('.quality-checkbox');
                cbs.forEach(cb => cb.addEventListener('change', () => {
                    qs.classList.toggle('completed', Array.from(cbs).every(c => c.checked));
                }));
            }
            
            // 2. Автоматическое скрытие блоков с фото, если изображение не загрузилось
            const stepImages = document.querySelectorAll('.step-image');
            
            stepImages.forEach(container => {
                const img = container.querySelector('img');
                
                if (!img) {
                    // Если тега img вообще нет — скрываем контейнер
                    container.classList.add('hidden-photo');
                    const li = container.closest('li');
                    if (li) li.classList.add('no-photo');
                    return;
                }
                
                // Проверяем, загрузилось ли изображение
                if (img.complete) {
                    // Изображение уже загружено (из кэша)
                    if (img.naturalWidth === 0 || img.src === window.location.href) {
                        // Изображение не загрузилось
                        container.classList.add('hidden-photo');
                        const li = container.closest('li');
                        if (li) li.classList.add('no-photo');
                    }
                } else {
                    // Ждём загрузки изображения
                    img.addEventListener('load', function() {
                        if (img.naturalWidth === 0) {
                            container.classList.add('hidden-photo');
                            const li = container.closest('li');
                            if (li) li.classList.add('no-photo');
                        }
                    });
                    
                    img.addEventListener('error', function() {
                        container.classList.add('hidden-photo');
                        const li = container.closest('li');
                        if (li) li.classList.add('no-photo');
                    });
                }
            });
            
            console.log('✅ Скрипт скрытия пустых фото инициализирован');
        });