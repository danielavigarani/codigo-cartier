import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Copy,
  Grid,
  Languages,
  Music,
  Sparkles,
} from "lucide-react";
import {
  ALPHABET,
  getCipherTables,
  OFFICIAL_CREDITS,
} from "../../constants/cipherRules";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import { parseRhythmFromLines } from "../../engine/RhythmParser";
import { decodeCipher } from "../../engine/cipher";
import type { CipherVersion } from "../../types/music";
import { VexFlowScore } from "../score/VexFlowScore";

const SOLFEGE = [
  { cipher: "C", name: "Dó" },
  { cipher: "D", name: "Ré" },
  { cipher: "E", name: "Mi" },
  { cipher: "F", name: "Fá" },
  { cipher: "G", name: "Sol" },
  { cipher: "A", name: "Lá" },
  { cipher: "B", name: "Si" },
];

export function TheoryGrimoire() {
  const {
    mode,
    visualTheme,
    voice,
    orchestration,
    tempo,
    cipherVersion,
    playSingleCipherNote,
  } = useSunMoonTheme();

  const [tableVersion, setTableVersion] = useState<CipherVersion>(cipherVersion);
  const [inspectedNote, setInspectedNote] = useState<{
    note: string;
    letter?: string;
  }>({ note: "C4", letter: tableVersion === "v2" ? "J" : "Q" });
  const [narrationSeed, setNarrationSeed] = useState(0);
  const [copiedNarration, setCopiedNarration] = useState(false);

  const { letterToNote } = getCipherTables(tableVersion);

  const inspectNote = (note: string, letter?: string) => {
    setInspectedNote({ note, letter });
    playSingleCipherNote(note);
  };

  // Mini-partitura de 1 nota para o dicionário interativo
  const miniPreviewMeasures = useMemo(() => {
    const fakeDecode = decodeCipher(inspectedNote.note, {
      manualVersion: tableVersion,
      forceManualVersion: true,
    });
    const parsed = parseRhythmFromLines(fakeDecode.lines, {
      timeSignature: "4/4",
      tempo,
    });
    return parsed.measuresByLine;
  }, [inspectedNote.note, tableVersion, tempo]);

  const narrativePhrase = useMemo(() => {
    const isPiano = voice === "piano";
    const isMoon = mode === "lua";
    const tempoDesc =
      tempo === "adagio"
        ? "lenta e fúnebre, como um pêndulo no escuro"
        : tempo === "allegretto"
        ? "inquieta e urgente, como passos fugindo pela chuva"
        : "constante e cerimonial, como o girar de um astrolábio";

    const instrumentDesc = isPiano
      ? "dedilhada no piano antigo de teclas frias"
      : "arrancada das cordas graves do violoncelo em madeira envelhecida";

    const modeDesc = isMoon
      ? "em Lá Menor Natural — apenas teclas brancas, sem redenção nem sustenidos"
      : "em Lá Maior Solar — banhada pelos três sustenidos que douram o silêncio";

    const orchDesc =
      orchestration === "sinfonia"
        ? "As duas primas respondem uma à outra no instante exato do Eclipse, entrelaçando piano e violoncelo."
        : orchestration === "noturno"
        ? "Um baixo contínuo noturno sustenta cada sílaba como ondas sob um cais de neblina."
        : "A melodia ressoa solitária, nua e direta, para quem ousa decifrar nota por nota.";

    const endings = [
      "Na última nota, a cadência fecha o pacto — quem conhece a partitura já sabe o nome oculto no ar.",
      "Cada pausa entre palavras guarda um suspiro; cada vogal alonga o segredo antes que a sala esfrie.",
      "O som não pede permissão para entrar na memória: quando o acorde repousa, a mensagem já foi lida.",
    ];
    const closing = endings[narrationSeed % endings.length];

    return `Uma melodia ${tempoDesc}, ${instrumentDesc}, ${modeDesc}. ${orchDesc} ${closing}`;
  }, [voice, mode, tempo, orchestration, narrationSeed]);

  const handleCopyNarration = async () => {
    try {
      await navigator.clipboard.writeText(narrativePhrase);
      setCopiedNarration(true);
      window.setTimeout(() => setCopiedNarration(false), 2000);
    } catch {
      // ignora
    }
  };

  const isSol = visualTheme === "sol";
  const cardClass = isSol
    ? "bg-[#1a130e]/85 border-amber-500/25"
    : visualTheme === "eclipse"
    ? "bg-[#110e1f]/85 border-violet-400/30"
    : "bg-[#0b1022]/85 border-slate-700/75";

  return (
    <section className="w-full space-y-6">
      {/* Dicionário + Mini-Partitura Interativa */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={`rounded-2xl p-6 border shadow-xl ${cardClass}`}>
          <h2
            className={`text-2xl font-serif mb-3 border-b border-white/10 pb-2 flex items-center gap-2 ${
              isSol ? "text-amber-400" : "text-cyan-300"
            }`}
          >
            <Languages className="w-5 h-5" />
            <span>Dicionário Musical Interativo</span>
          </h2>
          <p className="text-slate-300 mb-4 text-sm leading-relaxed">
            Clique em qualquer nota para ouvir o timbre real e ver sua posição
            na pauta dupla. No Modo Sol, C, F e G soam sustenidos pela armadura.
          </p>

          <div className="grid grid-cols-1 gap-2 text-sm font-mono mb-4">
            {SOLFEGE.map((item) => {
              const targetNote = `${item.cipher}4`;
              const active = inspectedNote.note === targetNote;
              return (
                <button
                  key={item.cipher}
                  type="button"
                  onClick={() => inspectNote(targetNote)}
                  className={`flex justify-between p-3 rounded-lg items-center transition-colors border ${
                    active
                      ? "bg-amber-500/20 border-amber-400/50 text-white"
                      : "bg-black/35 border-white/10 hover:bg-white/10 text-slate-200"
                  }`}
                >
                  <span className="font-bold text-lg w-8">{item.cipher}</span>
                  <span className="text-amber-400 font-bold">=</span>
                  <span>
                    {item.name}
                    {mode === "sol" &&
                    (item.cipher === "C" ||
                      item.cipher === "F" ||
                      item.cipher === "G")
                      ? " (soa #)"
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
              Posição na Pauta ({inspectedNote.note}
              {inspectedNote.letter ? ` · Letra ${inspectedNote.letter}` : ""}):
            </p>
            <VexFlowScore
              lines={miniPreviewMeasures}
              mode={mode}
              visualTheme={visualTheme}
              showLettersUnderNotes={false}
              onNoteClick={(n) => playSingleCipherNote(n)}
            />
          </div>
        </div>

        <div className={`rounded-2xl p-6 border shadow-xl ${cardClass}`}>
          <h2
            className={`text-2xl font-serif mb-3 border-b border-white/10 pb-2 flex items-center gap-2 ${
              isSol ? "text-amber-400" : "text-cyan-300"
            }`}
          >
            <Music className="w-5 h-5" />
            <span>Sintaxe, Ritmo & Regras</span>
          </h2>

          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="bg-black/35 p-3.5 rounded-xl border border-white/10">
              <h4 className="font-bold text-white mb-1">
                1. Versões v2 (SPN) × v1 (Legado)
              </h4>
              <p className="leading-relaxed text-slate-300/90">
                <strong className="text-amber-300">v2 (Padrão):</strong> a
                oitava muda no Dó (SPN internacional), subindo de{" "}
                <code>A2</code> até <code>E6</code> — A–B (2), C–I (3), J–P
                (4), Q–W (5), X–Z (6).
                <br />
                <strong className="text-slate-200">v1 (Legado):</strong> a
                oitava muda no Lá (<code>A2–G2</code>, <code>A3–G3</code>,{" "}
                <code>A4–G4</code>, <code>A5–E5</code>) para compatibilidade
                com mensagens antigas.
              </p>
            </div>

            <div className="bg-black/35 p-3.5 rounded-xl border border-white/10">
              <h4 className="font-bold text-white mb-1">
                2. Lua (Lá Menor) × Sol (Lá Maior) — Sem `#` na Cifra
              </h4>
              <p className="leading-relaxed text-slate-300/90">
                Nunca se escreve sustenido (<code>#</code>) no código da cifra.
                No <strong>Modo Lua</strong> (Lá Menor Natural), tudo soa nas
                teclas brancas. No <strong>Modo Sol</strong> (Lá Maior), a
                armadura de 3 sustenidos transforma automaticamente{" "}
                <code>C, F, G</code> em <code>C#, F#, G#</code> ao tocar.
              </p>
            </div>

            <div className="bg-black/35 p-3.5 rounded-xl border border-white/10">
              <h4 className="font-bold text-white mb-1">
                3. Ritmo Determinístico & Acentos
              </h4>
              <p className="leading-relaxed text-slate-300/90">
                Exatamente <strong>1 nota por letra</strong> (sem ornamentos).
                Acentos e pontuações são descartados no cifrar para que
                cifradora e decifradora ouçam a mesma peça: Vogais = semínima (
                <code>4n</code>), Consoantes = colcheia (<code>8n</code>), fim
                de palavra = nota pontuada, <code>|</code> = pausa de colcheia (
                <code>8r</code>), fim de linha = mínima pontuada (
                <code>2n.</code>) + cadência.
              </p>
            </div>

            {/* Gerador Narrativo de RPG */}
            <div className="bg-gradient-to-br from-amber-950/35 to-violet-950/30 p-4 rounded-xl border border-amber-500/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Gerador de Narração para Mesa de RPG</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setNarrationSeed((s) => s + 1)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Variar Frase
                </button>
              </div>
              <p className="font-serif italic text-base text-slate-100 leading-relaxed">
                "{narrativePhrase}"
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyNarration}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 border border-white/15 hover:border-amber-400/50 text-amber-200"
                >
                  {copiedNarration ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Narração</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Tradução Completa */}
      <div className={`rounded-2xl p-6 border shadow-xl ${cardClass}`}>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h3 className="text-lg text-white font-bold flex items-center gap-2">
            <Grid className="w-5 h-5 text-amber-400" />
            <span>Tabela de Tradução Completa (Clique para Ouvir)</span>
          </h3>
          <div className="flex rounded-full bg-black/50 p-1 border border-white/15 text-xs">
            <button
              type="button"
              onClick={() => setTableVersion("v2")}
              className={`px-3 py-1 rounded-full font-bold transition-colors ${
                tableVersion === "v2"
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              v2 (SPN)
            </button>
            <button
              type="button"
              onClick={() => setTableVersion("v1")}
              className={`px-3 py-1 rounded-full font-bold transition-colors ${
                tableVersion === "v1"
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              v1 (Legado)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2.5 text-center text-xs font-mono">
          {ALPHABET.map((letter) => {
            const note = letterToNote[letter];
            const isSelected = inspectedNote.note === note;
            return (
              <button
                key={`${tableVersion}-${letter}`}
                type="button"
                onClick={() => inspectNote(note, letter)}
                className={`p-2.5 rounded-xl flex flex-col items-center border transition-all ${
                  isSelected
                    ? "bg-amber-500/20 border-amber-400 text-white"
                    : "bg-black/35 border-white/10 hover:bg-white/10 hover:border-amber-400/50"
                }`}
              >
                <span className="text-amber-300 font-bold text-sm mb-1">
                  {note}
                </span>
                <span className="text-slate-300 text-[11px] border-t border-white/10 w-full pt-1">
                  {letter}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 text-center">
        <p className="text-[11px] text-slate-400 font-mono uppercase tracking-widest flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>{OFFICIAL_CREDITS}</span>
        </p>
      </div>
    </section>
  );
}
