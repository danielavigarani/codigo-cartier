# Código Cartier v3 — Symphonic Edition
## Prompt único de arquitetura e implementação (para o Antigravity IDE)

> **Para a Dani (apague este bloco antes de enviar, se quiser).**
>
> **Como usar:** abra a pasta do repositório no Antigravity, anexe este arquivo e escreva: *"Leia este arquivo inteiro e o repositório. Execute somente a Fase 1 e pare para eu validar."* Repita fase por fase (seção 14).
>
> **Decisões que assumi e você pode trocar:**
> 1. Violoncelo = Lua e piano = Sol (seção 10). Se no RPG for o contrário, inverta.
> 2. Códigos novos saem em **v2** (oitava no Dó, padrão internacional). A **v1** continua disponível como legado (seção 2).
> 3. A Fase 6 (Sessão/Dueto) é opcional. Só vale fazer depois que as fases 1 a 5 estiverem estáveis.

---

# PROMPT

Atue como Engenheiro Frontend Principal, Designer de UI/UX cinematográfico e Especialista em Computação Musical (Web Audio API e teoria musical). Sua missão é evoluir o app **Código Cartier**, hoje em HTML/CSS/JS puro, para uma aplicação web de nível extremo em **React 19 + TypeScript + Vite + Tailwind CSS**, com música de verdade, partitura de verdade e uma direção de arte misteriosa baseada na dualidade **Sol & Lua**.

O app é uma ferramenta de criptografia musical para um RPG de mesa: duas primas, ambas letradas em música, trocam mensagens em "códigos de sinfonia". Cada letra do alfabeto vira uma nota. Uma toca violoncelo (Gabriela) e a outra toca piano (Priya).

## 0. Contexto real do projeto — LEIA ANTES DE PLANEJAR

O repositório já existe e tem `index.html`, `script.js`, `style.css`, `background.svg` e `contexto.md`. **Leia `contexto.md` e `script.js` inteiros antes de escrever qualquer plano.**

Não reconstrua ignorando o que existe. Faça primeiro um **port com paridade total** e só depois evolua. Funcionalidades atuais que DEVEM ser preservadas:

- Cifrar com várias linhas, cada uma exibida como "Partitura 1, 2…".
- Remoção de acentos ao cifrar (normalização NFD). Qualquer caractere fora de A–Z e espaço é descartado.
- `|` = espaço entre palavras. Quebras de linha do texto original são preservadas no decifrar.
- Menu "Copiar" com dois formatos: completo (`C4 (Q)`) e só notas (`C4`). Linhas vazias preservadas.
- **Modo Sigilo** (blur no texto digitado e esconde as letras sob as notas) e **"Cola"** (dicas de letra nos botões do piano), que começa **oculta** por padrão.
- Aba Decifrar: colar código, "Ouvir & Revelar" com as letras surgindo em sincronia com o som, "Pular animação", "Apagar última", "Copiar texto", botão de quebra de linha (Enter) e piano virtual que digita a letra da tecla clicada.
- Seletor de instrumento Piano/Violoncelo, botão Mute, aviso "Ative o áudio" (o áudio só inicia após gesto do usuário).
- Ao trocar de aba ou de instrumento, o áudio para. Nunca pode haver sons sobrepostos.
- Rodapé: **"Direitos reservados por Daniela Vigarani (interpreta Bibi) & Bah Duarte (interpreta Pripri)"**.

Ao final de cada fase, **atualize o `contexto.md`** com as novas regras de negócio e o estado atual. Ele é a memória do projeto.

## 1. Stack e setup

