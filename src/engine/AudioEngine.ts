import * as Tone from "tone";
import type {
  InstrumentVoice,
  MusicalMode,
  PlaybackTimeline,
  ScheduledPlaybackEvent,
} from "../types/music";

const PIANO_SAMPLE_URLS: Record<string, string> = {
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
};

/**
 * Harpa de Concerto (Harpa Astral): 18 amostras reais de D2 a B6 (tonejs-instruments, CC-BY 3.0),
 * cobrindo toda a extensão da cifra v2 (A2–E6) sem necessidade de transposição de oitava.
 */
const HARP_BASE_URL = "./samples/harp/";
const HARP_SAMPLE_URLS: Record<string, string> = {
  D2: "D2.mp3",
  F2: "F2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  E3: "E3.mp3",
  G3: "G3.mp3",
  B3: "B3.mp3",
  D4: "D4.mp3",
  F4: "F4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  E5: "E5.mp3",
  G5: "G5.mp3",
  B5: "B5.mp3",
  D6: "D6.mp3",
  F6: "F6.mp3",
  A6: "A6.mp3",
  B6: "B6.mp3",
};

export interface PlaybackTickState {
  isPlaying: boolean;
  nowSeconds: number;
  totalDurationSeconds: number;
  progress: number;
  revealedText: string;
  activeEventId: string | null;
  activeLineIndex: number;
  activeMeasureIndex: number;
  activeMelodyCipherNote: string | null;
  activeAccompanimentNotes: string[];
  audioEnergy: number;
}

class CartierAudioEngine {
  private pianoSampler: Tone.Sampler | null = null;
  private harpSampler: Tone.Sampler | null = null;
  private pianoFilter: Tone.Filter | null = null;
  private harpEq: Tone.EQ3 | null = null;
  private harpDelay: Tone.FeedbackDelay | null = null;
  private masterReverb: Tone.Reverb | null = null;
  private masterDelay: Tone.FeedbackDelay | null = null;
  private masterCompressor: Tone.Compressor | null = null;
  private analyser: Tone.Analyser | null = null;

  private initialized = false;
  private initializingPromise: Promise<void> | null = null;
  private muted = false;
  private volumePercent = 85;
  private reverbWet = 0.34;
  private rafId: number | null = null;
  private activeTimeline: PlaybackTimeline | null = null;

