import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Moon,
  Play,
  Plus,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import { decodeCipher, encodeText } from "../../engine/cipher";
import { buildPlaybackTimeline } from "../../engine/HarmonyEngine";
import { parseRhythmFromLines } from "../../engine/RhythmParser";
import type {
  DuetMessage,
  InstrumentVoice,
  MusicalMode,
  PlaybackTimeline,
} from "../../types/music";

const STORAGE_KEY = "cartier_duet_session_v3";

const INITIAL_SAMPLE_MESSAGES: DuetMessage[] = [
  {
    id: "duet-seed-1",
    senderName: "Priya (Lua)",
    voice: "piano",
    mode: "lua",
    rawText: "NO JARDIM SOB A LUA",
    cipherCode: encodeText("NO JARDIM SOB A LUA", {
      version: "v2",
      mode: "lua",
      voice: "piano",
      format: "code",
    }),
    createdAt: new Date().toISOString(),
  },
  {
    id: "duet-seed-2",
    senderName: "Gabriela (Sol)",
    voice: "cello",
    mode: "sol",
    rawText: "OUCO TUAS CORDAS",
    cipherCode: encodeText("OUCO TUAS CORDAS", {
      version: "v2",
      mode: "sol",
      voice: "cello",
      format: "code",
    }),
    createdAt: new Date().toISOString(),
  },
];

function loadSavedMessages(): DuetMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_SAMPLE_MESSAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignora
  }
  return INITIAL_SAMPLE_MESSAGES;
}

export function buildDuetCombinedTimeline(
  messages: DuetMessage[],
  options: {
    tempo: "adagio" | "andante" | "allegretto";
    timeSignature: "4/4" | "3/4";
    orchestration: "solo" | "noturno" | "sinfonia";
    fidelity: "fiel" | "suave";
    cipherVersion: "v1" | "v2";
  }
): {
  timeline: PlaybackTimeline;
  messageRanges: Array<{ id: string; startSec: number; endSec: number }>;
} {
  let offsetSec = 0;
  const messageRanges: Array<{ id: string; startSec: number; endSec: number }> =
    [];
  const combinedMelody: PlaybackTimeline["melodyEvents"] = [];
  const combinedAcc: PlaybackTimeline["accompanimentEvents"] = [];
  const combinedMeasures: PlaybackTimeline["measuresByLine"] = [];

  for (const msg of messages) {
    const decoded = decodeCipher(msg.cipherCode, {
      manualVersion: options.cipherVersion,
    });
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature: options.timeSignature,
      tempo: options.tempo,
      seedText: msg.cipherCode,
    });
    const partTimeline = buildPlaybackTimeline({
      measuresByLine,
      mode: msg.mode,
      voice: msg.voice,
      orchestration: options.orchestration,
      fidelity: options.fidelity,
      tempo: options.tempo,
      seedText: msg.cipherCode,
    });

    if (partTimeline.totalDurationSeconds <= 0) continue;

    const startSec = offsetSec;
    const endSec = offsetSec + partTimeline.totalDurationSeconds;
    messageRanges.push({ id: msg.id, startSec, endSec });

    partTimeline.melodyEvents.forEach((ev) => {
      combinedMelody.push({
        ...ev,
        id: `${msg.id}-${ev.id}`,
        startTimeSeconds: ev.startTimeSeconds + offsetSec,
      });
    });

    partTimeline.accompanimentEvents.forEach((ev) => {
      combinedAcc.push({
        ...ev,
        id: `${msg.id}-${ev.id}`,
        startTimeSeconds: ev.startTimeSeconds + offsetSec,
      });
    });

    combinedMeasures.push(...partTimeline.measuresByLine);
    offsetSec = endSec + 0.75; // respiro entre vozes no dueto
  }

  const allEvents = [...combinedMelody, ...combinedAcc].sort(
    (a, b) => a.startTimeSeconds - b.startTimeSeconds
  );

  return {
    timeline: {
      totalDurationSeconds: Math.max(0, offsetSec - 0.75),
      melodyEvents: combinedMelody,
      accompanimentEvents: combinedAcc,
      allEvents,
      measuresByLine: combinedMeasures,
    },
    messageRanges,
  };
}