- **Core:** React 19, TypeScript, Vite, Tailwind CSS (use a configuração oficial para Vite da versão instalada).
- **Animação e ícones:** `framer-motion`, `lucide-react`.
- **Áudio e teoria:** `tone` (Tone.js) e `tonal` (Tonal.js, para notas, escalas, acordes e transposição).
- **Partitura:** `vexflow`.
- **PDF e exportação:** `jspdf` + `svg2pdf.js` (PDF vetorial a partir do SVG do VexFlow), `pdfjs-dist` (ler PDF), `@tonejs/midi` ou `midi-writer-js` (MIDI), `lz-string` (comprimir código para link e metadados).
- **Fontes locais (sem CDN):** `@fontsource/cormorant-garamond`, `@fontsource/cinzel-decorative`, `@fontsource/plus-jakarta-sans`, `@fontsource/jetbrains-mono`.
- **Testes:** `vitest`. **Utilitários:** `clsx`, `tailwind-merge`.

Setup sugerido:

```bash
npm create vite@latest . -- --template react-ts
npm install tone tonal vexflow framer-motion lucide-react jspdf svg2pdf.js pdfjs-dist lz-string clsx tailwind-merge
npm install -D vitest
```

**Regra de ouro para bibliotecas:** fixe versões exatas e consulte a documentação da versão instalada, nunca a memória. O VexFlow 5, por exemplo, mudou API e carregamento de fontes. Se uma API não existir, diga e proponha alternativa. Não invente.

## 2. A cifra: versões, formato e compatibilidade

### 2.1 Tabelas

**v1 (legado — exatamente o que está no `script.js` hoje; a oitava vira no Lá):**

```
A=A2  B=B2  C=C2  D=D2  E=E2  F=F2  G=G2
H=A3  I=B3  J=C3  K=D3  L=E3  M=F3  N=G3
O=A4  P=B4  Q=C4  R=D4  S=E4  T=F4  U=G4
V=A5  W=B5  X=C5  Y=D5  Z=E5
```

Problema: A2 e B2 ficam acima de C2–G2, então a altura real forma um serrote (B2→C2 desce uma sétima maior, G2→A3 sobe uma nona maior).

**v2 (nova — SPN real, a oitava muda no Dó; escala ascendente de A2 a E6):**

```
A=A2  B=B2  C=C3  D=D3  E=E3  F=F3  G=G3
H=A3  I=B3  J=C4  K=D4  L=E4  M=F4  N=G4
O=A4  P=B4  Q=C5  R=D5  S=E5  T=F5  U=G5
V=A5  W=B5  X=C6  Y=D6  Z=E6
```

Só 8 letras (A, B, H, I, O, P, V, W) têm o mesmo nome de nota nas duas versões. As outras 18 mudam. Por isso a versão precisa viajar com o código.

### 2.2 Formato do código copiado

- Primeira linha de cabeçalho: `#cartier v2 modo=lua voz=cello` (versão, modo Lua/Sol, voz do remetente). O parser ignora linhas que começam com `#`, mas as lê.
- Depois, tokens de nota separados por espaço, `|` entre palavras, uma linha de texto por linha de código.
- **Detecção sem cabeçalho:** qualquer token em {C2, D2, E2, F2, G2} indica v1. Qualquer token em {F5, G5, C6, D6, E6} indica v2. Caso ambíguo: usar o seletor manual de versão (Lua/Sol não afeta a detecção).
- Padrão para código novo: v2. A v1 fica sempre acessível ("Modo Legado v1") para decifrar mensagens antigas do Discord e do caderno.
- Token inválido no decifrar: **destacar em vermelho**, nunca ignorar em silêncio.

### 2.3 Testes obrigatórios (Vitest)

- Round-trip texto → código → texto para v1 e v2, incluindo acentos, quebras de linha, linhas vazias e `|`.
- Parser de cabeçalho e detecção de versão.
- Mapeamento v1 idêntico ao `script.js` original (cole a tabela do script como fixture).

### 2.4 Correções de documentação

- O manual atual mostra "C#4" como exemplo de leitura, mas diz que não existem sustenidos. Remova o exemplo ou explique que sustenidos só existem no **Modo Sol** via armadura de clave, nunca na cifra.
- O manual diz "3 (Grave): A até L / 4: M até X / 5: Y e Z". Reescreva conforme a v2 e mantenha a v1 documentada como legado.

