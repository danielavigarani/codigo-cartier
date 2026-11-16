import { TEMPO_BPM, VOWELS } from "../constants/cipherRules";
import type {
  DecodedLine,
  DecodedToken,
  MeasureData,
  NoteDurationCode,
  RestDurationCode,
  RhythmEvent,
  TempoPreset,
  TimeSignature,
} from "../types/music";
import { getDeterministicVelocity, hashString } from "./seed";

const NOTE_DECOMPOSITIONS: Array<{
  sixteenths: number;
  code: NoteDurationCode;
  dotted: boolean;
}> = [
  { sixteenths: 16, code: "1n", dotted: false },
  { sixteenths: 12, code: "2n.", dotted: true },
  { sixteenths: 8, code: "2n", dotted: false },
  { sixteenths: 6, code: "4n.", dotted: true },
  { sixteenths: 4, code: "4n", dotted: false },
  { sixteenths: 3, code: "8n.", dotted: true },
  { sixteenths: 2, code: "8n", dotted: false },
  { sixteenths: 1, code: "16n", dotted: false },
];

const REST_DECOMPOSITIONS: Array<{
  sixteenths: number;
  code: RestDurationCode;
  dotted: boolean;
}> = [
  { sixteenths: 16, code: "1r", dotted: false },
  { sixteenths: 8, code: "2r", dotted: false },
  { sixteenths: 4, code: "4r", dotted: false },
  { sixteenths: 2, code: "8r", dotted: false },
  { sixteenths: 1, code: "16r", dotted: false },
];

function decomposeNoteSixteenths(totalSixteenths: number) {
  const parts: Array<{
    sixteenths: number;
    code: NoteDurationCode;
    dotted: boolean;
  }> = [];
  let remaining = totalSixteenths;
  while (remaining > 0) {
    const match = NOTE_DECOMPOSITIONS.find((d) => d.sixteenths <= remaining);
    if (!match) break;
    parts.push(match);
    remaining -= match.sixteenths;
  }
  return parts;
}

function decomposeRestSixteenths(totalSixteenths: number) {
  const parts: Array<{
    sixteenths: number;
    code: RestDurationCode;
    dotted: boolean;
  }> = [];
  let remaining = totalSixteenths;
  while (remaining > 0) {
    const match = REST_DECOMPOSITIONS.find((d) => d.sixteenths <= remaining);
    if (!match) break;
    parts.push(match);
    remaining -= match.sixteenths;
  }
  return parts;
}

export interface RhythmParseOptions {
  timeSignature?: TimeSignature;
  tempo?: TempoPreset;
  seedText?: string;
}

interface LogicalTokenPlan {
  kind: "note" | "rest";
  sixteenths: number;
  letter?: string;
  cipherNote?: string;
  letterIndex?: number;
  revealChar?: string;
  isVowel?: boolean;
  isWordEnd?: boolean;
  isLineEnd?: boolean;
  velocity: number;
}

/**
 * Converte linhas decifradas em compassos reais (4/4 ou 3/4) e eventos rítmicos
 * 100% determinísticos.
 *
 * Regras:
 * - Exatamente 1 nota lógica por letra (sem ornamentos/appoggiaturas).
 * - Vogal: semínima (4n = 4 semicolcheias), velocity maior.
 * - Consoante: colcheia (8n = 2 semicolcheias), velocity menor.
 * - Última letra de palavra: pontuada (4n. = 6 semicolcheias / 8n. = 3 semicolcheias).
 * - '|' (espaço entre palavras): pausa de colcheia (8r = 2 semicolcheias).
 * - Última letra da linha: mínima pontuada (2n. = 12 semicolcheias).
 */
