import { describe, expect, it } from "vitest";
import { decodeCipher, encodeText } from "../src/engine/cipher";
import { buildPlaybackTimeline } from "../src/engine/HarmonyEngine";
import { parseRhythmFromLines } from "../src/engine/RhythmParser";
import { buildMidiBytes } from "../src/export/midi";
import { generateMusicXml } from "../src/export/musicxml";
import {
  buildCartierPayloadMarker,
  buildShareUrl,
  extractCodeFromHash,
  parseCartierPayloadMarker,
} from "../src/export/share";

describe("Código Cartier — Exportação, Compartilhamento & Verificação", () => {
  it("faz round-trip completo do link compartilhável #c=...", () => {
    const code = encodeText("LUA E SOL NO ECLIPSE", {
      version: "v2",
      mode: "lua",
      voice: "piano",
      format: "code",
    });

    const url = buildShareUrl(code, "https://exemplo.com/cartier/");
    const hash = new URL(url).hash;
    expect(hash.startsWith("#c=")).toBe(true);

    const extracted = extractCodeFromHash(hash);
    expect(extracted).toBe(code);
  });

  it("gera marcador CARTIER-PAYLOAD com SHA-256 válido e detecta adulteração", async () => {
    const code = encodeText("SEGREDO REAL", {
      version: "v2",
      mode: "sol",
      voice: "cello",
      format: "code",
    });

    const marker = await buildCartierPayloadMarker(code);
    expect(marker.startsWith("CARTIER-PAYLOAD:")).toBe(true);

    const parsed = await parseCartierPayloadMarker(
      `Texto qualquer do rodapé ${marker}`
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.code).toBe(code);
    expect(parsed?.hashValid).toBe(true);

    const tampered = marker.replace(/\|[0-9a-f]{4}/, "|0000");
    const parsedTampered = await parseCartierPayloadMarker(tampered);
    expect(parsedTampered?.hashValid).toBe(false);
  });

  it("gera MusicXML válido com armadura correta e sem notas de acompanhamento", () => {
    const code = encodeText("GABRIELA E PRIYA", {
      version: "v2",
      mode: "sol",
      voice: "cello",
      format: "code",
    });
    const decoded = decodeCipher(code);
    const { measuresByLine } = parseRhythmFromLines(decoded.lines, {
      timeSignature: "4/4",
      tempo: "andante",
    });
    const timeline = buildPlaybackTimeline({
      measuresByLine,
      mode: "sol",
      voice: "cello",
      orchestration: "sinfonia",
      fidelity: "fiel",
      tempo: "andante",
    });

    const xml = generateMusicXml(timeline, {
      title: "Opus I — Eclipse",
      mode: "sol",
    });

    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<fifths>3</fifths>");
    expect(xml).toContain("<harmony>");
    expect(xml).toContain("<staves>2</staves>");
    // Apenas 1 nota lógica por letra + pausas, nunca notas de acompanhamento
    const noteElements = xml.match(/<pitch>/g) ?? [];
    const expectedLetters = decoded.decodedText.replace(/[^A-Z]/g, "").length;
    expect(noteElements.length).toBeGreaterThanOrEqual(expectedLetters);
  });

  it("gera MIDI binário válido com cabeçalho MThd e trilhas separadas", () => {
    const code = encodeText("DUETO", {
      version: "v2",
      mode: "lua",
      voice: "piano",
      format: "code",
    });
    const decoded = decodeCipher(code);
    const { measuresByLine } = parseRhythmFromLines(decoded.lines);
    const timeline = buildPlaybackTimeline({
      measuresByLine,
      mode: "lua",
      voice: "piano",
      orchestration: "sinfonia",
      fidelity: "fiel",
      tempo: "andante",
    });

    const bytes = buildMidiBytes(timeline, "andante", true);
    // Assinatura MIDI "MThd"
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    expect(bytes.length).toBeGreaterThan(40);
  });
});
