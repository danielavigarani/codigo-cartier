export type CipherVersion = "v1" | "v2";

export type SunMoonMode = "lua" | "sol" | "eclipse";

export type MusicalMode = "lua" | "sol";

export type InstrumentVoice = "piano" | "harp";

export type OrchestrationMode = "solo" | "noturno" | "sinfonia";

export type PlaybackFidelity = "fiel" | "suave";

export type TempoPreset = "adagio" | "andante" | "allegretto";

export type TimeSignature = "4/4" | "3/4";

export type NoteDurationCode =
  | "1n"
  | "2n."
  | "2n"
  | "4n."
  | "4n"
  | "8n."
  | "8n"
  | "16n";

export type RestDurationCode = "1r" | "2r" | "4r." | "4r" | "8r." | "8r" | "16r";

export interface CipherHeader {
  raw?: string;
  version?: CipherVersion;
  mode?: MusicalMode;
  voice?: InstrumentVoice;
}

export interface VersionDetectionResult {
  version: CipherVersion;
  source: "header" | "auto-v1" | "auto-v2" | "ambiguous" | "conflict";
  ambiguous: boolean;
  hasConflict: boolean;
  header: CipherHeader;
}

export interface DecodedToken {
  id: string;
  type: "note" | "space" | "invalid";
  raw: string;
  note?: string;
  letter?: string;
  lineIndex: number;
  tokenIndex: number;
  letterIndex?: number;
  isValid: boolean;
}

export interface DecodedLine {
  lineIndex: number;
  tokens: DecodedToken[];
  decodedText: string;
  invalidTokens: DecodedToken[];
}

export interface DecodeResult {
  detection: VersionDetectionResult;
  lines: DecodedLine[];
  decodedText: string;
  invalidTokens: DecodedToken[];
  hasErrors: boolean;
  totalNotes: number;
}

export type RhythmEventKind = "note" | "rest";

export type TieRole = "none" | "start" | "continue" | "end";

export interface RhythmEvent {
  id: string;
  kind: RhythmEventKind;
  lineIndex: number;
  measureIndex: number;
  beatInMeasure: number;
  beats: number;
  durationCode: NoteDurationCode | RestDurationCode;
  dotted: boolean;
  tie: TieRole;
  /** Letra associada (apenas para notas, compartilhada entre segmentos ligados por tie). */
  letter?: string;
  /** Nota da cifra (A2–E6) sem alteração da armadura de clave. */
  cipherNote?: string;
  /** Índice lógico da letra no código (tie não incrementa este índice). */
  letterIndex?: number;
  /** Se true, este segmento representa a primeira ocorrência audível/revelável da letra. */
  isTieHead: boolean;
  /** Caractere a revelar na UI quando o evento inicia ('A'..'Z', ' ' ou '\n' anexado). */
  revealChar?: string;
  isVowel?: boolean;
  isWordEnd?: boolean;
  isLineEnd?: boolean;
  velocity: number;
  startTimeSeconds: number;
  durationSeconds: number;
}

export interface ChordAnalysis {
  measureIndex: number;
  symbol: string;
  root: string;
  notes: string[];
  bassNote: string;
}

export interface MeasureData {
  lineIndex: number;
  measureIndex: number;
  timeSignature: TimeSignature;
  totalBeats: number;
  events: RhythmEvent[];
  chord?: ChordAnalysis;
  isFinalMeasure: boolean;
}

export interface AccompanimentEvent {
  id: string;
  voice: InstrumentVoice;
  note: string;
  durationCode: NoteDurationCode;
  startTimeSeconds: number;
  durationSeconds: number;
  velocity: number;
  measureIndex: number;
}

export interface ScheduledPlaybackEvent {
  id: string;
  eventId: string;
  voice: InstrumentVoice;
  cipherNote: string;
  soundingNote: string;
  startTimeSeconds: number;
  durationSeconds: number;
  velocity: number;
  lineIndex: number;
  measureIndex: number;
  letterIndex?: number;
  revealTextSoFar: string;
  isMelody: boolean;
}

export interface PlaybackTimeline {
  totalDurationSeconds: number;
  melodyEvents: ScheduledPlaybackEvent[];
  accompanimentEvents: ScheduledPlaybackEvent[];
  allEvents: ScheduledPlaybackEvent[];
  measuresByLine: MeasureData[][];
}

export interface DuetMessage {
  id: string;
  senderName: string;
  voice: InstrumentVoice;
  mode: MusicalMode;
  rawText: string;
  cipherCode: string;
  createdAt: string;
}