## 3. Regra de ouro: tudo que soa precisa ser decodificável

Quem decifra só tem o código colado (ou a partitura). Portanto:

1. A melodia tem **exatamente 1 nota por letra**. Proibido appoggiatura, notas de graça, trinados ou qualquer nota extra na linha da melodia.
2. **Ritmo, dinâmica e articulação** derivam **somente** da letra e da estrutura do código: vogal ou consoante, posição na palavra, `|`, fim de linha. Assim cifradora e decifradora ouvem a mesma música.
3. **Acento e pontuação são descartados no cifrar**, então não podem influenciar a música. Nada de vírgula virar meia-cadência ou interrogação virar acorde suspenso.
4. **Humanização determinística:** variações sutis de velocity usam um gerador pseudoaleatório com seed (hash do código + índice da nota). Nunca `Math.random()` no playback.
5. Notas ligadas por ligadura de prolongamento (tie) entre compassos contam como **uma** nota no código.

## 4. Motor de ritmo — `src/engine/RhythmParser.ts`

Converte o código decifrado em uma lista de eventos `{ letra, nota, inicio, duracao, velocity, compasso, tipo }` e em compassos reais (4/4 ou 3/4 valsa).

Valores iniciais (o agente pode ajustar para soar melhor, desde que sigam determinísticos e fiquem documentados no Grimório):

| Elemento | Figura |
|---|---|
| Vogal (A, E, I, O, U) | semínima (`4n`), com velocity um pouco maior |
| Consoante | colcheia (`8n`), velocity um pouco menor |
| Última letra de cada palavra | duração com ponto de aumento (respiração) |
| `|` (espaço entre palavras) | pausa de colcheia (`8r`) |
| Fim de linha | última nota em mínima pontuada + cadência (seção 5) + barra dupla final |

Regras de compasso:

- Agrupar eventos em compassos. Se um evento não cabe no que resta do compasso, dividir em duas figuras ligadas por tie. Completar o último compasso com pausas.
- Andamentos: **Adagio ≈ 66 bpm**, **Andante ≈ 84 bpm**, **Allegretto ≈ 112 bpm**. Fórmula de compasso: `4/4` ou `3/4`. O BPM ajusta o `Tone.Transport`, e as durações em notação (`4n`, `8n`) escalam sozinhas.
- Teste: a soma das durações de cada compasso é exatamente a fórmula de compasso.

## 5. Harmonia e orquestração — `src/engine/HarmonyEngine.ts`

**Princípio:** a harmonia existe **só no playback** (e como cifra de acorde sobre a partitura). Ela nunca entra na linha da melodia nem no código.

### 5.1 Tonalidades (Lua e Sol)

- **Modo Lua = Lá menor natural.** Todas as 26 notas são teclas brancas, então toda a melodia é diatônica. Tríades candidatas: Am, C, Dm, Em, F, G (e E ou E7 na cadência, ver 5.3).
- **Modo Sol = Lá Maior** (armadura de 3 sustenidos). Os nomes na cifra **não mudam**, mas C, F e G passam a **soar** C#, F# e G#. A armadura aparece na partitura e o código carrega `modo=sol` no cabeçalho. Não usar "Lá Lídio" (não é o mesmo que Lá Maior). Use o Tonal.js para derivar as tríades diatônicas da tonalidade.

### 5.2 Escolha dos acordes (nada de "a primeira nota decide")

Para cada compasso, escolher **1 acorde** (ou 2 em compassos longos) entre as tríades diatônicas, maximizando as notas da melodia contidas no acorde. Dar mais peso a tempos fortes e notas longas. Resolver o compasso a compasso com **Viterbi** (programação dinâmica), somando custo de transição que favoreça progressões funcionais (i → iv → V → i, i → VI → III → VII etc.) e penalize acordes repetidos em excesso e saltos de baixo grandes.

