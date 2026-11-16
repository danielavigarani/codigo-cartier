import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Link2,
  Music,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import { decodeCipher, encodeText, encodeTextLines } from "../../engine/cipher";
import { buildPlaybackTimeline } from "../../engine/HarmonyEngine";
import { parseRhythmFromLines } from "../../engine/RhythmParser";
import type { PlaybackTimeline } from "../../types/music";
import { VexFlowScore } from "../score/VexFlowScore";

interface ComposerTabProps {
  onOpenPdfModal?: (params: {
    rawText: string;
    cipherCode: string;
    timeline: PlaybackTimeline;
  }) => void;
  onExportMidi?: (timeline: PlaybackTimeline, filenameBase: string) => void;
  onExportMusicXml?: (timeline: PlaybackTimeline, filenameBase: string) => void;
  onExportPng?: (
    container: HTMLDivElement | null,
    filenameBase: string
  ) => void;
  onCopyShareLink?: (cipherCode: string) => Promise<void>;
}

export function ComposerTab({
  onOpenPdfModal,
  onExportMidi,
  onExportMusicXml,
  onExportPng,
  onCopyShareLink,
}: ComposerTabProps) {
  const {
    mode,
    visualTheme,
    voice,
    orchestration,
    fidelity,
    tempo,
    timeSignature,
    cipherVersion,
    isAudioReady,
    playback,
    playTimeline,
    stopPlayback,
    playSingleCipherNote,
  } = useSunMoonTheme();

  const [inputText, setInputText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  const [secretMode, setSecretMode] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedText(inputText);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [inputText]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (
        copyMenuRef.current &&
        !copyMenuRef.current.contains(event.target as Node)
      ) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, []);

  const encodedLines = useMemo(
    () => encodeTextLines(inputText, cipherVersion),
    [inputText, cipherVersion]
  );

  const canonicalCipherCode = useMemo(
    () =>
      encodeText(debouncedText, {
        version: cipherVersion,
        mode,
        voice,
        format: "code",
        includeHeader: true,
      }),
    [debouncedText, cipherVersion, mode, voice]
  );

  const timeline = useMemo(() => {
    if (!debouncedText.trim()) return null;
    const decoded = decodeCipher(canonicalCipherCode, {
      manualVersion: cipherVersion,
      forceManualVersion: true,
    });
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature,
      tempo,
      seedText: canonicalCipherCode,
    });
    return buildPlaybackTimeline({
      measuresByLine,
      mode,
      voice,
      orchestration,
      fidelity,
      tempo,
      seedText: canonicalCipherCode,
    });
  }, [
    debouncedText,
    canonicalCipherCode,
    cipherVersion,
    timeSignature,
    tempo,
    mode,
    voice,
    orchestration,
    fidelity,
  ]);

  const hasContent = inputText.trim().length > 0;
  const isSol = visualTheme === "sol";

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const handleClear = () => {
    if (playback.isPlaying) stopPlayback();
    setInputText("");
    setDebouncedText("");
  };

  const handleCopy = async (format: "full" | "code") => {
    const textToCopy = encodeText(inputText, {
      version: cipherVersion,
      mode,
      voice,
      format,
      includeHeader: format === "code",
    });
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyMenuOpen(false);
      showToast(
        format === "full"
          ? "Cifra completa (Nota + Letra) copiada!"
          : `Código #cartier ${cipherVersion} copiado!`
      );
    } catch {
      showToast("Não foi possível acessar a área de transferência.");
    }
  };

  const handlePlaySymphony = () => {
    if (!isAudioReady) {
      showToast("Ative o áudio primeiro no botão do cabeçalho!");
      return;
    }
    if (playback.isPlaying) {
      stopPlayback();
      return;
    }
    if (!timeline) return;
    playTimeline(timeline);
  };

  const handleCopyLink = async () => {
    if (!hasContent) return;
    const fullCode = encodeText(inputText, {
      version: cipherVersion,
      mode,
      voice,
      format: "code",
      includeHeader: true,
    });
    if (onCopyShareLink) {
      await onCopyShareLink(fullCode);
      showToast("Link compartilhável copiado!");
    }
  };

  const panelClass = isSol
    ? "bg-[#1a130e]/85 border-amber-500/25"
    : visualTheme === "eclipse"
    ? "bg-[#110e1f]/85 border-violet-400/30"
    : "bg-[#0b1022]/85 border-slate-700/75";

  return (
    <section className="w-full space-y-6">
      <div
        className={`backdrop-blur-md rounded-2xl p-5 sm:p-6 border shadow-2xl transition-colors ${panelClass}`}
      >
        <div className="flex flex-wrap justify-between items-center mb-2.5 gap-2">
          <label
            htmlFor="input-text"
            className={`block text-xs sm:text-sm font-bold uppercase tracking-widest ${
              isSol ? "text-amber-400" : "text-cyan-300"
            }`}
          >
            Escreva com o Coração
          </label>
          <button
            type="button"
            onClick={() => setSecretMode((prev) => !prev)}
            title="Ocultar texto e partitura para transmissão"
            className={`flex items-center gap-1.5 text-xs uppercase font-bold px-3 py-1 rounded-full border transition-colors ${
              secretMode
                ? "bg-amber-500/20 border-amber-400/50 text-amber-300"
                : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {secretMode ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{secretMode ? "Modo Sigilo (Ativo)" : "Modo Público"}</span>
          </button>
        </div>

        <textarea
          id="input-text"
          rows={4}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Digite aqui a mensagem secreta..."
          className={`w-full bg-black/45 text-white border border-white/15 rounded-xl p-4 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/50 transition-all font-mono text-base sm:text-lg uppercase shadow-inner placeholder:text-slate-500 ${
            secretMode ? "secret-mode" : ""
          }`}
        />

        <div className="flex flex-wrap gap-3 justify-between items-center mt-4">
          <button
            type="button"
            onClick={() => setDebouncedText(inputText)}
            className={`font-bold py-2.5 px-6 rounded-full shadow-lg transition-all flex items-center gap-2 text-sm ${
              isSol
                ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950"
                : "bg-gradient-to-r from-cyan-700 to-indigo-700 hover:from-cyan-600 hover:to-indigo-600 text-white"
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Traduzir para Notas ({cipherVersion})</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 bg-black/35 hover:bg-white/10 hover:text-white text-xs py-2 px-4 rounded-full transition-all border border-white/10 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Tudo</span>
          </button>
        </div>

        {feedback && (
          <div className="mt-4 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-400" />
            <span>{feedback}</span>
          </div>
        )}

        {hasContent && (
          <div className="mt-8 border-t border-white/10 pt-6 space-y-6">
            {/* Barra de ações */}
            <div className="flex flex-wrap justify-between items-center gap-3 relative z-30">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlaySymphony}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full border shadow-lg transition-all active:scale-95 ${
                    playback.isPlaying
                      ? "bg-red-900/60 border-red-400 text-red-100"
                      : isSol
                      ? "bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30"
                      : "bg-cyan-500/20 border-cyan-400/60 text-cyan-100 hover:bg-cyan-500/30"
                  }`}
                >
                  {playback.isPlaying ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Parar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Tocar Sinfonia</span>
                    </>
                  )}
                </button>

                <div className="relative" ref={copyMenuRef}>
                  <button
                    type="button"
                    onClick={() => setCopyMenuOpen((prev) => !prev)}
                    aria-label="Opções de Cópia"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-black/45 rounded-full border border-white/15 hover:bg-white/10 transition-all text-slate-200 text-xs font-semibold"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </button>

                  {copyMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-60 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50">
                      <button
                        type="button"
                        onClick={() => handleCopy("full")}
                        className="w-full text-left px-4 py-3 text-xs text-slate-200 hover:bg-slate-800 border-b border-slate-800 transition-colors flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>Completo (Nota + Letra)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy("code")}
                        className="w-full text-left px-4 py-3 text-xs text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2"
                      >
                        <Code className="w-4 h-4 text-cyan-400" />
                        <span>Apenas Cifra (#cartier {cipherVersion})</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações de exportação e compartilhamento */}
              <div className="flex flex-wrap items-center gap-2">
                {onCopyShareLink && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-black/40 border border-white/15 hover:border-amber-400/50 text-slate-200 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar Link</span>
                  </button>
                )}

                {onOpenPdfModal && timeline && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPdfModal({
                        rawText: inputText,
                        cipherCode: canonicalCipherCode,
                        timeline,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-400/45 hover:bg-amber-500/25 text-amber-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar PDF</span>
                  </button>
                )}

                {onExportMidi && timeline && (
                  <button
                    type="button"
                    onClick={() => onExportMidi(timeline, "codigo-cartier")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-black/40 border border-white/15 hover:border-cyan-400/50 text-slate-200 transition-colors"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>MIDI</span>
                  </button>
                )}

                {onExportMusicXml && timeline && (
                  <button
                    type="button"
                    onClick={() => onExportMusicXml(timeline, "codigo-cartier")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-black/40 border border-white/15 hover:border-cyan-400/50 text-slate-200 transition-colors"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>MusicXML</span>
                  </button>
                )}

                {onExportPng && (
                  <button
                    type="button"
                    onClick={() =>
                      onExportPng(scoreRef.current, "partitura-cartier")
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-black/40 border border-white/15 hover:border-cyan-400/50 text-slate-200 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>PNG</span>
                  </button>
                )}
              </div>
            </div>

            {/* Partitura Viva (VexFlow Grand Staff) */}
            {timeline && timeline.measuresByLine.some((m) => m.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Partitura Viva ({mode === "lua" ? "Lá Menor · Lua" : "Lá Maior 3# · Sol"})
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {timeSignature} · {orchestration}
                  </span>
                </div>
                <VexFlowScore
                  scoreContainerRef={scoreRef}
                  lines={timeline.measuresByLine}
                  mode={mode}
                  visualTheme={visualTheme}
                  secretMode={secretMode}
                  showLettersUnderNotes={!secretMode}
                  activeEventId={playback.activeEventId}
                  onNoteClick={(cipherNote) => playSingleCipherNote(cipherNote)}
                />
              </div>
            )}

            {/* Cartões de Cifra por Linha (Partitura 1, 2...) */}
            <div
              className={`flex flex-col gap-4 ${
                secretMode ? "secret-output" : ""
              }`}
            >
              {encodedLines.map((line) => {
                if (line.items.length === 0) return null;
                const nonEmptyCount = encodedLines.filter(
                  (l) => l.items.length > 0
                ).length;

                return (
                  <div
                    key={line.lineIndex}
                    className="bg-black/40 p-4 rounded-xl border border-white/10 shadow-inner"
                  >
                    {nonEmptyCount > 1 && (
                      <h4
                        className={`text-[10px] uppercase font-bold mb-2 tracking-widest ${
                          isSol ? "text-amber-400" : "text-cyan-300"
                        }`}
                      >
                        Partitura {line.lineIndex + 1}
                      </h4>
                    )}
                    <div className="flex flex-wrap gap-1.5 items-center justify-start">
                      {line.items.map((item, idx) =>
                        item.type === "note" && item.note ? (
                          <div key={idx} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => playSingleCipherNote(item.note!)}
                              className="flex flex-col items-center group cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10 transition-all min-w-[34px]"
                            >
                              <span
                                className={`font-bold transition-colors text-sm sm:text-base font-mono ${
                                  isSol
                                    ? "text-amber-300 group-hover:text-amber-100"
                                    : "text-cyan-200 group-hover:text-white"
                                }`}
                              >
                                {item.note}
                              </span>
                              <span className="decrypted-hint text-[10px] text-slate-400 mt-0.5 uppercase font-bold transition-all font-mono">
                                {item.char}
                              </span>
                            </button>
                            <span className="text-slate-600 select-none font-thin text-lg opacity-40">
                              |
                            </span>
                          </div>
                        ) : (
                          <div
                            key={idx}
                            aria-label="Espaço entre palavras"
                            className="w-5 h-1 bg-slate-600 mx-1 self-center rounded opacity-60"
                          />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-500 italic text-center">
              *Clique em qualquer nota na partitura ou nos cartões para ouvi-la.*
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
