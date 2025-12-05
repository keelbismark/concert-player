/**
 * Drag & Drop Playlist Reorder
 * Расширенный функционал перетаскивания треков
 */
class DragDropPlaylist {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.draggedItem = null;
        this.draggedIndex = null;
        this.placeholder = null;
        this.autoScrollInterval = null;
        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isTouchDragging = false;
        
        this.init();
    }

    init() {
        this.createPlaceholder();
        this.bindEvents();
    }

    createPlaceholder() {
        this.placeholder = document.createElement('li');
        this.placeholder.className = 'playlist-placeholder';
        this.placeholder.innerHTML = '<div class="placeholder-content">Отпустите здесь</div>';
    }

    bindEvents() {
        // Mouse events
        this.container.addEventListener('dragstart', this.onDragStart.bind(this));
        this.container.addEventListener('dragend', this.onDragEnd.bind(this));
        this.container.addEventListener('dragover', this.onDragOver.bind(this));
        this.container.addEventListener('dragenter', this.onDragEnter.bind(this));
        this.container.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.container.addEventListener('drop', this.onDrop.bind(this));
        
        // Touch events для мобильных устройств
        this.container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.container.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    // ==================== Mouse Events ====================

    onDragStart(e) {
        const item = e.target.closest('.track-item');
        if (!item) return;
        
        this.draggedItem = item;
        this.draggedIndex = parseInt(item.dataset.index);
        
        // Стилизация перетаскиваемого элемента
        item.classList.add('dragging');
        
        // Настройка drag image
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedIndex);
            
            // Создаём красивый drag image
            const dragImage = this.createDragImage(item);
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, 20);
            
            // Удаляем drag image после небольшой задержки
            setTimeout(() => dragImage.remove(), 0);
        }
        
        // Показываем placeholder
        setTimeout(() => {
            if (this.draggedItem) {
                this.draggedItem.style.opacity = '0.4';
            }
        }, 0);
    }

    onDragEnd(e) {
        if (!this.draggedItem) return;
        
        this.draggedItem.classList.remove('dragging');
        this.draggedItem.style.opacity = '';
        
        // Удаляем placeholder
        if (this.placeholder.parentNode) {
            this.placeholder.remove();
        }
        
        // Убираем все hover эффекты
        this.container.querySelectorAll('.track-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        this.draggedItem = null;
        this.draggedIndex = null;
        
        this.stopAutoScroll();
    }

    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Auto-scroll если близко к краям
        this.handleAutoScroll(e.clientY);
        
        const afterElement = this.getDragAfterElement(e.clientY);
        
        if (afterElement) {
            if (afterElement !== this.placeholder.nextSibling) {
                this.container.insertBefore(this.placeholder, afterElement);
            }
        } else {
            if (this.container.lastChild !== this.placeholder) {
                this.container.appendChild(this.placeholder);
            }
        }
    }

    onDragEnter(e) {
        e.preventDefault();
        const item = e.target.closest('.track-item');
        if (item && item !== this.draggedItem) {
            item.classList.add('drag-over');
        }
    }

    onDragLeave(e) {
        const item = e.target.closest('.track-item');
        if (item) {
            item.classList.remove('drag-over');
        }
    }

    onDrop(e) {
        e.preventDefault();
        
        if (!this.draggedItem) return;
        
        const afterElement = this.getDragAfterElement(e.clientY);
        let newIndex;
        
        if (afterElement) {
            newIndex = parseInt(afterElement.dataset.index);
            // Корректируем индекс если перемещаем вниз
            if (newIndex > this.draggedIndex) {
                newIndex--;
            }
        } else {
            newIndex = this.app.playlist.tracks.length - 1;
        }
        
        // Выполняем перемещение
        if (newIndex !== this.draggedIndex) {
            this.moveTrack(this.draggedIndex, newIndex);
        }
    }

    // ==================== Touch Events ====================

    onTouchStart(e) {
        const item = e.target.closest('.track-item');
        if (!item) return;
        
        // Проверяем, что это не нажатие на кнопку
        if (e.target.closest('button, .track-action')) return;
        
        this.touchStartY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
        this.potentialDragItem = item;
        
        // Долгое нажатие для начала drag
        this.longPressTimer = setTimeout(() => {
            this.startTouchDrag(item, e);
        }, 300);
    }

    onTouchMove(e) {
        // Отменяем long press если двигаемся
        const deltaX = Math.abs(e.touches[0].clientX - this.touchStartX);
        const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
        
        if (!this.isTouchDragging && (deltaX > 10 || deltaY > 10)) {
            clearTimeout(this.longPressTimer);
        }
        
        if (!this.isTouchDragging) return;
        
        e.preventDefault();
        
        this.touchCurrentY = e.touches[0].clientY;
        
        // Двигаем ghost element
        if (this.ghostElement) {
            this.ghostElement.style.top = `${this.touchCurrentY - 30}px`;
        }
        
        // Auto-scroll
        this.handleAutoScroll(this.touchCurrentY);
        
        // Обновляем placeholder
        const afterElement = this.getDragAfterElement(this.touchCurrentY);
        
        if (afterElement) {
            this.container.insertBefore(this.placeholder, afterElement);
        } else {
            this.container.appendChild(this.placeholder);
        }
    }

    onTouchEnd(e) {
        clearTimeout(this.longPressTimer);
        
        if (!this.isTouchDragging) return;
        
        // Находим новую позицию
        const afterElement = this.getDragAfterElement(this.touchCurrentY);
        let newIndex;
        
        if (afterElement) {
            newIndex = parseInt(afterElement.dataset.index);
            if (newIndex > this.draggedIndex) {
                newIndex--;
            }
        } else {
            newIndex = this.app.playlist.tracks.length - 1;
        }
        
        // Выполняем перемещение
        if (newIndex !== this.draggedIndex) {
            this.moveTrack(this.draggedIndex, newIndex);
        }
        
        // Очистка
        this.endTouchDrag();
    }

    startTouchDrag(item, e) {
        this.isTouchDragging = true;
        this.draggedItem = item;
        this.draggedIndex = parseInt(item.dataset.index);
        
        // Вибрация
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Создаём ghost element
        this.createGhostElement(item, e.touches[0].clientY);
        
        // Скрываем оригинал
        item.style.opacity = '0.4';
        item.classList.add('dragging');
        
        // Показываем placeholder
        this.container.insertBefore(this.placeholder, item.nextSibling);
    }

    endTouchDrag() {
        this.isTouchDragging = false;
        
        if (this.draggedItem) {
            this.draggedItem.style.opacity = '';
            this.draggedItem.classList.remove('dragging');
        }
        
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
        
        if (this.placeholder.parentNode) {
            this.placeholder.remove();
        }
        
        this.draggedItem = null;
        this.draggedIndex = null;
        
        this.stopAutoScroll();
    }

    createGhostElement(item, y) {
        this.ghostElement = item.cloneNode(true);
        this.ghostElement.className = 'track-item drag-ghost';
        this.ghostElement.style.cssText = `
            position: fixed;
            top: ${y - 30}px;
            left: 50%;
            transform: translateX(-50%);
            width: ${item.offsetWidth}px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            opacity: 0.9;
        `;
        document.body.appendChild(this.ghostElement);
    }

    // ==================== Helpers ====================

    getDragAfterElement(y) {
        const draggableElements = [
            ...this.container.querySelectorAll('.track-item:not(.dragging)')
        ];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    createDragImage(item) {
        const clone = item.cloneNode(true);
        clone.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            width: ${item.offsetWidth}px;
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        `;
        return clone;
    }

    handleAutoScroll(clientY) {
        const container = this.container;
        const rect = container.getBoundingClientRect();
        const scrollSpeed = 10;
        const threshold = 50;
        
        this.stopAutoScroll();
        
        if (clientY < rect.top + threshold) {
            // Scroll up
            this.autoScrollInterval = setInterval(() => {
                container.scrollTop -= scrollSpeed;
            }, 16);
        } else if (clientY > rect.bottom - threshold) {
            // Scroll down
            this.autoScrollInterval = setInterval(() => {
                container.scrollTop += scrollSpeed;
            }, 16);
        }
    }

    stopAutoScroll() {
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = null;
        }
    }

    moveTrack(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Анимация
        this.animateReorder(fromIndex, toIndex);
        
        // Перемещаем в playlist
        if (this.app.playlist && typeof this.app.playlist.moveTrack === 'function') {
            this.app.playlist.moveTrack(fromIndex, toIndex);
        } else {
            // Fallback - прямое перемещение
            const tracks = this.app.playlist.tracks;
            const [removed] = tracks.splice(fromIndex, 1);
            tracks.splice(toIndex, 0, removed);
            
            // Обновляем индексы
            tracks.forEach((track, i) => track.index = i);
            
            // Перерисовываем
            if (this.app.playlist.render) {
                this.app.playlist.render();
            }
        }
        
        // Уведомление
        this.app.showToast(`Трек перемещён на позицию ${toIndex + 1}`);
    }

    animateReorder(fromIndex, toIndex) {
        const items = this.container.querySelectorAll('.track-item');
        const direction = fromIndex < toIndex ? 1 : -1;
        
        items.forEach((item, index) => {
            if (index === fromIndex) return;
            
            if (direction === 1 && index > fromIndex && index <= toIndex) {
                item.style.transform = 'translateY(-100%)';
            } else if (direction === -1 && index >= toIndex && index < fromIndex) {
                item.style.transform = 'translateY(100%)';
            }
        });
        
        // Сброс после анимации
        setTimeout(() => {
            items.forEach(item => {
                item.style.transform = '';
                item.style.transition = '';
            });
        }, 200);
    }

    /**
     * Включить/выключить drag & drop
     */
    setEnabled(enabled) {
        const items = this.container.querySelectorAll('.track-item');
        items.forEach(item => {
            item.draggable = enabled;
        });
    }

    /**
     * Обновить привязки после изменения плейлиста
     */
    refresh() {
        const items = this.container.querySelectorAll('.track-item');
        items.forEach(item => {
            item.draggable = true;
        });
    }
}

// Экспорт
window.DragDropPlaylist = DragDropPlaylist;