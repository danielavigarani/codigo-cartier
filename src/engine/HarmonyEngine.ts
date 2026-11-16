import { Chord, Key, Note } from "tonal";
import { TEMPO_BPM } from "../constants/cipherRules";
import type {
  ChordAnalysis,
  InstrumentVoice,
  MeasureData,
  MusicalMode,
  OrchestrationMode,
  PlaybackFidelity,
  PlaybackTimeline,
  RhythmEvent,
  ScheduledPlaybackEvent,
  TempoPreset,
} from "../types/music";
import { getDeterministicVelocity, hashString } from "./seed";

const SOL_SHARP_MAP: Record<string, string> = {
  C: "C#",
  F: "F#",
  G: "G#",
};

/**
 * Converte uma nota da cifra (sempre natural A–G) na altura sonora real do modo.
 * Modo Lua (Lá Menor): naturais. Modo Sol (Lá Maior, 3#): C->C#, F->F#, G->G#.
 */
export function toSoundingNote(cipherNote: string, mode: MusicalMode): string {
  const match = cipherNote.match(/^([A-Ga-g])(\d)$/);
  if (!match) return cipherNote;
  const letter = match[1].toUpperCase();
  const octave = match[2];
  if (mode === "sol" && SOL_SHARP_MAP[letter]) {
    return `${SOL_SHARP_MAP[letter]}${octave}`;
  }
  return `${letter}${octave}`;
}

/**
 * Desloca apenas a oitava da nota sonora para ficar próxima à nota anterior
 * (máximo ~6 semitons), sem alterar a classe de altura.
 */
export function toSmoothPlaybackNote(
  soundingNote: string,
  prevMidi: number | null,
  mode: MusicalMode,
  minMidi = 45, // A2
  maxMidi = 88 // E6
): { note: string; midi: number } {
  const baseMidi = Note.midi(soundingNote);
  if (baseMidi == null) return { note: soundingNote, midi: 60 };
  if (prevMidi == null) return { note: soundingNote, midi: baseMidi };

  let bestMidi = baseMidi;
  let bestDist = Math.abs(baseMidi - prevMidi);

  for (let shift = -36; shift <= 36; shift += 12) {
    const candidate = baseMidi + shift;
    if (candidate < minMidi || candidate > maxMidi) continue;
    const dist = Math.abs(candidate - prevMidi);
    if (dist < bestDist) {
      bestDist = dist;
      bestMidi = candidate;
    }
  }

  const formatted =
    mode === "sol"
      ? Note.fromMidiSharps(bestMidi)
      : Note.fromMidi(bestMidi);
  return {
    note: formatted || soundingNote,
    midi: bestMidi,
  };
}

function getPitchClass(noteName: string): string {
  return Note.pitchClass(noteName).toUpperCase();
}

function getChordNotes(symbol: string): string[] {
  const info = Chord.get(symbol);
  if (info.notes.length > 0) return info.notes.map((n) => n.toUpperCase());
  return ["A", "C", "E"];
}

function getBassNoteWithOctave(chordRoot: string, octave = 2): string {
  const pc = chordRoot.toUpperCase();
  // Mantém o baixo confortável em C2–B2 (ou E2–D3)
  if (pc === "A" || pc === "B" || pc === "G#" || pc === "G") {
    return `${pc}${octave}`;
  }
  return `${pc}${octave + 1}`;
}

function getCandidateChords(mode: MusicalMode): string[] {
  if (mode === "sol") {
    // Tríades diatônicas de Lá Maior (sem G#dim)
    return Key.majorKey("A")
      .triads.filter((t) => !t.endsWith("dim"));
  }
  // Lá Menor Natural + E (sujeito à regra do G#)
  const natural = Key.minorKey("A").natural.triads.filter(
    (t) => !t.endsWith("dim")
  );
  return [...natural, "E"];
}

function measureContainsNaturalG(
  measure: MeasureData,
  mode: MusicalMode
): boolean {
  if (mode !== "lua") return false;
  return measure.events.some((ev) => {
    if (ev.kind !== "note" || !ev.cipherNote) return false;
    return getPitchClass(ev.cipherNote) === "G";
  });
}

