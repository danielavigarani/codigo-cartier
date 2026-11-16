import { describe, expect, it } from "vitest";
import {
  V1_LETTER_TO_NOTE,
  V2_LETTER_TO_NOTE,
} from "../src/constants/cipherRules";
import {
  decodeCipher,
  detectCipherVersion,
  encodeText,
  formatHeader,
  normalizeInputText,
  parseHeader,
} from "../src/engine/cipher";

/**
 * Fixture exata extraída do `script.js` original da v1/v2 legado.
 */
function legacyScriptJsCodeMap(): Record<string, string> {
  const NOTES = ["A", "B", "C", "D", "E", "F", "G"];
  const START_OCTAVE = 2;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const codeMap: Record<string, string> = {};
  let currentNoteIndex = 0;
  let currentOctave = START_OCTAVE;

  alphabet.forEach((letter) => {
    const noteName = NOTES[currentNoteIndex];
    codeMap[letter] = `${noteName}${currentOctave}`;
    currentNoteIndex++;
    if (currentNoteIndex >= NOTES.length) {
      currentNoteIndex = 0;
      currentOctave++;
    }
  });
  return codeMap;
}

describe("Código Cartier — Motor de Cifra (v1 & v2)", () => {
  it("mantém a tabela v1 100% idêntica ao script.js original", () => {
    const expectedV1 = legacyScriptJsCodeMap();
    expect(V1_LETTER_TO_NOTE).toEqual(expectedV1);
    expect(V1_LETTER_TO_NOTE.A).toBe("A2");
    expect(V1_LETTER_TO_NOTE.C).toBe("C2");
    expect(V1_LETTER_TO_NOTE.H).toBe("A3");
    expect(V1_LETTER_TO_NOTE.Q).toBe("C4");
    expect(V1_LETTER_TO_NOTE.Z).toBe("E5");
  });

  it("implementa a tabela v2 com SPN real (oitava vira no Dó, A2 até E6)", () => {
    expect(V2_LETTER_TO_NOTE.A).toBe("A2");
    expect(V2_LETTER_TO_NOTE.B).toBe("B2");
    expect(V2_LETTER_TO_NOTE.C).toBe("C3");
    expect(V2_LETTER_TO_NOTE.H).toBe("A3");
    expect(V2_LETTER_TO_NOTE.J).toBe("C4");
    expect(V2_LETTER_TO_NOTE.Q).toBe("C5");
    expect(V2_LETTER_TO_NOTE.X).toBe("C6");
    expect(V2_LETTER_TO_NOTE.Z).toBe("E6");
  });

  it("normaliza acentos NFD e descarta pontuação", () => {
    expect(normalizeInputText("Olá, coração! É você?\nSim — 123.")).toBe(
      "OLA CORACAO E VOCE\nSIM  "
    );
  });

  it("faz round-trip texto → código → texto em v2 preservando acentos, |, quebras e linhas vazias", () => {
    const original = "Olá, Gabriela!\n\nSegredo no jardim.";
    const encoded = encodeText(original, {
      version: "v2",
      mode: "lua",
      voice: "piano",
      format: "code",
    });

    expect(encoded.startsWith("#cartier v2 modo=lua voz=piano\n")).toBe(true);
    const decoded = decodeCipher(encoded);
    expect(decoded.detection.version).toBe("v2");
    expect(decoded.detection.source).toBe("header");
    expect(decoded.hasErrors).toBe(false);
    expect(decoded.decodedText).toBe("OLA GABRIELA\n\nSEGREDO NO JARDIM");
  });

  it("faz round-trip texto → código → texto em v1 preservando linhas vazias e espaços", () => {
    const original = "Céu azul\n\nVoz antiga";
    const encoded = encodeText(original, {
      version: "v1",
      mode: "sol",
      voice: "harp",
      format: "code",
    });

    expect(encoded.startsWith("#cartier v1 modo=sol voz=harp\n")).toBe(true);
    const decoded = decodeCipher(encoded);
    expect(decoded.detection.version).toBe("v1");
    expect(decoded.decodedText).toBe("CEU AZUL\n\nVOZ ANTIGA");
  });

  it("gera formato completo (Nota + Letra) e consegue decifrá-lo também", () => {
    const full = encodeText("SOL LUA", {
      version: "v2",
      format: "full",
      includeHeader: false,
    });
    expect(full).toBe("E5 (S) A4 (O) E4 (L) | E4 (L) G5 (U) A2 (A)");

    const decoded = decodeCipher(full, { manualVersion: "v2" });
    expect(decoded.decodedText).toBe("SOL LUA");
    expect(decoded.hasErrors).toBe(false);
  });

  it("analisa o cabeçalho #cartier corretamente e mantém compatibilidade com voz=cello legado", () => {
    const headerStr = formatHeader("v2", "sol", "harp");
    expect(headerStr).toBe("#cartier v2 modo=sol voz=harp");
    const parsed = parseHeader(`${headerStr}\nA2 B2`);
    expect(parsed).toEqual({
      raw: "#cartier v2 modo=sol voz=harp",
      version: "v2",
      mode: "sol",
      voice: "harp",
    });

    const legacyParsed = parseHeader("#cartier v1 modo=sol voz=cello\nA2 B2");
    expect(legacyParsed.voice).toBe("harp");
  });

  it("detecta versão sem cabeçalho usando notas exclusivas e sinaliza ambiguidade", () => {
    const v1Detect = detectCipherVersion("C2 D2 | G2");
    expect(v1Detect.version).toBe("v1");
    expect(v1Detect.source).toBe("auto-v1");
    expect(v1Detect.ambiguous).toBe(false);

    const v2Detect = detectCipherVersion("F5 G5 | C6 E6");
    expect(v2Detect.version).toBe("v2");
    expect(v2Detect.source).toBe("auto-v2");
    expect(v2Detect.ambiguous).toBe(false);

    // Somente notas compartilhadas (A2, B2, A3, B3, A4, B4) -> ambíguo, usa fallback
    const ambig = detectCipherVersion("A2 B2 | A3 B4", "v2");
    expect(ambig.source).toBe("ambiguous");
    expect(ambig.ambiguous).toBe(true);
    expect(ambig.version).toBe("v2");

    const conflict = detectCipherVersion("C2 | C6", "v2");
    expect(conflict.source).toBe("conflict");
    expect(conflict.hasConflict).toBe(true);
  });

  it("sinaliza tokens inválidos explicitamente sem ignorar em silêncio", () => {
    const res = decodeCipher("#cartier v2 modo=lua voz=piano\nA2 XYZ | C2 B2");
    expect(res.hasErrors).toBe(true);
    expect(res.invalidTokens.map((t) => t.raw)).toEqual(["XYZ", "C2"]);
    // Notas válidas continuam decifradas: A2 = A, | = espaço, B2 = B
    expect(res.decodedText).toBe("A B");
  });
});
