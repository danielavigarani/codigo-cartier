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
