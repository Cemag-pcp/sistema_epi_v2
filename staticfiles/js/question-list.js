// Converte um texto colado (ex.: lista copiada de um PDF) em uma lista de perguntas.
//
// Aceita itens numerados ("1 Texto", "2. Texto", "3) Texto", "4 - Texto"), com marcadores
// ("- Texto", "• Texto") ou simplesmente uma pergunta por linha. Ao copiar de PDF é comum:
//   - a pergunta quebrar em duas linhas (a 2ª linha vira continuação da anterior);
//   - o número ficar sozinho numa linha e o texto vir na seguinte.
const BULLET = /^[•·▪●○◦*\-–—]\s+(.*)$/;
// Número seguido de separador/espaço. "12V" e "3.5" (decimal) não contam como numeração.
const NUMBER = /^(\d{1,3})(?:\s*(?:\.(?!\d)|[):]|[\-–—](?!\d))\s*|\s+|$)(.*)$/;

export function parseQuestionList(raw) {
    const lines = String(raw ?? '')
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    // Só junta linhas de continuação se houver marcadores; sem eles, cada linha é uma pergunta
    const hasMarkers = lines.some(line => BULLET.test(line) || NUMBER.test(line));

    const items = [];
    let lastNumber = null;

    for (const line of lines) {
        const bullet = line.match(BULLET);
        if (bullet) {
            items.push(bullet[1]);
            continue;
        }

        const numbered = line.match(NUMBER);
        if (numbered) {
            const number = Number(numbered[1]);
            const text = numbered[2];
            // Numeração em sequência (ou reinício em 1) abre uma nova pergunta. Um número fora de
            // sequência só abre se o texto começar em maiúscula ou estiver vazio; senão é parte
            // da frase anterior (ex.: "10 mm de folga").
            const startsItem =
                lastNumber === null ||
                number === lastNumber + 1 ||
                number === 1 ||
                (number > lastNumber && (text === '' || /^\p{Lu}/u.test(text)));
            if (startsItem) {
                items.push(text);
                lastNumber = number;
                continue;
            }
        }

        if (hasMarkers && items.length) {
            items[items.length - 1] = `${items[items.length - 1]} ${line}`.trim();
        } else {
            items.push(line);
        }
    }

    return items.map(item => item.trim()).filter(Boolean);
}

// Retorna true se o texto colado tem mais de uma linha (candidato a lista de perguntas)
export function isMultilineText(text) {
    return /\n/.test(String(text ?? '').replace(/\r/g, '').trim());
}
