import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { toImposingCelloRegister } from "../src/engine/AudioEngine";
import { decodeCipher, encodeText } from "../src/engine/cipher";
import {
  buildPlaybackTimeline,
  harmonizeMeasures,
  toSmoothPlaybackNote,
  toSoundingNote,
} from "../src/engine/HarmonyEngine";
import { parseRhythmFromLines } from "../src/engine/RhythmParser";
import { getDeterministicVelocity, hashString } from "../src/engine/seed";

describe("Código Cartier — Motor Rítmico, Harmônico e Semente Determinística", () => {
  it("gera velocity determinístico sem Math.random()", () => {
    const hash = hashString("A2 B2 C3");
    const v1 = getDeterministicVelocity(hash, 3, 0.8);
    const v2 = getDeterministicVelocity(hash, 3, 0.8);
    const vOther = getDeterministicVelocity(hash, 4, 0.8);

    expect(v1).toBe(v2);
    expect(v1).toBeGreaterThanOrEqual(0.2);
    expect(v1).toBeLessThanOrEqual(1);
    expect(v1).not.toBe(vOther);
  });

  it("fecha todos os compassos exatamente em 4/4 e 3/4, incluindo ties e pausas", () => {
    const code = encodeText("MISTÉRIO NA NOITE PROFUNDA DE LUAR", {
      version: "v2",
      format: "code",
    });
    const decoded = decodeCipher(code);

    for (const sig of ["4/4", "3/4"] as const) {
      const expectedBeats = sig === "4/4" ? 4 : 3;
      const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
        timeSignature: sig,
        tempo: "andante",
      });

      const nonEmptyMeasures = measuresByLine.flat();
      expect(nonEmptyMeasures.length).toBeGreaterThan(1);

      for (const m of nonEmptyMeasures) {
        const sum = m.events.reduce((acc, ev) => acc + ev.beats, 0);
        expect(sum).toBeCloseTo(expectedBeats, 6);
      }

      // Garante exatamente 1 tieHead por letra do texto
      const tieHeads = nonEmptyMeasures
        .flatMap((m) => m.events)
        .filter((ev) => ev.kind === "note" && ev.isTieHead);
      const cleanLetters = decoded.decodedText.replace(/[^A-Z]/g, "");
      expect(tieHeads.length).toBe(cleanLetters.length);
    }
  });

  it("preserva quebras de parágrafo (linhas vazias) na timeline de revelação", () => {
    const code = encodeText("OI\n\nLUA", { version: "v2", format: "code" });
    const decoded = decodeCipher(code);
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature: "4/4",
      tempo: "andante",
    });
    const timeline = buildPlaybackTimeline({
      measuresByLine,
      mode: "lua",
      voice: "piano",
      orchestration: "solo",
      fidelity: "fiel",
      tempo: "andante",
      seedText: code,
    });

    const lastReveal =
      timeline.melodyEvents[timeline.melodyEvents.length - 1]?.revealTextSoFar;
    expect(lastReveal).toBe("OI\n\nLUA");
  });

  it("aplica armadura do Modo Sol (C#, F#, G#) apenas na altura sonora", () => {
    expect(toSoundingNote("C4", "lua")).toBe("C4");
    expect(toSoundingNote("C4", "sol")).toBe("C#4");
    expect(toSoundingNote("F3", "sol")).toBe("F#3");
    expect(toSoundingNote("G5", "sol")).toBe("G#5");
    expect(toSoundingNote("A2", "sol")).toBe("A2");
    expect(toSoundingNote("D4", "sol")).toBe("D4");
  });

  it("respeita a regra estrita do G#: no Modo Lua, nunca escolhe acorde E se houver G natural no compasso", () => {
    // Em v2: G=G3, N=G4, U=G5. "GUGU" garante muitos G naturais no primeiro compasso!
    const code = encodeText("GUGU", { version: "v2", format: "code" });
    const decoded = decodeCipher(code);
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature: "4/4",
      tempo: "andante",
    });

    const harmonized = harmonizeMeasures(measuresByLine[0], "lua");
    harmonized.forEach((m) => {
      const hasNaturalG = m.events.some(
        (ev) => ev.kind === "note" && ev.cipherNote?.startsWith("G")
      );
      if (hasNaturalG) {
        expect(m.chord?.symbol).not.toBe("E");
        expect(m.chord?.symbol).not.toBe("E7");
      }
    });
  });

  it("reduz saltos no Modo Suave mantendo a classe de altura", () => {
    const prevMidi = Note.midi("C4")!;
    // X = C6 -> muito distante de C4; no modo Suave deve ir para C4 (0 semitons)
    const smooth = toSmoothPlaybackNote("C6", prevMidi, "lua");
    expect(Math.abs(smooth.midi - prevMidi)).toBeLessThanOrEqual(6);
    expect(Note.pitchClass(smooth.note)).toBe("C");
  });

  it("gera acompanhamento apenas em Noturno/Sinfonia e na voz parceira", () => {
    const code = encodeText("SEGREDOS", { version: "v2", format: "code" });
    const decoded = decodeCipher(code);
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature: "4/4",
      tempo: "andante",
    });

    const solo = buildPlaybackTimeline({
      measuresByLine,
      mode: "lua",
      voice: "piano",
      orchestration: "solo",
      fidelity: "fiel",
      tempo: "andante",
    });
    expect(solo.accompanimentEvents.length).toBe(0);

    const sinfoniaLua = buildPlaybackTimeline({
      measuresByLine,
      mode: "lua",
      voice: "piano",
      orchestration: "sinfonia",
      fidelity: "fiel",
      tempo: "andante",
    });
    expect(sinfoniaLua.accompanimentEvents.length).toBeGreaterThan(0);
    expect(
      sinfoniaLua.accompanimentEvents.every((ev) => ev.voice === "cello")
    ).toBe(true);
  });

  it("conduz o violoncelo para o registro grave/barítono imponente (C2–B3) preservando a classe da nota", () => {
    const highSharp = toImposingCelloRegister("C#5");
    expect(highSharp.mainNote).toBe("C#3");
    expect(highSharp.subBassNote).toBe("C#2");

    const veryHigh = toImposingCelloRegister("E6");
    expect(veryHigh.mainNote).toBe("E3");
    expect(veryHigh.subBassNote).toBe("E2");

    const lowA = toImposingCelloRegister("A2");
    expect(lowA.mainNote).toBe("A2");
    expect(lowA.subBassNote).toBeNull();
  });
});
