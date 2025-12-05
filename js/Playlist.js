/**
 * Playlist Manager
 */

class Playlist {
    constructor() {
        this.tracks = [];
        this.currentIndex = -1;
        this.listeners = {
            change: [],
            select: [],
            load: [],
            reorder: []
        };
        this.importedData = null;
    }

    /**
     * Add track to playlist
     */
    add(track) {
        const newTrack = {
            id: track.id || Utils.generateId(),
            title: track.title || 'Unknown',
            file: track.file || null,
            buffer: track.buffer || null,
            duration: track.duration || 0,
            note: track.note || '',
            isLoaded: !!track.buffer,
            isLoading: false,
            error: false,
            // NEW: Additional metadata
            addedAt: Date.now(),
            color: track.color || null
        };

        this.tracks.push(newTrack);
        this.emit('change');
        return newTrack;
    }

    /**
     * Remove track by index
     */
    remove(index) {
        if (index < 0 || index >= this.tracks.length) return false;

        const removed = this.tracks.splice(index, 1)[0];

        // Adjust current index
        if (this.tracks.length === 0) {
            this.currentIndex = -1;
        } else if (this.currentIndex >= this.tracks.length) {
            this.currentIndex = this.tracks.length - 1;
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        } else if (this.currentIndex === index) {
            this.currentIndex = -1;
        }

        this.emit('change');
        return removed;
    }

    /**
     * Remove track by ID
     */
    removeById(id) {
        const index = this.tracks.findIndex(t => t.id === id);
        if (index !== -1) {
            return this.remove(index);
        }
        return null;
    }

    /**
     * Duplicate track
     */
    duplicate(index) {
        if (index < 0 || index >= this.tracks.length) return null;

        const original = this.tracks[index];
        const copy = {
            ...original,
            id: Utils.generateId(),
            title: original.title + ' (копия)',
            addedAt: Date.now()
        };

        this.tracks.splice(index + 1, 0, copy);
        this.emit('change');
        return copy;
    }

    /**
     * Reorder track (legacy method name)
     */
    reorder(fromIndex, toIndex) {
        return this.moveTrack(fromIndex, toIndex);
    }

