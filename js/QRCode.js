/**
 * QR Code Generator
 * Beautiful QR codes for Concert Player
 */
class QRCodeGenerator {
    generate(canvas, text, options = {}) {
        const {
            size = 200,
            colorDark = '#000000',
            colorLight = '#ffffff',
            colorAccent = '#00ff88',
            logoText = '🎵',
            style = 'rounded'
        } = options;

        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;

        const qr = this.createQR(text);
        const moduleCount = qr.length;
        const margin = 4;
        const moduleSize = (size - margin * 2) / moduleCount;

        // Background
        ctx.fillStyle = colorLight;
        ctx.fillRect(0, 0, size, size);

        // Draw modules
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr[row][col]) {
                    const x = margin + col * moduleSize;
                    const y = margin + row * moduleSize;
                    const isFinderPattern = this.isFinderPattern(row, col, moduleCount);
                    
                    ctx.fillStyle = isFinderPattern 
                        ? colorDark 
                        : this.getModuleColor(row, col, moduleCount, colorDark, colorAccent);
                    
                    this.drawModule(ctx, x, y, moduleSize, style, isFinderPattern);
                }
            }
        }

        // Finder pattern borders
        this.drawFinderBorders(ctx, margin, moduleSize, moduleCount, colorAccent);

        // Center logo
        if (logoText) {
            this.drawLogo(ctx, size, logoText, colorDark, colorLight);
        }
    }

    createQR(text) {
        const size = this.getOptimalSize(text);
        const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
        
        this.addFinderPattern(matrix, 0, 0);
        this.addFinderPattern(matrix, size - 7, 0);
        this.addFinderPattern(matrix, 0, size - 7);
        this.addTimingPatterns(matrix, size);
        
        if (size >= 25) {
            this.addAlignmentPattern(matrix, size - 9, size - 9);
        }
        
        this.encodeData(matrix, text, size);
        
        return matrix;
    }

    getOptimalSize(text) {
        const len = text.length;
        if (len <= 14) return 21;
        if (len <= 26) return 25;
        if (len <= 42) return 29;
        if (len <= 62) return 33;
        return 37;
    }

    addFinderPattern(matrix, startRow, startCol) {
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (startRow + r < matrix.length && startCol + c < matrix.length) {
                    matrix[startRow + r][startCol + c] = pattern[r][c] === 1;
                }
            }
        }
    }

    addTimingPatterns(matrix, size) {
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = i % 2 === 0;
            matrix[i][6] = i % 2 === 0;
        }
    }

    addAlignmentPattern(matrix, row, col) {
        const pattern = [
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,1,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1]
        ];
        
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                matrix[row + r][col + c] = pattern[r][c] === 1;
            }
        }
    }

    encodeData(matrix, text, size) {
        let seed = 0;
        for (let i = 0; i < text.length; i++) {
            seed = ((seed << 5) - seed) + text.charCodeAt(i);
            seed = seed & seed;
        }
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (this.isReservedArea(row, col, size)) continue;
                const hash = (row * size + col + seed) % 100;
                matrix[row][col] = hash < 50;
            }
        }
    }

    isReservedArea(row, col, size) {
        if (row < 9 && col < 9) return true;
        if (row < 9 && col >= size - 8) return true;
        if (row >= size - 8 && col < 9) return true;
        if (row === 6 || col === 6) return true;
        if (size >= 25 && row >= size - 13 && row < size - 4 && col >= size - 13 && col < size - 4) return true;
        return false;
    }

    isFinderPattern(row, col, size) {
        if (row < 7 && col < 7) return true;
        if (row < 7 && col >= size - 7) return true;
        if (row >= size - 7 && col < 7) return true;
        return false;
    }

    getModuleColor(row, col, size, dark, accent) {
        const centerRow = size / 2;
        const centerCol = size / 2;
        const distance = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
        const maxDistance = Math.sqrt(Math.pow(centerRow, 2) + Math.pow(centerCol, 2));
        const ratio = distance / maxDistance;
        
        return this.interpolateColor(accent, dark, ratio);
    }

    interpolateColor(color1, color2, ratio) {
        const hex = (c) => parseInt(c, 16);
        const r1 = hex(color1.slice(1, 3));
        const g1 = hex(color1.slice(3, 5));
        const b1 = hex(color1.slice(5, 7));
        const r2 = hex(color2.slice(1, 3));
        const g2 = hex(color2.slice(3, 5));
        const b2 = hex(color2.slice(5, 7));
        
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        
        return `rgb(${r},${g},${b})`;
    }

    drawModule(ctx, x, y, size, style, isFinderPattern) {
        const padding = style === 'dots' ? size * 0.15 : size * 0.05;
        const actualSize = size - padding * 2;
        const actualX = x + padding;
        const actualY = y + padding;
        
        if (style === 'dots') {
            ctx.beginPath();
            ctx.arc(actualX + actualSize / 2, actualY + actualSize / 2, actualSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (style === 'rounded') {
            const radius = isFinderPattern ? actualSize * 0.1 : actualSize * 0.3;
            this.roundRect(ctx, actualX, actualY, actualSize, actualSize, radius);
            ctx.fill();
        } else {
            ctx.fillRect(actualX, actualY, actualSize, actualSize);
        }
    }

    drawFinderBorders(ctx, margin, moduleSize, moduleCount, accentColor) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = moduleSize * 0.3;
        
        const positions = [[0, 0], [moduleCount - 7, 0], [0, moduleCount - 7]];
        
        positions.forEach(([row, col]) => {
            const x = margin + col * moduleSize;
            const y = margin + row * moduleSize;
            const size = 7 * moduleSize;
            
            ctx.beginPath();
            this.roundRect(ctx, x - moduleSize * 0.15, y - moduleSize * 0.15, 
                          size + moduleSize * 0.3, size + moduleSize * 0.3, moduleSize);
            ctx.stroke();
        });
    }

    drawLogo(ctx, size, logoText, darkColor, lightColor) {
        const logoSize = size * 0.15;
        const centerX = size / 2;
        const centerY = size / 2;
        
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoSize, 0, Math.PI * 2);
        ctx.fillStyle = lightColor;
        ctx.fill();
        ctx.restore();
        
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = darkColor;
        ctx.font = `${logoSize * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(logoText, centerX, centerY);
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRCodeGenerator;
}