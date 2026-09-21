// Rascunho da inspeção salvo no aparelho, para não perder o preenchimento ao recarregar a página
// (ou quando o navegador do celular descarta a aba). Usa IndexedDB, que comporta as fotos;
// se ele não estiver disponível, cai para o localStorage (sem as fotos se estourar a cota).
const DB_NAME = 'checklist-rascunhos';
const STORE = 'rascunhos';

function abrirBanco() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function transacao(modo, operacao) {
    const db = await abrirBanco();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, modo);
        const request = operacao(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
}

function lerLocal(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave)) || null;
    } catch (error) {
        return null;
    }
}

function salvarLocal(chave, dados) {
    try {
        localStorage.setItem(chave, JSON.stringify(dados));
    } catch (error) {
        // Cota estourada: guarda ao menos textos e respostas
        try {
            const semFotos = { ...dados, respostas: {} };
            Object.entries(dados.respostas).forEach(([id, r]) => { semFotos.respostas[id] = { ...r, fotos: [] }; });
            localStorage.setItem(chave, JSON.stringify(semFotos));
        } catch (erroFinal) {
            console.warn('Não foi possível salvar o rascunho:', erroFinal);
        }
    }
}

export function criarRascunho(chave) {
    return {
        async carregar() {
            try {
                const salvo = await transacao('readonly', store => store.get(chave));
                return salvo || lerLocal(chave);
            } catch (error) {
                return lerLocal(chave);
            }
        },
        async salvar(dados) {
            try {
                await transacao('readwrite', store => store.put(dados, chave));
                localStorage.removeItem(chave);
            } catch (error) {
                salvarLocal(chave, dados);
            }
        },
        async limpar() {
            try {
                await transacao('readwrite', store => store.delete(chave));
            } catch (error) {
                // sem IndexedDB: só resta o localStorage
            }
            try {
                localStorage.removeItem(chave);
            } catch (error) {
                // localStorage indisponível
            }
        },
    };
}
