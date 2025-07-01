export function resizeCanvas(canvas, signaturePad) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        signaturePad.clear(); // Limpa a assinatura existente
    }
}
