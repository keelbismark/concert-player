/**
 * QR Code Generator
 * Uses qrcode-generator library
 */
class QRCodeGenerator {
    generate(canvas, text, options = {}) {
        const size = options.size || 200;
        const colorDark = options.colorDark || '#000000';
        const colorLight = options.colorLight || '#ffffff';
        const colorAccent = options.colorAccent || colorDark;

        try {
            // Проверяем доступность библиотеки
            if (typeof qrcode !== 'function') {
                throw new Error('qrcode-generator library not loaded');
            }

            // Создаём QR код (Type 0 = auto, L = low error correction)
            const qr = qrcode(0, 'L');
            qr.addData(text);
            qr.make();

            const moduleCount = qr.getModuleCount();
            const tileSize = size / moduleCount;

            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            // Фон
            ctx.fillStyle = colorLight;
            ctx.fillRect(0, 0, size, size);

            // Модули
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        const isFinder = this.isFinderPattern(row, col, moduleCount);
                        ctx.fillStyle = isFinder ? colorAccent : colorDark;

                        const x = Math.floor(col * tileSize);
                        const y = Math.floor(row * tileSize);
                        const w = Math.ceil(tileSize);
                        const h = Math.ceil(tileSize);
                        
                        ctx.fillRect(x, y, w, h);
                    }
                }
            }
            
            // Логотип
            if (options.logoText) {
                this.drawLogo(ctx, size, options.logoText, colorLight);
            }

            console.log('QR generated for:', text);

        } catch (e) {
            console.error("QR Generation Error:", e);
            
            // Fallback: показываем ошибку
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;
            
            ctx.fillStyle = '#1a1d24';
            ctx.fillRect(0, 0, size, size);
            
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('QR Error', size/2, size/2 - 10);
            
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.fillText(e.message || 'Unknown error', size/2, size/2 + 10);
        }
    }

    isFinderPattern(row, col, moduleCount) {
        const size = 7;
        // Верхний левый
        if (row < size && col < size) return true;
        // Верхний правый
        if (row < size && col >= moduleCount - size) return true;
        // Нижний левый
        if (row >= moduleCount - size && col < size) return true;
        return false;
    }

    drawLogo(ctx, size, text, bgColor) {
        const fontSize = size * 0.12;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const metrics = ctx.measureText(text);
        const padding = fontSize * 0.5;
        
        // Белая подложка
        ctx.fillStyle = bgColor;
        ctx.fillRect(
            size/2 - metrics.width/2 - padding,
            size/2 - fontSize/2 - padding/2,
            metrics.width + padding * 2,
            fontSize + padding
        );
        
        // Текст
        ctx.fillStyle = '#1a1d24';
        ctx.fillText(text, size / 2, size / 2);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRCodeGenerator;
}