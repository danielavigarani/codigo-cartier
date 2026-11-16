import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { audioEngine, type PlaybackTickState } from "../engine/AudioEngine";
import { toSoundingNote } from "../engine/HarmonyEngine";
import type {
  CipherVersion,
  InstrumentVoice,
  MusicalMode,
  OrchestrationMode,
  PlaybackFidelity,
  PlaybackTimeline,
  SunMoonMode,
  TempoPreset,
  TimeSignature,
} from "../types/music";

const INITIAL_TICK: PlaybackTickState = {
  isPlaying: false,
  nowSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  revealedText: "",
  activeEventId: null,
  activeLineIndex: 0,
  activeMeasureIndex: 0,
  activeMelodyCipherNote: null,
  activeAccompanimentNotes: [],
  audioEnergy: 0,
};

interface SunMoonThemeContextValue {
  mode: MusicalMode;
  manualTheme: "auto" | SunMoonMode;
  visualTheme: SunMoonMode;
  voice: InstrumentVoice;
  orchestration: OrchestrationMode;
  fidelity: PlaybackFidelity;
  tempo: TempoPreset;
  timeSignature: TimeSignature;
  cipherVersion: CipherVersion;
  isMuted: boolean;
  volume: number;
  reducedMotion: boolean;
  isAudioReady: boolean;
  isLoadingAudio: boolean;
  sampleProgress: number;
  duetEclipseActive: boolean;
  playback: PlaybackTickState;
  setMode: (mode: MusicalMode) => void;
  setManualTheme: (theme: "auto" | SunMoonMode) => void;
  setVoice: (voice: InstrumentVoice) => void;
  setOrchestration: (orch: OrchestrationMode) => void;
  setFidelity: (fid: PlaybackFidelity) => void;
  setTempo: (tempo: TempoPreset) => void;
  setTimeSignature: (sig: TimeSignature) => void;
  setCipherVersion: (ver: CipherVersion) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  toggleReducedMotion: () => void;
  setDuetEclipseActive: (active: boolean) => void;
  initAudio: () => Promise<void>;
  stopPlayback: () => void;
  playTimeline: (
    timeline: PlaybackTimeline,
    onTick?: (state: PlaybackTickState) => void,
    onComplete?: () => void
  ) => void;
  playSingleCipherNote: (
    cipherNote: string,
    voiceOverride?: InstrumentVoice,
    modeOverride?: MusicalMode,
    explicitSounding?: string
  ) => void;
  playGlissando: () => void;
}

const SunMoonThemeContext = createContext<SunMoonThemeContextValue | null>(
  null
);

