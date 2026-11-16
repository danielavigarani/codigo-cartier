import * as Tone from "tone";
import { Note } from "tonal";
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

const CELLO_SAMPLE_URLS: Record<string, string> = {
  C2: "C2.mp3",
  D2: "D2.mp3",
  E2: "E2.mp3",
  F2: "F2.mp3",
  G2: "G2.mp3",
  "G#2": "Gs2.mp3",
  A2: "A2.mp3",
  "A#2": "As2.mp3",
  C3: "C3.mp3",
  D3: "D3.mp3",
  "D#3": "Ds3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "Fs3.mp3",
  G3: "G3.mp3",
  "G#3": "Gs3.mp3",
  A3: "A3.mp3",
  "A#3": "As3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  D4: "D4.mp3",
  "D#4": "Ds4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "Fs4.mp3",
  G4: "G4.mp3",
  "G#4": "Gs4.mp3",
  A4: "A4.mp3",
  B4: "B4.mp3",
  C5: "C5.mp3",
};

/**
 * Conduz notas agudas (>= C4) para a tessitura barítono/tenor imponente do violoncelo (C2–B3),
 * preservando exatamente a classe de altura (C..B, com sustenidos quando houver) e retornando
 * uma sub-oitava opcional (-12 semitons) para corpo sinfônico.
 */
export function toImposingCelloRegister(noteName: string): {
  mainNote: string;
  subBassNote: string | null;
} {
  const midi = Note.midi(noteName);
  if (midi == null) return { mainNote: noteName, subBassNote: null };

  const useSharps = noteName.includes("#");
  let targetMidi = midi;
  while (targetMidi >= 60) {
    // >= C4 desce para C3–B3 (ou C2–B3)
    targetMidi -= 12;
  }
  while (targetMidi < 36) {
    // >= C2
    targetMidi += 12;
  }

  const formatNote = (m: number) =>
    (useSharps ? Note.fromMidiSharps(m) : Note.fromMidi(m)) || noteName;

  const mainNote = formatNote(targetMidi);
  // Camada sub-oitava sutil apenas se permanecer dentro do registro real >= C2 (MIDI 36)
  const subMidi = targetMidi - 12;
  const subBassNote = subMidi >= 36 ? formatNote(subMidi) : null;

  return { mainNote, subBassNote };
}

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
  private celloSampler: Tone.Sampler | null = null;
  private pianoFilter: Tone.Filter | null = null;
  private celloFilter: Tone.Filter | null = null;
  private celloEq: Tone.EQ3 | null = null;
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

      // Aquece o cache local dos 45 arquivos de samples com progresso real (0–85%)
      const urlsToWarm = [
        ...Object.values(PIANO_SAMPLE_URLS).map((f) => `./samples/piano/${f}`),
        ...Object.values(CELLO_SAMPLE_URLS).map((f) => `./samples/cello/${f}`),
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
        attack: 0.02,
        release: 0.25,
      });
      this.masterDelay = new Tone.FeedbackDelay({
        delayTime: "8n.",
        feedback: 0.14,
        wet: 0.1,
      });
      this.masterReverb = new Tone.Reverb({
        decay: 3.4,
        preDelay: 0.02,
        wet: this.reverbWet,
      });

      this.masterReverb.chain(
        this.masterCompressor,
        this.analyser,
        Tone.getDestination()
      );

      // Piano mantém delay etéreo sutil antes do reverb
      this.pianoFilter = new Tone.Filter({
        frequency: 4200,
        type: "lowpass",
        rolloff: -12,
      });
      this.pianoFilter.chain(this.masterDelay, this.masterReverb);

      // Violoncelo: sem Chorus e sem Delay para evitar som de órgão;
      // EQ3 dedicado dá corpo de madeira grave e atrito natural de arco
      this.celloEq = new Tone.EQ3({
        low: 5,
        mid: 2,
        high: -4,
        lowFrequency: 180,
        highFrequency: 2500,
      });
      this.celloFilter = new Tone.Filter({
        frequency: 2800,
        type: "lowpass",
        rolloff: -12,
      });
      this.celloEq.chain(this.celloFilter, this.masterReverb);

      this.pianoSampler = new Tone.Sampler({
        urls: PIANO_SAMPLE_URLS,
        release: 1.2,
        baseUrl: "./samples/piano/",
      }).connect(this.pianoFilter);

      this.celloSampler = new Tone.Sampler({
        urls: CELLO_SAMPLE_URLS,
        attack: 0.05,
        release: 1.8,
        baseUrl: "./samples/cello/",
      }).connect(this.celloEq);

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
        const normalized = Math.max(0.001, Math.min(1, this.volumePercent / 100));
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
    velocity: number,
    isMelody: boolean
  ) {
    if (voice === "cello") {
      const { mainNote, subBassNote } = toImposingCelloRegister(noteName);
      const bowDuration = Math.max(0.75, durationSeconds * 1.35);
      sampler.triggerAttackRelease(mainNote, bowDuration, time, velocity);
      if (isMelody && subBassNote) {
        sampler.triggerAttackRelease(
          subBassNote,
          bowDuration,
          time,
          Math.min(0.32, velocity * 0.36)
        );
      }
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
    const sampler = voice === "cello" ? this.celloSampler : this.pianoSampler;
    if (!sampler) return;
    try {
      this.triggerInstrumentNote(
        sampler,
        voice,
        soundingNote,
        durationSeconds,
        Tone.now(),
        velocity,
        true
      );
    } catch {
      // ignora se nota inválida
    }
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
        ev.voice === "cello" ? this.celloSampler : this.pianoSampler;
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
              ev.velocity,
              ev.isMelody
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
      this.celloSampler?.releaseAll();
    } catch {
      // ignora
    }
  }
}

export const audioEngine = new CartierAudioEngine();
