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
            load: []
        };
    }

    /**
     * Add track to playlist
     */
    add(track) {
        const newTrack = {
            id: Utils.generateId(),
            title: track.title || 'Unknown',
            file: track.file || null,
            buffer: track.buffer || null,
            duration: track.duration || 0,
            note: track.note || '',
            isLoaded: !!track.buffer,
            isLoading: false,
            error: false
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

        this.tracks.splice(index, 1);

        // Adjust current index
        if (this.currentIndex >= this.tracks.length) {
            this.currentIndex = this.tracks.length - 1;
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        } else if (this.currentIndex === index) {
            this.currentIndex = -1;
        }

        this.emit('change');
        return true;
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
            title: original.title + ' (копия)'
        };

        this.tracks.splice(index + 1, 0, copy);
        this.emit('change');
        return copy;
    }

    /**
     * Reorder track
     */
    reorder(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this.tracks.length) return;
        if (toIndex < 0 || toIndex >= this.tracks.length) return;

        const track = this.tracks.splice(fromIndex, 1)[0];
        this.tracks.splice(toIndex, 0, track);

        // Adjust current index
        if (this.currentIndex === fromIndex) {
            this.currentIndex = toIndex;
        } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
            this.currentIndex--;
        } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
            this.currentIndex++;
        }

        this.emit('change');
    }

    /**
     * Select track
     */
    select(index) {
        if (index < 0 || index >= this.tracks.length) return null;

        this.currentIndex = index;
        this.emit('select', this.tracks[index]);
        return this.tracks[index];
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
        if (this.currentIndex < 0) return null;
        return this.tracks[this.currentIndex];
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
     * Export playlist data
     */
    export() {
        return {
            version: '3.1',
            exportDate: new Date().toISOString(),
            tracks: this.tracks.map(track => ({
                title: track.title,
                duration: track.duration,
                note: track.note || ''
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
        return true;
    }

    /**
     * Match imported metadata with loaded audio file
     */
    matchImportedTrack(title) {
        if (!this.importedData) return null;

        const match = this.importedData.find(t => 
            t.title.toLowerCase() === title.toLowerCase() ||
            title.toLowerCase().includes(t.title.toLowerCase()) ||
            t.title.toLowerCase().includes(title.toLowerCase())
        );

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
        return this.currentIndex >= 0;
    }
}