function emissionScore(
  measure: MeasureData,
  chordSymbol: string,
  mode: MusicalMode,
  measureIdx: number,
  totalMeasures: number
): number {
  // Regra estrita 5.3: Em Modo Lua, E (ou E7, com G#) NUNCA entra se houver G natural na melodia
  if (
    mode === "lua" &&
    (chordSymbol === "E" || chordSymbol === "E7") &&
    measureContainsNaturalG(measure, mode)
  ) {
    return -Infinity;
  }

  const chordPcs = new Set(getChordNotes(chordSymbol));
  const rootPc = chordPcs.values().next().value ?? "A";
  let score = 0;
  let noteCount = 0;

  for (const ev of measure.events) {
    if (ev.kind !== "note" || !ev.cipherNote) continue;
    noteCount++;
    const sounding = toSoundingNote(ev.cipherNote, mode);
    const pc = getPitchClass(sounding);
    const beatWeight =
      ev.beatInMeasure === 0 ? 1.6 : ev.beatInMeasure === 2 ? 1.3 : 1.0;
    const durationWeight = Math.min(2.5, Math.max(0.5, ev.beats));

    if (chordPcs.has(pc)) {
      const rootBonus = pc === rootPc ? 1.25 : 1.0;
      score += 2.2 * beatWeight * durationWeight * rootBonus;
    } else {
      score -= 0.9 * beatWeight;
    }
  }

  if (noteCount === 0) {
    // Compasso apenas de pausas favorece tônica ou dominante
    const tonic = mode === "sol" ? "A" : "Am";
    return chordSymbol === tonic ? 1.0 : 0.0;
  }

  const tonic = mode === "sol" ? "A" : "Am";
  const isFirst = measureIdx === 0;
  const isLast = measureIdx === totalMeasures - 1;
  const isPenultimate = totalMeasures >= 2 && measureIdx === totalMeasures - 2;

  if (isFirst && chordSymbol === tonic) score += 1.4;
  if (isLast && chordSymbol === tonic) score += 3.2;

  // Cadência V -> i / V -> I no penúltimo compasso
  if (isPenultimate) {
    if (chordSymbol === "E") score += 2.4;
    else if (mode === "lua" && chordSymbol === "Em") score += 1.8;
  }

  return score;
}

const LUA_TRANSITIONS: Record<string, string[]> = {
  Am: ["Dm", "F", "C", "G", "Em", "E"],
  Dm: ["E", "Em", "G", "Am", "F"],
  F: ["Dm", "G", "C", "E", "Em", "Am"],
  C: ["G", "F", "Am", "Dm"],
  G: ["C", "Am", "Em", "F"],
  Em: ["Am", "F", "Dm", "C"],
  E: ["Am", "F"],
};

const SOL_TRANSITIONS: Record<string, string[]> = {
  A: ["D", "F#m", "E", "Bm", "C#m"],
  D: ["E", "A", "Bm", "F#m"],
  Bm: ["E", "A", "C#m", "F#m"],
  "F#m": ["D", "Bm", "E", "C#m"],
  "C#m": ["F#m", "D", "Bm", "A"],
  E: ["A", "F#m"],
};

function transitionScore(
  prevChord: string,
  nextChord: string,
  mode: MusicalMode,
  isFinalStep: boolean
): number {
  let score = 0;

  if (prevChord === nextChord) {
    score -= 1.1; // penaliza repetição excessiva
  } else {
    const map = mode === "sol" ? SOL_TRANSITIONS : LUA_TRANSITIONS;
    const preferred = map[prevChord] ?? [];
    const rank = preferred.indexOf(nextChord);
    if (rank !== -1) {
      score += 1.6 - rank * 0.25;
    }
  }

  // Cadência resolutiva V -> i/I no final
  const tonic = mode === "sol" ? "A" : "Am";
  if (
    isFinalStep &&
    (prevChord === "E" || (mode === "lua" && prevChord === "Em")) &&
    nextChord === tonic
  ) {
    score += 2.5;
  }

  // Penaliza salto de baixo muito grande (> 7 semitons)
  const prevBass = Note.midi(getBassNoteWithOctave(getChordNotes(prevChord)[0])) ?? 45;
  const nextBass = Note.midi(getBassNoteWithOctave(getChordNotes(nextChord)[0])) ?? 45;
  const leap = Math.abs(nextBass - prevBass);
  if (leap > 7) {
    score -= (leap - 7) * 0.25;
  }

  return score;
}

/**
 * Seleciona a sequência ótima de acordes para uma lista de compassos usando Viterbi.
 */
