import {
  getCipherTables,
  V1_EXCLUSIVE_NOTES,
  V2_EXCLUSIVE_NOTES,
} from "../constants/cipherRules";
import type {
  CipherHeader,
  CipherVersion,
  DecodedLine,
  DecodedToken,
  DecodeResult,
  InstrumentVoice,
  MusicalMode,
  VersionDetectionResult,
} from "../types/music";

/**
 * Normaliza o texto de entrada removendo acentos (NFD) e descartando
 * qualquer caractere fora de A–Z, espaço e quebra de linha.
 */
export function normalizeInputText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z \n]/g, "");
}

export function formatHeader(
  version: CipherVersion,
  mode: MusicalMode,
  voice: InstrumentVoice
): string {
  return `#cartier ${version} modo=${mode} voz=${voice}`;
}

/**
 * Analisa linhas de comentário `#cartier ...` no código cifrado.
 */
export function parseHeader(rawCode: string): CipherHeader {
  const lines = rawCode.replace(/\r\n/g, "\n").split("\n");
  const header: CipherHeader = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) continue;

    if (trimmed.toLowerCase().startsWith("#cartier")) {
      header.raw = trimmed;
      const parts = trimmed.split(/\s+/).slice(1);
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower === "v1" || lower === "v2") {
          header.version = lower;
        } else if (lower.startsWith("modo=")) {
          const val = lower.slice(5);
          if (val === "lua" || val === "sol") {
            header.mode = val;
          }
        } else if (lower.startsWith("voz=")) {
          const val = lower.slice(4);
          if (val === "piano" || val === "cello") {
            header.voice = val;
          }
        }
      }
      break;
    }
  }

  return header;
}

function stripAnnotationTokens(rawTokens: string[]): string[] {
  const filtered: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    // Formato "Completo": `C4 (J)` — ignora o marcador `(J)` após uma nota
    if (
      /^\([A-Za-z]\)$/.test(tok) &&
      i > 0 &&
      /^[A-Ga-g][0-9]$/.test(rawTokens[i - 1])
    ) {
      continue;
    }
    filtered.push(tok);
  }
  return filtered;
}

/**
 * Detecta a versão da cifra a partir do cabeçalho ou das notas exclusivas.
 */
export function detectCipherVersion(
  rawCode: string,
  fallbackVersion: CipherVersion = "v2"
): VersionDetectionResult {
  const header = parseHeader(rawCode);
  if (header.version) {
    return {
      version: header.version,
      source: "header",
      ambiguous: false,
      hasConflict: false,
      header,
    };
  }

  const lines = rawCode.replace(/\r\n/g, "\n").split("\n");
  let sawV1Exclusive = false;
  let sawV2Exclusive = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const rawTokens = trimmed.split(/\s+/).filter(Boolean);
    const tokens = stripAnnotationTokens(rawTokens);

    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (upper === "|") continue;
      if (V1_EXCLUSIVE_NOTES.has(upper)) sawV1Exclusive = true;
      if (V2_EXCLUSIVE_NOTES.has(upper)) sawV2Exclusive = true;
    }
  }

  if (sawV1Exclusive && sawV2Exclusive) {
    return {
      version: fallbackVersion,
      source: "conflict",
      ambiguous: true,
      hasConflict: true,
      header,
    };
  }
  if (sawV1Exclusive) {
    return {
      version: "v1",
      source: "auto-v1",
      ambiguous: false,
      hasConflict: false,
      header,
    };
  }
  if (sawV2Exclusive) {
    return {
      version: "v2",
      source: "auto-v2",
      ambiguous: false,
      hasConflict: false,
      header,
    };
  }

  return {
    version: fallbackVersion,
    source: "ambiguous",
    ambiguous: true,
    hasConflict: false,
    header,
  };
}

export interface EncodeTextOptions {
  version?: CipherVersion;
  mode?: MusicalMode;
  voice?: InstrumentVoice;
  format?: "code" | "full";
  includeHeader?: boolean;
}

export interface EncodedLineItem {
  type: "note" | "space";
  char: string;
  note?: string;
}

export interface EncodedLine {
  lineIndex: number;
  rawLine: string;
  items: EncodedLineItem[];
  codeLine: string;
}

/**
 * Converte texto plano em estrutura linha-a-linha para exibição e cópia.
 */
export function encodeTextLines(
  text: string,
  version: CipherVersion = "v2"
): EncodedLine[] {
  const { letterToNote } = getCipherTables(version);
  const normalizedLines = normalizeInputText(text).split("\n");

  return normalizedLines.map((line, lineIndex) => {
    if (!line.trim()) {
      return {
        lineIndex,
        rawLine: "",
        items: [],
        codeLine: "",
      };
    }

    const items: EncodedLineItem[] = [];
    const tokens: string[] = [];

    for (const char of line) {
      if (letterToNote[char]) {
        const note = letterToNote[char];
        items.push({ type: "note", char, note });
        tokens.push(note);
      } else if (char === " ") {
        items.push({ type: "space", char: " " });
        tokens.push("|");
      }
    }

    return {
      lineIndex,
      rawLine: line,
      items,
      codeLine: tokens.join(" "),
    };
  });
}

