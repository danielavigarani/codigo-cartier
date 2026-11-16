import { useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, X } from "lucide-react";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import { exportManuscriptPdf, type PaperStyle } from "../../export/pdf";
import type { PlaybackTimeline } from "../../types/music";
import { VexFlowScore } from "./VexFlowScore";

interface PdfScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  cipherCode: string;
  timeline: PlaybackTimeline | null;
}

const ROMAN_NUMERALS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];

function getSuggestedOpus(mode: "lua" | "sol"): string {
  const key = "cartier_opus_counter";
  let count = 14;
  try {
    const stored = localStorage.getItem(key);
    if (stored) count = Math.max(1, Number(stored));
  } catch {
    // ignora
  }
  const roman = ROMAN_NUMERALS[(count - 1) % ROMAN_NUMERALS.length] ?? String(count);
  return mode === "lua"
    ? `Opus ${roman} — Sonata do Eclipse em Lá Menor`
    : `Opus ${roman} — Ária Solar em Lá Maior`;
}

export function PdfScoreModal({
  isOpen,
  onClose,
  cipherCode,
  timeline,
}: PdfScoreModalProps) {
  const { mode, tempo, timeSignature } = useSunMoonTheme();
  const [opusTitle, setOpusTitle] = useState(() => getSuggestedOpus(mode));
  const [subtitle, setSubtitle] = useState(
    "Manuscrito Criptográfico para Piano & Harpa de Concerto"
  );
  const [composers, setComposers] = useState("Gabriela & Priya");
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("pergaminho");
  const [includeHints, setIncludeHints] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const printScoreRef = useRef<HTMLDivElement | null>(null);

  const measuresByLine = useMemo(
    () => timeline?.measuresByLine ?? [],
    [timeline]
  );

  if (!isOpen || !timeline) return null;

  const handleExport = async () => {
    if (!printScoreRef.current) return;
    setExporting(true);
    setErrorMsg(null);
    try {
      await exportManuscriptPdf({
        opusTitle,
        subtitle,
        composers,
        paperStyle,
        mode,
        tempo,
        timeSignature,
        cipherCode,
        scoreContainer: printScoreRef.current,
      });

      try {
        const current = Number(localStorage.getItem("cartier_opus_counter") || "14");
        localStorage.setItem("cartier_opus_counter", String(current + 1));
      } catch {
        // ignora
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Falha ao gerar o PDF vetorial."
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Exportar PDF Edição Manuscrito"
    >
      <div className="w-full max-w-3xl bg-[#0e1222] border border-amber-500/35 rounded-2xl shadow-2xl p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-amber-300">
            <FileText className="w-5 h-5" />
            <h2 className="text-xl font-serif font-bold">
              Exportar PDF — Edição Manuscrito (Vetorial)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Título de Opus
            </label>
            <input
              type="text"
              value={opusTitle}
              onChange={(e) => setOpusTitle(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Subtítulo
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Compositoras
            </label>
            <input
              type="text"
              value={composers}
              onChange={(e) => setComposers(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase tracking-wider">
              Papel:
            </span>
            <button
              type="button"
              onClick={() => setPaperStyle("pergaminho")}
              className={`px-3 py-1.5 rounded-full font-semibold border ${
                paperStyle === "pergaminho"
                  ? "bg-amber-500/25 border-amber-400 text-amber-200"
                  : "bg-black/30 border-white/15 text-slate-400"
              }`}
            >
              Pergaminho Envelhecido
            </button>
            <button
              type="button"
              onClick={() => setPaperStyle("urtext")}
              className={`px-3 py-1.5 rounded-full font-semibold border ${
                paperStyle === "urtext"
                  ? "bg-slate-200/20 border-slate-300 text-white"
                  : "bg-black/30 border-white/15 text-slate-400"
              }`}
            >
              Edição Urtext
            </button>
          </div>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHints}
              onChange={(e) => setIncludeHints(e.target.checked)}
              className="rounded accent-amber-500"
            />
            <span>Imprimir letras sob as notas</span>
          </label>
        </div>

        {/* Pré-visualização real em modo claro/pergaminho para conversão vetorial */}
        <div className="max-h-72 overflow-y-auto rounded-xl border border-amber-500/20 p-3 bg-[#FAF3E0]">
          <VexFlowScore
            scoreContainerRef={printScoreRef}
            lines={measuresByLine}
            mode={mode}
            visualTheme={mode}
            variant="print"
            showLettersUnderNotes={includeHints}
          />
        </div>

        <p className="text-[11px] text-slate-400">
          O arquivo gerado inclui apenas a melodia e cifras de acorde em curvas
          vetoriais (sem rasterização), além de metadados comprimidos e hash
          SHA-256 para reimportação automática.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="px-6 py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 flex items-center gap-2 shadow-lg"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PDF Vetorial...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Baixar PDF Manuscrito</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