export function harmonizeMeasures(
  measures: MeasureData[],
  mode: MusicalMode
): MeasureData[] {
  if (measures.length === 0) return [];
  const candidates = getCandidateChords(mode);
  const n = measures.length;

  const dp: number[][] = Array.from({ length: n }, () =>
    Array(candidates.length).fill(-Infinity)
  );
  const back: number[][] = Array.from({ length: n }, () =>
    Array(candidates.length).fill(-1)
  );

  // Inicialização (t = 0)
  for (let c = 0; c < candidates.length; c++) {
    dp[0][c] = emissionScore(measures[0], candidates[c], mode, 0, n);
  }

  // Passo Viterbi
  for (let t = 1; t < n; t++) {
    const isFinalStep = t === n - 1;
    for (let curr = 0; curr < candidates.length; curr++) {
      const emit = emissionScore(measures[t], candidates[curr], mode, t, n);
      if (emit === -Infinity) continue;

      let bestVal = -Infinity;
      let bestPrev = -1;
      for (let prev = 0; prev < candidates.length; prev++) {
        if (dp[t - 1][prev] === -Infinity) continue;
        const val =
          dp[t - 1][prev] +
          transitionScore(candidates[prev], candidates[curr], mode, isFinalStep) +
          emit;
        if (val > bestVal) {
          bestVal = val;
          bestPrev = prev;
        }
      }
      dp[t][curr] = bestVal;
      back[t][curr] = bestPrev;
    }
  }

  // Escolhe melhor estado final
  let bestFinalIdx = 0;
  let bestFinalScore = -Infinity;
  for (let c = 0; c < candidates.length; c++) {
    if (dp[n - 1][c] > bestFinalScore) {
      bestFinalScore = dp[n - 1][c];
      bestFinalIdx = c;
    }
  }

  const chosenIndices = Array(n).fill(0);
  let cursor = bestFinalIdx;
  for (let t = n - 1; t >= 0; t--) {
    chosenIndices[t] = cursor >= 0 ? cursor : 0;
    cursor = t > 0 ? back[t][chosenIndices[t]] : -1;
  }

  return measures.map((measure, idx) => {
    const symbol = candidates[chosenIndices[idx]];
    const notes = getChordNotes(symbol);
    const chord: ChordAnalysis = {
      measureIndex: measure.measureIndex,
      symbol,
      root: notes[0] ?? "A",
      notes,
      bassNote: getBassNoteWithOctave(notes[0] ?? "A", 2),
    };
    return {
      ...measure,
      chord,
    };
  });
}

function buildArpeggioNotes(
  chord: ChordAnalysis,
  mode: MusicalMode,
  beatsInMeasure: number
): Array<{ note: string; beatOffset: number; beats: number }> {
  const root = chord.root;
  const third = chord.notes[1] ?? chord.root;
  const fifth = chord.notes[2] ?? chord.root;

  const r2 = getBassNoteWithOctave(root, 2);
  const f2 = `${fifth}2`;
  const r3 = `${root}3`;
  const t3 = `${third}3`;

  const rawPattern = [r2, f2, r3, t3, r3, f2, t3, r3];
  const steps = beatsInMeasure * 2; // colcheias por compasso (8 em 4/4, 6 em 3/4)
  const items: Array<{ note: string; beatOffset: number; beats: number }> = [];

  for (let i = 0; i < steps; i++) {
    const candidate = rawPattern[i % rawPattern.length];
    const midi = Note.midi(candidate) ?? 48;
    const clampedMidi = Math.max(45, Math.min(64, midi)); // A2..E4
    const formatted =
      mode === "sol"
        ? Note.fromMidiSharps(clampedMidi)
        : Note.fromMidi(clampedMidi);
    items.push({
      note: formatted || r2,
      beatOffset: i * 0.5,
      beats: 0.5,
    });
  }
  return items;
}

export interface BuildTimelineOptions {
  measuresByLine: MeasureData[][];
  mode: MusicalMode;
  voice: InstrumentVoice;
  orchestration: OrchestrationMode;
  fidelity: PlaybackFidelity;
  tempo: TempoPreset;
  seedText?: string;
}

/**
 * Constrói o plano harmônico (Viterbi) e a timeline única de playback para o Tone.Transport.
 */
