# PROJETO: CÓDIGO CARTIER (V2.0)

**Tipo:** Aplicação Web (HTML/JS/CSS) de Criptografia Musical para RPG.

## 1. Regras de Negócio (NÃO ALTERAR)

- **Escala:** Lá Menor Natural (A Minor). Apenas teclas brancas (sem sustenidos/bemóis).
- **Mapeamento:** Letras A-Z mapeadas para notas musicais.
- **Áudio:** Usa `Tone.js`.
  - **Controle:** O áudio é gerenciado pelo `Tone.Transport` (Play/Stop/Pause). Nunca use apenas `play()`, use `Tone.Transport.start()` e agende notas.
  - **Pausas:** Espaços e quebras de linha geram silêncio na reprodução.

## 2. Interface (TailwindCSS)

- **Tema:** Dark Mode (Slate-900 / Amber-500).
- **Componentes Chave:**
  - **Toggle Deslizante (Slider):** Seletor de instrumentos no header (`max-w-[400px]`) com fundo laranja deslizante e animação suave.
  - **Menu Copiar:** Funciona por CLIQUE (`onclick="toggleCopyMenu"`), posicionado abaixo do botão.
  - **Modo Sigilo:** Classes `.secret-mode` (blur no input) e `.secret-output` (esconde dicas `.decrypted-hint` com `opacity: 0 !important`).
  - **Botão Mute:** Alterna o estado global do áudio (`Tone.Destination.mute`).

## 3. Estrutura de Arquivos

- `index.html`: Estrutura única. Seções: Header, Cifrar (`#panel-encrypt`), Decifrar (`#panel-decrypt`), Manual (`#panel-legend`).
- `script.js`: Lógica principal.
  - `encryptText`: Gera visualização multi-linhas ("Partitura 1", "Partitura 2").
  - `setInstrument`: Gerencia classes visuais do slider e troca de sampler.
  - `playSequence`: Usa `Tone.Transport.schedule` para tocar a cifra gerada.
- `style.css`: Ajustes finos (scrollbar, blur, transições de teclas).

## 4. Estado Atual (Funcionalidades V2 Completas)

- Layout da aba "Cifrar" finalizado: sem título redundante "Partitura Resultante", botões de ação alinhados à direita.
- Slider de instrumentos responsivo e visualmente ajustado.
- Sistema de áudio robusto (não sobrepõe sons ao trocar abas/instrumentos).

---

## 5. Próxima Fase: Renovação da Aba Decifrar (A Fazer)

**Objetivo:** Transformar a decifragem em uma experiência imersiva de revelação.

### Requisitos Técnicos:

1.  **Renomeação:** Aba "Decifrar (Ler)" passa a ser **"Decifrar (Revelar)"**.
2.  **Entrada de Cifra:** Adicionar um `textarea` no topo da seção para colar o código (ex: "A2 C3 | F4").
3.  **Botão "Ouvir & Revelar" (`revealCode`):**
    - Deve ler o código colado.
    - Tocar as notas sequencialmente via `Tone.Transport`.
    - **Efeito Visual:** As letras decifradas aparecem no campo de resultado uma a uma, sincronizadas com o som.
4.  **Dicas (Cola):** Devem iniciar **OCULTAS** (`false`) por padrão.
5.  **Edição:** Substituir botão "Limpar" por "Apagar Última" (Backspace).

## 6. Fase 3 (Refinamento): Decifrar V2.1

**Objetivo:** Corrigir a visualização do texto decifrado e melhorar a UX de textos longos.

### Regras de Negócio (Atualizadas):

1.  **Espaços Visuais:** Na função `revealCode`, o caractere `|` (barra) no input cifrado deve ser traduzido explicitamente como um espaço em branco (` `) no campo de resultado.
    - _Atualmente:_ Ele soma tempo no áudio, mas não adiciona o espaço visualmente.
2.  **Quebra de Linha Automática:** O campo de resultado (`#decrypt-output`) deve ser um `textarea` ou uma `div` com `flex-wrap`, e não um `input` de linha única, para suportar textos longos sem rolagem horizontal infinita.
3.  **Separação de Palavras:** O sistema deve identificar visualmente a separação entre palavras decifradas para facilitar a leitura.

### Requisitos Técnicos:

- **HTML:** Trocar `<input id="decrypt-output">` por um `<textarea readonly>` com altura automática ou fixa com scroll.
- **JS (`revealCode`):** Quando encontrar o token `|`, adicionar `" "` (espaço) ao `value` do output.
- **CSS:** Garantir que a fonte do resultado seja monoespaçada para manter o alinhamento.

## 7. Fase 3.1: Refinamento do Decifrar (A FAZER AGORA)

**Objetivo:** Suportar textos longos, quebras de linha e cópia fácil na aba de revelação.

### Requisitos Técnicos:

1.  **Textarea no Resultado:**

    - Substituir o `<input id="decrypt-output">` por um `<textarea id="decrypt-output" rows="3">`.
    - Deve permitir quebra de linha automática (wrap) para textos longos não sumirem na lateral.
    - Remover barra de rolagem horizontal se houver.

2.  **Espaços Visuais (`revealCode`):**

    - Na função `revealCode`, quando o loop encontrar o caractere `|` (barra), ele deve adicionar um espaço em branco (`" "`) ao valor do textarea, além de agendar a pausa no áudio.
    - _Atualmente:_ Ele só faz a pausa no áudio e cola as letras juntas.