export function SunMoonThemeProvider({ children }: { children: ReactNode }) {
  // Padrão confirmado: Lua = Piano, Sol = Harpa de Concerto
  const [mode, setModeState] = useState<MusicalMode>("lua");
  const [manualTheme, setManualThemeState] = useState<"auto" | SunMoonMode>(
    "auto"
  );
  const [voice, setVoiceState] = useState<InstrumentVoice>("piano");
  const [orchestration, setOrchestrationState] =
    useState<OrchestrationMode>("noturno");
  const [fidelity, setFidelityState] = useState<PlaybackFidelity>("fiel");
  const [tempo, setTempoState] = useState<TempoPreset>("andante");
  const [timeSignature, setTimeSignatureState] =
    useState<TimeSignature>("4/4");
  const [cipherVersion, setCipherVersionState] =
    useState<CipherVersion>("v2");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cartier_volume_v3");
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed)) return Math.max(0, Math.min(100, parsed));
      }
    } catch {
      // ignora
    }
    return 85;
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const [duetEclipseActive, setDuetEclipseActive] = useState(false);
  const [playback, setPlayback] = useState<PlaybackTickState>(INITIAL_TICK);

  const stopPlayback = useCallback(() => {
    audioEngine.stop();
    setDuetEclipseActive(false);
    setPlayback(INITIAL_TICK);
  }, []);

  const setMode = useCallback(
    (nextMode: MusicalMode) => {
      stopPlayback();
      setModeState(nextMode);
      // Associação oficial: Lua -> Piano, Sol -> Harpa de Concerto
      setVoiceState(nextMode === "lua" ? "piano" : "harp");
      audioEngine.setModeTimbre(nextMode);
    },
    [stopPlayback]
  );

  const setManualTheme = useCallback((theme: "auto" | SunMoonMode) => {
    setManualThemeState(theme);
  }, []);

  const setVoice = useCallback(
    (nextVoice: InstrumentVoice) => {
      stopPlayback();
      setVoiceState(nextVoice);
    },
    [stopPlayback]
  );

  const setOrchestration = useCallback(
    (orch: OrchestrationMode) => {
      stopPlayback();
      setOrchestrationState(orch);
    },
    [stopPlayback]
  );

  const setFidelity = useCallback(
    (fid: PlaybackFidelity) => {
      stopPlayback();
      setFidelityState(fid);
    },
    [stopPlayback]
  );

  const setTempo = useCallback(
    (t: TempoPreset) => {
      stopPlayback();
      setTempoState(t);
    },
    [stopPlayback]
  );

  const setTimeSignature = useCallback(
    (sig: TimeSignature) => {
      stopPlayback();
      setTimeSignatureState(sig);
    },
    [stopPlayback]
  );

  const setCipherVersion = useCallback(
    (ver: CipherVersion) => {
      stopPlayback();
      setCipherVersionState(ver);
    },
    [stopPlayback]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      return next;
    });
  }, []);

  const setVolume = useCallback((nextVol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(nextVol)));
    setVolumeState(clamped);
    audioEngine.setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
      audioEngine.setMuted(false);
    }
    try {
      localStorage.setItem("cartier_volume_v3", String(clamped));
    } catch {
      // ignora
    }
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => !prev);
  }, []);

  const initAudio = useCallback(async () => {
    if (isAudioReady || isLoadingAudio) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.init((pct) => setSampleProgress(pct));
      audioEngine.setModeTimbre(mode);
      audioEngine.setVolume(volume);
      audioEngine.setMuted(isMuted);
      setIsAudioReady(true);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [isAudioReady, isLoadingAudio, mode, volume, isMuted]);

  const playTimeline = useCallback(
    (
      timeline: PlaybackTimeline,
      onTick?: (state: PlaybackTickState) => void,
      onComplete?: () => void
    ) => {
      if (!audioEngine.isReady()) return;
      audioEngine.playTimeline(
        timeline,
        (tick) => {
          setPlayback(tick);
          onTick?.(tick);
        },
        () => {
          setDuetEclipseActive(false);
          setPlayback(INITIAL_TICK);
          onComplete?.();
        }
      );
    },
    []
  );

  const playSingleCipherNote = useCallback(
    (
      cipherNote: string,
      voiceOverride?: InstrumentVoice,
      modeOverride?: MusicalMode,
      explicitSounding?: string
    ) => {
      if (!audioEngine.isReady()) return;
      const targetMode = modeOverride ?? mode;
      const targetVoice = voiceOverride ?? voice;
      const sounding =
        explicitSounding ?? toSoundingNote(cipherNote, targetMode);
      audioEngine.playSingleNote(sounding, targetVoice, 0.85, 0.82);
    },
    [mode, voice]
  );

  const playGlissando = useCallback(() => {
    if (!audioEngine.isReady()) return;
    audioEngine.playHarpGlissando(mode);
  }, [mode]);

  const visualTheme: SunMoonMode = useMemo(() => {
    if (manualTheme !== "auto") return manualTheme;
    if (
      duetEclipseActive ||
      (playback.isPlaying && orchestration === "sinfonia")
    ) {
      return "eclipse";
    }
    return mode;
  }, [
    manualTheme,
    duetEclipseActive,
    playback.isPlaying,
    orchestration,
    mode,
  ]);

  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);

  const value: SunMoonThemeContextValue = {
    mode,
    manualTheme,
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
    duetEclipseActive,
    playback,
    setMode,
    setManualTheme,
    setVoice,
    setOrchestration,
    setFidelity,
    setTempo,
    setTimeSignature,
    setCipherVersion,
    toggleMute,
    setVolume,
    toggleReducedMotion,
    setDuetEclipseActive,
    initAudio,
    stopPlayback,
    playTimeline,
    playSingleCipherNote,
    playGlissando,
  };

  return (
    <SunMoonThemeContext.Provider value={value}>
      {children}
    </SunMoonThemeContext.Provider>
  );
}

export function useSunMoonTheme() {
  const ctx = useContext(SunMoonThemeContext);
  if (!ctx) {
    throw new Error(
      "useSunMoonTheme deve ser usado dentro de SunMoonThemeProvider"
    );
  }
  return ctx;
}
