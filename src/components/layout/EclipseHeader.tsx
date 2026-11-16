import { motion } from "framer-motion";
import {
  AlertCircle,
  Loader2,
  Moon,
  Music2,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { TEMPO_LABELS } from "../../constants/cipherRules";
import { useSunMoonTheme } from "../../context/SunMoonThemeContext";
import type {
  OrchestrationMode,
  TempoPreset,
  TimeSignature,
} from "../../types/music";

function AstrolabeEmblem() {
  const { visualTheme, playback, reducedMotion, mode, setMode, setManualTheme } =
    useSunMoonTheme();

  const rotationDeg = playback.isPlaying ? playback.progress * 360 : 0;
  const energyScale =
    !reducedMotion && playback.isPlaying ? 1 + playback.audioEnergy * 0.14 : 1;

  const isEclipse = visualTheme === "eclipse";
  const isSol = visualTheme === "sol";

  const primaryStroke = isSol
    ? "#D4AF37"
    : isEclipse
    ? "#EAB308"
    : "#CBD5E1";
  const accentGlow = isSol
    ? "rgba(212, 175, 55, 0.35)"
    : isEclipse
    ? "rgba(167, 139, 250, 0.45)"
    : "rgba(103, 232, 249, 0.3)";

  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center"
        aria-label="Astrolábio do Eclipse"
      >
        {/* Halo pulsante alimentado pelo Analyser */}
        <motion.div
          animate={{ scale: energyScale }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 180, damping: 18 }
          }
          className="absolute inset-2 rounded-full pointer-events-none"
          style={{
            boxShadow: `0 0 38px ${accentGlow}, inset 0 0 22px ${accentGlow}`,
          }}
        />

        <svg
          viewBox="0 0 200 200"
          className="w-full h-full overflow-visible drop-shadow-xl"
        >
          <defs>
            <radialGradient id="eclipseCore" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isEclipse ? "#090814" : isSol ? "#FDE68A" : "#E2E8F0"}
              />
              <stop
                offset="70%"
                stopColor={isEclipse ? "#1E1B4B" : isSol ? "#D4AF37" : "#94A3B8"}
              />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Anel externo graduado (gira conforme progresso do Tone.Transport) */}
          <g
            style={{
              transform: `rotate(${rotationDeg}deg)`,
              transformOrigin: "100px 100px",
              transition: playback.isPlaying ? "none" : "transform 0.5s ease-out",
            }}
          >
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={primaryStroke}
              strokeOpacity="0.45"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <circle
              cx="100"
              cy="100"
              r="76"
              fill="none"
              stroke={primaryStroke}
              strokeOpacity="0.7"
              strokeWidth="1.4"
            />
            {ticks.map((deg) => (
              <line
                key={deg}
                x1="100"
                y1={deg % 45 === 0 ? "12" : "18"}
                x2="100"
                y2="24"
                stroke={primaryStroke}
                strokeWidth={deg % 45 === 0 ? "1.6" : "0.9"}
                strokeOpacity={deg % 45 === 0 ? "0.85" : "0.4"}
                transform={`rotate(${deg} 100 100)`}
              />
            ))}
            {/* Ponteiro astral */}
            <polygon
              points="100,8 96,24 104,24"
              fill={isSol || isEclipse ? "#FBBF24" : "#67E8F9"}
            />
          </g>

          {/* Anel armilar interno (rotação contrária sutil) */}
          <g
            style={{
              transform: `rotate(${-rotationDeg * 0.5}deg)`,
              transformOrigin: "100px 100px",
            }}
          >
            <ellipse
              cx="100"
              cy="100"
              rx="58"
              ry="42"
              fill="none"
              stroke={primaryStroke}
              strokeOpacity="0.45"
              strokeWidth="1"
              transform="rotate(28 100 100)"
            />
            <ellipse
              cx="100"
              cy="100"
              rx="58"
              ry="42"
              fill="none"
              stroke={primaryStroke}
              strokeOpacity="0.45"
              strokeWidth="1"
              transform="rotate(-28 100 100)"
            />
          </g>

          {/* Núcleo Sol & Lua / Eclipse */}
          {isEclipse ? (
            <g>
              <circle
                cx="100"
                cy="100"
                r="31"
                fill="#D4AF37"
                fillOpacity="0.25"
                stroke="#FBBF24"
                strokeWidth="1.5"
              />
              <circle
                cx="100"
                cy="100"
                r="24"
                fill="#070918"
                stroke="#CBD5E1"
                strokeWidth="1.6"
              />
              <circle cx="122" cy="79" r="3" fill="#67E8F9" />
            </g>
          ) : isSol ? (
            <g>
              <circle cx="100" cy="100" r="24" fill="url(#eclipseCore)" />
              <circle
                cx="100"
                cy="100"
                r="17"
                fill="#D4AF37"
                stroke="#FEF3C7"
                strokeWidth="1.2"
              />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <line
                  key={a}
                  x1="100"
                  y1="69"
                  x2="100"
                  y2="76"
                  stroke="#FBBF24"
                  strokeWidth="1.6"
                  transform={`rotate(${a} 100 100)`}
                />
              ))}
            </g>
          ) : (
            <g>
              <circle cx="100" cy="100" r="24" fill="url(#eclipseCore)" opacity="0.35" />
              <path
                d="M107 79 A21 21 0 1 0 116 116 A16 16 0 1 1 107 79 Z"
                fill="#E2E8F0"
                stroke="#67E8F9"
                strokeWidth="1.2"
              />
              <circle cx="116" cy="87" r="1.8" fill="#67E8F9" />
            </g>
          )}
        </svg>
      </div>

      {/* Seletor rápido do emblema Sol / Eclipse / Lua */}
      <div className="flex items-center gap-1.5 mt-2 bg-black/35 border border-white/10 rounded-full p-1 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            setMode("lua");
            setManualTheme("auto");
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            mode === "lua" && visualTheme !== "eclipse"
              ? "bg-slate-200/15 text-cyan-200 border border-cyan-400/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Lua · Piano</span>
        </button>

        <button
          type="button"
          onClick={() => setManualTheme(visualTheme === "eclipse" ? "auto" : "eclipse")}
          title="Alternar tema visual Eclipse"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
            visualTheme === "eclipse"
              ? "bg-violet-500/25 text-amber-200 border border-amber-400/50"
              : "text-slate-400 hover:text-amber-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Eclipse</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("sol");
            setManualTheme("auto");
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            mode === "sol" && visualTheme !== "eclipse"
              ? "bg-amber-500/20 text-amber-200 border border-amber-400/45 shadow-sm"
              : "text-slate-400 hover:text-amber-200"
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Sol · Harpa</span>
        </button>
      </div>
    </div>
  );
}

