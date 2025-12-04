/**
 * Touch Mode - Optimizations for touch devices
 */

class TouchMode {
    constructor(app) {
        this.app = app;
        this.isEnabled = false;
        this.isTouchDevice = this.detectTouchDevice();
        this.swipeThreshold = 80;
        this.longPressDelay = 500;

        // Touch state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.currentSwipeItem = null;
        this.longPressTimer = null;

        // Auto-enable on touch devices
        if (this.isTouchDevice) {
            this.enable();
        }

        this.init();
    }

    detectTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
    }

    init() {
        // Add touch mode toggle button
        this.addToggleButton();

        // Listen for pointer type changes
        window.matchMedia('(pointer: coarse)').addEventListener('change', (e) => {
            if (e.matches) {
                this.enable();
            }
        });

        // Prevent double-tap zoom
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (this.lastTouchEnd && now - this.lastTouchEnd < 300) {
                e.preventDefault();
            }
            this.lastTouchEnd = now;
        }, { passive: false });

        // Prevent pinch zoom on player
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    addToggleButton() {
        const btn = document.createElement('button');
        btn.className = 'header-btn touch-mode-toggle';
        btn.id = 'touch-mode-btn';
        btn.innerHTML = '👆';
        btn.title = 'Touch Mode';
        btn.addEventListener('click', () => this.toggle());

        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.insertBefore(btn, headerControls.firstChild);
        }

        this.toggleButton = btn;
        this.updateToggleButton();
    }

    enable() {
        if (this.isEnabled) return;

        this.isEnabled = true;
        document.body.classList.add('touch-mode');
        this.bindTouchEvents();
        this.updateToggleButton();

        console.log('Touch mode enabled');
    }

    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;
        document.body.classList.remove('touch-mode');
        this.unbindTouchEvents();
        this.updateToggleButton();

        console.log('Touch mode disabled');
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    updateToggleButton() {
        if (this.toggleButton) {
            this.toggleButton.classList.toggle('active', this.isEnabled);
            this.toggleButton.innerHTML = this.isEnabled ? '👆' : '🖱️';
        }
    }

    bindTouchEvents() {
        const playlist = document.getElementById('playlist');
        if (!playlist) return;

        // Swipe to delete/edit
        playlist.addEventListener('touchstart', this.onSwipeStart.bind(this), { passive: true });
        playlist.addEventListener('touchmove', this.onSwipeMove.bind(this), { passive: false });
        playlist.addEventListener('touchend', this.onSwipeEnd.bind(this), { passive: true });

        // Store reference for cleanup
        this.playlistElement = playlist;
    }

    unbindTouchEvents() {
        // Events will be garbage collected when touch mode class is removed
    }

    onSwipeStart(e) {
        const item = e.target.closest('.track-item');
        if (!item) return;

        // Don't start swipe on buttons
        if (e.target.closest('.track-actions') || e.target.closest('.track-btn')) {
            return;
        }

        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
        this.currentSwipeItem = item;

        // Long press detection
        this.longPressTimer = setTimeout(() => {
            this.onLongPress(item);
        }, this.longPressDelay);
    }

    onSwipeMove(e) {
        if (!this.currentSwipeItem) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;

        // Cancel long press if moved
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            clearTimeout(this.longPressTimer);
        }

        // Horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
            e.preventDefault();
            this.updateSwipePosition(deltaX);
        }
    }

    onSwipeEnd(e) {
        clearTimeout(this.longPressTimer);

        if (!this.currentSwipeItem) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const duration = Date.now() - this.touchStartTime;
        const velocity = Math.abs(deltaX) / duration;

        // Fast swipe or long swipe
        if (deltaX < -this.swipeThreshold || (deltaX < -50 && velocity > 0.5)) {
            this.showSwipeActions(this.currentSwipeItem);
        } else if (deltaX > this.swipeThreshold || (deltaX > 50 && velocity > 0.5)) {
            this.hideSwipeActions(this.currentSwipeItem);
        } else {
            this.resetSwipePosition();
        }

        this.currentSwipeItem = null;
    }

    updateSwipePosition(deltaX) {
        if (!this.currentSwipeItem) return;

        const maxSwipe = -120;
        const clampedDelta = Math.max(maxSwipe, Math.min(0, deltaX));

        this.currentSwipeItem.style.transform = `translateX(${clampedDelta}px)`;
        this.currentSwipeItem.style.transition = 'none';
    }

    resetSwipePosition() {
        if (!this.currentSwipeItem) return;

        this.currentSwipeItem.style.transform = '';
        this.currentSwipeItem.style.transition = 'transform 0.2s ease';
    }

    showSwipeActions(item) {
        // Hide any other open swipe actions
        document.querySelectorAll('.track-item.swiped').forEach(el => {
            if (el !== item) {
                el.classList.remove('swiped');
                el.style.transform = '';
            }
        });

        item.classList.add('swiped');
        item.style.transform = 'translateX(-120px)';
        item.style.transition = 'transform 0.2s ease';

        // Add swipe action buttons if not present
        if (!item.querySelector('.swipe-actions')) {
            this.addSwipeActions(item);
        }
    }

    hideSwipeActions(item) {
        item.classList.remove('swiped');
        item.style.transform = '';
        item.style.transition = 'transform 0.2s ease';
    }

    addSwipeActions(item) {
        const actions = document.createElement('div');
        actions.className = 'swipe-actions';
        actions.innerHTML = `
            <button class="swipe-action-btn edit" data-action="edit">📝</button>
            <button class="swipe-action-btn delete" data-action="delete">🗑️</button>
        `;

        actions.addEventListener('click', (e) => {
            const btn = e.target.closest('.swipe-action-btn');
            if (!btn) return;

            const index = parseInt(item.dataset.index);
            const action = btn.dataset.action;

            if (action === 'delete') {
                this.app.removeTrack(index);
            } else if (action === 'edit') {
                this.app.ui.openNoteModal(index);
            }

            this.hideSwipeActions(item);
        });

        item.appendChild(actions);
    }

    onLongPress(item) {
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Show context menu or start drag
        const index = parseInt(item.dataset.index);
        
        // Visual feedback
        item.classList.add('long-press-active');
        
        // Remove after animation
        setTimeout(() => {
            item.classList.remove('long-press-active');
        }, 200);

        // Trigger action (e.g., open note modal)
        this.app.ui.openNoteModal(index);
    }

    // Haptic feedback helper
    vibrate(pattern = 50) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    destroy() {
        this.disable();
        if (this.toggleButton) {
            this.toggleButton.remove();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchMode;
}