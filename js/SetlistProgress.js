/**
 * SetlistProgress.js
 * Отображение прогресса сетлиста
 */

class SetlistProgress {
    constructor() {
        // Элементы
        this.tracksText = document.getElementById('setlist-tracks-text');
        this.tracksBar = document.getElementById('setlist-tracks-bar');
        this.timeText = document.getElementById('setlist-time-text');
        this.timeBar = document.getElementById('setlist-time-bar');
        this.remainingTracks = document.getElementById('setlist-remaining-tracks');
        this.endTime = document.getElementById('setlist-end-time');
        
        // Данные
        this.data = {
            currentIndex: 0,
            totalTracks: 0,
            playedTime: 0,
            totalTime: 0,
            currentTrackTime: 0
        };
    }
    
    /**
     * Обновить прогресс
     * @param {object} data
     */
    update(data) {
        this.data = { ...this.data, ...data };
        this.render();
    }
    
    /**
     * Обновить только текущее время трека
     * @param {number} currentTrackTime - текущая позиция в треке
     */
    updateCurrentTime(currentTrackTime) {
        this.data.currentTrackTime = currentTrackTime;
        this.render();
    }
    
    /**
     * Отрисовать
     */
    render() {
        const { currentIndex, totalTracks, playedTime, totalTime, currentTrackTime } = this.data;
        
        // Сыграно треков (текущий = сыгран частично)
        const tracksPlayed = Math.min(currentIndex + 1, totalTracks);
        const tracksPercent = totalTracks > 0 ? (tracksPlayed / totalTracks) * 100 : 0;
        
        if (this.tracksText) {
            this.tracksText.textContent = `${tracksPlayed} / ${totalTracks}`;
        }
        
        if (this.tracksBar) {
            this.tracksBar.style.width = `${tracksPercent}%`;
        }
        
        // Время (сыгранное + текущая позиция)
        const actualPlayedTime = playedTime + (currentTrackTime || 0);
        const timePercent = totalTime > 0 ? (actualPlayedTime / totalTime) * 100 : 0;
        
        if (this.timeText) {
            this.timeText.textContent = `${this.formatTime(actualPlayedTime)} / ${this.formatTime(totalTime)}`;
        }
        
        if (this.timeBar) {
            this.timeBar.style.width = `${Math.min(timePercent, 100)}%`;
        }
        
        // Осталось треков
        const remaining = Math.max(0, totalTracks - tracksPlayed);
        if (this.remainingTracks) {
            this.remainingTracks.textContent = remaining;
        }
        
        // Время окончания
        if (this.endTime) {
            const remainingTime = Math.max(0, totalTime - actualPlayedTime);
            if (remainingTime > 0 && totalTracks > 0) {
                const endDate = new Date(Date.now() + remainingTime * 1000);
                this.endTime.textContent = endDate.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } else {
                this.endTime.textContent = '--:--';
            }
        }
    }
    
    /**
     * Рассчитать данные из плейлиста
     * @param {Array} tracks - массив треков
     * @param {number} currentIndex - текущий индекс
     * @param {number} currentTrackTime - позиция в текущем треке
     */
    calculate(tracks, currentIndex, currentTrackTime = 0) {
        let totalTime = 0;
        let playedTime = 0;
        
        tracks.forEach((track, index) => {
            const duration = track.duration || 0;
            totalTime += duration;
            
            if (index < currentIndex) {
                playedTime += duration;
            }
        });
        
        this.update({
            currentIndex: currentIndex,
            totalTracks: tracks.length,
            playedTime: playedTime,
            totalTime: totalTime,
            currentTrackTime: currentTrackTime
        });
    }
    
    /**
     * Сбросить
     */
    reset() {
        this.data = {
            currentIndex: 0,
            totalTracks: 0,
            playedTime: 0,
            totalTime: 0,
            currentTrackTime: 0
        };
        this.render();
    }
    
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '00:00';
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Глобальный экземпляр
window.setlistProgress = new SetlistProgress();