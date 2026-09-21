// Módulo independente (sem depender do scripts.js compartilhado, que o navegador pode ter em cache).

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Reduz a foto (lado maior <= maxSide, JPEG) e devolve como data URL.
// Fotos de celular passam de vários MB e estouram o limite da requisição JSON;
// se não for possível comprimir (ex.: GIF, formato não decodificável), devolve o original.
export async function compressImage(file, maxSide = 1280, quality = 0.6) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return fileToDataUrl(file);
    }
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // PNG com transparência viraria preto no JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (bitmap.close) bitmap.close();

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.size >= file.size) return fileToDataUrl(file);
        return fileToDataUrl(blob);
    } catch (error) {
        console.warn('Não foi possível comprimir a imagem, enviando o original:', error);
        return fileToDataUrl(file);
    }
}
