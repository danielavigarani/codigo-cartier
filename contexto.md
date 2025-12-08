# PROJETO: CÓDIGO CARTIER (V2.0)
**Tipo:** Aplicação Web (HTML/JS/CSS) de Criptografia Musical para RPG.

## 1. Regras de Negócio (NÃO ALTERAR)
- **Escala:** Lá Menor Natural (A Minor). Apenas teclas brancas (sem sustenidos/bemóis).
- **Mapeamento:** Letras A-Z mapeadas para notas musicais.
- **Áudio:** Usa `Tone.js`.
  - **Importante:** O áudio é controlado pelo `Tone.Transport` (Play/Stop/Pause). Nunca use apenas `play()`, use `Tone.Transport.start()` e agende notas.
  - **Pausas:** Espaços e quebras de linha geram silêncio.

## 2. Interface (TailwindCSS)
- **Tema:** Dark Mode (Slate-900 / Amber-500).
- **Componentes Chave:**
  - **Toggle Deslizante:** Um seletor de instrumentos no header que desliza um fundo laranja (`#instrument-slider`).
  - **Menu Copiar:** Funciona por CLIQUE (`onclick="toggleCopyMenu"`), não por hover.
  - **Modo Sigilo:** Classe `.secret-mode` e `.secret-output` que borram o texto e escondem as dicas (`.decrypted-hint`) com `opacity: 0 !important`.

## 3. Estrutura de Arquivos
- `index.html`: Estrutura única.
- `script.js`: Toda a lógica. Funções principais: `encryptText`, `playSequence`, `setInstrument`.
- `style.css`: Ajustes finos que o Tailwind não cobre (ex: scrollbar, animações de blur).

## 4. Estado Atual (V2)
- O layout de "Partitura Resultante" não tem título, apenas botões alinhados à direita.
- O slider de instrumentos é responsivo (`max-w-[400px]`).