/**
 * Codifica texto livre em código Cartier (preservando linhas vazias e quebras de linha).
 */
export function encodeText(
  text: string,
  options: EncodeTextOptions = {}
): string {
  const {
    version = "v2",
    mode = "lua",
    voice = mode === "lua" ? "piano" : "cello",
    format = "code",
    includeHeader = format === "code",
  } = options;

  const { letterToNote } = getCipherTables(version);
  const lines = normalizeInputText(text).split("\n");

  const encodedLines = lines.map((line) => {
    if (!line.trim()) return "";
    const lineTokens: string[] = [];
    for (const char of line) {
      const note = letterToNote[char];
      if (note) {
        lineTokens.push(format === "full" ? `${note} (${char})` : note);
      } else if (char === " ") {
        lineTokens.push("|");
      }
    }
    return lineTokens.join(" ");
  });

  if (includeHeader) {
    return [formatHeader(version, mode, voice), ...encodedLines].join("\n");
  }
  return encodedLines.join("\n");
}

export interface DecodeCipherOptions {
  manualVersion?: CipherVersion;
  forceManualVersion?: boolean;
}

/**
 * Decifra um código Cartier preservando linhas, detectando versão e sinalizando
 * tokens inválidos sem ignorar em silêncio.
 */
export function decodeCipher(
  rawCode: string,
  options: DecodeCipherOptions = {}
): DecodeResult {
  const { manualVersion = "v2", forceManualVersion = false } = options;
  const detection = detectCipherVersion(rawCode, manualVersion);
  const activeVersion = forceManualVersion ? manualVersion : detection.version;
  const { noteToLetter } = getCipherTables(activeVersion);

  const rawLines = rawCode.replace(/\r\n/g, "\n").split("\n");

  // Remove linhas de comentário (#...) mantendo a estrutura das linhas de conteúdo
  const contentLines = rawLines.filter((line) => !line.trim().startsWith("#"));

  // Remove eventuais linhas vazias no início ou fim causadas pelo cabeçalho ou espaços extras
  while (contentLines.length > 0 && contentLines[0].trim() === "") {
    contentLines.shift();
  }
  while (
    contentLines.length > 0 &&
    contentLines[contentLines.length - 1].trim() === ""
  ) {
    contentLines.pop();
  }

  let letterCounter = 0;
  const allInvalidTokens: DecodedToken[] = [];
  const decodedLines: DecodedLine[] = contentLines.map((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return {
        lineIndex,
        tokens: [],
        decodedText: "",
        invalidTokens: [],
      };
    }

    const rawTokens = trimmed.split(/\s+/).filter(Boolean);
    const cleanedTokens = stripAnnotationTokens(rawTokens);

    const tokens: DecodedToken[] = [];
    const lineInvalids: DecodedToken[] = [];
    let decodedLineText = "";

    cleanedTokens.forEach((rawToken, tokenIndex) => {
      const upper = rawToken.toUpperCase();
      if (upper === "|") {
        tokens.push({
          id: `l${lineIndex}-t${tokenIndex}`,
          type: "space",
          raw: rawToken,
          lineIndex,
          tokenIndex,
          isValid: true,
        });
        decodedLineText += " ";
        return;
      }

      const letter = noteToLetter[upper];
      if (letter) {
        const tok: DecodedToken = {
          id: `l${lineIndex}-t${tokenIndex}`,
          type: "note",
          raw: rawToken,
          note: upper,
          letter,
          lineIndex,
          tokenIndex,
          letterIndex: letterCounter++,
          isValid: true,
        };
        tokens.push(tok);
        decodedLineText += letter;
      } else {
        const invalidTok: DecodedToken = {
          id: `l${lineIndex}-t${tokenIndex}`,
          type: "invalid",
          raw: rawToken,
          lineIndex,
          tokenIndex,
          isValid: false,
        };
        tokens.push(invalidTok);
        lineInvalids.push(invalidTok);
        allInvalidTokens.push(invalidTok);
      }
    });

    return {
      lineIndex,
      tokens,
      decodedText: decodedLineText,
      invalidTokens: lineInvalids,
    };
  });

  return {
    detection: {
      ...detection,
      version: activeVersion,
    },
    lines: decodedLines,
    decodedText: decodedLines.map((l) => l.decodedText).join("\n"),
    invalidTokens: allInvalidTokens,
    hasErrors: allInvalidTokens.length > 0,
    totalNotes: letterCounter,
  };
}
