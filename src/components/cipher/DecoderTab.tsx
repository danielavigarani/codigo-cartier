import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  CornerDownLeft,
  Delete,
  Ear,
  Eye,
  EyeOff,
  FastForward,
  FileUp,
  Lock,
  Sparkles,
} from "lucide-react";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import { decodeCipher } from "../../engine/cipher";
import { buildPlaybackTimeline } from "../../engine/HarmonyEngine";
import { parseRhythmFromLines } from "../../engine/RhythmParser";
import type { CipherVersion, MusicalMode } from "../../types/music";
import { GrandPiano } from "../piano/GrandPiano";
import { VexFlowScore } from "../score/VexFlowScore";

interface DecoderTabProps {
  externalCode?: string | null;
  onImportPdf?: (
    file: File
  ) => Promise<{ cipherCode?: string; pageImages?: string[]; message: string }>;
}

export function DecoderTab({ externalCode, onImportPdf }: DecoderTabProps) {
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
    setCipherVersion,
    setMode,
    setVoice,
    playTimeline,
    stopPlayback,
    playSingleCipherNote,
  } = useSunMoonTheme();

  const [cipherInput, setCipherInput] = useState("");
  const [revealedOutput, setRevealedOutput] = useState("");
  const [forceManualVersion, setForceManualVersion] = useState(false);
  // Regra da seção 0 e contexto.md: "Cola" inicia OCULTA (false) por padrão
  const [showHints, setShowHints] = useState(false);
  const [suspenseSealMode, setSuspenseSealMode] = useState(false);
  const [sealBroken, setSealBroken] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [pdfPreviews, setPdfPreviews] = useState<string[]>([]);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalCode) {
      setCipherInput(externalCode);
      setForceManualVersion(false);
    }
  }, [externalCode]);

  const decoded = useMemo(
    () =>
      decodeCipher(cipherInput, {
        manualVersion: cipherVersion,
        forceManualVersion,
      }),
    [cipherInput, cipherVersion, forceManualVersion]
  );

  // Respeita modo/voz informados no cabeçalho quando presentes
  const effectiveMode: MusicalMode = decoded.detection.header.mode ?? mode;

  const timeline = useMemo(() => {
    if (decoded.totalNotes === 0) return null;
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature,
      tempo,
      seedText: cipherInput,
    });
    return buildPlaybackTimeline({
      measuresByLine,
      mode: effectiveMode,
      voice: decoded.detection.header.voice ?? voice,
      orchestration,
      fidelity,
      tempo,
      seedText: cipherInput,
    });
  }, [
    decoded,
    timeSignature,
    tempo,
    cipherInput,
    effectiveMode,
    voice,
    orchestration,
    fidelity,
  ]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const handleRevealCode = () => {
    if (!isAudioReady) {
      showToast("Ative o áudio primeiro no botão do cabeçalho!");
      return;
    }
    if (playback.isPlaying) {
      stopPlayback();
      return;
    }
    if (!timeline || timeline.totalDurationSeconds <= 0) return;

    if (decoded.detection.header.mode) {
      setMode(decoded.detection.header.mode);
    }
    if (decoded.detection.header.voice) {
      setVoice(decoded.detection.header.voice);
    }

    setRevealedOutput("");
    if (suspenseSealMode) {
      setSealBroken(false);
    } else {
      setSealBroken(true);
    }

    playTimeline(
      timeline,
      (tick) => {
        if (!suspenseSealMode) {
          setRevealedOutput(tick.revealedText);
        }
      },
      () => {
        setSealBroken(true);
        setRevealedOutput(decoded.decodedText);
      }
    );
  };

  const handleSkipReveal = () => {
    stopPlayback();
    setSealBroken(true);
    setRevealedOutput(decoded.decodedText);
  };

  const handleCopyDecrypted = async () => {
    if (!revealedOutput) {
      showToast("Não há nada para copiar ainda.");
      return;
    }
    try {
      await navigator.clipboard.writeText(revealedOutput);
      showToast("Texto revelado copiado!");
    } catch {
      showToast("Falha ao copiar texto.");
    }
  };

  const handlePdfFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onImportPdf) return;
    const file = files[0];
    setPdfNotice("Lendo pergaminho PDF...");
    try {
      const res = await onImportPdf(file);
      setPdfNotice(res.message);
      setPdfPreviews(res.pageImages ?? []);
      if (res.cipherCode) {
        setCipherInput(res.cipherCode);
        setForceManualVersion(false);
      }
    } catch {
      setPdfNotice(
        "Não foi possível ler este PDF. Cole o código manualmente ou use o Modo Leitura no piano."
      );
    }
  };

  const isSol = visualTheme === "sol";
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
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label
              htmlFor="decrypt-input"
              className={`block text-xs sm:text-sm font-bold uppercase tracking-widest ${
                isSol ? "text-amber-400" : "text-cyan-300"
              }`}
            >
              Cole o Código Cartier
            </label>

            {cipherInput.trim() && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-3 py-1 rounded-full font-mono border ${
                    decoded.detection.hasConflict
                      ? "bg-red-950/60 border-red-500/50 text-red-200"
                      : decoded.detection.ambiguous
                      ? "bg-amber-950/60 border-amber-500/50 text-amber-200"
                      : "bg-black/40 border-white/15 text-slate-200"
                  }`}
                >
                  {decoded.detection.source === "header"
                    ? `Cabeçalho: ${decoded.detection.version.toUpperCase()}${
                        decoded.detection.header.mode
                          ? ` · ${decoded.detection.header.mode}`
                          : ""
                      }`
                    : decoded.detection.source === "auto-v1"
                    ? "Auto-detectado: v1 (Legado)"
                    : decoded.detection.source === "auto-v2"
                    ? "Auto-detectado: v2 (SPN)"
                    : decoded.detection.hasConflict
                    ? `Conflito v1/v2 — usando ${decoded.detection.version.toUpperCase()}`
                    : `Versão ambígua — usando ${decoded.detection.version.toUpperCase()}`}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const next: CipherVersion =
                      decoded.detection.version === "v2" ? "v1" : "v2";
                    setForceManualVersion(true);
                    setCipherVersion(next);
                  }}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition-colors"
                >
                  Forçar {decoded.detection.version === "v2" ? "v1" : "v2"}
                </button>
              </div>
            )}
          </div>

          <textarea
            id="decrypt-input"
            rows={3}
            spellCheck={false}
            value={cipherInput}
            onChange={(e) => {
              setCipherInput(e.target.value);
              setForceManualVersion(false);
            }}
            placeholder="Ex: #cartier v2 modo=lua voz=piano&#10;C5 G3 | A3..."
            className="w-full bg-black/45 text-white border border-white/15 rounded-xl p-4 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/50 transition-all font-mono text-base uppercase shadow-inner placeholder:text-slate-500"
          />
        </div>

        {/* Área de soltar PDF (Importação via metadados / texto) */}
        {onImportPdf && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingPdf(true);
            }}
            onDragLeave={() => setIsDraggingPdf(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPdf(false);
              handlePdfFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-5 p-4 rounded-xl border border-dashed cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center gap-3 text-xs ${
              isDraggingPdf
                ? "border-amber-400 bg-amber-500/15 text-amber-100"
                : "border-white/15 bg-black/25 text-slate-400 hover:border-white/30 hover:text-slate-200"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handlePdfFiles(e.target.files)}
            />
            <FileUp className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>
              Arraste um <strong>PDF Edição Manuscrito</strong> aqui ou clique
              para importar a partitura e restaurar a cifra automaticamente.
            </span>
          </div>
        )}

        {pdfNotice && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-slate-200">
            {pdfNotice}
          </div>
        )}

        {pdfPreviews.length > 0 && (
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10">
            {pdfPreviews.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Página ${i + 1} do PDF importado`}
                className="w-full rounded-lg border border-white/15 brightness-90 contrast-110"
              />
            ))}
          </div>
        )}

        {/* Destaque explícito em vermelho para tokens inválidos */}
        {decoded.hasErrors && (
          <div className="mb-5 p-4 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs">
            <div className="flex items-center gap-2 font-bold text-red-300 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {decoded.invalidTokens.length} token(s) inválido(s) encontrado(s)
                para a versão {decoded.detection.version.toUpperCase()}:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono">
              {decoded.lines.flatMap((line) =>
                line.tokens.map((tok) =>
                  tok.type === "invalid" ? (
                    <span
                      key={tok.id}
                      className="px-2 py-0.5 rounded bg-red-600/35 border border-red-400 text-red-100 font-bold"
                    >
                      Linha {tok.lineIndex + 1}: {tok.raw}
                    </span>
                  ) : null
                )
              )}
            </div>
          </div>
        )}

        {feedback && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-amber-400" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-center items-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleRevealCode}
            className={`font-bold py-3 px-8 rounded-full shadow-lg transition-all flex items-center gap-2 ${
              isSol
                ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950"
                : "bg-gradient-to-r from-cyan-700 to-indigo-700 hover:from-cyan-600 hover:to-indigo-600 text-white"
            }`}
          >
            <Ear className="w-5 h-5" />
            <span>
              {playback.isPlaying ? "Parar Revelação" : "Ouvir & Revelar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSuspenseSealMode((prev) => !prev)}
            className={`px-4 py-3 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              suspenseSealMode
                ? "bg-rose-950/60 border-rose-400/60 text-rose-200"
                : "bg-black/40 border-white/15 text-slate-300 hover:text-white"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>
              {suspenseSealMode
                ? "Lacre de Cera (Suspense)"
                : "Revelação Caligráfica"}
            </span>
          </button>

          {playback.isPlaying && (
            <button
              type="button"
              onClick={handleSkipReveal}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 px-5 rounded-full shadow-lg transition-all flex items-center gap-2"
            >
              <FastForward className="w-4 h-4" />
              <span>Pular Animação</span>
            </button>
          )}
        </div>

        {/* Resultado + Lacre de Cera */}
        <div className="mb-6 relative pt-6 border-t border-white/10">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <label
              htmlFor="decrypt-output"
              className={`block text-xs sm:text-sm font-bold uppercase tracking-widest ${
                isSol ? "text-amber-400" : "text-cyan-300"
              }`}
            >
              Mensagem Revelada
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleCopyDecrypted}
                className="text-xs text-slate-400 hover:text-white uppercase flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Texto</span>
              </button>
              <button
                type="button"
                onClick={() => setRevealedOutput((prev) => prev + "\n")}
                className="text-xs text-slate-400 hover:text-white uppercase flex items-center gap-1 transition-colors"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>Nova Linha</span>
              </button>
              <button
                type="button"
                onClick={() => setRevealedOutput((prev) => prev.slice(0, -1))}
                className="text-xs text-slate-400 hover:text-white uppercase flex items-center gap-1 transition-colors"
              >
                <Delete className="w-3.5 h-3.5" />
                <span>Apagar Última</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="decrypt-output"
              readOnly
              rows={5}
              value={revealedOutput}
              placeholder="..."
              className={`w-full bg-black/50 text-xl font-bold border border-white/15 focus:outline-none p-4 tracking-wider font-mono rounded-xl shadow-inner transition-all ${
                isSol ? "text-amber-300" : "text-cyan-200"
              } ${!sealBroken ? "blur-md select-none" : ""}`}
            />

            {!sealBroken && playback.isPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/45 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-700 via-red-800 to-rose-950 border-2 border-amber-400/70 shadow-[0_0_25px_rgba(190,18,60,0.65)] flex items-center justify-center animate-pulse">
                  <Sparkles className="w-7 h-7 text-amber-200" />
                </div>
                <p className="mt-2.5 text-xs font-serif italic text-amber-200">
                  Lacre de Cera intacto — o selo se romperá na cadência final...{" "}
                  {Math.round(playback.progress * 100)}%
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-2">
            As letras surgem em sincronia exata com o relógio do Transport ou ao
            tocar as teclas do piano abaixo.
          </p>
        </div>

        {/* Partitura viva da cifra colada */}
        {timeline && timeline.measuresByLine.some((m) => m.length > 0) && (
          <div className="mb-6">
            <VexFlowScore
              lines={timeline.measuresByLine}
              mode={effectiveMode}
              visualTheme={visualTheme}
              showLettersUnderNotes={false}
              activeEventId={playback.activeEventId}
              onNoteClick={(cipherNote) => playSingleCipherNote(cipherNote)}
            />
          </div>
        )}

        <div className="flex justify-center mb-4">
          <button
            type="button"
            onClick={() => setShowHints((prev) => !prev)}
            className={`flex items-center gap-2 text-xs sm:text-sm font-bold transition-all bg-black/45 px-4 py-2 rounded-full border ${
              showHints
                ? "border-amber-400/60 text-amber-300"
                : "border-white/15 text-slate-400 hover:text-slate-200"
            }`}
          >
            {showHints ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            <span>
              {showHints ? 'Ocultar "Cola" (Letras)' : 'Mostrar "Cola" (Letras)'}
            </span>
          </button>
        </div>

        <GrandPiano
          version={decoded.detection.version}
          mode={effectiveMode}
          visualTheme={visualTheme}
          showHints={showHints}
          activeMelodyNote={playback.activeMelodyCipherNote}
          activeAccompanimentNotes={playback.activeAccompanimentNotes}
          onKeyPress={(cipherNote, _soundingNote, letter) => {
            playSingleCipherNote(cipherNote, undefined, effectiveMode);
            setRevealedOutput((prev) => prev + letter);
          }}
        />
      </div>
    </section>
  );
}
