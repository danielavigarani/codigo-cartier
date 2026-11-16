import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Lock, LockOpen, Sparkles } from "lucide-react";
import { OFFICIAL_CREDITS } from "./constants/cipherRules";
import {
  SunMoonThemeProvider,
  useSunMoonTheme,
} from "./context/SunMoonThemeContext";
import { downloadMidi } from "./export/midi";
import { downloadMusicXml } from "./export/musicxml";
import { exportScoreAsPng } from "./export/png";
import { buildShareUrl, extractCodeFromHash } from "./export/share";
import { ComposerTab } from "./components/cipher/ComposerTab";
import { DecoderTab } from "./components/cipher/DecoderTab";
import { TheoryGrimoire } from "./components/grimoire/TheoryGrimoire";
import { EclipseHeader } from "./components/layout/EclipseHeader";
import { DuetSession } from "./components/session/DuetSession";
import type { PlaybackTimeline } from "./types/music";

const PdfScoreModal = lazy(() =>
  import("./components/score/PdfScoreModal").then((m) => ({
    default: m.PdfScoreModal,
  }))
);

type AppTab = "encrypt" | "decrypt" | "duet" | "legend";

function ObservatoryShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("encrypt");
  const [sharedCode, setSharedCode] = useState<string | null>(null);
  const [pdfModalPayload, setPdfModalPayload] = useState<{
    cipherCode: string;
    timeline: PlaybackTimeline;
  } | null>(null);

  const {
    mode,
    tempo,
    visualTheme,
    manualTheme,
    reducedMotion,
    stopPlayback,
    setManualTheme,
  } = useSunMoonTheme();

  // Abre automaticamente a aba Decifrar se houver link compartilhável (#c=...)
  useEffect(() => {
    const readHash = () => {
      const code = extractCodeFromHash(window.location.hash);
      if (code) {
        setSharedCode(code);
        setActiveTab("decrypt");
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const effectiveTheme =
    manualTheme !== "auto"
      ? visualTheme
      : visualTheme === "eclipse" || activeTab === "duet"
      ? "eclipse"
      : activeTab === "decrypt"
      ? "sol"
      : "lua";

  const handleSwitchTab = (tab: AppTab) => {
    stopPlayback();
    setActiveTab(tab);
    if (manualTheme !== "auto") {
      setManualTheme("auto");
    }
  };

  const handleCopyShareLink = async (cipherCode: string) => {
    const url = buildShareUrl(cipherCode);
    await navigator.clipboard.writeText(url);
  };

  const handleImportPdf = async (file: File) => {
    const { importCartierPdf } = await import("./export/pdf");
    return importCartierPdf(file);
  };

  const bgColor =
    effectiveTheme === "sol"
      ? "#110D0A"
      : effectiveTheme === "eclipse"
      ? "#0A0716"
      : "#060814";

  const themeClass =
    effectiveTheme === "sol"
      ? "theme-sol"
      : effectiveTheme === "eclipse"
      ? "theme-eclipse"
      : "theme-lua";

  const tabActiveClass =
    effectiveTheme === "sol"
      ? "border-amber-400 text-amber-300 font-bold"
      : effectiveTheme === "eclipse"
      ? "border-violet-400 text-amber-200 font-bold"
      : "border-cyan-400 text-cyan-200 font-bold";

  return (
    <div
      className={`min-h-screen flex flex-col items-center pb-12 relative overflow-x-hidden transition-colors duration-700 text-slate-200 ${themeClass}`}
      style={{ backgroundColor: bgColor }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Camada atmosférica profunda por tema (Lua / Sol / Eclipse) */}
        <motion.div
          animate={{
            opacity: effectiveTheme === "sol" ? 0.92 : 0.85,
          }}
          transition={{ duration: reducedMotion ? 0 : 0.8 }}
          className="absolute inset-0"
          style={{
            background:
              effectiveTheme === "sol"
                ? "radial-gradient(ellipse at 50% 10%, rgba(212,175,55,0.22), transparent 58%), radial-gradient(circle at 82% 78%, rgba(180,83,9,0.16), transparent 50%), radial-gradient(circle at 15% 85%, rgba(120,53,15,0.14), transparent 48%)"
                : effectiveTheme === "eclipse"
                ? "radial-gradient(ellipse at 50% 12%, rgba(212,175,55,0.20), rgba(139,92,246,0.16) 36%, transparent 66%), radial-gradient(circle at 20% 80%, rgba(103,232,249,0.12), transparent 50%)"
                : "radial-gradient(ellipse at 50% 10%, rgba(103,232,249,0.16), rgba(30,58,138,0.22) 42%, transparent 68%), radial-gradient(circle at 85% 82%, rgba(99,102,241,0.12), transparent 50%)",
          }}
        />

        {/* Gravura astronômica e pentagramas celestes */}
        <img
          alt=""
          src="./background.svg"
          className={`w-full h-full object-cover mix-blend-screen transition-opacity duration-700 ${
            effectiveTheme === "sol" ? "opacity-55" : "opacity-65"
          }`}
        />

        {/* Vinheta sutil para preservar legibilidade dos cartões */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, transparent 45%, rgba(4, 6, 15, 0.72) 100%)",
          }}
        />
      </div>

      <EclipseHeader />

      <main className="relative z-10 w-full max-w-6xl px-4 mt-7 flex-1">
        <nav
          className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-8 border-b border-white/10"
          aria-label="Navegação principal"
        >
          <button
            type="button"
            onClick={() => handleSwitchTab("encrypt")}
            className={`px-4 md:px-6 py-3 border-b-2 transition-colors flex items-center gap-2 text-sm ${
              activeTab === "encrypt"
                ? tabActiveClass
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Cifrar (Compor Segredo)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab("decrypt")}
            className={`px-4 md:px-6 py-3 border-b-2 transition-colors flex items-center gap-2 text-sm ${
              activeTab === "decrypt"
                ? tabActiveClass
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <LockOpen className="w-4 h-4" />
            <span>Decifrar (Ouvir & Revelar)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab("duet")}
            className={`px-4 md:px-6 py-3 border-b-2 transition-colors flex items-center gap-2 text-sm ${
              activeTab === "duet"
                ? tabActiveClass
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Sessão / Dueto</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab("legend")}
            className={`px-4 md:px-6 py-3 border-b-2 transition-colors flex items-center gap-2 text-sm ${
              activeTab === "legend"
                ? tabActiveClass
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Grimório & Teoria</span>
          </button>
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            {activeTab === "encrypt" && (
              <ComposerTab
                onOpenPdfModal={({ cipherCode, timeline }) =>
                  setPdfModalPayload({ cipherCode, timeline })
                }
                onExportMidi={(timeline, filenameBase) =>
                  downloadMidi(timeline, tempo, filenameBase, true)
                }
                onExportMusicXml={(timeline, filenameBase) =>
                  downloadMusicXml(
                    timeline,
                    { title: "Código Cartier — Partitura", mode },
                    filenameBase
                  )
                }
                onExportPng={(container, filenameBase) => {
                  void exportScoreAsPng(container, effectiveTheme, filenameBase);
                }}
                onCopyShareLink={handleCopyShareLink}
              />
            )}

            {activeTab === "decrypt" && (
              <DecoderTab
                externalCode={sharedCode}
                onImportPdf={handleImportPdf}
              />
            )}

            {activeTab === "duet" && <DuetSession />}

            {activeTab === "legend" && <TheoryGrimoire />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Suspense fallback={null}>
        {pdfModalPayload && (
          <PdfScoreModal
            isOpen={Boolean(pdfModalPayload)}
            onClose={() => setPdfModalPayload(null)}
            cipherCode={pdfModalPayload.cipherCode}
            timeline={pdfModalPayload.timeline}
          />
        )}
      </Suspense>

      <footer className="relative z-10 w-full max-w-6xl px-4 mt-14 pt-5 border-t border-white/10 text-center">
        <p className="text-[11px] text-slate-400/80 font-mono uppercase tracking-widest">
          {OFFICIAL_CREDITS}
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SunMoonThemeProvider>
      <ObservatoryShell />
    </SunMoonThemeProvider>
  );
}
