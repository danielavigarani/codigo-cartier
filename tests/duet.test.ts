import { describe, expect, it } from "vitest";
import { buildDuetCombinedTimeline } from "../src/components/session/DuetSession";
import { encodeText } from "../src/engine/cipher";
import type { DuetMessage } from "../src/types/music";

describe("Código Cartier — Sessão / Dueto (Eclipse)", () => {
  it("concatena falas em Piano (Lua) e Harpa Astral (Sol) em sequência sem sobreposição", () => {
    const messages: DuetMessage[] = [
      {
        id: "m1",
        senderName: "Priya (Lua)",
        voice: "piano",
        mode: "lua",
        rawText: "LUA",
        cipherCode: encodeText("LUA", {
          version: "v2",
          mode: "lua",
          voice: "piano",
          format: "code",
        }),
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m2",
        senderName: "Gabriela (Sol)",
        voice: "harp",
        mode: "sol",
        rawText: "SOL",
        cipherCode: encodeText("SOL", {
          version: "v2",
          mode: "sol",
          voice: "harp",
          format: "code",
        }),
        createdAt: "2026-01-01T00:01:00Z",
      },
    ];

    const { timeline, messageRanges } = buildDuetCombinedTimeline(messages, {
      tempo: "andante",
      timeSignature: "4/4",
      orchestration: "solo",
      fidelity: "fiel",
      cipherVersion: "v2",
    });

    expect(messageRanges.length).toBe(2);
    expect(messageRanges[1].startSec).toBeGreaterThan(messageRanges[0].endSec);

    const pianoAudible = timeline.melodyEvents.filter(
      (e) => e.voice === "piano" && e.isMelody && e.soundingNote !== ""
    );
    const harpAudible = timeline.melodyEvents.filter(
      (e) => e.voice === "harp" && e.isMelody && e.soundingNote !== ""
    );
    expect(pianoAudible.length).toBe(3); // L U A (sem duplo ataque em ligaduras)
    expect(harpAudible.length).toBe(3); // S O L
  });
});
