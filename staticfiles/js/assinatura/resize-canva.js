export function resizeCanvas(canvas, signaturePad) {
    if (!signaturePad) return;

    const ratio = Math.max(1, 1);

    // Tamanho antigo
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    // Tamanho novo
    const newWidth = canvas.offsetWidth * ratio;
    const newHeight = canvas.offsetHeight * ratio;

    // Salva os dados da assinatura (strokes)
    const signatureData = signaturePad.isEmpty() ? null : signaturePad.toData();

    // Redimensiona o canvas
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);

    // Reescala e redesenha
    if (signatureData) {
        const scaleX = newWidth / oldWidth;
        const scaleY = newHeight / oldHeight;

        // Ajusta todos os pontos proporcionalmente
        const scaledData = signatureData.map(stroke => ({
            ...stroke,
            points: stroke.points.map(point => ({
                ...point,
                x: point.x * scaleX,
                y: point.y * scaleY
            }))
        }));

        signaturePad.clear();
        signaturePad.fromData(scaledData);
    } else {
        signaturePad.clear();
    }
}
