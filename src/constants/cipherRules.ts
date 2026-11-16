import type { CipherVersion, TempoPreset } from "../types/music";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/**
 * Tabela v1 (legado — idêntica ao `script.js` original: a oitava vira no Lá).
 * A=A2..G=G2, H=A3..N=G3, O=A4..U=G4, V=A5..Z=E5.
 */
export const V1_LETTER_TO_NOTE: Record<string, string> = (() => {
  const notes = ["A", "B", "C", "D", "E", "F", "G"];
  const map: Record<string, string> = {};
  let noteIdx = 0;
  let octave = 2;

  for (const letter of ALPHABET) {
    map[letter] = `${notes[noteIdx]}${octave}`;
    noteIdx++;
    if (noteIdx >= notes.length) {
      noteIdx = 0;
      octave++;
    }
  }
  return map;
})();

export const V1_NOTE_TO_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(V1_LETTER_TO_NOTE).map(([letter, note]) => [note, letter])
);

/**
 * Tabela v2 (SPN real — a oitava vira no Dó, escala ascendente contínua de A2 a E6).
 * A=A2, B=B2, C=C3..I=B3, J=C4..P=B4, Q=C5..W=B5, X=C6..Z=E6.
 */
export const V2_LETTER_TO_NOTE: Record<string, string> = {
  A: "A2",
  B: "B2",
  C: "C3",
  D: "D3",
  E: "E3",
  F: "F3",
  G: "G3",
  H: "A3",
  I: "B3",
  J: "C4",
  K: "D4",
  L: "E4",
  M: "F4",
  N: "G4",
  O: "A4",
  P: "B4",
  Q: "C5",
  R: "D5",
  S: "E5",
  T: "F5",
  U: "G5",
  V: "A5",
  W: "B5",
  X: "C6",
  Y: "D6",
  Z: "E6",
};

export const V2_NOTE_TO_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(V2_LETTER_TO_NOTE).map(([letter, note]) => [note, letter])
);

/** Notas exclusivas de cada versão (usadas na detecção sem cabeçalho). */
export const V1_EXCLUSIVE_NOTES = new Set(["C2", "D2", "E2", "F2", "G2"]);
export const V2_EXCLUSIVE_NOTES = new Set(["F5", "G5", "C6", "D6", "E6"]);

export function getCipherTables(version: CipherVersion) {
  return version === "v1"
    ? {
        letterToNote: V1_LETTER_TO_NOTE,
        noteToLetter: V1_NOTE_TO_LETTER,
      }
    : {
        letterToNote: V2_LETTER_TO_NOTE,
        noteToLetter: V2_NOTE_TO_LETTER,
      };
}

export const TEMPO_BPM: Record<TempoPreset, number> = {
  adagio: 66,
  andante: 84,
  allegretto: 112,
};

export const TEMPO_LABELS: Record<TempoPreset, string> = {
  adagio: "Adagio (66 BPM)",
  andante: "Andante (84 BPM)",
  allegretto: "Allegretto (112 BPM)",
};

export const OFFICIAL_CREDITS =
  "Direitos reservados por Daniela Vigarani (interpreta Bibi) & Bah Duarte (interpreta Pripri)";