export function DuetSession() {
  const {
    tempo,
    timeSignature,
    orchestration,
    fidelity,
    cipherVersion,
    isAudioReady,
    playback,
    setDuetEclipseActive,
    playTimeline,
    stopPlayback,
  } = useSunMoonTheme();

  const [messages, setMessages] = useState<DuetMessage[]>(loadSavedMessages);
  const [senderVoice, setSenderVoice] = useState<InstrumentVoice>("piano");
  const [inputMode, setInputMode] = useState<"text" | "cipher">("text");
  const [draftText, setDraftText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignora erro de quota
    }
  }, [messages]);

  const duetPlan = useMemo(
    () =>
      buildDuetCombinedTimeline(messages, {
        tempo,
        timeSignature,
        orchestration,
        fidelity,
        cipherVersion,
      }),
    [messages, tempo, timeSignature, orchestration, fidelity, cipherVersion]
  );

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const handleAddMessage = () => {
    if (!draftText.trim()) return;
    const msgMode: MusicalMode = senderVoice === "piano" ? "lua" : "sol";
    const senderName =
      senderVoice === "piano" ? "Priya (Lua)" : "Gabriela (Sol)";

    let cipherCode = "";
    let rawText = "";

    if (inputMode === "text") {
      cipherCode = encodeText(draftText, {
        version: cipherVersion,
        mode: msgMode,
        voice: senderVoice,
        format: "code",
        includeHeader: true,
      });
      rawText = decodeCipher(cipherCode).decodedText;
    } else {
      cipherCode = draftText.trim();
      const dec = decodeCipher(cipherCode, { manualVersion: cipherVersion });
      rawText = dec.decodedText || "(Cifra colada)";
    }

    const nextMsg: DuetMessage = {
      id: `duet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderName,
      voice: senderVoice,
      mode: msgMode,
      rawText,
      cipherCode,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, nextMsg]);
    setDraftText("");
  };

  const handlePlayDuet = () => {
    if (!isAudioReady) {
      showNotice("Ative o áudio primeiro no botão do cabeçalho!");
      return;
    }
    if (playback.isPlaying) {
      stopPlayback();
      setActiveMessageId(null);
      return;
    }
    if (duetPlan.timeline.totalDurationSeconds <= 0) return;

    setDuetEclipseActive(true);
    playTimeline(
      duetPlan.timeline,
      (tick) => {
        const currentRange = duetPlan.messageRanges.find(
          (r) => tick.nowSeconds >= r.startSec && tick.nowSeconds <= r.endSec + 0.5
        );
        setActiveMessageId(currentRange?.id ?? null);
      },
      () => {
        setActiveMessageId(null);
        setDuetEclipseActive(false);
      }
    );
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sessao-dueto-cartier.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const text = await files[0].text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setMessages(parsed);
        showNotice("Sessão de dueto importada!");
      }
    } catch {
      showNotice("Arquivo JSON inválido para sessão de dueto.");
    }
  };

  return (
    <section className="w-full space-y-6">
      <div className="bg-[#110e1f]/85 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-violet-400/30 shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-amber-200 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-300" />
              <span>Sessão de Dueto — O Momento do Eclipse</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300/85 mt-1">
              Alterne mensagens entre o <strong>Piano Lunar (Priya)</strong> e o{" "}
              <strong>Violoncelo Solar (Gabriela)</strong> e toque toda a
              conversa como uma peça única a duas vozes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePlayDuet}
              className={`px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all ${
                playback.isPlaying
                  ? "bg-red-900/60 border border-red-400 text-red-100"
                  : "bg-gradient-to-r from-cyan-600 via-violet-600 to-amber-500 text-white hover:opacity-95"
              }`}
            >
              {playback.isPlaying ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Parar Dueto</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Tocar Conversa (Eclipse)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 rounded-full text-xs bg-black/40 border border-white/15 hover:border-amber-400/50 text-slate-200 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="px-3 py-2 rounded-full text-xs bg-black/40 border border-white/15 hover:border-cyan-400/50 text-slate-200 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar JSON</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImportJson(e.target.files)}
            />
          </div>
        </div>

        {notice && (
          <div className="px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-100 text-xs">
            {notice}
          </div>
        )}

        {/* Lista de mensagens do diálogo musical */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8 italic">
              Nenhuma mensagem na sessão ainda. Adicione a primeira fala abaixo.
            </p>
          ) : (
            messages.map((msg) => {
              const isPiano = msg.voice === "piano";
              const isActive = activeMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`rounded-xl p-4 border transition-all ${
                    isActive
                      ? "ring-2 ring-amber-400 bg-violet-950/50 border-amber-400/70 shadow-lg"
                      : isPiano
                      ? "bg-[#081024]/75 border-cyan-500/25"
                      : "bg-[#1c130b]/75 border-amber-500/25"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {isPiano ? (
                        <Moon className="w-4 h-4 text-cyan-300" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400" />
                      )}
                      <span
                        className={
                          isPiano ? "text-cyan-200" : "text-amber-300"
                        }
                      >
                        {msg.senderName} ·{" "}
                        {isPiano ? "Piano (Lua)" : "Violoncelo (Sol)"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMessages((prev) =>
                          prev.filter((m) => m.id !== msg.id)
                        )
                      }
                      aria-label="Remover mensagem"
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="font-serif italic text-base text-white mb-1.5">
                    "{msg.rawText}"
                  </p>
                  <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all bg-black/35 p-2 rounded-lg border border-white/5">
                    {msg.cipherCode}
                  </pre>
                </div>
              );
            })
          )}
        </div>

        {/* Nova mensagem */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSenderVoice("piano")}
                className={`px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                  senderVoice === "piano"
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-100"
                    : "bg-black/30 border-white/15 text-slate-400"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Priya · Piano (Lua)</span>
              </button>
              <button
                type="button"
                onClick={() => setSenderVoice("cello")}
                className={`px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                  senderVoice === "cello"
                    ? "bg-amber-500/20 border-amber-400 text-amber-100"
                    : "bg-black/30 border-white/15 text-slate-400"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Gabriela · Violoncelo (Sol)</span>
              </button>
            </div>

            <div className="flex rounded-full bg-black/40 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setInputMode("text")}
                className={`px-3 py-1 rounded-full font-semibold ${
                  inputMode === "text"
                    ? "bg-white/15 text-white"
                    : "text-slate-400"
                }`}
              >
                Texto Livre
              </button>
              <button
                type="button"
                onClick={() => setInputMode("cipher")}
                className={`px-3 py-1 rounded-full font-semibold ${
                  inputMode === "cipher"
                    ? "bg-white/15 text-white"
                    : "text-slate-400"
                }`}
              >
                Colar Cifra
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddMessage();
              }}
              placeholder={
                inputMode === "text"
                  ? "Escreva a resposta na conversa..."
                  : "Cole o código Cartier..."
              }
              className="flex-1 bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-violet-400"
            />
            <button
              type="button"
              onClick={handleAddMessage}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar ao Dueto</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