### 5.3 Cadência e a regra do G#

- Fim de linha: cadência V → i (Lua) ou V → I (Sol).
- **O G# do menor harmônico (E ou E7) só pode aparecer no acompanhamento, e somente se não houver G natural na melodia daquele compasso.** Havendo G natural, usar Em (ou Esus4 → Em → Am).

### 5.4 Texturas e modos de orquestração

- **Solo:** apenas a melodia.
- **Noturno:** melodia + arpejo suave de baixo contínuo (estilo Nocturne/Moonlight, oitavas 2 e 3).
- **Sinfonia de Câmara:** piano e violoncelo juntos. O violoncelo faz baixo e contracanto simples dentro do acorde, sem competir com a melodia.

### 5.5 Fiel × Suave

- **Fiel:** o som é exatamente a nota da partitura. Serve para quem decifra de ouvido.
- **Suave:** apenas no playback, cada nota é deslocada para a oitava mais próxima da anterior (máx. ±6 semitons) para reduzir saltos. A partitura e o piano visual continuam mostrando a nota cifrada real. O app avisa que, nesse modo, o som não serve para decifrar de ouvido.

## 6. Áudio — `src/engine/AudioEngine.ts`

- **O app já usa `Tone.Sampler` com samples reais** (piano Salamander e cello do repo `nbrosowsky/tonejs-instruments`). Não é para "trocar osciladores por samples". Melhore o que existe.
- **Baixe os samples para `/public/samples`** e cacheie (service worker/PWA). Nada de depender de CDN em runtime. Ao baixar, verifique a licença de cada conjunto e registre em `CREDITS.md`. Mostre progresso de carregamento.
- **Cello:** os samples atuais só vão até A4, e a v2 chega a E6, então as agudas ficam esticadas e artificiais. Cubra o registro com mais amostras, ou limite/transponha o registro do cello no playback e documente. Avalie uma biblioteca livre melhor (ex.: VSCO 2 Community Edition, CC0). Legato e vibrato reais não existem em `Sampler`: simule com release longo, velocity, leve chorus e reverb.
- **Piano:** manter Salamander. Para o timbre "íntimo" (modo Lua), permitir filtro passa-baixa suave e velocity menor.
- **Cadeia master:** `Reverb` (sala antiga/catedral, ajustável) → `FeedbackDelay` sutil → `Compressor` → `Destination`, mais um `Analyser` (FFT/waveform) para alimentar a UI.
- **Relógio único:** monte **um único array de eventos** e agende tudo no `Tone.Transport`. A UI (letras reveladas, cursor da partitura, tecla do piano, rotação do astrolábio) lê `Transport.seconds` num `requestAnimationFrame` e encontra o evento atual. **Proibido `setTimeout` paralelo.** Isso evita reintroduzir o bug antigo de letras duplicadas ("GENNTE") e permite pausar, parar e pular.
- Áudio inicia só após gesto do usuário (`Tone.start()`). Mute global. Parar o Transport e cancelar eventos ao trocar de aba, instrumento ou modo.

## 7. Partitura viva — `src/components/score/VexFlowScore.tsx`

- Pauta dupla (Clave de Sol + Clave de Fá). **A melodia ocupa a pauta e a clave troca sozinha em C4**, porque a v2 cruza o Dó central. Armadura de clave conforme o modo (Lua: sem acidentes; Sol: 3 sustenidos), fórmula de compasso, barras de compasso, figuras e pausas reais, ties.
- **Cifras de acorde** (Am, F, G…) escritas acima da pauta. **O acompanhamento NÃO é escrito em notas na partitura**, para quem lê saber que toda nota na pauta é letra.
- Cada linha do texto vira uma "Partitura N" (como no app atual).
- Renderização ao vivo enquanto a pessoa digita (com debounce). Responsiva: SVG escalável, recalcular quebra de sistemas com `ResizeObserver`.
- Durante o playback, um **cursor luminoso** percorre a partitura e destaca a cabeça da nota ativa (usar classes CSS nos elementos SVG).
- No Modo Sigilo, mascarar a partitura e as letras sob as notas (efeito de constelação/blur) até o usuário revelar.