    /**
     * Move track from one position to another
     * NEW: Enhanced method for drag & drop
     */
    moveTrack(fromIndex, toIndex) {
        // Validate indices
        if (fromIndex === toIndex) return false;
        if (fromIndex < 0 || fromIndex >= this.tracks.length) return false;
        if (toIndex < 0 || toIndex >= this.tracks.length) return false;

        // Remove track from original position
        const [track] = this.tracks.splice(fromIndex, 1);
        
        // Insert at new position
        this.tracks.splice(toIndex, 0, track);

        // Adjust current index to follow the currently selected track
        if (this.currentIndex === fromIndex) {
            // The selected track was moved
            this.currentIndex = toIndex;
        } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
            // Track moved from before current to after/at current
            this.currentIndex--;
        } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
            // Track moved from after current to before/at current
            this.currentIndex++;
        }

        this.emit('reorder', { fromIndex, toIndex, track });
        this.emit('change');
        return true;
    }

    /**
     * Get track by ID
     */
    getById(id) {
        return this.tracks.find(t => t.id === id) || null;
    }

    /**
     * Get track index by ID
     */
    getIndexById(id) {
        return this.tracks.findIndex(t => t.id === id);
    }

    /**
     * Select track
     */
    select(index) {
        if (index < 0 || index >= this.tracks.length) return null;

        this.currentIndex = index;
        const track = this.tracks[index];
        this.emit('select', track);
        return track;
    }

    /**
     * Select track by ID
     */
    selectById(id) {
        const index = this.getIndexById(id);
        if (index !== -1) {
            return this.select(index);
        }
        return null;
    }

    /**
     * Select next track
     */
    next() {
        if (this.tracks.length === 0) return null;

        const nextIndex = this.currentIndex < this.tracks.length - 1 
            ? this.currentIndex + 1 
            : 0;

        return this.select(nextIndex);
    }

    /**
     * Select previous track
     */
    prev() {
        if (this.tracks.length === 0) return null;

        const prevIndex = this.currentIndex > 0 
            ? this.currentIndex - 1 
            : this.tracks.length - 1;

        return this.select(prevIndex);
    }

    /**
     * Get current track
     */
    getCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.tracks.length) return null;
        return this.tracks[this.currentIndex];
    }

    /**
     * Get current track (alias)
     */
    get currentTrack() {
        return this.getCurrent();
    }

    /**
     * Get next track (without selecting)
     */
    getNext() {
        if (this.currentIndex < 0 || this.currentIndex >= this.tracks.length - 1) {
            return null;
        }
        return this.tracks[this.currentIndex + 1];
    }

    /**
     * Update track property
     */
    updateTrack(index, updates) {
        if (index < 0 || index >= this.tracks.length) return;

        Object.assign(this.tracks[index], updates);
        this.emit('change');
    }

    /**
     * Update track by ID
     */
    updateTrackById(id, updates) {
        const index = this.getIndexById(id);
        if (index !== -1) {
            this.updateTrack(index, updates);
        }
    }

    /**
     * Set track note
     */
    setNote(index, note) {
        this.updateTrack(index, { note });
    }

    /**
     * Clear playlist
     */
    clear() {
        this.tracks = [];
        this.currentIndex = -1;
        this.importedData = null;
        this.emit('change');
    }

    /**
     * Get total duration
     */
    getTotalDuration() {
        return this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    }

    /**
     * Get remaining duration from current track
     */
    getRemainingDuration(fromPosition = 0) {
        if (this.tracks.length === 0 || this.currentIndex < 0) {
            return 0;
        }
        
        let total = 0;
        for (let i = this.currentIndex; i < this.tracks.length; i++) {
            if (i === this.currentIndex) {
                total += Math.max(0, (this.tracks[i].duration || 0) - fromPosition);
            } else {
                total += this.tracks[i].duration || 0;
            }
        }
        return total;
    }

    /**
     * Calculate schedule times
     */
    calculateSchedule(startTime = null) {
        const schedule = {};
        let currentTime = startTime ? new Date(startTime) : new Date();

        this.tracks.forEach((track, index) => {
            if (track.duration > 0) {
                schedule[index] = Utils.formatTimeHHMM(currentTime);
                currentTime = new Date(currentTime.getTime() + track.duration * 1000);
            }
        });

        return schedule;
    }

    /**
     * Filter tracks by query
     */
    filter(query) {
        const q = query.toLowerCase().trim();
        if (!q) return this.tracks.map((_, i) => i);

        return this.tracks
            .map((track, index) => ({ track, index }))
            .filter(({ track }) => 
                track.title.toLowerCase().includes(q) ||
                (track.note && track.note.toLowerCase().includes(q))
            )
            .map(({ index }) => index);
    }

    /**
     * Sort tracks
     */
    sort(compareFn) {
        const currentTrackId = this.currentIndex >= 0 ? this.tracks[this.currentIndex]?.id : null;
        
        this.tracks.sort(compareFn);
        
        // Restore current index after sort
        if (currentTrackId) {
            this.currentIndex = this.getIndexById(currentTrackId);
        }
        
        this.emit('change');
    }

    /**
     * Sort by title
     */
    sortByTitle(ascending = true) {
        this.sort((a, b) => {
            const comparison = a.title.localeCompare(b.title);
            return ascending ? comparison : -comparison;
        });
    }

    /**
     * Sort by duration
     */
    sortByDuration(ascending = true) {
        this.sort((a, b) => {
            const comparison = (a.duration || 0) - (b.duration || 0);
            return ascending ? comparison : -comparison;
        });
    }

    /**
     * Shuffle playlist
     */
    shuffle() {
        const currentTrackId = this.currentIndex >= 0 ? this.tracks[this.currentIndex]?.id : null;
        
        // Fisher-Yates shuffle
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
        
        // Restore current index
        if (currentTrackId) {
            this.currentIndex = this.getIndexById(currentTrackId);
        }
        
        this.emit('change');
    }

    /**
     * Export playlist data
     */
    export() {
        return {
            version: '3.1',
            exportDate: new Date().toISOString(),
            currentIndex: this.currentIndex,
            tracks: this.tracks.map(track => ({
                id: track.id,
                title: track.title,
                duration: track.duration,
                note: track.note || '',
                color: track.color || null
            }))
        };
    }

    /**
     * Import playlist data (metadata only)
     */
    import(data) {
        if (!data || !data.tracks) return false;

        // Store for later matching with audio files
        this.importedData = data.tracks;
        
        // If there's a saved current index, store it
        if (typeof data.currentIndex === 'number') {
            this._pendingCurrentIndex = data.currentIndex;
        }
        
        return true;
    }

    /**
     * Match imported metadata with loaded audio file
     */
    matchImportedTrack(title) {
        if (!this.importedData) return null;

        const normalizeTitle = (t) => t.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const normalizedTitle = normalizeTitle(title);

        const match = this.importedData.find(t => {
            const normalizedImported = normalizeTitle(t.title);
            return normalizedImported === normalizedTitle ||
                   normalizedTitle.includes(normalizedImported) ||
                   normalizedImported.includes(normalizedTitle);
        });

        return match || null;
    }

    /**
     * Subscribe to events
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Unsubscribe from events
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event
     */
    emit(event, data = null) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * Get track count
     */
    get length() {
        return this.tracks.length;
    }

    /**
     * Check if empty
     */
    get isEmpty() {
        return this.tracks.length === 0;
    }

    /**
     * Check if has current selection
     */
    get hasSelection() {
        return this.currentIndex >= 0 && this.currentIndex < this.tracks.length;
    }

    /**
     * Get current playlist name (for display)
     */
    get name() {
        return 'Concert Playlist';
    }
}