export function buildPlaybackTimeline(
  options: BuildTimelineOptions
): PlaybackTimeline {
  const {
    measuresByLine,
    mode,
    voice,
    orchestration,
    fidelity,
    tempo,
    seedText = "",
  } = options;

  const bpm = TEMPO_BPM[tempo];
  const secondsPerBeat = 60 / bpm;
  const codeHash = hashString(`${seedText}|${mode}|${orchestration}`);

  const harmonizedByLine = measuresByLine.map((lineMeasures) =>
    harmonizeMeasures(lineMeasures, mode)
  );

  // Mapa rápido de duração total para cabeças de tie
  const flatRaw: RhythmEvent[] = harmonizedByLine.flatMap((line) =>
    line.flatMap((m) => m.events)
  );

  const tiedDurationMap = new Map<string, number>();
  for (let i = 0; i < flatRaw.length; i++) {
    const ev = flatRaw[i];
    if (ev.kind === "note" && ev.isTieHead) {
      let totalSec = ev.durationSeconds;
      if (ev.tie === "start") {
        for (let j = i + 1; j < flatRaw.length; j++) {
          const next = flatRaw[j];
          if (
            next.kind === "note" &&
            !next.isTieHead &&
            next.letterIndex === ev.letterIndex
          ) {
            totalSec += next.durationSeconds;
            if (next.tie === "end") break;
          } else {
            break;
          }
        }
      }
      tiedDurationMap.set(ev.id, totalSec);
    }
  }

  const melodyEvents: ScheduledPlaybackEvent[] = [];
  const accompanimentEvents: ScheduledPlaybackEvent[] = [];

  let revealedTextSoFar = "";
  let prevSoundingMidi: number | null = null;
  let lastEndTime = 0;

  harmonizedByLine.forEach((lineMeasures) => {
    let lineStartTime =
      lineMeasures.length > 0 && lineMeasures[0].events.length > 0
        ? lineMeasures[0].events[0].startTimeSeconds
        : lastEndTime;

    lineMeasures.forEach((measure) => {
      const measureStart =
        measure.events.length > 0
          ? measure.events[0].startTimeSeconds
          : lineStartTime;

      measure.events.forEach((ev) => {
        if (ev.revealChar) {
          revealedTextSoFar += ev.revealChar;
        }

        if (ev.kind === "note" && ev.cipherNote) {
          const baseSounding = toSoundingNote(ev.cipherNote, mode);

          if (ev.isTieHead) {
            let playbackNote = baseSounding;
            if (fidelity === "suave") {
              const smoothed = toSmoothPlaybackNote(
                baseSounding,
                prevSoundingMidi,
                mode
              );
              playbackNote = smoothed.note;
              prevSoundingMidi = smoothed.midi;
            } else {
              prevSoundingMidi = Note.midi(baseSounding) ?? prevSoundingMidi;
            }

            melodyEvents.push({
              id: `mel-${ev.id}`,
              eventId: ev.id,
              voice,
              cipherNote: ev.cipherNote,
              soundingNote: playbackNote,
              startTimeSeconds: ev.startTimeSeconds,
              durationSeconds:
                tiedDurationMap.get(ev.id) ?? ev.durationSeconds,
              velocity: ev.velocity,
              lineIndex: ev.lineIndex,
              measureIndex: ev.measureIndex,
              letterIndex: ev.letterIndex,
              revealTextSoFar: revealedTextSoFar,
              isMelody: true,
            });
          } else {
            // Segmento ligado (continuação de tie) não re-ataca áudio, mas atualiza cursor visual
            melodyEvents.push({
              id: `tie-${ev.id}`,
              eventId: ev.id,
              voice,
              cipherNote: ev.cipherNote,
              soundingNote: "", // sinaliza continuação sem novo trigger
              startTimeSeconds: ev.startTimeSeconds,
              durationSeconds: ev.durationSeconds,
              velocity: 0,
              lineIndex: ev.lineIndex,
              measureIndex: ev.measureIndex,
              letterIndex: ev.letterIndex,
              revealTextSoFar: revealedTextSoFar,
              isMelody: true,
            });
          }
        } else if (ev.revealChar) {
          // Evento silencioso de espaço '|' ou '\n' para sincronizar texto revelado
          melodyEvents.push({
            id: `text-${ev.id}`,
            eventId: ev.id,
            voice,
            cipherNote: "",
            soundingNote: "",
            startTimeSeconds: ev.startTimeSeconds,
            durationSeconds: ev.durationSeconds,
            velocity: 0,
            lineIndex: ev.lineIndex,
            measureIndex: ev.measureIndex,
            revealTextSoFar: revealedTextSoFar,
            isMelody: false,
          });
        }

        lastEndTime = Math.max(
          lastEndTime,
          ev.startTimeSeconds + ev.durationSeconds
        );
      });

      // Acompanhamento harmônico apenas no playback (nunca entra na partitura ou código)
      if (orchestration !== "solo" && measure.chord) {
        const chord = measure.chord;
        const measureDurSec = measure.totalBeats * secondsPerBeat;

        if (orchestration === "noturno") {
          const arp = buildArpeggioNotes(chord, mode, measure.totalBeats);
          arp.forEach((step, stepIdx) => {
            const vel = getDeterministicVelocity(
              codeHash,
              measure.measureIndex * 16 + stepIdx,
              0.36,
              0.04
            );
            accompanimentEvents.push({
              id: `noturno-L${measure.lineIndex}-M${measure.measureIndex}-${stepIdx}`,
              eventId: `acc-${measure.lineIndex}-${measure.measureIndex}-${stepIdx}`,
              voice,
              cipherNote: step.note,
              soundingNote: step.note,
              startTimeSeconds: measureStart + step.beatOffset * secondsPerBeat,
              durationSeconds: step.beats * secondsPerBeat * 1.4,
              velocity: vel,
              lineIndex: measure.lineIndex,
              measureIndex: measure.measureIndex,
              revealTextSoFar: "",
              isMelody: false,
            });
          });
        } else if (orchestration === "sinfonia") {
          // Sinfonia de Câmara: Piano + Violoncelo juntos sem competir com a melodia
          const partnerVoice: InstrumentVoice =
            voice === "piano" ? "cello" : "piano";

          if (partnerVoice === "cello") {
            // Violoncelo faz baixo sustentado + contracanto simples dentro do acorde
            const bassNote = chord.bassNote;
            const fifthNote = `${chord.notes[2] ?? chord.root}3`;
            const velBass = getDeterministicVelocity(
              codeHash,
              measure.measureIndex * 10,
              0.44,
              0.04
            );
            accompanimentEvents.push({
              id: `sinf-cello-bass-L${measure.lineIndex}-M${measure.measureIndex}`,
              eventId: `acc-cello-b-${measure.lineIndex}-${measure.measureIndex}`,
              voice: "cello",
              cipherNote: bassNote,
              soundingNote: bassNote,
              startTimeSeconds: measureStart,
              durationSeconds: measureDurSec * 0.9,
              velocity: velBass,
              lineIndex: measure.lineIndex,
              measureIndex: measure.measureIndex,
              revealTextSoFar: "",
              isMelody: false,
            });
            // Contracanto discreto na metade do compasso
            accompanimentEvents.push({
              id: `sinf-cello-cnt-L${measure.lineIndex}-M${measure.measureIndex}`,
              eventId: `acc-cello-c-${measure.lineIndex}-${measure.measureIndex}`,
              voice: "cello",
              cipherNote: fifthNote,
              soundingNote: fifthNote,
              startTimeSeconds:
                measureStart + Math.floor(measure.totalBeats / 2) * secondsPerBeat,
              durationSeconds: (measure.totalBeats / 2) * secondsPerBeat * 0.85,
              velocity: velBass * 0.85,
              lineIndex: measure.lineIndex,
              measureIndex: measure.measureIndex,
              revealTextSoFar: "",
              isMelody: false,
            });
          } else {
            // Quando melodia está no violoncelo, piano faz arpejo noturno suave de câmara
            const arp = buildArpeggioNotes(chord, mode, measure.totalBeats);
            arp.forEach((step, stepIdx) => {
              const vel = getDeterministicVelocity(
                codeHash,
                measure.measureIndex * 16 + stepIdx,
                0.34,
                0.04
              );
              accompanimentEvents.push({
                id: `sinf-piano-L${measure.lineIndex}-M${measure.measureIndex}-${stepIdx}`,
                eventId: `acc-piano-${measure.lineIndex}-${measure.measureIndex}-${stepIdx}`,
                voice: "piano",
                cipherNote: step.note,
                soundingNote: step.note,
                startTimeSeconds:
                  measureStart + step.beatOffset * secondsPerBeat,
                durationSeconds: step.beats * secondsPerBeat * 1.3,
                velocity: vel,
                lineIndex: measure.lineIndex,
                measureIndex: measure.measureIndex,
                revealTextSoFar: "",
                isMelody: false,
              });
            });
          }
        }
      }
    });
  });

  const allEvents = [...melodyEvents, ...accompanimentEvents].sort(
    (a, b) => a.startTimeSeconds - b.startTimeSeconds
  );

  return {
    totalDurationSeconds: lastEndTime,
    melodyEvents,
    accompanimentEvents,
    allEvents,
    measuresByLine: harmonizedByLine,
  };
}