export function EclipseHeader() {
  const {
    mode,
    visualTheme,
    voice,
    orchestration,
    fidelity,
    tempo,
    timeSignature,
    cipherVersion,
    isMuted,
    volume,
    reducedMotion,
    isAudioReady,
    isLoadingAudio,
    sampleProgress,
    setVoice,
    setOrchestration,
    setFidelity,
    setTempo,
    setTimeSignature,
    setCipherVersion,
    toggleMute,
    setVolume,
    toggleReducedMotion,
    initAudio,
    playGlissando,
  } = useSunMoonTheme();

  const isSol = visualTheme === "sol";
  const isEclipse = visualTheme === "eclipse";

  const titleColor = isSol
    ? "text-[#D4AF37]"
    : isEclipse
    ? "text-amber-200"
    : "text-slate-100";

  const borderClass = isSol
    ? "border-amber-500/25"
    : isEclipse
    ? "border-violet-400/30"
    : "border-slate-700/70";

  return (
    <header
      className={`relative z-10 w-full max-w-6xl px-4 sm:px-6 pt-6 pb-7 border-b ${borderClass} flex flex-col items-center`}
    >
      <div className="flex flex-col md:flex-row items-center justify-center gap-5 w-full">
        <AstrolabeEmblem />

        <div className="text-center md:text-left max-w-xl">
          <p
            className={`text-[10px] uppercase tracking-[0.35em] font-mono mb-1 ${
              isSol
                ? "text-amber-400/85"
                : isEclipse
                ? "text-violet-300"
                : "text-cyan-300/85"
            }`}
          >
            Observatório do Eclipse · Edição Sinfônica
          </p>
          <h1
            className={`text-4xl sm:text-5xl md:text-6xl font-display font-bold tracking-wide drop-shadow-lg ${titleColor}`}
          >
            Código Cartier
          </h1>
          <p className="text-slate-300/85 text-sm sm:text-base font-serif italic mt-1">
            "Onde as palavras falham, a música fala." —{" "}
            {mode === "lua"
              ? "Modo Lua (Lá Menor Natural · Piano de Priya)"
              : "Modo Sol (Lá Maior 3# · Harpa Astral de Gabriela)"}
          </p>
        </div>
      </div>

      {/* Ativação obrigatória de áudio + Progresso dos samples locais */}
      {!isAudioReady ? (
        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            disabled={isLoadingAudio}
            onClick={initAudio}
            className={`group relative inline-flex items-center justify-center px-8 py-3 text-sm sm:text-base font-semibold rounded-full border transition-all shadow-xl ${
              isSol
                ? "bg-amber-950/70 border-amber-400/60 text-amber-100 hover:bg-amber-900/60"
                : "bg-slate-900/90 border-cyan-400/50 text-slate-100 hover:bg-slate-800"
            }`}
          >
            {isLoadingAudio ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin text-amber-400" />
                <span>Carregando Instrumentos Locais... {sampleProgress}%</span>
              </>
            ) : (
              <>
                <Music2 className="w-5 h-5 mr-2 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Iniciar Sessão Musical (Ativar Áudio)</span>
              </>
            )}
          </button>

          {isLoadingAudio ? (
            <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-400 transition-all duration-200"
                style={{ width: `${sampleProgress}%` }}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              (Clique para ativar os samples locais de Piano e Harpa Astral)
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 w-full flex flex-col items-center gap-3">
          {/* Linha principal: Slider de Voz + Versão + Mute + Reduzir Efeitos */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <div className="relative bg-black/45 rounded-full p-1 border border-white/15 shadow-lg flex w-full max-w-[360px] h-14">
              <div
                className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out shadow-md z-0 ${
                  voice === "harp"
                    ? "translate-x-full bg-gradient-to-r from-amber-700 to-amber-500"
                    : "translate-x-0 bg-gradient-to-r from-slate-700 to-cyan-700"
                }`}
              />
              <button
                type="button"
                onClick={() => setVoice("piano")}
                className={`relative z-10 w-1/2 h-full rounded-full flex flex-col justify-center items-center leading-tight transition-colors ${
                  voice === "piano"
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-sm font-bold">Piano</span>
                <span className="text-[10px] opacity-85">Lua · Agilidade</span>
              </button>
              <button
                type="button"
                onClick={() => setVoice("harp")}
                className={`relative z-10 w-1/2 h-full rounded-full flex flex-col justify-center items-center leading-tight transition-colors ${
                  voice === "harp"
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-sm font-bold">Harpa Astral</span>
                <span className="text-[10px] opacity-85">Sol · Ressonância</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <div
                className="flex rounded-full bg-black/40 p-1 border border-white/10 text-xs"
                role="group"
                aria-label="Versão da cifra"
              >
                <button
                  type="button"
                  onClick={() => setCipherVersion("v2")}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
                    cipherVersion === "v2"
                      ? "bg-amber-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  v2 SPN
                </button>
                <button
                  type="button"
                  onClick={() => setCipherVersion("v1")}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
                    cipherVersion === "v1"
                      ? "bg-amber-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  v1 Legado
                </button>
              </div>

              <div className="flex items-center gap-2 bg-black/45 border border-white/15 rounded-full pl-1 pr-3 py-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Ativar som" : "Silenciar som"}
                  title={isMuted ? "Desmutar" : "Mutar"}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-all text-amber-300"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume do áudio"
                  className="w-20 sm:w-24 accent-amber-400 cursor-pointer h-1.5"
                />
                <span className="text-[11px] font-mono text-slate-300 w-8 text-right tabular-nums">
                  {isMuted ? 0 : volume}%
                </span>
              </div>

              <button
                type="button"
                onClick={toggleReducedMotion}
                aria-pressed={reducedMotion}
                className={`px-3 py-2 rounded-full text-[11px] font-medium border transition-colors ${
                  reducedMotion
                    ? "bg-violet-500/20 border-violet-400/50 text-violet-200"
                    : "bg-black/35 border-white/10 text-slate-400 hover:text-slate-200"
                }`}
              >
                {reducedMotion ? "Efeitos Reduzidos" : "Reduzir Efeitos"}
              </button>
            </div>
          </div>

          {/* Linha secundária: Controles de Sessão Musical (Orquestração, Fiel/Suave, BPM, Compasso) */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs bg-black/30 border border-white/10 rounded-2xl px-3 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">
                Orquestra:
              </span>
              {(
                [
                  { id: "solo", label: "Solo" },
                  { id: "noturno", label: "Noturno" },
                  { id: "sinfonia", label: "Sinfonia" },
                ] as Array<{ id: OrchestrationMode; label: string }>
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrchestration(o.id)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    orchestration === o.id
                      ? "bg-amber-500/25 text-amber-200 border border-amber-400/50"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <button
                type="button"
                onClick={() => setFidelity("fiel")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  fidelity === "fiel"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Fiel
              </button>
              <button
                type="button"
                onClick={() => setFidelity("suave")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  fidelity === "suave"
                    ? "bg-violet-500/25 text-violet-200 border border-violet-400/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Suave
              </button>
            </div>

            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              {(["adagio", "andante", "allegretto"] as TempoPreset[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTempo(t)}
                    title={TEMPO_LABELS[t]}
                    className={`px-2.5 py-1 rounded-full font-semibold capitalize transition-colors ${
                      tempo === t
                        ? "bg-white/15 text-white border border-white/25"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              {(["4/4", "3/4"] as TimeSignature[]).map((sig) => (
                <button
                  key={sig}
                  type="button"
                  onClick={() => setTimeSignature(sig)}
                  className={`px-2.5 py-1 rounded-full font-mono font-semibold transition-colors ${
                    timeSignature === sig
                      ? "bg-white/15 text-white border border-white/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sig === "3/4" ? "3/4 Valsa" : "4/4"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={playGlissando}
              title="Tocar glissando celestial na Harpa Astral"
              className="px-3 py-1 rounded-full font-semibold bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Glissando Astral</span>
            </button>
          </div>

          {fidelity === "suave" && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 rounded-full px-3 py-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                Modo Suave ativo: oitavas suavizadas no playback — não use para
                decifrar de ouvido (a partitura e o piano mostram a nota real).
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