  async init(onProgress?: (percent: number) => void): Promise<void> {
    if (this.initialized) {
      onProgress?.(100);
      return;
    }
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      await Tone.start();

      // Aquece o cache local dos 33 arquivos de samples (15 piano + 18 harpa)
      const urlsToWarm = [
        ...Object.values(PIANO_SAMPLE_URLS).map((f) => `./samples/piano/${f}`),
        ...Object.values(HARP_SAMPLE_URLS).map((f) => `${HARP_BASE_URL}${f}`),
      ];
      let loadedCount = 0;
      const totalFiles = urlsToWarm.length;
      onProgress?.(5);

      await Promise.all(
        urlsToWarm.map(async (url) => {
          try {
            await fetch(url);
          } catch {
            // Se um arquivo falhar no preview, o Sampler ainda tenta carregar
          } finally {
            loadedCount++;
            onProgress?.(Math.round((loadedCount / totalFiles) * 85));
          }
        })
      );

      this.analyser = new Tone.Analyser("fft", 64);
      this.masterCompressor = new Tone.Compressor({
        threshold: -16,
        ratio: 3,
        attack: 0.015,
        release: 0.25,
      });
      this.masterDelay = new Tone.FeedbackDelay({
        delayTime: "8n.",
        feedback: 0.14,
        wet: 0.1,
      });
      this.masterReverb = new Tone.Reverb({
        decay: 3.6,
        preDelay: 0.02,
        wet: this.reverbWet,
      });

      this.masterReverb.chain(
        this.masterCompressor,
        this.analyser,
        Tone.getDestination()
      );

      // Piano Lunar: filtro ajustável + delay etéreo sutil
      this.pianoFilter = new Tone.Filter({
        frequency: 4200,
        type: "lowpass",
        rolloff: -12,
      });
      this.pianoFilter.chain(this.masterDelay, this.masterReverb);

      // Harpa Astral Solar: EQ acústico valorizando caixa de madeira (220 Hz) e brilho de cordas (4.2 kHz)
      // com delay cristalino dedicado que realça arpejos e glissandos
      this.harpEq = new Tone.EQ3({
        low: 2.5,
        mid: 0.5,
        high: 2,
        lowFrequency: 220,
        highFrequency: 4200,
      });
      this.harpDelay = new Tone.FeedbackDelay({
        delayTime: "8n.",
        feedback: 0.16,
        wet: 0.15,
      });
      this.harpEq.chain(this.harpDelay, this.masterReverb);

      this.pianoSampler = new Tone.Sampler({
        urls: PIANO_SAMPLE_URLS,
        release: 1.2,
        baseUrl: "./samples/piano/",
      }).connect(this.pianoFilter);

      this.harpSampler = new Tone.Sampler({
        urls: HARP_SAMPLE_URLS,
        attack: 0,
        release: 1.9,
        baseUrl: HARP_BASE_URL,
      }).connect(this.harpEq);

      await Tone.loaded();
      this.applyDestinationVolume();
      onProgress?.(100);
      this.initialized = true;
    })();

    try {
      await this.initializingPromise;
    } finally {
      this.initializingPromise = null;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  setModeTimbre(mode: MusicalMode) {
    if (!this.pianoFilter) return;
    // Modo Lua: timbre mais íntimo e aveludado; Modo Sol: brilho mais aberto
    this.pianoFilter.frequency.value = mode === "lua" ? 3600 : 12000;
  }

  setReverbWet(wet: number) {
    this.reverbWet = Math.max(0, Math.min(0.85, wet));
    if (this.masterReverb) {
      this.masterReverb.wet.value = this.reverbWet;
    }
  }

  private applyDestinationVolume() {
    try {
      const dest = Tone.getDestination();
      if (this.muted || this.volumePercent <= 0) {
        dest.mute = true;
      } else {
        dest.mute = false;
        const normalized = Math.max(
          0.001,
          Math.min(1, this.volumePercent / 100)
        );
        dest.volume.value = Tone.gainToDb(Math.pow(normalized, 1.35));
      }
    } catch {
      // ignora em ambiente sem AudioContext
    }
  }

  setVolume(volumePercent: number) {
    this.volumePercent = Math.max(0, Math.min(100, volumePercent));
    this.applyDestinationVolume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyDestinationVolume();
  }

  private triggerInstrumentNote(
    sampler: Tone.Sampler,
    voice: InstrumentVoice,
    noteName: string,
    durationSeconds: number,
    time: number,
    velocity: number
  ) {
    if (voice === "harp") {
      // Corda pinçada: mantém ressonância natural leve sem precisar esticar nem dobrar
      const harpDur = Math.max(0.28, durationSeconds * 1.45);
      sampler.triggerAttackRelease(noteName, harpDur, time, velocity);
      return;
    }

    sampler.triggerAttackRelease(
      noteName,
      Math.max(0.14, durationSeconds),
      time,
      velocity
    );
  }

  playSingleNote(
    soundingNote: string,
    voice: InstrumentVoice,
    durationSeconds = 0.85,
    velocity = 0.82
  ) {
    if (!this.initialized || this.muted || this.volumePercent <= 0) return;
    const sampler = voice === "harp" ? this.harpSampler : this.pianoSampler;
    if (!sampler) return;
    try {
      this.triggerInstrumentNote(
        sampler,
        voice,
        soundingNote,
        durationSeconds,
        Tone.now(),
        velocity
      );
    } catch {
      // ignora se nota inválida
    }
  }

  /**
   * Dispara um glissando celestial de harpa na tonalidade ativa (Lá Menor Lunar ou Lá Maior Solar).
   */
  playHarpGlissando(mode: MusicalMode) {
    if (
      !this.initialized ||
      !this.harpSampler ||
      this.muted ||
      this.volumePercent <= 0
    ) {
      return;
    }
    const scale =
      mode === "sol"
        ? [
            "A2",
            "B2",
            "C#3",
            "D3",
            "E3",
            "F#3",
            "G#3",
            "A3",
            "B3",
            "C#4",
            "D4",
            "E4",
            "F#4",
            "G#4",
            "A4",
            "C#5",
            "E5",
            "A5",
          ]
        : [
            "A2",
            "B2",
            "C3",
            "D3",
            "E3",
            "F3",
            "G3",
            "A3",
            "B3",
            "C4",
            "D4",
            "E4",
            "F4",
            "G4",
            "A4",
            "C5",
            "E5",
            "A5",
          ];

    const start = Tone.now() + 0.02;
    scale.forEach((note, idx) => {
      const t = start + idx * 0.038;
      const vel = Math.min(0.85, 0.42 + idx * 0.022);
      try {
        this.harpSampler?.triggerAttackRelease(note, 1.4, t, vel);
      } catch {
        // ignora falha pontual
      }
    });
  }

  private getAnalyserEnergy(): number {
    if (!this.analyser) return 0;
    try {
      const vals = this.analyser.getValue();
      if (!(vals instanceof Float32Array) || vals.length === 0) return 0;
      let sum = 0;
      const bins = Math.min(24, vals.length);
      for (let i = 0; i < bins; i++) {
        const normalized = Math.max(0, Math.min(1, (vals[i] + 90) / 70));
        sum += normalized;
      }
      return sum / bins;
    } catch {
      return 0;
    }
  }

  /**
   * Agenda toda a timeline no único relógio Tone.Transport e dirige a UI via requestAnimationFrame.
   */
  playTimeline(
    timeline: PlaybackTimeline,
    onTick: (state: PlaybackTickState) => void,
    onComplete: () => void
  ) {
    if (!this.initialized || timeline.totalDurationSeconds <= 0) return;
    this.stop();

    this.activeTimeline = timeline;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.seconds = 0;

    timeline.allEvents.forEach((ev: ScheduledPlaybackEvent) => {
      if (!ev.soundingNote) return;
      const sampler =
        ev.voice === "harp" ? this.harpSampler : this.pianoSampler;
      if (!sampler) return;

      transport.schedule((time) => {
        if (!this.muted && this.volumePercent > 0) {
          try {
            this.triggerInstrumentNote(
              sampler,
              ev.voice,
              ev.soundingNote,
              ev.durationSeconds,
              time,
              ev.velocity
            );
          } catch {
            // ignora falha pontual
          }
        }
      }, ev.startTimeSeconds);
    });

    const endTime = timeline.totalDurationSeconds + 0.45;
    transport.schedule(() => {
      this.stop();
      onComplete();
    }, endTime);

    const tick = () => {
      if (!this.activeTimeline || transport.state !== "started") return;
      const now = transport.seconds;
      const progress = Math.max(
        0,
        Math.min(1, now / Math.max(0.01, timeline.totalDurationSeconds))
      );

      let latestReveal = "";
      let activeMelody: ScheduledPlaybackEvent | null = null;

      for (const ev of timeline.melodyEvents) {
        if (now >= ev.startTimeSeconds) {
          if (ev.revealTextSoFar.length >= latestReveal.length) {
            latestReveal = ev.revealTextSoFar;
          }
          if (
            ev.isMelody &&
            now < ev.startTimeSeconds + ev.durationSeconds
          ) {
            activeMelody = ev;
          }
        } else {
          break;
        }
      }

      const activeAccNotes: string[] = [];
      for (const ev of timeline.accompanimentEvents) {
        if (
          now >= ev.startTimeSeconds &&
          now < ev.startTimeSeconds + ev.durationSeconds
        ) {
          activeAccNotes.push(ev.cipherNote || ev.soundingNote);
        }
      }

      onTick({
        isPlaying: true,
        nowSeconds: now,
        totalDurationSeconds: timeline.totalDurationSeconds,
        progress,
        revealedText: latestReveal,
        activeEventId: activeMelody?.eventId ?? null,
        activeLineIndex: activeMelody?.lineIndex ?? 0,
        activeMeasureIndex: activeMelody?.measureIndex ?? 0,
        activeMelodyCipherNote: activeMelody?.cipherNote || null,
        activeAccompanimentNotes: activeAccNotes,
        audioEnergy: this.getAnalyserEnergy(),
      });

      this.rafId = requestAnimationFrame(tick);
    };

    transport.start();
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.activeTimeline = null;
    try {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      transport.seconds = 0;
    } catch {
      // ignora em ambiente sem AudioContext
    }
    try {
      this.pianoSampler?.releaseAll();
      this.harpSampler?.releaseAll();
    } catch {
      // ignora
    }
  }
}

export const audioEngine = new CartierAudioEngine();
