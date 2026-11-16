# PROJETO: CÓDIGO CARTIER (V3.0 — Symphonic Edition)

**Tipo:** Aplicação Web PWA (React 19 + TypeScript + Vite + Tailwind CSS) de Criptografia Musical para RPG.

## 1. Regras de Negócio & Cifra

- **Associação Sol & Lua (RPG):**
  - **Modo Lua:** Lá Menor Natural (`A, B, C, D, E, F, G`) — apenas teclas brancas. Voz padrão: **Piano** (`voz=piano`, Priya). Paleta `#060814` / prata `#CBD5E1` / ciano.
  - **Modo Sol:** Lá Maior (`C#, F#, G#` pela armadura de clave) — a cifra escrita continua usando `A–G`, mas `C`, `F` e `G` soam sustenidos (`C#`, `F#`, `G#`). Voz padrão: **Harpa de Concerto (Harpa Astral)** (`voz=harp`, Gabriela; códigos legados `voz=cello` continuam compatíveis mapeando para `harp`). Paleta `#110D0A` / ouro Cartier `#D4AF37` / âmbar.
  - **Modo Eclipse:** ambas as vozes (`piano` + `harp`) durante Sinfonia de Câmara ou Sessão / Dueto.
- **Versões da Cifra:**
  - **v2 (Padrão, SPN Real):** oitava muda no Dó (`A=A2, B=B2, C=C3..I=B3, J=C4..P=B4, Q=C5..W=B5, X=C6..E6`).
  - **v1 (Legado `script.js`):** oitava muda no Lá (`A=A2..G=G2, H=A3..N=G3, O=A4..U=G4, V=A5..E5`).
- **Formato & Regras Invioláveis:**
  - Cabeçalho: `#cartier v2 modo=lua voz=piano` (ou `v1`, `sol`, `harp`).
  - `|` = espaço entre palavras; acentos NFD e pontuações descartados; linhas vazias preservadas.
  - Exatamente 1 nota lógica por letra; sem ornamentos nem appoggiaturas.
  - Ritmo determinístico (`RhythmParser.ts`): vogal `4n`, consoante `8n`, fim de palavra pontuada, `|` `8r`, fim de linha `2n.`, compassos exatos em `4/4` e `3/4` com `tie` entre compassos.
  - Harmonia Viterbi (`HarmonyEngine.ts`): regra estrita do `G#` (no Modo Lua, `E`/`E7` proibido quando há `G` natural na melodia); acompanhamento apenas no playback (nunca na partitura exportada).
  - Áudio (`AudioEngine.ts`): samples locais em `public/samples/piano/` (Salamander, CC-BY 3.0) e `public/samples/harp/` (`tonejs-instruments` Concert Harp, 18 amostras `D2–B6`, CC-BY 3.0), cadeia master com `Reverb`, `Compressor`, `Analyser` e controle global de volume (`0%–100%`) no cabeçalho; **Harpa Astral** com `EQ3` acústico (`220 Hz +2.5dB`, `4.2 kHz +2dB`), delay cristalino em `8n.`, sustain orgânico (`1.45x`, `release: 1.9s`) e suporte a **Glissando Astral**; relógio único `Tone.getTransport()` + `requestAnimationFrame` (zero `setTimeout` na revelação), parando sempre ao trocar aba/instrumento/modo.
  - Exportação/Importação (`src/export/`): PDF vetorial ("Edição Manuscrito" via VexFlow SVG + `svg2pdf.js` + `jspdf`, sem `html2canvas`) com metadados `lz-string` + SHA-256, importação via `pdfjs-dist` (sem OMR), MIDI (`@tonejs/midi`), MusicXML, PNG, link `#c=...` e PWA offline (`vite-plugin-pwa`).
  - Sessão / Dueto (`DuetSession.tsx`): conversa a duas vozes persistida em `localStorage` e exportável/importável em JSON.

## 2. Estado Final (Fases 1 a 6 Concluídas)

- **Fase 1 (Concluída):** Setup React 19 + TypeScript + Vite + Tailwind + fontes locais `@fontsource` + `cipher.ts` (v1 & v2).
- **Fase 2 (Concluída):** `seed.ts`, `RhythmParser.ts`, `HarmonyEngine.ts`, `AudioEngine.ts`, samples locais e `CREDITS.md`.
- **Fase 3 (Concluída):** `VexFlowScore.tsx` (Pauta Dupla) e `GrandPiano.tsx` (A2–E6 + pretas + Web MIDI).
- **Fase 4 (Concluída):** `SunMoonThemeContext.tsx`, `EclipseHeader.tsx`, `ComposerTab.tsx`, `DecoderTab.tsx`, `TheoryGrimoire.tsx`.
- **Fase 5 (Concluída):** `pdf.ts`, `PdfScoreModal.tsx`, `midi.ts`, `musicxml.ts`, `png.ts`, `share.ts`, PWA offline.
- **Fase 6 (Concluída):** `DuetSession.tsx`, remoção dos arquivos legados (`script.js`, `style.css`), testes completos e build final validado.

## 3. Direitos Autorais
- Direitos reservados por **Daniela Vigarani** (interpreta Bibi) & **Bah Duarte** (interpreta Pripri).