3.  **Botão Copiar Texto:**
    - Adicionar um botão "Copiar Texto" ao lado do botão "Apagar Última" na aba Decifrar.
    - Criar função JS `copyDecryptedText()` que copia o conteúdo do `#decrypt-output`.

## 8. Fase 3.2: Harmonização do Decifrar

**Objetivo:** Alinhar o design da aba Decifrar com a aba Cifrar e corrigir a formatação do texto revelado.

### Requisitos de Layout (HTML/CSS):

1.  **Reposicionamento:** O campo de entrada de código (`#decrypt-input`) deve ser movido para ficar visualmente consistente, talvez acima do resultado mas com menos destaque, ou seguir o fluxo: _Input -> Botão Revelar -> Resultado_.
2.  **Estilo do Resultado:** O `#decrypt-output` deve se parecer mais com o container de partituras da aba Cifrar (fundo escuro, borda sutil), garantindo leitura confortável.
3.  **Piano:** Deve permanecer acessível abaixo de tudo para quem quiser decifrar manualmente nota por nota.

### Requisitos de Lógica (JS):

1.  **Quebra de Linha Real:** A função `revealCode` deve detectar quebras de linha (`\n`) no input cifrado e replicá-las no output decifrado.
    - _Lógica sugerida:_ Ao processar os tokens, se encontrar uma quebra de linha original, inserir `\n` no valor do textarea de resultado.
2.  **Espaços:** Continuar respeitando o caractere `|` como espaço em branco (` `).

### Meta Final:

O usuário deve poder colar um bloco de texto cifrado com várias linhas e ver o resultado decifrado mantendo a mesma estrutura de parágrafos.

## 9. Fase 3.3: Refinamento de Quebra de Linha (Decifrar)

**Problema:** O texto revelado está ignorando as quebras de linha originais do código cifrado, juntando parágrafos.

### Requisitos Técnicos (JS - `revealCode`):

1.  **Preservação de Linhas:** A função deve ler o input e processar linha por linha, em vez de tratar tudo como um "sopão" de tokens.
2.  **Lógica Sugerida:**
    - Dividir o input bruto por quebras de linha (`\n`).
    - Para cada linha do input, processar as notas e adicionar as letras correspondentes no output.
    - Ao final de cada linha processada, adicionar explicitamente um `\n` no output (se não for a última linha).
3.  **Visual:** O `textarea` de resultado deve refletir essas quebras (o que já faz por padrão).

### Meta:\*\*

Input Cifrado:
Line 1...
Line 2...

Output Revelado:
Texto 1...
Texto 2...

## 10. Fase 3.4: Ajustes de Fluxo e Correções Críticas (Decifrar)

**Objetivo:** Corrigir bugs de duplicação de texto, melhorar a cópia de formatação e adicionar controles de reprodução.

### Correções de Bugs (Prioridade Alta):

1.  **Letras Duplicadas (`revealCode`):**
    - _Sintoma:_ O texto revelado às vezes duplica caracteres (ex: "GENNTE" em vez de "GENTE").
    - _Causa Provável:_ O callback visual do `Tone.Transport` ou `Tone.Draw` está sendo disparado mais de uma vez por nota.
    - _Solução:_ Refatorar a lógica de agendamento visual para garantir que cada nota dispare a escrita da letra exatamente uma vez.
2.  **Cópia de Cifra (Quebra de Linha):**
    - _Sintoma:_ Ao copiar a cifra gerada, os parágrafos (linhas vazias) são perdidos.
    - _Solução:_ A função `copyToClipboard` deve preservar linhas vazias explicitamente ao processar o texto.

### Novas Funcionalidades:

1.  **Botão "Pular Animação" (Acelerar):**
    - Adicionar um botão "Pular" que aparece apenas durante a revelação (`isPlaying = true`).
    - _Ação:_ Para o áudio imediatamente (`Tone.Transport.stop()`), cancela o agendamento e preenche o `#decrypt-output` instantaneamente com o texto completo traduzido.
2.  **Botão "Enter" (Teclado Virtual):**
    - Adicionar um botão de "Quebra de Linha" (ícone de Enter ↵) junto às teclas do piano virtual ou na barra de ferramentas do Decifrar, para permitir formatação manual.

## 11. Fase 3.5: Correção de Duplicação e Formatação (Prioridade Máxima)

**Problema:** A animação de revelação (`revealCode`) está duplicando caracteres visualmente (ex: "GENNTE"). Além disso, a cópia da cifra ignora quebras de linha.

### Solução Técnica (JS):

1.  **Animação de Texto:** Substituir `Tone.Draw` por `setTimeout` para a escrita das letras.
    - _Motivo:_ `Tone.Draw` pode disparar múltiplos callbacks em alguns loops de renderização. `setTimeout` baseado no tempo acumulado é atômico e seguro.
    - _Lógica:_ Calcular o tempo exato em ms (`currentTime * 1000`) e agendar a inserção da letra.
    - _Limpeza:_ Armazenar os IDs dos timeouts em um array `revealTimeouts` e limpá-los ao parar/pular.
2.  **Botão Pular:** A função `skipReveal` deve limpar os timeouts pendentes e definir o valor do output imediatamente com o texto completo traduzido.
3.  **Cópia de Cifra (`copyToClipboard`):** O loop de processamento deve respeitar explicitamente as linhas vazias ou quebras de linha do input original, inserindo `\n` no texto copiado.