## 8. PDF, exportação, importação e compartilhamento — `src/components/score/PdfScoreModal.tsx`

- **Exportar PDF "Edição Manuscrito":** folha de partitura clássica (papel pergaminho envelhecido ou estética Urtext), título de Opus **editável** com sugestão automática (ex.: "Opus XIV — Sonata do Eclipse em Lá Menor", derivado do modo e de um contador), nomes das compositoras editáveis, pauta completa, cifras de acorde. **PDF vetorial** via SVG do VexFlow + `svg2pdf.js` + `jspdf`. **Não usar `html2canvas`** (rasteriza e perde qualidade). Registrar fontes TTF no jsPDF para os títulos.
- **Metadados:** embutir no PDF o payload comprimido (`lz-string`, URI-safe) do código, mais um hash SHA-256 (Web Crypto) para verificação, e um rodapé discreto com o mesmo payload.
- **Importar PDF (aba Decifrar):** arrastar o PDF para uma área de soltar. O app lê os metadados e, se não achar, extrai o texto das páginas (`pdfjs-dist`) procurando o payload do Cartier. Mostra as páginas com zoom e modo pergaminho escuro. **NÃO implementar reconhecimento óptico de partitura (OMR).** Se não houver código embutido (print, impressão), oferecer colar o código ou o **Modo Leitura** (decifrar clicando no piano ou na pauta).
- **Outras exportações:** MIDI (melodia e, opcionalmente, acompanhamento em trilha separada), **MusicXML** (abre no MuseScore, só melodia e cifras) e **PNG** da partitura (para o Discord).
- **Link compartilhável:** código comprimido no hash da URL (`#c=...`). Abrir o link leva direto à aba Decifrar com o código preenchido. Sem backend, sem servidor, sem dados enviados a ninguém.

## 9. Piano interativo — `src/components/piano/GrandPiano.tsx`

