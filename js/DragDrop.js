/**
 * Enhanced Drag & Drop with visual indicators
 */

class DragDropManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemSelector: '.track-item',
            handleSelector: null,
            placeholderClass: 'drag-placeholder',
            draggingClass: 'dragging',
            overClass: 'drag-over',
            animationDuration: 200,
            onReorder: null,
            ...options
        };

        this.draggedItem = null;
        this.draggedIndex = -1;
        this.placeholder = null;
        this.items = [];
        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isTouchDevice = 'ontouchstart' in window;
        this.longPressTimer = null;
        this.isDragging = false;

        this.init();
    }

    init() {
        this.createPlaceholder();
        this.bindEvents();
    }

    createPlaceholder() {
        this.placeholder = document.createElement('li');
        this.placeholder.className = this.options.placeholderClass;
        this.placeholder.style.cssText = `
            list-style: none;
            background: linear-gradient(90deg, 
                rgba(0, 255, 136, 0.1), 
                rgba(0, 255, 136, 0.2), 
                rgba(0, 255, 136, 0.1));
            border: 2px dashed var(--accent-primary, #00ff88);
            border-radius: var(--radius-md, 10px);
            margin-bottom: 4px;
            transition: height 0.15s ease;
        `;
    }

    bindEvents() {
        if (this.isTouchDevice) {
            this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
            this.container.addEventListener('touchcancel', (e) => this.onTouchEnd(e));
        }

        // Mouse events
        this.container.addEventListener('dragstart', (e) => this.onDragStart(e));
        this.container.addEventListener('dragend', (e) => this.onDragEnd(e));
        this.container.addEventListener('dragover', (e) => this.onDragOver(e));
        this.container.addEventListener('dragenter', (e) => this.onDragEnter(e));
        this.container.addEventListener('dragleave', (e) => this.onDragLeave(e));
        this.container.addEventListener('drop', (e) => this.onDrop(e));
    }

    // ==================== MOUSE EVENTS ====================

    onDragStart(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        this.draggedItem = item;
        this.draggedIndex = this.getItemIndex(item);
        this.items = Array.from(this.container.querySelectorAll(this.options.itemSelector));

        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.draggedIndex);

        // Create custom drag image
        const dragImage = this.createDragImage(item);
        e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, 30);

        // Apply dragging class after a frame
        requestAnimationFrame(() => {
            item.classList.add(this.options.draggingClass);
            item.style.opacity = '0.4';
        });

        // Show placeholder
        this.placeholder.style.height = `${item.offsetHeight}px`;
    }

    onDragEnd(e) {
        if (this.draggedItem) {
            this.draggedItem.classList.remove(this.options.draggingClass);
            this.draggedItem.style.opacity = '';
        }

        this.removePlaceholder();
        this.removeOverClass();
        this.cleanupDragImage();

        this.draggedItem = null;
        this.draggedIndex = -1;
        this.isDragging = false;
    }

    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const item = e.target.closest(this.options.itemSelector);
        if (!item || item === this.draggedItem) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        this.removeOverClass();

        if (e.clientY < midY) {
            item.parentNode.insertBefore(this.placeholder, item);
        } else {
            item.parentNode.insertBefore(this.placeholder, item.nextSibling);
        }
    }

    onDragEnter(e) {
        e.preventDefault();
        const item = e.target.closest(this.options.itemSelector);
        if (item && item !== this.draggedItem) {
            item.classList.add(this.options.overClass);
        }
    }

    onDragLeave(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (item) {
            item.classList.remove(this.options.overClass);
        }
    }

    onDrop(e) {
        e.preventDefault();

        const fromIndex = this.draggedIndex;
        const toIndex = this.getPlaceholderIndex();

        this.removePlaceholder();
        this.removeOverClass();

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            if (this.options.onReorder) {
                this.options.onReorder(fromIndex, toIndex > fromIndex ? toIndex - 1 : toIndex);
            }
        }
    }

    // ==================== TOUCH EVENTS ====================

    onTouchStart(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        // Check if touch is on action buttons
        if (e.target.closest('.track-actions') || e.target.closest('.track-btn')) {
            return;
        }

        const touch = e.touches[0];
        this.touchStartY = touch.clientY;
        this.touchCurrentY = touch.clientY;
        this.touchStartX = touch.clientX;

        // Long press to start drag
        this.longPressTimer = setTimeout(() => {
            this.startTouchDrag(item, touch);
        }, 300);
    }

    startTouchDrag(item, touch) {
        if (this.isDragging) return;

        this.isDragging = true;
        this.draggedItem = item;
        this.draggedIndex = this.getItemIndex(item);
        this.items = Array.from(this.container.querySelectorAll(this.options.itemSelector));

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Create floating clone
        this.createTouchClone(item, touch);

        // Setup placeholder
        this.placeholder.style.height = `${item.offsetHeight}px`;
        item.parentNode.insertBefore(this.placeholder, item);
        item.style.display = 'none';

        // Add touch dragging class to body
        document.body.classList.add('touch-dragging');
    }

    onTouchMove(e) {
        if (this.longPressTimer) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - this.touchStartX);
            const deltaY = Math.abs(touch.clientY - this.touchStartY);

            // Cancel long press if moved too much
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        }

        if (!this.isDragging || !this.draggedItem) return;

        e.preventDefault();

        const touch = e.touches[0];
        this.touchCurrentY = touch.clientY;

        // Move floating clone
        if (this.touchClone) {
            this.touchClone.style.top = `${touch.clientY - 35}px`;
            this.touchClone.style.left = `${touch.clientX - this.touchClone.offsetWidth / 2}px`;
        }

        // Find item under touch
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const itemUnder = elementUnder?.closest(this.options.itemSelector);

        if (itemUnder && itemUnder !== this.draggedItem) {
            const rect = itemUnder.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (touch.clientY < midY) {
                itemUnder.parentNode.insertBefore(this.placeholder, itemUnder);
            } else {
                itemUnder.parentNode.insertBefore(this.placeholder, itemUnder.nextSibling);
            }
        }
    }

    onTouchEnd(e) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;

        if (!this.isDragging) return;

        const fromIndex = this.draggedIndex;
        const toIndex = this.getPlaceholderIndex();

        // Restore original item
        if (this.draggedItem) {
            this.draggedItem.style.display = '';
        }

        this.removePlaceholder();
        this.removeTouchClone();

        document.body.classList.remove('touch-dragging');

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            if (this.options.onReorder) {
                this.options.onReorder(fromIndex, toIndex > fromIndex ? toIndex - 1 : toIndex);
            }
        }

        this.draggedItem = null;
        this.draggedIndex = -1;
        this.isDragging = false;
    }

    // ==================== HELPERS ====================

    createDragImage(item) {
        const clone = item.cloneNode(true);
        clone.id = 'drag-image-clone';
        clone.style.cssText = `
            position: fixed;
            top: -1000px;
            left: -1000px;
            width: ${item.offsetWidth}px;
            background: var(--bg-elevated, #1c2128);
            border: 1px solid var(--accent-primary, #00ff88);
            border-radius: var(--radius-md, 10px);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            opacity: 0.95;
            z-index: 9999;
        `;
        document.body.appendChild(clone);
        this.dragImageClone = clone;
        return clone;
    }

    cleanupDragImage() {
        if (this.dragImageClone) {
            this.dragImageClone.remove();
            this.dragImageClone = null;
        }
    }

    createTouchClone(item, touch) {
        this.touchClone = item.cloneNode(true);
        this.touchClone.className = 'touch-dragging-clone';
        this.touchClone.style.cssText = `
            position: fixed;
            top: ${touch.clientY - 35}px;
            left: ${touch.clientX - item.offsetWidth / 2}px;
            width: ${item.offsetWidth}px;
            background: var(--bg-elevated, #1c2128);
            border: 2px solid var(--accent-primary, #00ff88);
            border-radius: var(--radius-md, 10px);
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 255, 136, 0.3);
            z-index: 10000;
            pointer-events: none;
            transform: scale(1.02);
            opacity: 0.95;
        `;
        document.body.appendChild(this.touchClone);
    }

    removeTouchClone() {
        if (this.touchClone) {
            this.touchClone.remove();
            this.touchClone = null;
        }
    }

    getItemIndex(item) {
        const items = Array.from(this.container.querySelectorAll(this.options.itemSelector));
        return items.indexOf(item);
    }

    getPlaceholderIndex() {
        const children = Array.from(this.container.children);
        return children.indexOf(this.placeholder);
    }

    removePlaceholder() {
        if (this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
    }

    removeOverClass() {
        this.container.querySelectorAll(`.${this.options.overClass}`).forEach(el => {
            el.classList.remove(this.options.overClass);
        });
    }

    destroy() {
        // Remove event listeners would go here
        this.removePlaceholder();
        this.removeTouchClone();
        this.cleanupDragImage();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropManager;
}