export function parseRhythmFromLines(
  lines: DecodedLine[],
  options: RhythmParseOptions = {}
): { measuresByLine: MeasureData[][]; flatEvents: RhythmEvent[] } {
  const timeSignature: TimeSignature = options.timeSignature ?? "4/4";
  const tempo: TempoPreset = options.tempo ?? "andante";
  const bpm = TEMPO_BPM[tempo];
  const secondsPerBeat = 60 / bpm;
  const measureSixteenths = timeSignature === "3/4" ? 12 : 16;

  const canonicalSeed =
    options.seedText ??
    lines
      .map((l) =>
        l.tokens
          .map((t) => (t.type === "note" ? t.note : t.type === "space" ? "|" : ""))
          .join(" ")
      )
      .join("\n");
  const codeHash = hashString(canonicalSeed);

  const nonEmptyLineIndices = lines
    .map((line, idx) => ({
      idx,
      hasContent: line.tokens.some((t) => t.type === "note" || t.type === "space"),
    }))
    .filter((x) => x.hasContent)
    .map((x) => x.idx);
  const lastNonEmptyLineIdx =
    nonEmptyLineIndices.length > 0
      ? nonEmptyLineIndices[nonEmptyLineIndices.length - 1]
      : -1;

  const measuresByLine: MeasureData[][] = [];
  const flatEvents: RhythmEvent[] = [];
  let currentTimeSeconds = 0;

  lines.forEach((line, lineIdx) => {
    const validTokens = line.tokens.filter(
      (t): t is DecodedToken => t.type === "note" || t.type === "space"
    );

    if (validTokens.length === 0) {
      measuresByLine.push([]);
      return;
    }

    // Identifica último token de nota da linha
    let lastNoteTokenIdx = -1;
    for (let i = validTokens.length - 1; i >= 0; i--) {
      if (validTokens[i].type === "note") {
        lastNoteTokenIdx = i;
        break;
      }
    }

    const plans: LogicalTokenPlan[] = [];
    validTokens.forEach((tok, tokIdx) => {
      if (tok.type === "space") {
        plans.push({
          kind: "rest",
          sixteenths: 2, // 8r = 0.5 beat
          revealChar: " ",
          velocity: 0,
        });
        return;
      }

      const letter = tok.letter ?? "A";
      const isVowel = VOWELS.has(letter);
      const isLineEnd = tokIdx === lastNoteTokenIdx;
      const nextTok = validTokens[tokIdx + 1];
      const isWordEnd = !isLineEnd && nextTok?.type === "space";

      let sixteenths = isVowel ? 4 : 2;
      if (isLineEnd) {
        sixteenths = 12; // 2n. = mínima pontuada (3 tempos)
      } else if (isWordEnd) {
        sixteenths = isVowel ? 6 : 3; // 4n. ou 8n. (respiração no fim da palavra)
      }

      const baseVelocity = isVowel ? 0.82 : 0.68;
      const finalBase = isLineEnd ? Math.min(0.88, baseVelocity + 0.05) : baseVelocity;
      const velocity = getDeterministicVelocity(
        codeHash,
        tok.letterIndex ?? tokIdx,
        finalBase,
        0.07
      );

      plans.push({
        kind: "note",
        sixteenths,
        letter,
        cipherNote: tok.note,
        letterIndex: tok.letterIndex,
        revealChar: letter,
        isVowel,
        isWordEnd,
        isLineEnd,
        velocity,
      });
    });

    // Se houver mais linhas depois desta, o último evento desta linha também marca '\n' após sua conclusão
    const appendNewlineAfterLine =
      lastNonEmptyLineIdx !== -1 && lineIdx < lastNonEmptyLineIdx;

    // Empacota planos em compassos de tamanho exato `measureSixteenths`
    const lineMeasures: MeasureData[] = [];
    let currentMeasureIdx = 0;
    let currentMeasureUsed = 0;
    let currentMeasureEvents: RhythmEvent[] = [];

    const flushMeasure = (isFinal: boolean) => {
      // Preenche o que faltar com pausas exatas
      const remaining = measureSixteenths - currentMeasureUsed;
      if (remaining > 0) {
        const padRests = decomposeRestSixteenths(remaining);
        for (const restPart of padRests) {
          const beats = restPart.sixteenths / 4;
          const durSec = beats * secondsPerBeat;
          const ev: RhythmEvent = {
            id: `L${lineIdx}-M${currentMeasureIdx}-E${currentMeasureEvents.length}`,
            kind: "rest",
            lineIndex: lineIdx,
            measureIndex: currentMeasureIdx,
            beatInMeasure: currentMeasureUsed / 4,
            beats,
            durationCode: restPart.code,
            dotted: restPart.dotted,
            tie: "none",
            isTieHead: false,
            velocity: 0,
            startTimeSeconds: currentTimeSeconds,
            durationSeconds: durSec,
          };
          currentMeasureEvents.push(ev);
          flatEvents.push(ev);
          currentMeasureUsed += restPart.sixteenths;
          currentTimeSeconds += durSec;
        }
      }

      lineMeasures.push({
        lineIndex: lineIdx,
        measureIndex: currentMeasureIdx,
        timeSignature,
        totalBeats: measureSixteenths / 4,
        events: currentMeasureEvents,
        isFinalMeasure: isFinal,
      });

      currentMeasureIdx++;
      currentMeasureUsed = 0;
      currentMeasureEvents = [];
    };

    plans.forEach((plan) => {
      let remainingPlan = plan.sixteenths;
      let isFirstSegmentOfPlan = true;
      const segmentsCreated: RhythmEvent[] = [];

      while (remainingPlan > 0) {
        if (currentMeasureUsed >= measureSixteenths) {
          flushMeasure(false);
        }

        const spaceLeft = measureSixteenths - currentMeasureUsed;
        const chunkSize = Math.min(remainingPlan, spaceLeft);

        if (plan.kind === "rest") {
          const restParts = decomposeRestSixteenths(chunkSize);
          for (const part of restParts) {
            const beats = part.sixteenths / 4;
            const durSec = beats * secondsPerBeat;
            const ev: RhythmEvent = {
              id: `L${lineIdx}-M${currentMeasureIdx}-E${currentMeasureEvents.length}`,
              kind: "rest",
              lineIndex: lineIdx,
              measureIndex: currentMeasureIdx,
              beatInMeasure: currentMeasureUsed / 4,
              beats,
              durationCode: part.code,
              dotted: part.dotted,
              tie: "none",
              isTieHead: isFirstSegmentOfPlan,
              revealChar: isFirstSegmentOfPlan ? plan.revealChar : undefined,
              velocity: 0,
              startTimeSeconds: currentTimeSeconds,
              durationSeconds: durSec,
            };
            isFirstSegmentOfPlan = false;
            currentMeasureEvents.push(ev);
            flatEvents.push(ev);
            segmentsCreated.push(ev);
            currentMeasureUsed += part.sixteenths;
            currentTimeSeconds += durSec;
          }
        } else {
          const noteParts = decomposeNoteSixteenths(chunkSize);
          for (const part of noteParts) {
            const beats = part.sixteenths / 4;
            const durSec = beats * secondsPerBeat;
            const ev: RhythmEvent = {
              id: `L${lineIdx}-M${currentMeasureIdx}-E${currentMeasureEvents.length}`,
              kind: "note",
              lineIndex: lineIdx,
              measureIndex: currentMeasureIdx,
              beatInMeasure: currentMeasureUsed / 4,
              beats,
              durationCode: part.code,
              dotted: part.dotted,
              tie: "none",
              letter: plan.letter,
              cipherNote: plan.cipherNote,
              letterIndex: plan.letterIndex,
              isTieHead: isFirstSegmentOfPlan,
              revealChar: isFirstSegmentOfPlan ? plan.revealChar : undefined,
              isVowel: plan.isVowel,
              isWordEnd: plan.isWordEnd,
              isLineEnd: plan.isLineEnd,
              velocity: plan.velocity,
              startTimeSeconds: currentTimeSeconds,
              durationSeconds: durSec,
            };
            isFirstSegmentOfPlan = false;
            currentMeasureEvents.push(ev);
            flatEvents.push(ev);
            segmentsCreated.push(ev);
            currentMeasureUsed += part.sixteenths;
            currentTimeSeconds += durSec;
          }
        }

        remainingPlan -= chunkSize;
      }

      // Configura ligaduras de prolongamento se uma nota foi dividida
      if (plan.kind === "note" && segmentsCreated.length > 1) {
        segmentsCreated.forEach((seg, idx) => {
          if (idx === 0) seg.tie = "start";
          else if (idx === segmentsCreated.length - 1) seg.tie = "end";
          else seg.tie = "continue";
        });
      }
    });

    if (currentMeasureUsed > 0 || lineMeasures.length === 0) {
      flushMeasure(true);
    } else if (lineMeasures.length > 0) {
      lineMeasures[lineMeasures.length - 1].isFinalMeasure = true;
    }

    if (appendNewlineAfterLine && lineMeasures.length > 0) {
      // Conta quantas linhas vazias existem entre esta linha e a próxima linha não-vazia
      let newlines = "\n";
      for (let nextIdx = lineIdx + 1; nextIdx < lines.length; nextIdx++) {
        const nextHasContent = lines[nextIdx].tokens.some(
          (t) => t.type === "note" || t.type === "space"
        );
        if (nextHasContent) break;
        newlines += "\n";
      }
      // Anexa '\n' no último evento da linha para separar parágrafos sincronizados
      const lastM = lineMeasures[lineMeasures.length - 1];
      const lastEv = lastM.events[lastM.events.length - 1];
      if (lastEv) {
        lastEv.revealChar = (lastEv.revealChar ?? "") + newlines;
      }
    }

    measuresByLine.push(lineMeasures);
  });

  return { measuresByLine, flatEvents };
}