- Faixa **A2–E6 (26 teclas brancas)** da v2, com **teclas pretas desenhadas** para o visual realista. As pretas ficam inertes no Modo Lua e **ativas no Modo Sol** (C#, F#, G#). Sem 88 teclas.
- Tecla afunda e ilumina (prata no Lua, ouro no Sol) com o playback da melodia (e, mais discreta, a do acompanhamento).
- Clicar nas teclas toca a nota e **digita a letra** no resultado (comportamento atual, com "Cola" opcional). Também aceitar o teclado do computador e, opcionalmente, controlador MIDI (Web MIDI API).
- Funciona com toque no celular.

## 10. Direção de arte — "O Observatório do Eclipse (Sol & Lua)"

Estética: relojoaria astral, astrolábios renascentistas, grimório musical, partitura antiga com folha de ouro, Dark Academia, mistério cósmico. Evitar o visual genérico de "dashboard escuro com dourado". Pense em objeto, não em template.

### 10.1 Sistema de tema — `SunMoonThemeContext`

| Estado | Quando | Paleta | Voz padrão |
|---|---|---|---|
| **Lua** | Cifrar / modo Lua | fundo `#060814`, prata lunar `#CBD5E1`, azul-cobalto profundo, brilho ciano/violeta etéreo, névoa estelar | violoncelo |
| **Sol** | Decifrar / modo Sol | fundo `#110D0A`, ouro Cartier `#D4AF37`, bronze, âmbar, feixes de luz volumétrica | piano |
| **Eclipse** | durante playback em Sinfonia de Câmara ou Dueto | Sol e Lua alinhados no topo, coroa solar que pulsa com o `Analyser` | as duas |

O tema muda por aba, mas deve poder ser forçado manualmente. Transições suaves com `framer-motion`.

### 10.2 Elementos assinatura

- **Astrolábio SVG desenhado à mão** (anéis, graduações, ponteiros), girando pela **posição do Transport** (progresso da peça), não apenas pelo volume. O `Analyser` controla o pulso e o brilho.
- **Eclipse no cabeçalho:** emblema animado Sol & Lua, também seletor de tema e de instrumento.
- **Ritual de revelação:** a mensagem chega "lacrada" com um **lacre de cera** e só se abre quando a cadência final resolve (opção "Revelação em suspense"; o botão "Pular" continua existindo).
- Letras reveladas surgem com efeito caligráfico, em sincronia com o som.
- **Tipografia:** títulos em `Cormorant Garamond` ou `Cinzel Decorative`, leitura em `Plus Jakarta Sans`, cifras em `JetBrains Mono`.
- Respeitar `prefers-reduced-motion` e oferecer um botão "reduzir efeitos". Partículas e animações pesadas com cuidado de performance.

## 11. Telas

### A. Cabeçalho astral e controles de sessão
Emblema Eclipse, seletor de tema, seletor de voz (Piano/Violoncelo), modo de orquestração (Solo / Noturno / Sinfonia de Câmara), Fiel/Suave, BPM (Adagio/Andante/Allegretto), compasso (`4/4` ou `3/4 Valsa`), tonalidade (Lá Menor Melancólico × Lá Maior Solar), seletor de versão da cifra (v2/v1), Mute.

### B. Aba "Cifrar (Compor Segredo)"
- Editor de texto com **Modo Público** e **Modo Sigilo** (que já existem).
- Tradução instantânea: notação científica formatada com barras de compasso e pausas, mais a **partitura viva**.
- Ações: **Tocar Sinfonia**, **Copiar** (completo / só notas, com cabeçalho), **Exportar PDF**, **Exportar MIDI/MusicXML/PNG**, **Copiar link**.

### C. Aba "Decifrar (Ouvir & Revelar)"
- Entrada: campo para colar o código, **área de soltar PDF**, abrir link compartilhado.
- Painel de revelação sincronizada, com Pular, Apagar última, Copiar texto, Enter e "Cola" (oculta por padrão).
- Partitura com cursor, piano interativo logo abaixo.
- Código inválido ou versão ambígua: mensagens claras, sem falhar em silêncio.

### D. Aba "Grimório & Teoria Musical"
- Dicionário interativo: clicar em qualquer nota ou célula da tabela toca o som real e mostra a posição na pauta e no piano.
- Explicações **corrigidas** de oitavas (v2 e legado v1), escalas Lua × Sol, regras rítmicas (vogal × consoante, fim de palavra, fim de linha) e a regra de que acento e pontuação são descartados.
- **Guia de leitura para a mesa de RPG**, incluindo como dizer as notas em voz alta e um **gerador de frases de interpretação** em PT-BR (tom sombrio e narrativo), que descreve a música na cena conforme voz, modo e andamento.
- Rodapé com os créditos originais (seção 0).

### E. Sessão / Dueto (Fase 6, opcional)
- Uma conversa é uma lista de mensagens. Cada mensagem tem remetente (voz) e código.
- "Tocar conversa": a conversa inteira vira uma peça a **duas vozes**, cada mensagem no instrumento de quem mandou. É o momento do Eclipse.
- Persistência só no navegador (`localStorage`) e exportar/importar sessão em JSON.

## 12. Estrutura de arquivos

```
src/
  types/music.ts                    # notas, compassos, eventos, configurações
  constants/cipherRules.ts          # tabelas v1 e v2, regras de detecção
  engine/
    cipher.ts                       # codificar/decodificar, cabeçalho, versão
    RhythmParser.ts                 # texto → eventos e compassos
    HarmonyEngine.ts                # acordes por compasso (Viterbi), texturas
    AudioEngine.ts                  # Tone.js, samplers, master, Transport
    seed.ts                         # hash e PRNG determinístico
  export/
    pdf.ts  midi.ts  musicxml.ts  share.ts   # PDF, MIDI, MusicXML, link
  context/SunMoonThemeContext.tsx
  components/
    layout/EclipseHeader.tsx
    cipher/ComposerTab.tsx
    cipher/DecoderTab.tsx
    score/VexFlowScore.tsx
    score/PdfScoreModal.tsx
    piano/GrandPiano.tsx
    grimoire/TheoryGrimoire.tsx
    session/DuetSession.tsx         # Fase 6
tests/                              # Vitest
public/samples/                     # samples locais
CREDITS.md
contexto.md
```

## 13. Qualidade, acessibilidade e deploy

- **Mobile-first.** Elas usam no celular e compartilham no Discord. Alvos de toque grandes.
- Acessibilidade: `aria-label` nas teclas e botões, foco visível, navegação por teclado, contraste adequado nos dois temas.
- Performance: carregar samples sob demanda e com progresso, `lazy` e code-splitting para VexFlow e `pdfjs-dist`.
- PWA/offline (`vite-plugin-pwa`) incluindo os samples.
- Deploy: build estático com `base` configurável para **GitHub Pages** (ou Vercel/Cloudflare Pages). Se quiser, inclua um workflow do GitHub Actions.
- Sem `TODO` e sem placeholders no que for entregue em cada fase.

## 14. Execução em fases

**Pare ao final de cada fase, descreva o que foi feito e espere a validação da Dani.**

| Fase | Escopo | Critério de aceite |
|---|---|---|
| **1** | Vite + React + TS + Tailwind com **paridade total** do app atual; módulo `cipher` com v1 e v2, cabeçalho, detecção, testes | `npm run build` limpo; testes passando; todas as funcionalidades da seção 0 funcionando; v1 idêntica ao `script.js` |
| **2** | `RhythmParser`, `HarmonyEngine`, `AudioEngine` com Transport único, samples locais, modos Solo/Noturno/Sinfonia, Fiel/Suave | playback musical, sem sobreposição; compassos fecham; G# respeitado; letras sincronizadas sem duplicar |
| **3** | `VexFlowScore` (pauta dupla, cifras, cursor) e `GrandPiano` (brancas e pretas) | partitura ao vivo e responsiva; cursor e piano sincronizados com o som |
| **4** | Tema Lua/Sol/Eclipse, astrolábio, lacre de cera, tipografia, reduzir movimento | visual consistente nos dois temas; bom desempenho no celular |
| **5** | PDF vetorial, importação de PDF por metadados, MIDI, MusicXML, PNG, link compartilhável, PWA | PDF exportado e reimportado devolve o mesmo código; link abre no Decifrar |
| **6** (opcional) | Sessão/Dueto | conversa tocada a duas vozes, persistida e exportável |

Ao final de **cada** fase: atualizar o `contexto.md`, atualizar o `CREDITS.md` se entrar novo asset, e confirmar que `npm run build` e `vitest` passam.

## 15. O que NÃO fazer (resumo)

- Não "reconstruir do zero" sem ler o `script.js` e o `contexto.md`.
- Não colocar nota extra, ornamento ou appoggiatura na melodia.
- Não deixar acento ou pontuação mudarem a música.
- Não escrever o acompanhamento em notas na partitura exportada.
- Não implementar OMR (reconhecimento óptico de partitura).
- Não usar `html2canvas` para o PDF, `setTimeout` como relógio da animação nem `Math.random()` no playback.
- Não depender de CDN em runtime (samples e fontes locais).
- Não usar 88 teclas, nem trocar os samples reais por osciladores.
- Não aplicar a v2 em silêncio a mensagens antigas: a versão sempre explícita ou detectada com aviso.
